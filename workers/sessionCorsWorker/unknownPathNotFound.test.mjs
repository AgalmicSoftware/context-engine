import assert from 'node:assert/strict';
import test from 'node:test';

import { readFile } from 'node:fs/promises';
import { Wallet } from 'ethers';
import { NON_POST_PATHS } from './authenticatedRouteEntry.js';
import { SESSION_AGENT_PATHS } from './sessionAgentRoute.js';
import { isAgentPath } from './agent/routes.mjs';
import { createSessionEnv, fetchWorker, login, makeRequest, readJson } from './sessionWorkerRuntimeFixture.mjs';

// A path that is no route answers 404 whether or not the caller signed in, so
// `/mcp` or `/sse` no longer look like an endpoint behind a sign-in.
const ROUTES_OTHER_THAN_POST = [
  '/health', '/ai', '/lit/chipotle-action',
  '/storage/read', '/storage/list', '/storage/export-envelopes',
  '/groups/my-memberships', '/groups/members', '/groups/list',
  '/session-agent/status', '/session-agent/ask', '/session-agent/opt-out',
];

test('a path that is no route answers 404, signed in or not', async () => {
  const { env } = createSessionEnv();
  const token = await login({ env, wallet: Wallet.createRandom() });
  for (const path of ['/mcp', '/sse', '/no-such-route']) {
    for (const method of ['GET', 'DELETE']) {
      const signedOut = await readJson(await fetchWorker(makeRequest(path, { method }), env));
      const signedIn = await readJson(await fetchWorker(makeRequest(path, { method, token }), env));
      assert.deepEqual(signedOut, { status: 404, body: { error: 'Not found.' } }, `${method} ${path}`);
      assert.deepEqual(signedIn, signedOut, `${method} ${path}`);
    }
  }
});

test('every route other than a POST is still routed', async () => {
  const { env } = createSessionEnv();
  const token = await login({ env, wallet: Wallet.createRandom() });
  for (const path of ROUTES_OTHER_THAN_POST) {
    const response = await readJson(await fetchWorker(makeRequest(path, { token }), env));
    assert.notDeepEqual(response, { status: 404, body: { error: 'Not found.' } }, path);
  }
});

test('a POST to any path still asks for a sign-in, since its body may name the action', async () => {
  const { env } = createSessionEnv();
  const response = await readJson(await fetchWorker(makeRequest('/mcp', { method: 'POST', body: { action: 'fetch_url' } }), env));
  assert.equal(response.status, 401);
});

test('every path the signed-in dispatch serves other than by POST is in the 404 check\'s list', async () => {
  // A route added to a dispatcher but not to the list would answer 404 unseen.
  for (const file of ['authenticatedSecretPathRouteDispatch.js', 'authenticatedSecretActionRouteDispatch.js', 'authenticatedRouteEntry.js']) {
    for (const line of (await readFile(new URL(file, import.meta.url), 'utf8')).split('\n')) {
      // Route conditions name a method, or define an is…Route/Action flag.
      if (!line.includes('method ===') && !/const is\w+ = /.test(line)) continue;
      const postOnly = line.includes("method === 'POST'") && !line.includes("method === 'GET'");
      for (const [, path] of line.matchAll(/path === '([^']+)'/g)) {
        // Agent paths are routed before sign-in reaches this check.
        if (!postOnly && !isAgentPath(path)) assert.ok(NON_POST_PATHS.has(path), `${file}: ${path}`);
      }
      if (/[A-Z_]+\.includes\(path\)/.test(line) && !postOnly) assert.match(line, /SESSION_AGENT_PATHS\.includes\(path\)/, `${file}: ${line.trim()}`);
    }
  }
  for (const path of SESSION_AGENT_PATHS) assert.ok(NON_POST_PATHS.has(path), path);
});
