'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  CLOUDFLARE_TOKEN_TEMPLATE_RESOURCE_HINTS,
  CLOUDFLARE_TOKEN_TEMPLATE_PERMISSIONS,
  buildCloudflareTokenTemplatePermissions,
  buildCloudflareTokenTemplateUrl,
  parseArgs,
} = require('./cloudflare-token-link.js');

test('buildCloudflareTokenTemplateUrl only requests the deploy-helper scopes it uses', () => {
  const url = new URL(buildCloudflareTokenTemplateUrl({
    slug: 'alpha-session',
  }));

  assert.equal(url.origin, 'https://dash.cloudflare.com');
  assert.equal(url.pathname, '/profile/api-tokens');
  assert.equal(url.searchParams.get('accountId'), '*');
  assert.equal(url.searchParams.get('zoneId'), 'all');
  assert.match(
    url.searchParams.get('name'),
    /^contextEngine-corsSessionWorker-alpha-session-[A-Z]{3}\d{2}-\d{4}-\d{4}(AM|PM)$/
  );
  assert.deepEqual(JSON.parse(url.searchParams.get('permissionGroupKeys')), [
    { key: 'workers_scripts', type: 'edit' },
    { key: 'workers_kv_storage', type: 'edit' },
  ]);
  assert.equal(CLOUDFLARE_TOKEN_TEMPLATE_PERMISSIONS.length, 2);
  assert.deepEqual(buildCloudflareTokenTemplatePermissions(), CLOUDFLARE_TOKEN_TEMPLATE_PERMISSIONS);
});

test('buildCloudflareTokenTemplateUrl adds only R2 for an explicit advanced R2 deployment', () => {
  const url = new URL(buildCloudflareTokenTemplateUrl({
    accountId: 'cf-account-1',
    slug: 'alpha-session',
    includeR2Storage: true,
  }));

  assert.deepEqual(JSON.parse(url.searchParams.get('permissionGroupKeys')), [
    { key: 'workers_scripts', type: 'edit' },
    { key: 'workers_kv_storage', type: 'edit' },
    { key: 'workers_r2', type: 'edit' },
  ]);
  assert.deepEqual(buildCloudflareTokenTemplatePermissions({ includeR2Storage: true }), JSON.parse(url.searchParams.get('permissionGroupKeys')));
  assert.equal(url.searchParams.get('accountId'), 'cf-account-1');
});

test('buildCloudflareTokenTemplateUrl does not request unrelated Cloudflare product scopes by default', () => {
  const permissionKeys = CLOUDFLARE_TOKEN_TEMPLATE_PERMISSIONS.map((permission) => permission.key);

  assert.equal(permissionKeys.includes('workers_r2'), false);
  assert.equal(permissionKeys.includes('d1'), false);
  assert.equal(permissionKeys.includes('workers_durable_objects'), false);
  assert.equal(permissionKeys.includes('account_settings'), false);
  assert.equal(permissionKeys.includes('pages'), false);
  assert.equal(permissionKeys.includes('builds'), false);
  assert.equal(permissionKeys.includes('agents'), false);
  assert.equal(permissionKeys.includes('observability'), false);
  assert.equal(permissionKeys.includes('containers'), false);
  assert.equal(permissionKeys.includes('tail'), false);
});

test('Cloudflare token helper documents storage resource boundaries', () => {
  assert.match(CLOUDFLARE_TOKEN_TEMPLATE_RESOURCE_HINTS.kv, /canonical config/);
  assert.match(CLOUDFLARE_TOKEN_TEMPLATE_RESOURCE_HINTS.r2, /optional existing R2 bucket/);
});

test('buildCloudflareTokenTemplateUrl falls back to the general slug when none is provided', () => {
  const url = new URL(buildCloudflareTokenTemplateUrl());

  assert.match(
    url.searchParams.get('name'),
    /^contextEngine-corsSessionWorker-general-[A-Z]{3}\d{2}-\d{4}-\d{4}(AM|PM)$/
  );
});

test('parseArgs accepts the explicit R2 storage scope flag', () => {
  assert.deepEqual(parseArgs([
    '--slug', 'alpha',
    '--include-r2-storage',
  ]), {
    slug: 'alpha',
    'include-r2-storage': true,
  });
});
