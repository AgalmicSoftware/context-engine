'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { Wallet, ethers } = require('ethers');

const {
  addStep,
  createBaseReport,
  parseArgs,
  relRoot,
  resolveArtifacts,
  toBool,
  toStr,
  writeJson,
} = require('./lib/common.js');

const {
  DEFAULT_LOCAL_ADMIN_ORIGIN,
  DEFAULT_LOCAL_WORKER_URL,
  buildLitCredentialsConfig,
  buildWorkerEnv,
  loadWorkerModule,
  postSignedAdminAction,
  resolveLitChipotleE2eConfig,
} = require('./test-lit-chipotle-worker.js');

const DEFAULT_TOKEN_HMAC_SECRET = 'ce-e2e-lit-chipotle-secret';
const DEFAULT_GATE_MODE = 'any';
const DEFAULT_MESSAGE_HEX = `0x${'11'.repeat(32)}`;
const DEFAULT_ACTION_CATALOG_CANDIDATES = [
  path.join(__dirname, '..', 'client', 'src', 'utilities', 'crypto', 'litChipotleCatalog.js'),
  path.join(__dirname, '..', 'client', 'src', 'utilities', 'crypto', 'litChipotleCatalog.ts'),
];

const normalizeGateMode = (value) => (
  toStr(value).trim().toLowerCase() === 'all' ? 'all' : 'any'
);

const normalizeAddressList = (values = []) => {
  const out = [];
  const seen = new Set();
  (Array.isArray(values) ? values : []).forEach((raw) => {
    const trimmed = toStr(raw).trim();
    if (!trimmed || !ethers.utils.isAddress(trimmed)) return;
    const normalized = ethers.utils.getAddress(trimmed);
    const dedupeKey = normalized.toLowerCase();
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    out.push(normalized);
  });
  return out;
};

const parseAddressList = (jsonValue, csvValue) => {
  const jsonRaw = toStr(jsonValue).trim();
  if (jsonRaw) {
    const parsed = JSON.parse(jsonRaw);
    return normalizeAddressList(parsed);
  }
  const csvRaw = toStr(csvValue).trim();
  if (!csvRaw) return [];
  return normalizeAddressList(csvRaw.split(','));
};

const normalizeHexMessage = (value) => {
  const normalized = toStr(value).trim() || DEFAULT_MESSAGE_HEX;
  if (!/^0x[0-9a-f]{64}$/i.test(normalized)) {
    throw new Error('LIT_E2E_MESSAGE_HEX must be a 32-byte 0x-prefixed hex string.');
  }
  return normalized.toLowerCase();
};

const parseActionResponse = (payload) => {
  if (payload && typeof payload === 'object' && payload.response && typeof payload.response === 'object') {
    if (payload.response.response && typeof payload.response.response === 'object') {
      return payload.response.response;
    }
    return payload.response;
  }
  return payload && typeof payload === 'object' ? payload : {};
};

const loadDefaultChipotleActionCode = ({
  explicitCode = '',
  explicitPath = '',
} = {}) => {
  const direct = toStr(explicitCode);
  if (direct.trim()) return direct;

  const candidates = [];
  const overridePath = toStr(explicitPath).trim();
  if (overridePath) candidates.push(path.resolve(overridePath));
  candidates.push(...DEFAULT_ACTION_CATALOG_CANDIDATES);

  for (const filePath of candidates) {
    if (!filePath || !fs.existsSync(filePath)) continue;
    const source = fs.readFileSync(filePath, 'utf8');
    const match = source.match(/DEFAULT_CHIPOTLE_ACTION_CODE\s*=\s*`([\s\S]*?)`;/);
    if (match && match[1]) return match[1];
  }

  throw new Error('Unable to load the default Chipotle action code from the repo catalog.');
};

const buildRuntimeSecretPayload = (config = {}) => {
  const out = {};
  if (config.usageApiKey && !config.useWorkerEnvFallback) {
    out.litUsageApiKey = config.usageApiKey;
  }
  if (config.accountApiKey && !config.useWorkerEnvFallback) {
    out.litAccountApiKey = config.accountApiKey;
  }
  if (config.customRpcUrl) out.customRpcUrl = config.customRpcUrl;
  if (config.customRpcKey) out.customRpcKey = config.customRpcKey;
  return out;
};

const signSyntheticWorkerToken = async ({
  address,
  slug,
  tokenSecret,
  scopes = { lit: true },
  now = Date.now,
} = {}) => {
  const { signToken } = await import(path.join('file://', __dirname, '..', 'workers', 'sessionCorsWorker', 'tokenSigning.js'));
  const exp = Math.floor((typeof now === 'function' ? now() : Date.now()) / 1000) + (5 * 60);
  return signToken({
    sub: ethers.utils.getAddress(address),
    slug,
    scopes,
    exp,
  }, tokenSecret);
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

  const text = await response.text().catch(() => '');
  let parsed = {};
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { message: text };
    }
  }

  return {
    ok: response.ok,
    status: response.status,
    body: parsed,
  };
};

const ensureBaseKeysPresent = (config = {}) => {
  if (config.usageApiKey || config.accountApiKey) return;
  throw new Error('Missing Lit key. Set LIT_USAGE_API_KEY or LIT_ACCOUNT_API_KEY in .env.e2e.local.');
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

const resolveLitChipotleRuntimeE2eConfig = ({
  env = process.env,
  args = {},
} = {}) => {
  const base = resolveLitChipotleE2eConfig({ env, args });
  const adminWallet = new Wallet(base.adminPrivateKey);
  const runtimeAddress = toStr(
    args['runtime-address'] ||
    env.LIT_E2E_RUNTIME_ADDRESS ||
    adminWallet.address
  ).trim();
  const deniedAddress = toStr(args['denied-address'] || env.LIT_E2E_DENIED_ADDRESS).trim();
  const actionCode = loadDefaultChipotleActionCode({
    explicitCode: args['action-code'] || env.LIT_E2E_ACTION_CODE,
    explicitPath: args['action-code-path'] || env.LIT_E2E_ACTION_CODE_PATH,
  });
  const sbtAddresses = parseAddressList(
    args['sbt-addresses-json'] || env.LIT_E2E_SBT_ADDRESSES_JSON,
    args['sbt-addresses'] || env.LIT_E2E_SBT_ADDRESSES,
  );
  const gateChainId = Number(
    args['gate-chain-id'] ||
    env.LIT_E2E_GATE_CHAIN_ID ||
    env.CHAIN_ID ||
    0
  ) || null;
  const gateMode = normalizeGateMode(args['gate-mode'] || env.LIT_E2E_GATE_MODE || DEFAULT_GATE_MODE);
  const messageHex = normalizeHexMessage(args['message-hex'] || env.LIT_E2E_MESSAGE_HEX || DEFAULT_MESSAGE_HEX);
  const autoProvisionFlag = args['auto-provision'] ?? env.LIT_E2E_AUTO_PROVISION;
  const missingProvisionedIdentifiers = !toStr(base.litGroupId).trim() || !toStr(base.litPkpId).trim();

  return {
    ...base,
    tokenSecret: toStr(args['token-secret'] || env.TOKEN_HMAC_SECRET || DEFAULT_TOKEN_HMAC_SECRET).trim() || DEFAULT_TOKEN_HMAC_SECRET,
    runtimeAddress,
    deniedAddress,
    sbtAddresses,
    gateChainId,
    gateMode,
    messageHex,
    actionCode,
    actionCodeSource: toStr(args['action-code'] || env.LIT_E2E_ACTION_CODE).trim()
      ? 'env-inline'
      : toStr(args['action-code-path'] || env.LIT_E2E_ACTION_CODE_PATH).trim()
        ? 'env-path'
        : 'repo-catalog',
    autoProvision: autoProvisionFlag === undefined || autoProvisionFlag === ''
      ? (
        !!toStr(base.accountApiKey).trim() &&
        (missingProvisionedIdentifiers || !toStr(base.litActionCid).trim())
      )
      : toBool(autoProvisionFlag),
    probeDeniedAddress: toBool(args['probe-denied-address'] || env.LIT_E2E_PROBE_DENIED_ADDRESS),
  };
};

const ensureRuntimeInputs = (config = {}) => {
  ensureBaseKeysPresent(config);
  if (!ethers.utils.isAddress(config.runtimeAddress || '')) {
    throw new Error('LIT_E2E_RUNTIME_ADDRESS must be a valid EVM address.');
  }
  if (config.deniedAddress && !ethers.utils.isAddress(config.deniedAddress)) {
    throw new Error('LIT_E2E_DENIED_ADDRESS must be a valid EVM address when provided.');
  }
  if (!Array.isArray(config.sbtAddresses) || !config.sbtAddresses.length) {
    throw new Error('Set LIT_E2E_SBT_ADDRESSES or LIT_E2E_SBT_ADDRESSES_JSON to at least one SBT address.');
  }
  if (!toStr(config.customRpcUrl).trim() && !(Number(config.gateChainId || 0) > 0)) {
    throw new Error('Set CUSTOM_RPC_URL or LIT_E2E_GATE_CHAIN_ID/CHAIN_ID for the target SBT gate chain.');
  }
  if (!toStr(config.litGroupId).trim() && !config.autoProvision) {
    throw new Error('Set LIT_GROUP_ID for the target Lit group.');
  }
  if (!toStr(config.litPkpId).trim() && !config.autoProvision) {
    throw new Error('Set LIT_PKP_ID for the target Lit PKP.');
  }
  if (!toStr(config.litActionCid).trim() && !toStr(config.accountApiKey).trim()) {
    throw new Error('Set LIT_ACTION_CID or provide LIT_ACCOUNT_API_KEY so the runner can provision the default CE action.');
  }
};

const buildRuntimeRequestBody = ({
  config,
  op,
  ciphertext = '',
} = {}) => {
  const body = {
    action: 'lit_chipotle_execute',
    actionCode: config.actionCode,
    op,
    sbtAddresses: config.sbtAddresses,
    gateMode: config.gateMode,
    ...(config.gateChainId ? { chainId: config.gateChainId } : {}),
    ...(config.customRpcUrl ? { rpcUrl: config.customRpcUrl } : {}),
  };
  if (op === 'encrypt') body.message = config.messageHex;
  if (op === 'decrypt') body.ciphertext = ciphertext;
  return body;
};

const buildRuntimeHeaders = ({
  token,
  origin,
  slug,
} = {}) => ({
  Origin: origin,
  Authorization: `Bearer ${token}`,
  'X-Group-Slug': slug,
});

async function runLitChipotleRuntimeSmokeTest({
  env = process.env,
  args = {},
  fetchImpl = global.fetch,
  now = Date.now,
  worker = null,
  persistArtifacts = true,
  artifactsOverride = null,
} = {}) {
  const config = resolveLitChipotleRuntimeE2eConfig({ env, args });
  const artifacts = artifactsOverride || resolveArtifacts({
    runTag: config.runTag,
    baseName: 'lit-chipotle-runtime',
  });
  const report = createBaseReport({
    flowId: 'CE-E2E-LIT-CHIPOTLE-RUNTIME',
    runner: path.basename(__filename),
    runTag: config.runTag,
    chain: {},
    inputs: {
      sessionSlug: config.sessionSlug,
      litApiBase: config.litApiBase,
      runtimeAddress: config.runtimeAddress,
      gateChainId: config.gateChainId,
      gateMode: config.gateMode,
      sbtAddresses: config.sbtAddresses,
      hasUsageApiKey: !!config.usageApiKey,
      hasAccountApiKey: !!config.accountApiKey,
      litGroupId: config.litGroupId || null,
      litPkpId: config.litPkpId || null,
      litActionCid: config.litActionCid || null,
      autoProvision: config.autoProvision,
      actionCodeSource: config.actionCodeSource,
    },
    outputs: {
      json: relRoot(artifacts.json),
    },
  });
  if (persistArtifacts) {
    writeJson(artifacts.json, report);
  }

  const workerEnv = buildWorkerEnv(config);
  const secretPayload = buildRuntimeSecretPayload(config);
  const wallet = new Wallet(config.adminPrivateKey);
  const loadedWorker = worker || await loadWorkerModule();

  const originalFetch = global.fetch;
  if (typeof fetchImpl === 'function') {
    global.fetch = fetchImpl;
  }

  try {
    ensureRuntimeInputs(config);

    addStep(report, { phase: 'admin', name: 'set-config' });
    const setConfigResponse = await postSignedAdminAction({
      worker: loadedWorker,
      env: workerEnv,
      workerUrl: config.workerUrl || DEFAULT_LOCAL_WORKER_URL,
      origin: config.origin || DEFAULT_LOCAL_ADMIN_ORIGIN,
      wallet,
      action: 'set-config',
      sessionSlug: config.sessionSlug,
      body: {
        sessionSlug: config.sessionSlug,
        adminAddress: wallet.address,
        config: {
          adminAddress: wallet.address,
          allowOrigins: [config.origin || DEFAULT_LOCAL_ADMIN_ORIGIN],
          litCredentials: buildLitCredentialsConfig(config),
        },
      },
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
        workerUrl: config.workerUrl || DEFAULT_LOCAL_WORKER_URL,
        origin: config.origin || DEFAULT_LOCAL_ADMIN_ORIGIN,
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
      workerUrl: config.workerUrl || DEFAULT_LOCAL_WORKER_URL,
      origin: config.origin || DEFAULT_LOCAL_ADMIN_ORIGIN,
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

    let resolvedGroupId = toStr(config.litGroupId).trim();
    let resolvedPkpId = toStr(config.litPkpId).trim();
    let resolvedActionCid = toStr(config.litActionCid).trim();
    if ((!resolvedGroupId || !resolvedPkpId) && config.autoProvision && config.accountApiKey) {
      addStep(report, { phase: 'admin', name: 'lit-chipotle-bootstrap-session' });
      const bootstrapResponse = await postSignedAdminAction({
        worker: loadedWorker,
        env: workerEnv,
        workerUrl: config.workerUrl || DEFAULT_LOCAL_WORKER_URL,
        origin: config.origin || DEFAULT_LOCAL_ADMIN_ORIGIN,
        wallet,
        action: 'lit-chipotle-bootstrap-session',
        sessionSlug: config.sessionSlug,
        body: {
          sessionSlug: config.sessionSlug,
          litApiBase: config.litApiBase,
          sessionName: config.sessionSlug,
          actionCode: config.actionCode,
        },
        now,
      });
      report.bootstrap = {
        status: bootstrapResponse.status,
        ok: !!bootstrapResponse.body?.ok,
        response: bootstrapResponse.body,
      };
      if (!bootstrapResponse.ok || !bootstrapResponse.body?.ok) {
        throw new Error(`lit-chipotle-bootstrap-session failed (${bootstrapResponse.status}): ${toStr(bootstrapResponse.body?.error || bootstrapResponse.body?.message || 'Unknown error')}`);
      }
      resolvedGroupId = toStr(bootstrapResponse.body?.litGroupId).trim();
      resolvedPkpId = toStr(bootstrapResponse.body?.litPkpId).trim();
      resolvedActionCid = toStr(bootstrapResponse.body?.litActionCid).trim();
    } else {
      report.bootstrap = {
        status: 0,
        ok: true,
        skipped: true,
      };
    }

    if (!resolvedActionCid && config.autoProvision) {
      addStep(report, { phase: 'admin', name: 'lit-chipotle-provision' });
      const provisionResponse = await postSignedAdminAction({
        worker: loadedWorker,
        env: workerEnv,
        workerUrl: config.workerUrl || DEFAULT_LOCAL_WORKER_URL,
        origin: config.origin || DEFAULT_LOCAL_ADMIN_ORIGIN,
        wallet,
        action: 'lit-chipotle-provision',
        sessionSlug: config.sessionSlug,
        body: {
          sessionSlug: config.sessionSlug,
          actionCode: config.actionCode,
        },
        now,
      });
      report.provision = {
        status: provisionResponse.status,
        ok: !!provisionResponse.body?.ok,
        response: provisionResponse.body,
      };
      if (!provisionResponse.ok || !provisionResponse.body?.ok) {
        throw new Error(`lit-chipotle-provision failed (${provisionResponse.status}): ${toStr(provisionResponse.body?.error || provisionResponse.body?.message || 'Unknown error')}`);
      }
      resolvedActionCid = toStr(provisionResponse.body?.litActionCid).trim();
    } else {
      report.provision = {
        status: 0,
        ok: true,
        skipped: true,
      };
    }

    if (!resolvedGroupId) {
      throw new Error('Lit group ID remained unset after bootstrap/provisioning.');
    }
    if (!resolvedPkpId) {
      throw new Error('Lit PKP ID remained unset after bootstrap/provisioning.');
    }
    if (!resolvedActionCid) {
      throw new Error('Lit action CID remained unset after bootstrap/provisioning.');
    }

    const runtimeConfig = {
      ...config,
      litGroupId: resolvedGroupId,
      litPkpId: resolvedPkpId,
      litActionCid: resolvedActionCid,
    };

    const token = await signSyntheticWorkerToken({
      address: config.runtimeAddress,
      slug: config.sessionSlug,
      tokenSecret: config.tokenSecret || DEFAULT_TOKEN_HMAC_SECRET,
      now,
    });
    report.runtimeToken = {
      ok: true,
      runtimeAddress: config.runtimeAddress,
      tokenScopes: { lit: true },
    };

    addStep(report, { phase: 'runtime', name: 'lit-chipotle-check' });
    const checkResponse = await invokeWorkerJson({
      worker: loadedWorker,
      env: workerEnv,
      workerUrl: config.workerUrl || DEFAULT_LOCAL_WORKER_URL,
      path: '/lit/chipotle-action',
      body: buildRuntimeRequestBody({ config: runtimeConfig, op: 'check' }),
      headers: buildRuntimeHeaders({
        token,
        origin: config.origin || DEFAULT_LOCAL_ADMIN_ORIGIN,
        slug: config.sessionSlug,
      }),
    });
    report.runtimeCheck = {
      status: checkResponse.status,
      ok: !!checkResponse.body?.ok,
      response: checkResponse.body,
    };
    if (!checkResponse.ok || !checkResponse.body?.ok) {
      throw new Error(`runtime check failed (${checkResponse.status}): ${toStr(checkResponse.body?.error || checkResponse.body?.message || 'Unknown error')}`);
    }

    addStep(report, { phase: 'runtime', name: 'lit-chipotle-encrypt' });
    const encryptResponse = await invokeWorkerJson({
      worker: loadedWorker,
      env: workerEnv,
      workerUrl: config.workerUrl || DEFAULT_LOCAL_WORKER_URL,
      path: '/lit/chipotle-action',
      body: buildRuntimeRequestBody({ config: runtimeConfig, op: 'encrypt' }),
      headers: buildRuntimeHeaders({
        token,
        origin: config.origin || DEFAULT_LOCAL_ADMIN_ORIGIN,
        slug: config.sessionSlug,
      }),
    });
    report.runtimeEncrypt = {
      status: encryptResponse.status,
      ok: !!encryptResponse.body?.ok,
      response: encryptResponse.body,
    };
    if (!encryptResponse.ok || !encryptResponse.body?.ok) {
      throw new Error(`runtime encrypt failed (${encryptResponse.status}): ${toStr(encryptResponse.body?.error || encryptResponse.body?.message || 'Unknown error')}`);
    }
    const encryptPayload = parseActionResponse(encryptResponse.body);
    const ciphertext = toStr(encryptPayload?.ciphertext).trim();
    if (!ciphertext) {
      throw new Error('Runtime encrypt response did not include ciphertext.');
    }

    addStep(report, { phase: 'runtime', name: 'lit-chipotle-decrypt' });
    const decryptResponse = await invokeWorkerJson({
      worker: loadedWorker,
      env: workerEnv,
      workerUrl: config.workerUrl || DEFAULT_LOCAL_WORKER_URL,
      path: '/lit/chipotle-action',
      body: buildRuntimeRequestBody({ config: runtimeConfig, op: 'decrypt', ciphertext }),
      headers: buildRuntimeHeaders({
        token,
        origin: config.origin || DEFAULT_LOCAL_ADMIN_ORIGIN,
        slug: config.sessionSlug,
      }),
    });
    report.runtimeDecrypt = {
      status: decryptResponse.status,
      ok: !!decryptResponse.body?.ok,
      response: decryptResponse.body,
    };
    if (!decryptResponse.ok || !decryptResponse.body?.ok) {
      throw new Error(`runtime decrypt failed (${decryptResponse.status}): ${toStr(decryptResponse.body?.error || decryptResponse.body?.message || 'Unknown error')}`);
    }
    const decryptPayload = parseActionResponse(decryptResponse.body);
    const plaintext = toStr(decryptPayload?.plaintext).trim().toLowerCase();
    if (!plaintext) {
      throw new Error('Runtime decrypt response did not include plaintext.');
    }
    if (plaintext !== config.messageHex) {
      throw new Error('Runtime decrypt plaintext did not match the original message.');
    }

    if (config.probeDeniedAddress && config.deniedAddress) {
      const deniedToken = await signSyntheticWorkerToken({
        address: config.deniedAddress,
        slug: config.sessionSlug,
        tokenSecret: config.tokenSecret || DEFAULT_TOKEN_HMAC_SECRET,
        now,
      });
      addStep(report, { phase: 'runtime', name: 'lit-chipotle-denied-check' });
      const deniedResponse = await invokeWorkerJson({
        worker: loadedWorker,
        env: workerEnv,
        workerUrl: config.workerUrl || DEFAULT_LOCAL_WORKER_URL,
        path: '/lit/chipotle-action',
        body: buildRuntimeRequestBody({ config, op: 'check' }),
        headers: buildRuntimeHeaders({
          token: deniedToken,
          origin: config.origin || DEFAULT_LOCAL_ADMIN_ORIGIN,
          slug: config.sessionSlug,
        }),
      });
      report.runtimeDeniedCheck = {
        status: deniedResponse.status,
        ok: !!deniedResponse.body?.ok,
        response: deniedResponse.body,
      };
    } else {
      report.runtimeDeniedCheck = {
        status: 0,
        ok: true,
        skipped: true,
      };
    }

    report.ok = true;
    report.results = {
      litGroupId: resolvedGroupId,
      litPkpId: resolvedPkpId,
      litActionCid: resolvedActionCid,
      ciphertext,
      plaintext,
    };
    return report;
  } catch (error) {
    report.ok = false;
    report.error = {
      message: toStr(error?.message || error) || 'Unknown Lit Chipotle runtime smoke-test failure.',
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
    runTag: resolveLitChipotleRuntimeE2eConfig({ env: process.env, args }).runTag,
    baseName: 'lit-chipotle-runtime',
  });
  const report = await runLitChipotleRuntimeSmokeTest({
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
    runtimeAddress: report?.inputs?.runtimeAddress || null,
    litActionCid: report?.results?.litActionCid || report?.inputs?.litActionCid || null,
    error: report?.error?.message || null,
  }, null, 2));
  if (!report.ok) process.exitCode = 1;
}

module.exports = {
  DEFAULT_ACTION_CATALOG_CANDIDATES,
  DEFAULT_GATE_MODE,
  DEFAULT_MESSAGE_HEX,
  buildRuntimeRequestBody,
  buildRuntimeSecretPayload,
  loadDefaultChipotleActionCode,
  normalizeAddressList,
  normalizeGateMode,
  parseActionResponse,
  resolveArtifactControls,
  resolveLitChipotleRuntimeE2eConfig,
  runLitChipotleRuntimeSmokeTest,
  signSyntheticWorkerToken,
};

if (require.main === module) {
  main().catch((error) => {
    console.error('[lit-chipotle-runtime]', error?.message || error);
    process.exit(1);
  });
}
