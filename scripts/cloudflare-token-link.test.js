'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  CLOUDFLARE_TOKEN_TEMPLATE_RESOURCE_HINTS,
  CLOUDFLARE_TOKEN_TEMPLATE_PERMISSIONS,
  buildTokenName,
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

test('buildCloudflareTokenTemplateUrl falls back to the general slug when none is provided', () => {
  const url = new URL(buildCloudflareTokenTemplateUrl());

  assert.match(
    url.searchParams.get('name'),
    /^contextEngine-corsSessionWorker-general-[A-Z]{3}\d{2}-\d{4}-\d{4}(AM|PM)$/
  );
});

for (const slugLength of [70, 71, 128]) {
  test(`buildTokenName keeps a ${slugLength}-character valid session slug within Cloudflare limits`, () => {
    const slug = 'a'.repeat(slugLength);
    const tokenName = buildTokenName(slug);

    assert.equal(tokenName.length, 120);
    if (slugLength === 70) {
      assert.equal(tokenName.includes(`-${slug}-`), true);
    } else {
      assert.equal(tokenName.includes(slug), false);
      assert.match(tokenName, /^contextEngine-corsSessionWorker-a{61}-[0-9a-f]{8}-/);
    }
  });
}

test('buildTokenName retains a distinguishing hash for long slugs with the same visible prefix', () => {
  const commonPrefix = 'a'.repeat(71);

  assert.notEqual(buildTokenName(`${commonPrefix}x`), buildTokenName(`${commonPrefix}y`));
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
