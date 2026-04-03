import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveExistingSessionCors } from './existingSessionCorsResolution.js';

test('resolveExistingSessionCors normalizes the slug and returns base headers when config is missing', async () => {
  const calls = [];
  const baseHeaders = { 'Access-Control-Allow-Origin': '*' };

  const result = await resolveExistingSessionCors({
    request: { headers: new Headers() },
    env: { GROUP_KV: {} },
    slug: 'General',
    baseHeaders,
    deps: {
      normalizeWorkerSessionSlug: (value) => {
        calls.push(['normalize', value]);
        return 'general';
      },
      getSessionConfig: async (env, slug) => {
        calls.push(['getSessionConfig', env, slug]);
        return null;
      },
      getCorsContext: async () => {
        calls.push(['getCorsContext']);
        return { ok: true, headers: { nope: 'unused' } };
      },
    },
  });

  assert.deepEqual(result, {
    ok: true,
    headers: baseHeaders,
    config: null,
  });
  assert.deepEqual(calls, [
    ['normalize', 'General'],
    ['getSessionConfig', { GROUP_KV: {} }, 'general'],
  ]);
});

test('resolveExistingSessionCors returns config plus CORS headers when the request origin is allowed', async () => {
  const config = { allowOrigins: ['https://allowed.example'] };
  const corsHeaders = { 'Access-Control-Allow-Origin': 'https://allowed.example' };

  const result = await resolveExistingSessionCors({
    request: { headers: new Headers({ Origin: 'https://allowed.example' }) },
    env: { GROUP_KV: {} },
    slug: 'session-a',
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    deps: {
      normalizeWorkerSessionSlug: (value) => value,
      getSessionConfig: async () => config,
      getCorsContext: async ({ request, config: passedConfig }) => {
        assert.equal(request.headers.get('Origin'), 'https://allowed.example');
        assert.equal(passedConfig, config);
        return { ok: true, headers: corsHeaders };
      },
    },
  });

  assert.deepEqual(result, {
    ok: true,
    headers: corsHeaders,
    config,
  });
});

test('resolveExistingSessionCors preserves CORS rejection response and existing config', async () => {
  const config = { allowOrigins: ['https://allowed.example'] };
  const blockedResponse = new Response(JSON.stringify({ error: 'Origin not allowed.' }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  });

  const result = await resolveExistingSessionCors({
    request: { headers: new Headers({ Origin: 'https://blocked.example' }) },
    env: { GROUP_KV: {} },
    slug: 'session-a',
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    deps: {
      normalizeWorkerSessionSlug: (value) => value,
      getSessionConfig: async () => config,
      getCorsContext: async () => ({
        ok: false,
        response: blockedResponse,
        headers: { 'Access-Control-Allow-Origin': null },
      }),
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.response, blockedResponse);
  assert.equal(result.config, config);
});

test('resolveExistingSessionCors allows trusted admin origins through explicit admin nonce requests even when the session allowlist blocks them', async () => {
  const config = { allowOrigins: ['https://allowed.example'] };
  const blockedResponse = new Response(JSON.stringify({ error: 'Origin not allowed.' }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  });

  const result = await resolveExistingSessionCors({
    request: new Request('https://worker.example/auth/nonce', {
      method: 'POST',
      headers: { Origin: 'http://localhost:3000' },
    }),
    env: { GROUP_KV: {} },
    slug: 'session-a',
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    allowTrustedAdminAuthOrigin: true,
    deps: {
      normalizeWorkerSessionSlug: (value) => value,
      getSessionConfig: async () => config,
      getCorsContext: async () => ({
        ok: false,
        response: blockedResponse,
        headers: { 'Access-Control-Allow-Origin': null },
      }),
      resolveTrustedAdminOrigins: () => ['http://localhost:3000'],
      corsHeaders: (origin, allowList) => {
        assert.equal(origin, 'http://localhost:3000');
        assert.deepEqual(allowList, ['http://localhost:3000']);
        return new Headers({ 'Access-Control-Allow-Origin': origin });
      },
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.config, config);
  assert.equal(result.headers.get('Access-Control-Allow-Origin'), 'http://localhost:3000');
});

test('resolveExistingSessionCors keeps auth nonce requests blocked without explicit admin nonce intent', async () => {
  const config = { allowOrigins: ['https://allowed.example'] };
  const blockedResponse = new Response(JSON.stringify({ error: 'Origin not allowed.' }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  });

  const result = await resolveExistingSessionCors({
    request: new Request('https://worker.example/auth/nonce', {
      method: 'POST',
      headers: { Origin: 'http://localhost:3000' },
    }),
    env: { GROUP_KV: {} },
    slug: 'session-a',
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    deps: {
      normalizeWorkerSessionSlug: (value) => value,
      getSessionConfig: async () => config,
      getCorsContext: async () => ({
        ok: false,
        response: blockedResponse,
        headers: { 'Access-Control-Allow-Origin': null },
      }),
      resolveTrustedAdminOrigins: () => ['http://localhost:3000'],
      corsHeaders: () => new Headers({ 'Access-Control-Allow-Origin': 'http://localhost:3000' }),
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.response, blockedResponse);
  assert.equal(result.config, config);
});

test('resolveExistingSessionCors allows trusted admin origins through admin routes even when the session allowlist blocks them', async () => {
  const config = { allowOrigins: ['https://allowed.example'] };
  const blockedResponse = new Response(JSON.stringify({ error: 'Origin not allowed.' }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  });

  const result = await resolveExistingSessionCors({
    request: new Request('https://worker.example/admin/set-config', {
      method: 'POST',
      headers: { Origin: 'http://localhost:3000' },
    }),
    env: { GROUP_KV: {} },
    slug: 'session-a',
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    deps: {
      normalizeWorkerSessionSlug: (value) => value,
      getSessionConfig: async () => config,
      getCorsContext: async () => ({
        ok: false,
        response: blockedResponse,
        headers: { 'Access-Control-Allow-Origin': null },
      }),
      resolveTrustedAdminOrigins: () => ['http://localhost:3000'],
      corsHeaders: (origin, allowList) => {
        assert.equal(origin, 'http://localhost:3000');
        assert.deepEqual(allowList, ['http://localhost:3000']);
        return new Headers({ 'Access-Control-Allow-Origin': origin });
      },
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.config, config);
  assert.equal(result.headers.get('Access-Control-Allow-Origin'), 'http://localhost:3000');
});
