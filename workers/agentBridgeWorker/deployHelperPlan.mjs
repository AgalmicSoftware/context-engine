#!/usr/bin/env node

import { fileURLToPath } from 'url';
import { resolve } from 'path';
import { randomBytes } from 'crypto';
import rpcDefaults from '../../client/src/variables/rpcDefaults.js';

const DEFAULT_WORKER_NAME = 'ce-agent-bridge-worker';
const DEFAULT_COMPATIBILITY_DATE = '2024-09-02';
const DEFAULT_CHAIN_ID = '11155420';
const DEFAULT_RPC_URL = rpcDefaults.getPathRpcUrl(DEFAULT_CHAIN_ID) || '';
const WORKERS_DEV_SETUP_PERMISSION = Object.freeze({ key: 'account_settings', type: 'edit' });

export const AGENT_BRIDGE_CLOUDFLARE_TOKEN_PERMISSIONS = Object.freeze([
  { key: 'workers_scripts', type: 'edit' },
  { key: 'workers_kv_storage', type: 'edit' },
  { key: 'workers_r2_storage', type: 'edit' },
  { key: 'd1', type: 'edit' },
  { key: 'workers_durable_objects', type: 'edit' },
]);

export const AGENT_BRIDGE_OPTIONAL_TOKEN_PERMISSIONS = Object.freeze([
  {
    ...WORKERS_DEV_SETUP_PERMISSION,
    reason: 'Only needed when the helper must create or change the account-level workers.dev subdomain.',
  },
]);

const REQUIRED_SECRET_NAMES = Object.freeze([
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_WEBHOOK_SECRET',
  'DEMO_SIGNER_ROOT_SECRET',
]);

const REQUIRED_VAR_NAMES = Object.freeze([
  'TELEGRAM_BOT_USERNAME',
  'AGENT_BRIDGE_PUBLIC_URL',
  'CE_SESSION_WORKER_BASE_URL',
  'DEFAULT_CHAIN_ID',
  'DEFAULT_RPC_URL',
]);

function safeString(value) {
  return String(value || '').trim();
}

function normalizeWorkerName(value = '') {
  const normalized = safeString(value || DEFAULT_WORKER_NAME)
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);
  return normalized || DEFAULT_WORKER_NAME;
}

function normalizeWorkersSubdomain(value = '') {
  return safeString(value)
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);
}

function tokenPresent(value = '') {
  return safeString(value).length > 0;
}

function redactPresence(value = '') {
  return tokenPresent(value) ? '[set]' : '[missing]';
}

function buildWorkersDevUrl(workerName = '', workersSubdomain = '') {
  const name = normalizeWorkerName(workerName);
  const subdomain = normalizeWorkersSubdomain(workersSubdomain) || '<workers-subdomain>';
  return `https://${name}.${subdomain}.workers.dev`;
}

export function generateAgentBridgeSecret({ byteLength = 32, randomBytesImpl = randomBytes } = {}) {
  const length = Math.max(32, Math.floor(Number(byteLength || 0) || 32));
  return randomBytesImpl(length).toString('hex');
}

export function buildAgentBridgeGeneratedSecrets(options = {}) {
  return {
    TELEGRAM_WEBHOOK_SECRET: generateAgentBridgeSecret(options),
    DEMO_SIGNER_ROOT_SECRET: generateAgentBridgeSecret(options),
  };
}

export function normalizeCloudflareAccounts(input = {}) {
  const rawAccounts = Array.isArray(input)
    ? input
    : (Array.isArray(input?.result) ? input.result : []);
  return rawAccounts
    .map((entry) => ({
      id: safeString(entry?.id),
      name: safeString(entry?.name),
    }))
    .filter((entry) => !!entry.id);
}

export function deriveSingleCloudflareAccount(input = {}) {
  const accounts = normalizeCloudflareAccounts(input);
  if (accounts.length === 1) {
    return {
      ok: true,
      accountId: accounts[0].id,
      accountName: accounts[0].name,
      blocker: '',
      accountCount: 1,
    };
  }
  if (accounts.length > 1) {
    return {
      ok: false,
      accountId: '',
      accountName: '',
      accountCount: accounts.length,
      blocker: 'Cloudflare token can see multiple accounts. Account selection is not implemented yet; create a token scoped to one account before running setup.',
    };
  }
  return {
    ok: false,
    accountId: '',
    accountName: '',
    accountCount: 0,
    blocker: 'No Cloudflare account was visible to this token.',
  };
}

function parseArgs(argv = process.argv.slice(2)) {
  const flags = {};
  const booleanFlags = new Set(['help', 'include-workers-dev-subdomain-setup', 'json']);
  for (let index = 0; index < argv.length; index += 1) {
    const token = safeString(argv[index]);
    if (!token) continue;
    if (!token.startsWith('--')) throw new Error(`Unexpected argument: ${token}`);
    const key = token.slice(2);
    if (booleanFlags.has(key)) {
      flags[key] = true;
      continue;
    }
    const next = argv[index + 1];
    if (!safeString(next) || safeString(next).startsWith('--')) {
      throw new Error(`Flag --${key} requires a value.`);
    }
    flags[key] = safeString(next);
    index += 1;
  }
  return flags;
}

export function resolveAgentBridgeDeployConfig({
  flags = {},
  env = process.env,
} = {}) {
  const workerName = normalizeWorkerName(flags['worker-name'] || env.AGENT_BRIDGE_WORKER_NAME || DEFAULT_WORKER_NAME);
  const workersSubdomain = normalizeWorkersSubdomain(flags['workers-subdomain'] || env.CLOUDFLARE_WORKERS_SUBDOMAIN);
  const defaultChainId = safeString(flags['default-chain-id'] || env.DEFAULT_CHAIN_ID || DEFAULT_CHAIN_ID);
  const agentBridgePublicUrl = safeString(
    flags['public-url'] ||
    env.AGENT_BRIDGE_PUBLIC_URL ||
    buildWorkersDevUrl(workerName, workersSubdomain),
  ).replace(/\/+$/, '');
  const accountId = safeString(flags['account-id'] || env.CLOUDFLARE_ACCOUNT_ID);
  const config = {
    apiTokenPresent: tokenPresent(flags['api-token'] || env.CLOUDFLARE_API_TOKEN),
    accountId,
    accountLookup: accountId
      ? { mode: 'provided', path: null, blocker: '' }
      : {
          mode: 'derive_from_token',
          path: '/accounts?per_page=2',
          blocker: 'Block setup if the Cloudflare token can see multiple accounts; account selection is not implemented yet.',
        },
    workerName,
    workersSubdomain,
    compatibilityDate: safeString(flags['compatibility-date'] || env.AGENT_BRIDGE_COMPATIBILITY_DATE || DEFAULT_COMPATIBILITY_DATE),
    includeWorkersDevSubdomainSetup: flags['include-workers-dev-subdomain-setup'] === true
      || safeString(env.AGENT_BRIDGE_INCLUDE_WORKERS_DEV_SUBDOMAIN_SETUP).toLowerCase() === 'true',
    resources: {
      actionKvTitle: safeString(flags['action-kv-title'] || env.AGENT_ACTION_KV_TITLE || `ContextEngineAgentBridgeActions:${workerName}`),
      r2BucketName: safeString(flags['r2-bucket'] || env.AGENT_DOCS_R2_BUCKET || `${workerName}-demo-artifacts`),
      d1DatabaseName: safeString(flags['d1-database'] || env.AGENT_DOCS_D1_DATABASE || `${workerName}-events`),
      durableObjectBinding: 'MANAGED_DEMO_SIGNER',
      durableObjectClassName: 'ManagedDemoSignerDurableObject',
    },
    vars: {
      TELEGRAM_BOT_USERNAME: safeString(flags['telegram-bot-username'] || env.TELEGRAM_BOT_USERNAME),
      AGENT_BRIDGE_PUBLIC_URL: agentBridgePublicUrl,
      CE_SESSION_WORKER_BASE_URL: safeString(flags['session-worker-url'] || env.CE_SESSION_WORKER_BASE_URL).replace(/\/+$/, ''),
      DEFAULT_CHAIN_ID: defaultChainId,
      DEFAULT_RPC_URL: safeString(flags['default-rpc-url'] || env.DEFAULT_RPC_URL || rpcDefaults.getPathRpcUrl(defaultChainId) || DEFAULT_RPC_URL),
      ADDITIONAL_RPC_URL: safeString(flags['additional-rpc-url'] || env.ADDITIONAL_RPC_URL),
      TELEGRAM_BRIDGE_ENABLED: 'true',
      BROADCAST_ENABLED: 'false',
      AGENT_AI_PROVIDER: safeString(flags['agent-ai-provider'] || env.AGENT_AI_PROVIDER || 'ce_session_policy'),
    },
    secrets: Object.fromEntries(REQUIRED_SECRET_NAMES.map((name) => [
      name,
      redactPresence(flags[name.toLowerCase().replace(/_/g, '-')] || env[name]),
    ])),
  };
  return config;
}

export function validateAgentBridgeDeployConfig(config = {}) {
  const missing = [];
  if (!config.apiTokenPresent) missing.push('CLOUDFLARE_API_TOKEN');
  for (const name of REQUIRED_VAR_NAMES) {
    if (!safeString(config.vars?.[name])) missing.push(name);
  }
  for (const name of REQUIRED_SECRET_NAMES) {
    if (config.secrets?.[name] !== '[set]') missing.push(name);
  }
  const publicUrl = safeString(config.vars?.AGENT_BRIDGE_PUBLIC_URL);
  if (publicUrl.includes('<workers-subdomain>')) {
    missing.push('CLOUDFLARE_WORKERS_SUBDOMAIN');
  }
  if (!/^https:\/\/[^/<>]+\.workers\.dev$/i.test(publicUrl)) {
    missing.push('AGENT_BRIDGE_PUBLIC_URL must be https://<worker-name>.<workers-subdomain>.workers.dev for the first demo');
  }
  return {
    ok: missing.length === 0,
    missing,
  };
}

export function validateAgentBridgeTokenScope({
  permissions = [],
  includeWorkersDevSubdomainSetup = false,
} = {}) {
  const normalized = new Set((Array.isArray(permissions) ? permissions : [])
    .map((permission) => `${safeString(permission.key)}:${safeString(permission.type)}`));
  const required = AGENT_BRIDGE_CLOUDFLARE_TOKEN_PERMISSIONS;
  const missing = required.filter((permission) => !normalized.has(`${permission.key}:${permission.type}`));
  const optionalMissing = includeWorkersDevSubdomainSetup && !normalized.has(`${WORKERS_DEV_SETUP_PERMISSION.key}:${WORKERS_DEV_SETUP_PERMISSION.type}`)
    ? [WORKERS_DEV_SETUP_PERMISSION]
    : [];
  return {
    ok: missing.length === 0 && optionalMissing.length === 0,
    missing,
    optionalMissing,
    accountSettingsEditRequired: includeWorkersDevSubdomainSetup === true,
  };
}

export function buildAgentBridgeWorkerUploadMetadata(config = {}) {
  const vars = Object.fromEntries(Object.entries(config.vars || {})
    .filter(([name, text]) => name !== 'ADDITIONAL_RPC_URL' || !!safeString(text)));
  return {
    main_module: 'worker.mjs',
    compatibility_date: safeString(config.compatibilityDate || DEFAULT_COMPATIBILITY_DATE),
    compatibility_flags: ['nodejs_compat'],
    bindings: [
      { name: 'AGENT_ACTION_KV', type: 'kv_namespace', namespace_id: '<created-kv-namespace-id>' },
      { name: 'AGENT_DOCS_R2', type: 'r2_bucket', bucket_name: config.resources?.r2BucketName || '<agent-docs-r2-bucket>' },
      { name: 'AGENT_DOCS_D1', type: 'd1', id: '<created-d1-database-id>' },
      {
        name: config.resources?.durableObjectBinding || 'MANAGED_DEMO_SIGNER',
        type: 'durable_object_namespace',
        class_name: config.resources?.durableObjectClassName || 'ManagedDemoSignerDurableObject',
      },
      ...Object.entries(vars).map(([name, text]) => ({
        name,
        type: 'plain_text',
        text: safeString(text),
      })),
    ],
    migrations: [{
      tag: 'v1',
      new_classes: [config.resources?.durableObjectClassName || 'ManagedDemoSignerDurableObject'],
    }],
  };
}

export function buildAgentBridgeDeployPlan(config = {}) {
  const accountId = safeString(config.accountId) || '<resolved-account-id>';
  const workerName = normalizeWorkerName(config.workerName);
  const metadata = buildAgentBridgeWorkerUploadMetadata(config);
  return {
    ok: true,
    workerName,
    accountId,
    publicUrl: safeString(config.vars?.AGENT_BRIDGE_PUBLIC_URL || buildWorkersDevUrl(workerName, config.workersSubdomain)),
    webhookUrl: `${safeString(config.vars?.AGENT_BRIDGE_PUBLIC_URL || buildWorkersDevUrl(workerName, config.workersSubdomain)).replace(/\/+$/, '')}/telegram/webhook`,
    resources: config.resources,
    requiredTokenPermissions: AGENT_BRIDGE_CLOUDFLARE_TOKEN_PERMISSIONS,
    optionalTokenPermissions: config.includeWorkersDevSubdomainSetup === true
      ? AGENT_BRIDGE_OPTIONAL_TOKEN_PERMISSIONS
      : [],
    remainingDirectApiCalls: [
      {
        order: 1,
        purpose: 'Resolve exactly one account from the Cloudflare token when CLOUDFLARE_ACCOUNT_ID is not supplied; block if multiple accounts are visible',
        method: 'GET',
        path: '/accounts?per_page=2',
        requiredWhen: !safeString(config.accountId),
      },
      {
        order: 2,
        purpose: 'Create or reuse KV namespace for opaque action IDs and replay cache',
        method: 'POST',
        path: `/accounts/${accountId}/storage/kv/namespaces`,
        body: { title: config.resources?.actionKvTitle || '<action-kv-title>' },
      },
      {
        order: 3,
        purpose: 'Create or reuse R2 bucket for demo artifacts when the demo enables document/artifact storage',
        method: 'POST',
        path: `/accounts/${accountId}/r2/buckets`,
        body: { name: config.resources?.r2BucketName || '<agent-docs-r2-bucket>' },
      },
      {
        order: 4,
        purpose: 'Create or reuse D1 database for event, audit, and index records',
        method: 'POST',
        path: `/accounts/${accountId}/d1/database`,
        body: { name: config.resources?.d1DatabaseName || '<agent-docs-d1-database>' },
      },
      {
        order: 5,
        purpose: 'Upload agentBridgeWorker module with bindings, vars, Durable Object binding, and migration metadata',
        method: 'PUT',
        path: `/accounts/${accountId}/workers/scripts/${workerName}`,
        multipartMetadata: metadata,
      },
      ...REQUIRED_SECRET_NAMES.map((name, index) => ({
        order: 6 + index,
        purpose: `Write ${name} as a Worker secret`,
        method: 'PUT',
        path: `/accounts/${accountId}/workers/scripts/${workerName}/secrets`,
        body: { name, type: 'secret_text', text: '<redacted-secret-value>' },
      })),
      {
        order: 9,
        purpose: 'Enable the script on the default workers.dev URL',
        method: 'POST',
        path: `/accounts/${accountId}/workers/scripts/${workerName}/subdomain`,
        body: { enabled: true },
      },
      {
        order: 10,
        purpose: 'Create or change the account-level workers.dev subdomain only if the account has none or the operator requested a new one',
        method: 'PUT',
        path: `/accounts/${accountId}/workers/subdomain`,
        body: { subdomain: config.workersSubdomain || '<workers-subdomain>' },
        requiredPermission: WORKERS_DEV_SETUP_PERMISSION,
        requiredWhen: config.includeWorkersDevSubdomainSetup === true,
      },
    ],
  };
}

function printUsage() {
  console.log([
    'Usage:',
    '  node workers/agentBridgeWorker/deployHelperPlan.mjs --worker-name ce-agent-bridge-worker --workers-subdomain <subdomain>',
    '',
    'Environment:',
    '  CLOUDFLARE_API_TOKEN',
    '  TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, DEMO_SIGNER_ROOT_SECRET',
    '  TELEGRAM_BOT_USERNAME, CE_SESSION_WORKER_BASE_URL, DEFAULT_CHAIN_ID, DEFAULT_RPC_URL',
    '  Optional: CLOUDFLARE_ACCOUNT_ID as a developer fallback, ADDITIONAL_RPC_URL',
    '',
    'Flags:',
    '  --include-workers-dev-subdomain-setup  Include Account Settings: Edit as an optional token scope when creating/changing the workers.dev subdomain',
    '  --json                                  Print JSON only',
  ].join('\n'));
}

const isEntrypoint = () => {
  const current = fileURLToPath(import.meta.url);
  const invoked = process.argv[1] ? resolve(process.argv[1]) : '';
  return current === invoked;
};

if (isEntrypoint()) {
  try {
    const flags = parseArgs();
    if (flags.help) {
      printUsage();
    } else {
      const config = resolveAgentBridgeDeployConfig({ flags });
      const validation = validateAgentBridgeDeployConfig(config);
      const plan = buildAgentBridgeDeployPlan(config);
      console.log(JSON.stringify({ validation, plan }, null, 2));
    }
  } catch (error) {
    console.error(safeString(error?.message || error) || 'agent bridge deploy plan failed');
    process.exit(1);
  }
}
