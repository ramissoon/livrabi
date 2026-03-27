// routes/admin.js
const express = require('express');
const bcrypt  = require('bcryptjs');
const { User, Story } = require('../models');
const router  = express.Router();

async function adminOnly(req, res, next) {
  if (!req.session.pseudo) return res.status(401).json({ error: 'Non connecté.' });
  const user = await User.findOne({ pseudo: req.session.pseudo });
  if (!user || !user.isAdmin) return res.status(403).json({ error: 'Accès refusé.' });
  next();
}

// ── LISTE DES UTILISATEURS ──
router.get('/users', adminOnly, async (req, res) => {
  try {
    const users = await User.find().select('-pw').lean();
    // Enrichir avec le nombre d'histoires
    const stories = await Story.find().lean();
    const result = users.map(u => ({
      ...u,
      storiesCount: stories.filter(s => s.author === u.pseudo).length,
    }));
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ── PROMOUVOIR EN ADMIN ──
router.patch('/users/:pseudo/promote', adminOnly, async (req, res) => {
  try {
    await User.updateOne({ pseudo: req.params.pseudo }, { isAdmin: true });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ── RÉTROGRADER ──
router.patch('/users/:pseudo/demote', adminOnly, async (req, res) => {
  try {
    // Empêcher de se rétrograder soi-même
    if (req.params.pseudo === req.session.pseudo)
      return res.status(400).json({ error: 'Impossible de se rétrograder soi-même.' });
    await User.updateOne({ pseudo: req.params.pseudo }, { isAdmin: false });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ── SUPPRIMER UN UTILISATEUR ──
router.delete('/users/:pseudo', adminOnly, async (req, res) => {
  try {
    if (req.params.pseudo === req.session.pseudo)
      return res.status(400).json({ error: 'Impossible de supprimer son propre compte.' });
    await User.deleteOne({ pseudo: req.params.pseudo });
    // Supprimer ses histoires et paragraphes
    await Story.deleteMany({ author: req.params.pseudo });
    await Story.updateMany({}, { $pull: { paragraphs: { author: req.params.pseudo } } });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

module.exports = router;
