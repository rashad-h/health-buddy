'use strict';

/** Session / JWT lifetime in milliseconds (24 hours). */
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

/** Maximum single payment amount in cents ($100.00). */
const PAYMENT_MAX_CENTS = 10000;

/** Minimum payment amount in cents ($0.50). */
const PAYMENT_MIN_CENTS = 50;

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const PORT = Number(process.env.PORT) || 3001;

module.exports = {
  SESSION_TTL_MS,
  PAYMENT_MAX_CENTS,
  PAYMENT_MIN_CENTS,
  JWT_SECRET,
  STRIPE_SECRET_KEY,
  PORT,
};
