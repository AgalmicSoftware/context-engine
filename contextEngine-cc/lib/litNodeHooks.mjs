import { Buffer } from 'buffer';
import { ethers } from 'ethers';
import { DEFAULT_CHAIN_ID } from './constants.mjs';
import { DEFAULT_CHIPOTLE_ACTION_CODE } from './litChipotleActionCatalog.mjs';
import {
  buildLitChipotlePolicy,
  fingerprintLitChipotlePolicy,
} from '../../client/src/utilities/crypto/litChipotlePolicy.ts';

const DEFAULT_LIT_CHAIN = 'ethereum';
const DEFAULT_CONNECT_TIMEOUT_MS = 45_000;
const WORKER_MEDIATED_LIT_ERROR = 'CE-CC no longer supports direct browser-Lit SDK encryption. Configure a session worker with Chipotle credentials and pass workerUrl, token, and sessionSlug.';

const LIT_CHAIN_BY_ID = Object.freeze({
  1: 'ethereum',
  10: 'optimism',
  56: 'bsc',
  137: 'polygon',
  42161: 'arbitrum',
  42220: 'celo',
  8453: 'base',
  84532: 'baseSepolia',
  11155111: 'sepolia',
  421614: 'arbitrumSepolia',
  11155420: 'optimismSepolia',
});

const CHAIN_ID_BY_LIT_CHAIN = Object.freeze(
  Object.entries(LIT_CHAIN_BY_ID).reduce((acc, [id, chain]) => {
    acc[chain] = Number(id);
    return acc;
  }, {})
);

const toStr = (value) => (
  typeof value === 'string'
    ? value
    : value == null
      ? ''
      : String(value)
);

const normalizeWorkerUrl = (value) => toStr(value).trim().replace(/\/+$/, '');

const normalizeSbtAddressList = (values = []) => {
  const out = [];
  const seen = new Set();
  (Array.isArray(values) ? values : []).forEach((raw) => {
    const value = toStr(raw).trim();
    if (!value || !ethers.utils.isAddress(value)) return;
    const normalized = ethers.utils.getAddress(value);
    const key = normalized.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(normalized);
  });
  return out;
};

const bufferHasBigUIntWrite = (BufferCtor) => {
  try {
    if (!BufferCtor || typeof BufferCtor.alloc !== 'function') return false;
    const probe = BufferCtor.alloc(8);
    return (
      typeof probe?.writeBigUInt64BE === 'function' ||
      typeof probe?.writeBigUint64BE === 'function'
    );
  } catch (_) {
    return false;
  }
};

const installBufferBigUIntWriteShim = (BufferCtor) => {
  if (!BufferCtor || !BufferCtor.prototype) return false;

  const writeCompat = function writeBigUInt64BECompat(value, offset = 0) {
    const start = Number(offset);
    if (!Number.isInteger(start) || start < 0 || start + 8 > this.length) {
      throw new RangeError('Index out of range');
    }
    let x = typeof value === 'bigint' ? value : BigInt(value);
    if (x < 0n || x > 0xffffffffffffffffn) {
      throw new RangeError('value out of range');
    }
    for (let i = 7; i >= 0; i -= 1) {
      this[start + i] = Number(x & 0xffn);
      x >>= 8n;
    }
    return start + 8;
  };

  if (typeof BufferCtor.prototype.writeBigUInt64BE !== 'function') {
    BufferCtor.prototype.writeBigUInt64BE = writeCompat;
  }
  if (typeof BufferCtor.prototype.writeBigUint64BE !== 'function') {
    BufferCtor.prototype.writeBigUint64BE = BufferCtor.prototype.writeBigUInt64BE;
  }
  return bufferHasBigUIntWrite(BufferCtor);
};

export function ensureLitBufferCompatibility() {
  const scope = globalThis;
  if (bufferHasBigUIntWrite(scope.Buffer)) return scope.Buffer;
  if (bufferHasBigUIntWrite(Buffer)) {
    scope.Buffer = Buffer;
    return scope.Buffer;
  }
  if (installBufferBigUIntWriteShim(scope.Buffer)) return scope.Buffer;
  if (installBufferBigUIntWriteShim(Buffer)) {
    scope.Buffer = Buffer;
    return scope.Buffer;
  }
  return null;
}

ensureLitBufferCompatibility();

export const resolveLitChain = ({ chainId, litChain, chain } = {}) => {
  if (litChain) return String(litChain).trim();
  if (chain) return String(chain).trim();
  const id = Number(chainId);
  if (Number.isFinite(id) && LIT_CHAIN_BY_ID[id]) return LIT_CHAIN_BY_ID[id];
  return DEFAULT_LIT_CHAIN;
};

const ensureArray = (value) => (Array.isArray(value) ? value : (value ? [value] : []));

export const buildSbtAccessControlConditions = ({
  sbtAddress,
  sbtAddresses,
  chain,
  litChain,
  chainId,
  mode,
  requireAll,
} = {}) => {
  const addresses = ensureArray(sbtAddresses || sbtAddress).filter(Boolean);
  const resolvedChain = resolveLitChain({ chainId, litChain, chain });
  const normalizedMode = mode == null ? '' : String(mode).trim().toLowerCase();
  const requireAllFlag = requireAll === true || requireAll === 1 || String(requireAll || '').trim() === '1';
  const isAll =
    requireAllFlag ||
    normalizedMode === 'all' ||
    normalizedMode === 'and' ||
    normalizedMode === '1';
  const operator = isAll ? 'and' : 'or';
  const conditions = addresses
    .filter((addr) => ethers.utils.isAddress(addr))
    .map((addr) => ({
      contractAddress: addr,
      standardContractType: 'ERC721',
      chain: resolvedChain,
      method: 'balanceOf',
      parameters: [':userAddress'],
      returnValueTest: { comparator: '>', value: '0' },
    }));
  if (!conditions.length) return null;
  if (conditions.length === 1) return conditions;
  const out = [];
  conditions.forEach((condition, index) => {
    if (index > 0) out.push({ operator });
    out.push(condition);
  });
  return out;
};

const extractSbtGateFromAccessControlConditions = (conditions) => {
  const entries = Array.isArray(conditions) ? conditions : [];
  const sbtAddresses = [];
  const seen = new Set();
  let gateMode = 'any';
  let litChain = '';

  entries.forEach((entry) => {
    if (!entry || typeof entry !== 'object') return;
    const operator = toStr(entry.operator).trim().toLowerCase();
    if (operator === 'and') gateMode = 'all';
    if (operator === 'or' && gateMode !== 'all') gateMode = 'any';

    const contractAddress = toStr(entry.contractAddress).trim();
    if (!ethers.utils.isAddress(contractAddress)) return;
    if (toStr(entry.standardContractType).trim().toUpperCase() !== 'ERC721') return;
    if (toStr(entry.method).trim() !== 'balanceOf') return;
    const parameters = Array.isArray(entry.parameters) ? entry.parameters : [];
    if (toStr(parameters[0]).trim() !== ':userAddress') return;
    const comparator = toStr(entry.returnValueTest?.comparator).trim();
    const value = toStr(entry.returnValueTest?.value).trim();
    if (comparator !== '>' || value !== '0') return;

    const normalized = ethers.utils.getAddress(contractAddress);
    const key = normalized.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      sbtAddresses.push(normalized);
    }
    if (!litChain) litChain = toStr(entry.chain).trim();
  });

  if (!sbtAddresses.length) return null;
  return {
    sbtAddresses,
    gateMode,
    litChain,
    chainId: Number(CHAIN_ID_BY_LIT_CHAIN[litChain] || 0) || null,
  };
};

const encodeChipotleKeyMessage = (raw) => {
  const bytes = raw instanceof Uint8Array ? raw : new Uint8Array(raw || []);
  return ethers.utils.hexlify(bytes);
};

const parseChipotleActionResponse = (payload) => {
  if (payload && typeof payload === 'object' && payload.response && typeof payload.response === 'object') {
    if (payload.response.response && typeof payload.response.response === 'object') {
      return payload.response.response;
    }
    return payload.response;
  }
  return payload && typeof payload === 'object' ? payload : {};
};

const buildChipotleDataHashSentinel = ({
  litActionCid = '',
  chainId = null,
  gateMode = 'any',
  sbtAddresses = [],
  policyFingerprint = '',
} = {}) => (
  [
    'chipotle-v3',
    toStr(litActionCid).trim() || 'action',
    Number(chainId || 0) || 0,
    toStr(gateMode).trim() || 'any',
    normalizeSbtAddressList(sbtAddresses).join(',').toLowerCase(),
    toStr(policyFingerprint).trim().toLowerCase(),
  ].join(':')
);

const resolveGateFromOptions = ({
  accessControlConditions,
  chipotle = {},
  chainId,
} = {}) => {
  const explicitGate = chipotle && typeof chipotle === 'object' ? chipotle : {};
  const explicitPolicy = explicitGate.policy && typeof explicitGate.policy === 'object'
    ? explicitGate.policy
    : {};
  const derivedGate = extractSbtGateFromAccessControlConditions(accessControlConditions) || {};
  const sbtAddresses = normalizeSbtAddressList(
    explicitGate.sbtAddresses || explicitPolicy.sbtAddresses || derivedGate.sbtAddresses || []
  );
  if (!sbtAddresses.length) {
    throw new Error('Lit Chipotle requires at least one SBT gate address.');
  }
  const gateChainId = Number(
    explicitGate.chainId ||
    explicitPolicy.chainId ||
    derivedGate.chainId ||
    chainId ||
    0
  ) || DEFAULT_CHAIN_ID;
  const gateMode = toStr(
    explicitGate.gateMode ||
    explicitPolicy.gateMode ||
    derivedGate.gateMode ||
    'any'
  ).trim().toLowerCase() === 'all'
    ? 'all'
    : 'any';
  return {
    sbtAddresses,
    gateChainId,
    gateMode,
  };
};

const withTimeout = async (promise, timeoutMs) => {
  const timeout = Number(timeoutMs || 0);
  if (!Number.isFinite(timeout) || timeout <= 0) return promise;
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`Lit Chipotle worker request timed out after ${timeout}ms.`)),
          timeout
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

export async function createNodeLitHooks({
  workerUrl,
  token,
  sessionSlug,
  slug,
  chainId = DEFAULT_CHAIN_ID,
  connectTimeout = DEFAULT_CONNECT_TIMEOUT_MS,
  fetchImpl = globalThis.fetch,
} = {}) {
  const normalizedWorkerUrl = normalizeWorkerUrl(workerUrl);
  const normalizedToken = toStr(token).trim();
  const normalizedSlug = toStr(sessionSlug || slug).trim();

  if (!normalizedWorkerUrl || !normalizedToken || !normalizedSlug) {
    throw new Error(WORKER_MEDIATED_LIT_ERROR);
  }
  if (typeof fetchImpl !== 'function') {
    throw new Error('Fetch unavailable for worker-mediated Lit Chipotle request.');
  }

  const executeChipotleAction = async ({
    op,
    gate,
    message,
  } = {}) => {
    const response = await withTimeout(
      fetchImpl(`${normalizedWorkerUrl}/lit/chipotle-action`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${normalizedToken}`,
          'Content-Type': 'application/json',
          'X-Session-Slug': normalizedSlug,
        },
        body: JSON.stringify({
          action: 'lit_chipotle_execute',
          actionCode: DEFAULT_CHIPOTLE_ACTION_CODE,
          op,
          sbtAddresses: gate.sbtAddresses,
          gateMode: gate.gateMode,
          chainId: gate.gateChainId,
          ...(message ? { message } : {}),
        }),
      }),
      connectTimeout
    );
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.error || `Lit Chipotle worker request failed (${response.status}).`);
    }
    const actionResponse = parseChipotleActionResponse(payload);
    if (actionResponse?.ok === false) {
      throw new Error(actionResponse.reason || 'Lit Chipotle gate check failed.');
    }
    return actionResponse;
  };

  const saveKey = async (symmetricKey, opts = {}) => {
    const keyBytes = symmetricKey instanceof Uint8Array ? symmetricKey : new Uint8Array(symmetricKey || []);
    if (!keyBytes.length) {
      throw new Error('Lit Chipotle saveKey requires key bytes.');
    }
    const gate = resolveGateFromOptions({
      accessControlConditions: opts.accessControlConditions,
      chipotle: opts.chipotle,
      chainId: opts.chainId || chainId,
    });
    const wrapped = await executeChipotleAction({
      op: 'encrypt',
      gate,
      message: encodeChipotleKeyMessage(keyBytes),
    });
    const ciphertext = toStr(wrapped?.ciphertext).trim();
    if (!ciphertext) {
      throw new Error('Lit Chipotle encrypt did not return ciphertext.');
    }
    const responsePolicy = wrapped?.policy
      ? buildLitChipotlePolicy(wrapped.policy)
      : buildLitChipotlePolicy({
        chainId: gate.gateChainId,
        gateMode: gate.gateMode,
        sbtAddresses: gate.sbtAddresses,
        litActionCid: wrapped?.litActionCid || opts?.chipotle?.litActionCid,
        litPkpId: wrapped?.litPkpId || opts?.chipotle?.litPkpId,
      });
    const policyFingerprint = toStr(
      wrapped?.policyFingerprint || fingerprintLitChipotlePolicy(responsePolicy)
    ).trim();
    if (policyFingerprint.toLowerCase() !== fingerprintLitChipotlePolicy(responsePolicy).toLowerCase()) {
      throw new Error('Lit Chipotle encrypt returned mismatched policy metadata.');
    }
    return {
      ciphertext,
      dataToEncryptHash: buildChipotleDataHashSentinel({
        litActionCid: responsePolicy.litActionCid,
        chainId: responsePolicy.chainId,
        gateMode: responsePolicy.gateMode,
        sbtAddresses: responsePolicy.sbtAddresses,
        policyFingerprint,
      }),
      chipotle: {
        version: 2,
        litActionCid: responsePolicy.litActionCid,
        litPkpId: responsePolicy.litPkpId,
        sbtAddresses: responsePolicy.sbtAddresses,
        gateMode: responsePolicy.gateMode,
        chainId: responsePolicy.chainId,
        policyFingerprint,
        policy: responsePolicy,
      },
    };
  };

  return {
    saveKey,
    chain: resolveLitChain({ chainId }),
    litChain: resolveLitChain({ chainId }),
    litNetwork: 'chipotle',
    workerUrl: normalizedWorkerUrl,
    sessionSlug: normalizedSlug,
  };
}

export const __test__litNodeHooks = {
  WORKER_MEDIATED_LIT_ERROR,
  buildChipotleDataHashSentinel,
  encodeChipotleKeyMessage,
  extractSbtGateFromAccessControlConditions,
  parseChipotleActionResponse,
  resolveGateFromOptions,
};
