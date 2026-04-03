import test from 'node:test';
import assert from 'node:assert/strict';

import { corsHeaders, originAllowed, parseAllowOrigins } from './corsPrimitives.js';

test('parseAllowOrigins preserves normalized deduped allowlists and returns null when empty', () => {
  assert.deepEqual(
    parseAllowOrigins(' https://allowed.example,\nhttps://other.example, https://allowed.example '),
    ['https://allowed.example', 'https://other.example']
  );
  assert.equal(parseAllowOrigins(' \n , '), null);
});

test('originAllowed preserves null-allowlist and missing-origin allowance', () => {
  assert.equal(originAllowed('https://allowed.example', null), true);
  assert.equal(originAllowed('', ['https://allowed.example']), true);
  assert.equal(originAllowed('https://allowed.example', ['https://allowed.example']), true);
  assert.equal(originAllowed('https://blocked.example', ['https://allowed.example']), false);
});

test('corsHeaders reflects origin without an allowlist but omits ACAO when no origin is present', () => {
  const withOrigin = corsHeaders('https://allowed.example', null);
  const withoutOrigin = corsHeaders('', null);

  assert.equal(withOrigin.get('Access-Control-Allow-Origin'), 'https://allowed.example');
  assert.equal(withOrigin.get('Access-Control-Allow-Methods'), 'GET, POST, OPTIONS');
  assert.equal(withOrigin.get('Access-Control-Allow-Headers'), 'Content-Type, Authorization, X-Session-Slug, X-Group-Slug, X-Anonymous-Client-Id');
  assert.equal(withOrigin.get('Vary'), 'Origin');
  assert.equal(withoutOrigin.get('Access-Control-Allow-Origin'), null);
});

test('corsHeaders only reflects allowed origins when an allowlist is present', () => {
  const allowed = corsHeaders('https://allowed.example', ['https://allowed.example']);
  const blocked = corsHeaders('https://blocked.example', ['https://allowed.example']);

  assert.equal(allowed.get('Access-Control-Allow-Origin'), 'https://allowed.example');
  assert.equal(blocked.get('Access-Control-Allow-Origin'), null);
});
