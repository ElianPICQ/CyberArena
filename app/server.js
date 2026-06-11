require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const multer = require('multer');
const { MongoClient, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const path = require('path');
const bcrypt = require('bcrypt');

const upload = multer({
  storage: multer.diskStorage({
    destination: path.join(__dirname, 'public', 'uploads'),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || '';
      const name = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`;
      cb(null, name);
    }
  }),
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    cb(null, allowed.includes(file.mimetype));
  },
  limits: { fileSize: 2 * 1024 * 1024 }
});

const app = express();
const PORT = 8004;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/tp_jwt_mongodb';
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is required');
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '365d';

let db;

app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

function signToken(user) {
  return jwt.sign({ id: user._id.toString() }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

async function authRequired(req, res, next) {
  const cookieHeader = req.headers.cookie || '';
  const cookieMatch = cookieHeader.match(/(?:^|;\s*)token=([^;]+)/);
  const cookieToken = cookieMatch ? cookieMatch[1] : null;
  const header = req.headers.authorization || '';
  const bearerToken = header.startsWith('Bearer ') ? header.slice(7) : null;
  const token = cookieToken || bearerToken;
  if (!token) return res.status(401).json({ error: 'Token manquant' });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await db.collection('users').findOne(
      { _id: new ObjectId(payload.id) },
      { projection: { password: 0 } }
    );
    if (!user) return res.status(401).json({ error: 'Token invalide' });
    req.user = { ...user, id: user._id.toString() };
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Token invalide' });
  }
}

function stripSpecial(str) {
  return String(str ?? '').replace(/[<>&"']/g, '');
}

function adminRequired(req, res, next) {
  if (req.user && req.user.role === 'admin') return next();
  return res.status(403).json({ error: 'Admin uniquement' });
}

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;

  // Correction faille nosql
  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Identifiants invalides :)' });
  }

  const user = await db.collection('users').findOne({ username });
  if (!user) return res.status(401).json({ error: 'Identifiants invalides' });

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(401).json({ error: 'Identifiants invalides' });

  const token = signToken(user);

  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Strict',
    maxAge: 365 * 24 * 60 * 60 * 1000
  });
  
  res.json({
    message: 'Connexion réussie',
    token,
    user: {
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      bio: user.bio
    }
  });
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token', { httpOnly: true, sameSite: 'Strict' });
  res.json({ message: 'Déconnecté' });
});

app.post('/api/auth/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Nom utilisateur, email et mot de passe sont requis' });
  }

  const existing = await db.collection('users').findOne({ username });
  if (existing) {
    return res.status(400).json({ error: 'Inscription impossible' });
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const user = {
    username,
    email,
    password: hashedPassword,
    role: 'user',
    isActive: true,
    avatar: '/uploads/default.svg',
    bio: ''
  };

  const result = await db.collection('users').insertOne(user);
  res.status(201).json({
    message: 'Compte créé avec succès, veuillez vous connecter.',
    user: {
      id: result.insertedId,
      username,
      email,
      role: user.role
    }
  });
});

app.get('/api/me', authRequired, async (req, res) => {
  const user = await db.collection('users').findOne({ _id: new ObjectId(req.user.id) }, { projection: { password: 0 } });
  res.json(user);
});

app.get('/api/users', authRequired, adminRequired, async (req, res) => {
  const users = await db.collection('users').find({}, { projection: { password: 0 } }).toArray();
  res.json(users);
});

app.get('/api/users/:id', authRequired, async (req, res) => {
  if (req.user.id !== req.params.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accès refusé' });
  }
  try {
    const user = await db.collection('users').findOne({ _id: new ObjectId(req.params.id) }, { projection: { password: 0 } });
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
    res.json(user);
  } catch (e) {
    res.status(400).json({ error: 'ObjectId invalide' });
  }
});

app.put('/api/users/:id', authRequired, upload.single('avatar'), async (req, res) => {
  try {
    const targetId = req.params.id;
    if (req.user.id !== targetId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const updates = {};
    if (req.body.username) updates.username = req.body.username;
    if (req.body.email) updates.email = req.body.email;
    if (req.body.bio !== undefined) updates.bio = req.body.bio;
    if (req.body.avatar !== undefined) updates.avatar = req.body.avatar;
    if (req.file) {
      updates.avatar = `/uploads/${req.file.filename}`;
    }
    if (req.body.password) updates.password = await bcrypt.hash(req.body.password, 12);

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'Aucune donnée à mettre à jour' });
    }

    const result = await db.collection('users').findOneAndUpdate(
      { _id: new ObjectId(targetId) },
      { $set: updates },
      { returnDocument: 'after', projection: { password: 0 } }
    );

    if (!result.value) return res.status(404).json({ error: 'Utilisateur introuvable' });
    res.json(result.value);
  } catch (e) {
    res.status(400).json({ error: 'ObjectId invalide' });
  }
});

app.get('/api/posts', authRequired, async (req, res) => {
  // FAILLE logique volontaire : un paramètre peut exposer les posts admin.
  const includeAdmin = req.user.role === 'admin' && req.query.includeAdmin === 'true';
  const filter = includeAdmin ? {} : { visibility: 'public' };
  const posts = await db.collection('posts').aggregate([
    { $match: filter },
    { $sort: { createdAt: -1 } },
    {
      $lookup: {
        from: 'users',
        localField: 'authorId',
        foreignField: '_id',
        as: 'author'
      }
    },
    {
      $addFields: {
        author: { $arrayElemAt: ['$author', 0] }
      }
    },
    {
      $project: {
        title: 1,
        content: 1,
        visibility: 1,
        authorUsername: 1,
        authorId: 1,
        createdAt: 1,
        authorAvatar: '$author.avatar'
      }
    }
  ]).toArray();
  res.json(posts);
});

app.post('/api/posts', authRequired, async (req, res) => {
  const { title, content } = req.body;
  if (!title || !content) return res.status(400).json({ error: 'Titre et contenu obligatoires' });

  const post = {
    title: stripSpecial(title),
    content: stripSpecial(content),
    authorId: new ObjectId(req.user.id),
    authorUsername: req.user.username,
    visibility: 'public',
    createdAt: new Date()
  };
  const result = await db.collection('posts').insertOne(post);
  res.status(201).json({ ...post, _id: result.insertedId });
});

app.put('/api/posts/:id', authRequired, async (req, res) => {
  try {
    const postId = req.params.id;
    const post = await db.collection('posts').findOne({ _id: new ObjectId(postId) });
    if (!post) return res.status(404).json({ error: 'Post introuvable' });

    if (post.authorId.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const updates = {};
    if (req.body.title) updates.title = stripSpecial(req.body.title);
    if (req.body.content) updates.content = stripSpecial(req.body.content);

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'Aucune donnée à mettre à jour' });
    }

    await db.collection('posts').updateOne({ _id: new ObjectId(postId) }, { $set: updates });
    const updated = await db.collection('posts').findOne({ _id: new ObjectId(postId) });
    res.json(updated);
  } catch (e) {
    res.status(400).json({ error: 'ObjectId invalide' });
  }
});

app.get('/api/admin', authRequired, adminRequired, async (req, res) => {
  const users = await db.collection('users').find({}, { projection: { password: 0 } }).toArray();
  const flags = await db.collection('flags').find({}).toArray();
  res.json({
    message: 'Bienvenue dans le panneau admin',
    users,
    flags
  });
});
/*
app.get('/api/debug/config', async (req, res) => {
  // FAILLE info disclosure volontaire.
  res.json({
    app: 'TP JWT MongoDB',
    jwtSecret: JWT_SECRET,
    mongoUri: MONGO_URI,
    note: 'Endpoint debug volontairement exposé pour le TP.'
  });
});
*/
app.get('/health', (req, res) => res.json({ status: 'ok' }));

MongoClient.connect(MONGO_URI)
  .then(client => {
    db = client.db();
    app.listen(PORT, () => {
      console.log(`TP vulnérable disponible sur http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('Erreur MongoDB', err);
    process.exit(1);
  });
