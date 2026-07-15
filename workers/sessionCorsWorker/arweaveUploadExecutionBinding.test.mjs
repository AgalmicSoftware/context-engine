import test from 'node:test';
import assert from 'node:assert/strict';

import { createArweaveUploadWithWorkerDeps } from './arweaveUploadExecutionBinding.js';

test('createArweaveUploadWithWorkerDeps preserves the worker-specific Arweave upload deps bundle', async () => {
  const request = new Request('https://worker.example/arweave/upload', {
    method: 'POST',
    headers: {
      authorization: 'Bearer token',
    },
  });
  const baseHeaders = { 'Access-Control-Allow-Origin': 'https://allowed.example' };
  const config = { registryAddress: '0x0000000000000000000000000000000000000001' };
  const secrets = { arweaveJwk: '{"kty":"RSA"}' };
  const logs = [];
  const response = new Response('ok');

  const arweaveUpload = createArweaveUploadWithWorkerDeps({
    deps: {
      arweaveUpload: async (value) => {
        assert.equal(value.request, request);
        assert.equal(value.baseHeaders, baseHeaders);
        assert.equal(value.config, config);
        assert.equal(value.secrets, secrets);
        assert.equal(value.slug, 'session-a');
        assert.equal(value.uploaderAddress, '0xabc');
        assert.equal(value.deps.json, 'json');
        assert.equal(value.deps.toStr, 'toStr');
        assert.equal(value.deps.readArweaveUploadRequestPayload, 'readArweaveUploadRequestPayload');
        assert.equal(value.deps.resolveArweaveUploadJwk, 'resolveArweaveUploadJwk');
        assert.equal(value.deps.normalizeArweaveCeTags, 'normalizeArweaveCeTags');
        assert.equal(value.deps.normalizeArweaveAssociationTags, 'normalizeArweaveAssociationTags');
        assert.equal(value.deps.rpcRequest, 'rpcRequest');
        assert.equal(value.deps.callContractFunction, 'callContractFunction');
        assert.equal(value.deps.readSessionBySlugOnChain, 'readSessionBySlugOnChain');
        assert.equal(value.deps.getErc721Interface, 'getErc721Interface');
        assert.equal(value.deps.getSbtAdminInterface, 'getSbtAdminInterface');
        assert.equal(value.deps.isAddress, 'isAddress');
        assert.equal(value.deps.isPositiveBalance, 'isPositiveBalance');
        assert.equal(value.deps.normalizeSessionIdHex, 'normalizeSessionIdHex');
        assert.equal(value.deps.resolveRegistryRpcUrls, 'resolveRegistryRpcUrls');
        assert.equal(value.deps.resolveRpcUrlListForGate, 'resolveRpcUrlListForGate');
        assert.equal(value.deps.toChainId, 'toChainId');
        assert.equal(value.deps.toRegistrySessionSlug, 'toRegistrySessionSlug');

        value.deps.log('[arweave] upload start', { requestId: 'req-1' });
        return response;
      },
      json: 'json',
      log: (...args) => {
        logs.push(args);
      },
      toStr: 'toStr',
      readArweaveUploadRequestPayload: 'readArweaveUploadRequestPayload',
      resolveArweaveUploadJwk: 'resolveArweaveUploadJwk',
      normalizeArweaveCeTags: 'normalizeArweaveCeTags',
      normalizeArweaveAssociationTags: 'normalizeArweaveAssociationTags',
      rpcRequest: 'rpcRequest',
      callContractFunction: 'callContractFunction',
      readSessionBySlugOnChain: 'readSessionBySlugOnChain',
      getErc721Interface: 'getErc721Interface',
      getSbtAdminInterface: 'getSbtAdminInterface',
      isAddress: 'isAddress',
      isPositiveBalance: 'isPositiveBalance',
      normalizeSessionIdHex: 'normalizeSessionIdHex',
      resolveRegistryRpcUrls: 'resolveRegistryRpcUrls',
      resolveRpcUrlListForGate: 'resolveRpcUrlListForGate',
      toChainId: 'toChainId',
      toRegistrySessionSlug: 'toRegistrySessionSlug',
    },
  });

  const result = await arweaveUpload({
    request,
    baseHeaders,
    config,
    secrets,
    slug: 'session-a',
    uploaderAddress: '0xabc',
  });

  assert.equal(result, response);
  assert.deepEqual(logs, [[
    '[arweave] upload start',
    { requestId: 'req-1' },
  ]]);
});
