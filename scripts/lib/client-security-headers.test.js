'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { gunzipSync } = require('node:zlib');
const { readClientSecurityHeaders } = require('./client-security-headers');

const publicDir = path.join(__dirname, '../../client/public');
const directives = (policy) => new Map(policy.split(';').map((entry) => {
  const [name, ...sources] = entry.trim().split(/\s+/);
  return [name, sources];
}));

test('the actual static headers enforce script and wallet worker restrictions', () => {
  const headers = readClientSecurityHeaders();
  const policy = directives(headers['content-security-policy']);
  assert.equal(policy.get('script-src')[0], "'self'");
  assert.ok(policy.get('script-src').slice(1).every((source) => /^'sha256-[a-zA-Z0-9+/]{43}='$/.test(source)));
  assert.deepEqual(policy.get('worker-src'), ["'self'", 'blob:']);
  assert.deepEqual(policy.get('frame-ancestors'), ["'none'"]);
  assert.deepEqual(policy.get('object-src'), ["'none'"]);
  assert.deepEqual(policy.get('base-uri'), ["'self'"]);
  assert.deepEqual(policy.get('form-action'), ["'self'"]);
  assert.equal(policy.has('connect-src'), false);
  assert.ok(directives(headers['content-security-policy-report-only']).has('connect-src'));
});

test('the only inline script exceptions match the published sandboxed benchmark scripts', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(publicDir, 'benchmark-artifacts/manifest.json'), 'utf8'));
  const hashes = new Set();
  for (const report of manifest.reports) {
    const bytes = fs.readFileSync(path.join(publicDir, 'benchmark-artifacts', report.artifact));
    const html = (report.compression === 'gzip' ? gunzipSync(bytes) : bytes).toString('utf8');
    for (const [, attrs, script] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
      if (/type=["']application\/(?:ld\+)?json["']/i.test(attrs)) continue;
      assert.ok(!/\bsrc\s*=/i.test(attrs), 'Benchmark scripts must be inline with reviewed exact hashes');
      hashes.add(`'sha256-${createHash('sha256').update(script).digest('base64')}'`);
    }
    assert.ok(!/\son(?:click|load|error|change|input)\s*=/i.test(html), 'Inline event handlers are not permitted');
  }
  assert.ok(hashes.size > 0);
  const headers = readClientSecurityHeaders();
  for (const key of ['content-security-policy', 'content-security-policy-report-only']) {
    assert.deepEqual(directives(headers[key]).get('script-src'), ["'self'", ...hashes]);
  }
});

test('the app entry contains no executable inline scripts', () => {
  const html = fs.readFileSync(path.join(publicDir, '../index.html'), 'utf8');
  for (const [, attrs, script] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
    if (/type=["']application\/ld\+json["']/i.test(attrs)) continue;
    assert.match(attrs, /\bsrc=/);
    assert.equal(script.trim(), '');
  }
});
