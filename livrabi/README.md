# 📚 Livrabi — Guide de déploiement pas à pas

## Ce que vous allez faire (30 minutes environ)

1. Créer la base de données gratuite sur **MongoDB Atlas**
2. Mettre le code sur **GitHub**
3. Déployer le site sur **Render** (gratuit)

---

## ÉTAPE 1 — Base de données MongoDB Atlas (gratuit)

1. Allez sur **https://www.mongodb.com/atlas** → cliquez **Try Free**
2. Créez un compte (Google ou email)
3. Choisissez **Free (M0)** → région **Europe (Paris ou Frankfurt)**
4. Cliquez **Create Deployment**
5. Dans "Security Quickstart" :
   - Créez un utilisateur ex: `livrabi_user` + un mot de passe (notez-le !)
   - Cliquez **Add my current IP** puis **Finish and Close**
6. Cliquez sur votre cluster → **Connect** → **Drivers**
7. Copiez l'URI qui ressemble à :
   ```
   mongodb+srv://livrabi_user:MOTDEPASSE@cluster0.xxxxx.mongodb.net/
   ```
8. Remplacez `<password>` par votre vrai mot de passe et ajoutez `livrabi` à la fin :
   ```
   mongodb+srv://livrabi_user:MOTDEPASSE@cluster0.xxxxx.mongodb.net/livrabi
   ```
   ✅ **Gardez cette URL, vous en aurez besoin à l'étape 3**

---

## ÉTAPE 2 — Mettre le code sur GitHub

1. Allez sur **https://github.com** → créez un compte si besoin
2. Cliquez **New repository** (bouton vert) → nommez-le `livrabi`
3. Cochez **Public** → cliquez **Create repository**
4. Sur votre ordinateur, ouvrez un terminal dans le dossier `livrabi/` et tapez :

```bash
git init
git add .
git commit -m "🚀 Premier déploiement Livrabi"
git branch -M main
git remote add origin https://github.com/VOTRE_PSEUDO/livrabi.git
git push -u origin main
```

   > Remplacez `VOTRE_PSEUDO` par votre pseudo GitHub

✅ **Votre code est maintenant sur GitHub**

---

## ÉTAPE 3 — Déployer sur Render (gratuit)

1. Allez sur **https://render.com** → **Get Started for Free**
2. Connectez-vous avec votre compte **GitHub**
3. Cliquez **New +** → **Web Service**
4. Choisissez votre dépôt `livrabi`
5. Configurez :
   - **Name** : `livrabi`
   - **Runtime** : `Node`
   - **Build Command** : `npm install`
   - **Start Command** : `npm start`
   - **Plan** : `Free`
6. Descendez jusqu'à **Environment Variables** → cliquez **Add Environment Variable** :

   | Key | Value |
   |-----|-------|
   | `MONGODB_URI` | *(votre URI MongoDB copiée à l'étape 1)* |
   | `SESSION_SECRET` | *(une longue suite de lettres/chiffres aléatoires, ex: `abc123xyz789...`)* |
   | `NODE_ENV` | `production` |

7. Cliquez **Create Web Service**

⏳ Render va compiler et déployer (2-3 minutes)

✅ **Votre site est en ligne à l'adresse** `https://livrabi.onrender.com`

---

## Notes importantes

- **Plan gratuit Render** : le serveur "dort" après 15 min d'inactivité → le premier accès prend ~30 secondes. Pour éviter ça, passez au plan Starter ($7/mois).
- **MongoDB Atlas** : le plan gratuit (512 MB) est largement suffisant pour démarrer.
- **Domaine personnalisé** : une fois que votre site tourne, vous pouvez acheter un domaine sur **OVH** ou **Namecheap** et le connecter dans les paramètres Render → Custom Domains.

---

## Pour mettre à jour le site plus tard

Chaque fois que vous modifiez du code :

```bash
git add .
git commit -m "Mise à jour"
git push
```

Render détecte automatiquement le push et redéploie ! 🚀
