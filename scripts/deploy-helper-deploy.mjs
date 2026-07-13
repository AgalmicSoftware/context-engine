#!/usr/bin/env node

import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { resolve } from 'path';
import {
  DEFAULT_COMPAT_DATE,
  cfFetch,
  ensureWorkersDevSubdomain,
  lookupCloudflareAccount,
  normalizeOriginList,
  parseAllowList,
  randomSecret,
  toStr,
} from '../workers/shared/deployHelperCore.mjs';
import { DEFAULT_WORKER_ALLOWED_ORIGINS } from '../client/src/utilities/worker/defaultWorkerAllowedOrigins.mjs';
import { buildWorkerBundles, WORKER_BUNDLE_TARGETS } from './worker-bundle.mjs';

export const DEFAULT_DEPLOY_HELPER_BUNDLE_PATH = WORKER_BUNDLE_TARGETS.deployHelper.outputRelativePath;
export const DEFAULT_SESSION_WORKER_BUNDLE_URL = 'https://github.com/AgalmicSoftware/context-engine/releases/latest/download/sessionCorsWorker.bundle.js';
export const DEFAULT_DEPLOY_HELPER_NAMESPACE_TITLE_PREFIX = 'ContextEngineDeployHelper';
export const DEFAULT_DEPLOY_HELPER_ALLOWED_ORIGINS = normalizeOriginList(DEFAULT_WORKER_ALLOWED_ORIGINS);

const BOOLEAN_FLAGS = new Set(['help', 'skip-build']);

export const parseArgs = (argv = process.argv.slice(2)) => {
  const flags = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = toStr(argv[index]).trim();
    if (!token) continue;
    if (!token.startsWith('--')) {
      throw new Error(`Unexpected argument: ${token}`);
    }
    const key = token.slice(2).trim();
    if (!key) throw new Error('Encountered an empty flag.');
    if (BOOLEAN_FLAGS.has(key)) {
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

export const printUsage = () => {
  console.log([
    'Usage:',
    '  npm run deploy-helper:deploy -- --worker-name ce-deploy-helper --api-token <cloudflare-token>',
    '  npm run deploy-helper:deploy -- --worker-name ce-deploy-helper --api-token <cloudflare-token> --allowed-origins https://app.example.com,http://localhost:3000',
    '',
    'Flags:',
    '  --worker-name <name>          Cloudflare worker script name for the deploy-helper',
    '  --api-token <token>           Cloudflare API token with Workers KV Storage + Workers Scripts edit scopes',
    '  --account-id <id>             Optional Cloudflare account ID (auto-resolved from the token when omitted)',
    '  --allowed-origins <csv>       Optional comma/newline-delimited origin allowlist written into ALLOWED_ORIGINS',
    '                                When omitted, seeds the hosted/local defaults used by /new before it prepends the current browser origin',
    '                                Self-hosted custom app origins are not discoverable here; pass --allowed-origins explicitly',
    '  --admin-secret <secret>       Optional ADMIN_SECRET (auto-generated when omitted)',
    '  --worker-bundle-url <url>     Optional default session worker bundle URL written into WORKER_BUNDLE_URL',
    '  --compatibility-date <date>   Optional helper compatibility date (default from deployHelperCore)',
    '  --worker-compat-date <date>   Optional WORKER_COMPATIBILITY_DATE binding for deployed session workers',
    '  --default-session-slug <slug> Optional DEFAULT_SESSION_SLUG binding for the helper',
    '  --bundle-path <path>          Optional helper bundle path (default dist/deployHelper.bundle.js)',
    '  --subdomain <value>           Optional workers.dev account subdomain to request when the account has none',
    '  --skip-build                  Use the existing bundle file instead of rebuilding it first',
    '  --help                        Show this help text',
    '',
    'Output:',
    '  Prints the deployed helper URL, KV namespace ID, workers.dev activation status, and the generated ADMIN_SECRET when one was created.',
  ].join('\n'));
};

export const resolveDeployHelperDeployConfig = ({
  flags = {},
  env = process.env,
  rootDir = process.cwd(),
} = {}) => {
  const apiToken = toStr(flags['api-token'] || env.CLOUDFLARE_API_TOKEN).trim();
  const workerName = toStr(flags['worker-name'] || env.DEPLOY_HELPER_WORKER_NAME).trim();
  const accountId = toStr(
    flags['account-id'] ||
    env.CLOUDFLARE_ACCOUNT_ID ||
    env.DEPLOY_HELPER_ACCOUNT_ID
  ).trim();
  const allowedOriginsInput = (
    flags['allowed-origins'] ||
    env.DEPLOY_HELPER_ALLOWED_ORIGINS ||
    env.ALLOWED_ORIGINS ||
    ''
  );
  const allowedOrigins = normalizeOriginList(
    parseAllowList(allowedOriginsInput).length
      ? parseAllowList(allowedOriginsInput)
      : DEFAULT_DEPLOY_HELPER_ALLOWED_ORIGINS
  );
  const adminSecret = toStr(
    flags['admin-secret'] ||
    env.DEPLOY_HELPER_ADMIN_SECRET ||
    env.ADMIN_SECRET
  ).trim();
  const workerBundleUrl = toStr(
    flags['worker-bundle-url'] ||
    env.DEPLOY_HELPER_WORKER_BUNDLE_URL ||
    env.WORKER_BUNDLE_URL ||
    DEFAULT_SESSION_WORKER_BUNDLE_URL
  ).trim();
  const compatibilityDate = toStr(
    flags['compatibility-date'] ||
    env.DEPLOY_HELPER_COMPATIBILITY_DATE ||
    DEFAULT_COMPAT_DATE
  ).trim() || DEFAULT_COMPAT_DATE;
  const workerCompatibilityDate = toStr(
    flags['worker-compat-date'] ||
    env.DEPLOY_HELPER_WORKER_COMPATIBILITY_DATE ||
    env.WORKER_COMPATIBILITY_DATE ||
    DEFAULT_COMPAT_DATE
  ).trim() || DEFAULT_COMPAT_DATE;
  const defaultSessionSlug = toStr(
    flags['default-session-slug'] ||
    env.DEPLOY_HELPER_DEFAULT_SESSION_SLUG ||
    env.DEFAULT_SESSION_SLUG
  ).trim();
  const bundlePath = resolve(rootDir, toStr(flags['bundle-path']).trim() || DEFAULT_DEPLOY_HELPER_BUNDLE_PATH);
  const namespaceTitle = `${DEFAULT_DEPLOY_HELPER_NAMESPACE_TITLE_PREFIX}:${workerName || 'deploy-helper'}`;
  const requestedSubdomain = toStr(flags.subdomain || env.DEPLOY_HELPER_SUBDOMAIN).trim();
  const skipBuild = flags['skip-build'] === true;

  if (!apiToken) throw new Error('Missing required Cloudflare API token. Pass --api-token or set CLOUDFLARE_API_TOKEN.');
  if (!workerName) throw new Error('Missing required worker name. Pass --worker-name or set DEPLOY_HELPER_WORKER_NAME.');

  return {
    apiToken,
    workerName,
    accountId,
    allowedOrigins,
    adminSecret,
    workerBundleUrl,
    compatibilityDate,
    workerCompatibilityDate,
    defaultSessionSlug,
    bundlePath,
    namespaceTitle,
    requestedSubdomain,
    skipBuild,
    rootDir,
  };
};

export const ensureDeployHelperBundle = async ({
  bundlePath,
  rootDir = process.cwd(),
  skipBuild = false,
} = {}) => {
  const resolvedBundlePath = resolve(rootDir, toStr(bundlePath).trim() || DEFAULT_DEPLOY_HELPER_BUNDLE_PATH);
  if (!skipBuild) {
    await buildWorkerBundles({
      rootDir,
      targetKeys: ['deployHelper'],
    });
  }
  if (!existsSync(resolvedBundlePath)) {
    throw new Error(`Deploy-helper bundle missing at ${resolvedBundlePath}. Run "npm run worker:bundle" or omit --skip-build.`);
  }
  return {
    bundlePath: resolvedBundlePath,
    bundleSource: readFileSync(resolvedBundlePath, 'utf8'),
  };
};

export const findKvNamespaceByTitle = async ({
  apiToken,
  accountId,
  title,
  fetchImpl = globalThis.fetch,
} = {}) => {
  const wantedTitle = toStr(title).trim();
  if (!wantedTitle) return null;
  let page = 1;
  const perPage = 100;
  while (page <= 20) {
    const listResp = await cfFetch(
      apiToken,
      `/accounts/${accountId}/storage/kv/namespaces?page=${page}&per_page=${perPage}`,
      {},
      { fetchImpl },
    );
    if (!listResp.ok) {
      throw new Error(listResp.error || 'Failed to list existing KV namespaces.');
    }
    const results = Array.isArray(listResp.data?.result) ? listResp.data.result : [];
    const match = results.find((entry) => toStr(entry?.title).trim() === wantedTitle);
    if (match?.id) {
      return {
        id: toStr(match.id).trim(),
        title: wantedTitle,
        reused: true,
      };
    }
    if (results.length < perPage) return null;
    page += 1;
  }
  return null;
};

export const ensureDeployHelperKvNamespace = async ({
  apiToken,
  accountId,
  namespaceTitle,
  fetchImpl = globalThis.fetch,
} = {}) => {
  const existing = await findKvNamespaceByTitle({
    apiToken,
    accountId,
    title: namespaceTitle,
    fetchImpl,
  });
  if (existing?.id) return existing;

  const createResp = await cfFetch(apiToken, `/accounts/${accountId}/storage/kv/namespaces`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: namespaceTitle }),
  }, { fetchImpl });
  if (!createResp.ok) {
    throw new Error(createResp.error || 'Failed to create deploy-helper KV namespace.');
  }
  const namespaceId = toStr(createResp.data?.result?.id).trim();
  if (!namespaceId) {
    throw new Error('Cloudflare did not return a KV namespace ID for the deploy-helper.');
  }
  return {
    id: namespaceId,
    title: namespaceTitle,
    reused: false,
  };
};

export const buildDeployHelperUploadMetadata = ({
  kvNamespaceId,
  allowedOrigins = [],
  workerBundleUrl = '',
  compatibilityDate = DEFAULT_COMPAT_DATE,
  workerCompatibilityDate = DEFAULT_COMPAT_DATE,
  defaultSessionSlug = '',
} = {}) => {
  const bindings = [
    { name: 'DEPLOY_HELPER_KV', type: 'kv_namespace', namespace_id: kvNamespaceId },
  ];
  const normalizedOrigins = normalizeOriginList(allowedOrigins);
  if (normalizedOrigins.length) {
    bindings.push({
      name: 'ALLOWED_ORIGINS',
      type: 'plain_text',
      text: normalizedOrigins.join(','),
    });
  }
  if (toStr(workerBundleUrl).trim()) {
    bindings.push({
      name: 'WORKER_BUNDLE_URL',
      type: 'plain_text',
      text: toStr(workerBundleUrl).trim(),
    });
  }
  if (toStr(workerCompatibilityDate).trim()) {
    bindings.push({
      name: 'WORKER_COMPATIBILITY_DATE',
      type: 'plain_text',
      text: toStr(workerCompatibilityDate).trim(),
    });
  }
  if (toStr(defaultSessionSlug).trim()) {
    bindings.push({
      name: 'DEFAULT_SESSION_SLUG',
      type: 'plain_text',
      text: toStr(defaultSessionSlug).trim(),
    });
  }
  return {
    main_module: 'worker.mjs',
    bindings,
    compatibility_date: toStr(compatibilityDate).trim() || DEFAULT_COMPAT_DATE,
    compatibility_flags: ['nodejs_compat'],
  };
};

export const deployDeployHelperWorker = async ({
  apiToken,
  workerName,
  accountId = '',
  allowedOrigins = [],
  adminSecret = '',
  workerBundleUrl = DEFAULT_SESSION_WORKER_BUNDLE_URL,
  compatibilityDate = DEFAULT_COMPAT_DATE,
  workerCompatibilityDate = DEFAULT_COMPAT_DATE,
  defaultSessionSlug = '',
  namespaceTitle = '',
  requestedSubdomain = '',
  bundleSource = '',
  fetchImpl = globalThis.fetch,
} = {}) => {
  const resolvedBundleSource = toStr(bundleSource);
  if (!resolvedBundleSource.trim()) {
    throw new Error('Missing deploy-helper bundle source.');
  }
  const resolvedWorkerName = toStr(workerName).trim();
  if (!resolvedWorkerName) {
    throw new Error('Missing deploy-helper worker name.');
  }
  let resolvedAccountId = toStr(accountId).trim();
  if (!resolvedAccountId) {
    const lookup = await lookupCloudflareAccount({ apiToken, fetchImpl });
    if (!lookup.ok) {
      throw new Error(lookup.error || 'Failed to resolve a Cloudflare account for the deploy-helper.');
    }
    resolvedAccountId = toStr(lookup.accountId).trim();
  }
  if (!resolvedAccountId) {
    throw new Error('Failed to resolve a Cloudflare account for the deploy-helper.');
  }

  const generatedAdminSecret = !toStr(adminSecret).trim();
  const finalAdminSecret = generatedAdminSecret ? randomSecret() : toStr(adminSecret).trim();
  const kvNamespace = await ensureDeployHelperKvNamespace({
    apiToken,
    accountId: resolvedAccountId,
    namespaceTitle: namespaceTitle || `${DEFAULT_DEPLOY_HELPER_NAMESPACE_TITLE_PREFIX}:${resolvedWorkerName}`,
    fetchImpl,
  });
  const metadata = buildDeployHelperUploadMetadata({
    kvNamespaceId: kvNamespace.id,
    allowedOrigins,
    workerBundleUrl,
    compatibilityDate,
    workerCompatibilityDate,
    defaultSessionSlug,
  });

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }), 'metadata.json');
  form.append('worker.mjs', new Blob([resolvedBundleSource], { type: 'application/javascript+module' }), 'worker.mjs');

  const scriptUpload = await cfFetch(apiToken, `/accounts/${resolvedAccountId}/workers/scripts/${resolvedWorkerName}`, {
    method: 'PUT',
    body: form,
  }, { fetchImpl });
  if (!scriptUpload.ok) {
    throw new Error(scriptUpload.error || 'Failed to upload the deploy-helper worker.');
  }

  const secretResp = await cfFetch(apiToken, `/accounts/${resolvedAccountId}/workers/scripts/${resolvedWorkerName}/secrets`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'ADMIN_SECRET', type: 'secret_text', text: finalAdminSecret }),
  }, { fetchImpl });
  if (!secretResp.ok) {
    throw new Error(secretResp.error || 'Failed to write ADMIN_SECRET for the deploy-helper.');
  }

  const workersDev = await ensureWorkersDevSubdomain({
    apiToken,
    accountId: resolvedAccountId,
    workerName: resolvedWorkerName,
    requestedSubdomain,
    fetchImpl,
  });

  return {
    ok: true,
    workerName: resolvedWorkerName,
    accountId: resolvedAccountId,
    kvNamespaceId: kvNamespace.id,
    kvNamespaceTitle: kvNamespace.title,
    reusedKvNamespace: kvNamespace.reused === true,
    workerUrl: workersDev.workerUrl,
    allowedOrigins: normalizeOriginList(allowedOrigins),
    workerBundleUrl: toStr(workerBundleUrl).trim(),
    generatedAdminSecret,
    adminSecret: generatedAdminSecret ? finalAdminSecret : '',
    subdomain: workersDev.subdomain,
    subdomainStatus: workersDev.subdomainStatus,
    subdomainEnabled: workersDev.subdomainEnabled,
    subdomainError: workersDev.subdomainError,
    scriptSubdomainEnabled: workersDev.scriptSubdomainEnabled,
    scriptSubdomainError: workersDev.scriptSubdomainError,
  };
};

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
      const config = resolveDeployHelperDeployConfig({ flags });
      const { bundlePath, bundleSource } = await ensureDeployHelperBundle({
        bundlePath: config.bundlePath,
        rootDir: config.rootDir,
        skipBuild: config.skipBuild,
      });
      const result = await deployDeployHelperWorker({
        ...config,
        bundleSource,
      });
      const summary = {
        ...result,
        bundlePath,
      };
      console.log(JSON.stringify(summary, null, 2));
      if (result.generatedAdminSecret) {
        console.error(`Generated ADMIN_SECRET for ${result.workerName}: ${result.adminSecret}`);
      }
      if (!result.workerUrl) {
        console.error('Deploy-helper upload succeeded, but workers.dev URL was not confirmed. Check the returned subdomain fields.');
      }
    }
  } catch (error) {
    console.error(toStr(error?.message || error).trim() || 'deploy-helper deployment failed');
    process.exit(1);
  }
}
