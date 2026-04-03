import test from 'node:test';
import assert from 'node:assert/strict';

import { getCorsContext } from './corsContextResolution.js';

test('getCorsContext passes normalized allowlist data through on allowed origins', () => {
  const calls = [];
  const headers = new Headers({ 'Access-Control-Allow-Origin': 'https://allowed.example' });

  const result = getCorsContext({
    request: {
      headers: new Headers({ Origin: 'https://allowed.example' }),
    },
    config: {
      allowOrigins: ' https://allowed.example,\nhttps://other.example ',
    },
    deps: {
      parseAllowOrigins: (value) => {
        calls.push(['parseAllowOrigins', value]);
        return ['https://allowed.example', 'https://other.example'];
      },
      corsHeaders: (origin, allowList) => {
        calls.push(['corsHeaders', origin, allowList]);
        return headers;
      },
      originAllowed: (origin, allowList) => {
        calls.push(['originAllowed', origin, allowList]);
        return true;
      },
      json: () => {
        calls.push(['json']);
        return null;
      },
    },
  });

  assert.deepEqual(result, {
    ok: true,
    headers,
  });
  assert.deepEqual(calls, [
    ['parseAllowOrigins', ' https://allowed.example,\nhttps://other.example '],
    ['corsHeaders', 'https://allowed.example', ['https://allowed.example', 'https://other.example']],
    ['originAllowed', 'https://allowed.example', ['https://allowed.example', 'https://other.example']],
  ]);
});

test('getCorsContext preserves blocked-origin failure response and headers', () => {
  const headers = new Headers();
  headers.set('Vary', 'Origin');
  const response = new Response(JSON.stringify({ error: 'Origin not allowed.' }), {
    status: 403,
    headers,
  });

  const result = getCorsContext({
    request: {
      headers: new Headers({ Origin: 'https://blocked.example' }),
    },
    config: {
      allowOrigins: ['https://allowed.example'],
    },
    deps: {
      parseAllowOrigins: (value) => value,
      corsHeaders: () => headers,
      originAllowed: () => false,
      json: () => response,
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.response, response);
  assert.equal(result.headers, headers);
});

test('getCorsContext preserves null allowlist behavior for missing config', () => {
  let receivedAllowList = 'unset';

  const result = getCorsContext({
    request: {
      headers: new Headers(),
    },
    config: null,
    deps: {
      parseAllowOrigins: (value) => {
        assert.equal(value, undefined);
        return null;
      },
      corsHeaders: (_origin, allowList) => {
        receivedAllowList = allowList;
        return new Headers();
      },
      originAllowed: (_origin, allowList) => allowList == null,
      json: () => new Response('nope'),
    },
  });

  assert.equal(result.ok, true);
  assert.equal(receivedAllowList, null);
});
