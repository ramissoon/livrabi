// routes/paragraphs.js
const router = require('express').Router();
const db     = require('../db');
const { requireAuth } = require('../middleware/auth');

const COOLDOWN_MS   = 60 * 60 * 1000; // 60 minutes
const MAX_WORDS     = 150;

// ── POST /api/paragraphs — Proposer une suite ─────────
router.post('/', requireAuth, async (req, res) => {
  try {
    const { story_id, content, image_type, image_url, is_branch, branch_from } = req.body;

    if (!story_id || !content?.trim())
      return res.status(400).json({ error: 'story_id et contenu requis.' });

    // Vérifier que l'histoire existe
    const { rows: [story] } = await db.query(`SELECT * FROM stories WHERE id=$1 AND status='active'`, [story_id]);
    if (!story) return res.status(404).json({ error: 'Histoire introuvable.' });

    // Vérifier cooldown (1 contribution par 60 min par histoire)
    const { rows: [cooldown] } = await db.query(
      `SELECT last_contributed_at FROM contribution_cooldowns WHERE user_id=$1 AND story_id=$2`,
      [req.user.id, story_id]
    );
    if (cooldown) {
      const elapsed = Date.now() - new Date(cooldown.last_contributed_at).getTime();
      if (elapsed < COOLDOWN_MS) {
        const remaining = Math.ceil((COOLDOWN_MS - elapsed) / 60000);
        return res.status(429).json({ error: `Vous devez attendre encore ${remaining} minute(s) avant de contribuer à nouveau.` });
      }
    }

    // Vérifier le nombre de mots
    const words = content.trim().split(/\s+/).length;
    if (words > MAX_WORDS) return res.status(400).json({ error: `Limite de ${MAX_WORDS} mots dépassée (${words} mots).` });

    // Calculer la position
    const { rows: [{ max_pos }] } = await db.query(
      `SELECT COALESCE(MAX(position),0) as max_pos FROM paragraphs WHERE story_id=$1`, [story_id]
    );

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // Insérer le paragraphe
      const { rows: [para] } = await client.query(
        `INSERT INTO paragraphs (story_id, author_id, content, word_count, image_type, image_url, is_branch, branch_from, position)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [story_id, req.user.id, content.trim(), words, image_type||null, image_url||null,
         is_branch||false, branch_from||null, max_pos+1]
      );

      // Mettre à jour le cooldown
      await client.query(
        `INSERT INTO contribution_cooldowns (user_id, story_id, last_contributed_at)
         VALUES ($1,$2,NOW())
         ON CONFLICT (user_id, story_id) DO UPDATE SET last_contributed_at=NOW()`,
        [req.user.id, story_id]
      );

      // Incrémenter le compteur de contributions
      await client.query(`UPDATE stories SET contrib_count=contrib_count+1 WHERE id=$1`, [story_id]);

      // Notifier les abonnés
      const { rows: followers } = await client.query(
        `SELECT user_id FROM follows WHERE story_id=$1 AND user_id != $2`, [story_id, req.user.id]
      );
      for (const f of followers) {
        await client.query(
          `INSERT INTO notifications (user_id, type, story_id, message) VALUES ($1,$2,$3,$4)`,
          [f.user_id, is_branch ? 'new_branch' : 'new_paragraph', story_id,
           `@${req.user.pseudo} a ${is_branch ? 'créé un embranchement' : 'ajouté un paragraphe'} dans "${story.title}"`]
        );
      }

      await client.query('COMMIT');
      res.status(201).json(para);
    } catch(e) {
      await client.query('ROLLBACK'); throw e;
    } finally { client.release(); }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la contribution.' });
  }
});

module.exports = router;
