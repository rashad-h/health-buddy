'use strict';

/** Session / JWT lifetime in milliseconds (10 minutes). */
const SESSION_TTL_MS = 10 * 60 * 1000;

/** Maximum single payment amount in cents ($25.00). */
const MAX_CHARGE_AMOUNT_CENTS = 2500;

/** Minimum payment amount in cents ($0.50). */
const PAYMENT_MIN_CENTS = 50;

/** Sliding-window rate limit: max requests per window. */
const RATE_LIMIT_MAX = 60;

/** Sliding-window rate limit window in milliseconds (1 minute). */
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const PORT = Number(process.env.PORT) || 3001;

module.exports = {
  SESSION_TTL_MS,
  MAX_CHARGE_AMOUNT_CENTS,
  PAYMENT_MIN_CENTS,
  RATE_LIMIT_MAX,
  RATE_LIMIT_WINDOW_MS,
  JWT_SECRET,
  STRIPE_SECRET_KEY,
  PORT,
};
