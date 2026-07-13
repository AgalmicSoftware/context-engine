#!/usr/bin/env node

'use strict';

const CLOUDFLARE_TOKEN_TEMPLATE_BASE_PERMISSIONS = Object.freeze([
  { key: 'workers_scripts', type: 'edit' },
  { key: 'workers_kv_storage', type: 'edit' },
]);

const CLOUDFLARE_TOKEN_TEMPLATE_R2_PERMISSIONS = Object.freeze([
  { key: 'workers_r2', type: 'edit' },
]);

const CLOUDFLARE_TOKEN_TEMPLATE_PERMISSIONS = CLOUDFLARE_TOKEN_TEMPLATE_BASE_PERMISSIONS;

const CLOUDFLARE_TOKEN_TEMPLATE_RESOURCE_HINTS = Object.freeze({
  kv: 'canonical config, encrypted payload envelopes and indexes, groups, audit rows, and deploy state',
  r2: 'optional existing R2 bucket for advanced deployments that explicitly enable R2 payload storage',
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
  includeR2Storage = false,
} = {}) => {
  const permissions = [...CLOUDFLARE_TOKEN_TEMPLATE_BASE_PERMISSIONS];
  if (includeR2Storage === true) {
    permissions.push(...CLOUDFLARE_TOKEN_TEMPLATE_R2_PERMISSIONS);
  }
  return permissions;
};

const buildCloudflareTokenTemplateUrl = ({
  accountId,
  slug,
  includeR2Storage = false,
} = {}) => {
  const params = new URLSearchParams();
  params.set('permissionGroupKeys', JSON.stringify(buildCloudflareTokenTemplatePermissions({
    includeR2Storage,
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
    if (key === 'include-r2-storage') {
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
    '  npm run -s cloudflare:token-link -- --slug my-session --include-r2-storage',
    '',
    'Flags:',
    '  --slug <slug>            Session slug used in the token name',
    '  --account-id <id|*>      Optional Cloudflare account ID (defaults to *)',
    '  --include-r2-storage     Add R2: Edit for an advanced deployment that manages an existing R2 bucket',
    '  --help                   Show this help text',
    '',
    'Output:',
    '  Prints the same prefilled Cloudflare API token template URL used by the wizard UX.',
    '  Default scope is exactly Workers Scripts: Edit and Workers KV Storage: Edit.',
    '  The optional R2 scope does not create a bucket; configure an existing bucket separately.',
    '  When account ID defaults to *, restrict Account Resources to the intended account before creating the token.',
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
    includeR2Storage: flags['include-r2-storage'] === true,
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
  CLOUDFLARE_TOKEN_TEMPLATE_R2_PERMISSIONS,
  CLOUDFLARE_TOKEN_TEMPLATE_RESOURCE_HINTS,
  buildCloudflareTokenTemplatePermissions,
  buildCloudflareTokenTemplateUrl,
  buildTokenName,
  formatTokenTimestamp,
  parseArgs,
};
