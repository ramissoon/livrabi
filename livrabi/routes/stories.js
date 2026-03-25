// routes/stories.js — avec gestion de la couverture (base64 → stockage)
const router = require('express').Router();
const db     = require('../db');
const path   = require('path');
const fs     = require('fs');
const { v4: uuid } = require('uuid');
const { requireAuth } = require('../middleware/auth');

// ── GET /api/stories ──────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { sort = 'likes', limit = 20, offset = 0 } = req.query;
    const orderMap = {
      likes:        's.likes_count DESC',
      contributors: 's.contrib_count DESC',
      followed:     's.followers_count DESC',
      recent:       's.created_at DESC',
    };
    const order = orderMap[sort] || 's.likes_count DESC';

    const { rows } = await db.query(`
      SELECT s.*, u.pseudo as author_pseudo,
        (SELECT LEFT(p.content, 180) FROM paragraphs p WHERE p.story_id=s.id AND p.is_first=true LIMIT 1) as excerpt
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

// ── GET /api/stories/:id ──────────────────────────────────
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

// ── POST /api/stories ─────────────────────────────────────
router.post('/', requireAuth, async (req, res) => {
  try {
    const { title, genre, content, cover_data } = req.body;
    if (!title?.trim() || !genre?.trim() || !content?.trim())
      return res.status(400).json({ error: 'Titre, genre et premier paragraphe requis.' });

    // Sauvegarder la couverture si fournie
    let cover_url = null;
    if (cover_data && cover_data.startsWith('data:image/')) {
      const uploadsDir = path.join(__dirname, '..', 'public', 'uploads');
      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
      const ext = cover_data.split(';')[0].split('/')[1].replace('jpeg','jpg');
      const filename = `cover_${uuid()}.${ext}`;
      const buffer = Buffer.from(cover_data.split(',')[1], 'base64');
      fs.writeFileSync(path.join(uploadsDir, filename), buffer);
      cover_url = `/uploads/${filename}`;
    }

    const words = content.trim().split(/\s+/).filter(Boolean).length;

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      const { rows: [story] } = await client.query(
        `INSERT INTO stories (title, genre, author_id, cover_url) VALUES ($1,$2,$3,$4) RETURNING *`,
        [title.trim(), genre.trim(), req.user.id, cover_url]
      );
      await client.query(
        `INSERT INTO paragraphs (story_id, author_id, content, word_count, is_first, position)
         VALUES ($1,$2,$3,$4,true,0)`,
        [story.id, req.user.id, content.trim(), words]
      );
      await client.query('COMMIT');
      res.status(201).json(story);
    } catch(e) {
      await client.query('ROLLBACK'); throw e;
    } finally { client.release(); }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la création.' });
  }
});

// ── POST /api/stories/:id/like ────────────────────────────
router.post('/:id/like', requireAuth, async (req, res) => {
  try {
    const existing = await db.query('SELECT 1 FROM likes WHERE user_id=$1 AND story_id=$2', [req.user.id, req.params.id]);
    if (existing.rows.length) {
      await db.query('DELETE FROM likes WHERE user_id=$1 AND story_id=$2', [req.user.id, req.params.id]);
      await db.query('UPDATE stories SET likes_count=GREATEST(0,likes_count-1) WHERE id=$1', [req.params.id]);
      return res.json({ liked: false });
    }
    await db.query('INSERT INTO likes (user_id,story_id) VALUES ($1,$2)', [req.user.id, req.params.id]);
    await db.query('UPDATE stories SET likes_count=likes_count+1 WHERE id=$1', [req.params.id]);
    res.json({ liked: true });
  } catch (err) { res.status(500).json({ error: 'Erreur.' }); }
});

// ── POST /api/stories/:id/follow ──────────────────────────
router.post('/:id/follow', requireAuth, async (req, res) => {
  try {
    const existing = await db.query('SELECT 1 FROM follows WHERE user_id=$1 AND story_id=$2', [req.user.id, req.params.id]);
    if (existing.rows.length) {
      await db.query('DELETE FROM follows WHERE user_id=$1 AND story_id=$2', [req.user.id, req.params.id]);
      await db.query('UPDATE stories SET followers_count=GREATEST(0,followers_count-1) WHERE id=$1', [req.params.id]);
      return res.json({ following: false });
    }
    await db.query('INSERT INTO follows (user_id,story_id) VALUES ($1,$2)', [req.user.id, req.params.id]);
    await db.query('UPDATE stories SET followers_count=followers_count+1 WHERE id=$1', [req.params.id]);
    res.json({ following: true });
  } catch (err) { res.status(500).json({ error: 'Erreur.' }); }
});

module.exports = router;
