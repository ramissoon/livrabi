// routes/auth.js — Inscription, Connexion, Réinitialisation
const router   = require('express').Router();
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { v4: uuid } = require('uuid');
const db       = require('../db');
const mailer   = require('../services/mailer');

// ── POST /api/auth/register ───────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { email, pseudo, password, lang = 'fr' } = req.body;

    if (!email || !pseudo || !password)
      return res.status(400).json({ error: 'Tous les champs sont requis.' });
    if (password.length < 8)
      return res.status(400).json({ error: 'Le mot de passe doit faire au moins 8 caractères.' });
    if (!/^[a-zA-Z0-9_À-ÿ]{3,30}$/.test(pseudo))
      return res.status(400).json({ error: 'Pseudonyme invalide (3-30 caractères, lettres/chiffres/_).' });

    const exists = await db.query(
      'SELECT id FROM users WHERE email=$1 OR pseudo=$2', [email.toLowerCase(), pseudo]
    );
    if (exists.rows.length > 0)
      return res.status(409).json({ error: 'Email ou pseudonyme déjà utilisé.' });

    const hash         = await bcrypt.hash(password, 12);
    const verifyToken  = uuid();
    const isFirstUser  = (await db.query('SELECT COUNT(*) FROM users')).rows[0].count === '0';
    const role         = (email.toLowerCase() === process.env.ADMIN_EMAIL?.toLowerCase() || isFirstUser) ? 'admin' : 'user';

    const { rows } = await db.query(
      `INSERT INTO users (email, pseudo, password_hash, lang, role, verify_token)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, pseudo, email, lang, role`,
      [email.toLowerCase(), pseudo, hash, lang, role, verifyToken]
    );

    await mailer.sendVerification(email, pseudo, verifyToken);

    const token = jwt.sign({ id: rows[0].id, pseudo: rows[0].pseudo, role: rows[0].role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });
    res.status(201).json({ token, user: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de l\'inscription.' });
  }
});

// ── POST /api/auth/login ──────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email et mot de passe requis.' });

    const { rows } = await db.query(
      'SELECT * FROM users WHERE email=$1', [email.toLowerCase()]
    );
    if (!rows.length)
      return res.status(401).json({ error: 'Identifiants incorrects.' });

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid)
      return res.status(401).json({ error: 'Identifiants incorrects.' });

    const token = jwt.sign({ id: user.id, pseudo: user.pseudo, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });
    res.json({ token, user: { id: user.id, pseudo: user.pseudo, email: user.email, lang: user.lang, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la connexion.' });
  }
});

// ── POST /api/auth/forgot-password ───────────────────
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const { rows } = await db.query('SELECT * FROM users WHERE email=$1', [email?.toLowerCase()]);
    if (!rows.length) return res.json({ message: 'Si ce compte existe, un email a été envoyé.' });

    const token   = uuid();
    const expires = new Date(Date.now() + 3600000); // 1h
    await db.query('UPDATE users SET reset_token=$1, reset_expires=$2 WHERE id=$3', [token, expires, rows[0].id]);
    await mailer.sendPasswordReset(email, rows[0].pseudo, token);

    res.json({ message: 'Si ce compte existe, un email a été envoyé.' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ── POST /api/auth/reset-password ────────────────────
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password || password.length < 8)
      return res.status(400).json({ error: 'Token et mot de passe (min 8 car.) requis.' });

    const { rows } = await db.query(
      'SELECT * FROM users WHERE reset_token=$1 AND reset_expires > NOW()', [token]
    );
    if (!rows.length)
      return res.status(400).json({ error: 'Lien expiré ou invalide.' });

    const hash = await bcrypt.hash(password, 12);
    await db.query('UPDATE users SET password_hash=$1, reset_token=NULL, reset_expires=NULL WHERE id=$2', [hash, rows[0].id]);
    res.json({ message: 'Mot de passe mis à jour avec succès.' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ── GET /api/auth/verify/:token ───────────────────────
router.get('/verify/:token', async (req, res) => {
  try {
    const { rows } = await db.query(
      'UPDATE users SET is_verified=true, verify_token=NULL WHERE verify_token=$1 RETURNING id',
      [req.params.token]
    );
    if (!rows.length) return res.status(400).json({ error: 'Token invalide.' });
    res.json({ message: 'Compte vérifié avec succès !' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

module.exports = router;
