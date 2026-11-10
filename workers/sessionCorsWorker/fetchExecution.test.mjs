import test from 'node:test';
import assert from 'node:assert/strict';

import {
  fetchContextSnapshotText,
  fetchImage,
  fetchUrl,
} from './fetchExecution.js';
import { createOutboundUrlSafetyHelpersWithWorkerDeps } from './outboundUrlSafetyBinding.js';

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
    body: { error: 'URL must return a web page, JSON or plain text' },
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

const extractHtml = (html) => fetchUrl({
  url: 'https://example.com/page',
  deps: {
    json: createJsonStub(),
    normalizeFetchTargetUrl: () => ({ ok: true, targetUrl: 'https://example.com/page' }),
    safeFetch: async () => new Response(html, { headers: { 'content-type': 'text/html' } }),
  },
});

test('HTML extraction keeps ordinary page text and removes the same hidden elements', async () => {
  const visible = 'The visible page has enough useful content to be returned by the fetch helper.';
  const fixtures = [
    [`<html><head><title>Hidden</title></head><body><h1>Heading</h1><p>${visible}</p></body></html>`, `Heading ${visible}`],
    [`before<SCRIPT>if (1 < 2) { hidden(); }</SCRIPT>after <p>${visible}</p>`, `beforeafter ${visible}`],
    [`<STYLE>body { color: red; }</STYLE><NAV><a>Hidden</a></NAV>${visible}<FOOTER>Hidden</FOOTER>`, visible],
    [`İ <main> ${visible}\n <span>More &amp; text</span></main>`, `İ ${visible} More &amp; text`],
    [`<script>no closing tag<p>${visible}</p>`, `no closing tag ${visible}`],
    // Closing tags a browser also accepts: whitespace or `/` before the `>`, any case.
    [`a<script>hidden()</script >b<STYLE>x {}</STYLE\n>c<nav>Hidden</NAV/>d <p>${visible}</p>`, `abcd ${visible}`],
    [`<script>a()</script ><p>${visible}</p><script>b()</script><p>tail</p>`, `${visible} tail`],
    [`<script>x</scripts>still hidden</script>${visible}`, visible],
  ];
  for (const [html, expected] of fixtures) {
    const response = await extractHtml(html);
    assert.equal(response.status, 200);
    assert.equal(response.body.content, expected);
  }
});

test('unclosed HTML grows linearly with the response size', async (t) => {
  const times = [];
  for (const size of [80, 160, 320]) {
    const html = '<'.repeat(size * 1024);
    const start = performance.now();
    const response = await extractHtml(html);
    times.push(performance.now() - start);
    assert.equal(response.status, 200);
    assert.equal(response.body.content, html);
  }
  t.diagnostic(`80/160/320 KiB extraction: ${times.map((ms) => ms.toFixed(1)).join('/')} ms`);
  assert.ok(times[2] < 750, '320 KiB must finish in well under a second');
  assert.ok(times[2] < times[0] * 6 + 100, 'doubling input must not repeatedly rescan its suffix');
});

for (const contentLength of [null, '1']) {
  for (const contentType of ['image/png', 'text/html', 'application/json']) {
    test(`fetch caps actual ${contentType} bytes with content-length=${contentLength}`, async () => {
      let cancelled = false;
      let pulls = 0;
      const stream = new ReadableStream({
        pull(controller) {
          pulls += 1;
          if (pulls <= 11) controller.enqueue(new Uint8Array(1024 * 1024).fill(32));
          else controller.close();
        },
        cancel() { cancelled = true; },
      }, { highWaterMark: 0 });
      const headers = { 'content-type': contentType };
      if (contentLength) headers['content-length'] = contentLength;
      const execute = contentType.startsWith('image/') ? fetchImage : fetchUrl;
      const result = await execute({
        url: 'https://example.com/data',
        deps: {
          json: createJsonStub(),
          safeFetch: async () => new Response(stream, { headers }),
        },
      });
      assert.equal(result.status, 413);
      assert.equal(cancelled, true);
      assert.equal(pulls, 11);
    });
  }
}

// The Worker's real outbound guard over a scripted network: each URL answers
// once with its scripted response, so tests see every hop the guard makes.
const guardedFetch = (routes) => {
  const calls = [];
  const fetch = async (url, init = {}) => {
    calls.push({ url: String(url), redirect: init.redirect, signal: init.signal });
    const route = routes[String(url)];
    if (!route) throw new Error(`unexpected fetch ${url}`);
    return typeof route === 'function' ? route(init) : route;
  };
  const { safeFetch, isBlockedOutboundUrl } = createOutboundUrlSafetyHelpersWithWorkerDeps({ deps: { fetch } });
  return { calls, deps: { safeFetch, isBlockedOutboundUrl } };
};
const redirect = (location) => new Response(null, { status: 302, headers: { location } });
const page = (body, type = 'text/html; charset=utf-8') => new Response(body, { headers: { 'content-type': type } });

test('link fetches refuse http, credentials, private, loopback and metadata hosts before any request', async () => {
  for (const url of [
    'http://example.org/essay',
    'https://user:[redacted-email]/essay',
    'https://10.0.0.8/notes',
    'https://192.168.1.1/',
    'https://127.0.0.1/admin',
    'https://localhost/',
    'https://[::1]/',
    'https://169.254.169.254/latest/meta-data',
    'https://metadata.google.internal/computeMetadata/v1/',
    'https://intranet/wiki',
    'https://printer.local/status',
    'https://8.8.8.8/',
  ]) {
    const { calls, deps } = guardedFetch({});
    const result = await fetchContextSnapshotText({ url, deps, maxBytes: 1024 });
    assert.equal(result.ok, false, url);
    assert.ok([400, 403].includes(result.status), `${url}: ${result.status}`);
    assert.equal(calls.length, 0, url);
  }
});

test('link fetches check every redirect and stop at the redirect cap', async () => {
  const toLoopback = guardedFetch({
    'https://example.org/start': redirect('https://example.org/next'),
    'https://example.org/next': redirect('https://127.0.0.1/admin'),
  });
  const refused = await fetchContextSnapshotText({ url: 'https://example.org/start', deps: toLoopback.deps, maxBytes: 1024 });
  assert.deepEqual([refused.ok, refused.status, refused.error], [false, 403, 'Redirect to blocked target']);
  assert.deepEqual(toLoopback.calls.map((call) => call.url), ['https://example.org/start', 'https://example.org/next']);
  assert.ok(toLoopback.calls.every((call) => call.redirect === 'manual' && call.signal instanceof AbortSignal));

  const toHttp = guardedFetch({ 'https://example.org/start': redirect('http://example.org/plain') });
  assert.equal((await fetchContextSnapshotText({ url: 'https://example.org/start', deps: toHttp.deps, maxBytes: 1024 })).status, 403);

  const routes = Object.fromEntries(Array.from({ length: 7 }, (_, hop) => [`https://example.org/${hop}`, redirect(`https://example.org/${hop + 1}`)]));
  const looping = guardedFetch(routes);
  const tooMany = await fetchContextSnapshotText({ url: 'https://example.org/0', deps: looping.deps, maxBytes: 1024 });
  assert.deepEqual([tooMany.ok, tooMany.error], [false, 'Too many redirects']);
  assert.equal(looping.calls.length, 6);

  const followed = guardedFetch({
    'https://example.org/old': redirect('/new'),
    'https://example.org/new': page('<html><head><title> The  Essay </title></head><body><p>Kept text.</p></body></html>'),
  });
  const read = await fetchContextSnapshotText({ url: 'https://example.org/old', deps: followed.deps, maxBytes: 1024 });
  assert.deepEqual([read.ok, read.text, read.title], [true, 'Kept text.', 'The Essay']);
});

test('link fetches keep to text types and the size cap, and read plain text and Markdown as sent', async () => {
  const fetchOne = (response, maxBytes = 1024) => {
    const { deps } = guardedFetch({ 'https://example.org/doc': response });
    return fetchContextSnapshotText({ url: 'https://example.org/doc', deps, maxBytes });
  };
  assert.deepEqual(await fetchOne(page('%PDF-1.7', 'application/pdf')), {
    ok: false, status: 400, error: 'URL must return a web page, JSON or plain text',
  });
  assert.equal((await fetchOne(page('x'.repeat(2048), 'text/plain'))).status, 413);
  assert.equal((await fetchOne(new Response('gone', { status: 404, headers: { 'content-type': 'text/html' } }))).error, 'HTTP 404');
  const markdown = await fetchOne(page('# Title\r\n\r\n- one\r\n- two\n', 'text/markdown; charset=utf-8'));
  assert.deepEqual([markdown.ok, markdown.text], [true, '# Title\n\n- one\n- two']);
  assert.equal((await fetchOne(page('Plain notes.', 'text/plain'))).text, 'Plain notes.');
  assert.equal((await fetchOne(page('{"a": [1, 2]}', 'application/json'))).text, '{"a":[1,2]}');
  assert.deepEqual(await fetchOne(page('{"a": ', 'application/json')), {
    ok: false, status: 400, error: 'The link returned JSON that could not be read',
  });
  const latin1 = await fetchOne(new Response(new Uint8Array([0x63, 0x61, 0x66, 0xe9]), {
    headers: { 'content-type': 'text/plain; charset=iso-8859-1' },
  }));
  assert.equal(latin1.text, 'café');
});

test('link fetches give up after the deadline, headers or body', async (t) => {
  // AbortSignal.timeout's timer does not hold Node's event loop open; this one does.
  const keepAlive = setTimeout(() => {}, 5000);
  t.after(() => clearTimeout(keepAlive));
  const hang = (init) => new Promise((_, reject) => {
    init.signal.addEventListener('abort', () => reject(init.signal.reason));
  });
  const { deps } = guardedFetch({ 'https://example.org/slow': hang });
  const started = Date.now();
  const result = await fetchContextSnapshotText({
    url: 'https://example.org/slow', deps: { ...deps, fetchTimeoutMs: 50 }, maxBytes: 1024,
  });
  assert.deepEqual(result, { ok: false, status: 504, error: 'The link took longer than 10 seconds to answer.' });
  assert.ok(Date.now() - started < 2000);

  const slowBody = guardedFetch({
    'https://example.org/drip': (init) => new Response(new ReadableStream({
      pull: () => new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason))),
    }), { headers: { 'content-type': 'text/plain' } }),
  });
  const stalled = await fetchContextSnapshotText({
    url: 'https://example.org/drip', deps: { ...slowBody.deps, fetchTimeoutMs: 50 }, maxBytes: 1024,
  });
  assert.equal(stalled.status, 504);
});

test('fetch_url uses the same guard: an http or private link never reaches the network', async () => {
  for (const url of ['http://example.org/page', 'https://127.0.0.1/page']) {
    const { calls, deps } = guardedFetch({});
    const response = await fetchUrl({ url, deps: { ...deps, json: createJsonStub() } });
    assert.ok([400, 403].includes(response.status), url);
    assert.equal(calls.length, 0);
  }
});
