import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVICE_WORKER_PATH = resolve(__dirname, '..', 'contextEngine-cc', 'public', 'sw.js');
const SERVICE_WORKER_SOURCE = readFileSync(SERVICE_WORKER_PATH, 'utf8');
const SERVICE_WORKER_ORIGIN = 'http://localhost:7391';

const toCacheKey = (request) => {
  if (typeof request === 'string') {
    return new URL(request, SERVICE_WORKER_ORIGIN).toString();
  }
  return request?.url;
};

const buildServiceWorkerHarness = ({ fetchImpl = async () => new Response('ok') } = {}) => {
  const listeners = new Map();
  const cachedResponses = new Map();

  const cacheApi = {
    addAll: async (entries) => {
      for (const entry of entries) {
        const key = toCacheKey(entry);
        cachedResponses.set(key, new Response(`precache:${key}`, { status: 200 }));
      }
    },
    put: async (request, response) => {
      cachedResponses.set(request.url, response);
    },
  };

  const context = vm.createContext({
    URL,
    Request,
    Response,
    Promise,
    caches: {
      open: async () => cacheApi,
      match: async (request) => cachedResponses.get(toCacheKey(request)),
      keys: async () => [],
      delete: async () => true,
    },
    fetch: fetchImpl,
    self: {
      location: new URL(SERVICE_WORKER_ORIGIN),
      skipWaiting: () => {},
      clients: {
        claim: () => {},
      },
      addEventListener: (type, handler) => {
        listeners.set(type, handler);
      },
    },
  });

  vm.runInContext(SERVICE_WORKER_SOURCE, context, { filename: SERVICE_WORKER_PATH });

  return {
    cachedResponses,
    async dispatchInstall() {
      const handler = listeners.get('install');
      assert.equal(typeof handler, 'function');
      await new Promise((resolveInstall, rejectInstall) => {
        handler({
          waitUntil(promise) {
            Promise.resolve(promise).then(resolveInstall, rejectInstall);
          },
        });
      });
    },
    async dispatchFetch(request) {
      const handler = listeners.get('fetch');
      assert.equal(typeof handler, 'function');
      let responsePromise = null;
      handler({
        request,
        respondWith(promise) {
          responsePromise = Promise.resolve(promise);
        },
      });
      assert.ok(responsePromise, 'service worker did not handle request');
      return responsePromise;
    },
  };
};

test('service worker uses network-first for cacheable assets and refreshes the cache on success', async () => {
  let fetchCalls = 0;
  const harness = buildServiceWorkerHarness({
    fetchImpl: async () => new Response(`body-${++fetchCalls}`, { status: 200 }),
  });
  const request = new Request('http://localhost:7391/styles.css');

  const firstResponse = await harness.dispatchFetch(request);
  assert.equal(await firstResponse.text(), 'body-1');

  const secondResponse = await harness.dispatchFetch(request);
  assert.equal(await secondResponse.text(), 'body-2');
  assert.equal(fetchCalls, 2);

  const cached = harness.cachedResponses.get(request.url);
  assert.ok(cached);
  assert.equal(await cached.text(), 'body-2');
});

test('service worker does not cache non-OK asset responses', async () => {
  const harness = buildServiceWorkerHarness({
    fetchImpl: async () => new Response('temporary error', { status: 503 }),
  });
  const request = new Request('http://localhost:7391/js/main.mjs');

  const response = await harness.dispatchFetch(request);
  assert.equal(response.status, 503);
  assert.equal(harness.cachedResponses.has(request.url), false);
});

test('service worker falls back to cached assets when the network fails', async () => {
  const harness = buildServiceWorkerHarness({
    fetchImpl: async () => {
      throw new Error('network down');
    },
  });
  const request = new Request('http://localhost:7391/styles.css');
  harness.cachedResponses.set(request.url, new Response('cached-body', { status: 200 }));

  const response = await harness.dispatchFetch(request);
  assert.equal(await response.text(), 'cached-body');
});

test('service worker falls back to the cached shell for offline navigation requests', async () => {
  const harness = buildServiceWorkerHarness({
    fetchImpl: async () => {
      throw new Error('network down');
    },
  });
  await harness.dispatchInstall();

  const navigationRequest = {
    url: 'http://localhost:7391/questions',
    method: 'GET',
    mode: 'navigate',
  };

  const response = await harness.dispatchFetch(navigationRequest);
  assert.equal(await response.text(), 'precache:http://localhost:7391/index.html');
});
