import {
  buildCloudflareTokenTemplateUrl,
  buildCloudflareTokenTemplatePermissions,
  CLOUDFLARE_TOKEN_TEMPLATE_RESOURCE_HINTS,
  CLOUDFLARE_TOKEN_TEMPLATE_PERMISSIONS,
  CLOUDFLARE_WORKERS_DEV_SUBDOMAIN_PERMISSION,
} from './cloudflareTokenTemplate.js';

describe('cloudflareTokenTemplate', () => {
  test('buildCloudflareTokenTemplateUrl only requests the deploy-helper scopes it uses', () => {
    const url = new URL(buildCloudflareTokenTemplateUrl({
      slug: 'alpha-session',
    }));

    expect(url.origin).toBe('https://dash.cloudflare.com');
    expect(url.pathname).toBe('/profile/api-tokens');
    expect(url.searchParams.get('accountId')).toBe('*');
    expect(url.searchParams.get('zoneId')).toBe('all');
    expect(url.searchParams.get('name')).toMatch(
      /^contextEngine-corsSessionWorker-alpha-session-[A-Z]{3}\d{2}-\d{4}-\d{4}(AM|PM)$/
    );
    expect(JSON.parse(url.searchParams.get('permissionGroupKeys') || '[]')).toEqual([
      { key: 'workers_scripts', type: 'edit' },
      { key: 'workers_kv_storage', type: 'edit' },
      { key: 'workers_r2_storage', type: 'edit' },
      { key: 'd1', type: 'edit' },
      { key: 'workers_durable_objects', type: 'edit' },
      { key: 'account_settings', type: 'edit' },
    ]);
    expect(CLOUDFLARE_TOKEN_TEMPLATE_PERMISSIONS).toHaveLength(6);
  });

  test('buildCloudflareTokenTemplateUrl falls back to the general slug when none is provided', () => {
    const url = new URL(buildCloudflareTokenTemplateUrl());

    expect(url.searchParams.get('name')).toMatch(
      /^contextEngine-corsSessionWorker-general-[A-Z]{3}\d{2}-\d{4}-\d{4}(AM|PM)$/
    );
  });
});
