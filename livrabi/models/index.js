// models/index.js — Schémas MongoDB
const mongoose = require('mongoose');

// ── UTILISATEUR ──
const userSchema = new mongoose.Schema({
  pseudo:  { type: String, required: true, unique: true, trim: true },
  pw:      { type: String, required: true },          // hashé avec bcrypt
  fav:     { type: String, required: true },          // mot préféré
  isAdmin: { type: Boolean, default: false },
}, { timestamps: true });

// ── PARAGRAPHE (sous-document) ──
const paragraphSchema = new mongoose.Schema({
  text:     { type: String, required: true },
  author:   { type: String, required: true },
  isBranch: { type: Boolean, default: false },
  parentId: { type: mongoose.Schema.Types.ObjectId, default: null },
}, { timestamps: true });

// ── HISTOIRE ──
const storySchema = new mongoose.Schema({
  title:      { type: String, required: true, trim: true },
  cat:        { type: String, required: true },
  img:        { type: String, default: null },
  author:     { type: String, required: true },
  closed:     { type: Boolean, default: false },
  likes:      { type: [String], default: [] },       // tableau de pseudos
  followers:  { type: [String], default: [] },       // tableau de pseudos
  paragraphs: { type: [paragraphSchema], default: [] },
}, { timestamps: true });

const User  = mongoose.model('User',  userSchema);
const Story = mongoose.model('Story', storySchema);

module.exports = { User, Story };
