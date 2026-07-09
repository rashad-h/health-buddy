'use strict';

function info(message, meta = {}) {
  console.log(JSON.stringify({ level: 'info', message, ts: new Date().toISOString(), ...meta }));
}

function warn(message, meta = {}) {
  console.warn(JSON.stringify({ level: 'warn', message, ts: new Date().toISOString(), ...meta }));
}

function error(message, meta = {}) {
  console.error(JSON.stringify({ level: 'error', message, ts: new Date().toISOString(), ...meta }));
}

module.exports = {
  info,
  warn,
  error,
};
