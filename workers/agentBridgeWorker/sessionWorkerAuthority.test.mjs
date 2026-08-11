import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import {
  resolvePinnedSessionWorkerAuthority,
  validateSessionWorkerBrowserCredentialBinding,
  validateSessionWorkerMemberCredentialBinding,
  verifySessionWorkerMembership,
} from './sessionWorkerAuthority.mjs';

function jwt(claims = {}) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(claims)}.test-signature`;
}

function workerHmacToken(claims = {}) {
  const payloadJson = JSON.stringify(claims);
  const payload = Buffer.from(payloadJson).toString('base64url');
  const signature = createHmac('sha256', 'unit-worker-secret').update(payloadJson).digest('base64url');
  return `${payload}.${signature}`;
}

const origin = 'https://session-worker.example';
const address = '0x1111111111111111111111111111111111111111';
const sessionId = `0x${'12'.repeat(16)}`;

test('resolvePinnedSessionWorkerAuthority requires one agentHttp session and exact Worker origin', () => {
  const valid = resolvePinnedSessionWorkerAuthority({
    policyJson: JSON.stringify({
      version: 1,
      defaultSessionSlug: 'alpha',
      sessions: [
        {
          sessionSlug: 'alpha',
          sessionWorkerUrl: origin,
          sessionModeProfile: { surfaces: { agentHttp: true } },
        },
      ],
    }),
    sessionWorkerOrigin: origin,
  });
  const multiple = resolvePinnedSessionWorkerAuthority({
    policyJson: JSON.stringify({
      defaultSessionSlug: 'alpha',
      sessions: [
        {
          sessionSlug: 'alpha',
          sessionWorkerUrl: origin,
          sessionModeProfile: { surfaces: { agentHttp: true } },
        },
        {
          sessionSlug: 'beta',
          sessionWorkerUrl: origin,
          sessionModeProfile: { surfaces: { agentHttp: true } },
        },
      ],
    }),
    sessionWorkerOrigin: origin,
  });

  assert.deepEqual(valid, {
    ok: true,
    accessEnabled: true,
    sessionSlug: 'alpha',
    sessionWorkerOrigin: origin,
    authorityMode: '',
  });
  assert.equal(multiple.ok, false);
  assert.match(multiple.reason, /exactly one session/);
});

test('resolvePinnedSessionWorkerAuthority keeps disabled dedicated policy pinned without enabling access', () => {
  const disabled = resolvePinnedSessionWorkerAuthority({
    policyJson: JSON.stringify({
      version: 1,
      defaultSessionSlug: 'alpha',
      sessions: [
        {
          sessionSlug: 'alpha',
          sessionWorkerUrl: origin,
          sessionModeProfile: { surfaces: { agentHttp: false } },
        },
      ],
    }),
    sessionWorkerOrigin: origin,
  });

  assert.deepEqual(disabled, {
    ok: true,
    accessEnabled: false,
    sessionSlug: 'alpha',
    sessionWorkerOrigin: origin,
    authorityMode: '',
  });
});

test('verifySessionWorkerMembership accepts production-shaped two-segment Worker HMAC tokens', async () => {
  const calls = [];
  const credential = workerHmacToken({
    sub: address,
    slug: 'alpha',
    scopes: { groups: true },
    exp: 2_000_000_000,
    jti: 'worker-jti-1',
  });
  const result = await verifySessionWorkerMembership({
    authority: { sessionSlug: 'alpha', sessionWorkerOrigin: origin },
    credential,
    now: new Date('2030-01-01T00:00:00.000Z'),
    fetchImpl: async (url, init = {}) => {
      calls.push({ url: String(url), init });
      return new Response(
        JSON.stringify({
          ok: true,
          principal: { kind: 'evm_address', address },
          memberships: [],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.principal.address, address);
  assert.equal(result.workerCredentialExpiresAt, '2033-05-18T03:33:20.000Z');
  assert.deepEqual(
    calls.map((call) => call.url),
    [`${origin}/groups/my-memberships`],
  );
  assert.equal(new Headers(calls[0].init.headers).get('authorization'), `Bearer ${credential}`);
  assert.equal(calls[0].url.includes(credential), false);
});

test('verifySessionWorkerMembership binds the credential and response to the pinned session id', async () => {
  const calls = [];
  const credential = workerHmacToken({
    sub: address,
    slug: 'alpha',
    sessionId,
    scopes: { groups: true },
    exp: 2_000_000_000,
    jti: 'worker-jti-exact',
  });
  const result = await verifySessionWorkerMembership({
    authority: { sessionSlug: 'alpha', sessionId, sessionWorkerOrigin: origin },
    credential,
    now: new Date('2030-01-01T00:00:00.000Z'),
    fetchImpl: async (url) => {
      calls.push(String(url));
      return new Response(
        JSON.stringify({
          ok: true,
          sessionSlug: 'alpha',
          sessionId,
          principal: { kind: 'evm_address', address },
          memberships: [],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.sessionId, sessionId);
  assert.deepEqual(calls, [`${origin}/groups/my-memberships?sessionId=${encodeURIComponent(sessionId)}`]);

  let fetchCalls = 0;
  const stale = await verifySessionWorkerMembership({
    authority: { sessionSlug: 'alpha', sessionId, sessionWorkerOrigin: origin },
    credential: workerHmacToken({
      sub: address,
      slug: 'alpha',
      scopes: { groups: true },
      exp: 2_000_000_000,
      jti: 'worker-jti-missing-id',
    }),
    now: new Date('2030-01-01T00:00:00.000Z'),
    fetchImpl: async () => {
      fetchCalls += 1;
      throw new Error('must not fetch');
    },
  });
  assert.equal(stale.ok, false);
  assert.equal(stale.reason, 'session_worker_credential_session_identity_mismatch');
  assert.equal(fetchCalls, 0);
});

test('verifySessionWorkerMembership retains three-segment credential compatibility', async () => {
  const credential = jwt({
    sub: address,
    slug: 'alpha',
    scopes: { groups: true },
    exp: 2_000_000_000,
    jti: 'legacy-jwt-jti',
  });
  const result = await verifySessionWorkerMembership({
    authority: { sessionSlug: 'alpha', sessionWorkerOrigin: origin },
    credential,
    now: new Date('2030-01-01T00:00:00.000Z'),
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          ok: true,
          principal: { kind: 'evm_address', address },
          memberships: [],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
  });

  assert.equal(result.ok, true);
  assert.equal(result.principal.address, address);
});

test('member credential bindings fail closed across same-slug identity, origin, and authority replacements', () => {
  const credentialRecord = {
    sessionSlug: 'alpha',
    sessionId,
    sessionWorkerOrigin: origin,
    sessionAuthorityMode: 'worker_canonical',
  };
  const authority = {
    accessEnabled: true,
    sessionSlug: 'alpha',
    sessionId,
    sessionWorkerOrigin: origin,
    authorityMode: 'worker_canonical',
  };

  assert.equal(
    validateSessionWorkerMemberCredentialBinding({
      authority,
      credentialRecord,
    }).ok,
    true,
  );

  for (const replacement of [
    { ...authority, sessionId: `0x${'34'.repeat(16)}` },
    { ...authority, sessionWorkerOrigin: 'https://replacement-worker.example' },
  ]) {
    assert.deepEqual(
      validateSessionWorkerMemberCredentialBinding({
        authority: replacement,
        credentialRecord,
      }),
      {
        ok: false,
        status: 401,
        reason: 'agent_member_credential_authority_stale',
      },
    );
  }

  assert.equal(
    validateSessionWorkerMemberCredentialBinding({
      authority: {
        accessEnabled: true,
        sessionSlug: 'alpha',
        sessionWorkerOrigin: origin,
      },
      credentialRecord: {
        sessionSlug: 'alpha',
        sessionWorkerOrigin: origin,
      },
    }).ok,
    true,
  );
});

test('browser credential bindings require the exact Worker authority and retain unbound registry compatibility', () => {
  const credentialRecord = {
    credentialKind: 'browser',
    sessionSlug: 'alpha',
    sessionId,
    sessionWorkerOrigin: origin,
    sessionAuthorityMode: 'worker_canonical',
  };
  const session = {
    sessionSlug: 'alpha',
    sessionIdHex: sessionId,
    sessionWorkerUrl: origin,
    sessionModeProfile: { authority: { mode: 'worker_canonical' } },
  };

  assert.equal(
    validateSessionWorkerBrowserCredentialBinding({
      session,
      credentialRecord,
    }).ok,
    true,
  );

  for (const replacement of [
    { ...session, sessionIdHex: `0x${'34'.repeat(16)}` },
    { ...session, sessionWorkerUrl: 'https://replacement-worker.example' },
    { ...session, sessionIdHex: null },
    { ...session, sessionWorkerUrl: 'http://insecure-worker.example' },
  ]) {
    assert.deepEqual(
      validateSessionWorkerBrowserCredentialBinding({
        session: replacement,
        credentialRecord,
      }),
      {
        ok: false,
        status: 401,
        reason: 'agent_browser_credential_authority_stale',
      },
    );
  }

  assert.equal(
    validateSessionWorkerBrowserCredentialBinding({
      session: {
        sessionSlug: 'alpha',
        sessionModeProfile: { authority: { mode: 'registry_canonical' } },
      },
      credentialRecord: {
        credentialKind: 'browser',
        sessionSlug: 'alpha',
      },
    }).ok,
    true,
  );
  assert.equal(
    validateSessionWorkerBrowserCredentialBinding({
      session: {
        sessionSlug: 'alpha',
        sessionModeProfile: { authority: { mode: 'registry_canonical' } },
      },
      credentialRecord,
    }).ok,
    false,
  );
});

test('verifySessionWorkerMembership fails closed for claim, eligibility, and availability denials', async () => {
  const baseClaims = {
    sub: address,
    slug: 'alpha',
    scopes: { groups: true },
    exp: 2_000_000_000,
    jti: 'worker-jti-1',
  };
  const authority = { sessionSlug: 'alpha', sessionWorkerOrigin: origin };
  const now = new Date('2030-01-01T00:00:00.000Z');
  let fetchCalls = 0;
  const neverFetch = async () => {
    fetchCalls += 1;
    throw new Error('must not fetch');
  };
  for (const [claims, reason] of [
    [{ ...baseClaims, jti: '' }, 'session_worker_credential_invalid'],
    [{ ...baseClaims, slug: 'beta' }, 'session_worker_credential_session_mismatch'],
    [{ ...baseClaims, aud: 'https://caller-selected.example' }, 'session_worker_credential_audience_mismatch'],
    [{ ...baseClaims, exp: 1_800_000_000 }, 'session_worker_credential_expired'],
    [{ ...baseClaims, scopes: { groups: false } }, 'session_worker_credential_ineligible'],
  ]) {
    const result = await verifySessionWorkerMembership({
      authority,
      credential: jwt(claims),
      now,
      fetchImpl: neverFetch,
    });
    assert.equal(result.ok, false);
    assert.equal(result.reason, reason);
  }
  assert.equal(fetchCalls, 0);

  const malformed = await verifySessionWorkerMembership({
    authority,
    credential: 'not-a-jwt',
    now,
    fetchImpl: neverFetch,
  });
  assert.equal(malformed.ok, false);
  assert.equal(malformed.status, 401);
  assert.equal(malformed.reason, 'session_worker_credential_invalid');
  assert.equal(fetchCalls, 0);

  const cases = [
    [401, { ok: false, reason: 'session_worker_credential_revoked' }, 401, 'session_worker_credential_revoked'],
    [403, { ok: false, reason: 'wrong_chain' }, 403, 'session_worker_membership_denied'],
    [503, { ok: false, reason: 'rpc_unavailable' }, 503, 'session_worker_authority_unavailable'],
    [
      200,
      {
        ok: true,
        principal: { kind: 'agent', grantId: 'admin-only' },
        memberships: [],
      },
      403,
      'session_worker_principal_ineligible',
    ],
    [
      200,
      {
        ok: true,
        principal: {
          kind: 'evm_address',
          address: '0x2222222222222222222222222222222222222222',
        },
        memberships: [],
      },
      403,
      'session_worker_principal_mismatch',
    ],
  ];
  for (const [status, body, expectedStatus, expectedReason] of cases) {
    const result = await verifySessionWorkerMembership({
      authority,
      credential: jwt(baseClaims),
      now,
      fetchImpl: async () =>
        new Response(JSON.stringify(body), {
          status,
          headers: { 'content-type': 'application/json' },
        }),
    });
    assert.equal(result.ok, false);
    assert.equal(result.status, expectedStatus);
    assert.equal(result.reason, expectedReason);
  }

  const unavailable = await verifySessionWorkerMembership({
    authority,
    credential: jwt(baseClaims),
    now,
    fetchImpl: async () => {
      throw new Error('network down');
    },
  });
  assert.equal(unavailable.ok, false);
  assert.equal(unavailable.reason, 'session_worker_authority_unavailable');
});
