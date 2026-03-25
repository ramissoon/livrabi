# 📖 LIVRABI — Guide de déploiement et d'administration

## Table des matières
1. [Architecture du projet](#1-architecture)
2. [Prérequis](#2-prérequis)
3. [Déploiement sur Render (recommandé, gratuit)](#3-render)
4. [Déploiement sur VPS (avancé)](#4-vps)
5. [Configuration de la base de données](#5-base-de-données)
6. [Variables d'environnement](#6-variables-denvironnement)
7. [Emails (réinitialisation de mot de passe)](#7-emails)
8. [Administration du site](#8-administration)
9. [Nom de domaine personnalisé](#9-domaine)
10. [Mises à jour](#10-mises-à-jour)
11. [Référence des routes API](#11-api)

---

## 1. Architecture

```
livrabi/
├── server.js           ← Serveur Node.js/Express
├── db.js               ← Connexion PostgreSQL
├── schema.sql          ← Structure de la base de données
├── package.json
├── .env.example        ← Modèle de configuration
├── routes/
│   ├── auth.js         ← Inscription, connexion, reset mdp
│   ├── stories.js      ← CRUD histoires + likes + follows
│   ├── paragraphs.js   ← Contributions + embranchements
│   ├── users.js        ← Profil + notifications + cooldowns
│   └── admin.js        ← Tableau de bord administrateur
├── middleware/
│   └── auth.js         ← Vérification JWT
├── services/
│   └── mailer.js       ← Envoi d'emails
└── public/
    └── index.html      ← Frontend complet (SPA)
```

**Stack technique :**
- **Backend** : Node.js + Express.js
- **Base de données** : PostgreSQL
- **Auth** : JWT (JSON Web Tokens)
- **Frontend** : HTML/CSS/JS pur (aucun framework, léger et rapide)
- **Emails** : Nodemailer (Gmail ou autre SMTP)

---

## 2. Prérequis

- Un compte **GitHub** (pour héberger le code)
- Un compte **Render.com** (hébergement gratuit) OU un VPS
- Un compte **Gmail** (ou autre) pour les emails
- Node.js 18+ installé localement (pour tester)

---

## 3. Déploiement sur Render (recommandé, gratuit)

Render offre un plan gratuit suffisant pour démarrer Livrabi.

### Étape 1 — Pousser le code sur GitHub

```bash
# Dans le dossier livrabi/
git init
git add .
git commit -m "🚀 Initial commit — Livrabi"
git branch -M main
git remote add origin https://github.com/VOTRE_NOM/livrabi.git
git push -u origin main
```

### Étape 2 — Créer la base de données PostgreSQL sur Render

1. Connectez-vous sur [render.com](https://render.com)
2. Cliquez **New → PostgreSQL**
3. Donnez un nom : `livrabi-db`
4. Choisissez la région **Frankfurt** (pour la France)
5. Plan : **Free** pour commencer
6. Cliquez **Create Database**
7. **Copiez l'URL de connexion** (format `postgresql://...`) — vous en aurez besoin

### Étape 3 — Initialiser le schéma

1. Dans Render, sur votre base, cliquez **Connect**
2. Ouvrez **PSQL Command** (ou utilisez un client comme [TablePlus](https://tableplus.com/))
3. Collez et exécutez le contenu de `schema.sql`

### Étape 4 — Déployer le serveur web

1. Sur Render, cliquez **New → Web Service**
2. Connectez votre dépôt GitHub `livrabi`
3. Configurez :
   - **Name** : `livrabi`
   - **Region** : Frankfurt
   - **Branch** : `main`
   - **Build Command** : `npm install`
   - **Start Command** : `node server.js`
   - **Plan** : Free
4. Dans **Environment Variables**, ajoutez (voir section 6) :
   ```
   DATABASE_URL      = postgresql://... (l'URL copiée à l'étape 2)
   JWT_SECRET        = (une longue chaîne aléatoire, ex: générez sur https://randomkeygen.com)
   JWT_EXPIRES_IN    = 7d
   NODE_ENV          = production
   SITE_URL          = https://livrabi.onrender.com
   SMTP_HOST         = smtp.gmail.com
   SMTP_PORT         = 587
   SMTP_USER         = votre@gmail.com
   SMTP_PASS         = (votre mot de passe d'application Gmail)
   ADMIN_EMAIL       = votre@gmail.com
   ```
5. Cliquez **Create Web Service**

✅ En quelques minutes, Livrabi est en ligne sur `https://livrabi.onrender.com`

---

## 4. Déploiement sur VPS (avancé)

Si vous avez un VPS (OVH, Hetzner, DigitalOcean…) :

```bash
# Sur votre serveur
sudo apt update && sudo apt install -y nodejs npm postgresql nginx

# Cloner le projet
git clone https://github.com/VOTRE_NOM/livrabi.git
cd livrabi
npm install

# Créer la base de données
sudo -u postgres psql
CREATE DATABASE livrabi;
CREATE USER livrabi_user WITH PASSWORD 'motdepasse_fort';
GRANT ALL PRIVILEGES ON DATABASE livrabi TO livrabi_user;
\q

# Initialiser le schéma
psql -U livrabi_user -d livrabi -f schema.sql

# Configurer l'environnement
cp .env.example .env
nano .env  # remplissez les valeurs

# Démarrer avec PM2 (gestionnaire de processus)
npm install -g pm2
pm2 start server.js --name livrabi
pm2 startup    # démarrage automatique au reboot
pm2 save
```

### Configuration Nginx (proxy inverse)

```nginx
# /etc/nginx/sites-available/livrabi
server {
    listen 80;
    server_name livrabi.fr www.livrabi.fr;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/livrabi /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# HTTPS avec Certbot
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d livrabi.fr -d www.livrabi.fr
```

---

## 5. Base de données

### Structure des tables

| Table | Description |
|-------|-------------|
| `users` | Comptes utilisateurs (email, pseudo, rôle) |
| `stories` | Histoires (titre, genre, compteurs) |
| `paragraphs` | Paragraphes + embranchements |
| `likes` | Likes des histoires |
| `follows` | Abonnements aux histoires |
| `contribution_cooldowns` | Cooldown 60 min par histoire/utilisateur |
| `notifications` | Notifications push in-app |

### Sauvegardes

```bash
# Sauvegarder (à faire régulièrement)
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# Restaurer
psql $DATABASE_URL < backup_20250115.sql
```

Sur Render (plan payant), les sauvegardes automatiques sont incluses.

---

## 6. Variables d'environnement

| Variable | Description | Exemple |
|----------|-------------|---------|
| `PORT` | Port du serveur | `3000` |
| `NODE_ENV` | Environnement | `production` |
| `DATABASE_URL` | URL PostgreSQL complète | `postgresql://user:pass@host/db` |
| `JWT_SECRET` | Clé secrète (longue, aléatoire) | `xK9...` (32+ caractères) |
| `JWT_EXPIRES_IN` | Durée de validité du token | `7d` |
| `SMTP_HOST` | Serveur email | `smtp.gmail.com` |
| `SMTP_PORT` | Port SMTP | `587` |
| `SMTP_USER` | Email expéditeur | `livrabi@gmail.com` |
| `SMTP_PASS` | Mot de passe app Gmail | `xxxx xxxx xxxx xxxx` |
| `SITE_URL` | URL publique du site | `https://livrabi.fr` |
| `ADMIN_EMAIL` | Email du premier admin | `admin@livrabi.fr` |
| `OPENAI_API_KEY` | (Optionnel) Génération images IA | `sk-...` |

---

## 7. Emails

### Configurer Gmail

1. Connectez-vous sur [myaccount.google.com](https://myaccount.google.com)
2. **Sécurité → Validation en 2 étapes** (activez-la si ce n'est pas fait)
3. **Sécurité → Mots de passe des applications**
4. Générez un mot de passe pour "Livrabi"
5. Copiez ce mot de passe (format : `xxxx xxxx xxxx xxxx`) dans `SMTP_PASS`

**Emails envoyés automatiquement :**
- ✉️ Vérification du compte à l'inscription
- 🔑 Lien de réinitialisation du mot de passe

---

## 8. Administration du site

### Accès au tableau de bord

Le **premier compte créé** sur le site devient automatiquement administrateur.
Vous pouvez aussi définir `ADMIN_EMAIL` dans `.env` pour qu'un email spécifique obtienne le rôle admin dès l'inscription.

Une fois connecté avec un compte admin :
- Un bouton **⚙️ Admin** apparaît dans la barre de navigation
- Cliquez dessus pour ouvrir le tableau de bord

### Fonctions disponibles

**📊 Statistiques en temps réel**
- Nombre total d'utilisateurs
- Nombre d'histoires actives
- Nombre de paragraphes publiés
- Nombre de likes

**👤 Gestion des utilisateurs**
- Voir tous les comptes (email, pseudo, rôle, activité)
- Promouvoir un utilisateur en admin
- Rétrograder un admin en utilisateur simple
- Supprimer un compte (et tout son contenu)

**📖 Modération des histoires**
- Voir toutes les histoires
- Fermer une histoire (plus de contributions possibles)
- Supprimer une histoire

### Commandes SQL utiles (modération directe)

```sql
-- Lister les utilisateurs récents
SELECT pseudo, email, role, created_at FROM users ORDER BY created_at DESC LIMIT 20;

-- Promouvoir un utilisateur en admin
UPDATE users SET role='admin' WHERE email='quelquun@email.com';

-- Supprimer une histoire problématique
UPDATE stories SET status='deleted' WHERE id='uuid-de-l-histoire';

-- Voir les contributions d'un utilisateur
SELECT p.content, s.title, p.created_at
FROM paragraphs p JOIN stories s ON p.story_id=s.id
JOIN users u ON p.author_id=u.id
WHERE u.pseudo='pseudo_problematique';
```

---

## 9. Nom de domaine personnalisé

### Sur Render
1. Dans votre service Render → **Settings → Custom Domains**
2. Ajoutez `livrabi.fr` et `www.livrabi.fr`
3. Render vous donne des enregistrements DNS à configurer

### Configuration DNS (chez votre registrar : OVH, Gandi, Namecheap…)

| Type | Nom | Valeur |
|------|-----|--------|
| `CNAME` | `www` | `livrabi.onrender.com` |
| `A` | `@` | (IP fournie par Render) |

Le HTTPS est automatique sur Render.

---

## 10. Mises à jour

```bash
# Localement : modifier le code
git add .
git commit -m "✨ Nouvelle fonctionnalité"
git push origin main
```

Render redéploie automatiquement à chaque push sur `main`. ✅

---

## 11. Référence des routes API

### Authentification
| Méthode | Route | Description |
|---------|-------|-------------|
| `POST` | `/api/auth/register` | Créer un compte |
| `POST` | `/api/auth/login` | Connexion |
| `POST` | `/api/auth/forgot-password` | Demander reset mot de passe |
| `POST` | `/api/auth/reset-password` | Réinitialiser mot de passe |
| `GET`  | `/api/auth/verify/:token` | Vérifier email |

### Histoires
| Méthode | Route | Description | Auth |
|---------|-------|-------------|------|
| `GET`  | `/api/stories?sort=likes` | Liste des histoires | — |
| `GET`  | `/api/stories/:id` | Détail + paragraphes | — |
| `POST` | `/api/stories` | Créer une histoire | ✅ |
| `POST` | `/api/stories/:id/like` | Liker/unliker | ✅ |
| `POST` | `/api/stories/:id/follow` | Suivre/ne plus suivre | ✅ |

### Paragraphes
| Méthode | Route | Description | Auth |
|---------|-------|-------------|------|
| `POST` | `/api/paragraphs` | Proposer une suite / embranchement | ✅ |

### Utilisateurs
| Méthode | Route | Description | Auth |
|---------|-------|-------------|------|
| `GET`  | `/api/users/me` | Mon profil | ✅ |
| `PATCH` | `/api/users/me` | Modifier profil | ✅ |
| `GET`  | `/api/users/notifications` | Mes notifications | ✅ |
| `PATCH` | `/api/users/notifications/read` | Tout marquer lu | ✅ |
| `GET`  | `/api/users/cooldown/:storyId` | Vérifier cooldown | ✅ |

### Administration (rôle admin requis)
| Méthode | Route | Description |
|---------|-------|-------------|
| `GET`  | `/api/admin/stats` | Statistiques globales |
| `GET`  | `/api/admin/users` | Liste des utilisateurs |
| `PATCH` | `/api/admin/users/:id/role` | Changer le rôle |
| `DELETE` | `/api/admin/users/:id` | Supprimer un compte |
| `GET`  | `/api/admin/stories` | Liste toutes les histoires |
| `PATCH` | `/api/admin/stories/:id/status` | Changer le statut |
| `DELETE` | `/api/admin/paragraphs/:id` | Supprimer un paragraphe |

---

## ✅ Checklist de lancement

- [ ] Code poussé sur GitHub
- [ ] Base de données PostgreSQL créée
- [ ] Schéma SQL exécuté (`schema.sql`)
- [ ] Variables d'environnement configurées
- [ ] Service web déployé sur Render
- [ ] Mot de passe d'application Gmail configuré
- [ ] Premier compte créé → vérifier rôle admin
- [ ] Domaine personnalisé configuré (optionnel)
- [ ] Test complet : inscription → créer histoire → contribuer → admin

---

*Livrabi — Histoires à plusieurs mains 📖*
