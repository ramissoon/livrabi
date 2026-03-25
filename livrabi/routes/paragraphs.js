// routes/paragraphs.js — sans restriction de cooldown ni de mots
const router = require('express').Router();
const db     = require('../db');
const { requireAuth } = require('../middleware/auth');

router.post('/', requireAuth, async (req, res) => {
  try {
    const { story_id, content, is_branch, branch_from } = req.body;
    if (!story_id || !content?.trim())
      return res.status(400).json({ error: 'story_id et contenu requis.' });

    const { rows: [story] } = await db.query(
      `SELECT * FROM stories WHERE id=$1 AND status='active'`, [story_id]
    );
    if (!story) return res.status(404).json({ error: 'Histoire introuvable.' });

    const words = content.trim().split(/\s+/).filter(Boolean).length;

    const { rows: [{ max_pos }] } = await db.query(
      `SELECT COALESCE(MAX(position),0) as max_pos FROM paragraphs WHERE story_id=$1`, [story_id]
    );

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const { rows: [para] } = await client.query(
        `INSERT INTO paragraphs (story_id, author_id, content, word_count, is_branch, branch_from, position)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [story_id, req.user.id, content.trim(), words,
         is_branch||false, branch_from||null, max_pos+1]
      );

      await client.query(
        `UPDATE stories SET contrib_count=contrib_count+1 WHERE id=$1`, [story_id]
      );

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
