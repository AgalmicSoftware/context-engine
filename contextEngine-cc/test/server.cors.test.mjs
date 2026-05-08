import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { corsHeaders } from '../server.mjs';

describe('server CORS hardening', () => {
  it('reflects loopback origins for local browser requests', () => {
    const headers = corsHeaders({
      headers: {
        origin: 'http://localhost:7391',
      },
    });

    assert.equal(headers['Access-Control-Allow-Origin'], 'http://localhost:7391');
    assert.equal(headers['Access-Control-Allow-Methods'], 'GET, POST, OPTIONS');
  });

  it('does not allow non-loopback origins', () => {
    const headers = corsHeaders({
      headers: {
        origin: 'https://evil.example',
      },
    });

    assert.equal(Object.prototype.hasOwnProperty.call(headers, 'Access-Control-Allow-Origin'), false);
  });
});
