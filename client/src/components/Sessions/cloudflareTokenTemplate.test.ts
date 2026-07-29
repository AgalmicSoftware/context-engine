import {
  buildTokenName,
  buildCloudflareTokenTemplateUrl,
  buildCloudflareTokenTemplatePermissions,
  CLOUDFLARE_TOKEN_SETUP_GUIDE_URL,
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
    expect(buildCloudflareTokenTemplatePermissions()).toEqual([
      { key: 'workers_scripts', type: 'edit' },
      { key: 'workers_kv_storage', type: 'edit' },
    ]);
  });

  test('points legacy token guidance at the canonical worker documentation', () => {
    expect(CLOUDFLARE_TOKEN_SETUP_GUIDE_URL).toBe(
      'https://github.com/AgalmicSoftware/context-engine/blob/main/docs/session-cors-worker.md#api-token-setup-and-handling',
    );
  });

  test('adds only R2 when an advanced deployment explicitly opts into R2 storage', () => {
    const url = new URL(
      buildCloudflareTokenTemplateUrl({
        slug: 'alpha-session',
        includeR2Storage: true,
      }),
    );
    const permissions = JSON.parse(url.searchParams.get('permissionGroupKeys') || '[]');

    expect(permissions).toEqual([
      { key: 'workers_scripts', type: 'edit' },
      { key: 'workers_kv_storage', type: 'edit' },
      { key: 'workers_durable_objects', type: 'edit' },
    ]);
    expect(buildCloudflareTokenTemplatePermissions({ includeR2Storage: true })).toEqual(permissions);
    expect(url.searchParams.get('accountId')).toBe('*');
  });

  test('does not request unrelated Cloudflare product scopes by default', () => {
    const permissionKeys = buildCloudflareTokenTemplatePermissions().map((permission) => permission.key);

    expect(permissionKeys).not.toEqual(
      expect.arrayContaining([
        { key: 'workers_r2', type: 'edit' },
        { key: 'd1', type: 'edit' },
      ]),
    );
  });

  test('buildCloudflareTokenTemplateUrl falls back to the general slug when none is provided', () => {
    const url = new URL(buildCloudflareTokenTemplateUrl());

    expect(url.searchParams.get('name')).toMatch(
      /^contextEngine-corsSessionWorker-general-[A-Z]{3}\d{2}-\d{4}-\d{4}(AM|PM)$/,
    );
  });

  test.each([70, 71, 128])(
    'keeps a %i-character valid session slug within Cloudflare token-name limits',
    (slugLength) => {
      const slug = 'a'.repeat(slugLength);
      const tokenName = buildTokenName(slug);

      expect(tokenName).toHaveLength(120);
      if (slugLength === 70) {
        expect(tokenName).toContain(`-${slug}-`);
      } else {
        expect(tokenName).not.toContain(slug);
        expect(tokenName).toMatch(/^contextEngine-corsSessionWorker-a{61}-[0-9a-f]{8}-/);
      }
    },
  );

  test('retains a distinguishing hash when long slugs share the same visible prefix', () => {
    const commonPrefix = 'a'.repeat(71);

    expect(buildTokenName(`${commonPrefix}x`)).not.toBe(buildTokenName(`${commonPrefix}y`));
  });
});
