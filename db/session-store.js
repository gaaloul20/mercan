const session = require('express-session');
const { collection } = require('./mongo');

class MongoSessionStore extends session.Store {
  constructor() {
    super();
    if (process.env.VERCEL !== '1') {
      this.cleanupTimer = setInterval(() => {
        collection('sessions').deleteMany({ expiresAt: { $lte: new Date() } })
          .catch((error) => this.emit('error', error));
      }, 15 * 60 * 1000);
      this.cleanupTimer.unref();
    }
  }

  get(sid, callback) {
    collection('sessions').findOne({ _id: sid, expiresAt: { $gt: new Date() } })
      .then((record) => callback(null, record ? record.session : null))
      .catch(callback);
  }

  set(sid, sessionData, callback = () => {}) {
    let expiresAt;
    try {
      expiresAt = this.expiration(sessionData);
    } catch (error) {
      return callback(error);
    }
    collection('sessions').updateOne(
      { _id: sid },
      { $set: { session: sessionData, expiresAt } },
      { upsert: true }
    ).then(() => callback()).catch(callback);
  }

  touch(sid, sessionData, callback = () => {}) {
    let expiresAt;
    try {
      expiresAt = this.expiration(sessionData);
    } catch (error) {
      return callback(error);
    }
    collection('sessions').updateOne({ _id: sid }, { $set: { expiresAt } })
      .then(() => callback()).catch(callback);
  }

  destroy(sid, callback = () => {}) {
    collection('sessions').deleteOne({ _id: sid })
      .then(() => callback()).catch(callback);
  }

  expiration(sessionData) {
    const expiry = sessionData.cookie && sessionData.cookie.expires
      ? new Date(sessionData.cookie.expires)
      : new Date(Date.now() + ((sessionData.cookie && sessionData.cookie.maxAge) || 86400000));
    if (!Number.isFinite(expiry.getTime())) throw new Error('Date d’expiration de session invalide.');
    return expiry;
  }
}

module.exports = MongoSessionStore;
