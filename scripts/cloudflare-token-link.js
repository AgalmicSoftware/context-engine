#!/usr/bin/env node

'use strict';

const CLOUDFLARE_TOKEN_TEMPLATE_PERMISSIONS = Object.freeze([
  { key: 'workers_scripts', type: 'edit' },
  { key: 'workers_kv_storage', type: 'edit' },
  { key: 'workers_r2_storage', type: 'edit' },
  { key: 'd1', type: 'edit' },
  { key: 'workers_durable_objects', type: 'edit' },
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

const buildTokenName = (slug) => {
  const safeSlug = toStr(slug).trim() || 'general';
  return `contextEngine-corsSessionWorker-${safeSlug}-${formatTokenTimestamp()}`;
};

const buildCloudflareTokenTemplatePermissions = ({
  includeWorkersDevSubdomainSetup = false,
} = {}) => {
  const permissions = [...CLOUDFLARE_TOKEN_TEMPLATE_PERMISSIONS];
  if (includeWorkersDevSubdomainSetup === true) {
    permissions.push(CLOUDFLARE_WORKERS_DEV_SUBDOMAIN_PERMISSION);
  }
  return permissions;
};

const buildCloudflareTokenTemplateUrl = ({
  accountId,
  slug,
  includeWorkersDevSubdomainSetup = false,
} = {}) => {
  const params = new URLSearchParams();
  params.set('permissionGroupKeys', JSON.stringify(buildCloudflareTokenTemplatePermissions({
    includeWorkersDevSubdomainSetup,
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
    '',
    'Flags:',
    '  --slug <slug>            Session slug used in the token name',
    '  --account-id <id|*>      Optional Cloudflare account ID (defaults to *)',
    '  --include-workers-dev-subdomain-setup',
    '                           Add Account Settings: Edit when the helper must create/change the account-level workers.dev subdomain',
    '  --help                   Show this help text',
    '',
    'Output:',
    '  Prints the same prefilled Cloudflare API token template URL used by the wizard UX.',
    '  Scope covers Workers, KV, R2, D1, and Durable Objects by default.',
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
  CLOUDFLARE_WORKERS_DEV_SUBDOMAIN_PERMISSION,
  CLOUDFLARE_TOKEN_TEMPLATE_RESOURCE_HINTS,
  buildCloudflareTokenTemplatePermissions,
  buildCloudflareTokenTemplateUrl,
  buildTokenName,
  formatTokenTimestamp,
  parseArgs,
};
