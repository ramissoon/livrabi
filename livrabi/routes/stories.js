// routes/stories.js
const express = require('express');
const { Story, User } = require('../models');
const router  = express.Router();

// ── MIDDLEWARE : utilisateur connecté ──
function auth(req, res, next) {
  if (!req.session.pseudo) return res.status(401).json({ error: 'Non connecté.' });
  next();
}

// ── MIDDLEWARE : admin ──
async function adminOnly(req, res, next) {
  if (!req.session.pseudo) return res.status(401).json({ error: 'Non connecté.' });
  const user = await User.findOne({ pseudo: req.session.pseudo });
  if (!user || !user.isAdmin) return res.status(403).json({ error: 'Accès refusé.' });
  next();
}

// ── LISTER LES HISTOIRES ──
router.get('/', async (req, res) => {
  try {
    const { sort } = req.query;
    let stories = await Story.find().lean();

    if (sort === 'likes')        stories.sort((a,b) => b.likes.length - a.likes.length);
    if (sort === 'contributors') stories.sort((a,b) => {
      const ca = new Set(b.paragraphs.map(p=>p.author)).size;
      const cb = new Set(a.paragraphs.map(p=>p.author)).size;
      return ca - cb;
    });
    if (sort === 'followers') stories.sort((a,b) => b.followers.length - a.followers.length);
    if (!sort) stories.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json(stories);
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ── UNE HISTOIRE ──
router.get('/:id', async (req, res) => {
  try {
    const story = await Story.findById(req.params.id).lean();
    if (!story) return res.status(404).json({ error: 'Histoire introuvable.' });
    res.json(story);
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ── CRÉER UNE HISTOIRE ──
router.post('/', auth, async (req, res) => {
  try {
    const { title, cat, img, firstParagraph } = req.body;
    if (!title || !cat || !firstParagraph)
      return res.status(400).json({ error: 'Titre, catégorie et premier paragraphe requis.' });

    const story = await Story.create({
      title: title.trim(),
      cat,
      img: img || null,
      author: req.session.pseudo,
      paragraphs: [{
        text: firstParagraph.trim(),
        author: req.session.pseudo,
        isBranch: false,
        parentId: null,
      }]
    });
    res.status(201).json(story);
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ── AJOUTER UNE SUITE ──
router.post('/:id/paragraphs', auth, async (req, res) => {
  try {
    const story = await Story.findById(req.params.id);
    if (!story) return res.status(404).json({ error: 'Histoire introuvable.' });
    if (story.closed) return res.status(403).json({ error: 'Histoire fermée.' });

    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: 'Paragraphe vide.' });

    story.paragraphs.push({ text: text.trim(), author: req.session.pseudo, isBranch: false, parentId: null });
    await story.save();
    res.json(story);
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ── CRÉER UN EMBRANCHEMENT ──
router.post('/:id/branches', auth, async (req, res) => {
  try {
    const story = await Story.findById(req.params.id);
    if (!story) return res.status(404).json({ error: 'Histoire introuvable.' });
    if (story.closed) return res.status(403).json({ error: 'Histoire fermée.' });

    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: 'Paragraphe vide.' });

    const mainChain = story.paragraphs.filter(p => !p.isBranch);
    if (mainChain.length < 1) return res.status(400).json({ error: 'Pas assez de paragraphes.' });

    // Embranchement depuis l'avant-dernier (ou le dernier s'il n'y en a qu'un)
    const pivotIdx = mainChain.length >= 2 ? mainChain.length - 2 : 0;
    const pivot = mainChain[pivotIdx];

    story.paragraphs.push({ text: text.trim(), author: req.session.pseudo, isBranch: true, parentId: pivot._id });
    await story.save();
    res.json(story);
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ── LIKE ──
router.post('/:id/like', auth, async (req, res) => {
  try {
    const story = await Story.findById(req.params.id);
    if (!story) return res.status(404).json({ error: 'Histoire introuvable.' });
    const pseudo = req.session.pseudo;
    const idx = story.likes.indexOf(pseudo);
    if (idx === -1) story.likes.push(pseudo);
    else story.likes.splice(idx, 1);
    await story.save();
    res.json({ likes: story.likes.length, liked: story.likes.includes(pseudo) });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ── FOLLOW ──
router.post('/:id/follow', auth, async (req, res) => {
  try {
    const story = await Story.findById(req.params.id);
    if (!story) return res.status(404).json({ error: 'Histoire introuvable.' });
    const pseudo = req.session.pseudo;
    const idx = story.followers.indexOf(pseudo);
    if (idx === -1) story.followers.push(pseudo);
    else story.followers.splice(idx, 1);
    await story.save();
    res.json({ followers: story.followers.length, following: story.followers.includes(pseudo) });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ════ ROUTES ADMIN ════

// ── STATS ADMIN ──
router.get('/admin/stats', adminOnly, async (req, res) => {
  try {
    const [userCount, stories] = await Promise.all([
      User.countDocuments(),
      Story.find().lean()
    ]);
    const totalParagraphs = stories.reduce((a, s) => a + s.paragraphs.length, 0);
    const totalLikes      = stories.reduce((a, s) => a + s.likes.length, 0);
    res.json({
      users: userCount,
      stories: stories.filter(s => !s.closed).length,
      paragraphs: totalParagraphs,
      likes: totalLikes,
    });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ── FERMER / ROUVRIR UNE HISTOIRE ──
router.patch('/:id/close', adminOnly, async (req, res) => {
  try {
    const story = await Story.findById(req.params.id);
    if (!story) return res.status(404).json({ error: 'Histoire introuvable.' });
    story.closed = !story.closed;
    await story.save();
    res.json({ closed: story.closed });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ── SUPPRIMER UNE HISTOIRE ──
router.delete('/:id', adminOnly, async (req, res) => {
  try {
    await Story.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

module.exports = router;
