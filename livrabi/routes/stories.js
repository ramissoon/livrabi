// routes/stories.js
const router = require('express').Router();
const db     = require('../db');
const { requireAuth } = require('../middleware/auth');

// ── GET /api/stories — Liste avec tri ─────────────────
router.get('/', async (req, res) => {
  try {
    const { sort = 'likes', limit = 20, offset = 0 } = req.query;
    const orderMap = {
      likes:        'likes_count DESC',
      contributors: 'contrib_count DESC',
      followed:     'followers_count DESC',
      recent:       'created_at DESC',
    };
    const order = orderMap[sort] || 'likes_count DESC';

    const { rows } = await db.query(`
      SELECT s.*, u.pseudo as author_pseudo
      FROM stories s
      JOIN users u ON s.author_id = u.id
      WHERE s.status = 'active'
      ORDER BY ${order}
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors du chargement des histoires.' });
  }
});

// ── GET /api/stories/:id — Détail + paragraphes ───────
router.get('/:id', async (req, res) => {
  try {
    const { rows: [story] } = await db.query(`
      SELECT s.*, u.pseudo as author_pseudo
      FROM stories s JOIN users u ON s.author_id=u.id
      WHERE s.id=$1 AND s.status='active'
    `, [req.params.id]);

    if (!story) return res.status(404).json({ error: 'Histoire introuvable.' });

    const { rows: paragraphs } = await db.query(`
      SELECT p.*, u.pseudo as author_pseudo
      FROM paragraphs p JOIN users u ON p.author_id=u.id
      WHERE p.story_id=$1
      ORDER BY p.position ASC, p.created_at ASC
    `, [req.params.id]);

    res.json({ ...story, paragraphs });
  } catch (err) {
    res.status(500).json({ error: 'Erreur.' });
  }
});

// ── POST /api/stories — Créer une histoire ────────────
router.post('/', requireAuth, async (req, res) => {
  try {
    const { title, genre, content, image_type, image_url } = req.body;
    if (!title?.trim() || !genre?.trim() || !content?.trim())
      return res.status(400).json({ error: 'Titre, genre et premier paragraphe requis.' });

    const words = content.trim().split(/\s+/).length;
    if (words > 200) return res.status(400).json({ error: 'Le premier paragraphe dépasse 200 mots.' });

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      const { rows: [story] } = await client.query(
        `INSERT INTO stories (title, genre, author_id) VALUES ($1,$2,$3) RETURNING *`,
        [title.trim(), genre.trim(), req.user.id]
      );
      await client.query(
        `INSERT INTO paragraphs (story_id, author_id, content, word_count, image_type, image_url, is_first, position)
         VALUES ($1,$2,$3,$4,$5,$6,true,0)`,
        [story.id, req.user.id, content.trim(), words, image_type||null, image_url||null]
      );
      await client.query('COMMIT');
      res.status(201).json(story);
    } catch (e) {
      await client.query('ROLLBACK'); throw e;
    } finally { client.release(); }
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la création.' });
  }
});

// ── POST /api/stories/:id/like ────────────────────────
router.post('/:id/like', requireAuth, async (req, res) => {
  try {
    const existing = await db.query('SELECT 1 FROM likes WHERE user_id=$1 AND story_id=$2', [req.user.id, req.params.id]);
    if (existing.rows.length) {
      await db.query('DELETE FROM likes WHERE user_id=$1 AND story_id=$2', [req.user.id, req.params.id]);
      await db.query('UPDATE stories SET likes_count = likes_count-1 WHERE id=$1', [req.params.id]);
      return res.json({ liked: false });
    }
    await db.query('INSERT INTO likes (user_id,story_id) VALUES ($1,$2)', [req.user.id, req.params.id]);
    await db.query('UPDATE stories SET likes_count = likes_count+1 WHERE id=$1', [req.params.id]);
    res.json({ liked: true });
  } catch (err) {
    res.status(500).json({ error: 'Erreur.' });
  }
});

// ── POST /api/stories/:id/follow ──────────────────────
router.post('/:id/follow', requireAuth, async (req, res) => {
  try {
    const existing = await db.query('SELECT 1 FROM follows WHERE user_id=$1 AND story_id=$2', [req.user.id, req.params.id]);
    if (existing.rows.length) {
      await db.query('DELETE FROM follows WHERE user_id=$1 AND story_id=$2', [req.user.id, req.params.id]);
      await db.query('UPDATE stories SET followers_count = followers_count-1 WHERE id=$1', [req.params.id]);
      return res.json({ following: false });
    }
    await db.query('INSERT INTO follows (user_id,story_id) VALUES ($1,$2)', [req.user.id, req.params.id]);
    await db.query('UPDATE stories SET followers_count = followers_count+1 WHERE id=$1', [req.params.id]);
    res.json({ following: true });
  } catch (err) {
    res.status(500).json({ error: 'Erreur.' });
  }
});

module.exports = router;
