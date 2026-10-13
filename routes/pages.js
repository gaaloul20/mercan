const express = require('express');
const { collection } = require('../db/mongo');

const router = express.Router();
const cities = ['Hammamet', 'Sousse', 'Monastir', 'Mahdia', 'Djerba', 'Tabarka'];
const fallbackSlides = [
  { title: 'Le voyage commence ici', text: 'Des escapades choisies avec soin, au départ de Tunis.', button_text: 'Découvrir nos voyages', button_url: '/voyages', image: '/images/hero-travel.png' },
  { title: 'La Tunisie, mille façons de s’évader', text: 'Trouvez votre prochaine parenthèse au bord de la Méditerranée.', button_text: 'Explorer les hôtels', button_url: '/hotels', image: 'island' },
  { title: 'Un accompagnement qui vous ressemble', text: 'Nos conseillers préparent avec vous chaque détail de votre séjour.', button_text: 'Parlons de votre projet', button_url: '/contact', image: 'city' }
];

function view(res, name, data = {}) {
  res.render(name, { cities, ...data });
}

router.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.currentPath = req.path;
  res.locals.cities = cities;
  next();
});

router.get('/', async (req, res, next) => {
  try {
    const [hotels, voyages, omra, slides, partners] = await Promise.all([
      collection('hotels').find().sort({ featured: -1, id: 1 }).limit(4).toArray(),
      collection('packages').find({ type: 'voyage' }).sort({ featured: -1, id: 1 }).limit(4).toArray(),
      collection('packages').find({ type: 'omra' }).sort({ featured: -1, id: -1 }).limit(2).toArray(),
      collection('slides').find({ active: true }).sort({ position: 1, id: 1 }).toArray(),
      collection('partners').find({ active: true }).sort({ position: 1, id: 1 }).toArray()
    ]);
    view(res, 'pages/home', { title: 'Agence de voyage à Tunis | Mercan Voyages', description: 'Hôtels en Tunisie, voyages organisés, circuits et Omra au départ de Tunis. Votre agence Mercan Voyages vous accompagne.', hotels, voyages, omra, slides: slides.length ? slides : fallbackSlides, partners });
  } catch (error) {
    next(error);
  }
});

router.get('/hotels', async (req, res, next) => {
  try {
    const city = cities.includes(req.query.ville) ? req.query.ville : '';
    const stars = /^[1-5]$/.test(String(req.query.etoiles || '')) ? Number(req.query.etoiles) : 0;
    const filter = {};
    if (city) filter.city = city;
    if (stars) filter.stars = stars;
    const hotels = await collection('hotels').find(filter).sort({ city: 1, stars: -1, name: 1 }).toArray();
    view(res, 'pages/hotels', { title: 'Hôtels en Tunisie | Mercan Voyages', description: 'Choisissez parmi nos hôtels à Hammamet, Sousse, Monastir, Mahdia, Djerba et Tabarka.', hotels, selectedCity: city, selectedStars: stars });
  } catch (error) {
    next(error);
  }
});

router.get('/hotels/:slug', async (req, res, next) => {
  try {
    const hotel = await collection('hotels').findOne({ slug: req.params.slug });
    if (!hotel) return res.status(404).render('pages/not-found', { title: 'Hôtel introuvable', description: 'Cette offre hôtelière est introuvable.' });
    view(res, 'pages/hotel-detail', { title: `${hotel.name} | Mercan Voyages`, description: hotel.summary, hotel });
  } catch (error) {
    next(error);
  }
});

const packagePages = {
  voyages: { type: 'voyage', title: 'Voyages organisés' },
  tours: { type: 'tour', title: 'Circuits & tours' },
  omra: { type: 'omra', title: 'Omra 2026' }
};

for (const [path, page] of Object.entries(packagePages)) {
  router.get(`/${path}`, async (req, res, next) => {
    try {
      const items = await collection('packages').find({ type: page.type }).sort({ featured: -1, id: -1 }).toArray();
      view(res, 'pages/packages', { title: `${page.title} | Mercan Voyages`, description: `${page.title} au départ de Tunis avec Mercan Voyages. Dates et détails auprès de nos conseillers.`, items, pageTitle: page.title, type: page.type });
    } catch (error) {
      next(error);
    }
  });
}

router.get('/offres/:slug', async (req, res, next) => {
  try {
    const item = await collection('packages').findOne({ slug: req.params.slug });
    if (!item) return res.status(404).render('pages/not-found', { title: 'Offre introuvable', description: 'Cette offre est introuvable.' });
    view(res, 'pages/package-detail', { title: `${item.title} | Mercan Voyages`, description: item.summary, item, typeLabel: packagePages[({ voyage: 'voyages', tour: 'tours', omra: 'omra' })[item.type]].title });
  } catch (error) {
    next(error);
  }
});

router.get('/vol', (req, res) => view(res, 'pages/flight', { title: 'Demande de vol | Mercan Voyages', description: 'Envoyez votre demande de vol aller simple ou aller-retour depuis Tunis.', selectedAirline: req.query.compagnie === 'nouvelair' ? 'Nouvelair' : '' }));
router.get('/contact', (req, res) => view(res, 'pages/contact', { title: 'Contact | Mercan Voyages', description: 'Contactez Mercan Voyages, agence de voyage catégorie A à Tunis.' }));
router.get('/qui-sommes-nous', (req, res) => view(res, 'pages/about', { title: 'Qui sommes-nous ? | Mercan Voyages', description: 'Découvrez Mercan Voyages, votre agence de voyage à Tunis.' }));
router.get('/conditions-de-vente', (req, res) => view(res, 'pages/terms', { title: 'Conditions de vente | Mercan Voyages', description: 'Conditions de vente des prestations Mercan Voyages.' }));

router.get('/connexion', (req, res) => view(res, 'pages/auth', { title: 'Connexion | Mercan Voyages', description: 'Connectez-vous à votre compte Mercan Voyages.', mode: 'login' }));
router.get('/inscription', (req, res) => view(res, 'pages/auth', { title: 'Créer un compte | Mercan Voyages', description: 'Créez votre compte client Mercan Voyages.', mode: 'register' }));
router.get('/mon-compte', (req, res) => {
  if (!req.session.user || req.session.user.role !== 'client') return res.redirect('/connexion');
  view(res, 'pages/account', { title: 'Mon compte | Mercan Voyages', description: 'Consultez votre profil et l’historique de vos demandes.' });
});

router.get('/admin', (req, res) => {
  if (req.session.user && req.session.user.role === 'admin') return res.render('admin/dashboard', { title: 'Administration | Mercan Voyages', user: req.session.user });
  res.render('admin/login', { title: 'Administration | Mercan Voyages', user: null });
});

router.use((req, res) => res.status(404).render('pages/not-found', { title: 'Page introuvable | Mercan Voyages', description: 'Cette page n’existe pas.' }));

module.exports = router;
