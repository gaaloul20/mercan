require('dotenv').config();

const mysql = require('mysql2/promise');
const { closeMongo, collection, connectMongo } = require('./mongo');

const tables = {
  users: { json: [], booleans: [], numeric: [] },
  hotels: { json: ['services', 'images'], booleans: ['featured'], numeric: ['price', 'stars'] },
  packages: { json: ['dates', 'program', 'inclusions', 'exclusions', 'images'], booleans: ['featured'], numeric: ['price'] },
  requests: { json: ['flight_details'], booleans: [], numeric: ['item_id', 'user_id'] },
  contact_messages: { json: [], booleans: [], numeric: [] },
  newsletter_subscribers: { json: [], booleans: [], numeric: [] },
  slides: { json: [], booleans: ['active'], numeric: ['position'] },
  partners: { json: [], booleans: ['active'], numeric: ['position'] }
};

function parseJson(value) {
  if (value === null || value === undefined || typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new Error(`Une valeur JSON MySQL ne peut pas être convertie : ${error.message}`);
  }
}

function convertRow(row, definition) {
  const document = { ...row };
  document.id = Number(document.id);
  if (!Number.isSafeInteger(document.id) || document.id < 1) {
    throw new Error(`Identifiant MySQL invalide : ${row.id}`);
  }
  for (const field of definition.json) document[field] = parseJson(document[field]);
  for (const field of definition.booleans) {
    document[field] = document[field] === true || document[field] === 1 || document[field] === '1';
  }
  for (const field of definition.numeric) {
    if (document[field] !== null && document[field] !== undefined) document[field] = Number(document[field]);
  }
  if (document.created_at) document.created_at = new Date(document.created_at);
  return document;
}

async function migrate() {
  const source = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'mercan_voyages',
    waitForConnections: true,
    connectionLimit: 2,
    charset: 'utf8mb4'
  });

  try {
    await connectMongo();
    for (const [table, definition] of Object.entries(tables)) {
      const [rows] = await source.query(`SELECT * FROM \`${table}\``);
      if (!rows.length) {
        console.log(`${table}: aucune donnée à importer.`);
        continue;
      }
      const documents = rows.map((row) => convertRow(row, definition));
      const operations = documents.map((document) => ({
        replaceOne: { filter: { id: document.id }, replacement: document, upsert: true }
      }));
      await collection(table).bulkWrite(operations, { ordered: true });
      await collection('counters').updateOne(
        { _id: table },
        { $max: { sequence: documents.reduce((maximum, document) => Math.max(maximum, document.id), 0) } },
        { upsert: true }
      );
      console.log(`${table}: ${documents.length} document(s) importé(s).`);
    }

    const [sessions] = await source.query('SELECT session_id, expires, data FROM sessions WHERE expires > UNIX_TIMESTAMP()');
    const activeSessions = sessions.map((row) => ({
      replaceOne: {
        filter: { _id: row.session_id },
        replacement: { _id: row.session_id, expiresAt: new Date(Number(row.expires) * 1000), session: parseJson(row.data) || {} },
        upsert: true
      }
    }));
    if (activeSessions.length) await collection('sessions').bulkWrite(activeSessions, { ordered: true });
    console.log(`sessions: ${activeSessions.length} session(s) active(s) importée(s).`);
  } finally {
    await source.end();
    await closeMongo();
  }
}

migrate().catch((error) => {
  console.error('Échec de la migration MySQL vers MongoDB Atlas :', error.message);
  process.exitCode = 1;
});
