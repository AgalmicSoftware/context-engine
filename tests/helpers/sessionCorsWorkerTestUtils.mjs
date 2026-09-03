import { ethers } from 'ethers';
import { SessionWriteCoordinator } from '../../workers/sessionCorsWorker/sessionWriteCoordinator.js';
import {
  ADMIN_ACTION_TYPES,
  buildAdminActionBodyHash,
  buildAdminActionTypedData,
} from '../../client/src/utilities/worker/adminTypedData.mjs';

const REGISTRY_ABI = [
  'function getResourceGate(string,string) view returns (address[] sbtAddresses, uint256 chainId, uint8 mode, uint256 perMemberLimit)',
  'function sessionExists(string) view returns (bool)',
  'function getSessionBySlug(string) view returns (string,uint256,string,string,address,uint256,uint256,bytes16)',
];
const ERC721_ABI = ['function balanceOf(address owner) view returns (uint256)'];
const SBT_ADMIN_ABI = ['function admin() view returns (address)', 'function owner() view returns (address)'];

const registryIface = new ethers.utils.Interface(REGISTRY_ABI);
const erc721Iface = new ethers.utils.Interface(ERC721_ABI);
const sbtAdminIface = new ethers.utils.Interface(SBT_ADMIN_ABI);
const LOGIN_ORIGIN = 'https://contextengine.sh';
const LOGIN_DOMAIN = 'contextengine.sh';

const normalizeOrigin = (value) => {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  try {
    return new URL(raw).origin;
  } catch {
    return '';
  }
};

const splitOriginListInput = (value) => {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return [];
  return trimmed
    .split(/[\n,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const coerceOriginListInput = (value) => {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => splitOriginListInput(entry));
  }
  return splitOriginListInput(value);
};

const getOriginDomain = (origin) => {
  const normalized = normalizeOrigin(origin);
  if (!normalized) return LOGIN_DOMAIN;
  try {
    return new URL(normalized).host;
  } catch {
    return LOGIN_DOMAIN;
  }
};

const readSessionConfig = async ({ env, sessionSlug } = {}) => {
  const slug = String(sessionSlug ?? '').trim();
  if (!slug || typeof env?.GROUP_KV?.get !== 'function') return null;
  const raw = await env.GROUP_KV.get(`session:${slug}:config`);
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const resolveConfiguredLoginOrigin = (config) => (
  coerceOriginListInput(config?.allowOrigins)
    .map((entry) => normalizeOrigin(entry))
    .find(Boolean) || ''
);

const resolveLoginOrigin = async ({
  env,
  sessionSlug,
  explicitOrigin,
  preferConfigOrigin = true,
} = {}) => {
  const normalizedExplicit = normalizeOrigin(explicitOrigin);
  if (normalizedExplicit) return normalizedExplicit;
  if (preferConfigOrigin) {
    const config = await readSessionConfig({ env, sessionSlug });
    const configuredOrigin = resolveConfiguredLoginOrigin(config);
    if (configuredOrigin) return configuredOrigin;
  }
  return LOGIN_ORIGIN;
};

const jsonRpcResponse = (payload) => ({
  ok: true,
  status: 200,
  text: async () => JSON.stringify(payload),
});

const isBalanceOfSelector = (data) => (
  data.slice(0, 10).toLowerCase() === erc721Iface.getSighash('balanceOf').toLowerCase()
);
const isSessionExistsSelector = (data) => (
  data.slice(0, 10).toLowerCase() === registryIface.getSighash('sessionExists').toLowerCase()
);
const isGetResourceGateSelector = (data) => (
  data.slice(0, 10).toLowerCase() === registryIface.getSighash('getResourceGate').toLowerCase()
);
const isGetSessionBySlugSelector = (data) => (
  data.slice(0, 10).toLowerCase() === registryIface.getSighash('getSessionBySlug').toLowerCase()
);
const isAdminSelector = (data) => (
  data.slice(0, 10).toLowerCase() === sbtAdminIface.getSighash('admin').toLowerCase()
);
const isOwnerSelector = (data) => (
  data.slice(0, 10).toLowerCase() === sbtAdminIface.getSighash('owner').toLowerCase()
);

export const buildRpcFetchMock = ({
  rpcUrl,
  registryAddress,
  chainId = 84532,
  sessionExists = true,
  onChainGatesByResource = {},
  balancesByToken = {},
  sessionsBySlug = {},
  sbtAdminByToken = {},
}) => jest.fn(async (url, options = {}) => {
  if (url !== rpcUrl) {
    throw new Error(`Unexpected RPC URL: ${url}`);
  }

  const body = JSON.parse(options.body || '{}');
  const method = body.method;

  if (method === 'eth_getCode') {
    return jsonRpcResponse({ jsonrpc: '2.0', id: 1, result: '0x1234' });
  }
  if (method === 'eth_chainId') {
    return jsonRpcResponse({ jsonrpc: '2.0', id: 1, result: `0x${Number(chainId).toString(16)}` });
  }
  if (method !== 'eth_call') {
    return jsonRpcResponse({ jsonrpc: '2.0', id: 1, result: '0x1' });
  }

  const call = body.params?.[0] || {};
  const to = String(call.to || '').toLowerCase();
  const data = String(call.data || '');

  if (to === registryAddress.toLowerCase()) {
    if (isSessionExistsSelector(data)) {
      const result = registryIface.encodeFunctionResult('sessionExists', [!!sessionExists]);
      return jsonRpcResponse({ jsonrpc: '2.0', id: 1, result });
    }
    if (isGetResourceGateSelector(data)) {
      const [, resourceKey] = registryIface.decodeFunctionData('getResourceGate', data);
      const gate = onChainGatesByResource[String(resourceKey)] || {};
      const sbtAddresses = Array.isArray(gate.sbtAddresses) ? gate.sbtAddresses : [];
      const chainId = Number(gate.chainId || 84532);
      const mode = Number(gate.mode || 0);
      const perMemberLimit = Number(gate.perMemberLimit || 0);
      const result = registryIface.encodeFunctionResult('getResourceGate', [
        sbtAddresses,
        chainId,
        mode,
        perMemberLimit,
      ]);
      return jsonRpcResponse({ jsonrpc: '2.0', id: 1, result });
    }
    if (isGetSessionBySlugSelector(data)) {
      const [slug] = registryIface.decodeFunctionData('getSessionBySlug', data);
      const session = sessionsBySlug[String(slug)] || {};
      const result = registryIface.encodeFunctionResult('getSessionBySlug', [
        String(session.slug ?? slug ?? ''),
        Number(session.chainId || 84532),
        String(session.metadataURI || ''),
        String(session.extraData || ''),
        String(session.adminAddress || '0x0000000000000000000000000000000000000000'),
        Number(session.createdAt || 0),
        Number(session.updatedAt || 0),
        String(session.sessionIdHex || '0x00000000000000000000000000000001'),
      ]);
      return jsonRpcResponse({ jsonrpc: '2.0', id: 1, result });
    }
    throw new Error(`Unexpected registry method selector: ${data.slice(0, 10)}`);
  }

  if (isAdminSelector(data)) {
    const admin = sbtAdminByToken[to] || {};
    const result = sbtAdminIface.encodeFunctionResult('admin', [
      String(admin.admin || '0x0000000000000000000000000000000000000000'),
    ]);
    return jsonRpcResponse({ jsonrpc: '2.0', id: 1, result });
  }

  if (isOwnerSelector(data)) {
    const admin = sbtAdminByToken[to] || {};
    const result = sbtAdminIface.encodeFunctionResult('owner', [
      String(admin.owner || '0x0000000000000000000000000000000000000000'),
    ]);
    return jsonRpcResponse({ jsonrpc: '2.0', id: 1, result });
  }

  if (!isBalanceOfSelector(data)) {
    throw new Error(`Unexpected eth_call selector: ${data.slice(0, 10)}`);
  }

  const [owner] = erc721Iface.decodeFunctionData('balanceOf', data);
  const ownerKey = String(owner || '').toLowerCase();
  const tokenKey = to;
  const balance = balancesByToken[`${tokenKey}:${ownerKey}`] ?? balancesByToken[tokenKey] ?? 0;
  const result = erc721Iface.encodeFunctionResult('balanceOf', [ethers.BigNumber.from(balance)]);
  return jsonRpcResponse({ jsonrpc: '2.0', id: 1, result });
});

export const installRpcAwareUpstreamFetchMock = ({
  rpcUrl,
  implementation,
} = {}) => {
  const rpcFetch = global.fetch;
  const upstreamFetch = jest.fn(implementation);
  global.fetch = jest.fn((input, init) => {
    const url = typeof input === 'string' ? input : String(input?.url || input || '');
    return url === rpcUrl
      ? rpcFetch(input, init)
      : upstreamFetch(input, init);
  });
  return upstreamFetch;
};

export const createMemoryKv = (seed = {}) => {
  const storage = new Map(Object.entries(seed));
  return {
    get: jest.fn(async (key) => (storage.has(key) ? storage.get(key) : null)),
    put: jest.fn(async (key, value) => {
      storage.set(key, value);
    }),
    delete: jest.fn(async (key) => {
      storage.delete(key);
    }),
    _dump: () => new Map(storage),
  };
};

const cloneCoordinatorTestValue = (value) => (
  typeof globalThis.structuredClone === 'function'
    ? globalThis.structuredClone(value)
    : JSON.parse(JSON.stringify(value))
);

export const installSessionCoordinatorBinding = (env = {}) => {
  if (env.CE_SESSION_COORDINATOR) return env;
  const instances = new Map();
  env.CE_SESSION_COORDINATOR = {
    idFromName: (name) => `coordinator:${name}`,
    get: (id) => {
      if (!instances.has(id)) {
        const values = new Map();
        let tail = Promise.resolve();
        const transaction = (callback) => {
          const run = tail.then(async () => {
            const staged = new Map([...values].map(([key, value]) => [key, cloneCoordinatorTestValue(value)]));
            const result = await callback({
              get: async (key) => staged.get(key),
              put: async (key, value) => staged.set(key, cloneCoordinatorTestValue(value)),
              delete: async (key) => staged.delete(key),
            });
            values.clear();
            for (const [key, value] of staged) values.set(key, value);
            return result;
          });
          tail = run.catch(() => undefined);
          return run;
        };
        const state = {
          storage: {
            get: async (key) => values.get(key),
            put: async (key, value) => values.set(key, cloneCoordinatorTestValue(value)),
            delete: async (key) => values.delete(key),
            transaction,
          },
        };
        const coordinator = new SessionWriteCoordinator(state, env);
        instances.set(id, {
          fetch: (input, init) => coordinator.fetch(
            input instanceof Request ? input : new Request(input, init),
          ),
          store: values,
        });
      }
      return instances.get(id);
    },
  };
  env.__coordinatorInstances = instances;
  return env;
};

export const makeJsonRequest = (path, body, init = {}) => new Request(`https://worker.example${path}`, {
  method: init.method || 'POST',
  headers: {
    'Content-Type': 'application/json',
    ...(init.headers || {}),
  },
  body: body == null ? undefined : JSON.stringify(body),
});

export const decodeTokenPayload = (token) => {
  const [payloadPart] = String(token || '').split('.');
  const padded = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
  const base64 = padded + '='.repeat((4 - (padded.length % 4)) % 4);
  return JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));
};

export const buildSiweMessage = ({
  domain = 'worker.example',
  address,
  nonce,
  chainId = 84532,
  uri,
  issuedAt,
  expirationTime,
}) => {
  const resolvedIssuedAt = issuedAt || new Date(Date.now() - 60 * 1000).toISOString();
  const resolvedExpirationTime = expirationTime || new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const resolvedUri = uri || `https://${domain}`;
  return `${domain} wants you to sign in with your Ethereum account:
${address}

URI: ${resolvedUri}
Version: 1
Chain ID: ${chainId}
Nonce: ${nonce}
Issued At: ${resolvedIssuedAt}
Expiration Time: ${resolvedExpirationTime}`;
};

export const createSignedSiweBody = async ({
  worker,
  env,
  wallet,
  sessionSlug,
  body = {},
  chainId = 84532,
  adminAction,
  audience,
  loginOrigin,
  adminOrigin,
}) => {
  installSessionCoordinatorBinding(env);
  const resolvedAdminAction = (() => {
    const explicit = String(adminAction || '').trim().toLowerCase();
    if (explicit) return explicit;
    if (body && typeof body === 'object') {
      if ('config' in body) return 'set-config';
      if ('secrets' in body) return 'set-secrets';
      if ('limits' in body) return 'set-limits';
    }
    return '';
  })();

  if (resolvedAdminAction) {
    const resolvedAudience = await resolveLoginOrigin({
      env,
      sessionSlug,
      explicitOrigin: audience || adminOrigin || loginOrigin,
      preferConfigOrigin: false,
    });
    const nonceResponse = await worker.fetch(
      makeJsonRequest('/auth/nonce', {
        address: wallet.address,
        sessionSlug,
        adminAction: true,
      }, {
        headers: { Origin: resolvedAudience },
      }),
      env,
      {}
    );
    const noncePayload = await nonceResponse.json();
    if (!nonceResponse.ok || !noncePayload?.nonce) {
      throw new Error(noncePayload?.error || 'Failed to create auth nonce.');
    }

    const address = wallet.address;
    const targetSlug = String(sessionSlug || '');
    const unsignedBody = {
      address,
      sessionSlug: targetSlug,
      ...body,
    };
    const expiration = Math.floor(Date.now() / 1000) + 5 * 60;
    const typedData = buildAdminActionTypedData({
      action: resolvedAdminAction,
      slug: targetSlug,
      bodyHash: buildAdminActionBodyHash(unsignedBody),
      nonce: String(noncePayload.nonce),
      audience: resolvedAudience,
      expiration,
    });
    const signature = await wallet._signTypedData(
      typedData.domain,
      ADMIN_ACTION_TYPES,
      typedData.message,
    );

    return {
      ...unsignedBody,
      signature,
      action: resolvedAdminAction,
      slug: targetSlug,
      bodyHash: typedData.message.bodyHash,
      nonce: typedData.message.nonce,
      audience: typedData.message.audience,
      expiration: typedData.message.expiration,
    };
  }

  const resolvedLoginOrigin = await resolveLoginOrigin({
    env,
    sessionSlug,
    explicitOrigin: loginOrigin,
  });
  const nonceResponse = await worker.fetch(
    makeJsonRequest('/auth/nonce', {
      address: wallet.address,
      sessionSlug,
    }, {
      headers: { Origin: resolvedLoginOrigin },
    }),
    env,
    {}
  );
  const noncePayload = await nonceResponse.json();
  if (!nonceResponse.ok || !noncePayload?.nonce) {
    throw new Error(noncePayload?.error || 'Failed to create auth nonce.');
  }

  const message = buildSiweMessage({
    domain: getOriginDomain(resolvedLoginOrigin),
    uri: resolvedLoginOrigin,
    address: wallet.address,
    nonce: noncePayload.nonce,
    chainId,
  });
  const signature = await wallet.signMessage(message);

  return {
    address: wallet.address,
    sessionSlug,
    message,
    signature,
    ...body,
  };
};

export const issueWorkerLoginToken = async ({
  worker,
  env,
  wallet,
  sessionSlug,
  rpcUrl,
  registryAddress,
  onChainGatesByResource = {
    default: { sbtAddresses: [], chainId: 84532, mode: 0 },
    ai: { sbtAddresses: [], chainId: 84532, mode: 0 },
    arweave: { sbtAddresses: [], chainId: 84532, mode: 0 },
    rpc: { sbtAddresses: [], chainId: 84532, mode: 0 },
    txGas: { sbtAddresses: [], chainId: 84532, mode: 0 },
  },
  loginOrigin,
}) => {
  global.fetch = buildRpcFetchMock({
    rpcUrl,
    registryAddress,
    // Login re-attests the configured registry chain before checking gates.
    // Mirror the requested default gate so non-Base fixtures do not fail closed.
    chainId: Number(onChainGatesByResource?.default?.chainId || 84532),
    sessionExists: true,
    onChainGatesByResource,
  });

  const body = await createSignedSiweBody({
    worker,
    env,
    wallet,
    sessionSlug,
    loginOrigin,
  });
  const resolvedLoginOrigin = await resolveLoginOrigin({
    env,
    sessionSlug,
    explicitOrigin: loginOrigin,
  });
  const response = await worker.fetch(
    makeJsonRequest('/auth/login', body, {
      headers: { Origin: resolvedLoginOrigin },
    }),
    env,
    {}
  );
  const payload = await response.json();
  if (!response.ok || !payload?.token) {
    throw new Error(payload?.error || `Failed to issue worker token (${response.status}).`);
  }
  return payload.token;
};

export const workerTestUtils = {
  buildRpcFetchMock,
  installRpcAwareUpstreamFetchMock,
  createMemoryKv,
  makeJsonRequest,
  decodeTokenPayload,
  buildSiweMessage,
  createSignedSiweBody,
  issueWorkerLoginToken,
};
