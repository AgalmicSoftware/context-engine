import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeAuthenticatedActionPayload,
  readAuthenticatedActionPayload,
} from './authenticatedActionRequestNormalization.js';

test('normalizeAuthenticatedActionPayload trims and lowercases action while preserving payload', () => {
  const payload = {
    action: ' Fetch_URL ',
    url: 'https://example.com',
  };

  assert.deepEqual(normalizeAuthenticatedActionPayload({ payload }), {
    ok: true,
    status: 200,
    error: '',
    payload,
    action: 'fetch_url',
  });

  assert.deepEqual(normalizeAuthenticatedActionPayload({ payload: { action: 123 } }), {
    ok: true,
    status: 200,
    error: '',
    payload: { action: 123 },
    action: '123',
  });
});

test('readAuthenticatedActionPayload preserves application/json and invalid JSON failures', async () => {
  const wrongContentType = new Request('https://worker.example/', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: 'ping',
  });
  assert.deepEqual(
    await readAuthenticatedActionPayload({ request: wrongContentType }),
    {
      ok: false,
      status: 400,
      error: 'Expected application/json.',
      payload: null,
      action: '',
    }
  );

  const badJson = new Request('https://worker.example/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{bad-json',
  });
  assert.deepEqual(
    await readAuthenticatedActionPayload({ request: badJson }),
    {
      ok: false,
      status: 400,
      error: 'Invalid JSON.',
      payload: null,
      action: '',
    }
  );
});
