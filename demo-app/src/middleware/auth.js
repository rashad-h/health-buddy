'use strict';

const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/constants');
const logger = require('../utils/logger');

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'missing_token' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { id: payload.sub, email: payload.email };
    return next();
  } catch (err) {
    logger.warn('auth_token_invalid', { reason: err.name });
    return res.status(401).json({ error: 'invalid_token' });
  }
}

module.exports = { requireAuth };
