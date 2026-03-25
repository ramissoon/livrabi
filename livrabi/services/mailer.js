// services/mailer.js — Envoi d'emails
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

const FROM = `"Livrabi" <${process.env.SMTP_USER}>`;

async function sendVerification(email, pseudo, token) {
  const url = `${process.env.SITE_URL}/verify?token=${token}`;
  await transporter.sendMail({
    from: FROM, to: email,
    subject: 'Bienvenue sur Livrabi — Vérifiez votre adresse',
    html: `<p>Bonjour <strong>${pseudo}</strong>,</p>
           <p>Cliquez sur le lien ci-dessous pour activer votre compte :</p>
           <p><a href="${url}" style="background:#1a1209;color:#f7f1e6;padding:10px 22px;border-radius:6px;text-decoration:none;">Activer mon compte</a></p>
           <p style="color:#888;font-size:12px;">Si vous n'avez pas créé ce compte, ignorez cet email.</p>`
  });
}

async function sendPasswordReset(email, pseudo, token) {
  const url = `${process.env.SITE_URL}/reset-password?token=${token}`;
  await transporter.sendMail({
    from: FROM, to: email,
    subject: 'Livrabi — Réinitialisation de votre mot de passe',
    html: `<p>Bonjour <strong>${pseudo}</strong>,</p>
           <p>Vous avez demandé à réinitialiser votre mot de passe. Ce lien est valable 1 heure :</p>
           <p><a href="${url}" style="background:#1a1209;color:#f7f1e6;padding:10px 22px;border-radius:6px;text-decoration:none;">Réinitialiser mon mot de passe</a></p>
           <p style="color:#888;font-size:12px;">Si vous n'avez pas demandé cela, ignorez cet email.</p>`
  });
}

module.exports = { sendVerification, sendPasswordReset };
