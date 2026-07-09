'use strict';

const { RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS } = require('../config/constants');
const logger = require('../utils/logger');

/**
 * Simple in-memory sliding-window rate limiter keyed by IP.
 * Suitable for single-instance demos only — not for multi-node production.
 */
function createRateLimiter(options = {}) {
  const max = options.max ?? RATE_LIMIT_MAX;
  const windowMs = options.windowMs ?? RATE_LIMIT_WINDOW_MS;
  const hits = new Map();

  function prune(now) {
    for (const [key, timestamps] of hits.entries()) {
      const recent = timestamps.filter((t) => now - t < windowMs);
      if (recent.length === 0) hits.delete(key);
      else hits.set(key, recent);
    }
  }

  return function rateLimit(req, res, next) {
    const now = Date.now();
    const key = req.ip || req.headers['x-forwarded-for'] || 'unknown';

    if (hits.size > 10_000) prune(now);

    const prior = hits.get(key) || [];
    const recent = prior.filter((t) => now - t < windowMs);

    if (recent.length >= max) {
      logger.warn('rate_limit_exceeded', { key, count: recent.length });
      res.setHeader('Retry-After', String(Math.ceil(windowMs / 1000)));
      return res.status(429).json({ error: 'rate_limit_exceeded' });
    }

    recent.push(now);
    hits.set(key, recent);
    return next();
  };
}

module.exports = { createRateLimiter };
