#!/usr/bin/env node

import { fileURLToPath } from 'url';
import { resolve } from 'path';
import { randomBytes } from 'crypto';
import rpcDefaults from '../../client/src/variables/rpcDefaults.js';

const DEFAULT_WORKER_NAME = 'ce-agent-bridge-worker';
const DEFAULT_COMPATIBILITY_DATE = '2024-09-02';
const DEFAULT_CHAIN_ID = '11155420';
const DEFAULT_RPC_URL = rpcDefaults.getPathRpcUrl(DEFAULT_CHAIN_ID) || '';
const CLOUDFLARE_API_BASE_URL = 'https://api.cloudflare.com/client/v4';
const WORKERS_DEV_SETUP_PERMISSION = Object.freeze({ key: 'account_settings', type: 'edit' });

export const AGENT_BRIDGE_BASE_CLOUDFLARE_TOKEN_PERMISSIONS = Object.freeze([
  { key: 'workers_scripts', type: 'edit' },
  { key: 'workers_kv_storage', type: 'edit' },
]);

export const AGENT_BRIDGE_DOC_STORAGE_CLOUDFLARE_TOKEN_PERMISSIONS = Object.freeze([
  { key: 'workers_r2', type: 'edit' },
  { key: 'd1', type: 'edit' },
]);

export const AGENT_BRIDGE_CLOUDFLARE_TOKEN_PERMISSIONS = AGENT_BRIDGE_BASE_CLOUDFLARE_TOKEN_PERMISSIONS;

export const AGENT_BRIDGE_OPTIONAL_TOKEN_PERMISSIONS = Object.freeze([
  {
    ...WORKERS_DEV_SETUP_PERMISSION,
    reason: 'Only needed when the helper must create or change the account-level workers.dev subdomain.',
  },
]);

export const REQUIRED_AGENT_BRIDGE_SECRET_NAMES = Object.freeze([
  'DEMO_SIGNER_ROOT_SECRET',
  'AGENT_BRIDGE_AGENT_API_TOKEN',
]);

export const REQUIRED_AGENT_BRIDGE_TELEGRAM_SECRET_NAMES = Object.freeze([
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_WEBHOOK_SECRET',
]);

export const OPTIONAL_AGENT_BRIDGE_SECRET_NAMES = Object.freeze([
  'AGENT_BRIDGE_OPENAI_API_KEY',
]);

export const REQUIRED_AGENT_BRIDGE_VAR_NAMES = Object.freeze([
  'AGENT_BRIDGE_PUBLIC_URL',
  'CE_SESSION_WORKER_BASE_URL',
  'DEFAULT_CHAIN_ID',
  'DEFAULT_RPC_URL',
]);

export const REQUIRED_AGENT_BRIDGE_TELEGRAM_VAR_NAMES = Object.freeze([
  'TELEGRAM_BOT_USERNAME',
]);

export const OPTIONAL_AGENT_BRIDGE_VAR_NAMES = Object.freeze([
  'ADDITIONAL_RPC_URL',
  'AGENT_BRIDGE_SESSION_POLICY_JSON',
  'AGENT_BRIDGE_DEMO_QUESTIONS_JSON',
  'AGENT_BRIDGE_DEMO_DOCS_JSON',
  'AGENT_BRIDGE_QUESTION_SOURCE',
  'AGENT_BRIDGE_ALLOW_DEMO_QUESTION_FALLBACK',
  'AGENT_BRIDGE_ALLOW_AD_HOC_QUESTIONS',
  'AGENT_BRIDGE_ALLOW_UNSCOPED_QUESTION_SCAN',
  'AGENT_BRIDGE_MINI_APP_URL',
  'AGENT_BRIDGE_CLIENT_LOGIN_ALLOWED_ORIGINS',
  'AGENT_BRIDGE_MINIAPP_ALLOWED_ORIGINS',
  'AGENT_BRIDGE_MINI_APP_AUTH_MAX_AGE_SECONDS',
  'AGENT_BRIDGE_RESPONSE_EXPORT_ALLOWED_ADDRESSES',
  'AGENT_BRIDGE_AGENT_ONLY_TOKEN_TTL_SECONDS',
  'AGENT_BRIDGE_SESSION_WRAPPED_SKILL_URL',
  'AGENT_BRIDGE_AGENT_WRAPPED_SKILL_URL',
  'AGENT_BRIDGE_AGENT_WRAPPED_POSTER_DEFAULT',
  'AGENT_BRIDGE_AGENT_WRAPPED_STORY_DEFAULT',
  'AGENT_BRIDGE_AGENT_WRAPPED_COMPASS_DEFAULT',
  'AGENT_BRIDGE_TELEGRAM_SESSION_CREATED_AFTER',
  'AGENT_BRIDGE_RPC_TIMEOUT_MS',
  'AGENT_BRIDGE_QUESTION_CACHE_TTL_SECONDS',
  'AGENT_BRIDGE_QUESTION_SCAN_BLOCKS',
  'AGENT_BRIDGE_QUESTION_LOG_CHUNK_SIZE',
  'AGENT_BRIDGE_QUESTION_PAYLOAD_CONCURRENCY',
  'AGENT_BRIDGE_QUESTION_FOREGROUND_CHUNKS',
  'AGENT_BRIDGE_QUESTION_SCAN_START_BLOCK',
  'AGENT_BRIDGE_QUESTION_SCAN_END_BLOCK',
  'AGENT_BRIDGE_SURVEYS_ADDRESS',
  'AGENT_BRIDGE_MAX_REGISTRY_SESSIONS',
  'AGENT_BRIDGE_SESSION_REGISTRY_ADDRESS',
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

function envFlagEnabled(value = '') {
  return ['1', 'true', 'yes', 'on'].includes(safeString(value).toLowerCase());
}

function redactPresence(value = '') {
  return tokenPresent(value) ? '[set]' : '[missing]';
}

function buildWorkersDevUrl(workerName = '', workersSubdomain = '') {
  const name = normalizeWorkerName(workerName);
  const subdomain = normalizeWorkersSubdomain(workersSubdomain) || '<workers-subdomain>';
  return `https://${name}.${subdomain}.workers.dev`;
}

function hasTemplatePlaceholder(value = '') {
  return /<[^>]+>/.test(safeString(value));
}

function isHttpsUrl(value = '') {
  return /^https:\/\/[^/\s<>]+(?:\/.*)?$/i.test(safeString(value));
}

function parseJsonObject(value = '') {
  try {
    const parsed = JSON.parse(safeString(value));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function normalizeHttpsOrigin(value = '') {
  try {
    const parsed = new URL(safeString(value));
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return '';
    if (parsed.pathname !== '/' || parsed.search || parsed.hash) return '';
    return parsed.origin;
  } catch {
    return '';
  }
}

export function inspectDedicatedAgentBridgeSessionPolicy({
  policyJson = '',
  sessionWorkerOrigin = '',
} = {}) {
  const policy = parseJsonObject(policyJson);
  if (!policy) {
    return { ok: false, reason: 'dedicated session policy must be valid JSON' };
  }
  const sessions = Array.isArray(policy.sessions)
    ? policy.sessions
    : (Array.isArray(policy.linkedSessions) ? policy.linkedSessions : []);
  if (sessions.length !== 1 || !sessions[0] || typeof sessions[0] !== 'object' || Array.isArray(sessions[0])) {
    return { ok: false, reason: 'dedicated session policy must contain exactly one session' };
  }
  const session = sessions[0];
  const sessionSlug = safeString(session.sessionSlug || session.slug).toLowerCase();
  if (!/^[a-z0-9_-]{1,128}$/.test(sessionSlug)) {
    return { ok: false, reason: 'dedicated session policy requires one valid session slug' };
  }
  const defaultSessionSlug = safeString(policy.defaultSessionSlug || policy.defaultSession).toLowerCase();
  if (defaultSessionSlug !== sessionSlug) {
    return { ok: false, reason: 'dedicated session policy default must match its only session slug' };
  }
  if (session.sessionModeProfile?.surfaces?.agentHttp !== true) {
    return { ok: false, reason: 'dedicated session policy requires surfaces.agentHttp=true' };
  }
  const configuredOrigin = normalizeHttpsOrigin(sessionWorkerOrigin);
  const policyOrigin = normalizeHttpsOrigin(
    session.sessionWorkerOrigin ||
    session.sessionWorkerUrl ||
    session.workerUrl ||
    session.corsWorkerUrl
  );
  if (!configuredOrigin || !policyOrigin || configuredOrigin !== policyOrigin) {
    return { ok: false, reason: 'dedicated session policy must pin the configured session Worker origin' };
  }
  return {
    ok: true,
    sessionSlug,
    sessionWorkerOrigin: configuredOrigin,
  };
}

export function generateAgentBridgeSecret({ byteLength = 32, randomBytesImpl = randomBytes } = {}) {
  const length = Math.max(32, Math.floor(Number(byteLength || 0) || 32));
  return randomBytesImpl(length).toString('hex');
}

export function buildAgentBridgeGeneratedSecrets({ telegramEnabled = false, ...options } = {}) {
  return {
    ...(telegramEnabled ? { TELEGRAM_WEBHOOK_SECRET: generateAgentBridgeSecret(options) } : {}),
    DEMO_SIGNER_ROOT_SECRET: generateAgentBridgeSecret(options),
    AGENT_BRIDGE_AGENT_API_TOKEN: generateAgentBridgeSecret(options),
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
  const booleanFlags = new Set([
    'enable-doc-storage',
    'enable-telegram',
    'help',
    'include-workers-dev-subdomain-setup',
    'json',
    'live-account-lookup',
  ]);
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
  const enableDocStorage = flags['enable-doc-storage'] === true || envFlagEnabled(env.AGENT_BRIDGE_ENABLE_DOC_STORAGE);
  const telegramEnabled = flags['enable-telegram'] === true || envFlagEnabled(env.TELEGRAM_BRIDGE_ENABLED);
  const agentBridgePublicUrl = safeString(
    flags['public-url'] ||
    env.AGENT_BRIDGE_PUBLIC_URL ||
    buildWorkersDevUrl(workerName, workersSubdomain),
  ).replace(/\/+$/, '');
  const accountId = safeString(flags['account-id'] || env.CLOUDFLARE_ACCOUNT_ID);
  const dedicatedSessionPolicy = inspectDedicatedAgentBridgeSessionPolicy({
    policyJson: env.AGENT_BRIDGE_SESSION_POLICY_JSON,
    sessionWorkerOrigin: flags['session-worker-url'] || env.CE_SESSION_WORKER_BASE_URL,
  });
  const config = {
    apiTokenPresent: tokenPresent(flags['api-token'] || env.CLOUDFLARE_API_TOKEN),
    accountId,
    accountLookup: accountId
      ? { mode: 'provided', path: null, blocker: '' }
      : {
          mode: 'derive_from_token_pending',
          path: '/accounts?per_page=2',
          blocker: 'Block setup if the Cloudflare token can see multiple accounts; account selection is not implemented yet.',
        },
    workerName,
    telegramEnabled,
    dedicatedSession: dedicatedSessionPolicy.ok ? {
      sessionSlug: dedicatedSessionPolicy.sessionSlug,
      sessionWorkerOrigin: dedicatedSessionPolicy.sessionWorkerOrigin,
    } : null,
    dedicatedSessionPolicyError: dedicatedSessionPolicy.ok ? '' : dedicatedSessionPolicy.reason,
    workersSubdomain,
    compatibilityDate: safeString(flags['compatibility-date'] || env.AGENT_BRIDGE_COMPATIBILITY_DATE || DEFAULT_COMPATIBILITY_DATE),
    includeWorkersDevSubdomainSetup: flags['include-workers-dev-subdomain-setup'] === true
      || safeString(env.AGENT_BRIDGE_INCLUDE_WORKERS_DEV_SUBDOMAIN_SETUP).toLowerCase() === 'true',
    resources: {
      enableDocStorage,
      actionKvTitle: safeString(flags['action-kv-title'] || env.AGENT_ACTION_KV_TITLE || `ContextEngineAgentBridgeActions:${workerName}`),
      r2BucketName: enableDocStorage ? safeString(flags['r2-bucket'] || env.AGENT_DOCS_R2_BUCKET || `${workerName}-demo-artifacts`) : '',
      d1DatabaseName: enableDocStorage ? safeString(flags['d1-database'] || env.AGENT_DOCS_D1_DATABASE || `${workerName}-events`) : '',
    },
    vars: {
      ...(telegramEnabled ? {
        TELEGRAM_BOT_USERNAME: safeString(flags['telegram-bot-username'] || env.TELEGRAM_BOT_USERNAME),
      } : {}),
      AGENT_BRIDGE_PUBLIC_URL: agentBridgePublicUrl,
      CE_SESSION_WORKER_BASE_URL: safeString(flags['session-worker-url'] || env.CE_SESSION_WORKER_BASE_URL).replace(/\/+$/, ''),
      DEFAULT_CHAIN_ID: defaultChainId,
      DEFAULT_RPC_URL: safeString(flags['default-rpc-url'] || env.DEFAULT_RPC_URL || rpcDefaults.getPathRpcUrl(defaultChainId) || DEFAULT_RPC_URL),
      ADDITIONAL_RPC_URL: safeString(flags['additional-rpc-url'] || env.ADDITIONAL_RPC_URL),
      AGENT_BRIDGE_SESSION_POLICY_JSON: safeString(env.AGENT_BRIDGE_SESSION_POLICY_JSON),
      AGENT_BRIDGE_DEMO_QUESTIONS_JSON: safeString(env.AGENT_BRIDGE_DEMO_QUESTIONS_JSON),
      AGENT_BRIDGE_DEMO_DOCS_JSON: safeString(env.AGENT_BRIDGE_DEMO_DOCS_JSON),
      AGENT_BRIDGE_QUESTION_SOURCE: safeString(env.AGENT_BRIDGE_QUESTION_SOURCE),
      AGENT_BRIDGE_ALLOW_DEMO_QUESTION_FALLBACK: safeString(env.AGENT_BRIDGE_ALLOW_DEMO_QUESTION_FALLBACK),
      AGENT_BRIDGE_ALLOW_AD_HOC_QUESTIONS: safeString(env.AGENT_BRIDGE_ALLOW_AD_HOC_QUESTIONS),
      AGENT_BRIDGE_ALLOW_UNSCOPED_QUESTION_SCAN: safeString(env.AGENT_BRIDGE_ALLOW_UNSCOPED_QUESTION_SCAN),
      AGENT_BRIDGE_MINI_APP_URL: safeString(env.AGENT_BRIDGE_MINI_APP_URL),
      AGENT_BRIDGE_CLIENT_LOGIN_ALLOWED_ORIGINS: safeString(env.AGENT_BRIDGE_CLIENT_LOGIN_ALLOWED_ORIGINS),
      AGENT_BRIDGE_MINIAPP_ALLOWED_ORIGINS: safeString(env.AGENT_BRIDGE_MINIAPP_ALLOWED_ORIGINS),
      AGENT_BRIDGE_MINI_APP_AUTH_MAX_AGE_SECONDS: safeString(env.AGENT_BRIDGE_MINI_APP_AUTH_MAX_AGE_SECONDS),
      AGENT_BRIDGE_RESPONSE_EXPORT_ALLOWED_ADDRESSES: safeString(env.AGENT_BRIDGE_RESPONSE_EXPORT_ALLOWED_ADDRESSES),
      AGENT_BRIDGE_AGENT_ONLY_TOKEN_TTL_SECONDS: safeString(env.AGENT_BRIDGE_AGENT_ONLY_TOKEN_TTL_SECONDS),
      AGENT_BRIDGE_SESSION_WRAPPED_SKILL_URL: safeString(env.AGENT_BRIDGE_SESSION_WRAPPED_SKILL_URL),
      AGENT_BRIDGE_AGENT_WRAPPED_SKILL_URL: safeString(env.AGENT_BRIDGE_AGENT_WRAPPED_SKILL_URL),
      AGENT_BRIDGE_AGENT_WRAPPED_POSTER_DEFAULT: safeString(env.AGENT_BRIDGE_AGENT_WRAPPED_POSTER_DEFAULT),
      AGENT_BRIDGE_AGENT_WRAPPED_STORY_DEFAULT: safeString(env.AGENT_BRIDGE_AGENT_WRAPPED_STORY_DEFAULT),
      AGENT_BRIDGE_AGENT_WRAPPED_COMPASS_DEFAULT: safeString(env.AGENT_BRIDGE_AGENT_WRAPPED_COMPASS_DEFAULT),
      AGENT_BRIDGE_TRUSTED_ONBOARDING_INVITE_TOKEN_HASHES: safeString(env.AGENT_BRIDGE_TRUSTED_ONBOARDING_INVITE_TOKEN_HASHES),
      AGENT_BRIDGE_TRUSTED_ONBOARDING_INVITES_JSON: safeString(env.AGENT_BRIDGE_TRUSTED_ONBOARDING_INVITES_JSON),
      AGENT_BRIDGE_RPC_TIMEOUT_MS: safeString(env.AGENT_BRIDGE_RPC_TIMEOUT_MS),
      AGENT_BRIDGE_QUESTION_CACHE_TTL_SECONDS: safeString(env.AGENT_BRIDGE_QUESTION_CACHE_TTL_SECONDS),
      AGENT_BRIDGE_QUESTION_SCAN_BLOCKS: safeString(env.AGENT_BRIDGE_QUESTION_SCAN_BLOCKS),
      AGENT_BRIDGE_QUESTION_LOG_CHUNK_SIZE: safeString(env.AGENT_BRIDGE_QUESTION_LOG_CHUNK_SIZE),
      AGENT_BRIDGE_QUESTION_PAYLOAD_CONCURRENCY: safeString(env.AGENT_BRIDGE_QUESTION_PAYLOAD_CONCURRENCY),
      AGENT_BRIDGE_QUESTION_FOREGROUND_CHUNKS: safeString(env.AGENT_BRIDGE_QUESTION_FOREGROUND_CHUNKS),
      AGENT_BRIDGE_QUESTION_SCAN_START_BLOCK: safeString(env.AGENT_BRIDGE_QUESTION_SCAN_START_BLOCK),
      AGENT_BRIDGE_QUESTION_SCAN_END_BLOCK: safeString(env.AGENT_BRIDGE_QUESTION_SCAN_END_BLOCK),
      AGENT_BRIDGE_SURVEYS_ADDRESS: safeString(env.AGENT_BRIDGE_SURVEYS_ADDRESS || env.SURVEYS_CONTRACT_ADDRESS || env.SURVEYS_ADDRESS),
      AGENT_BRIDGE_MAX_REGISTRY_SESSIONS: safeString(env.AGENT_BRIDGE_MAX_REGISTRY_SESSIONS),
      AGENT_BRIDGE_SESSION_REGISTRY_ADDRESS: safeString(env.AGENT_BRIDGE_SESSION_REGISTRY_ADDRESS || env.SESSION_REGISTRY_ADDRESS || env.SESSION_REGISTRY),
      ...(telegramEnabled ? {
        TELEGRAM_BRIDGE_ENABLED: 'true',
        AGENT_BRIDGE_TELEGRAM_SESSION_CREATED_AFTER: safeString(env.AGENT_BRIDGE_TELEGRAM_SESSION_CREATED_AFTER),
      } : {}),
      BROADCAST_ENABLED: safeString(env.BROADCAST_ENABLED || 'true'),
      AGENT_BRIDGE_DIRECT_SUBMIT_ENABLED: safeString(env.AGENT_BRIDGE_DIRECT_SUBMIT_ENABLED || 'true'),
      AGENT_BRIDGE_AUTO_FAUCET_ON_JOIN: safeString(env.AGENT_BRIDGE_AUTO_FAUCET_ON_JOIN || 'true'),
      AGENT_AI_PROVIDER: safeString(flags['agent-ai-provider'] || env.AGENT_AI_PROVIDER || 'ce_session_policy'),
    },
    secrets: Object.fromEntries([
      ...[
        ...REQUIRED_AGENT_BRIDGE_SECRET_NAMES,
        ...(telegramEnabled ? REQUIRED_AGENT_BRIDGE_TELEGRAM_SECRET_NAMES : []),
      ].map((name) => [
        name,
        redactPresence(flags[name.toLowerCase().replace(/_/g, '-')] || env[name]),
      ]),
      ...OPTIONAL_AGENT_BRIDGE_SECRET_NAMES.map((name) => [
        name,
        redactPresence(env[name] || (name === 'AGENT_BRIDGE_OPENAI_API_KEY' ? env.OPENAI_API_KEY || env.E2E_OPENAI_KEY : '')),
      ]),
    ]),
  };
  return config;
}

export async function fetchCloudflareAccountsForDeploy({
  apiToken = '',
  apiBaseUrl = CLOUDFLARE_API_BASE_URL,
  fetchImpl = globalThis.fetch,
} = {}) {
  const token = safeString(apiToken);
  if (!token) {
    return { ok: false, status: 0, error: 'CLOUDFLARE_API_TOKEN missing', accounts: [] };
  }
  if (typeof fetchImpl !== 'function') {
    return { ok: false, status: 0, error: 'fetch unavailable for Cloudflare account lookup', accounts: [] };
  }
  let response;
  try {
    response = await fetchImpl(`${safeString(apiBaseUrl).replace(/\/+$/, '')}/accounts?per_page=2`, {
      method: 'GET',
      headers: {
        authorization: `Bearer ${token}`,
        accept: 'application/json',
      },
    });
  } catch (error) {
    return {
      ok: false,
      status: 502,
      error: safeString(error?.message || error) || 'Cloudflare account lookup failed',
      accounts: [],
    };
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.success === false) {
    const firstError = Array.isArray(body?.errors) ? body.errors[0] : null;
    return {
      ok: false,
      status: response.status || 502,
      error: safeString(firstError?.message) || `Cloudflare account lookup failed (${response.status || 502})`,
      accounts: [],
    };
  }
  return {
    ok: true,
    status: response.status || 200,
    accounts: normalizeCloudflareAccounts(body),
  };
}

export async function resolveAgentBridgeDeployConfigForLive({
  flags = {},
  env = process.env,
  fetchImpl = globalThis.fetch,
} = {}) {
  const config = resolveAgentBridgeDeployConfig({ flags, env });
  const shouldLookupAccount = flags['live-account-lookup'] === true
    || envFlagEnabled(env.AGENT_BRIDGE_LIVE_ACCOUNT_LOOKUP);
  if (config.accountId || !shouldLookupAccount) {
    return config;
  }

  const lookup = await fetchCloudflareAccountsForDeploy({
    apiToken: flags['api-token'] || env.CLOUDFLARE_API_TOKEN,
    fetchImpl,
  });
  if (!lookup.ok) {
    return {
      ...config,
      accountLookup: {
        mode: 'derive_from_token_failed',
        path: '/accounts?per_page=2',
        status: lookup.status,
        accountCount: 0,
        blocker: lookup.error,
      },
    };
  }

  const derived = deriveSingleCloudflareAccount(lookup.accounts);
  if (!derived.ok) {
    return {
      ...config,
      accountLookup: {
        mode: 'derive_from_token_failed',
        path: '/accounts?per_page=2',
        status: lookup.status,
        accountCount: derived.accountCount,
        blocker: derived.blocker,
      },
    };
  }

  return {
    ...config,
    accountId: derived.accountId,
    accountLookup: {
      mode: 'derived_from_token',
      path: '/accounts?per_page=2',
      accountId: derived.accountId,
      accountName: derived.accountName,
      accountCount: derived.accountCount,
      blocker: '',
    },
  };
}

export function validateAgentBridgeDeployConfig(config = {}) {
  const missing = [];
  if (!config.dedicatedSession) {
    missing.push(config.dedicatedSessionPolicyError || 'dedicated session policy is required');
  }
  if (!config.apiTokenPresent) missing.push('CLOUDFLARE_API_TOKEN');
  if (config.accountLookup?.mode === 'derive_from_token_failed') {
    missing.push(`CLOUDFLARE_ACCOUNT_ID derivation failed: ${config.accountLookup.blocker || 'account lookup failed'}`);
  }
  for (const name of REQUIRED_AGENT_BRIDGE_VAR_NAMES) {
    if (!safeString(config.vars?.[name])) missing.push(name);
  }
  for (const name of config.telegramEnabled ? REQUIRED_AGENT_BRIDGE_TELEGRAM_VAR_NAMES : []) {
    if (!safeString(config.vars?.[name])) missing.push(name);
  }
  const requiredSecrets = [
    ...REQUIRED_AGENT_BRIDGE_SECRET_NAMES,
    ...(config.telegramEnabled ? REQUIRED_AGENT_BRIDGE_TELEGRAM_SECRET_NAMES : []),
  ];
  for (const name of requiredSecrets) {
    if (config.secrets?.[name] !== '[set]') missing.push(name);
  }
  const publicUrl = safeString(config.vars?.AGENT_BRIDGE_PUBLIC_URL);
  if (publicUrl.includes('<workers-subdomain>')) {
    missing.push('CLOUDFLARE_WORKERS_SUBDOMAIN');
  }
  if (hasTemplatePlaceholder(publicUrl)) {
    missing.push('AGENT_BRIDGE_PUBLIC_URL must not contain template placeholders');
  }
  if (!/^https:\/\/[^/<>]+\.workers\.dev$/i.test(publicUrl)) {
    missing.push('AGENT_BRIDGE_PUBLIC_URL must be https://<worker-name>.<workers-subdomain>.workers.dev for the first demo');
  }
  const sessionWorkerUrl = safeString(config.vars?.CE_SESSION_WORKER_BASE_URL);
  if (hasTemplatePlaceholder(sessionWorkerUrl)) {
    missing.push('CE_SESSION_WORKER_BASE_URL must be the real deployed session worker URL, not a template placeholder');
  }
  if (sessionWorkerUrl && !isHttpsUrl(sessionWorkerUrl)) {
    missing.push('CE_SESSION_WORKER_BASE_URL must be an https URL');
  }
  if (safeString(config.vars?.AGENT_BRIDGE_ENABLE_TELEGRAM_PREVIEW)) {
    missing.push('AGENT_BRIDGE_ENABLE_TELEGRAM_PREVIEW is local-only and must not be deployed');
  }
  if (safeString(config.vars?.AGENT_BRIDGE_MINI_APP_ALLOW_PREVIEW_AUTH)) {
    missing.push('AGENT_BRIDGE_MINI_APP_ALLOW_PREVIEW_AUTH is local-only and must not be deployed');
  }
  if (safeString(config.vars?.AGENT_BRIDGE_MINI_APP_REQUIRE_INIT_DATA).toLowerCase() === 'false') {
    missing.push('AGENT_BRIDGE_MINI_APP_REQUIRE_INIT_DATA=false is local-only and must not be deployed');
  }
  return {
    ok: missing.length === 0,
    missing,
  };
}

export function validateAgentBridgeTokenScope({
  permissions = [],
  includeWorkersDevSubdomainSetup = false,
  includeDocStorage = false,
} = {}) {
  const normalized = new Set((Array.isArray(permissions) ? permissions : [])
    .map((permission) => `${safeString(permission.key)}:${safeString(permission.type)}`));
  const required = buildAgentBridgeCloudflareTokenPermissions({
    resources: { enableDocStorage: includeDocStorage === true },
  });
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

export function buildAgentBridgeCloudflareTokenPermissions(config = {}) {
  const required = [...AGENT_BRIDGE_BASE_CLOUDFLARE_TOKEN_PERMISSIONS];
  if (config.resources?.enableDocStorage === true) {
    required.push(...AGENT_BRIDGE_DOC_STORAGE_CLOUDFLARE_TOKEN_PERMISSIONS);
  }
  return required;
}

export function buildAgentBridgeWorkerUploadMetadata(config = {}) {
  const vars = Object.fromEntries(Object.entries(config.vars || {})
    .filter(([name, text]) => !OPTIONAL_AGENT_BRIDGE_VAR_NAMES.includes(name) || !!safeString(text)));
  const bindings = [
    { name: 'AGENT_ACTION_KV', type: 'kv_namespace', namespace_id: '<created-kv-namespace-id>' },
  ];
  if (config.resources?.enableDocStorage === true) {
    bindings.push(
      { name: 'AGENT_DOCS_R2', type: 'r2_bucket', bucket_name: config.resources?.r2BucketName || '<agent-docs-r2-bucket>' },
      { name: 'AGENT_DOCS_D1', type: 'd1', id: '<created-d1-database-id>' },
    );
  }
  bindings.push(
    ...Object.entries(vars).map(([name, text]) => ({
      name,
      type: 'plain_text',
      text: safeString(text),
    })),
  );
  return {
    main_module: 'worker.js',
    compatibility_date: safeString(config.compatibilityDate || DEFAULT_COMPATIBILITY_DATE),
    compatibility_flags: ['nodejs_compat', 'global_fetch_strictly_public'],
    bindings,
  };
}

export function buildAgentBridgeDeployPlan(config = {}) {
  const accountId = safeString(config.accountId) || '<resolved-account-id>';
  const workerName = normalizeWorkerName(config.workerName);
  const metadata = buildAgentBridgeWorkerUploadMetadata(config);
  const docStorageCalls = config.resources?.enableDocStorage === true
    ? [
        {
          purpose: 'Create or reuse R2 bucket for demo artifacts when the demo enables document/artifact storage',
          method: 'POST',
          path: `/accounts/${accountId}/r2/buckets`,
          body: { name: config.resources?.r2BucketName || '<agent-docs-r2-bucket>' },
        },
        {
          purpose: 'Create or reuse D1 database for event, audit, and index records',
          method: 'POST',
          path: `/accounts/${accountId}/d1/database`,
          body: { name: config.resources?.d1DatabaseName || '<agent-docs-d1-database>' },
        },
      ]
    : [];
  const remainingDirectApiCalls = [
    {
      purpose: 'Resolve exactly one account from the Cloudflare token when CLOUDFLARE_ACCOUNT_ID is not supplied; block if multiple accounts are visible',
      method: 'GET',
      path: '/accounts?per_page=2',
      requiredWhen: !safeString(config.accountId),
    },
    {
      purpose: 'Create or reuse KV namespace for opaque action IDs and replay cache',
      method: 'POST',
      path: `/accounts/${accountId}/storage/kv/namespaces`,
      body: { title: config.resources?.actionKvTitle || '<action-kv-title>' },
    },
    ...docStorageCalls,
    {
      purpose: 'Upload agentBridgeWorker module with bindings and vars',
      method: 'PUT',
      path: `/accounts/${accountId}/workers/scripts/${workerName}`,
      multipartMetadata: metadata,
    },
    ...[
      ...REQUIRED_AGENT_BRIDGE_SECRET_NAMES,
      ...(config.telegramEnabled ? REQUIRED_AGENT_BRIDGE_TELEGRAM_SECRET_NAMES : []),
    ].map((name) => ({
      purpose: `Write ${name} as a Worker secret`,
      method: 'PUT',
      path: `/accounts/${accountId}/workers/scripts/${workerName}/secrets`,
      body: { name, type: 'secret_text', text: '<redacted-secret-value>' },
    })),
    ...OPTIONAL_AGENT_BRIDGE_SECRET_NAMES
      .filter((name) => config.secrets?.[name] === '[set]')
      .map((name) => ({
        purpose: `Write optional ${name} as a Worker secret`,
        method: 'PUT',
        path: `/accounts/${accountId}/workers/scripts/${workerName}/secrets`,
        body: { name, type: 'secret_text', text: '<redacted-secret-value>' },
      })),
    {
      purpose: 'Enable the script on the default workers.dev URL',
      method: 'POST',
      path: `/accounts/${accountId}/workers/scripts/${workerName}/subdomain`,
      body: { enabled: true },
    },
    {
      purpose: 'Create or change the account-level workers.dev subdomain only if the account has none or the operator requested a new one',
      method: 'PUT',
      path: `/accounts/${accountId}/workers/subdomain`,
      body: { subdomain: config.workersSubdomain || '<workers-subdomain>' },
      requiredPermission: WORKERS_DEV_SETUP_PERMISSION,
      requiredWhen: config.includeWorkersDevSubdomainSetup === true,
    },
  ].map((call, index) => ({ order: index + 1, ...call }));
  return {
    ok: true,
    workerName,
    accountId,
    accountLookup: config.accountLookup || null,
    publicUrl: safeString(config.vars?.AGENT_BRIDGE_PUBLIC_URL || buildWorkersDevUrl(workerName, config.workersSubdomain)),
    webhookUrl: config.telegramEnabled
      ? `${safeString(config.vars?.AGENT_BRIDGE_PUBLIC_URL || buildWorkersDevUrl(workerName, config.workersSubdomain)).replace(/\/+$/, '')}/telegram/webhook`
      : null,
    resources: config.resources,
    dedicatedSession: config.dedicatedSession,
    requiredTokenPermissions: buildAgentBridgeCloudflareTokenPermissions(config),
    optionalTokenPermissions: config.includeWorkersDevSubdomainSetup === true
      ? AGENT_BRIDGE_OPTIONAL_TOKEN_PERMISSIONS
      : [],
    remainingDirectApiCalls,
  };
}

function printUsage() {
  console.log([
    'Usage:',
    '  node workers/agentBridgeWorker/deployHelperPlan.mjs --worker-name ce-agent-bridge-worker --workers-subdomain <subdomain>',
    '',
    'Environment:',
    '  CLOUDFLARE_API_TOKEN',
    '  DEMO_SIGNER_ROOT_SECRET, AGENT_BRIDGE_AGENT_API_TOKEN',
    '  CE_SESSION_WORKER_BASE_URL, DEFAULT_CHAIN_ID, DEFAULT_RPC_URL',
    '  Optional Telegram adapter: TELEGRAM_BRIDGE_ENABLED=true plus TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, TELEGRAM_BOT_USERNAME',
    '  Optional: CLOUDFLARE_ACCOUNT_ID as a developer fallback, ADDITIONAL_RPC_URL',
    '  Optional: AGENT_BRIDGE_LIVE_ACCOUNT_LOOKUP=1 to make the Cloudflare account lookup call',
    '',
    'Flags:',
    '  --enable-doc-storage                    Also provision and bind bridge-owned R2/D1 demo storage resources',
    '  --enable-telegram                       Configure the optional Telegram adapter and bot actions',
    '  --include-workers-dev-subdomain-setup  Include Account Settings: Edit as an optional token scope when creating/changing the workers.dev subdomain',
    '  --live-account-lookup                  Resolve CLOUDFLARE_ACCOUNT_ID from CLOUDFLARE_API_TOKEN now; off by default',
    '  --json                                  Print JSON only',
  ].join('\n'));
}

const isEntrypoint = () => {
  const current = fileURLToPath(import.meta.url);
  const invoked = process.argv[1] ? resolve(process.argv[1]) : '';
  return current === invoked;
};

if (isEntrypoint()) {
  (async () => {
    const flags = parseArgs();
    if (flags.help) {
      printUsage();
    } else {
      const config = await resolveAgentBridgeDeployConfigForLive({ flags });
      const validation = validateAgentBridgeDeployConfig(config);
      const plan = buildAgentBridgeDeployPlan(config);
      console.log(JSON.stringify({ validation, plan }, null, 2));
    }
  })().catch((error) => {
    console.error(safeString(error?.message || error) || 'agent bridge deploy plan failed');
    process.exit(1);
  });
}
