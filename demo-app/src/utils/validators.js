'use strict';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email) {
  if (typeof email !== 'string') return false;
  return EMAIL_RE.test(email.trim());
}

function isNonEmptyString(value, min = 1, max = 256) {
  return typeof value === 'string' && value.length >= min && value.length <= max;
}

module.exports = {
  isValidEmail,
  isNonEmptyString,
};
