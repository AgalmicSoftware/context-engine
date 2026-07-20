import test from 'node:test';
import assert from 'node:assert/strict';
import { ethers } from 'ethers';
import { webcrypto } from 'crypto';
import sessionCorsWorker from '../../workers/sessionCorsWorker/worker.js';

const REGISTRY_ADDRESS = '0x0000000000000000000000000000000000000001';
const RPC_URL = 'https://rpc.example';
const ZERO_BYTES32 = `0x${'0'.repeat(64)}`;
const SESSION_CONFIG_KEY = (slug) => `session:${slug}:config`;
const SESSION_SECRETS_KEY = (slug) => `session:${slug}:secrets`;
const LOGIN_ORIGIN = 'https://contextengine.sh';
const LOGIN_DOMAIN = 'contextengine.sh';

const registryIface = new ethers.utils.Interface([
  'function getResourceGate(string,string) view returns (address[] sbtAddresses, uint256 chainId, uint8 mode, uint256 perMemberLimit)',
  'function sessionExists(string) view returns (bool)',
]);
const erc721Iface = new ethers.utils.Interface([
  'function balanceOf(address owner) view returns (uint256)',
]);
const faucetSbtIface = new ethers.utils.Interface([
  'function hasPasswordMint() view returns (bool)',
  'function isPasswordValid(bytes32 hashedPassword) view returns (bool)',
  'function groupPasswordHash() view returns (bytes32)',
]);

const buildSessionConfig = (overrides = {}) => ({
  registryAddress: REGISTRY_ADDRESS,
  registryChainId: 84532,
  networkChainId: 84532,
  rpcUrl: RPC_URL,
  ...overrides,
});

const buildWorkerCanonicalLitModeConfig = () => ({
  sessionModeProfile: {
    profileVersion: 1,
    preset: 'custom',
    authority: { mode: 'worker_canonical' },
    evm: { registryChainId: 84532 },
    storage: {
      backend: 'cloudflare',
      payloadAccessControl: { gate: 'none', encryption: 'lit' },
    },
    identity: { default: 'passkey', enabled: ['passkey'] },
    authorization: { mechanisms: ['worker_roles'] },
    encryption: { mode: 'lit' },
    surfaces: {
      web: true,
      telegram: false,
      miniApp: false,
      agentHttp: false,
      mcp: false,
      ceCc: false,
    },
    results: {
      visibility: 'participant_aggregate',
      exposure: {
        aggregateResultsEnabled: true,
        anonymizedGroupsEnabled: false,
        minGroupSize: 2,
      },
    },
    export: { scope: 'admin_raw' },
  },
  storageProfile: {
    backend: 'cloudflare',
    payloadAccessControl: { gate: 'none', encryption: 'lit' },
  },
});

const makeJsonRequest = (path, body, init = {}) => new Request(`https://worker.example${path}`, {
  method: init.method || 'POST',
  headers: {
    Origin: init.origin || LOGIN_ORIGIN,
    'Content-Type': 'application/json',
    ...(init.headers || {}),
  },
  body: body == null ? undefined : JSON.stringify(body),
});

const makeActionRequest = ({ token, sessionSlug, body }) => new Request('https://worker.example/', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...(sessionSlug ? { 'X-Session-Slug': sessionSlug } : {}),
  },
  body: JSON.stringify(body),
});

const createMemoryKv = (seed = {}) => {
  const storage = new Map(Object.entries(seed));
  return {
    get: async (key) => (storage.has(key) ? storage.get(key) : null),
    put: async (key, value) => {
      storage.set(key, value);
    },
    delete: async (key) => {
      storage.delete(key);
    },
  };
};

const buildSiweMessage = ({
  domain = LOGIN_DOMAIN,
  address,
  nonce,
  chainId = 84532,
  issuedAt,
  expirationTime,
}) => {
  const resolvedIssuedAt = issuedAt || new Date(Date.now() - 60 * 1000).toISOString();
  const resolvedExpirationTime = expirationTime || new Date(Date.now() + 60 * 60 * 1000).toISOString();
  return `${domain} wants you to sign in with your Ethereum account:
${address}

URI: https://${domain}
Version: 1
Chain ID: ${chainId}
Nonce: ${nonce}
Issued At: ${resolvedIssuedAt}
Expiration Time: ${resolvedExpirationTime}`;
};

const deriveGroupPasswordWallet = (password) => {
  const pwHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(password || ''));
  const salt = ethers.utils.solidityKeccak256(['string'], ['sbt-group-password-v2']);
  const seed = ethers.utils.solidityKeccak256(['bytes32', 'bytes32'], [pwHash, salt]);
  const tmpSk = ethers.utils.keccak256(ethers.utils.arrayify(seed));
  return new ethers.Wallet(tmpSk);
};

const buildGroupPasswordHash = (password) => (
  ethers.utils.solidityKeccak256(['address'], [deriveGroupPasswordWallet(password).address])
);

const signGroupMintAuthorization = async ({ password, sbtAddress, recipientAddress }) => {
  const tmpWallet = deriveGroupPasswordWallet(password);
  const messageHash = ethers.utils.solidityKeccak256(['address', 'address'], [sbtAddress, recipientAddress]);
  return tmpWallet.signMessage(ethers.utils.arrayify(messageHash));
};

const buildJsonRpcTextResponse = (payload, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => JSON.stringify(payload),
});

const buildWorkerRpcFetch = ({
  rpcUrl = RPC_URL,
  registryAddress = REGISTRY_ADDRESS,
  chainId = 84532,
  txHash = '0xabc123',
  sessionExists = true,
  onChainGatesByResource = {},
  balancesByToken = {},
  sbtValidationByToken = {},
} = {}) => {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push([url, options]);
    if (url !== rpcUrl) throw new Error(`Unexpected RPC URL: ${url}`);
    const body = JSON.parse(options.body || '{}');

    switch (body.method) {
      case 'eth_getCode':
        return buildJsonRpcTextResponse({ jsonrpc: '2.0', id: 1, result: '0x1234' });
      case 'eth_chainId':
        return buildJsonRpcTextResponse({ jsonrpc: '2.0', id: 1, result: `0x${chainId.toString(16)}` });
      case 'eth_getBalance':
        return buildJsonRpcTextResponse({ jsonrpc: '2.0', id: 1, result: '0x0' });
      case 'eth_getTransactionCount':
        return buildJsonRpcTextResponse({ jsonrpc: '2.0', id: 1, result: '0x1' });
      case 'eth_gasPrice':
        return buildJsonRpcTextResponse({ jsonrpc: '2.0', id: 1, result: '0x3b9aca00' });
      case 'eth_sendRawTransaction':
        return buildJsonRpcTextResponse({ jsonrpc: '2.0', id: 1, result: txHash });
      case 'eth_call': {
        const call = body.params?.[0] || {};
        const to = String(call.to || '').toLowerCase();
        const data = String(call.data || '');

        if (to === registryAddress.toLowerCase()) {
          const selector = data.slice(0, 10).toLowerCase();
          if (selector === registryIface.getSighash('sessionExists').toLowerCase()) {
            const result = registryIface.encodeFunctionResult('sessionExists', [!!sessionExists]);
            return buildJsonRpcTextResponse({ jsonrpc: '2.0', id: 1, result });
          }
          if (selector === registryIface.getSighash('getResourceGate').toLowerCase()) {
            const [, resourceKey] = registryIface.decodeFunctionData('getResourceGate', data);
            const gate = onChainGatesByResource[String(resourceKey)] || {};
            const result = registryIface.encodeFunctionResult('getResourceGate', [
              Array.isArray(gate.sbtAddresses) ? gate.sbtAddresses : [],
              Number(gate.chainId || chainId),
              Number(gate.mode || 0),
              Number(gate.perMemberLimit || 0),
            ]);
            return buildJsonRpcTextResponse({ jsonrpc: '2.0', id: 1, result });
          }
        }

        const balanceSelector = erc721Iface.getSighash('balanceOf').toLowerCase();
        if (data.slice(0, 10).toLowerCase() === balanceSelector) {
          const [owner] = erc721Iface.decodeFunctionData('balanceOf', data);
          const balance = balancesByToken[`${to}:${String(owner || '').toLowerCase()}`] ?? balancesByToken[to] ?? 0;
          const result = erc721Iface.encodeFunctionResult('balanceOf', [ethers.BigNumber.from(balance)]);
          return buildJsonRpcTextResponse({ jsonrpc: '2.0', id: 1, result });
        }

        const tokenConfig = sbtValidationByToken[to] || {};
        const selector = data.slice(0, 10).toLowerCase();
        if (selector === faucetSbtIface.getSighash('hasPasswordMint').toLowerCase()) {
          const result = faucetSbtIface.encodeFunctionResult('hasPasswordMint', [!!tokenConfig.hasPasswordMint]);
          return buildJsonRpcTextResponse({ jsonrpc: '2.0', id: 1, result });
        }
        if (selector === faucetSbtIface.getSighash('groupPasswordHash').toLowerCase()) {
          const result = faucetSbtIface.encodeFunctionResult('groupPasswordHash', [
            tokenConfig.groupPasswordHash || ZERO_BYTES32,
          ]);
          return buildJsonRpcTextResponse({ jsonrpc: '2.0', id: 1, result });
        }
        if (selector === faucetSbtIface.getSighash('isPasswordValid').toLowerCase()) {
          const [hashedPassword] = faucetSbtIface.decodeFunctionData('isPasswordValid', data);
          const result = faucetSbtIface.encodeFunctionResult('isPasswordValid', [
            !!tokenConfig.isPasswordValidByHash?.[String(hashedPassword).toLowerCase()],
          ]);
          return buildJsonRpcTextResponse({ jsonrpc: '2.0', id: 1, result });
        }
        throw new Error(`Unexpected eth_call selector: ${selector}`);
      }
      default:
        throw new Error(`Unexpected RPC method: ${body.method}`);
    }
  };
  fetchImpl.calls = calls;
  return fetchImpl;
};

const issueWorkerLoginToken = async ({
  env,
  wallet,
  sessionSlug,
  sessionId,
  onChainGatesByResource,
}) => {
  const nonceResponse = await sessionCorsWorker.fetch(
    makeJsonRequest('/auth/nonce', {
      address: wallet.address,
      sessionSlug,
      ...(sessionId ? { sessionId } : {}),
    }),
    env,
    {}
  );
  const noncePayload = await nonceResponse.json();
  assert.equal(nonceResponse.ok, true);
  assert.ok(noncePayload?.nonce);

  const message = buildSiweMessage({
    address: wallet.address,
    nonce: noncePayload.nonce,
  });
  const signature = await wallet.signMessage(message);

  const response = await sessionCorsWorker.fetch(
    makeJsonRequest('/auth/login', {
      address: wallet.address,
      sessionSlug,
      ...(sessionId ? { sessionId } : {}),
      message,
      signature,
    }),
    env,
    {}
  );
  const payload = await response.json();
  assert.equal(response.ok, true);
  assert.ok(payload?.token);
  return payload.token;
};

test('proof-backed faucet requests succeed even when the auth token lacks faucet scope', async () => {
  const originalFetch = global.fetch;
  const originalCrypto = global.crypto;
  Object.defineProperty(global, 'crypto', {
    configurable: true,
    value: webcrypto,
  });

  const sessionSlug = 'faucet-proof-scope-bypass';
  const sbtAddress = '0x0000000000000000000000000000000000000104';
  const wallet = new ethers.Wallet('0x59c6995e998f97a5a0044976f84ce7de5d9d7f17b2f6a6a5f76f8864c8ad88f5');
  const faucetWallet = new ethers.Wallet('0x8b3a350cf5c34c9194ca3a545d3f6f9f4c7e2d36505f8b0e62be5285bdcf0582');
  const hashedPassword = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('valid-claim-code'));
  const env = installSessionCoordinatorBinding({
    GROUP_KV: createMemoryKv({
      [SESSION_CONFIG_KEY(sessionSlug)]: JSON.stringify(buildSessionConfig()),
      [SESSION_SECRETS_KEY(sessionSlug)]: JSON.stringify({ faucetPrivateKey: faucetWallet.privateKey }),
    }),
    TOKEN_HMAC_SECRET: 'test-secret',
  });

  try {
    global.fetch = buildWorkerRpcFetch({
      onChainGatesByResource: {
        default: { sbtAddresses: [], chainId: 84532, mode: 0 },
        ai: { sbtAddresses: [], chainId: 84532, mode: 0 },
        arweave: { sbtAddresses: [], chainId: 84532, mode: 0 },
        rpc: { sbtAddresses: [], chainId: 84532, mode: 0 },
        txGas: { sbtAddresses: [sbtAddress], chainId: 84532, mode: 0 },
      },
      sbtValidationByToken: {
        [sbtAddress.toLowerCase()]: {
          hasPasswordMint: true,
          groupPasswordHash: ZERO_BYTES32,
          isPasswordValidByHash: {
            [hashedPassword.toLowerCase()]: true,
          },
        },
      },
      txHash: '0xproofscope123',
    });

    const token = await issueWorkerLoginToken({
      env,
      wallet,
      sessionSlug,
      onChainGatesByResource: {
        default: { sbtAddresses: [], chainId: 84532, mode: 0 },
        ai: { sbtAddresses: [], chainId: 84532, mode: 0 },
        arweave: { sbtAddresses: [], chainId: 84532, mode: 0 },
        rpc: { sbtAddresses: [], chainId: 84532, mode: 0 },
        txGas: { sbtAddresses: [sbtAddress], chainId: 84532, mode: 0 },
      },
    });

    const response = await sessionCorsWorker.fetch(
      makeActionRequest({
        token,
        sessionSlug,
        body: {
          action: 'request_test_eth',
          address: wallet.address,
          amountEth: '0.0000001',
          sbtAddress,
          hashedPassword,
        },
      }),
      env,
      {}
    );
    const payload = await response.json();
    const rpcMethods = global.fetch.calls.map(([, options]) => JSON.parse(options?.body || '{}').method);

    assert.equal(response.status, 200);
    assert.equal(payload?.txHash, '0xproofscope123');
    assert.ok(rpcMethods.includes('eth_sendRawTransaction'));
  } finally {
    global.fetch = originalFetch;
    Object.defineProperty(global, 'crypto', {
      configurable: true,
      value: originalCrypto,
    });
  }
});

test('worker-canonical faucet transactions use the authenticated session-secret RPC without exposing it publicly', async () => {
  const originalFetch = global.fetch;
  const originalCrypto = global.crypto;
  Object.defineProperty(global, 'crypto', {
    configurable: true,
    value: webcrypto,
  });

  const sessionSlug = 'worker-canonical-secret-rpc';
  const secretRpcUrl = 'https://private-op-rpc.example.test';
  const wallet = new ethers.Wallet('0x59c6995e998f97a5a0044976f84ce7de5d9d7f17b2f6a6a5f76f8864c8ad88f5');
  const faucetWallet = new ethers.Wallet('0x8b3a350cf5c34c9194ca3a545d3f6f9f4c7e2d36505f8b0e62be5285bdcf0582');
  const env = installSessionCoordinatorBinding({
    GROUP_KV: createMemoryKv({
      [SESSION_CONFIG_KEY(sessionSlug)]: JSON.stringify({
        slug: sessionSlug,
        sessionId: WORKER_CANONICAL_SESSION_ID,
        networkChainId: 84532,
        allowOrigins: [LOGIN_ORIGIN],
        ...buildWorkerCanonicalLitModeConfig(),
        workerAuthority: {
          version: 1,
          participantScopes: ['faucet'],
          anonymousScopes: [],
        },
      }),
      [SESSION_SECRETS_KEY(sessionSlug)]: JSON.stringify({
        faucetPrivateKey: faucetWallet.privateKey,
        customRpcUrl: secretRpcUrl,
      }),
    }),
    TOKEN_HMAC_SECRET: 'test-secret',
  });

  try {
    global.fetch = buildWorkerRpcFetch({
      rpcUrl: secretRpcUrl,
      chainId: 84532,
      txHash: '0xworkercanonicalrpc123',
    });
    const token = await issueWorkerLoginToken({
      env,
      wallet,
      sessionSlug,
      sessionId: WORKER_CANONICAL_SESSION_ID,
    });

    const response = await sessionCorsWorker.fetch(
      makeActionRequest({
        token,
        sessionSlug,
        body: {
          action: 'request_test_eth',
          address: wallet.address,
          amountEth: '0.0000001',
        },
      }),
      env,
      {},
    );
    const payload = await response.json();
    const rpcUrls = global.fetch.calls.map(([url]) => url);

    assert.equal(response.status, 200);
    assert.equal(payload?.txHash, '0xworkercanonicalrpc123');
    assert.ok(rpcUrls.length > 0);
    assert.deepEqual([...new Set(rpcUrls)], [secretRpcUrl]);

    const publicResponse = await sessionCorsWorker.fetch(
      makeJsonRequest('/session-config', null, {
        method: 'GET',
        headers: { 'X-Session-Slug': sessionSlug },
      }),
      env,
      {},
    );
    const publicPayload = await publicResponse.json();
    assert.equal(publicResponse.status, 200);
    assert.equal(JSON.stringify(publicPayload).includes(secretRpcUrl), false);
  } finally {
    global.fetch = originalFetch;
    Object.defineProperty(global, 'crypto', {
      configurable: true,
      value: originalCrypto,
    });
  }
});

test('proof-backed faucet requests without faucet scope must fund the authenticated wallet', async () => {
  const originalFetch = global.fetch;
  const originalCrypto = global.crypto;
  Object.defineProperty(global, 'crypto', {
    configurable: true,
    value: webcrypto,
  });

  const sessionSlug = 'faucet-proof-recipient-binding';
  const sbtAddress = '0x0000000000000000000000000000000000000105';
  const wallet = new ethers.Wallet('0x59c6995e998f97a5a0044976f84ce7de5d9d7f17b2f6a6a5f76f8864c8ad88f5');
  const otherRecipient = ethers.Wallet.createRandom().address;
  const faucetWallet = new ethers.Wallet('0x8b3a350cf5c34c9194ca3a545d3f6f9f4c7e2d36505f8b0e62be5285bdcf0582');
  const hashedPassword = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('valid-claim-code'));
  const env = installSessionCoordinatorBinding({
    GROUP_KV: createMemoryKv({
      [SESSION_CONFIG_KEY(sessionSlug)]: JSON.stringify(buildSessionConfig()),
      [SESSION_SECRETS_KEY(sessionSlug)]: JSON.stringify({ faucetPrivateKey: faucetWallet.privateKey }),
    }),
    TOKEN_HMAC_SECRET: 'test-secret',
  });

  try {
    global.fetch = buildWorkerRpcFetch({
      onChainGatesByResource: {
        default: { sbtAddresses: [], chainId: 84532, mode: 0 },
        ai: { sbtAddresses: [], chainId: 84532, mode: 0 },
        arweave: { sbtAddresses: [], chainId: 84532, mode: 0 },
        rpc: { sbtAddresses: [], chainId: 84532, mode: 0 },
        txGas: { sbtAddresses: [sbtAddress], chainId: 84532, mode: 0 },
      },
      sbtValidationByToken: {
        [sbtAddress.toLowerCase()]: {
          hasPasswordMint: true,
          groupPasswordHash: ZERO_BYTES32,
          isPasswordValidByHash: {
            [hashedPassword.toLowerCase()]: true,
          },
        },
      },
      txHash: '0xshouldnotbesent',
    });

    const token = await issueWorkerLoginToken({
      env,
      wallet,
      sessionSlug,
      onChainGatesByResource: {
        default: { sbtAddresses: [], chainId: 84532, mode: 0 },
        ai: { sbtAddresses: [], chainId: 84532, mode: 0 },
        arweave: { sbtAddresses: [], chainId: 84532, mode: 0 },
        rpc: { sbtAddresses: [], chainId: 84532, mode: 0 },
        txGas: { sbtAddresses: [sbtAddress], chainId: 84532, mode: 0 },
      },
    });

    const response = await sessionCorsWorker.fetch(
      makeActionRequest({
        token,
        sessionSlug,
        body: {
          action: 'request_test_eth',
          address: otherRecipient,
          amountEth: '0.0000001',
          sbtAddress,
          hashedPassword,
        },
      }),
      env,
      {}
    );
    const payload = await response.json();

    assert.equal(response.status, 403);
    assert.equal(payload?.error, 'Proof-backed faucet requests must fund the authenticated wallet.');
  } finally {
    global.fetch = originalFetch;
    Object.defineProperty(global, 'crypto', {
      configurable: true,
      value: originalCrypto,
    });
  }
});

test('group-password faucet proofs reject public groupPasswordHash values without a signature', async () => {
  const originalFetch = global.fetch;
  const originalCrypto = global.crypto;
  Object.defineProperty(global, 'crypto', {
    configurable: true,
    value: webcrypto,
  });

  const sessionSlug = 'faucet-proof-group-hash-rejected';
  const sbtAddress = '0x0000000000000000000000000000000000000106';
  const wallet = new ethers.Wallet('0x59c6995e998f97a5a0044976f84ce7de5d9d7f17b2f6a6a5f76f8864c8ad88f5');
  const faucetWallet = new ethers.Wallet('0x8b3a350cf5c34c9194ca3a545d3f6f9f4c7e2d36505f8b0e62be5285bdcf0582');
  const groupPassword = 'shared-secret';
  const onChainGroupPasswordHash = buildGroupPasswordHash(groupPassword);
  const env = installSessionCoordinatorBinding({
    GROUP_KV: createMemoryKv({
      [SESSION_CONFIG_KEY(sessionSlug)]: JSON.stringify(buildSessionConfig()),
      [SESSION_SECRETS_KEY(sessionSlug)]: JSON.stringify({ faucetPrivateKey: faucetWallet.privateKey }),
    }),
    TOKEN_HMAC_SECRET: 'test-secret',
  });

  try {
    global.fetch = buildWorkerRpcFetch({
      onChainGatesByResource: {
        default: { sbtAddresses: [], chainId: 84532, mode: 0 },
        ai: { sbtAddresses: [], chainId: 84532, mode: 0 },
        arweave: { sbtAddresses: [], chainId: 84532, mode: 0 },
        rpc: { sbtAddresses: [], chainId: 84532, mode: 0 },
        txGas: { sbtAddresses: [sbtAddress], chainId: 84532, mode: 0 },
      },
      sbtValidationByToken: {
        [sbtAddress.toLowerCase()]: {
          hasPasswordMint: false,
          groupPasswordHash: onChainGroupPasswordHash,
        },
      },
      txHash: '0xshouldnotbesent',
    });

    const token = await issueWorkerLoginToken({
      env,
      wallet,
      sessionSlug,
      onChainGatesByResource: {
        default: { sbtAddresses: [], chainId: 84532, mode: 0 },
        ai: { sbtAddresses: [], chainId: 84532, mode: 0 },
        arweave: { sbtAddresses: [], chainId: 84532, mode: 0 },
        rpc: { sbtAddresses: [], chainId: 84532, mode: 0 },
        txGas: { sbtAddresses: [sbtAddress], chainId: 84532, mode: 0 },
      },
    });

    const response = await sessionCorsWorker.fetch(
      makeActionRequest({
        token,
        sessionSlug,
        body: {
          action: 'request_test_eth',
          address: wallet.address,
          amountEth: '0.0000001',
          sbtAddress,
          groupPasswordHash: onChainGroupPasswordHash,
        },
      }),
      env,
      {}
    );
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.equal(payload?.error, 'Missing group signature.');
  } finally {
    global.fetch = originalFetch;
    Object.defineProperty(global, 'crypto', {
      configurable: true,
      value: originalCrypto,
    });
  }
});

test('group-password faucet proofs accept a valid group mint signature', async () => {
  const originalFetch = global.fetch;
  const originalCrypto = global.crypto;
  Object.defineProperty(global, 'crypto', {
    configurable: true,
    value: webcrypto,
  });

  const sessionSlug = 'faucet-proof-group-signature';
  const sbtAddress = '0x0000000000000000000000000000000000000107';
  const wallet = new ethers.Wallet('0x59c6995e998f97a5a0044976f84ce7de5d9d7f17b2f6a6a5f76f8864c8ad88f5');
  const faucetWallet = new ethers.Wallet('0x8b3a350cf5c34c9194ca3a545d3f6f9f4c7e2d36505f8b0e62be5285bdcf0582');
  const groupPassword = 'shared-secret';
  const onChainGroupPasswordHash = buildGroupPasswordHash(groupPassword);
  const signature = await signGroupMintAuthorization({
    password: groupPassword,
    sbtAddress,
    recipientAddress: wallet.address,
  });
  const env = installSessionCoordinatorBinding({
    GROUP_KV: createMemoryKv({
      [SESSION_CONFIG_KEY(sessionSlug)]: JSON.stringify(buildSessionConfig()),
      [SESSION_SECRETS_KEY(sessionSlug)]: JSON.stringify({ faucetPrivateKey: faucetWallet.privateKey }),
    }),
    TOKEN_HMAC_SECRET: 'test-secret',
  });

  try {
    global.fetch = buildWorkerRpcFetch({
      onChainGatesByResource: {
        default: { sbtAddresses: [], chainId: 84532, mode: 0 },
        ai: { sbtAddresses: [], chainId: 84532, mode: 0 },
        arweave: { sbtAddresses: [], chainId: 84532, mode: 0 },
        rpc: { sbtAddresses: [], chainId: 84532, mode: 0 },
        txGas: { sbtAddresses: [sbtAddress], chainId: 84532, mode: 0 },
      },
      sbtValidationByToken: {
        [sbtAddress.toLowerCase()]: {
          hasPasswordMint: false,
          groupPasswordHash: onChainGroupPasswordHash,
        },
      },
      txHash: '0xgroupproof123',
    });

    const token = await issueWorkerLoginToken({
      env,
      wallet,
      sessionSlug,
      onChainGatesByResource: {
        default: { sbtAddresses: [], chainId: 84532, mode: 0 },
        ai: { sbtAddresses: [], chainId: 84532, mode: 0 },
        arweave: { sbtAddresses: [], chainId: 84532, mode: 0 },
        rpc: { sbtAddresses: [], chainId: 84532, mode: 0 },
        txGas: { sbtAddresses: [sbtAddress], chainId: 84532, mode: 0 },
      },
    });

    const response = await sessionCorsWorker.fetch(
      makeActionRequest({
        token,
        sessionSlug,
        body: {
          action: 'request_test_eth',
          address: wallet.address,
          amountEth: '0.0000001',
          sbtAddress,
          signature,
        },
      }),
      env,
      {}
    );
    const payload = await response.json();
    const rpcMethods = global.fetch.calls.map(([, options]) => JSON.parse(options?.body || '{}').method);

    assert.equal(response.status, 200);
    assert.equal(payload?.txHash, '0xgroupproof123');
    assert.ok(rpcMethods.includes('eth_sendRawTransaction'));
  } finally {
    global.fetch = originalFetch;
    Object.defineProperty(global, 'crypto', {
      configurable: true,
      value: originalCrypto,
    });
  }
});
