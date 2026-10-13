function requireUser(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'client') {
    return res.status(401).json({ error: 'Connectez-vous pour consulter votre compte.' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(401).json({ error: 'Accès réservé à l’administration.' });
  }
  next();
}

module.exports = { requireUser, requireAdmin };
