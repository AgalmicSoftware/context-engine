'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  CLOUDFLARE_TOKEN_TEMPLATE_RESOURCE_HINTS,
  CLOUDFLARE_TOKEN_TEMPLATE_PERMISSIONS,
  CLOUDFLARE_WORKERS_DEV_SUBDOMAIN_PERMISSION,
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
    { key: 'workers_r2_storage', type: 'edit' },
    { key: 'd1', type: 'edit' },
    { key: 'workers_durable_objects', type: 'edit' },
    { key: 'account_settings', type: 'edit' },
  ]);
  assert.equal(CLOUDFLARE_TOKEN_TEMPLATE_PERMISSIONS.length, 6);
});

test('buildCloudflareTokenTemplateUrl does not request legacy broad Cloudflare product scopes', () => {
  const permissionKeys = CLOUDFLARE_TOKEN_TEMPLATE_PERMISSIONS.map((permission) => permission.key);

  assert.equal(permissionKeys.includes('pages'), false);
  assert.equal(permissionKeys.includes('builds'), false);
  assert.equal(permissionKeys.includes('agents'), false);
  assert.equal(permissionKeys.includes('observability'), false);
  assert.equal(permissionKeys.includes('containers'), false);
  assert.equal(permissionKeys.includes('tail'), false);
});

test('Cloudflare token helper documents storage resource boundaries', () => {
  assert.match(CLOUDFLARE_TOKEN_TEMPLATE_RESOURCE_HINTS.r2, /questions, surveys, and responses/);
  assert.match(CLOUDFLARE_TOKEN_TEMPLATE_RESOURCE_HINTS.d1, /metadata and index/);
  assert.match(CLOUDFLARE_TOKEN_TEMPLATE_RESOURCE_HINTS.kv, /metadata indexes/);
  assert.match(CLOUDFLARE_TOKEN_TEMPLATE_RESOURCE_HINTS.durableObjects, /not ordinary payload blob storage/);
});

test('buildCloudflareTokenTemplateUrl falls back to the general slug when none is provided', () => {
  const url = new URL(buildCloudflareTokenTemplateUrl());

  assert.match(
    url.searchParams.get('name'),
    /^contextEngine-corsSessionWorker-general-[A-Z]{3}\d{2}-\d{4}-\d{4}(AM|PM)$/
  );
});

test('parseArgs accepts the workers.dev setup scope flag', () => {
  assert.deepEqual(parseArgs([
    '--slug', 'alpha',
    '--include-workers-dev-subdomain-setup',
    '--no-doc-storage',
  ]), {
    slug: 'alpha',
    'include-workers-dev-subdomain-setup': true,
    'no-doc-storage': true,
  });
});
