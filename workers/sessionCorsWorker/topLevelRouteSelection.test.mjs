import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveTopLevelRouteSelection } from './topLevelRouteSelection.js';

const createRequest = (headers = {}) => ({
  headers: new Headers(headers),
});

const createRequestWithHeaderValue = (value) => ({
  headers: {
    get: (name) => (name.toLowerCase() === 'authorization' ? value : null),
  },
});

test('resolveTopLevelRouteSelection preserves options, auth, and admin route classification', () => {
  assert.deepEqual(
    resolveTopLevelRouteSelection({
      path: '/auth/nonce',
      method: 'POST',
      request: createRequest(),
      deps: { toStr: String },
    }),
    { kind: 'auth-nonce' }
  );

  assert.deepEqual(
    resolveTopLevelRouteSelection({
      path: '/auth/login',
      method: 'POST',
      request: createRequest(),
      deps: { toStr: String },
    }),
    { kind: 'auth-login' }
  );

  assert.deepEqual(
    resolveTopLevelRouteSelection({
      path: '/admin/ set-config ',
      method: 'POST',
      request: createRequest(),
      deps: { toStr: String },
    }),
    { kind: 'admin', action: 'set-config' }
  );

  assert.deepEqual(
    resolveTopLevelRouteSelection({
      path: '/admin/abuse-summary',
      method: 'GET',
      request: createRequest({ Authorization: 'Bearer token' }),
      deps: { toStr: String },
    }),
    { kind: 'admin-abuse-summary' }
  );

  assert.deepEqual(
    resolveTopLevelRouteSelection({
      path: '/health',
      method: 'OPTIONS',
      request: createRequest(),
      deps: { toStr: String },
    }),
    { kind: 'options' }
  );
});

test('resolveTopLevelRouteSelection exposes the per-session interview brief without authentication', () => {
  assert.deepEqual(
    resolveTopLevelRouteSelection({
      path: '/agent/interview-brief',
      method: 'GET',
      request: createRequest(),
      deps: { toStr: String },
    }),
    { kind: 'interview-brief' },
  );
  assert.deepEqual(
    resolveTopLevelRouteSelection({
      path: '/agent/interview-catalog',
      method: 'GET',
      request: createRequest(),
      deps: { toStr: String },
    }),
    { kind: 'interview-brief' },
  );
});

test('resolveTopLevelRouteSelection classifies realtime SDP exchange as anonymous AI work', () => {
  assert.deepEqual(
    resolveTopLevelRouteSelection({
      path: '/realtime/call',
      method: 'POST',
      request: createRequest(),
      deps: { toStr: String },
    }),
    { kind: 'anonymous', anonymousRoute: 'realtime' },
  );
});

test('resolveTopLevelRouteSelection preserves raw authorization-header truthiness for arweave upload handoff', () => {
  assert.deepEqual(
    resolveTopLevelRouteSelection({
      path: '/arweave/upload',
      method: 'POST',
      request: createRequest(),
      deps: { toStr: String },
    }),
    { kind: 'arweave-upload', hasAuthorizationHeader: false }
  );

  assert.deepEqual(
    resolveTopLevelRouteSelection({
      path: '/arweave/upload',
      method: 'POST',
      request: createRequestWithHeaderValue('   '),
      deps: { toStr: String },
    }),
    { kind: 'arweave-upload', hasAuthorizationHeader: true }
  );
});

test('resolveTopLevelRouteSelection classifies sponsored bootstrap redeem routes before auth/admin handling', () => {
  assert.deepEqual(
    resolveTopLevelRouteSelection({
      path: '/sponsored/redeem-deploy',
      method: 'POST',
      request: createRequest(),
      deps: { toStr: String },
    }),
    { kind: 'sponsored-bootstrap-redeem', action: 'deploy' }
  );

  assert.deepEqual(
    resolveTopLevelRouteSelection({
      path: '/sponsored/redeem-faucet',
      method: 'POST',
      request: createRequest({ Authorization: 'Bearer token' }),
      deps: { toStr: String },
    }),
    { kind: 'sponsored-bootstrap-redeem', action: 'faucet' }
  );
});

test('resolveTopLevelRouteSelection exposes the resource-presence route without wallet auth', () => {
  assert.deepEqual(
    resolveTopLevelRouteSelection({
      path: '/resource-presence',
      method: 'GET',
      request: { headers: { get: () => '' } },
      deps: { toStr: (value) => String(value || '') },
    }),
    { kind: 'resource-presence' },
  );
});

test('resolveTopLevelRouteSelection exposes worker-canonical config bootstrap without wallet auth', () => {
  assert.deepEqual(
    resolveTopLevelRouteSelection({
      path: '/session-config',
      method: 'GET',
      request: createRequest(),
      deps: { toStr: String },
    }),
    { kind: 'session-config' },
  );
});

test('resolveTopLevelRouteSelection preserves trimmed authorization behavior for anonymous ai/transcribe classification', () => {
  assert.deepEqual(
    resolveTopLevelRouteSelection({
      path: '/ai',
      method: 'POST',
      request: createRequest(),
      deps: { toStr: String },
    }),
    { kind: 'anonymous', anonymousRoute: 'ai' }
  );

  assert.deepEqual(
    resolveTopLevelRouteSelection({
      path: '/transcribe',
      method: 'POST',
      request: createRequestWithHeaderValue('   '),
      deps: { toStr: String },
    }),
    { kind: 'anonymous', anonymousRoute: 'transcribe' }
  );

  assert.deepEqual(
    resolveTopLevelRouteSelection({
      path: '/ai',
      method: 'POST',
      request: createRequest({ Authorization: 'Bearer token' }),
      deps: { toStr: String },
    }),
    { kind: 'authenticated' }
  );
});

test('resolveTopLevelRouteSelection lets storage reads try anonymous public-read first', () => {
  assert.deepEqual(
    resolveTopLevelRouteSelection({
      path: '/storage/read',
      method: 'GET',
      request: createRequest(),
      deps: { toStr: String },
    }),
    { kind: 'anonymous', anonymousRoute: 'storage' }
  );

  assert.deepEqual(
    resolveTopLevelRouteSelection({
      path: '/storage/list',
      method: 'POST',
      request: createRequestWithHeaderValue('   '),
      deps: { toStr: String },
    }),
    { kind: 'anonymous', anonymousRoute: 'storage' }
  );

  assert.deepEqual(
    resolveTopLevelRouteSelection({
      path: '/storage/read',
      method: 'GET',
      request: createRequest({ Authorization: 'Bearer token' }),
      deps: { toStr: String },
    }),
    { kind: 'authenticated' }
  );
});

test('resolveTopLevelRouteSelection lets unsigned group discovery try the anonymous policy gate', () => {
  assert.deepEqual(
    resolveTopLevelRouteSelection({
      path: '/groups/list',
      method: 'GET',
      request: createRequest(),
      deps: { toStr: String },
    }),
    { kind: 'anonymous', anonymousRoute: 'groups' }
  );

  assert.deepEqual(
    resolveTopLevelRouteSelection({
      path: '/groups/list',
      method: 'GET',
      request: createRequest({ Authorization: 'Bearer token' }),
      deps: { toStr: String },
    }),
    { kind: 'authenticated' }
  );

  assert.deepEqual(
    resolveTopLevelRouteSelection({
      path: '/groups/list',
      method: 'POST',
      request: createRequest(),
      deps: { toStr: String },
    }),
    { kind: 'authenticated' }
  );
});
