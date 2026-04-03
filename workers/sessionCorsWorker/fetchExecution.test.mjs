import test from 'node:test';
import assert from 'node:assert/strict';

import {
  fetchImage,
  fetchUrl,
} from './fetchExecution.js';

const createJsonStub = () => (body, status, headers) => ({ body, status, headers });

test('fetchImage preserves normalized-target failure passthrough before upstream fetch', async () => {
  let fetchCalled = false;

  const result = await fetchImage({
    url: 'not-a-url',
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    deps: {
      json: createJsonStub(),
      normalizeFetchTargetUrl: () => ({
        ok: false,
        status: 400,
        error: 'Invalid URL',
      }),
      safeFetch: async () => {
        fetchCalled = true;
        return new Response();
      },
    },
  });

  assert.equal(fetchCalled, false);
  assert.deepEqual(result, {
    body: { error: 'Invalid URL' },
    status: 400,
    headers: { 'Access-Control-Allow-Origin': '*' },
  });
});

test('fetchImage preserves safeFetch non-Response passthrough', async () => {
  const result = await fetchImage({
    url: 'https://example.com/image.png',
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    deps: {
      json: createJsonStub(),
      normalizeFetchTargetUrl: () => ({
        ok: true,
        status: 200,
        error: '',
        targetUrl: 'https://example.com/image.png',
      }),
      safeFetch: async () => ({ error: 'Redirect to blocked target', status: 403 }),
    },
  });

  assert.deepEqual(result, {
    body: { error: 'Redirect to blocked target' },
    status: 403,
    headers: { 'Access-Control-Allow-Origin': '*' },
  });
});

test('fetchImage preserves content-length and content-type validation plus success response headers', async () => {
  const baseHeaders = { 'Access-Control-Allow-Origin': 'https://allowed.example' };

  const tooLarge = await fetchImage({
    url: 'https://example.com/large.png',
    baseHeaders,
    deps: {
      json: createJsonStub(),
      normalizeFetchTargetUrl: () => ({
        ok: true,
        targetUrl: 'https://example.com/large.png',
      }),
      safeFetch: async () => new Response('x', {
        status: 200,
        headers: {
          'content-length': `${10 * 1024 * 1024 + 1}`,
          'content-type': 'image/png',
        },
      }),
    },
  });

  const wrongType = await fetchImage({
    url: 'https://example.com/file.txt',
    baseHeaders,
    deps: {
      json: createJsonStub(),
      normalizeFetchTargetUrl: () => ({
        ok: true,
        targetUrl: 'https://example.com/file.txt',
      }),
      safeFetch: async () => new Response('text', {
        status: 200,
        headers: {
          'content-type': 'text/plain',
        },
      }),
    },
  });

  const success = await fetchImage({
    url: 'https://example.com/image.png',
    baseHeaders,
    deps: {
      json: createJsonStub(),
      normalizeFetchTargetUrl: () => ({
        ok: true,
        targetUrl: 'https://example.com/image.png',
      }),
      safeFetch: async () => new Response('png-bytes', {
        status: 200,
        headers: {
          'content-type': 'image/png',
        },
      }),
    },
  });

  assert.deepEqual(tooLarge, {
    body: { error: 'Response too large' },
    status: 413,
    headers: baseHeaders,
  });
  assert.deepEqual(wrongType, {
    body: { error: 'URL must return an image' },
    status: 400,
    headers: baseHeaders,
  });
  assert.equal(success.status, 200);
  assert.equal(success.headers.get('Access-Control-Allow-Origin'), 'https://allowed.example');
  assert.equal(success.headers.get('Content-Type'), 'image/png');
  assert.equal(await success.text(), 'png-bytes');
});

test('fetchUrl preserves upstream status/type validation and json success normalization', async () => {
  const baseHeaders = { 'Access-Control-Allow-Origin': '*' };

  const statusFailure = await fetchUrl({
    url: 'https://example.com/missing',
    baseHeaders,
    deps: {
      json: createJsonStub(),
      normalizeFetchTargetUrl: () => ({
        ok: true,
        targetUrl: 'https://example.com/missing',
      }),
      safeFetch: async () => new Response('nope', {
        status: 404,
        headers: {
          'content-type': 'text/html',
        },
      }),
    },
  });

  const typeFailure = await fetchUrl({
    url: 'https://example.com/file.png',
    baseHeaders,
    deps: {
      json: createJsonStub(),
      normalizeFetchTargetUrl: () => ({
        ok: true,
        targetUrl: 'https://example.com/file.png',
      }),
      safeFetch: async () => new Response('png-bytes', {
        status: 200,
        headers: {
          'content-type': 'image/png',
        },
      }),
    },
  });

  const jsonSuccess = await fetchUrl({
    url: 'https://example.com/data.json',
    baseHeaders,
    deps: {
      json: createJsonStub(),
      normalizeFetchTargetUrl: () => ({
        ok: true,
        targetUrl: 'https://example.com/data.json',
      }),
      safeFetch: async () => new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          'content-type': 'application/json; charset=utf-8',
        },
      }),
    },
  });

  assert.deepEqual(statusFailure, {
    body: { error: 'HTTP 404' },
    status: 400,
    headers: baseHeaders,
  });
  assert.deepEqual(typeFailure, {
    body: { error: 'URL must return HTML or JSON' },
    status: 400,
    headers: baseHeaders,
  });
  assert.deepEqual(jsonSuccess, {
    body: {
      content: '{"ok":true}',
      status: 'success',
      contentType: 'application/json; charset=utf-8',
    },
    status: 200,
    headers: baseHeaders,
  });
});

test('fetchUrl preserves html stripping success and insufficient-content failure', async () => {
  const baseHeaders = { 'Access-Control-Allow-Origin': 'https://allowed.example' };

  const htmlSuccess = await fetchUrl({
    url: 'https://example.com/page',
    baseHeaders,
    deps: {
      json: createJsonStub(),
      normalizeFetchTargetUrl: () => ({
        ok: true,
        targetUrl: 'https://example.com/page',
      }),
      safeFetch: async () => new Response(
        '<html><head><title>Hidden</title></head><body><nav>Skip</nav><main><h1>Hello</h1><p>This page includes enough visible content to survive the stripping pass for worker fetch helper tests.</p></main><footer>Skip</footer></body></html>',
        {
          status: 200,
          headers: {
            'content-type': 'text/html; charset=utf-8',
          },
        }
      ),
    },
  });

  const htmlTooShort = await fetchUrl({
    url: 'https://example.com/tiny',
    baseHeaders,
    deps: {
      json: createJsonStub(),
      normalizeFetchTargetUrl: () => ({
        ok: true,
        targetUrl: 'https://example.com/tiny',
      }),
      safeFetch: async () => new Response('<html><body><p>tiny</p></body></html>', {
        status: 200,
        headers: {
          'content-type': 'text/html',
        },
      }),
    },
  });

  assert.deepEqual(htmlSuccess, {
    body: {
      content: 'Hello This page includes enough visible content to survive the stripping pass for worker fetch helper tests.',
      status: 'success',
      contentType: 'text/html; charset=utf-8',
    },
    status: 200,
    headers: baseHeaders,
  });
  assert.deepEqual(htmlTooShort, {
    body: { error: 'Insufficient content extracted' },
    status: 400,
    headers: baseHeaders,
  });
});
