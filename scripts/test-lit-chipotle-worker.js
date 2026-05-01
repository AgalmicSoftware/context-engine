'use strict';

const path = require('node:path');
const { Wallet } = require('ethers');

const {
  addStep,
  buildTimestampedSlug,
  createBaseReport,
  parseArgs,
  relRoot,
  resolveArtifacts,
  resolveRunTag,
  toBool,
  toStr,
  writeJson,
} = require('./lib/common.js');

const DEFAULT_LIT_API_BASE = 'https://api.chipotle.litprotocol.com';
const DEFAULT_LOCAL_ADMIN_ORIGIN = 'http://localhost:3000';
const DEFAULT_LOCAL_WORKER_URL = 'https://worker.local.test';
const DEFAULT_LOCAL_ADMIN_PRIVATE_KEY = '0x59c6995e998f97a5a0044976f84ce7de5d9d7f17b2f6a6a5f76f8864c8ad88f5';
const DEFAULT_TOKEN_HMAC_SECRET = 'ce-e2e-lit-chipotle-secret';

class MemoryKv {
  constructor() {
    this.store = new Map();
  }

  async get(key) {
    const hit = this.store.get(String(key));
    if (!hit) return null;
    if (hit.expiresAtMs && Date.now() >= hit.expiresAtMs) {
      this.store.delete(String(key));
      return null;
    }
    return hit.value;
  }

  async put(key, value, opts = {}) {
    const ttl = Number(opts?.expirationTtl || 0);
    const expiresAtMs = ttl > 0 ? Date.now() + ttl * 1000 : 0;
    this.store.set(String(key), {
      value: String(value),
      expiresAtMs,
    });
  }

  async delete(key) {
    this.store.delete(String(key));
  }
}

const parseJsonEnv = (value, fallback) => {
  const trimmed = toStr(value).trim();
  if (!trimmed) return fallback;
  return JSON.parse(trimmed);
};

const resolveArtifactControls = ({
  env = process.env,
  args = {},
} = {}) => {
  const rawPersist = args['persist-artifacts'] ?? env.LIT_E2E_PERSIST_ARTIFACTS;
  const artifactJsonPath = toStr(args['artifact-json'] || env.LIT_E2E_ARTIFACT_JSON).trim();
  return {
    persistArtifacts: rawPersist === undefined || rawPersist === ''
      ? true
      : toBool(rawPersist),
    artifactJsonPath,
  };
};

const buildLitCredentialsConfig = (config = {}) => {
  const out = {};
  [
    ['litApiBase', config.litApiBase],
    ['litGroupId', config.litGroupId],
    ['litPkpId', config.litPkpId],
    ['litActionCid', config.litActionCid],
  ].forEach(([key, value]) => {
    const trimmed = toStr(value).trim();
    if (trimmed) out[key] = trimmed;
  });
  return out;
};

const buildSecretPayload = (config = {}) => {
  const out = {};
  if (config.usageApiKey && !config.useWorkerEnvFallback) {
    out.litUsageApiKey = config.usageApiKey;
  }
  if (config.customRpcUrl) out.customRpcUrl = config.customRpcUrl;
  if (config.customRpcKey) out.customRpcKey = config.customRpcKey;
  return out;
};

const resolveLitChipotleE2eConfig = ({
  env = process.env,
  args = {},
} = {}) => {
  const usageApiKey = toStr(args['lit-usage-api-key'] || env.LIT_USAGE_API_KEY).trim();
  const accountApiKey = toStr(args['lit-account-api-key'] || env.LIT_ACCOUNT_API_KEY).trim();
  const litActionCid = toStr(args['lit-action-cid'] || env.LIT_ACTION_CID).trim();
  return {
    runTag: resolveRunTag(args, env),
    sessionSlug: toStr(args['session-slug'] || env.SESSION_SLUG).trim() || buildTimestampedSlug({
      prefix: 'e2e-lit-chipotle',
      runTag: resolveRunTag(args, env),
    }),
    litApiBase: toStr(args['lit-api-base'] || env.LIT_API_BASE || DEFAULT_LIT_API_BASE).trim() || DEFAULT_LIT_API_BASE,
    usageApiKey,
    accountApiKey,
    litGroupId: toStr(args['lit-group-id'] || env.LIT_GROUP_ID).trim(),
    litPkpId: toStr(args['lit-pkp-id'] || env.LIT_PKP_ID).trim(),
    litActionCid,
    customRpcUrl: toStr(args['custom-rpc-url'] || env.CUSTOM_RPC_URL).trim(),
    customRpcKey: toStr(args['custom-rpc-key'] || env.CUSTOM_RPC_KEY).trim(),
    useWorkerEnvFallback: toBool(args['use-worker-env-fallback'] || env.LIT_E2E_USE_WORKER_ENV_FALLBACK),
    origin: toStr(args.origin || env.LIT_E2E_ADMIN_ORIGIN || DEFAULT_LOCAL_ADMIN_ORIGIN).trim() || DEFAULT_LOCAL_ADMIN_ORIGIN,
    workerUrl: toStr(args['worker-url'] || env.LIT_E2E_WORKER_URL || DEFAULT_LOCAL_WORKER_URL).trim() || DEFAULT_LOCAL_WORKER_URL,
    tokenSecret: toStr(args['token-secret'] || env.TOKEN_HMAC_SECRET || DEFAULT_TOKEN_HMAC_SECRET).trim() || DEFAULT_TOKEN_HMAC_SECRET,
    adminPrivateKey: toStr(args['admin-private-key'] || env.LIT_CHIPOTLE_ADMIN_PRIVATE_KEY || DEFAULT_LOCAL_ADMIN_PRIVATE_KEY).trim() || DEFAULT_LOCAL_ADMIN_PRIVATE_KEY,
    inlineCode: toStr(args.code || env.LIT_E2E_INLINE_CODE).trim(),
    jsParams: parseJsonEnv(args['js-params-json'] || env.LIT_E2E_JS_PARAMS_JSON, undefined),
  };
};

const buildWorkerEnv = (config = {}) => {
  const env = {
    GROUP_KV: new MemoryKv(),
    TOKEN_HMAC_SECRET: config.tokenSecret,
    DEFAULT_SESSION_SLUG: '',
    DEFAULT_GROUP_SLUG: '',
  };

  if (config.accountApiKey) env.LIT_ACCOUNT_API_KEY = config.accountApiKey;
  if (config.litApiBase) env.LIT_API_BASE = config.litApiBase;
  if (config.usageApiKey && config.useWorkerEnvFallback) {
    env.LIT_USAGE_API_KEY = config.usageApiKey;
  }
  return env;
};

const parseWorkerResponse = async (response) => {
  const text = await response.text().catch(() => '');
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
};

const invokeWorkerJson = async ({
  worker,
  env,
  workerUrl,
  path: requestPath,
  method = 'POST',
  body,
  headers = {},
} = {}) => {
  const response = await worker.fetch(new Request(`${workerUrl}${requestPath}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  }), env, { waitUntil() {} });

  return {
    ok: response.ok,
    status: response.status,
    body: await parseWorkerResponse(response),
  };
};

const loadWorkerModule = async () => {
  const mod = await import(path.join('file://', __dirname, '..', 'workers', 'sessionCorsWorker', 'worker.js'));
  return mod?.default || mod;
};

const loadAdminTypedDataModule = async () => import(path.join('file://', __dirname, '..', 'workers', 'sessionCorsWorker', 'adminTypedData.mjs'));

const requestAdminNonce = async ({
  worker,
  env,
  workerUrl,
  origin,
  address,
  sessionSlug,
} = {}) => {
  const response = await invokeWorkerJson({
    worker,
    env,
    workerUrl,
    path: '/auth/nonce',
    body: {
      address,
      sessionSlug,
      adminAction: true,
    },
    headers: {
      Origin: origin,
    },
  });
  return response;
};

const buildSignedAdminActionBody = async ({
  wallet,
  action,
  sessionSlug,
  body,
  audience,
  nonce,
  expiration,
} = {}) => {
  const typedDataModule = await loadAdminTypedDataModule();
  const bodyHash = typedDataModule.buildAdminActionBodyHash(body);
  const typedData = typedDataModule.buildAdminActionTypedData({
    action,
    slug: sessionSlug,
    bodyHash,
    nonce,
    audience,
    expiration,
  });
  const signature = await wallet._signTypedData(
    typedData.domain,
    { AdminAction: typedData.types.AdminAction },
    typedData.message,
  );

  return {
    ...body,
    address: wallet.address,
    signature,
    action,
    slug: sessionSlug,
    bodyHash,
    nonce,
    audience,
    expiration,
  };
};

const postSignedAdminAction = async ({
  worker,
  env,
  workerUrl,
  origin,
  wallet,
  action,
  sessionSlug,
  body,
  now = Date.now,
} = {}) => {
  const nonceResponse = await requestAdminNonce({
    worker,
    env,
    workerUrl,
    origin,
    address: wallet.address,
    sessionSlug,
  });
  if (!nonceResponse.ok || !toStr(nonceResponse.body?.nonce).trim()) {
    return {
      ok: false,
      status: nonceResponse.status,
      body: nonceResponse.body,
      requestBody: null,
    };
  }

  const expiration = Math.floor((typeof now === 'function' ? now() : Date.now()) / 1000) + (5 * 60);
  const signedBody = await buildSignedAdminActionBody({
    wallet,
    action,
    sessionSlug,
    body,
    audience: origin,
    nonce: nonceResponse.body.nonce,
    expiration,
  });

  const response = await invokeWorkerJson({
    worker,
    env,
    workerUrl,
    path: `/admin/${action}`,
    body: signedBody,
    headers: {
      Origin: origin,
    },
  });
  return {
    ...response,
    requestBody: signedBody,
  };
};

const ensureKeyPresent = (config = {}) => {
  if (config.usageApiKey || config.accountApiKey) return;
  throw new Error('Missing Lit key. Set LIT_USAGE_API_KEY or LIT_ACCOUNT_API_KEY in .env.e2e.local.');
};

async function runLitChipotleWorkerSmokeTest({
  env = process.env,
  args = {},
  fetchImpl = global.fetch,
  now = Date.now,
  worker = null,
  persistArtifacts = true,
  artifactsOverride = null,
} = {}) {
  const config = resolveLitChipotleE2eConfig({ env, args });
  const artifacts = artifactsOverride || resolveArtifacts({
    runTag: config.runTag,
    baseName: 'lit-chipotle-worker',
  });
  const report = createBaseReport({
    flowId: 'CE-E2E-LIT-CHIPOTLE-WORKER',
    runner: path.basename(__filename),
    runTag: config.runTag,
    chain: {},
    inputs: {
      sessionSlug: config.sessionSlug,
      litApiBase: config.litApiBase,
      hasUsageApiKey: !!config.usageApiKey,
      hasAccountApiKey: !!config.accountApiKey,
      litGroupId: config.litGroupId || null,
      litPkpId: config.litPkpId || null,
      litActionCid: config.litActionCid || null,
      useWorkerEnvFallback: config.useWorkerEnvFallback,
    },
    outputs: {
      json: relRoot(artifacts.json),
    },
  });
  if (persistArtifacts) {
    writeJson(artifacts.json, report);
  }

  const workerEnv = buildWorkerEnv(config);
  const secretPayload = buildSecretPayload(config);
  const wallet = new Wallet(config.adminPrivateKey);
  const loadedWorker = worker || await loadWorkerModule();

  const originalFetch = global.fetch;
  if (typeof fetchImpl === 'function') {
    global.fetch = fetchImpl;
  }

  try {
    ensureKeyPresent(config);

    const configBody = {
      sessionSlug: config.sessionSlug,
      adminAddress: wallet.address,
      config: {
        adminAddress: wallet.address,
        allowOrigins: [config.origin],
        litCredentials: buildLitCredentialsConfig(config),
      },
    };

    addStep(report, { phase: 'admin', name: 'set-config' });
    const setConfigResponse = await postSignedAdminAction({
      worker: loadedWorker,
      env: workerEnv,
      workerUrl: config.workerUrl,
      origin: config.origin,
      wallet,
      action: 'set-config',
      sessionSlug: config.sessionSlug,
      body: configBody,
      now,
    });
    report.setConfig = {
      status: setConfigResponse.status,
      ok: !!setConfigResponse.body?.ok,
      response: setConfigResponse.body,
    };
    if (!setConfigResponse.ok || !setConfigResponse.body?.ok) {
      throw new Error(`set-config failed (${setConfigResponse.status}): ${toStr(setConfigResponse.body?.error || setConfigResponse.body?.message || 'Unknown error')}`);
    }

    if (Object.keys(secretPayload).length) {
      addStep(report, { phase: 'admin', name: 'set-secrets' });
      const setSecretsResponse = await postSignedAdminAction({
        worker: loadedWorker,
        env: workerEnv,
        workerUrl: config.workerUrl,
        origin: config.origin,
        wallet,
        action: 'set-secrets',
        sessionSlug: config.sessionSlug,
        body: {
          sessionSlug: config.sessionSlug,
          secrets: secretPayload,
        },
        now,
      });
      report.setSecrets = {
        status: setSecretsResponse.status,
        ok: !!setSecretsResponse.body?.ok,
        response: setSecretsResponse.body,
      };
      if (!setSecretsResponse.ok || !setSecretsResponse.body?.ok) {
        throw new Error(`set-secrets failed (${setSecretsResponse.status}): ${toStr(setSecretsResponse.body?.error || setSecretsResponse.body?.message || 'Unknown error')}`);
      }
    }

    addStep(report, { phase: 'admin', name: 'lit-chipotle-status' });
    const statusResponse = await postSignedAdminAction({
      worker: loadedWorker,
      env: workerEnv,
      workerUrl: config.workerUrl,
      origin: config.origin,
      wallet,
      action: 'lit-chipotle-status',
      sessionSlug: config.sessionSlug,
      body: {
        sessionSlug: config.sessionSlug,
      },
      now,
    });
    report.statusCheck = {
      status: statusResponse.status,
      ok: !!statusResponse.body?.ok,
      response: statusResponse.body,
    };
    if (!statusResponse.ok || !statusResponse.body?.ok) {
      throw new Error(`lit-chipotle-status failed (${statusResponse.status}): ${toStr(statusResponse.body?.error || statusResponse.body?.message || 'Unknown error')}`);
    }

    report.ok = true;
    return report;
  } catch (error) {
    report.ok = false;
    report.error = {
      message: toStr(error?.message || error) || 'Unknown Lit Chipotle smoke-test failure.',
    };
    return report;
  } finally {
    if (typeof fetchImpl === 'function') {
      global.fetch = originalFetch;
    }
    if (persistArtifacts) {
      writeJson(artifacts.json, report);
    }
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const artifactControls = resolveArtifactControls({
    env: process.env,
    args,
  });
  const artifactBase = resolveArtifacts({
    runTag: resolveLitChipotleE2eConfig({ env: process.env, args }).runTag,
    baseName: 'lit-chipotle-worker',
  });
  const report = await runLitChipotleWorkerSmokeTest({
    env: process.env,
    args,
    persistArtifacts: artifactControls.persistArtifacts,
    artifactsOverride: artifactControls.artifactJsonPath
      ? {
        ...artifactBase,
        json: path.resolve(artifactControls.artifactJsonPath),
      }
      : null,
  });
  console.log(JSON.stringify({
    ok: !!report.ok,
    outPath: report?.outputs?.json || null,
    sessionSlug: report?.inputs?.sessionSlug || null,
    error: report?.error?.message || null,
  }, null, 2));
  if (!report.ok) process.exitCode = 1;
}

module.exports = {
  DEFAULT_LIT_API_BASE,
  DEFAULT_LOCAL_ADMIN_ORIGIN,
  DEFAULT_LOCAL_ADMIN_PRIVATE_KEY,
  DEFAULT_LOCAL_WORKER_URL,
  MemoryKv,
  invokeWorkerJson,
  loadWorkerModule,
  requestAdminNonce,
  buildSignedAdminActionBody,
  postSignedAdminAction,
  buildLitCredentialsConfig,
  buildSecretPayload,
  buildWorkerEnv,
  resolveArtifactControls,
  resolveLitChipotleE2eConfig,
  runLitChipotleWorkerSmokeTest,
};

if (require.main === module) {
  main().catch((error) => {
    console.error('[lit-chipotle-worker]', error?.message || error);
    process.exit(1);
  });
}
