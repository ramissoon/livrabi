// routes/users.js
const router = require('express').Router();
const db     = require('../db');
const { requireAuth } = require('../middleware/auth');

// ── GET /api/users/me ─────────────────────────────────
router.get('/me', requireAuth, async (req, res) => {
  const { rows: [user] } = await db.query(
    `SELECT id, email, pseudo, lang, role, is_verified, created_at FROM users WHERE id=$1`, [req.user.id]
  );
  res.json(user);
});

// ── PATCH /api/users/me ───────────────────────────────
router.patch('/me', requireAuth, async (req, res) => {
  const { lang } = req.body;
  if (lang && !['fr','en'].includes(lang))
    return res.status(400).json({ error: 'Langue invalide.' });
  const { rows: [user] } = await db.query(
    `UPDATE users SET lang=COALESCE($1,lang) WHERE id=$2
     RETURNING id, email, pseudo, lang, role`, [lang||null, req.user.id]
  );
  res.json(user);
});

// ── GET /api/users/notifications ─────────────────────
router.get('/notifications', requireAuth, async (req, res) => {
  const { rows } = await db.query(
    `SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 30`, [req.user.id]
  );
  res.json(rows);
});

// ── PATCH /api/users/notifications/read ──────────────
router.patch('/notifications/read', requireAuth, async (req, res) => {
  await db.query(`UPDATE notifications SET is_read=true WHERE user_id=$1`, [req.user.id]);
  res.json({ ok: true });
});

// ── GET /api/users/cooldown/:storyId ─────────────────
router.get('/cooldown/:storyId', requireAuth, async (req, res) => {
  const { rows: [row] } = await db.query(
    `SELECT last_contributed_at FROM contribution_cooldowns WHERE user_id=$1 AND story_id=$2`,
    [req.user.id, req.params.storyId]
  );
  if (!row) return res.json({ can_contribute: true, remaining_minutes: 0 });
  const elapsed = Date.now() - new Date(row.last_contributed_at).getTime();
  const COOLDOWN = 60 * 60 * 1000;
  const remaining = Math.max(0, Math.ceil((COOLDOWN - elapsed) / 60000));
  res.json({ can_contribute: remaining === 0, remaining_minutes: remaining });
});

module.exports = router;
