const express = require('express');
const bcrypt = require('bcrypt');
const { body, validationResult } = require('express-validator');
const { collection, insertDocument } = require('../db/mongo');
const { requireUser } = require('../middleware/auth');

const router = express.Router();
const phoneRule = /^[+()\d\s.-]{7,30}$/;
const emailRule = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });
  next();
}

router.post('/auth/register', [
  body('name').trim().isLength({ min: 2, max: 120 }).withMessage('Indiquez un nom de 2 à 120 caractères.'),
  body('email').trim().isEmail().normalizeEmail().withMessage('Adresse e-mail invalide.'),
  body('phone').trim().matches(phoneRule).withMessage('Numéro de téléphone invalide.'),
  body('password').isLength({ min: 10, max: 100 }).withMessage('Le mot de passe doit contenir au moins 10 caractères.')
], validate, async (req, res, next) => {
  try {
    const email = req.body.email.toLowerCase();
    const existing = await collection('users').findOne({ email });
    if (existing) return res.status(409).json({ error: 'Un compte existe déjà avec cette adresse e-mail.' });
    const hash = await bcrypt.hash(req.body.password, 12);
    const account = await insertDocument('users', { name: req.body.name, email, phone: req.body.phone, password_hash: hash, role: 'client' });
    req.session.regenerate((error) => {
      if (error) return next(error);
      req.session.user = { id: account.id, name: req.body.name, email, phone: req.body.phone, role: 'client' };
      req.session.save((saveError) => {
        if (saveError) return next(saveError);
        res.status(201).json({ message: 'Votre compte est créé.', redirect: '/mon-compte' });
      });
    });
  } catch (error) {
    if (error.code === 11000 && error.keyPattern?.email) {
      return res.status(409).json({ error: 'Un compte existe déjà avec cette adresse e-mail.' });
    }
    next(error);
  }
});

router.post('/auth/login', [
  body('email').trim().isEmail().normalizeEmail().withMessage('Adresse e-mail invalide.'),
  body('password').isLength({ min: 1, max: 100 }).withMessage('Saisissez votre mot de passe.')
], validate, async (req, res, next) => {
  try {
    const account = await collection('users').findOne({ email: req.body.email.toLowerCase() });
    if (!account || !(await bcrypt.compare(req.body.password, account.password_hash))) {
      return res.status(401).json({ error: 'Adresse e-mail ou mot de passe incorrect.' });
    }
    req.session.regenerate((error) => {
      if (error) return next(error);
      req.session.user = { id: account.id, name: account.name, email: account.email, phone: account.phone, role: account.role };
      req.session.save((saveError) => {
        if (saveError) return next(saveError);
        res.json({ message: 'Connexion réussie.', redirect: account.role === 'admin' ? '/admin' : '/mon-compte' });
      });
    });
  } catch (error) {
    next(error);
  }
});

router.post('/auth/logout', (req, res, next) => {
  req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie('mercan.sid');
    res.json({ message: 'Vous êtes déconnecté.', redirect: '/' });
  });
});

router.post('/requests', [
  body('type').isIn(['hotel', 'voyage', 'tour', 'omra']).withMessage('Type de demande invalide.'),
  body('itemId').optional({ values: 'null' }).isInt({ min: 1 }).withMessage('Offre invalide.'),
  body('name').trim().isLength({ min: 2, max: 120 }).withMessage('Indiquez votre nom.'),
  body('phone').trim().matches(phoneRule).withMessage('Numéro de téléphone invalide.'),
  body('email').optional({ values: 'falsy' }).trim().isEmail().withMessage('Adresse e-mail invalide.'),
  body('message').trim().isLength({ min: 2, max: 3000 }).withMessage('Votre message doit contenir entre 2 et 3 000 caractères.')
], validate, async (req, res, next) => {
  try {
    const { type, itemId = null, name, phone, message } = req.body;
    const email = req.body.email || (req.session.user && req.session.user.email) || null;
    if (itemId) {
      const resource = type === 'hotel' ? 'hotels' : 'packages';
      const filter = type === 'hotel' ? { id: Number(itemId) } : { id: Number(itemId), type };
      const item = await collection(resource).findOne(filter, { projection: { id: 1 } });
      if (!item) return res.status(404).json({ error: 'Cette offre n’est plus disponible.' });
    }
    await insertDocument('requests', {
      user_id: req.session.user?.role === 'client' ? req.session.user.id : null,
      request_type: type, item_id: itemId ? Number(itemId) : null, name, phone, email, message, status: 'nouvelle'
    });
    res.status(201).json({ message: 'Votre demande a bien été transmise.' });
  } catch (error) {
    next(error);
  }
});

router.post('/flights', [
  body('departure').trim().isLength({ min: 2, max: 120 }).withMessage('Indiquez la ville de départ.'),
  body('destination').trim().isLength({ min: 2, max: 120 }).withMessage('Indiquez votre destination.'),
  body('tripType').isIn(['aller-retour', 'aller-simple']).withMessage('Type de trajet invalide.'),
  body('departDate').isISO8601().withMessage('Date de départ invalide.'),
  body('returnDate').if(body('tripType').equals('aller-retour')).isISO8601().withMessage('Date de retour invalide.'),
  body('adults').isInt({ min: 1, max: 9 }).withMessage('Nombre d’adultes invalide.'),
  body('children').isInt({ min: 0, max: 9 }).withMessage('Nombre d’enfants invalide.'),
  body('airline').optional({ values: 'falsy' }).trim().isLength({ max: 120 }),
  body('phone').trim().matches(phoneRule).withMessage('Numéro de téléphone invalide.')
], validate, async (req, res, next) => {
  try {
    if (req.body.tripType === 'aller-retour' && req.body.returnDate < req.body.departDate) {
      return res.status(400).json({ error: 'La date de retour doit être postérieure au départ.' });
    }
    const details = {
      departure: req.body.departure, destination: req.body.destination, tripType: req.body.tripType,
      departDate: req.body.departDate, returnDate: req.body.returnDate || null,
      adults: Number(req.body.adults), children: Number(req.body.children), airline: req.body.airline || ''
    };
    const name = req.session.user?.name || 'Demande de vol';
    const email = req.session.user?.email || null;
    const message = `Vol ${details.tripType} : ${details.departure} – ${details.destination}, départ ${details.departDate}${details.returnDate ? `, retour ${details.returnDate}` : ''}. ${details.adults} adulte(s), ${details.children} enfant(s). Compagnie souhaitée : ${details.airline || 'indifférente'}.`;
    await insertDocument('requests', {
      user_id: req.session.user?.role === 'client' ? req.session.user.id : null,
      request_type: 'flight', item_id: null, name, phone: req.body.phone, email, message,
      flight_details: details, status: 'nouvelle'
    });
    res.status(201).json({ message: 'Votre demande de vol a été enregistrée.', whatsappMessage: `Bonjour Mercan Voyages, ${message} Mon téléphone : ${req.body.phone}` });
  } catch (error) {
    next(error);
  }
});

router.post('/contact', [
  body('name').trim().isLength({ min: 2, max: 120 }).withMessage('Indiquez votre nom.'),
  body('email').trim().isEmail().normalizeEmail().withMessage('Adresse e-mail invalide.'),
  body('phone').optional({ values: 'falsy' }).trim().matches(phoneRule).withMessage('Numéro de téléphone invalide.'),
  body('subject').trim().isLength({ min: 2, max: 180 }).withMessage('Indiquez un objet.'),
  body('message').trim().isLength({ min: 5, max: 3000 }).withMessage('Votre message doit contenir au moins 5 caractères.')
], validate, async (req, res, next) => {
  try {
    await insertDocument('contact_messages', {
      name: req.body.name, email: req.body.email.toLowerCase(), phone: req.body.phone || null,
      subject: req.body.subject, message: req.body.message
    });
    res.status(201).json({ message: 'Merci, votre message a bien été envoyé.' });
  } catch (error) {
    next(error);
  }
});

router.post('/newsletter', [
  body('email').trim().isEmail().normalizeEmail().withMessage('Saisissez une adresse e-mail valide.')
], validate, async (req, res, next) => {
  try {
    const email = req.body.email.toLowerCase();
    const existing = await collection('newsletter_subscribers').findOne({ email }, { projection: { id: 1 } });
    if (!existing) {
      try {
        await insertDocument('newsletter_subscribers', { email });
      } catch (error) {
        if (error.code !== 11000 || !error.keyPattern?.email) throw error;
      }
    }
    res.status(201).json({ message: 'Merci, votre inscription est enregistrée.' });
  } catch (error) {
    next(error);
  }
});

router.get('/account/requests', requireUser, async (req, res, next) => {
  try {
    const requests = await collection('requests').find({ user_id: req.session.user.id })
      .sort({ created_at: -1 }).toArray();
    const hotelIds = requests.filter((request) => request.request_type === 'hotel' && request.item_id).map((request) => request.item_id);
    const packageIds = requests.filter((request) => request.request_type !== 'hotel' && request.item_id).map((request) => request.item_id);
    const [hotels, packages] = await Promise.all([
      hotelIds.length ? collection('hotels').find({ id: { $in: hotelIds } }, { projection: { id: 1, name: 1 } }).toArray() : [],
      packageIds.length ? collection('packages').find({ id: { $in: packageIds } }, { projection: { id: 1, title: 1 } }).toArray() : []
    ]);
    const names = new Map([...hotels.map((hotel) => [hotel.id, hotel.name]), ...packages.map((item) => [item.id, item.title])]);
    for (const request of requests) request.item_name = names.get(request.item_id) || 'Demande de vol';
    res.json({ requests });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
