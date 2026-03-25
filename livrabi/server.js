// ═══════════════════════════════════════════════════════
//  LIVRABI — Serveur principal (server.js)
// ═══════════════════════════════════════════════════════
require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const helmet   = require('helmet');
const path     = require('path');
const rateLimit = require('express-rate-limit');

const authRoutes    = require('./routes/auth');
const storyRoutes   = require('./routes/stories');
const paraRoutes    = require('./routes/paragraphs');
const userRoutes    = require('./routes/users');
const adminRoutes   = require('./routes/admin');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Sécurité ──────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.SITE_URL || '*', credentials: true }));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Rate limiting ─────────────────────────────────────
const apiLimiter = rateLimit({ windowMs: 15*60*1000, max: 200, standardHeaders: true });
const authLimiter = rateLimit({ windowMs: 60*60*1000, max: 20, message: { error: 'Trop de tentatives. Réessayez dans 1 heure.' } });
app.use('/api/', apiLimiter);
app.use('/api/auth/', authLimiter);

// ── API Routes ────────────────────────────────────────
app.use('/api/auth',       authRoutes);
app.use('/api/stories',    storyRoutes);
app.use('/api/paragraphs', paraRoutes);
app.use('/api/users',      userRoutes);
app.use('/api/admin',      adminRoutes);

// ── Static frontend ───────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Error handler ─────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Erreur interne du serveur.' });
});

app.listen(PORT, () => console.log(`✅ Livrabi démarré sur http://localhost:${PORT}`));
module.exports = app;
