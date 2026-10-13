require('dotenv').config();

const bcrypt = require('bcrypt');
const { closeMongo, collection, connectMongo, nextId } = require('./mongo');

const hotels = [
  ['dar-el-olfa', 'Dar El Olfa', 'Hammamet', 4, 'Une parenthèse paisible entre jardin et Méditerranée.', 'À quelques pas de la plage, cette adresse fictive offre une atmosphère conviviale, des espaces lumineux et un jardin propice au repos.', 'Demi-pension', ['Piscine', 'Accès plage', 'Wi-Fi', 'Restaurant'], ['hammamet']],
  ['les-jardins-de-sousse', 'Les Jardins de Sousse', 'Sousse', 5, 'Le confort d’un grand resort au bord de mer.', 'Un hôtel fictif aux jardins généreux, idéal pour profiter du littoral de Sousse et de ses activités.', 'Tout compris', ['Piscine', 'Spa', 'Plage privée', 'Club enfants'], ['sousse']],
  ['maison-des-iles', 'La Maison des Îles', 'Djerba', 4, 'Une escale lumineuse aux couleurs de Djerba.', 'Une adresse fictive inspirée des maisons de l’île, avec patio, piscine et accueil chaleureux.', 'Petit-déjeuner', ['Piscine', 'Patio', 'Wi-Fi', 'Restaurant'], ['djerba']],
  ['cap-tabarka', 'Cap Tabarka', 'Tabarka', 4, 'Entre criques, pins et horizon bleu.', 'Un hôtel fictif niché dans un décor de nature, parfait pour alterner baignade et découverte de la région.', 'Demi-pension', ['Piscine', 'Vue mer', 'Plongée', 'Parking'], ['tabarka']],
  ['residence-mahdia', 'Résidence Mahdia', 'Mahdia', 3, 'Une adresse simple face aux plages de sable fin.', 'Cette résidence fictive privilégie la détente, la proximité de la mer et les moments partagés en famille.', 'Petit-déjeuner', ['Accès plage', 'Restaurant', 'Wi-Fi'], ['mahdia']],
  ['palais-monastir', 'Palais de Monastir', 'Monastir', 5, 'Un séjour élégant au rythme de la côte.', 'Un établissement fictif accueillant avec de beaux espaces communs et un accès facile aux promenades du front de mer.', 'Tout compris', ['Piscine', 'Spa', 'Plage privée', 'Restaurant'], ['monastir']]
].map(([slug, name, city, stars, summary, description, board, services, image]) => ({
  slug, name, city, stars, summary, description, board, services, images: image, price: null
}));

const packages = [
  {
    slug: 'istanbul-bursa-decembre-2026', type: 'voyage', title: 'Istanbul et Bursa – vacances de décembre',
    destination: 'Istanbul & Bursa, Turquie', summary: 'Deux villes, une escapade hivernale inoubliable au départ de Tunis.',
    description: 'Partez à la découverte des quartiers emblématiques d’Istanbul puis de l’atmosphère paisible de Bursa. Voyage accompagné au départ de Tunis.',
    dates: ['13 au 19 décembre 2026'], duration: '7 jours / 6 nuits',
    program: [
      { day: 'Jour 1', title: 'Départ de Tunis', text: 'Accueil à l’aéroport et vol vers Istanbul. Installation et première soirée libre.' },
      { day: 'Jour 2', title: 'Istanbul historique', text: 'Découverte des quartiers historiques et temps libre au cœur de la ville.' },
      { day: 'Jour 3', title: 'Rives du Bosphore', text: 'Balade dans les quartiers du Bosphore et découverte des marchés.' },
      { day: 'Jour 4', title: 'Route vers Bursa', text: 'Traversée vers Bursa et installation. Découverte de la vieille ville.' },
      { day: 'Jour 5', title: 'Bursa et ses paysages', text: 'Journée de visite et de détente dans la région.' },
      { day: 'Jour 6', title: 'Retour à Istanbul', text: 'Retour à Istanbul et dernière soirée libre.' },
      { day: 'Jour 7', title: 'Retour à Tunis', text: 'Transfert à l’aéroport et vol retour.' }
    ],
    inclusions: ['Vols aller-retour au départ de Tunis', 'Hébergement selon programme', 'Transferts prévus au programme'],
    exclusions: ['Dépenses personnelles', 'Prestations non mentionnées'], images: ['/images/image1.png'], price: 2690, featured: true
  },
  {
    slug: 'super-promo-istanbul-automne-2026', type: 'voyage', title: 'Super promo Istanbul – automne 2026',
    destination: 'Istanbul, Turquie', summary: 'Profitez d’Istanbul en novembre ou décembre, hors vacances scolaires.',
    description: 'Une formule flexible pour explorer Istanbul à votre rythme. Dates disponibles en novembre et décembre 2026, hors vacances scolaires. Places et conditions à confirmer auprès de nos conseillers.',
    dates: ['Novembre et décembre 2026 (hors vacances scolaires)'], duration: 'Dates et durée à confirmer',
    program: [{ day: 'À votre rythme', title: 'Votre séjour à Istanbul', text: 'Nos conseillers vous accompagnent pour composer votre escapade selon vos dates et envies.' }],
    inclusions: ['Détails communiqués sur demande'], exclusions: ['Prestations à confirmer selon les dates'], images: ['/images/image.png'], price: 1370, featured: true
  },
  {
    slug: 'voyage-egypte-nouvelair', type: 'voyage', title: 'Voyage en Égypte avec Nouvelair',
    destination: 'Le Caire & Égypte', summary: 'Découvrez les trésors de l’Égypte avec vol Nouvelair et séjour en hôtel 3 étoiles.',
    description: 'Une escapade en Égypte au départ de Tunis. L’affiche annonce un billet aller-retour Nouvelair, un bagage en soute de 25 kg, un bagage à main de 8 kg et un hôtel 3 étoiles en chambre double. Les dates et les autres modalités sont à confirmer auprès de nos conseillers.',
    dates: ['Dates à confirmer auprès de l’agence'], duration: 'Dates à confirmer',
    program: [{ day: 'Séjour', title: 'Votre voyage en Égypte', text: 'Dates, durée et programme détaillé à confirmer auprès de nos conseillers.' }],
    inclusions: ['Billet aller-retour sur Nouvelair', 'Bagage en soute de 25 kg', 'Bagage à main de 8 kg', 'Hôtel 3 étoiles en chambre double'],
    exclusions: ['Prestations non précisées sur l’affiche à confirmer auprès de l’agence'],
    images: ['/images/image2.png'], price: 1560, featured: true
  },
  {
    slug: 'voyage-organise-istanbul-octobre-novembre-2026', type: 'voyage', title: 'Voyage organisé à Istanbul – octobre et novembre',
    destination: 'Istanbul, Turquie', summary: 'Deux dates de départ pour découvrir Istanbul : du 24 au 30 octobre ou du 26 octobre au 1er novembre.',
    description: 'Un voyage organisé à Istanbul. L’affiche indique un billet Turkish Airlines, un hôtel 4 étoiles en logement petit-déjeuner et des excursions. Les détails pratiques et disponibilités sont à confirmer auprès de nos conseillers.',
    dates: ['24 au 30 octobre', '26 octobre au 1er novembre'], duration: '7 jours / 6 nuits',
    program: [{ day: 'Séjour', title: 'Découverte d’Istanbul', text: 'Des excursions sont annoncées. Le programme détaillé est à confirmer auprès de nos conseillers.' }],
    inclusions: ['Billet Turkish Airlines', 'Hôtel 4 étoiles en logement petit-déjeuner', 'Excursions'],
    exclusions: ['Prestations non précisées sur l’affiche à confirmer auprès de l’agence'],
    images: ['/images/image3.png'], price: 2680, featured: true
  },
  {
    slug: 'escapade-nature-nord-tunisien', type: 'tour', title: 'Échappée nature dans le Nord tunisien',
    destination: 'Tabarka & Aïn Draham', summary: 'Une parenthèse entre forêt, mer et villages du Nord.',
    description: 'Un circuit fictif de découverte des paysages du Nord tunisien, pensé pour mêler balades, patrimoine et moments de détente.',
    dates: ['Dates à définir'], duration: '3 jours / 2 nuits',
    program: [
      { day: 'Jour 1', title: 'Cap au Nord', text: 'Départ de Tunis, halte découverte en chemin et installation à Tabarka.' },
      { day: 'Jour 2', title: 'Forêts et reliefs', text: 'Excursion dans les environs d’Aïn Draham et temps libre en pleine nature.' },
      { day: 'Jour 3', title: 'Derniers instants en bord de mer', text: 'Matinée libre à Tabarka puis retour à Tunis.' }
    ],
    inclusions: ['Transport selon programme', 'Hébergement en chambre double'], exclusions: ['Repas non mentionnés', 'Dépenses personnelles'], images: ['tabarka'], price: null, featured: false
  },
  {
    slug: 'omra-2026', type: 'omra', title: 'Omra 2026 – un voyage spirituel accompagné',
    destination: 'La Mecque & Médine, Arabie saoudite', summary: 'Un accompagnement attentif pour préparer votre Omra 2026.',
    description: 'Notre équipe vous accompagne dans la préparation de votre voyage spirituel. Dates, prestations et formalités sont confirmées individuellement avec nos conseillers.',
    dates: ['Plusieurs départs en 2026 – nous consulter'], duration: 'Durée et dates selon départ',
    program: [
      { day: 'Avant le départ', title: 'Préparation', text: 'Réunion d’information, accompagnement pour les formalités et réponses à vos questions.' },
      { day: 'Séjour', title: 'La Mecque et Médine', text: 'Programme et accompagnement communiqués selon le départ sélectionné.' },
      { day: 'Retour', title: 'Fin du séjour', text: 'Transfert vers l’aéroport et retour.' }
    ],
    inclusions: ['Accompagnement et conseils de préparation'], exclusions: ['Détails et prestations selon le départ choisi'], images: ['omra'], price: null, featured: true
  },
  {
    slug: 'omra-mecque-medine-2026', type: 'omra', title: 'Omra – La Mecque et Médine',
    destination: 'La Mecque & Médine, Arabie saoudite', summary: 'Une semaine à La Mecque et une semaine à Médine. Tarif affiché par personne en chambre quadruple.',
    description: 'L’affiche annonce une semaine à La Mecque et une semaine à Médine, avec un hébergement en hôtel 5 étoiles à La Mecque et en hôtel 4 étoiles à Médine. Le tarif indiqué est de 4 100 TND par personne en chambre quadruple. Les dates, disponibilités et prestations détaillées sont à confirmer auprès de l’agence.',
    dates: ['Départ et disponibilités à confirmer auprès de l’agence'], duration: '2 semaines',
    program: [
      { day: 'Semaine 1', title: 'La Mecque', text: 'Séjour d’une semaine à La Mecque. Hébergement annoncé en hôtel 5 étoiles.' },
      { day: 'Semaine 2', title: 'Médine', text: 'Séjour d’une semaine à Médine. Hébergement annoncé en hôtel 4 étoiles.' }
    ],
    inclusions: ['Hébergement annoncé à La Mecque en hôtel 5 étoiles', 'Hébergement annoncé à Médine en hôtel 4 étoiles'],
    exclusions: ['Dates et prestations détaillées à confirmer auprès de l’agence'],
    images: ['/images/omra-2026-offre.png'], price: 4100, featured: true
  }
];

async function seed() {
  try {
    await connectMongo();
    for (const hotel of hotels) {
      const { price, ...values } = hotel;
      const existing = await collection('hotels').findOne({ slug: hotel.slug }, { projection: { id: 1 } });
      await collection('hotels').updateOne(
        { slug: hotel.slug },
        {
          $set: values,
          ...(existing ? {} : { $setOnInsert: { id: await nextId('hotels'), price, featured: false, created_at: new Date() } })
        },
        { upsert: true }
      );
    }

    for (const item of packages) {
      const existing = await collection('packages').findOne({ slug: item.slug }, { projection: { id: 1 } });
      await collection('packages').updateOne(
        { slug: item.slug },
        {
          $set: item,
          ...(existing ? {} : { $setOnInsert: { id: await nextId('packages'), created_at: new Date() } })
        },
        { upsert: true }
      );
    }

    const slides = [
      ['Le voyage commence ici', 'Des escapades choisies avec soin, au départ de Tunis.', 'Découvrir nos voyages', '/voyages', '/images/hero-travel.png', 1],
      ['La Tunisie, mille façons de s’évader', 'Trouvez votre prochaine parenthèse au bord de la Méditerranée.', 'Explorer les hôtels', '/hotels', 'island', 2],
      ['Un accompagnement qui vous ressemble', 'Nos conseillers préparent avec vous chaque détail de votre séjour.', 'Parlons de votre projet', '/contact', 'city', 3]
    ];
    for (const slide of slides) {
      const [title, text, button_text, button_url, image, position] = slide;
      const existing = await collection('slides').findOne({ position }, { projection: { id: 1 } });
      await collection('slides').updateOne(
        { position },
        {
          $setOnInsert: {
            ...(existing ? {} : { id: await nextId('slides'), created_at: new Date() }),
            title, text, button_text, button_url, image, position, active: true
          }
        },
        { upsert: true }
      );
    }
    await collection('slides').updateOne({ position: 1 }, { $set: { image: '/images/hero-travel.png' } });

    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;
    if (!email || !password || password.length < 12) {
      throw new Error('ADMIN_EMAIL et ADMIN_PASSWORD (12 caractères minimum) doivent être définis dans .env.');
    }
    const hash = await bcrypt.hash(password, 12);
    const existingAdmin = await collection('users').findOne({ email, role: 'admin' }, { projection: { id: 1 } });
    await collection('users').updateOne(
      { email, role: 'admin' },
      {
        $set: { password_hash: hash },
        ...(existingAdmin ? {} : { $setOnInsert: { id: await nextId('users'), name: 'Administration Mercan', email, phone: '+216 55 333 100', role: 'admin', created_at: new Date() } })
      },
      { upsert: true }
    );
    console.log('Données de démonstration et compte administrateur créés ou mis à jour.');
  } finally {
    await closeMongo();
  }
}

seed().catch((error) => {
  console.error('Échec du chargement des données :', error.message);
  process.exitCode = 1;
});
