import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeArweaveAssociationTags } from './arweaveAssociationNormalization.js';

const SESSION_ID = '0x11111111111111111111111111111111';
const RPC_URL = 'https://rpc.example';
const SBT_ADDRESS = '0x0000000000000000000000000000000000000101';
const UPLOADER_ADDRESS = '0x00000000000000000000000000000000000000aa';

const isAddress = (value) => /^0x[0-9a-fA-F]{40}$/.test(typeof value === 'string' ? value.trim() : '');
const toStr = (value) => (typeof value === 'string' ? value : value == null ? '' : String(value));
const normalizeSessionIdHex = (raw) => {
  const value = toStr(raw).trim();
  if (!value) return '';
  if (value.startsWith('0x') && value.length === 34 && /^[0-9a-fA-F]{32}$/.test(value.slice(2))) {
    return `0x${value.slice(2).toLowerCase()}`;
  }
  const compact = value.replace(/[^0-9a-fA-F]/g, '').toLowerCase();
  return compact.length === 32 ? `0x${compact}` : '';
};

const createDeps = (overrides = {}) => ({
  callContractFunction: async ({ method }) => {
    if (method === 'balanceOf') return [0n];
    if (method === 'admin') return ['0x00000000000000000000000000000000000000bb'];
    if (method === 'owner') return ['0x00000000000000000000000000000000000000cc'];
    throw new Error(`Unexpected contract method: ${method}`);
  },
  getErc721Interface: () => ({ name: 'erc721' }),
  getSbtAdminInterface: () => ({ name: 'sbtAdmin' }),
  isAddress,
  isPositiveBalance: (value) => {
    try {
      return BigInt(value) > 0n;
    } catch {
      return false;
    }
  },
  normalizeSessionIdHex,
  readSessionBySlugOnChain: async () => ({ ok: true, tuple: ['', 0, '', '', '', 0, 0, SESSION_ID] }),
  resolveRegistryRpcUrls: () => [RPC_URL],
  resolveRpcUrlListForGate: () => [RPC_URL],
  rpcRequest: async () => '0x14a34',
  toChainId: (value) => Number(value) || 0,
  toRegistrySessionSlug: (slug) => toStr(slug).trim() || 'general',
  toStr,
  ...overrides,
});

test('normalizeArweaveAssociationTags canonicalizes CE-SessionId through the extracted helper path', async () => {
  const tags = [{ name: 'CE-SessionId', value: '11111111111111111111111111111111' }];
  const reads = [];
  const chainAttestationCache = new Map();

  const result = await normalizeArweaveAssociationTags({
    tags,
    slug: 'session-a',
    config: {
      registryAddress: '0x0000000000000000000000000000000000000001',
      registryChainId: 84532,
    },
    uploaderAddress: '',
    chainAttestationCache,
    deps: createDeps({
      readSessionBySlugOnChain: async (value) => {
        reads.push(value);
        return { ok: true, tuple: ['', 0, '', '', '', 0, 0, SESSION_ID] };
      },
    }),
  });

  assert.equal(result.ok, true);
  assert.deepEqual(reads, [{
    registryAddress: '0x0000000000000000000000000000000000000001',
    registryRpcUrls: [RPC_URL],
    registrySlug: 'session-a',
    expectedChainId: 84532,
    chainAttestationCache,
  }]);
  assert.deepEqual(tags, [{ name: 'CE-SessionId', value: SESSION_ID }]);
});

test('normalizeArweaveAssociationTags preserves CE-SessionId mismatch failures', async () => {
  const tags = [{ name: 'CE-SessionId', value: '0x22222222222222222222222222222222' }];

  const result = await normalizeArweaveAssociationTags({
    tags,
    slug: 'session-b',
    config: {
      registryAddress: '0x0000000000000000000000000000000000000001',
      registryChainId: 84532,
    },
    uploaderAddress: '',
    deps: createDeps(),
  });

  assert.deepEqual(result, {
    ok: false,
    status: 403,
    error: 'CE-SessionId does not match authenticated session.',
    reason: 'session-id-mismatch',
    tags,
  });
});

test('normalizeArweaveAssociationTags preserves session-id resolve failures from the shared tuple reader', async () => {
  const tags = [{ name: 'CE-SessionId', value: SESSION_ID }];

  const result = await normalizeArweaveAssociationTags({
    tags,
    slug: 'session-b',
    config: { registryAddress: '0x0000000000000000000000000000000000000001' },
    uploaderAddress: '',
    deps: createDeps({
      readSessionBySlugOnChain: async () => ({ ok: false, error: new Error('registry read failed') }),
    }),
  });

  assert.deepEqual(result, {
    ok: false,
    status: 400,
    error: 'registry read failed',
    reason: 'session-id-resolve',
    tags,
  });
});

test('normalizeArweaveAssociationTags preserves CE-SbtChainId and CE-SbtAddress missing-pair failures', async () => {
  const tags = [{ name: 'CE-SbtChainId', value: '84532' }];

  const result = await normalizeArweaveAssociationTags({
    tags,
    slug: 'session-c',
    config: { registryAddress: '0x0000000000000000000000000000000000000001' },
    uploaderAddress: UPLOADER_ADDRESS,
    deps: createDeps(),
  });

  assert.deepEqual(result, {
    ok: false,
    status: 403,
    error: 'CE-SbtChainId and CE-SbtAddress must be provided together.',
    reason: 'sbt-association',
    tags,
  });
});

test('normalizeArweaveAssociationTags canonicalizes accepted CE-SbtChainId and CE-SbtAddress tags', async () => {
  const tags = [
    { name: 'CE-SbtChainId', value: '84532' },
    { name: 'CE-SbtAddress', value: SBT_ADDRESS.toUpperCase() },
  ];

  const result = await normalizeArweaveAssociationTags({
    tags,
    slug: 'session-d',
    config: { registryAddress: '0x0000000000000000000000000000000000000001' },
    uploaderAddress: UPLOADER_ADDRESS,
    deps: createDeps({
      callContractFunction: async ({ method }) => {
        if (method === 'balanceOf') return [1n];
        throw new Error(`Unexpected contract method: ${method}`);
      },
    }),
  });

  assert.equal(result.ok, true);
  assert.deepEqual(tags, [
    { name: 'CE-SbtChainId', value: '84532' },
    { name: 'CE-SbtAddress', value: SBT_ADDRESS.toLowerCase() },
  ]);
});
