import { toStr } from '../../utilities/shared/primitives.js';

type CloudflareTokenPermission = {
  key: string;
  type: string;
};

export const CLOUDFLARE_TOKEN_TEMPLATE_BASE_PERMISSIONS = Object.freeze([
  { key: 'workers_scripts', type: 'edit' },
  { key: 'workers_kv_storage', type: 'edit' },
]);

export const CLOUDFLARE_TOKEN_TEMPLATE_R2_PERMISSIONS = Object.freeze([{ key: 'workers_r2', type: 'edit' }]);

export const CLOUDFLARE_TOKEN_TEMPLATE_PERMISSIONS = CLOUDFLARE_TOKEN_TEMPLATE_BASE_PERMISSIONS;

export const CLOUDFLARE_TOKEN_TEMPLATE_RESOURCE_HINTS = Object.freeze({
  kv: 'canonical config, encrypted payload envelopes and indexes, groups, audit rows, and deploy state',
  r2: 'optional existing R2 bucket for advanced deployments that explicitly enable R2 payload storage',
});

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'] as const;

const formatTokenTimestamp = (date: Date = new Date()): string => {
  const dd = String(date.getDate()).padStart(2, '0');
  const mon = MONTHS[date.getMonth()] || 'UNK';
  const yyyy = date.getFullYear();
  const hours = date.getHours();
  const meridiem = hours >= 12 ? 'PM' : 'AM';
  const hh = String(hours % 12 || 12).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${mon}${dd}-${yyyy}-${hh}${mm}${meridiem}`;
};

const buildTokenName = (slug?: unknown): string => {
  const safeSlug = toStr(slug).trim() || 'general';
  return `contextEngine-corsSessionWorker-${safeSlug}-${formatTokenTimestamp()}`;
};

export const buildCloudflareTokenTemplatePermissions = ({
  includeR2Storage = false,
}: {
  includeR2Storage?: boolean;
} = {}) => {
  const permissions: CloudflareTokenPermission[] = [...CLOUDFLARE_TOKEN_TEMPLATE_BASE_PERMISSIONS];
  if (includeR2Storage === true) {
    permissions.push(...CLOUDFLARE_TOKEN_TEMPLATE_R2_PERMISSIONS);
  }
  return permissions;
};

export const buildCloudflareTokenTemplateUrl = ({
  accountId,
  slug,
  includeR2Storage = false,
}: {
  accountId?: unknown;
  slug?: unknown;
  includeR2Storage?: boolean;
} = {}): string => {
  const params = new URLSearchParams();
  params.set(
    'permissionGroupKeys',
    JSON.stringify(
      buildCloudflareTokenTemplatePermissions({
        includeR2Storage,
      }),
    ),
  );
  params.set('accountId', toStr(accountId).trim() || '*');
  params.set('zoneId', 'all');
  params.set('name', buildTokenName(slug));
  return `https://dash.cloudflare.com/profile/api-tokens?${params.toString()}`;
};
