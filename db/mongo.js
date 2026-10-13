const { MongoClient } = require('mongodb');

let client;
let database;
let connectionPromise;

async function connectMongo() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI doit être défini dans .env avec la chaîne de connexion MongoDB Atlas.');
  if (database) return database;
  if (connectionPromise) return connectionPromise;

  connectionPromise = (async () => {
    const nextClient = new MongoClient(uri, { appName: 'MercanVoyages', serverSelectionTimeoutMS: 10000 });
    client = nextClient;
    try {
      await nextClient.connect();
      const nextDatabase = nextClient.db(process.env.MONGODB_DB_NAME || undefined);
      await ensureIndexes(nextDatabase);
      database = nextDatabase;
      return database;
    } catch (error) {
      await nextClient.close().catch((closeError) => {
        console.error('Impossible de fermer la connexion MongoDB après une erreur :', closeError);
      });
      client = undefined;
      database = undefined;
      throw error;
    }
  })();
  try {
    return await connectionPromise;
  } finally {
    connectionPromise = undefined;
  }
}

async function ensureIndexes(db) {
  for (const name of ['users', 'hotels', 'packages', 'slides', 'partners', 'requests', 'contact_messages', 'newsletter_subscribers']) {
    await db.collection(name).createIndex({ id: 1 }, { unique: true });
  }
  await Promise.all([
    db.collection('users').createIndex({ email: 1 }, { unique: true }),
    db.collection('hotels').createIndex({ slug: 1 }, { unique: true }),
    db.collection('packages').createIndex({ slug: 1 }, { unique: true }),
    db.collection('newsletter_subscribers').createIndex({ email: 1 }, { unique: true }),
    db.collection('requests').createIndex({ user_id: 1, created_at: -1 }),
    db.collection('requests').createIndex({ status: 1, created_at: -1 }),
    db.collection('sessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
  ]);
  await Promise.all(
    ['users', 'hotels', 'packages', 'slides', 'partners', 'requests', 'contact_messages', 'newsletter_subscribers']
      .map((name) => db.collection('counters').updateOne(
        { _id: name },
        { $setOnInsert: { sequence: 0 } },
        { upsert: true }
      ))
  );
}

function getDb() {
  if (!database) throw new Error('MongoDB n’est pas encore connecté.');
  return database;
}

function collection(name) {
  return getDb().collection(name);
}

async function nextId(collectionName) {
  const result = await collection('counters').findOneAndUpdate(
    { _id: collectionName },
    { $inc: { sequence: 1 } },
    { upsert: true, returnDocument: 'after', includeResultMetadata: false }
  );
  if (!result || !Number.isSafeInteger(result.sequence)) {
    throw new Error(`Impossible de générer un identifiant pour ${collectionName}.`);
  }
  return result.sequence;
}

async function insertDocument(collectionName, document) {
  const record = { ...document, id: await nextId(collectionName), created_at: document.created_at || new Date() };
  await collection(collectionName).insertOne(record);
  return record;
}

async function closeMongo() {
  if (connectionPromise) await connectionPromise.catch(() => {});
  if (client) await client.close();
  client = undefined;
  database = undefined;
  connectionPromise = undefined;
}

module.exports = { closeMongo, collection, connectMongo, getDb, insertDocument, nextId };
