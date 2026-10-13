const resources = {
  hotels: {
    table: 'hotels',
    defaults: { price: null, featured: false },
    fields: ['slug', 'name', 'city', 'stars', 'summary', 'description', 'board', 'services', 'images', 'price', 'featured'],
    json: ['services', 'images'],
    booleans: ['featured']
  },
  packages: {
    table: 'packages',
    defaults: { price: null, featured: false },
    fields: ['slug', 'type', 'title', 'destination', 'summary', 'description', 'dates', 'duration', 'program', 'inclusions', 'exclusions', 'images', 'price', 'featured'],
    json: ['dates', 'program', 'inclusions', 'exclusions', 'images'],
    booleans: ['featured']
  },
  slides: {
    table: 'slides',
    defaults: { active: true },
    fields: ['title', 'text', 'button_text', 'button_url', 'image', 'position', 'active'],
    booleans: ['active']
  },
  partners: {
    table: 'partners',
    defaults: { url: null, active: true },
    fields: ['name', 'logo', 'url', 'position', 'active'],
    booleans: ['active']
  }
};

module.exports = resources;
