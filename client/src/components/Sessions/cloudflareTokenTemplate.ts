import { toStr } from '../../utilities/shared/primitives.js';
import { buildPublicRepoBlobUrl } from '../../variables/publicRepoMetadata.js';

export const CLOUDFLARE_TOKEN_TEMPLATE_PERMISSIONS = Object.freeze([
  { key: 'workers_scripts', type: 'edit' },
  { key: 'workers_kv_storage', type: 'edit' },
  { key: 'workers_r2_storage', type: 'edit' },
  { key: 'd1', type: 'edit' },
  { key: 'workers_durable_objects', type: 'edit' },
  { key: 'account_settings', type: 'edit' },
]);

export const CLOUDFLARE_TOKEN_TEMPLATE_RESOURCE_HINTS = Object.freeze({
  r2: 'docs/context/media/blob payloads',
  d1: 'metadata/index/audit/event records',
  kv: 'short-lived action IDs, webhook replay cache, ephemeral start params',
  durableObjects: 'managed signer runtime and coordination locks',
});

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'] as const;
const CLOUDFLARE_TOKEN_NAME_PREFIX = 'contextEngine-corsSessionWorker-';
const CLOUDFLARE_TOKEN_NAME_MAX_LENGTH = 120;

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

const hashTokenNameSlug = (value: string): string => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
};

const compactTokenNameSlug = (slug: string, maxLength: number): string => {
  if (slug.length <= maxLength) return slug;
  const hash = hashTokenNameSlug(slug);
  const visibleLength = Math.max(0, maxLength - hash.length - 1);
  return `${slug.slice(0, visibleLength)}-${hash}`.slice(0, maxLength);
};

export const buildTokenName = (slug?: unknown): string => {
  const safeSlug = toStr(slug).trim() || 'general';
  const timestamp = formatTokenTimestamp();
  // Cloudflare caps user-token names at 120 characters; keep a hash when a valid long session slug must be shortened.
  const maxSlugLength = CLOUDFLARE_TOKEN_NAME_MAX_LENGTH - CLOUDFLARE_TOKEN_NAME_PREFIX.length - timestamp.length - 1;
  const tokenSlug = compactTokenNameSlug(safeSlug, maxSlugLength);
  return `${CLOUDFLARE_TOKEN_NAME_PREFIX}${tokenSlug}-${timestamp}`;
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
  slug,
  includeR2Storage = false,
}: {
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
  // Account selection stays operator-controlled in Cloudflare; deploy resolves
  // the one token-visible account and never trusts browser-cached account IDs.
  params.set('accountId', '*');
  params.set('zoneId', 'all');
  params.set('name', buildTokenName(slug));
  return `${CLOUDFLARE_API_TOKENS_URL}?${params.toString()}`;
};
