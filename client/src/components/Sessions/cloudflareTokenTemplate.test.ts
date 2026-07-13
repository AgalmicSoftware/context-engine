import {
  buildCloudflareTokenTemplateUrl,
  buildCloudflareTokenTemplatePermissions,
  CLOUDFLARE_TOKEN_TEMPLATE_RESOURCE_HINTS,
  CLOUDFLARE_TOKEN_TEMPLATE_PERMISSIONS,
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
    ]);
    expect(CLOUDFLARE_TOKEN_TEMPLATE_PERMISSIONS).toHaveLength(2);
    expect(buildCloudflareTokenTemplatePermissions()).toEqual(CLOUDFLARE_TOKEN_TEMPLATE_PERMISSIONS);
  });

  test('adds only R2 when an advanced deployment explicitly opts into R2 storage', () => {
    const url = new URL(
      buildCloudflareTokenTemplateUrl({
        accountId: 'cf-account-1',
        slug: 'alpha-session',
        includeR2Storage: true,
      }),
    );
    const permissions = JSON.parse(url.searchParams.get('permissionGroupKeys') || '[]');

    expect(permissions).toEqual([
      { key: 'workers_scripts', type: 'edit' },
      { key: 'workers_kv_storage', type: 'edit' },
      { key: 'workers_r2', type: 'edit' },
    ]);
    expect(buildCloudflareTokenTemplatePermissions({ includeR2Storage: true })).toEqual(permissions);
    expect(url.searchParams.get('accountId')).toBe('cf-account-1');
  });

  test('does not request unrelated Cloudflare product scopes by default', () => {
    const permissionKeys = CLOUDFLARE_TOKEN_TEMPLATE_PERMISSIONS.map((permission) => permission.key);

    expect(permissionKeys).not.toEqual(
      expect.arrayContaining([
        'workers_r2',
        'd1',
        'workers_durable_objects',
        'account_settings',
        'pages',
        'builds',
        'agents',
        'observability',
        'containers',
        'tail',
      ]),
    );
  });

  test('documents least-privilege storage resource responsibilities', () => {
    expect(CLOUDFLARE_TOKEN_TEMPLATE_RESOURCE_HINTS.kv).toMatch(/canonical config/);
    expect(CLOUDFLARE_TOKEN_TEMPLATE_RESOURCE_HINTS.r2).toMatch(/optional existing R2 bucket/);
  });

  test('buildCloudflareTokenTemplateUrl falls back to the general slug when none is provided', () => {
    const url = new URL(buildCloudflareTokenTemplateUrl());

    expect(url.searchParams.get('name')).toMatch(
      /^contextEngine-corsSessionWorker-general-[A-Z]{3}\d{2}-\d{4}-\d{4}(AM|PM)$/,
    );
  });
});
