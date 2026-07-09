'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { SESSION_TTL_MS, JWT_SECRET } = require('../config/constants');
const { isValidEmail, isNonEmptyString } = require('../utils/validators');
const logger = require('../utils/logger');

const router = express.Router();

// In-memory user store for demo purposes only.
const users = new Map();

router.post('/register', async (req, res) => {
  const { email, password, name } = req.body || {};

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'invalid_email' });
  }
  if (!isNonEmptyString(password, 8, 128)) {
    return res.status(400).json({ error: 'invalid_password' });
  }
  if (!isNonEmptyString(name, 1, 100)) {
    return res.status(400).json({ error: 'invalid_name' });
  }

  const normalized = email.trim().toLowerCase();
  if (users.has(normalized)) {
    return res.status(409).json({ error: 'email_taken' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = { id: `usr_${users.size + 1}`, email: normalized, name, passwordHash };
  users.set(normalized, user);

  logger.info('user_registered', { userId: user.id });
  return res.status(201).json({ id: user.id, email: user.email, name: user.name });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};

  if (!isValidEmail(email) || !isNonEmptyString(password, 1, 128)) {
    return res.status(400).json({ error: 'invalid_credentials' });
  }

  const normalized = email.trim().toLowerCase();
  const user = users.get(normalized);

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    logger.warn('login_failed', { reason: 'bad_credentials' });
    return res.status(401).json({ error: 'invalid_credentials' });
  }

  const token = jwt.sign(
    { email: user.email },
    JWT_SECRET,
    { subject: user.id, expiresIn: Math.floor(SESSION_TTL_MS / 1000) }
  );

  logger.info('login_success', { userId: user.id });
  return res.json({
    token,
    expiresInMs: SESSION_TTL_MS,
    user: { id: user.id, email: user.email, name: user.name },
  });
});

module.exports = router;
