// server.js — Point d'entrée de l'application Livrabi
require('dotenv').config();

const express      = require('express');
const mongoose     = require('mongoose');
const session      = require('express-session');
const MongoStore   = require('connect-mongo');
const cors         = require('cors');
const path         = require('path');

const authRoutes    = require('./routes/auth');
const storiesRoutes = require('./routes/stories');
const adminRoutes   = require('./routes/admin');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── CONNEXION MONGODB ──
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB connecté'))
  .catch(err => { console.error('❌ Erreur MongoDB :', err.message); process.exit(1); });

// ── MIDDLEWARES ──
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── SESSIONS (stockées dans MongoDB) ──
app.use(session({
  secret: process.env.SESSION_SECRET || 'livrabi-secret-change-moi',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI }),
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 * 7,  // 7 jours
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  },
}));

// ── FICHIERS STATIQUES (le frontend) ──
app.use(express.static(path.join(__dirname, 'public')));

// ── ROUTES API ──
app.use('/api/auth',    authRoutes);
app.use('/api/stories', storiesRoutes);
app.use('/api/admin',   adminRoutes);

// ── TOUTES LES AUTRES ROUTES → index.html (SPA) ──
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── DÉMARRAGE ──
app.listen(PORT, () => {
  console.log(`🚀 Livrabi lancé sur http://localhost:${PORT}`);
});
