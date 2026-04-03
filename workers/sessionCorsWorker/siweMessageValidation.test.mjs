import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ADMIN_ACTION_DOMAIN,
  ADMIN_ACTION_TYPES,
  parseSiweMessage,
  resolveTrustedAdminOrigins,
  validateAdminActionAudience,
  validateSiwe,
} from './siweMessageValidation.js';

test('parseSiweMessage trims and extracts SIWE fields from the signed message', () => {
  const parsed = parseSiweMessage([
    ' app.example wants you to sign in with your Ethereum account: ',
    ' 0xAbC123 ',
    '',
    'URI: https://app.example/login ',
    'Version: 1 ',
    'Chain ID: 84532 ',
    'Nonce: nonce-1 ',
    'Issued At: 2026-03-11T00:00:00.000Z ',
    'Expiration Time: 2026-03-12T00:00:00.000Z ',
  ].join('\n'));

  assert.deepEqual(parsed, {
    domain: 'app.example',
    address: '0xAbC123',
    uri: 'https://app.example/login',
    chainId: '84532',
    nonce: 'nonce-1',
    issuedAt: '2026-03-11T00:00:00.000Z',
    expirationTime: '2026-03-12T00:00:00.000Z',
  });
});

test('validateSiwe preserves required-field failures in order', () => {
  assert.deepEqual(validateSiwe({}), {
    ok: false,
    error: 'Missing SIWE domain.',
  });
  assert.deepEqual(validateSiwe({ domain: 'app.example' }), {
    ok: false,
    error: 'Missing SIWE uri.',
  });
  assert.deepEqual(validateSiwe({ domain: 'app.example', uri: 'https://app.example' }), {
    ok: false,
    error: 'Missing SIWE chainId.',
  });
  assert.deepEqual(validateSiwe({
    domain: 'app.example',
    uri: 'https://app.example',
    chainId: '84532',
  }), {
    ok: false,
    error: 'Missing SIWE nonce.',
  });
});

test('validateSiwe preserves uri-host mismatch and invalid-uri failures', () => {
  const baseSiwe = {
    domain: 'app.example',
    uri: 'https://app.example/login',
    chainId: '84532',
    nonce: 'nonce-1',
  };

  assert.deepEqual(validateSiwe({
    ...baseSiwe,
    uri: 'https://other.example/login',
  }), {
    ok: false,
    error: 'SIWE domain does not match URI host.',
  });

  assert.deepEqual(validateSiwe({
    ...baseSiwe,
    uri: 'not-a-uri',
  }), {
    ok: false,
    error: 'Invalid SIWE uri.',
  });
});

test('validateSiwe preserves invalid and expired expiration failures and accepts valid messages', () => {
  const baseSiwe = {
    domain: 'app.example',
    uri: 'https://app.example/login',
    chainId: '84532',
    nonce: 'nonce-1',
  };

  assert.deepEqual(validateSiwe({
    ...baseSiwe,
    expirationTime: 'not-a-date',
  }), {
    ok: false,
    error: 'Invalid SIWE expiration time.',
  });

  assert.deepEqual(validateSiwe({
    ...baseSiwe,
    expirationTime: '2026-03-11T00:00:00.000Z',
  }, {
    now: () => Date.parse('2026-03-11T00:00:00.000Z'),
  }), {
    ok: false,
    error: 'SIWE message expired.',
  });

  assert.deepEqual(validateSiwe({
    ...baseSiwe,
    expirationTime: '2026-03-12T00:00:00.000Z',
  }, {
    now: () => Date.parse('2026-03-11T00:00:00.000Z'),
  }), {
    ok: true,
  });
});

test('admin typed-data constants preserve the expected domain and struct names', () => {
  assert.deepEqual(ADMIN_ACTION_DOMAIN, {
    name: 'ContextEngineAdmin',
    version: '1',
  });
  assert.deepEqual(ADMIN_ACTION_TYPES, {
    AdminAction: [
      { name: 'action', type: 'string' },
      { name: 'slug', type: 'string' },
      { name: 'bodyHash', type: 'bytes32' },
      { name: 'nonce', type: 'string' },
      { name: 'audience', type: 'string' },
      { name: 'expiration', type: 'uint256' },
    ],
  });
});

test('resolveTrustedAdminOrigins keeps the default hosted and local admin origins aligned', () => {
  assert.deepEqual(resolveTrustedAdminOrigins({}), [
    'https://contextengine.xyz',
    'https://www.contextengine.xyz',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3001',
    'http://localhost:7391',
    'http://127.0.0.1:7391',
  ]);
});

test('validateAdminActionAudience trusts approved origins, configured allowOrigins, and falls back to worker origin for non-browser callers', () => {
  assert.deepEqual(
    validateAdminActionAudience({
      audience: 'https://contextengine.xyz',
      request: {
        url: 'https://worker.example/admin/set-config',
        headers: new Headers({ Origin: 'https://contextengine.xyz' }),
      },
    }),
    {
      ok: true,
      audience: 'https://contextengine.xyz',
    },
  );

  assert.deepEqual(
    validateAdminActionAudience({
      audience: 'https://www.contextengine.xyz',
      request: {
        url: 'https://worker.example/admin/set-config',
        headers: new Headers({ Origin: 'https://www.contextengine.xyz' }),
      },
    }),
    {
      ok: true,
      audience: 'https://www.contextengine.xyz',
    },
  );

  assert.deepEqual(
    validateAdminActionAudience({
      audience: 'http://localhost:3001',
      request: {
        url: 'https://worker.example/admin/set-config',
        headers: new Headers({ Origin: 'http://localhost:3001' }),
      },
    }),
    {
      ok: true,
      audience: 'http://localhost:3001',
    },
  );

  assert.deepEqual(
    validateAdminActionAudience({
      audience: 'http://127.0.0.1:7391',
      request: {
        url: 'https://worker.example/admin/set-config',
        headers: new Headers({ Origin: 'http://127.0.0.1:7391' }),
      },
    }),
    {
      ok: true,
      audience: 'http://127.0.0.1:7391',
    },
  );

  assert.deepEqual(
    validateAdminActionAudience({
      audience: 'https://contextengine.xyz',
      request: {
        url: 'https://worker.example/admin/set-config',
        headers: new Headers({ Origin: 'https://other.example' }),
      },
    }),
    {
      ok: false,
      error: 'Admin audience does not match request origin.',
    },
  );

  assert.deepEqual(
    validateAdminActionAudience({
      audience: 'https://custom.example',
      request: {
        url: 'https://worker.example/admin/set-config',
        headers: new Headers({ Origin: 'https://custom.example' }),
      },
      config: {
        allowOrigins: ['https://custom.example'],
      },
    }),
    {
      ok: true,
      audience: 'https://custom.example',
    },
  );

  assert.deepEqual(
    validateAdminActionAudience({
      audience: 'https://bootstrap.example',
      request: {
        url: 'https://worker.example/admin/set-config',
        headers: new Headers({ Origin: 'https://bootstrap.example' }),
      },
      initializingConfig: {
        allowOrigins: ['https://bootstrap.example'],
      },
    }),
    {
      ok: true,
      audience: 'https://bootstrap.example',
    },
  );

  assert.deepEqual(
    validateAdminActionAudience({
      audience: 'https://bootstrap.example',
      request: {
        url: 'https://worker.example/admin/set-config',
        headers: new Headers({ Origin: 'https://bootstrap.example' }),
      },
    }),
    {
      ok: false,
      error: 'Untrusted admin audience.',
    },
  );

  assert.deepEqual(
    validateAdminActionAudience({
      audience: 'https://worker.example',
      request: {
        url: 'https://worker.example/admin/set-config',
        headers: new Headers(),
      },
    }),
    {
      ok: true,
      audience: 'https://worker.example',
    },
  );

  assert.deepEqual(
    validateAdminActionAudience({
      audience: 'https://phishing.example',
      request: {
        url: 'https://worker.example/admin/set-config',
        headers: new Headers({ Origin: 'https://phishing.example' }),
      },
    }),
    {
      ok: false,
      error: 'Untrusted admin audience.',
    },
  );
});
