#!/usr/bin/env node

'use strict';

const CLOUDFLARE_TOKEN_TEMPLATE_BASE_PERMISSIONS = Object.freeze([
  { key: 'workers_scripts', type: 'edit' },
  { key: 'workers_kv_storage', type: 'edit' },
]);

const CLOUDFLARE_TOKEN_TEMPLATE_DOC_STORAGE_PERMISSIONS = Object.freeze([
  { key: 'workers_r2', type: 'edit' },
  { key: 'd1', type: 'edit' },
]);

const CLOUDFLARE_TOKEN_TEMPLATE_RUNTIME_PERMISSIONS = Object.freeze([
  { key: 'workers_durable_objects', type: 'edit' },
]);

const CLOUDFLARE_TOKEN_TEMPLATE_PERMISSIONS = Object.freeze([
  ...CLOUDFLARE_TOKEN_TEMPLATE_BASE_PERMISSIONS,
  ...CLOUDFLARE_TOKEN_TEMPLATE_DOC_STORAGE_PERMISSIONS,
  ...CLOUDFLARE_TOKEN_TEMPLATE_RUNTIME_PERMISSIONS,
]);

const CLOUDFLARE_WORKERS_DEV_SUBDOMAIN_PERMISSION = Object.freeze({ key: 'account_settings', type: 'edit' });

const CLOUDFLARE_TOKEN_TEMPLATE_RESOURCE_HINTS = Object.freeze({
  r2: 'CE payload blobs for session context, docs, media, questions, surveys, and responses',
  d1: 'metadata and index records where queryable storage indexes are modeled',
  kv: 'metadata indexes, short-lived action IDs, webhook replay cache, and ephemeral start params',
  durableObjects: 'signer/runtime coordination only, not ordinary payload blob storage',
  accountSettings: 'Only needed when creating or changing the account-level workers.dev subdomain',
});

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const CLOUDFLARE_TOKEN_NAME_PREFIX = 'contextEngine-corsSessionWorker-';
const CLOUDFLARE_TOKEN_NAME_MAX_LENGTH = 120;

const toStr = (value) => (typeof value === 'string' ? value : value == null ? '' : String(value));

const formatTokenTimestamp = (date = new Date()) => {
  const dd = String(date.getDate()).padStart(2, '0');
  const mon = MONTHS[date.getMonth()] || 'UNK';
  const yyyy = date.getFullYear();
  const hours = date.getHours();
  const meridiem = hours >= 12 ? 'PM' : 'AM';
  const hh = String(hours % 12 || 12).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${mon}${dd}-${yyyy}-${hh}${mm}${meridiem}`;
};

const hashTokenNameSlug = (value) => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
};

const compactTokenNameSlug = (slug, maxLength) => {
  if (slug.length <= maxLength) return slug;
  const hash = hashTokenNameSlug(slug);
  const visibleLength = Math.max(0, maxLength - hash.length - 1);
  return `${slug.slice(0, visibleLength)}-${hash}`.slice(0, maxLength);
};

const buildTokenName = (slug) => {
  const safeSlug = toStr(slug).trim() || 'general';
  const timestamp = formatTokenTimestamp();
  // Cloudflare caps user-token names at 120 characters; keep a hash when a valid long session slug must be shortened.
  const maxSlugLength = CLOUDFLARE_TOKEN_NAME_MAX_LENGTH - CLOUDFLARE_TOKEN_NAME_PREFIX.length - timestamp.length - 1;
  const tokenSlug = compactTokenNameSlug(safeSlug, maxSlugLength);
  return `${CLOUDFLARE_TOKEN_NAME_PREFIX}${tokenSlug}-${timestamp}`;
};

const buildCloudflareTokenTemplatePermissions = ({
  includeWorkersDevSubdomainSetup = false,
  includeDocStorage = true,
} = {}) => {
  const permissions = [...CLOUDFLARE_TOKEN_TEMPLATE_BASE_PERMISSIONS];
  if (includeDocStorage === true) {
    permissions.push(...CLOUDFLARE_TOKEN_TEMPLATE_DOC_STORAGE_PERMISSIONS);
  }
  permissions.push(...CLOUDFLARE_TOKEN_TEMPLATE_RUNTIME_PERMISSIONS);
  if (includeWorkersDevSubdomainSetup === true) {
    permissions.push(CLOUDFLARE_WORKERS_DEV_SUBDOMAIN_PERMISSION);
  }
  return permissions;
};

const buildCloudflareTokenTemplateUrl = ({
  accountId,
  slug,
  includeWorkersDevSubdomainSetup = false,
  includeDocStorage = true,
} = {}) => {
  const params = new URLSearchParams();
  params.set('permissionGroupKeys', JSON.stringify(buildCloudflareTokenTemplatePermissions({
    includeWorkersDevSubdomainSetup,
    includeDocStorage,
  })));
  params.set('accountId', toStr(accountId).trim() || '*');
  params.set('zoneId', 'all');
  params.set('name', buildTokenName(slug));
  return `https://dash.cloudflare.com/profile/api-tokens?${params.toString()}`;
};

const parseArgs = (argv = process.argv.slice(2)) => {
  const flags = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = toStr(argv[index]).trim();
    if (!token) continue;
    if (!token.startsWith('--')) {
      throw new Error(`Unexpected argument: ${token}`);
    }
    const key = token.slice(2).trim();
    if (!key) throw new Error('Encountered an empty flag.');
    if (key === 'help') {
      flags.help = true;
      continue;
    }
    if (key === 'include-workers-dev-subdomain-setup') {
      flags[key] = true;
      continue;
    }
    if (key === 'no-doc-storage') {
      flags[key] = true;
      continue;
    }
    const nextValue = argv[index + 1];
    if (typeof nextValue !== 'string' || !String(nextValue).trim() || String(nextValue).startsWith('--')) {
      throw new Error(`Flag --${key} requires a value.`);
    }
    flags[key] = String(nextValue).trim();
    index += 1;
  }
  return flags;
};

const printUsage = () => {
  console.log([
    'Usage:',
    '  npm run -s cloudflare:token-link -- --slug my-session',
    '  npm run -s cloudflare:token-link -- --slug my-session --account-id <cloudflare-account-id>',
    '  npm run -s cloudflare:token-link -- --slug my-session --include-workers-dev-subdomain-setup',
    '  npm run -s cloudflare:token-link -- --slug my-session --no-doc-storage',
    '',
    'Flags:',
    '  --slug <slug>            Session slug used in the token name',
    '  --account-id <id|*>      Optional Cloudflare account ID (defaults to *)',
    '  --include-workers-dev-subdomain-setup',
    '                           Add Account Settings: Edit when the helper must create/change the account-level workers.dev subdomain',
    '  --no-doc-storage         Omit R2/D1 scopes for the default Telegram smoke deploy',
    '  --help                   Show this help text',
    '',
    'Output:',
    '  Prints the same prefilled Cloudflare API token template URL used by the wizard UX.',
    '  Scope covers Workers, KV, R2, D1, and Durable Objects by default; --no-doc-storage narrows this to the default Telegram smoke deploy.',
    '  Account Settings: Edit is added only with --include-workers-dev-subdomain-setup.',
  ].join('\n'));
};

function main() {
  const flags = parseArgs();
  if (flags.help) {
    printUsage();
    return;
  }

  console.log(buildCloudflareTokenTemplateUrl({
    accountId: flags['account-id'] || '',
    slug: flags.slug || '',
    includeWorkersDevSubdomainSetup: flags['include-workers-dev-subdomain-setup'] === true,
    includeDocStorage: flags['no-doc-storage'] !== true,
  }));
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(err?.message || err);
    process.exit(1);
  }
}

module.exports = {
  CLOUDFLARE_TOKEN_TEMPLATE_PERMISSIONS,
  CLOUDFLARE_TOKEN_TEMPLATE_BASE_PERMISSIONS,
  CLOUDFLARE_TOKEN_TEMPLATE_DOC_STORAGE_PERMISSIONS,
  CLOUDFLARE_TOKEN_TEMPLATE_RUNTIME_PERMISSIONS,
  CLOUDFLARE_WORKERS_DEV_SUBDOMAIN_PERMISSION,
  CLOUDFLARE_TOKEN_TEMPLATE_RESOURCE_HINTS,
  buildCloudflareTokenTemplatePermissions,
  buildCloudflareTokenTemplateUrl,
  buildTokenName,
  formatTokenTimestamp,
  parseArgs,
};
