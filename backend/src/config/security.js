function isWeakJwtSecret(secret) {
  return !secret || secret.length < 32 || /your_super_secret|change_in_production/i.test(secret);
}

function parseCorsOrigins(value) {
  return String(value || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);
}

function assertProductionSecurity(env = process.env) {
  if (env.NODE_ENV !== 'production') return;
  if (isWeakJwtSecret(env.JWT_SECRET)) {
    throw new Error('JWT_SECRET must be a random string with at least 32 characters in production');
  }
  if (!parseCorsOrigins(env.CORS_ORIGIN).length) {
    throw new Error('CORS_ORIGIN must be set to the production frontend origin(s)');
  }
}

function buildCorsOptions(env = process.env) {
  const allowed = parseCorsOrigins(env.CORS_ORIGIN);
  return {
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      return callback(null, allowed.includes(origin));
    },
    credentials: true,
    exposedHeaders: ['Content-Disposition']
  };
}

module.exports = { isWeakJwtSecret, parseCorsOrigins, assertProductionSecurity, buildCorsOptions };
