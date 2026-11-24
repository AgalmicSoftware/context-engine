import assert from 'node:assert/strict';
import test from 'node:test';

import { Wallet } from 'ethers';
import {
  SESSION_ID, SLUG, createSessionEnv, fetchWorker, login, makeRequest,
} from './sessionWorkerRuntimeFixture.mjs';
import { sha256Hex } from '../shared/deployHelperCore.mjs';

// A page's reads arrive together. When the caller of the one reading the
// session's config hangs up, Cloudflare drops that read: it never settles,
// and every request that waited on it failed with a 503 until the isolate
// was recycled. Here the dropped read just stays pending, as it does there.
const ROUTES = [
  '/storage/list?resource=responses&limit=100',
  '/storage/list?resource=questions&limit=100',
  `/groups/my-memberships?sessionSlug=${SLUG}&sessionId=${SESSION_ID}`,
  '/storage/list?resource=responses&limit=100',
  '/storage/list?resource=docsContext&limit=100',
  `/groups/list?sessionSlug=${SLUG}`,
  '/storage/list?resource=questions&limit=100',
  '/storage/list?resource=responses&limit=100',
];
const CANCELLED = 3;
const ROUND_TRIP_MS = 10;
// Longer than the config's one-second copy, so each round reads it again.
const GAP_MS = 1_100;

const within = (ms, work) => {
  let timer;
  const late = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`still waiting after ${ms} ms`)), ms); });
  return Promise.race([work, late]).finally(() => clearTimeout(timer));
};
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const setup = async () => {
  const { env } = createSessionEnv();
  const sessionObject = `memory:${await sha256Hex(`session-config:${SLUG}`)}`;
  let configReads = 0;
  let dropNext = null;
  const get = env.CE_SESSION_COORDINATOR.get;
  env.CE_SESSION_COORDINATOR.get = (id) => {
    const stub = get(id);
    if (id !== sessionObject) return stub;
    return { fetch: async (input, init) => {
      if (new URL(input instanceof Request ? input.url : input).pathname === '/session-config/current') {
        configReads += 1;
        if (dropNext) {
          const seen = dropNext;
          dropNext = null;
          seen();
          return new Promise(() => {});
        }
      }
      await pause(ROUND_TRIP_MS);
      return stub.fetch(input, init);
    } };
  };
  const tokens = [await login({ env, wallet: Wallet.createRandom() }), await login({ env, wallet: Wallet.createRandom() })];
  const send = (paths, token) => Promise.all(paths.map(async (path) => [path, (await fetchWorker(makeRequest(path, { token }), env)).status]));
  // How each route answers with nothing cancelled (this test session has no groups).
  const plain = new Map(await send(ROUTES, tokens[0]));
  // The first three reads go out; the config read the first of them starts
  // is dropped, as its caller hangs up. The rest arrive while it is pending.
  const round = async ({ cancelledToken, keptToken }) => {
    await pause(GAP_MS);
    const dropped = new Promise((resolve) => { dropNext = resolve; });
    send(ROUTES.slice(0, CANCELLED), cancelledToken);
    await dropped;
    const before = configReads;
    const started = Date.now();
    const statuses = await within(2_500, send(ROUTES.slice(CANCELLED), keptToken));
    return { statuses, ms: Date.now() - started, configReads: configReads - before };
  };
  // Then reads with no one hanging up, as when the page is used again.
  const later = async (token) => {
    await pause(GAP_MS);
    const started = Date.now();
    const statuses = await within(1_000, send(ROUTES, token));
    return { statuses, ms: Date.now() - started };
  };
  return { tokens, plain, round, later };
};

const assertAnswered = (statuses, plain) => {
  for (const [path, status] of statuses) assert.equal(status, plain.get(path), path);
};

const cases = [
  ['the same account', ([a]) => ({ cancelledToken: a, keptToken: a })],
  ['another account', ([a, b]) => ({ cancelledToken: a, keptToken: b })],
  ['someone signed out', ([a]) => ({ cancelledToken: '', keptToken: a })],
];

for (const [who, tokensFor] of cases) {
  test(`signed-in reads kept while ${who} cancelled a config read all answer, and later reads are not held up`, async () => {
    const { tokens, plain, round, later } = await setup();
    assert.equal(plain.get(ROUTES[0]), 200);
    const kept = tokensFor(tokens);
    const first = await round(kept);
    assertAnswered(first.statuses, plain);
    // They wait at most about a second for the dropped read, then share one read of their own.
    assert.ok(first.configReads <= 2, `${first.configReads} config reads for the kept requests`);
    const next = await later(kept.keptToken);
    assertAnswered(next.statuses, plain);
    assert.ok(next.ms < 500, `later reads took ${next.ms} ms`);
  });
}
