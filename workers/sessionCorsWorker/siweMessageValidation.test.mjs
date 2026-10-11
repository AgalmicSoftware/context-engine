import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ADMIN_ACTION_DOMAIN,
  ADMIN_ACTION_TYPES,
  parseSiweMessage,
  resolveTrustedAdminOrigins,
  resolveTrustedLoginOrigins,
  validateAdminActionAudience,
  validateBrowserLoginOrigin,
  validateSiwe,
  validateTrustedLoginRequestOrigin,
} from './siweMessageValidation.js';

const SIWE_ADDRESS = '0x00000000000000000000000000000000000000Ab';
// The exact shape the current client builds in workerAuth.ts.
const clientSiweLines = () => [
  'app.example wants you to sign in with your Ethereum account:',
  SIWE_ADDRESS,
  '',
  'Sign in to Context Engine.',
  '',
  'URI: https://app.example',
  'Version: 1',
  'Chain ID: 84532',
  'Nonce: nonce0001',
  'Issued At: 2026-03-11T00:00:00.000Z',
  'Expiration Time: 2026-03-12T00:00:00.000Z',
  'Resources:',
  '- https://worker.example',
  '- urn:context-engine:session:id:0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
];

test('parseSiweMessage extracts the fields of the message the client signs', () => {
  assert.deepEqual(parseSiweMessage(clientSiweLines().join('\n')), {
    domain: 'app.example',
    address: SIWE_ADDRESS,
    statement: 'Sign in to Context Engine.',
    uri: 'https://app.example',
    chainId: '84532',
    nonce: 'nonce0001',
    issuedAt: '2026-03-11T00:00:00.000Z',
    expirationTime: '2026-03-12T00:00:00.000Z',
    resources: ['https://worker.example', 'urn:context-engine:session:id:0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'],
  });
  // EIP-4361 without a statement keeps both blank lines.
  const withoutStatement = clientSiweLines();
  withoutStatement.splice(3, 2, '');
  assert.equal(parseSiweMessage(withoutStatement.join('\n')).statement, undefined);
  assert.equal(parseSiweMessage(withoutStatement.join('\n')).nonce, 'nonce0001');
});

const withLines = (edit) => {
  const lines = clientSiweLines();
  edit(lines);
  return lines.join('\n');
};

for (const [label, message] of [
  ['an extra trailing line', withLines((lines) => lines.push('Reward code: 7731'))],
  ['a trailing newline', `${clientSiweLines().join('\n')}\n`],
  ['a duplicated URI line', withLines((lines) => lines.splice(6, 0, 'URI: https://b.example'))],
  ['reordered fields', withLines((lines) => lines.splice(6, 2, lines[7], lines[6]))],
  ['fields inside prose', [
    'app.example wants you to sign in with your Ethereum account:',
    SIWE_ADDRESS,
    'Issued At: 2026-03-11T00:00:00.000Z',
    'To verify your wallet for the giveaway, sign this text.',
    'Nonce: nonce-1',
    'Chain ID: 84532',
    'URI: https://app.example',
  ].join('\n')],
  ['a missing Issued At line', withLines((lines) => lines.splice(9, 1))],
  ['an unknown field', withLines((lines) => lines.splice(10, 0, 'Reward: 5'))],
  ['padded values', withLines((lines) => { lines[5] = 'URI:  https://app.example'; })],
  ['CRLF line breaks', clientSiweLines().join('\r\n')],
  ['an invalid address', withLines((lines) => { lines[1] = '0xabc'; })],
  ['an unsupported version', withLines((lines) => { lines[6] = 'Version: 2'; })],
  ['a statement outside the EIP-4361 character set', withLines((lines) => { lines[3] = 'Claim your <reward>'; })],
  ['a resource without the list prefix', withLines((lines) => { lines[12] = 'https://worker.example'; })],
  // EIP-4361 nonces are at least eight letters or digits.
  ['a nonce with a hyphen', withLines((lines) => { lines[8] = 'Nonce: nonce-0001'; })],
  ['a nonce with an underscore', withLines((lines) => { lines[8] = 'Nonce: nonce_0001'; })],
  ['a nonce shorter than eight characters', withLines((lines) => { lines[8] = 'Nonce: abc1234'; })],
]) {
  test(`parseSiweMessage rejects ${label}`, () => {
    const parsed = parseSiweMessage(message);
    assert.match(parsed.error, /^Malformed SIWE message: /);
    assert.equal(parsed.nonce, '');
    assert.equal(parsed.resources, undefined);
    assert.deepEqual(validateSiwe(parsed), { ok: false, error: parsed.error });
  });
}

test('validateSiwe rejects a message whose Not Before time has not arrived', () => {
  const parsed = parseSiweMessage(withLines((lines) => lines.splice(11, 0, 'Not Before: 2026-03-11T12:00:00.000Z')));
  assert.equal(parsed.notBefore, '2026-03-11T12:00:00.000Z');
  assert.deepEqual(validateSiwe(parsed, { now: () => Date.parse('2026-03-11T06:00:00.000Z') }), {
    ok: false,
    error: 'SIWE message is not valid yet.',
  });
  assert.deepEqual(validateSiwe(parsed, { now: () => Date.parse('2026-03-11T13:00:00.000Z') }), { ok: true });
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

test('validateSiwe enforces issuedAt freshness only when requested', () => {
  const baseSiwe = {
    domain: 'app.example',
    uri: 'https://app.example/login',
    chainId: '84532',
    nonce: 'nonce-1',
  };

  assert.deepEqual(validateSiwe(baseSiwe), {
    ok: true,
  });
  assert.deepEqual(validateSiwe(baseSiwe, { requireIssuedAt: true }), {
    ok: false,
    error: 'Missing SIWE issuedAt.',
  });
  assert.deepEqual(validateSiwe({
    ...baseSiwe,
    issuedAt: 'not-a-date',
  }, { requireIssuedAt: true }), {
    ok: false,
    error: 'Invalid SIWE issuedAt.',
  });
  assert.deepEqual(validateSiwe({
    ...baseSiwe,
    issuedAt: '2026-04-23T12:10:01.000Z',
  }, {
    requireIssuedAt: true,
    now: () => Date.parse('2026-04-23T12:09:00.000Z'),
    issuedAtFutureSkewMs: 60 * 1000,
  }), {
    ok: false,
    error: 'SIWE issuedAt is too far in the future.',
  });
  assert.deepEqual(validateSiwe({
    ...baseSiwe,
    issuedAt: '2026-04-23T12:00:00.000Z',
  }, {
    requireIssuedAt: true,
    now: () => Date.parse('2026-04-23T12:06:00.000Z'),
    maxIssuedAtAgeMs: 5 * 60 * 1000,
  }), {
    ok: false,
    error: 'SIWE message is too old.',
  });
  assert.deepEqual(validateSiwe({
    ...baseSiwe,
    issuedAt: '2026-04-23T12:00:00.000Z',
  }, {
    requireIssuedAt: true,
    now: () => Date.parse('2026-04-23T12:04:59.000Z'),
    maxIssuedAtAgeMs: 5 * 60 * 1000,
  }), {
    ok: true,
  });
});

test('validateTrustedLoginRequestOrigin and validateBrowserLoginOrigin bind login to trusted request origin', () => {
  const config = { allowOrigins: ['https://app.example'] };

  assert.deepEqual(validateTrustedLoginRequestOrigin({
    request: { headers: new Headers() },
    config,
  }), {
    ok: false,
    error: 'Missing Origin for worker login.',
  });

  assert.deepEqual(validateTrustedLoginRequestOrigin({
    request: { headers: new Headers({ Origin: 'https://evil.example' }) },
    config,
  }), {
    ok: false,
    error: 'Untrusted worker login origin.',
  });

  assert.deepEqual(resolveTrustedLoginOrigins({
    env: { LOGIN_TRUSTED_ORIGINS: 'https://login.example, http://localhost:3000' },
    config,
  }), [
    'https://app.example',
    'https://login.example',
    'http://localhost:3000',
  ]);

  assert.deepEqual(validateTrustedLoginRequestOrigin({
    request: { headers: new Headers({ Origin: 'http://localhost:3000' }) },
    env: { LOGIN_TRUSTED_ORIGINS: 'https://login.example' },
    config,
    allowTrustedAdminOrigins: true,
  }, {
    resolveTrustedAdminOrigins: () => ['http://localhost:3000'],
  }), {
    ok: true,
    origin: 'http://localhost:3000',
  });

  assert.deepEqual(validateBrowserLoginOrigin({
    request: { headers: new Headers({ Origin: 'https://app.example' }) },
    siwe: { uri: 'https://evil.example' },
    config,
  }), {
    ok: false,
    error: 'SIWE uri origin does not match request Origin.',
  });

  assert.deepEqual(validateBrowserLoginOrigin({
    request: { headers: new Headers({ Origin: 'https://app.example' }) },
    siwe: { uri: 'https://app.example/login' },
    config,
  }), {
    ok: true,
    origin: 'https://app.example',
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
    'https://contextengine.sh',
    'https://www.contextengine.sh',
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

test('validateAdminActionAudience trusts the canonical .sh hosted origin', () => {
  assert.deepEqual(
    validateAdminActionAudience({
      audience: 'https://contextengine.sh',
      request: {
        url: 'https://worker.example/admin/set-config',
        headers: new Headers({ Origin: 'https://contextengine.sh' }),
      },
    }),
    {
      ok: true,
      audience: 'https://contextengine.sh',
    },
  );
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


test('Resources must be the final URI list while messages without them stay compatible', () => {
  const legacy = withLines((lines) => lines.splice(11));
  assert.equal(parseSiweMessage(legacy).resources, undefined);
  assert.equal(parseSiweMessage(legacy).error, undefined);
  const resources = ['https://worker.example', 'urn:context-engine:session:slug:fixture'];
  assert.match(parseSiweMessage(`${legacy}\nResources:\n${resources.join('\n')}`).error, /Malformed/);
  assert.deepEqual(parseSiweMessage(`${legacy}\nResources:\n- ${resources.join('\n- ')}`).resources, resources);
});

test('injected Resources before SIWE fields cannot create a trusted binding', () => {
  const binding = ['Resources:', '- https://worker.example', '- urn:context-engine:session:slug:fixture'];
  const legacy = clientSiweLines().slice(0, 11);
  const beforeFields = [...legacy.slice(0, 5), ...binding, ...legacy.slice(5)].join('\n');
  const betweenFields = [...legacy.slice(0, 9), ...binding, ...legacy.slice(9)].join('\n');
  assert.match(parseSiweMessage(beforeFields).error, /Malformed/);
  assert.match(parseSiweMessage(betweenFields).error, /Malformed/);
  assert.deepEqual(parseSiweMessage([...legacy, ...binding].join('\n')).resources,
    ['https://worker.example', 'urn:context-engine:session:slug:fixture']);
});
