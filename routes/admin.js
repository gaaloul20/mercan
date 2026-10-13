const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs/promises');
const { put } = require('@vercel/blob');
const { collection, insertDocument } = require('../db/mongo');
const resources = require('../admin/resources');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, callback) => {
    const allowed = new Map([['image/jpeg', '.jpg'], ['image/png', '.png'], ['image/webp', '.webp'], ['image/avif', '.avif']]);
    const extension = allowed.get(file.mimetype);
    if (!extension || path.extname(file.originalname).toLowerCase() !== extension) {
      const error = new Error('Formats acceptés : JPG, PNG, WebP ou AVIF.');
      error.status = 400;
      return callback(error);
    }
    callback(null, true);
  }
});

const isBlobImage = (value) => (
  typeof value === 'string' &&
  /^https:\/\/[a-zA-Z0-9-]+\.public\.blob\.vercel-storage\.com\/[a-zA-Z0-9._/-]+$/.test(value)
);
const isUploadedImage = (value) => (
  typeof value === 'string' &&
  (/^\/(?:uploads|images)\/[a-zA-Z0-9._-]+$/.test(value) || isBlobImage(value))
);

function parseValue(field, value, resource) {
  if (value === '' && field === 'price') return null;
  if ((resource.json || []).includes(field)) {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (!Array.isArray(parsed)) throw new Error(`Le champ ${field} doit être une liste JSON.`);
    return parsed;
  }
  if ((resource.booleans || []).includes(field)) return value === true || value === 'true' || value === '1';
  if (['price', 'position', 'stars'].includes(field) && value !== '') return Number(value);
  return value;
}

function invalidRecord(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function validateRecord(resourceName, body, fields) {
  const optional = new Set(['price', 'featured', 'active', 'url']);
  for (const field of fields) {
    const value = body[field];
    if (value === undefined || value === null || (typeof value === 'string' && !value.trim())) {
      if (optional.has(field)) continue;
      throw invalidRecord(`Le champ ${field} est obligatoire.`);
    }
    if (field === 'slug' && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
      throw invalidRecord('Le slug doit contenir uniquement des minuscules, chiffres et tirets.');
    }
    if (field === 'city' && !['Hammamet', 'Sousse', 'Monastir', 'Mahdia', 'Djerba', 'Tabarka'].includes(value)) {
      throw invalidRecord('Ville d’hôtel invalide.');
    }
    if (field === 'type' && !['voyage', 'tour', 'omra'].includes(value)) {
      throw invalidRecord('Type de voyage invalide.');
    }
    if (field === 'stars' && (!Number.isInteger(Number(value)) || Number(value) < 1 || Number(value) > 5)) {
      throw invalidRecord('La catégorie doit être comprise entre 1 et 5 étoiles.');
    }
    if (['position', 'price'].includes(field) && value !== '' && (!Number.isFinite(Number(value)) || Number(value) < 0)) {
      throw invalidRecord(`Valeur numérique invalide pour ${field}.`);
    }
    if (field === 'button_url' && !/^\/(?!\/)[a-zA-Z0-9/_?&=.%#-]*$/.test(value)) {
      throw invalidRecord('Le lien de diapositive doit pointer vers une page du site.');
    }
    if (field === 'url' && value) {
      let url;
      try { url = new URL(value); } catch { throw invalidRecord('Le lien du partenaire est invalide.'); }
      if (!['https:', 'http:'].includes(url.protocol)) throw invalidRecord('Le lien du partenaire doit utiliser HTTP ou HTTPS.');
    }
    if (field === 'logo' && !(/^\/uploads\/[a-zA-Z0-9._-]+$/.test(value) || isBlobImage(value))) {
      throw invalidRecord('Importez le logo du partenaire depuis un fichier.');
    }
    if (field === 'image' && !(/^(coast|island|city|hammamet|sousse|monastir|mahdia|djerba|tabarka|istanbul|omra)$/.test(value) || isUploadedImage(value))) {
      throw invalidRecord('Choisissez une scène connue ou importez une image.');
    }
    if (typeof value === 'string' && value.length > (field === 'description' || field === 'program' ? 20000 : 1000)) {
      throw invalidRecord(`Le champ ${field} est trop long.`);
    }
  }
  if (resourceName === 'hotels' || resourceName === 'packages') {
    const imageValue = body.images;
    if (imageValue !== undefined) {
      let images;
      try { images = typeof imageValue === 'string' ? JSON.parse(imageValue) : imageValue; } catch { throw invalidRecord('La galerie doit être un JSON valide.'); }
      const scenes = ['coast', 'island', 'city', 'hammamet', 'sousse', 'monastir', 'mahdia', 'djerba', 'tabarka', 'istanbul', 'omra'];
      if (!Array.isArray(images) || images.some((image) => typeof image !== 'string' || (!scenes.includes(image) && !isUploadedImage(image)))) {
        throw invalidRecord('La galerie doit contenir des scènes valides ou des images importées.');
      }
    }
  }
}

function fieldsFromBody(body, resource, resourceName, requireAll = false) {
  const fields = resource.fields.filter((field) => Object.hasOwn(body, field));
  if (!fields.length) throw invalidRecord('Aucune donnée à enregistrer.');
  if (requireAll) {
    const optional = new Set(['price', 'featured', 'active', 'url']);
    const missing = resource.fields.find((field) => !optional.has(field) && !fields.includes(field));
    if (missing) throw invalidRecord(`Le champ ${missing} est obligatoire.`);
  }
  validateRecord(resourceName, body, fields);
  const values = fields.map((field) => {
    const value = typeof body[field] === 'string' ? body[field].trim() : body[field];
    return parseValue(field, value, resource);
  });
  return { fields, values };
}

router.use('/api/admin', requireAdmin);

router.get('/api/admin/data/:resource', async (req, res, next) => {
  try {
    const resource = resources[req.params.resource];
    if (!resource) return res.status(404).json({ error: 'Ressource inconnue.' });
    const rows = await collection(resource.table).find().sort({ id: -1 }).toArray();
    res.json({ rows });
  } catch (error) {
    next(error);
  }
});

router.post('/api/admin/data/:resource', async (req, res, next) => {
  try {
    const resource = resources[req.params.resource];
    if (!resource) return res.status(404).json({ error: 'Ressource inconnue.' });
    const { fields, values } = fieldsFromBody(req.body, resource, req.params.resource, true);
    const record = { ...resource.defaults, ...Object.fromEntries(fields.map((field, index) => [field, values[index]])) };
    const result = await insertDocument(resource.table, record);
    res.status(201).json({ id: result.id, message: 'Élément ajouté.' });
  } catch (error) {
    if (error instanceof SyntaxError || error.status === 400) {
      return res.status(400).json({ error: error.message });
    }
    if (error.code === 11000) return res.status(409).json({ error: 'Un élément avec cette adresse ou ce slug existe déjà.' });
    next(error);
  }
});

router.put('/api/admin/data/:resource/:id', async (req, res, next) => {
  try {
    const resource = resources[req.params.resource];
    const id = Number(req.params.id);
    if (!resource) return res.status(404).json({ error: 'Ressource inconnue.' });
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: 'Identifiant invalide.' });
    const { fields, values } = fieldsFromBody(req.body, resource, req.params.resource);
    const update = Object.fromEntries(fields.map((field, index) => [field, values[index]]));
    const result = await collection(resource.table).updateOne({ id }, { $set: update });
    if (!result.matchedCount) return res.status(404).json({ error: 'Élément introuvable.' });
    res.json({ message: 'Modifications enregistrées.' });
  } catch (error) {
    if (error instanceof SyntaxError || error.status === 400) {
      return res.status(400).json({ error: error.message });
    }
    if (error.code === 11000) return res.status(409).json({ error: 'Un élément avec cette adresse ou ce slug existe déjà.' });
    next(error);
  }
});

router.delete('/api/admin/data/:resource/:id', async (req, res, next) => {
  try {
    const resource = resources[req.params.resource];
    const id = Number(req.params.id);
    if (!resource) return res.status(404).json({ error: 'Ressource inconnue.' });
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: 'Identifiant invalide.' });
    const result = await collection(resource.table).deleteOne({ id });
    if (!result.deletedCount) return res.status(404).json({ error: 'Élément introuvable.' });
    res.json({ message: 'Élément supprimé.' });
  } catch (error) {
    next(error);
  }
});

router.post('/api/admin/upload', upload.single('image'), async (req, res, next) => {
  if (!req.file) return res.status(400).json({ error: 'Choisissez une image à importer.' });
  const extension = path.extname(req.file.originalname).toLowerCase();
  const filename = `${crypto.randomBytes(16).toString('hex')}${extension}`;
  try {
    if (process.env.VERCEL === '1') {
      const hasBlobCredentials = process.env.BLOB_READ_WRITE_TOKEN ||
        (process.env.VERCEL_OIDC_TOKEN && process.env.BLOB_STORE_ID);
      if (!hasBlobCredentials) {
        return res.status(503).json({ error: 'Le stockage Vercel Blob doit être connecté au projet avant d’importer des images.' });
      }
      const blob = await put(filename, req.file.buffer, {
        access: 'public',
        contentType: req.file.mimetype,
        addRandomSuffix: false
      });
      return res.status(201).json({ url: blob.url });
    }
    const destination = path.join(__dirname, '..', 'public', 'uploads', filename);
    await fs.writeFile(destination, req.file.buffer, { flag: 'wx' });
    res.status(201).json({ url: `/uploads/${filename}` });
  } catch (error) {
    next(error);
  }
});

const exportDefinitions = {
  requests: { collection: 'requests', fields: ['id', 'request_type', 'name', 'phone', 'email', 'message', 'status', 'created_at'], headers: ['ID', 'Type', 'Nom', 'Téléphone', 'E-mail', 'Message', 'Statut', 'Date'] },
  messages: { collection: 'contact_messages', fields: ['id', 'name', 'email', 'phone', 'subject', 'message', 'created_at'], headers: ['ID', 'Nom', 'E-mail', 'Téléphone', 'Objet', 'Message', 'Date'] },
  newsletter: { collection: 'newsletter_subscribers', fields: ['id', 'email', 'created_at'], headers: ['ID', 'E-mail', 'Date'] }
};

router.get('/api/admin/export/:type', async (req, res, next) => {
  try {
    const definition = exportDefinitions[req.params.type];
    if (!definition) return res.status(404).json({ error: 'Export inconnu.' });
    const rows = await collection(definition.collection).find({}, { projection: Object.fromEntries(definition.fields.map((field) => [field, 1])) })
      .sort({ created_at: -1 }).toArray();
    const escape = (value) => {
      let text = value === null ? '' : String(value);
      if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
      return `"${text.replace(/"/g, '""')}"`;
    };
    const csv = [definition.headers, ...rows.map((row) => definition.fields.map((field) => row[field]))].map((row) => row.map(escape).join(';')).join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="mercan-${req.params.type}.csv"`);
    res.send(`\uFEFF${csv}`);
  } catch (error) {
    next(error);
  }
});

router.get('/api/admin/inbox', async (req, res, next) => {
  try {
    const [requests, messages, subscribers] = await Promise.all([
      collection('requests').find({}, { projection: { id: 1, request_type: 1, name: 1, phone: 1, email: 1, message: 1, status: 1, created_at: 1 } }).sort({ created_at: -1 }).limit(300).toArray(),
      collection('contact_messages').find({}, { projection: { id: 1, name: 1, email: 1, phone: 1, subject: 1, message: 1, created_at: 1 } }).sort({ created_at: -1 }).limit(300).toArray(),
      collection('newsletter_subscribers').find({}, { projection: { id: 1, email: 1, created_at: 1 } }).sort({ created_at: -1 }).limit(300).toArray()
    ]);
    res.json({ requests, messages, subscribers });
  } catch (error) {
    next(error);
  }
});

router.patch('/api/admin/requests/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1 || !['nouvelle', 'en_cours', 'traitee'].includes(req.body.status)) {
      return res.status(400).json({ error: 'Identifiant ou statut invalide.' });
    }
    const result = await collection('requests').updateOne({ id }, { $set: { status: req.body.status } });
    if (!result.matchedCount) return res.status(404).json({ error: 'Demande introuvable.' });
    res.json({ message: 'Statut de la demande mis à jour.' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
