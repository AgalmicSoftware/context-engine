import test from 'node:test';
import assert from 'node:assert/strict';

import { getRouteBaseHeaders } from './routeBaseHeaders.js';

test('getRouteBaseHeaders reflects the request origin through the default CORS shell', () => {
  const calls = [];
  const headers = new Headers({ 'Access-Control-Allow-Origin': 'https://allowed.example' });

  const result = getRouteBaseHeaders({
    request: {
      headers: new Headers({ Origin: 'https://allowed.example' }),
    },
    deps: {
      corsHeaders: (origin, allowList) => {
        calls.push([origin, allowList]);
        return headers;
      },
    },
  });

  assert.equal(result, headers);
  assert.deepEqual(calls, [['https://allowed.example', null]]);
});

test('getRouteBaseHeaders preserves the null-origin default shell when Origin is missing', () => {
  const calls = [];
  const headers = new Headers();

  const result = getRouteBaseHeaders({
    request: {
      headers: new Headers(),
    },
    deps: {
      corsHeaders: (origin, allowList) => {
        calls.push([origin, allowList]);
        return headers;
      },
    },
  });

  assert.equal(result, headers);
  assert.deepEqual(calls, [[null, null]]);
});
