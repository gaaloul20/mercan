require('dotenv').config();

const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const { connectMongo } = require('./db/mongo');
const MongoSessionStore = require('./db/session-store');

const app = express();
const port = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';

if (isProduction && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)) {
  throw new Error('En production, SESSION_SECRET doit contenir au moins 32 caractères.');
}
if (!process.env.SESSION_SECRET && process.env.VERCEL !== '1') {
  console.warn('SESSION_SECRET absent : une clé temporaire est utilisée. Configurez .env avant le déploiement.');
  process.env.SESSION_SECRET = require('crypto').randomBytes(32).toString('hex');
}

if (process.env.VERCEL !== '1') fs.mkdirSync(path.join(__dirname, 'public', 'uploads'), { recursive: true });
app.disable('x-powered-by');
if (process.env.VERCEL === '1') app.set('trust proxy', 1);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.locals.asList = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};
app.locals.sceneBackground = (image) => (
  typeof image === 'string' && /^(?:\/(?:uploads|images)\/[a-zA-Z0-9._-]+|https:\/\/[a-zA-Z0-9.-]+\.public\.blob\.vercel-storage\.com\/[a-zA-Z0-9._/-]+)$/.test(image)
    ? `--scene-bg: url("${image}")`
    : ''
);
app.locals.isPhoto = (image) => (
  typeof image === 'string' && /^(?:\/(?:uploads|images)\/[a-zA-Z0-9._-]+|https:\/\/[a-zA-Z0-9.-]+\.public\.blob\.vercel-storage\.com\/[a-zA-Z0-9._/-]+)$/.test(image)
);
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", 'https://fonts.googleapis.com', "'unsafe-inline'"],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'blob:', 'https://*.public.blob.vercel-storage.com'],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'"],
      frameSrc: ['https://www.google.com'],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"]
    }
  }
}));
app.use(express.urlencoded({ extended: false, limit: '30kb' }));
app.use(express.json({ limit: '30kb' }));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: isProduction ? '1d' : 0 }));

app.use(async (req, res, next) => {
  try {
    await connectMongo();
    next();
  } catch (error) {
    next(error);
  }
});

const sessionStore = new MongoSessionStore();
sessionStore.on('error', (error) => console.error('Erreur du stockage des sessions :', error));
app.use(session({
  name: 'mercan.sid',
  secret: process.env.SESSION_SECRET,
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: 86400000
  }
}));

app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Trop de demandes. Réessayez dans quelques minutes.' }
}));
app.use('/api/auth', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Trop de tentatives. Réessayez dans quelques minutes.' }
}));

app.use(require('./routes/admin'));
app.use('/api', require('./routes/api'));
app.use('/', require('./routes/pages'));
app.use((error, req, res, next) => {
  console.error(`${req.method} ${req.originalUrl}:`, error);
  if (res.headersSent) return next(error);
  const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : (error.status && error.status < 500 ? error.status : 500);
  const message = error.code === 'LIMIT_FILE_SIZE'
    ? 'L’image ne doit pas dépasser 4 Mo.'
    : status < 500 ? error.message : 'Une erreur est survenue. Veuillez réessayer.';
  if (req.originalUrl.startsWith('/api/')) return res.status(status).json({ error: message });
  res.status(status).render('pages/error', { title: 'Erreur | Mercan Voyages', description: message, message });
});

if (require.main === module) {
  app.listen(port, () => console.log(`Mercan Voyages est accessible sur http://localhost:${port}`));
}

module.exports = app;
