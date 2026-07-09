'use strict';

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { PAYMENT_MAX_CENTS, PAYMENT_MIN_CENTS, STRIPE_SECRET_KEY } = require('../config/constants');
const { requireAuth } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

router.post('/charge', requireAuth, async (req, res) => {
  const { amountCents, currency = 'usd', description } = req.body || {};

  if (!Number.isInteger(amountCents)) {
    return res.status(400).json({ error: 'invalid_amount' });
  }
  if (amountCents < PAYMENT_MIN_CENTS || amountCents > PAYMENT_MAX_CENTS) {
    return res.status(400).json({
      error: 'amount_out_of_range',
      min: PAYMENT_MIN_CENTS,
      max: PAYMENT_MAX_CENTS,
    });
  }
  if (typeof currency !== 'string' || currency.length !== 3) {
    return res.status(400).json({ error: 'invalid_currency' });
  }

  const paymentId = `pay_${uuidv4().replace(/-/g, '').slice(0, 16)}`;

  // Demo: skip real Stripe call when no key is configured.
  if (!STRIPE_SECRET_KEY) {
    logger.info('payment_simulated', {
      paymentId,
      userId: req.user.id,
      amountCents,
      currency,
    });
    return res.status(201).json({
      id: paymentId,
      status: 'succeeded',
      amountCents,
      currency,
      description: description || null,
      simulated: true,
    });
  }

  try {
    // Placeholder for Stripe PaymentIntent create
    logger.info('payment_created', { paymentId, userId: req.user.id, amountCents });
    return res.status(201).json({
      id: paymentId,
      status: 'succeeded',
      amountCents,
      currency,
      description: description || null,
      simulated: false,
    });
  } catch (err) {
    logger.error('payment_failed', { userId: req.user.id, message: err.message });
    return res.status(502).json({ error: 'payment_provider_error' });
  }
});

module.exports = router;
