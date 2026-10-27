import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';

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


// These helpers return plain objects, verified at their definitions. Allow only
// calls in these files; a similarly named variable can still be a Headers object.
const plainHeaderHelpers = new Map([
  ['agentBridgeWorker/onChainResponses.mjs', ['jsonHeaders']],
]);
const unsafeHeaderCopy = (source, path = '') => {
  for (const name of plainHeaderHelpers.get(path) || []) {
    source = source.replace(new RegExp(`\\b${name}(?=\\s*\\()`, 'g'), 'plainHeaderObject');
  }
  return /\.\.\.\s*\(*\s*(?:[\w$]+(?:\?\.|\.))*(?:[\w$]*Headers|headers)\b/.test(source) ||
    /Object\.assign\s*\([^,;]+,[^;]*(?:\b[\w$]*Headers|\bheaders)\b/.test(source) ||
    /\b(?:[\w$]*Headers|headers)\s*[:=]\s*Object\.assign\s*\([^,;]+,/.test(source);
};

test('header copy guard covers arbitrary header names and Object.assign', () => {
  for (const source of [
    '({ ...headers })', '({ ...routeBaseHeaders })', '({ ...customResponseHeaders })',
    '({ ...context.headers })', '({ ...corsHeaders(origin) })',
    'Object.assign({}, headers)', 'Object.assign({}, plain, context.routeBaseHeaders)',
    'Object.assign( {},\n getExtras(),\n responseHeaders)',
    'const headers = Object.assign({}, value)',
    '({ ...(init.headers || {}) })', '({ ...init?.headers })',
    '({ ...(context?.request?.headers ?? {}) })',
    'Object.assign(target, xHeaders)', 'Object.assign(target, plain, init?.headers)',
  ]) assert.equal(unsafeHeaderCopy(source), true, source);
  const plainCall = '({ ...jsonHeaders(origin) })';
  assert.equal(unsafeHeaderCopy(plainCall), true);
  assert.equal(unsafeHeaderCopy(plainCall, 'agentBridgeWorker/onChainResponses.mjs'), false);
  assert.equal(unsafeHeaderCopy('({ ...jsonHeaders })', 'agentBridgeWorker/onChainResponses.mjs'), true);
  assert.equal(unsafeHeaderCopy('new Headers(routeBaseHeaders)'), false);
});

test('Worker source never spreads or Object.assigns Headers objects', async () => {
  const root = new URL('../', import.meta.url);
  const visit = async (dir) => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules') continue;
      const path = new URL(entry.name + (entry.isDirectory() ? '/' : ''), dir);
      if (entry.isDirectory()) await visit(path);
      else if (/\.[cm]?js$/.test(entry.name) && !entry.name.includes('.test.')) {
        assert.equal(unsafeHeaderCopy(await readFile(path, 'utf8'), path.pathname.slice(root.pathname.length)), false, path.pathname);
      }
    }
  };
  await visit(root);
});
