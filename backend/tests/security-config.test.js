const test = require('node:test');
const assert = require('node:assert/strict');
const security = require('../src/config/security');

test('production security: rejects weak JWT secret', () => {
  assert.throws(
    () => security.assertProductionSecurity({ NODE_ENV: 'production', JWT_SECRET: 'short', CORS_ORIGIN: 'https://app.example.com' }),
    /JWT_SECRET/
  );
});

test('production security: requires explicit CORS origins', () => {
  assert.throws(
    () => security.assertProductionSecurity({ NODE_ENV: 'production', JWT_SECRET: 'a'.repeat(40), CORS_ORIGIN: '' }),
    /CORS_ORIGIN/
  );
});

test('cors: allows only configured browser origins', () => {
  const options = security.buildCorsOptions({ CORS_ORIGIN: 'https://app.example.com, http://127.0.0.1:8081' });
  options.origin('https://app.example.com', (err, allowed) => {
    assert.ifError(err);
    assert.equal(allowed, true);
  });
  options.origin('https://evil.example.com', (err, allowed) => {
    assert.ifError(err);
    assert.equal(allowed, false);
  });
  options.origin(undefined, (err, allowed) => {
    assert.ifError(err);
    assert.equal(allowed, true);
  });
});
