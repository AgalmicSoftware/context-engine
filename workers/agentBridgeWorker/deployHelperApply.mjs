#!/usr/bin/env node

import { existsSync, readFileSync } from 'fs';
import { createRequire } from 'module';
import { dirname, extname, relative, resolve, sep } from 'path';
import { fileURLToPath } from 'url';
import {
  cfFetch,
  ensureWorkersDevSubdomain,
} from '../shared/deployHelperCore.mjs';
import {
  buildAgentBridgeDeployPlan,
  buildAgentBridgeWorkerUploadMetadata,
  OPTIONAL_AGENT_BRIDGE_SECRET_NAMES,
  REQUIRED_AGENT_BRIDGE_SECRET_NAMES,
  resolveAgentBridgeDeployConfigForLive,
  validateAgentBridgeDeployConfig,
} from './deployHelperPlan.mjs';

const WORKER_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ENV_FILE = resolve(WORKER_DIR, '.dev.vars');
const DEFAULT_ENTRYPOINT = 'worker.js';
const SCRIPT_CONTENT_TYPE = 'application/javascript+module';
const DEFAULT_TELEGRAM_BOT_NAME = 'Context Engine';
const TRUE_STRINGS = new Set(['1', 'true', 'yes', 'on']);
const require = createRequire(import.meta.url);
const TELEGRAM_BOT_COMMANDS = Object.freeze([
  { command: 'start', description: 'Open the Context Engine bot' },
  { command: 'sessions', description: 'List available sessions' },
  { command: 'questions', description: 'Questions' },
  { command: 'groups', description: 'Manage lightweight groups' },
  { command: 'add_question', description: 'Add a session question' },
  { command: 'results', description: 'Results' },
  { command: 'me', description: 'View account / get agent token' },
  { command: 'account', description: 'View your account' },
]);

function safeString(value) {
  return String(value || '').trim();
}

function envFlagEnabled(value = '') {
  return TRUE_STRINGS.has(safeString(value).toLowerCase());
}

function hasTemplatePlaceholder(value = '') {
  return /<[^>]+>/.test(safeString(value));
}

function stripInlineComment(value = '') {
  let quote = '';
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if ((char === '"' || char === "'") && value[index - 1] !== '\\') {
      quote = quote === char ? '' : (quote || char);
      continue;
    }
    if (char === '#' && !quote && /\s/.test(value[index - 1] || ' ')) {
      return value.slice(0, index).trim();
    }
  }
  return value.trim();
}

function unquoteEnvValue(value = '') {
  const trimmed = stripInlineComment(value);
  if (trimmed.length >= 2) {
    const first = trimmed[0];
    const last = trimmed[trimmed.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      if (first === '"') {
        try {
          return JSON.parse(trimmed);
        } catch {
          // Fall through to plain quote trimming for non-JSON-compatible values.
        }
      }
      return trimmed.slice(1, -1);
    }
  }
  return trimmed;
}

export function parseAgentBridgeEnvText(text = '') {
  const parsed = {};
  for (const rawLine of String(text || '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const normalized = line.startsWith('export ') ? line.slice('export '.length).trim() : line;
    const equalsIndex = normalized.indexOf('=');
    if (equalsIndex <= 0) continue;
    const key = normalized.slice(0, equalsIndex).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    parsed[key] = unquoteEnvValue(normalized.slice(equalsIndex + 1));
  }
  return parsed;
}

export function loadAgentBridgeApplyEnv({
  env = process.env,
  envFile = DEFAULT_ENV_FILE,
  readFileImpl = readFileSync,
  existsImpl = existsSync,
} = {}) {
  const resolvedEnvFile = envFile ? resolve(envFile) : '';
  const fileEnv = resolvedEnvFile && existsImpl(resolvedEnvFile)
    ? parseAgentBridgeEnvText(readFileImpl(resolvedEnvFile, 'utf8'))
    : {};
  return {
    env: {
      ...fileEnv,
      ...env,
    },
    envFile: resolvedEnvFile,
    envFileLoaded: !!Object.keys(fileEnv).length,
  };
}

export function parseAgentBridgeApplyArgs(argv = process.argv.slice(2)) {
  const flags = {};
  const booleanFlags = new Set([
    'apply',
    'dry-run',
    'enable-doc-storage',
    'help',
    'include-workers-dev-subdomain-setup',
    'json',
    'live-account-lookup',
    'skip-health-check',
    'skip-telegram-webhook',
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const token = safeString(argv[index]);
    if (!token) continue;
    if (!token.startsWith('--')) throw new Error(`Unexpected argument: ${token}`);
    const key = token.slice(2);
    if (!key) throw new Error('Encountered an empty flag.');
    if (booleanFlags.has(key)) {
      flags[key] = true;
      continue;
    }
    const value = argv[index + 1];
    if (typeof value !== 'string' || !value.trim() || value.startsWith('--')) {
      throw new Error(`Flag --${key} requires a value.`);
    }
    flags[key] = value.trim();
    index += 1;
  }
  return flags;
}

export async function fetchWorkersDevSubdomainForApply({
  apiToken = '',
  accountId = '',
  fetchImpl = globalThis.fetch,
} = {}) {
  const response = await cfFetch(
    apiToken,
    `/accounts/${safeString(accountId)}/workers/subdomain`,
    {},
    { fetchImpl }
  );
  if (!response.ok) {
    return {
      ok: false,
      status: response.status || 502,
      error: response.error || 'workers.dev subdomain lookup failed',
      subdomain: '',
      subdomainStatus: '',
    };
  }
  return {
    ok: true,
    status: response.status || 200,
    subdomain: safeString(response.data?.result?.subdomain),
    subdomainStatus: safeString(response.data?.result?.status),
  };
}

function needsWorkersDevLookup(config = {}) {
  return !safeString(config.workersSubdomain)
    || hasTemplatePlaceholder(config.vars?.AGENT_BRIDGE_PUBLIC_URL || '');
}

export async function resolveAgentBridgeApplyContext({
  flags = {},
  env = process.env,
  fetchImpl = globalThis.fetch,
} = {}) {
  const liveRequested = flags.apply === true;
  // Regression guard: plain dry-runs must stay offline; only --apply or an
  // explicit live account lookup may touch Cloudflare.
  const shouldUseNetwork = liveRequested || flags['live-account-lookup'] === true || envFlagEnabled(env.AGENT_BRIDGE_LIVE_ACCOUNT_LOOKUP);
  const configFlags = {
    ...flags,
    'live-account-lookup': shouldUseNetwork,
  };
  let resolvedEnv = { ...env };
  let config = await resolveAgentBridgeDeployConfigForLive({
    flags: configFlags,
    env: resolvedEnv,
    fetchImpl,
  });
  let workersDevLookup = null;

  if (shouldUseNetwork && config.accountId && needsWorkersDevLookup(config)) {
    workersDevLookup = await fetchWorkersDevSubdomainForApply({
      apiToken: flags['api-token'] || resolvedEnv.CLOUDFLARE_API_TOKEN,
      accountId: config.accountId,
      fetchImpl,
    });
    if (workersDevLookup.ok && workersDevLookup.subdomain) {
      resolvedEnv = {
        ...resolvedEnv,
        CLOUDFLARE_WORKERS_SUBDOMAIN: workersDevLookup.subdomain,
      };
      if (!safeString(resolvedEnv.AGENT_BRIDGE_PUBLIC_URL) || hasTemplatePlaceholder(resolvedEnv.AGENT_BRIDGE_PUBLIC_URL)) {
        resolvedEnv.AGENT_BRIDGE_PUBLIC_URL = `https://${config.workerName}.${workersDevLookup.subdomain}.workers.dev`;
      }
      config = await resolveAgentBridgeDeployConfigForLive({
        flags: configFlags,
        env: resolvedEnv,
        fetchImpl,
      });
    }
  }

  return {
    config,
    env: resolvedEnv,
    workersDevLookup,
  };
}

function pickResultArray(data = {}) {
  return Array.isArray(data?.result) ? data.result : [];
}

function findByNameOrTitle(items = [], expected = '') {
  const target = safeString(expected);
  return items.find((item) => safeString(item?.name || item?.title) === target) || null;
}

function normalizeCfFailure(step, response) {
  return {
    ok: false,
    step,
    status: response?.status || 502,
    error: response?.error || `${step} failed`,
    detail: response?.detail,
  };
}

export async function ensureAgentBridgeKvNamespace({
  apiToken = '',
  accountId = '',
  title = '',
  fetchImpl = globalThis.fetch,
} = {}) {
  const list = await cfFetch(apiToken, `/accounts/${accountId}/storage/kv/namespaces?per_page=100`, {}, { fetchImpl });
  if (!list.ok) return normalizeCfFailure('kv_namespace_list', list);
  const existing = findByNameOrTitle(pickResultArray(list.data), title);
  if (existing?.id) {
    return {
      ok: true,
      id: existing.id,
      title,
      reused: true,
    };
  }
  const created = await cfFetch(apiToken, `/accounts/${accountId}/storage/kv/namespaces`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  }, { fetchImpl });
  if (!created.ok) return normalizeCfFailure('kv_namespace_create', created);
  const id = safeString(created.data?.result?.id);
  if (!id) return { ok: false, step: 'kv_namespace_create', status: 502, error: 'Cloudflare did not return a KV namespace id.' };
  return {
    ok: true,
    id,
    title,
    reused: false,
  };
}

export async function ensureAgentBridgeR2Bucket({
  apiToken = '',
  accountId = '',
  bucketName = '',
  fetchImpl = globalThis.fetch,
} = {}) {
  const list = await cfFetch(apiToken, `/accounts/${accountId}/r2/buckets`, {}, { fetchImpl });
  if (!list.ok) return normalizeCfFailure('r2_bucket_list', list);
  const buckets = Array.isArray(list.data?.result?.buckets) ? list.data.result.buckets : [];
  const existing = findByNameOrTitle(buckets, bucketName);
  if (existing) {
    return {
      ok: true,
      name: bucketName,
      reused: true,
    };
  }
  const created = await cfFetch(apiToken, `/accounts/${accountId}/r2/buckets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: bucketName }),
  }, { fetchImpl });
  if (!created.ok) return normalizeCfFailure('r2_bucket_create', created);
  return {
    ok: true,
    name: safeString(created.data?.result?.name) || bucketName,
    reused: false,
  };
}

export async function ensureAgentBridgeD1Database({
  apiToken = '',
  accountId = '',
  databaseName = '',
  fetchImpl = globalThis.fetch,
} = {}) {
  const query = new URLSearchParams({ name: databaseName, per_page: '10' }).toString();
  const list = await cfFetch(apiToken, `/accounts/${accountId}/d1/database?${query}`, {}, { fetchImpl });
  if (!list.ok) return normalizeCfFailure('d1_database_list', list);
  const existing = findByNameOrTitle(pickResultArray(list.data), databaseName);
  if (existing?.uuid) {
    return {
      ok: true,
      id: existing.uuid,
      name: databaseName,
      reused: true,
    };
  }
  const created = await cfFetch(apiToken, `/accounts/${accountId}/d1/database`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: databaseName }),
  }, { fetchImpl });
  if (!created.ok) return normalizeCfFailure('d1_database_create', created);
  const id = safeString(created.data?.result?.uuid);
  if (!id) return { ok: false, step: 'd1_database_create', status: 502, error: 'Cloudflare did not return a D1 database uuid.' };
  return {
    ok: true,
    id,
    name: databaseName,
    reused: false,
  };
}

function toPosixPath(pathValue = '') {
  return pathValue.split(sep).join('/');
}

function resolveLocalModulePath(workerDir, fromRelativePath, specifier, existsImpl) {
  const fromDir = dirname(resolve(workerDir, fromRelativePath));
  const rawTarget = resolve(fromDir, specifier);
  const candidates = extname(rawTarget)
    ? [rawTarget]
    : [`${rawTarget}.mjs`, `${rawTarget}.js`];
  const target = candidates.find((candidate) => existsImpl(candidate));
  if (!target) {
    throw new Error(`Unable to resolve worker module import ${specifier} from ${fromRelativePath}`);
  }
  const relativeTarget = relative(workerDir, target);
  if (relativeTarget.startsWith('..') || resolve(workerDir, relativeTarget) !== target) {
    throw new Error(`Worker module import escapes worker directory: ${specifier}`);
  }
  return toPosixPath(relativeTarget);
}

function extractRelativeModuleSpecifiers(source = '') {
  const specifiers = [];
  const importExportPattern = /(?:import|export)\s+(?:[^'"]*?\s+from\s+)?['"](\.\/[^'"]+)['"]/g;
  for (const match of source.matchAll(importExportPattern)) {
    specifiers.push(match[1]);
  }
  return specifiers;
}

export function collectAgentBridgeWorkerModules({
  workerDir = WORKER_DIR,
  entrypoint = DEFAULT_ENTRYPOINT,
  readFileImpl = readFileSync,
  existsImpl = existsSync,
} = {}) {
  const visited = new Set();
  const modules = [];

  const visit = (relativePath) => {
    const normalizedPath = toPosixPath(relativePath);
    if (visited.has(normalizedPath)) return;
    visited.add(normalizedPath);
    const absolutePath = resolve(workerDir, normalizedPath);
    const source = String(readFileImpl(absolutePath, 'utf8'));
    modules.push({
      name: normalizedPath,
      source,
      contentType: SCRIPT_CONTENT_TYPE,
    });
    for (const specifier of extractRelativeModuleSpecifiers(source)) {
      visit(resolveLocalModulePath(workerDir, normalizedPath, specifier, existsImpl));
    }
  };

  visit(entrypoint);
  return modules;
}

function defaultEsbuildSync() {
  try {
    return require('esbuild').buildSync;
  } catch {
    throw new Error('esbuild is required to bundle agentBridgeWorker for deploy:apply. Run npm install from the repository root.');
  }
}

export function bundleAgentBridgeWorkerModule({
  workerDir = WORKER_DIR,
  entrypoint = DEFAULT_ENTRYPOINT,
  esbuildSyncImpl = defaultEsbuildSync(),
} = {}) {
  const result = esbuildSyncImpl({
    entryPoints: [resolve(workerDir, entrypoint)],
    absWorkingDir: workerDir,
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    write: false,
    sourcemap: false,
    legalComments: 'eof',
    logLevel: 'silent',
    mainFields: ['browser', 'module', 'main'],
  });
  const output = Array.isArray(result?.outputFiles) ? result.outputFiles[0] : null;
  const source = typeof output?.text === 'string'
    ? output.text
    : Buffer.from(output?.contents || '').toString('utf8');
  if (!source.trim()) {
    throw new Error('agentBridgeWorker bundle output is empty.');
  }
  return {
    name: entrypoint,
    source,
    contentType: SCRIPT_CONTENT_TYPE,
  };
}

function withCreatedBindings(metadata = {}, resources = {}) {
  return {
    ...metadata,
    main_module: DEFAULT_ENTRYPOINT,
    bindings: (metadata.bindings || []).map((binding) => {
      if (binding.name === 'AGENT_ACTION_KV') {
        return { ...binding, namespace_id: resources.kvNamespaceId };
      }
      if (binding.name === 'AGENT_DOCS_R2') {
        return { ...binding, bucket_name: resources.r2BucketName };
      }
      if (binding.name === 'AGENT_DOCS_D1') {
        return { ...binding, id: resources.d1DatabaseId };
      }
      return binding;
    }),
  };
}

export function buildAgentBridgeWorkerUploadForm({
  config = {},
  resourceIds = {},
  omitMigrations = false,
  workerDir = WORKER_DIR,
  readFileImpl = readFileSync,
  existsImpl = existsSync,
} = {}) {
  const metadata = withCreatedBindings(buildAgentBridgeWorkerUploadMetadata(config), resourceIds);
  if (omitMigrations) {
    delete metadata.migrations;
  }
  const bundledModule = bundleAgentBridgeWorkerModule({
    workerDir,
    entrypoint: DEFAULT_ENTRYPOINT,
  });
  const modules = [bundledModule];
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }), 'metadata.json');
  for (const module of modules) {
    form.append(module.name, new Blob([module.source], { type: module.contentType }), module.name);
  }
  return {
    form,
    metadata,
    modules: modules.map((module) => ({
      name: module.name,
      bytes: Buffer.byteLength(module.source),
    })),
  };
}

function isDurableObjectMigrationPreconditionFailure(response = {}) {
  const errorText = [
    response.error,
    ...(Array.isArray(response.detail) ? response.detail.map((entry) => entry?.message) : []),
  ].join('\n');
  return Number(response.status || 0) === 412
    && /migration tag precondition failed/i.test(errorText);
}

export async function uploadAgentBridgeWorker({
  apiToken = '',
  accountId = '',
  workerName = '',
  config = {},
  resourceIds = {},
  fetchImpl = globalThis.fetch,
  workerDir = WORKER_DIR,
  readFileImpl = readFileSync,
  existsImpl = existsSync,
} = {}) {
  const upload = buildAgentBridgeWorkerUploadForm({
    config,
    resourceIds,
    workerDir,
    readFileImpl,
    existsImpl,
  });
  const response = await cfFetch(apiToken, `/accounts/${accountId}/workers/scripts/${workerName}`, {
    method: 'PUT',
    body: upload.form,
  }, { fetchImpl });
  if (!response.ok && isDurableObjectMigrationPreconditionFailure(response)) {
    const retryUpload = buildAgentBridgeWorkerUploadForm({
      config,
      resourceIds,
      omitMigrations: true,
      workerDir,
      readFileImpl,
      existsImpl,
    });
    const retryResponse = await cfFetch(apiToken, `/accounts/${accountId}/workers/scripts/${workerName}`, {
      method: 'PUT',
      body: retryUpload.form,
    }, { fetchImpl });
    if (!retryResponse.ok) return normalizeCfFailure('worker_upload', retryResponse);
    return {
      ok: true,
      metadata: retryUpload.metadata,
      modules: retryUpload.modules,
      migrationRetry: 'omitted_existing_migration',
    };
  }
  if (!response.ok) return normalizeCfFailure('worker_upload', response);
  return {
    ok: true,
    metadata: upload.metadata,
    modules: upload.modules,
  };
}

export async function writeAgentBridgeWorkerSecrets({
  apiToken = '',
  accountId = '',
  workerName = '',
  env = {},
  fetchImpl = globalThis.fetch,
} = {}) {
  const written = [];
  const optionalSecretValues = {
    AGENT_BRIDGE_OPENAI_API_KEY: safeString(env.AGENT_BRIDGE_OPENAI_API_KEY || env.OPENAI_API_KEY || env.E2E_OPENAI_KEY),
  };
  const secrets = [
    ...REQUIRED_AGENT_BRIDGE_SECRET_NAMES.map((name) => ({
      name,
      text: safeString(env[name]),
      required: true,
    })),
    ...OPTIONAL_AGENT_BRIDGE_SECRET_NAMES
      .map((name) => ({
        name,
        text: optionalSecretValues[name] || safeString(env[name]),
        required: false,
      }))
      .filter((secret) => secret.text),
  ];
  for (const { name, text, required } of secrets) {
    if (!text) {
      if (!required) continue;
      return { ok: false, step: 'worker_secret_validate', status: 400, error: `${name} is missing.` };
    }
    const response = await cfFetch(apiToken, `/accounts/${accountId}/workers/scripts/${workerName}/secrets`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, type: 'secret_text', text }),
    }, { fetchImpl });
    if (!response.ok) return normalizeCfFailure(`worker_secret_${name}`, response);
    written.push(name);
  }
  return {
    ok: true,
    written,
  };
}

export async function setAgentBridgeTelegramWebhook({
  botToken = '',
  webhookUrl = '',
  webhookSecret = '',
  fetchImpl = globalThis.fetch,
} = {}) {
  let response;
  try {
    response = await fetchImpl(`https://api.telegram.org/bot${safeString(botToken)}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl,
        secret_token: webhookSecret,
        allowed_updates: ['message', 'callback_query'],
      }),
    });
  } catch (error) {
    return {
      ok: false,
      step: 'telegram_set_webhook',
      status: 502,
      error: `Telegram setWebhook request failed: ${safeString(error?.message || error) || 'unknown error'}`,
    };
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.ok !== true) {
    return {
      ok: false,
      step: 'telegram_set_webhook',
      status: response.status || 502,
      error: safeString(body?.description) || `Telegram setWebhook failed (${response.status || 502})`,
    };
  }
  return {
    ok: true,
    description: safeString(body?.description),
  };
}

export async function setAgentBridgeTelegramBotCommands({
  botToken = '',
  commands = TELEGRAM_BOT_COMMANDS,
  fetchImpl = globalThis.fetch,
} = {}) {
  let response;
  try {
    response = await fetchImpl(`https://api.telegram.org/bot${safeString(botToken)}/setMyCommands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commands }),
    });
  } catch (error) {
    return {
      ok: false,
      step: 'telegram_set_commands',
      status: 502,
      error: `Telegram setMyCommands request failed: ${safeString(error?.message || error) || 'unknown error'}`,
    };
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.ok !== true) {
    return {
      ok: false,
      step: 'telegram_set_commands',
      status: response.status || 502,
      error: safeString(body?.description) || `Telegram setMyCommands failed (${response.status || 502})`,
    };
  }
  return {
    ok: true,
    count: commands.length,
    commands: commands.map((command) => command.command),
  };
}

export async function setAgentBridgeTelegramBotName({
  botToken = '',
  name = DEFAULT_TELEGRAM_BOT_NAME,
  fetchImpl = globalThis.fetch,
} = {}) {
  const displayName = safeString(name) || DEFAULT_TELEGRAM_BOT_NAME;
  let response;
  try {
    response = await fetchImpl(`https://api.telegram.org/bot${safeString(botToken)}/setMyName`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: displayName }),
    });
  } catch (error) {
    return {
      ok: false,
      step: 'telegram_set_name',
      status: 502,
      error: `Telegram setMyName request failed: ${safeString(error?.message || error) || 'unknown error'}`,
    };
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.ok !== true) {
    return {
      ok: false,
      step: 'telegram_set_name',
      status: response.status || 502,
      error: safeString(body?.description) || `Telegram setMyName failed (${response.status || 502})`,
    };
  }
  return {
    ok: true,
    name: displayName,
  };
}

function telegramProfilePhotoContentType(pathValue = '') {
  const ext = extname(safeString(pathValue)).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  return 'application/octet-stream';
}

export async function setAgentBridgeTelegramBotProfilePhoto({
  botToken = '',
  photoPath = '',
  fetchImpl = globalThis.fetch,
  readFileImpl = readFileSync,
  existsImpl = existsSync,
} = {}) {
  const resolvedPath = safeString(photoPath) ? resolve(photoPath) : '';
  if (!resolvedPath) return { ok: true, skipped: true, reason: 'telegram_profile_photo_not_configured' };
  if (!existsImpl(resolvedPath)) {
    return {
      ok: false,
      step: 'telegram_set_profile_photo',
      status: 400,
      error: `Telegram profile photo was not found: ${resolvedPath}`,
    };
  }
  const bytes = readFileImpl(resolvedPath);
  const form = new FormData();
  form.append('photo', JSON.stringify({ type: 'static', photo: 'attach://photo_file' }));
  form.append('photo_file', new Blob([bytes], { type: telegramProfilePhotoContentType(resolvedPath) }), resolvedPath.split(sep).pop() || 'profile.jpg');
  let response;
  try {
    response = await fetchImpl(`https://api.telegram.org/bot${safeString(botToken)}/setMyProfilePhoto`, {
      method: 'POST',
      body: form,
    });
  } catch (error) {
    return {
      ok: false,
      step: 'telegram_set_profile_photo',
      status: 502,
      error: `Telegram setMyProfilePhoto request failed: ${safeString(error?.message || error) || 'unknown error'}`,
    };
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.ok !== true) {
    return {
      ok: false,
      step: 'telegram_set_profile_photo',
      status: response.status || 502,
      error: safeString(body?.description) || `Telegram setMyProfilePhoto failed (${response.status || 502})`,
    };
  }
  return {
    ok: true,
    path: resolvedPath,
    description: safeString(body?.description),
  };
}

export async function verifyAgentBridgeHealth({
  publicUrl = '',
  fetchImpl = globalThis.fetch,
} = {}) {
  const url = `${safeString(publicUrl).replace(/\/+$/, '')}/health`;
  let response;
  try {
    response = await fetchImpl(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
  } catch (error) {
    return {
      ok: false,
      step: 'health_check',
      status: 502,
      error: `Agent bridge health check request failed: ${safeString(error?.message || error) || 'unknown error'}`,
      url,
    };
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.ok !== true || body?.worker !== 'agentBridgeWorker') {
    return {
      ok: false,
      step: 'health_check',
      status: response.status || 502,
      error: `Agent bridge health check failed (${response.status || 502})`,
    };
  }
  return {
    ok: true,
    url,
    version: safeString(body?.version),
  };
}

function buildDryRunResult({ validation, plan, context }) {
  return {
    ok: validation.ok,
    dryRun: true,
    validation,
    plan,
    envFileLoaded: context.envFileLoaded,
    nextCommand: 'npm run deploy:apply -- --apply',
    liveCalls: [
      'derive Cloudflare account when CLOUDFLARE_ACCOUNT_ID is absent',
      'read or enable workers.dev subdomain',
      'create or reuse KV resources',
      'create or reuse R2 and D1 resources only when AGENT_BRIDGE_ENABLE_DOC_STORAGE=true or --enable-doc-storage is set',
      'upload agentBridgeWorker modules',
      'write Worker secrets through Cloudflare API',
      'set Telegram webhook with secret_token',
      'verify /health',
    ],
  };
}

function applyBlockedResult({ validation, plan }) {
  return {
    ok: false,
    dryRun: false,
    validation,
    plan,
    error: 'deploy:apply validation failed before making resource changes',
  };
}

export async function executeAgentBridgeDeployApply({
  flags = {},
  env = process.env,
  fetchImpl = globalThis.fetch,
  workerDir = WORKER_DIR,
  readFileImpl = readFileSync,
  existsImpl = existsSync,
  envFileLoaded = false,
} = {}) {
  const liveApply = flags.apply === true && flags['dry-run'] !== true;
  const applyContext = await resolveAgentBridgeApplyContext({
    flags,
    env,
    fetchImpl,
  });
  const { config, env: resolvedEnv } = applyContext;
  const validation = validateAgentBridgeDeployConfig(config);
  const plan = buildAgentBridgeDeployPlan(config);
  const context = { envFileLoaded };

  if (!liveApply) {
    return buildDryRunResult({ validation, plan, context });
  }
  if (!validation.ok) {
    return applyBlockedResult({ validation, plan });
  }

  const apiToken = flags['api-token'] || resolvedEnv.CLOUDFLARE_API_TOKEN;
  const accountId = config.accountId;
  const workerName = plan.workerName;
  const kv = await ensureAgentBridgeKvNamespace({
    apiToken,
    accountId,
    title: config.resources?.actionKvTitle,
    fetchImpl,
  });
  if (!kv.ok) return kv;
  const docStorageEnabled = config.resources?.enableDocStorage === true;
  const r2 = docStorageEnabled
    ? await ensureAgentBridgeR2Bucket({
        apiToken,
        accountId,
        bucketName: config.resources?.r2BucketName,
        fetchImpl,
      })
    : { ok: true, name: '', reused: false, skipped: true };
  if (!r2.ok) return r2;
  const d1 = docStorageEnabled
    ? await ensureAgentBridgeD1Database({
        apiToken,
        accountId,
        databaseName: config.resources?.d1DatabaseName,
        fetchImpl,
      })
    : { ok: true, id: '', reused: false, skipped: true };
  if (!d1.ok) return d1;

  const resourceIds = {
    kvNamespaceId: kv.id,
  };
  if (docStorageEnabled) {
    resourceIds.r2BucketName = r2.name;
    resourceIds.d1DatabaseId = d1.id;
  }

  const upload = await uploadAgentBridgeWorker({
    apiToken,
    accountId,
    workerName,
    config,
    resourceIds,
    fetchImpl,
    workerDir,
    readFileImpl,
    existsImpl,
  });
  if (!upload.ok) return upload;

  const secrets = await writeAgentBridgeWorkerSecrets({
    apiToken,
    accountId,
    workerName,
    env: resolvedEnv,
    fetchImpl,
  });
  if (!secrets.ok) return secrets;

  const workersDev = await ensureWorkersDevSubdomain({
    apiToken,
    accountId,
    workerName,
    requestedSubdomain: config.workersSubdomain,
    fetchImpl,
  });
  const publicUrl = safeString(workersDev.workerUrl).replace(/\/+$/, '') || plan.publicUrl;
  const webhookUrl = `${publicUrl.replace(/\/+$/, '')}/telegram/webhook`;

  const telegram = flags['skip-telegram-webhook'] === true
    ? { ok: true, skipped: true }
    : await (async () => {
      const webhook = await setAgentBridgeTelegramWebhook({
        botToken: resolvedEnv.TELEGRAM_BOT_TOKEN,
        webhookUrl,
        webhookSecret: resolvedEnv.TELEGRAM_WEBHOOK_SECRET,
        fetchImpl,
      });
      if (!webhook.ok) return webhook;
      const name = await setAgentBridgeTelegramBotName({
        botToken: resolvedEnv.TELEGRAM_BOT_TOKEN,
        name: resolvedEnv.TELEGRAM_BOT_NAME || resolvedEnv.AGENT_BRIDGE_TELEGRAM_BOT_NAME || DEFAULT_TELEGRAM_BOT_NAME,
        fetchImpl,
      });
      if (!name.ok) return name;
      const commands = await setAgentBridgeTelegramBotCommands({
        botToken: resolvedEnv.TELEGRAM_BOT_TOKEN,
        fetchImpl,
      });
      if (!commands.ok) return commands;
      const profilePhoto = await setAgentBridgeTelegramBotProfilePhoto({
        botToken: resolvedEnv.TELEGRAM_BOT_TOKEN,
        photoPath: resolvedEnv.TELEGRAM_BOT_PROFILE_PHOTO_PATH || resolvedEnv.AGENT_BRIDGE_TELEGRAM_BOT_PROFILE_PHOTO_PATH,
        fetchImpl,
        readFileImpl,
        existsImpl,
      });
      if (!profilePhoto.ok) return profilePhoto;
      return {
        ok: true,
        description: webhook.description,
        webhook,
        name,
        commands,
        profilePhoto,
      };
    })();
  if (!telegram.ok) return telegram;

  const health = flags['skip-health-check'] === true
    ? { ok: true, skipped: true }
    : await verifyAgentBridgeHealth({ publicUrl, fetchImpl });
  if (!health.ok) return health;

  return {
    ok: true,
    dryRun: false,
    workerName,
    accountId,
    publicUrl,
    webhookUrl,
    resources: {
      docStorageEnabled,
      kvNamespaceId: kv.id,
      kvReused: kv.reused,
      r2BucketName: docStorageEnabled ? r2.name : null,
      r2Reused: docStorageEnabled ? r2.reused : null,
      r2Skipped: !docStorageEnabled,
      d1DatabaseId: docStorageEnabled ? d1.id : null,
      d1Reused: docStorageEnabled ? d1.reused : null,
      d1Skipped: !docStorageEnabled,
    },
    upload: {
      moduleCount: upload.modules.length,
      mainModule: upload.metadata.main_module,
      migrationRetry: upload.migrationRetry || null,
    },
    secrets: {
      written: secrets.written,
    },
    workersDev: {
      subdomain: workersDev.subdomain,
      subdomainStatus: workersDev.subdomainStatus,
      subdomainEnabled: workersDev.subdomainEnabled,
      scriptSubdomainEnabled: workersDev.scriptSubdomainEnabled,
      subdomainError: workersDev.subdomainError,
      scriptSubdomainError: workersDev.scriptSubdomainError,
    },
    telegram,
    health,
  };
}

function printUsage() {
  console.log([
    'Usage:',
    '  npm run deploy:apply',
    '  npm run deploy:apply -- --apply',
    '',
    'Default behavior is a dry-run with no Cloudflare or Telegram mutations.',
    '',
    'Environment:',
    '  Reads workers/agentBridgeWorker/.dev.vars by default, then overlays process.env.',
    '  Keep TELEGRAM_BOT_TOKEN, CLOUDFLARE_API_TOKEN, TELEGRAM_WEBHOOK_SECRET, DEMO_SIGNER_ROOT_SECRET, and AGENT_BRIDGE_AGENT_API_TOKEN out of git.',
    '',
    'Flags:',
    '  --apply                         Execute live Cloudflare upload, Worker secret writes, Telegram setup, and health check',
    '  --enable-doc-storage            Also provision and bind bridge-owned R2/D1 demo storage resources',
    '  --env-file <path>               Read a different dotenv-style env file',
    '  --skip-telegram-webhook         Deploy without setting Telegram setWebhook or bot commands',
    '  --skip-health-check             Deploy without verifying /health',
    '  --include-workers-dev-subdomain-setup',
    '                                  Allow account-level workers.dev subdomain create/change when needed',
    '  --json                          Print JSON only',
    '  --help                          Show this help text',
  ].join('\n'));
}

const isEntrypoint = () => {
  const current = fileURLToPath(import.meta.url);
  const invoked = process.argv[1] ? resolve(process.argv[1]) : '';
  return current === invoked;
};

if (isEntrypoint()) {
  (async () => {
    const flags = parseAgentBridgeApplyArgs();
    if (flags.help) {
      printUsage();
      return;
    }
    const envFile = flags['env-file']
      ? resolve(process.cwd(), flags['env-file'])
      : DEFAULT_ENV_FILE;
    const loaded = loadAgentBridgeApplyEnv({ envFile });
    const result = await executeAgentBridgeDeployApply({
      flags,
      env: loaded.env,
      envFileLoaded: loaded.envFileLoaded,
    });
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) process.exit(1);
  })().catch((error) => {
    console.error(safeString(error?.message || error) || 'agent bridge deploy apply failed');
    process.exit(1);
  });
}
