// routes/auth.js
const express = require('express');
const bcrypt  = require('bcryptjs');
const { User } = require('../models');
const router  = express.Router();

// ── INSCRIPTION ──
router.post('/register', async (req, res) => {
  try {
    const { pseudo, pw, fav } = req.body;
    if (!pseudo || !pw || !fav)
      return res.status(400).json({ error: 'Tous les champs sont requis.' });

    const exists = await User.findOne({ pseudo: new RegExp(`^${pseudo}$`, 'i') });
    if (exists)
      return res.status(400).json({ error: 'Ce pseudonyme est déjà pris.' });

    const isFirstUser = (await User.countDocuments()) === 0;
    const hashed = await bcrypt.hash(pw, 10);

    const user = await User.create({ pseudo, pw: hashed, fav: fav.toLowerCase(), isAdmin: isFirstUser });

    req.session.pseudo = user.pseudo;
    res.json({ pseudo: user.pseudo, isAdmin: user.isAdmin, fav: user.fav });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ── CONNEXION ──
router.post('/login', async (req, res) => {
  try {
    const { pseudo, pw } = req.body;
    const user = await User.findOne({ pseudo: new RegExp(`^${pseudo}$`, 'i') });
    if (!user) return res.status(401).json({ error: 'Pseudonyme ou mot de passe incorrect.' });

    const ok = await bcrypt.compare(pw, user.pw);
    if (!ok)   return res.status(401).json({ error: 'Pseudonyme ou mot de passe incorrect.' });

    req.session.pseudo = user.pseudo;
    res.json({ pseudo: user.pseudo, isAdmin: user.isAdmin, fav: user.fav });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ── DÉCONNEXION ──
router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// ── SESSION COURANTE ──
router.get('/me', async (req, res) => {
  if (!req.session.pseudo) return res.json(null);
  const user = await User.findOne({ pseudo: req.session.pseudo });
  if (!user) return res.json(null);
  res.json({ pseudo: user.pseudo, isAdmin: user.isAdmin, fav: user.fav });
});

// ── MOT DE PASSE OUBLIÉ ──
router.post('/forgot', async (req, res) => {
  try {
    const { pseudo, fav } = req.body;
    const user = await User.findOne({
      pseudo: new RegExp(`^${pseudo}$`, 'i'),
      fav: fav.toLowerCase(),
    });
    if (!user) return res.status(401).json({ error: 'Pseudonyme ou mot préféré incorrect.' });

    // On retourne le mot de passe en clair (tel que saisi à l'inscription)
    // Puisqu'on ne stocke que le hash, on informe l'utilisateur de réinitialiser
    res.json({ message: 'Votre mot de passe est chiffré et ne peut pas être affiché. Veuillez en choisir un nouveau.', canReset: true });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ── RÉINITIALISER MOT DE PASSE ──
router.post('/reset-password', async (req, res) => {
  try {
    const { pseudo, fav, newPw } = req.body;
    const user = await User.findOne({
      pseudo: new RegExp(`^${pseudo}$`, 'i'),
      fav: fav.toLowerCase(),
    });
    if (!user) return res.status(401).json({ error: 'Vérification échouée.' });

    user.pw = await bcrypt.hash(newPw, 10);
    await user.save();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

module.exports = router;
