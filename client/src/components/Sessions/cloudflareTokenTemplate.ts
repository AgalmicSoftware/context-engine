import { toStr } from '../../utilities/shared/primitives.js';

type CloudflareTokenPermission = {
  key: string;
  type: string;
};

export const CLOUDFLARE_TOKEN_TEMPLATE_PERMISSIONS = Object.freeze([
  { key: 'workers_scripts', type: 'edit' },
  { key: 'workers_kv_storage', type: 'edit' },
  { key: 'workers_r2_storage', type: 'edit' },
  { key: 'd1', type: 'edit' },
  { key: 'workers_durable_objects', type: 'edit' },
]);

export const CLOUDFLARE_WORKERS_DEV_SUBDOMAIN_PERMISSION = Object.freeze({ key: 'account_settings', type: 'edit' });

export const CLOUDFLARE_TOKEN_TEMPLATE_RESOURCE_HINTS = Object.freeze({
  r2: 'CE payload blobs for session context, docs, media, questions, surveys, and responses',
  d1: 'metadata and index records where queryable storage indexes are modeled',
  kv: 'metadata indexes, short-lived action IDs, webhook replay cache, and ephemeral start params',
  durableObjects: 'signer/runtime coordination only, not ordinary payload blob storage',
  accountSettings: 'Only needed when creating or changing the account-level workers.dev subdomain',
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
  includeWorkersDevSubdomainSetup = false,
}: {
  includeWorkersDevSubdomainSetup?: boolean;
} = {}) => {
  const permissions: CloudflareTokenPermission[] = [...CLOUDFLARE_TOKEN_TEMPLATE_PERMISSIONS];
  if (includeWorkersDevSubdomainSetup === true) {
    permissions.push(CLOUDFLARE_WORKERS_DEV_SUBDOMAIN_PERMISSION);
  }
  return permissions;
};

export const buildCloudflareTokenTemplateUrl = ({
  accountId,
  slug,
  includeWorkersDevSubdomainSetup = false,
}: {
  accountId?: unknown;
  slug?: unknown;
  includeWorkersDevSubdomainSetup?: boolean;
} = {}): string => {
  const params = new URLSearchParams();
  params.set('permissionGroupKeys', JSON.stringify(buildCloudflareTokenTemplatePermissions({
    includeWorkersDevSubdomainSetup,
  })));
  params.set('accountId', toStr(accountId).trim() || '*');
  params.set('zoneId', 'all');
  params.set('name', buildTokenName(slug));
  return `https://dash.cloudflare.com/profile/api-tokens?${params.toString()}`;
};
