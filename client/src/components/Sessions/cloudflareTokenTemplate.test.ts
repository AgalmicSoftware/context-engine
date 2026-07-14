import {
  buildTokenName,
  buildCloudflareTokenTemplateUrl,
  buildCloudflareTokenTemplatePermissions,
  CLOUDFLARE_TOKEN_TEMPLATE_RESOURCE_HINTS,
  CLOUDFLARE_TOKEN_TEMPLATE_PERMISSIONS,
  CLOUDFLARE_WORKERS_DEV_SUBDOMAIN_PERMISSION,
} from './cloudflareTokenTemplate.js';

describe('cloudflareTokenTemplate', () => {
  test('buildCloudflareTokenTemplateUrl only requests the deploy-helper scopes it uses', () => {
    const url = new URL(
      buildCloudflareTokenTemplateUrl({
        slug: 'alpha-session',
      }),
    );

    expect(url.origin).toBe('https://dash.cloudflare.com');
    expect(url.pathname).toBe('/profile/api-tokens');
    expect(url.searchParams.get('accountId')).toBe('*');
    expect(url.searchParams.get('zoneId')).toBe('all');
    expect(url.searchParams.get('name')).toMatch(
      /^contextEngine-corsSessionWorker-alpha-session-[A-Z]{3}\d{2}-\d{4}-\d{4}(AM|PM)$/,
    );
    expect(JSON.parse(url.searchParams.get('permissionGroupKeys') || '[]')).toEqual([
      { key: 'workers_scripts', type: 'edit' },
      { key: 'workers_kv_storage', type: 'edit' },
      { key: 'workers_r2', type: 'edit' },
      { key: 'd1', type: 'edit' },
      { key: 'workers_durable_objects', type: 'edit' },
    ]);
    expect(CLOUDFLARE_TOKEN_TEMPLATE_PERMISSIONS).toHaveLength(5);
  });

  test('can omit R2/D1 scopes for the default Telegram smoke deploy', () => {
    const permissions = buildCloudflareTokenTemplatePermissions({ includeDocStorage: false });

    expect(permissions).toEqual([
      { key: 'workers_scripts', type: 'edit' },
      { key: 'workers_kv_storage', type: 'edit' },
      { key: 'workers_durable_objects', type: 'edit' },
    ]);
    expect(permissions).not.toEqual(
      expect.arrayContaining([
        { key: 'workers_r2', type: 'edit' },
        { key: 'd1', type: 'edit' },
      ]),
    );
  });

  test('adds Account Settings only for workers.dev subdomain setup', () => {
    const url = new URL(
      buildCloudflareTokenTemplateUrl({
        slug: 'alpha-session',
        includeWorkersDevSubdomainSetup: true,
      }),
    );

    expect(JSON.parse(url.searchParams.get('permissionGroupKeys') || '[]')).toEqual([
      { key: 'workers_scripts', type: 'edit' },
      { key: 'workers_kv_storage', type: 'edit' },
      { key: 'workers_r2', type: 'edit' },
      { key: 'd1', type: 'edit' },
      { key: 'workers_durable_objects', type: 'edit' },
      { key: 'account_settings', type: 'edit' },
    ]);
    expect(CLOUDFLARE_WORKERS_DEV_SUBDOMAIN_PERMISSION).toEqual({ key: 'account_settings', type: 'edit' });
    expect(buildCloudflareTokenTemplatePermissions()).toEqual(CLOUDFLARE_TOKEN_TEMPLATE_PERMISSIONS);
  });

  test('does not request legacy broad Cloudflare product scopes', () => {
    const permissionKeys = CLOUDFLARE_TOKEN_TEMPLATE_PERMISSIONS.map((permission) => permission.key);

    expect(permissionKeys).not.toEqual(
      expect.arrayContaining(['pages', 'builds', 'agents', 'observability', 'containers', 'tail']),
    );
  });

  test('documents least-privilege storage resource responsibilities', () => {
    expect(CLOUDFLARE_TOKEN_TEMPLATE_RESOURCE_HINTS.r2).toMatch(/questions, surveys, and responses/);
    expect(CLOUDFLARE_TOKEN_TEMPLATE_RESOURCE_HINTS.d1).toMatch(/metadata and index/);
    expect(CLOUDFLARE_TOKEN_TEMPLATE_RESOURCE_HINTS.kv).toMatch(/metadata indexes/);
    expect(CLOUDFLARE_TOKEN_TEMPLATE_RESOURCE_HINTS.durableObjects).toMatch(/not ordinary payload blob storage/);
    expect(CLOUDFLARE_TOKEN_TEMPLATE_RESOURCE_HINTS.accountSettings).toMatch(/workers\.dev subdomain/);
  });

  test('buildCloudflareTokenTemplateUrl falls back to the general slug when none is provided', () => {
    const url = new URL(buildCloudflareTokenTemplateUrl());

    expect(url.searchParams.get('name')).toMatch(
      /^contextEngine-corsSessionWorker-general-[A-Z]{3}\d{2}-\d{4}-\d{4}(AM|PM)$/,
    );
  });

  test.each([70, 71, 128])('keeps a %i-character valid session slug within Cloudflare token-name limits', (slugLength) => {
    const slug = 'a'.repeat(slugLength);
    const tokenName = buildTokenName(slug);

    expect(tokenName).toHaveLength(120);
    if (slugLength === 70) {
      expect(tokenName).toContain(`-${slug}-`);
    } else {
      expect(tokenName).not.toContain(slug);
      expect(tokenName).toMatch(/^contextEngine-corsSessionWorker-a{61}-[0-9a-f]{8}-/);
    }
  });

  test('retains a distinguishing hash when long slugs share the same visible prefix', () => {
    const commonPrefix = 'a'.repeat(71);

    expect(buildTokenName(`${commonPrefix}x`)).not.toBe(buildTokenName(`${commonPrefix}y`));
  });
});
