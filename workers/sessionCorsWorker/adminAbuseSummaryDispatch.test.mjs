import test from 'node:test';
import assert from 'node:assert/strict';

import { dispatchAdminAbuseSummaryRequest } from './adminAbuseSummaryDispatch.js';

const createJsonStub = () => (body, status, headers) => ({ body, status, headers });

test('dispatchAdminAbuseSummaryRequest requires authenticated admin access', async () => {
  let summaryCalled = false;
  const response = new Response(JSON.stringify({ error: 'Missing Authorization header.' }), {
    status: 401,
  });

  const result = await dispatchAdminAbuseSummaryRequest({
    request: new Request('https://worker.example/admin/abuse-summary?sessionSlug=session-a'),
    env: {},
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    slug: '',
    deps: {
      requireAuth: async () => ({ ok: false, response }),
      readAbuseCounterSummary: async () => {
        summaryCalled = true;
      },
    },
  });

  assert.equal(summaryCalled, false);
  assert.equal(result, response);
});

test('dispatchAdminAbuseSummaryRequest rejects non-admin authenticated users and records an auth failure', async () => {
  const events = [];
  const result = await dispatchAdminAbuseSummaryRequest({
    request: new Request('https://worker.example/admin/abuse-summary', {
      headers: { Origin: 'https://allowed.example' },
    }),
    env: { CE_ABUSE_COUNTERS_KV: {} },
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    slug: 'session-a',
    deps: {
      json: createJsonStub(),
      requireAuth: async () => ({
        ok: true,
        slug: 'session-a',
        payload: { sub: '0xabc' },
      }),
      getSessionConfig: async () => ({ adminAddress: '0xdef' }),
      getCorsContext: async () => ({
        ok: true,
        headers: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
      }),
      validateAdmin: async () => false,
      recordAbuseEvent: async (event) => {
        events.push(event);
        return { ok: true };
      },
    },
  });

  assert.deepEqual(result, {
    body: { error: 'Admin authorization failed.' },
    status: 403,
    headers: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
  });
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'auth_failures');
  assert.equal(events[0].env.CE_ABUSE_COUNTERS_KV != null, true);
});

test('dispatchAdminAbuseSummaryRequest returns aggregate abuse counters', async () => {
  const result = await dispatchAdminAbuseSummaryRequest({
    request: new Request('https://worker.example/admin/abuse-summary?windows=2'),
    env: {},
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    slug: 'session-a',
    deps: {
      json: createJsonStub(),
      requireAuth: async () => ({
        ok: true,
        slug: 'session-a',
        payload: { sub: '0xabc' },
      }),
      getSessionConfig: async () => ({ adminAddress: '0xabc' }),
      getCorsContext: async () => ({
        ok: true,
        headers: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
      }),
      validateAdmin: async () => true,
      readAbuseCounterSummary: async (value) => ({
        ok: true,
        requestedWindows: value.windows,
        windows: [],
      }),
    },
  });

  assert.deepEqual(result, {
    body: {
      ok: true,
      requestedWindows: 2,
      windows: [],
    },
    status: 200,
    headers: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
  });
});
