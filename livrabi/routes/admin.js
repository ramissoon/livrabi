// routes/admin.js — Tableau de bord administrateur
const router = require('express').Router();
const db     = require('../db');
const { requireAdmin } = require('../middleware/auth');

// Toutes les routes admin sont protégées
router.use(requireAdmin);

// ── GET /api/admin/stats ──────────────────────────────
router.get('/stats', async (req, res) => {
  const [users, stories, paragraphs, likes] = await Promise.all([
    db.query('SELECT COUNT(*) FROM users'),
    db.query(`SELECT COUNT(*) FROM stories WHERE status='active'`),
    db.query('SELECT COUNT(*) FROM paragraphs'),
    db.query('SELECT COUNT(*) FROM likes'),
  ]);
  res.json({
    total_users:      parseInt(users.rows[0].count),
    total_stories:    parseInt(stories.rows[0].count),
    total_paragraphs: parseInt(paragraphs.rows[0].count),
    total_likes:      parseInt(likes.rows[0].count),
  });
});

// ── GET /api/admin/users ──────────────────────────────
router.get('/users', async (req, res) => {
  const { limit=50, offset=0, search='' } = req.query;
  const { rows } = await db.query(`
    SELECT id, email, pseudo, role, is_verified, created_at,
      (SELECT COUNT(*) FROM stories WHERE author_id=users.id) as story_count,
      (SELECT COUNT(*) FROM paragraphs WHERE author_id=users.id) as para_count
    FROM users
    WHERE pseudo ILIKE $1 OR email ILIKE $1
    ORDER BY created_at DESC LIMIT $2 OFFSET $3
  `, [`%${search}%`, limit, offset]);
  res.json(rows);
});

// ── PATCH /api/admin/users/:id/role ──────────────────
router.patch('/users/:id/role', async (req, res) => {
  const { role } = req.body;
  if (!['user','admin'].includes(role)) return res.status(400).json({ error: 'Rôle invalide.' });
  const { rows: [u] } = await db.query(`UPDATE users SET role=$1 WHERE id=$2 RETURNING id,pseudo,role`, [role, req.params.id]);
  res.json(u);
});

// ── DELETE /api/admin/users/:id ───────────────────────
router.delete('/users/:id', async (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: 'Impossible de supprimer votre propre compte.' });
  await db.query('DELETE FROM users WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

// ── GET /api/admin/stories ────────────────────────────
router.get('/stories', async (req, res) => {
  const { limit=50, offset=0 } = req.query;
  const { rows } = await db.query(`
    SELECT s.*, u.pseudo as author_pseudo
    FROM stories s JOIN users u ON s.author_id=u.id
    ORDER BY s.created_at DESC LIMIT $1 OFFSET $2
  `, [limit, offset]);
  res.json(rows);
});

// ── PATCH /api/admin/stories/:id/status ──────────────
router.patch('/stories/:id/status', async (req, res) => {
  const { status } = req.body;
  if (!['active','closed','deleted'].includes(status)) return res.status(400).json({ error: 'Statut invalide.' });
  const { rows: [s] } = await db.query(`UPDATE stories SET status=$1 WHERE id=$2 RETURNING id,title,status`, [status, req.params.id]);
  res.json(s);
});

// ── DELETE /api/admin/paragraphs/:id ─────────────────
router.delete('/paragraphs/:id', async (req, res) => {
  await db.query('DELETE FROM paragraphs WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
