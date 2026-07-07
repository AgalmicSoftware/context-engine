import { ethers } from 'ethers';
import contractScripts from './chainGateway.js';
import { getWeb3Context } from './contractScripts.impl.js';
import { arweaveClient } from '../arweave/arweaveClient.js';

describe('contractScripts.getSbtMetadata tokenURI parsing', () => {
  jest.setTimeout(10000);
  const sbtAddress = '0x1111111111111111111111111111111111111111';
  const adminAddress = '0x2222222222222222222222222222222222222222';
  let contractSpy;
  let fetchSpy;
  let arweaveSpy;
  let checkTxExistsSpy;
  let originalFetch;
  const flushAsync = async (passes = 5) => {
    for (let i = 0; i < passes; i += 1) {
      await Promise.resolve();
    }
  };

  const baseContractStub = (tokenUriValue) => ({
    name: jest.fn().mockResolvedValue('Metadata Test SBT'),
    symbol: jest.fn().mockResolvedValue('MTSBT'),
    admin: jest.fn().mockResolvedValue(adminAddress),
    owner: jest.fn().mockResolvedValue(adminAddress),
    tokenURI: jest.fn().mockResolvedValue(tokenUriValue),
    getSBTMetadata: jest
      .fn()
      .mockResolvedValue([
        'Metadata Test SBT',
        'MTSBT',
        ethers.BigNumber.from(0),
        ethers.BigNumber.from(0),
        adminAddress,
        ethers.BigNumber.from(0),
        false,
        0,
        tokenUriValue,
      ]),
    maxTokens: jest.fn().mockResolvedValue(ethers.BigNumber.from(0)),
    collectionBurnAuth: jest.fn().mockResolvedValue(0),
    burnAuth: jest.fn().mockResolvedValue(0),
    mintingEndTime: jest.fn().mockResolvedValue(0),
    hasPasswordMint: jest.fn().mockResolvedValue(false),
  });

  beforeEach(() => {
    jest.clearAllMocks();
    originalFetch = global.fetch;
    if (!global.fetch) {
      global.fetch = jest.fn();
    }
  });

  afterEach(() => {
    if (contractSpy) contractSpy.mockRestore();
    if (fetchSpy) fetchSpy.mockRestore();
    if (arweaveSpy) arweaveSpy.mockRestore();
    if (checkTxExistsSpy) checkTxExistsSpy.mockRestore();
    contractSpy = null;
    fetchSpy = null;
    arweaveSpy = null;
    checkTxExistsSpy = null;
    jest.useRealTimers();
    global.fetch = originalFetch;
    try {
      delete globalThis.CE_ARWEAVE_PREFLIGHT_SBT_METADATA;
    } catch (_) {}
  });

  it('uses extensionless direct-image tokenURI as renderable image when response content-type is image/*', async () => {
    const directImageUrl = 'https://cdn.example.com/sbt-image';
    const stub = baseContractStub(directImageUrl);
    contractSpy = jest.spyOn(ethers, 'Contract').mockImplementation(() => stub);
    fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      headers: { get: () => 'image/png' },
      text: async () => 'not-json',
      json: async () => null,
    });

    const meta = await contractScripts.getSbtMetadata('none', sbtAddress, {
      slug: 'edge',
      networkChainId: 84532,
      contracts: {},
    });

    expect(meta).toEqual(
      expect.objectContaining({
        tokenURI: directImageUrl,
        image: directImageUrl,
        admin: adminAddress,
        deployer: adminAddress,
        creator: adminAddress,
        sessionSlug: 'edge',
        sessionSlugExplicit: false,
      }),
    );
  });

  it('keeps metadata tokenURI link semantics for JSON tokenURI payloads', async () => {
    const metadataUrl = 'https://example.com/metadata/sbt.json';
    const imageUrl = 'https://example.com/assets/sbt.webp';
    const stub = baseContractStub(metadataUrl);
    contractSpy = jest.spyOn(ethers, 'Contract').mockImplementation(() => stub);
    fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json; charset=utf-8' },
      json: async () => ({
        name: 'JSON Metadata SBT',
        image: imageUrl,
        sessionSlug: 'beta',
        creator: '0x3333333333333333333333333333333333333333',
        maxTokens: '0',
        mintingEndTime: 0,
        burnAuth: 0,
        hasPasswordMint: false,
      }),
      text: async () => '',
    });

    const meta = await contractScripts.getSbtMetadata('none', sbtAddress, {
      slug: 'edge',
      networkChainId: 84532,
      contracts: {},
    });

    expect(meta).toEqual(
      expect.objectContaining({
        tokenURI: metadataUrl,
        image: imageUrl,
        sessionSlug: 'beta',
        sessionSlugExplicit: true,
        creator: '0x3333333333333333333333333333333333333333',
        deployer: adminAddress,
      }),
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      metadataUrl,
      expect.objectContaining({
        headers: expect.objectContaining({ accept: 'application/json' }),
      }),
    );
  });

  it('uses getSBTMetadata for collection tokenURI before probing token-specific URIs', async () => {
    const metadataUrl = 'https://example.com/metadata/aggregate-getter.json';
    const imageUrl = 'https://example.com/assets/aggregate-getter.webp';
    const stub = baseContractStub(null);
    stub.tokenURI.mockRejectedValue(new Error('nonexistent token'));
    stub.getSBTMetadata.mockResolvedValue([
      'Metadata Test SBT',
      'MTSBT',
      ethers.BigNumber.from(0),
      ethers.BigNumber.from(0),
      adminAddress,
      ethers.BigNumber.from(0),
      false,
      0,
      metadataUrl,
    ]);
    contractSpy = jest.spyOn(ethers, 'Contract').mockImplementation(() => stub);
    fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json; charset=utf-8' },
      json: async () => ({
        name: 'Aggregate Getter SBT',
        image: imageUrl,
      }),
      text: async () => '',
    });

    const meta = await contractScripts.getSbtMetadata('none', sbtAddress, {
      slug: 'edge',
      networkChainId: 84532,
      contracts: {},
    });

    expect(meta).toEqual(
      expect.objectContaining({
        tokenURI: metadataUrl,
        image: imageUrl,
      }),
    );
    expect(stub.getSBTMetadata).toHaveBeenCalledTimes(1);
    expect(stub.tokenURI).not.toHaveBeenCalled();
  });

  it('normalizes legacy SBT document URL aliases from tokenURI JSON', async () => {
    const metadataUrl = 'https://example.com/metadata/sbt-doc-url.json';
    const stub = baseContractStub(metadataUrl);
    contractSpy = jest.spyOn(ethers, 'Contract').mockImplementation(() => stub);
    fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json; charset=utf-8' },
      json: async () => ({
        name: 'Doc Alias SBT',
        image: 'https://example.com/assets/sbt.webp',
        docURL: 'https://example.com/docs/single',
        documents: [{ href: 'https://example.com/docs/object' }],
        maxTokens: '0',
        mintingEndTime: 0,
        burnAuth: 0,
        hasPasswordMint: false,
      }),
      text: async () => '',
    });

    const meta = await contractScripts.getSbtMetadata('none', sbtAddress, {
      slug: 'edge',
      networkChainId: 84532,
      contracts: {},
    });

    expect(meta.documentURLs).toEqual(['https://example.com/docs/single']);
  });

  it('prefers on-chain mint flags over conflicting tokenURI metadata hints', async () => {
    const metadataUrl = 'https://example.com/metadata/conflicting-flags.json';
    const stub = baseContractStub(metadataUrl);
    stub.maxTokens.mockResolvedValue(ethers.BigNumber.from(2));
    stub.mintingEndTime.mockResolvedValue(ethers.BigNumber.from(12345));
    stub.hasPasswordMint.mockResolvedValue(false);
    contractSpy = jest.spyOn(ethers, 'Contract').mockImplementation(() => stub);
    fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json; charset=utf-8' },
      json: async () => ({
        name: 'Conflicting Metadata SBT',
        maxTokens: '999',
        mintingEndTime: 987654321,
        hasPasswordMint: true,
      }),
      text: async () => '',
    });

    const meta = await contractScripts.getSbtMetadata('none', sbtAddress, {
      slug: 'edge',
      networkChainId: 84532,
      contracts: {},
    });

    expect(meta).toEqual(
      expect.objectContaining({
        maxTokens: '2',
        mintingEndTime: 12345,
        hasPasswordMint: false,
      }),
    );
  });

  it('falls back to hasPasswordMint when mintMode is unavailable on the contract', async () => {
    const metadataUrl = 'https://example.com/metadata/legacy-flags.json';
    const stub = baseContractStub(metadataUrl);
    stub.hasPasswordMint.mockResolvedValue(true);
    contractSpy = jest.spyOn(ethers, 'Contract').mockImplementation(() => stub);
    fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json; charset=utf-8' },
      json: async () => ({
        name: 'Legacy Flag SBT',
        hasPasswordMint: false,
      }),
      text: async () => '',
    });

    const meta = await contractScripts.getSbtMetadata('none', sbtAddress, {
      slug: 'edge',
      networkChainId: 84532,
      contracts: {},
    });

    expect(meta).toEqual(
      expect.objectContaining({
        tokenURI: metadataUrl,
        hasPasswordMint: true,
      }),
    );
  });

  it.each([
    ['PublicClaim', 0, true, false],
    ['PasswordCommitReveal', 1, false, true],
    ['UnlimitedGroupSignature', 2, true, false],
    ['LimitedInviteSignature', 3, false, true],
  ])(
    'derives %s metadata from on-chain mintMode()',
    async (_label, mintMode, legacyHasPasswordMint, expectedHasPasswordMint) => {
      const metadataUrl = `https://example.com/metadata/mint-mode-${mintMode}.json`;
      const stub = baseContractStub(metadataUrl);
      stub.hasPasswordMint.mockResolvedValue(legacyHasPasswordMint);
      stub.mintMode = jest.fn().mockResolvedValue(ethers.BigNumber.from(mintMode));
      contractSpy = jest.spyOn(ethers, 'Contract').mockImplementation(() => stub);
      fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json; charset=utf-8' },
        json: async () => ({
          name: `Mint Mode ${mintMode} SBT`,
          hasPasswordMint: legacyHasPasswordMint,
        }),
        text: async () => '',
      });

      const meta = await contractScripts.getSbtMetadata('none', sbtAddress, {
        slug: 'edge',
        networkChainId: 84532,
        contracts: {},
      });

      expect(meta).toEqual(
        expect.objectContaining({
          tokenURI: metadataUrl,
          mintMode,
          hasPasswordMint: expectedHasPasswordMint,
        }),
      );
      expect(stub.mintMode).toHaveBeenCalledTimes(1);
    },
  );

  it('parses encrypted tags, document URLs, and gate metadata from tokenURI JSON', async () => {
    const metadataUrl = 'https://example.com/metadata/private-sbt.json';
    const stub = baseContractStub(metadataUrl);
    contractSpy = jest.spyOn(ethers, 'Contract').mockImplementation(() => stub);
    fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json; charset=utf-8' },
      json: async () => ({
        name: 'Private Metadata SBT',
        image: 'https://example.com/assets/private.webp',
        tags: [],
        tagsEncrypted: '{"ciphertext":"tags"}',
        tagsAccess: { type: 'sbt', gateIds: ['gate-tags'], chainId: 84532 },
        documentURLs: [],
        documentURLsEncrypted: '{"ciphertext":"docs"}',
        documentURLsAccess: { type: 'sbt', gateIds: ['gate-docs'], chainId: 84532 },
        encryptedFieldGates: {
          tags: 'gate-tags',
          documentURLs: 'gate-docs',
        },
        maxTokens: '0',
        mintingEndTime: 0,
        burnAuth: 0,
        hasPasswordMint: false,
      }),
      text: async () => '',
    });

    const meta = await contractScripts.getSbtMetadata('none', sbtAddress, {
      slug: 'edge',
      networkChainId: 84532,
      contracts: {},
    });

    expect(meta).toEqual(
      expect.objectContaining({
        tags: [],
        tagsEncrypted: '{"ciphertext":"tags"}',
        tagsAccess: expect.objectContaining({
          gateIds: ['gate-tags'],
          chainId: 84532,
        }),
        documentURLs: [],
        documentURLsEncrypted: '{"ciphertext":"docs"}',
        documentURLsAccess: expect.objectContaining({
          gateIds: ['gate-docs'],
          chainId: 84532,
        }),
        encryptedFieldGates: {
          tags: 'gate-tags',
          documentURLs: 'gate-docs',
        },
      }),
    );
  });

  it('parses v2 encryptedFields metadata and keeps contractName separate from masked display name', async () => {
    const metadataUrl = 'https://example.com/metadata/private-v2-sbt.json';
    const stub = baseContractStub(metadataUrl);
    stub.name.mockResolvedValue('CE-SBT-12');
    contractSpy = jest.spyOn(ethers, 'Contract').mockImplementation(() => stub);
    fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json; charset=utf-8' },
      json: async () => ({
        v: 2,
        name: '',
        description: '',
        image: '',
        tags: [],
        documentURLs: [],
        encryptedFields: {
          name: '{"ciphertext":"name"}',
          description: '{"ciphertext":"desc"}',
          tags: '{"ciphertext":"tags"}',
          documentURLs: '{"ciphertext":"docs"}',
          image: {
            storage: 'lit-arweave',
            txId: 'img-tx',
            url: 'lit-ar://img-tx',
            mime: 'image/png',
            name: 'badge.png',
          },
        },
        encryptedFieldGates: {
          name: 'gate-name',
          description: 'gate-description',
          tags: 'gate-tags',
          documentURLs: 'gate-docs',
          image: 'gate-image',
        },
        encryption: {
          enabled: true,
          status: 'lit-v1',
          defaultGateId: 'gate-name',
          gateIds: ['gate-name', 'gate-description'],
          targets: {
            name: true,
            description: true,
            tags: true,
            documentURLs: true,
            image: true,
          },
        },
        maxTokens: '0',
        mintingEndTime: 0,
        burnAuth: 0,
        hasPasswordMint: false,
      }),
      text: async () => '',
    });

    const meta = await contractScripts.getSbtMetadata('none', sbtAddress, {
      slug: 'edge',
      networkChainId: 84532,
      contracts: {},
    });

    expect(meta).toEqual(
      expect.objectContaining({
        contractName: 'CE-SBT-12',
        name: '[encrypted]',
        nameLocked: true,
        nameEncrypted: '{"ciphertext":"name"}',
        description: '',
        descriptionLocked: true,
        descriptionEncrypted: '{"ciphertext":"desc"}',
        tags: [],
        tagsLocked: true,
        tagsEncrypted: '{"ciphertext":"tags"}',
        documentURLs: [],
        documentURLsLocked: true,
        documentURLsEncrypted: '{"ciphertext":"docs"}',
        image: '',
        imageLocked: true,
        imageEncrypted: {
          storage: 'lit-arweave',
          txId: 'img-tx',
          url: 'lit-ar://img-tx',
          mime: 'image/png',
          name: 'badge.png',
        },
        encryptedFields: expect.objectContaining({
          name: '{"ciphertext":"name"}',
          image: expect.objectContaining({ txId: 'img-tx' }),
        }),
        encryption: expect.objectContaining({
          status: 'lit-v1',
          defaultGateId: 'gate-name',
        }),
        encryptedFieldGates: {
          name: 'gate-name',
          description: 'gate-description',
          tags: 'gate-tags',
          documentURLs: 'gate-docs',
          image: 'gate-image',
        },
      }),
    );
  });

  it('ignores unsupported top-level legacy image lock metadata', async () => {
    const metadataUrl = 'https://example.com/metadata/legacy-image-lock.json';
    const stub = baseContractStub(metadataUrl);
    contractSpy = jest.spyOn(ethers, 'Contract').mockImplementation(() => stub);
    fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json; charset=utf-8' },
      json: async () => ({
        name: 'Legacy Image Field SBT',
        image: '',
        imageEncrypted: '{"ciphertext":"img"}',
        maxTokens: '0',
        mintingEndTime: 0,
        burnAuth: 0,
        hasPasswordMint: false,
      }),
      text: async () => '',
    });

    const meta = await contractScripts.getSbtMetadata('none', sbtAddress, {
      slug: 'edge',
      networkChainId: 84532,
      contracts: {},
    });

    expect(meta).toEqual(
      expect.objectContaining({
        name: 'Legacy Image Field SBT',
      }),
    );
    expect(meta.imageLocked).not.toBe(true);
    expect(meta.imageEncrypted).toBeUndefined();
  });

  it('accepts a pre-resolved web3 context object', async () => {
    const metadataUrl = 'https://example.com/metadata/context-sbt.json';
    const stub = baseContractStub(metadataUrl);
    contractSpy = jest.spyOn(ethers, 'Contract').mockImplementation(() => stub);
    fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json; charset=utf-8' },
      json: async () => ({
        name: 'Context Metadata SBT',
        maxTokens: '0',
        mintingEndTime: 0,
        burnAuth: 0,
        hasPasswordMint: false,
      }),
      text: async () => '',
    });

    const ctx = getWeb3Context({
      slug: 'edge',
      networkChainId: 84532,
      blockLimits: {
        start: 1,
        end: null,
      },
      contracts: {
        sbtFactory: {
          address: '0x00000000000000000000000000000000000000ac',
          chainId: 84532,
        },
      },
    });

    const meta = await contractScripts.getSbtMetadata('none', sbtAddress, ctx);

    expect(meta).toEqual(
      expect.objectContaining({
        tokenURI: metadataUrl,
        chainID: 84532,
        sessionSlug: 'edge',
        sessionSlugExplicit: false,
        deployer: adminAddress,
        creator: adminAddress,
      }),
    );
  });

  it('does not mutate the returned metadata object after a tokenURI fetch times out', async () => {
    jest.useFakeTimers();
    const metadataUrl = 'https://cdn.example.com/slow-image';
    const stub = baseContractStub(metadataUrl);
    let resolveFetch;

    contractSpy = jest.spyOn(ethers, 'Contract').mockImplementation(() => stub);
    fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
    );

    const metaPromise = contractScripts.getSbtMetadata('none', sbtAddress, {
      slug: 'edge',
      networkChainId: 84532,
      contracts: {},
    });

    await flushAsync();
    jest.advanceTimersByTime(4000);
    await flushAsync();

    const meta = await metaPromise;
    const metaSnapshot = { ...meta };

    expect(meta).toEqual(
      expect.objectContaining({
        tokenURI: metadataUrl,
        contractName: 'Metadata Test SBT',
        name: 'Metadata Test SBT',
        admin: adminAddress,
      }),
    );
    expect(meta.image).toBeUndefined();

    resolveFetch({
      ok: true,
      headers: { get: () => 'image/png' },
      text: async () => '',
      json: async () => null,
    });
    await flushAsync();

    expect(meta).toEqual(metaSnapshot);
    expect(meta.image).toBeUndefined();
  });

  it('returns on-chain metadata when raw Arweave tokenURI hydration stalls', async () => {
    const rawTxId = 'kcejtnnZ1GhyhjFfPAiLeX3Jaw0dXwhNnkCZ0zB1EuE';
    const stub = baseContractStub(rawTxId);
    stub.name.mockResolvedValue('Name Only SBT');
    stub.symbol.mockResolvedValue('CE-SBT-38');
    contractSpy = jest.spyOn(ethers, 'Contract').mockImplementation(() => stub);
    arweaveSpy = jest.spyOn(arweaveScripts, 'downloadDataFromArweave').mockImplementation(() => new Promise(() => {}));

    const metaPromise = contractScripts.getSbtMetadata('none', sbtAddress, {
      slug: 'edge',
      networkChainId: 84532,
      contracts: {},
    });

    const meta = await metaPromise;

    expect(meta).toEqual(
      expect.objectContaining({
        contractName: 'Name Only SBT',
        name: 'Name Only SBT',
        symbol: 'CE-SBT-38',
        admin: adminAddress,
        deployer: adminAddress,
        creator: adminAddress,
        sessionSlug: 'edge',
        sessionSlugExplicit: false,
      }),
    );
    expect(meta?.tokenURI || '').toContain(rawTxId);
    expect(arweaveSpy).toHaveBeenCalledTimes(1);
  });

  it('uses gateway fanout for display-critical SBT tokenURI metadata', async () => {
    const rawTxId = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    const stub = baseContractStub(rawTxId);
    stub.name.mockResolvedValue('Gateway First SBT');
    contractSpy = jest.spyOn(ethers, 'Contract').mockImplementation(() => stub);
    arweaveSpy = jest.spyOn(arweaveScripts, 'downloadDataFromArweave').mockResolvedValue(
      JSON.stringify({
        name: 'Gateway First SBT',
        image: 'https://example.com/assets/gateway-first.png',
      }),
    );

    const meta = await contractScripts.getSbtMetadata('none', sbtAddress, {
      slug: 'edge',
      networkChainId: 84532,
      contracts: {},
    });

    expect(meta).toEqual(
      expect.objectContaining({
        name: 'Gateway First SBT',
        contractName: 'Gateway First SBT',
      }),
    );
    const [, arweaveOpts] = arweaveSpy.mock.calls[0];
    expect(arweaveSpy).toHaveBeenCalledTimes(1);
    expect(arweaveSpy).toHaveBeenCalledWith(rawTxId, expect.any(Object));
    expect(arweaveOpts).toEqual(
      expect.objectContaining({
        bypassFailureCache: true,
        directToArIo: false,
        debugContext: expect.objectContaining({
          category: 'sbt_metadata',
        }),
        gateways: expect.arrayContaining(['https://ar-io.dev', 'https://arweave.net']),
      }),
    );
    expect(arweaveOpts).not.toHaveProperty('disableExistencePrecheck');
    expect(arweaveOpts).not.toHaveProperty('preflightTxExistence');
  });

  it('keeps Arweave-backed SBT images visible without blocking on image preflight', async () => {
    globalThis.CE_ARWEAVE_PREFLIGHT_SBT_METADATA = false;
    const rawTxId = 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';
    const imageTxId = 'CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC';
    const stub = baseContractStub(rawTxId);
    stub.name.mockResolvedValue('Gateway First Image SBT');
    contractSpy = jest.spyOn(ethers, 'Contract').mockImplementation(() => stub);
    fetchSpy = jest.spyOn(global, 'fetch');
    checkTxExistsSpy = jest.spyOn(arweaveScripts, 'checkTxExists');
    arweaveSpy = jest.spyOn(arweaveScripts, 'downloadDataFromArweave').mockResolvedValue(
      JSON.stringify({
        name: 'Gateway First Image SBT',
        image: `ar://${imageTxId}`,
      }),
    );

    const meta = await contractScripts.getSbtMetadata('none', sbtAddress, {
      slug: 'edge',
      networkChainId: 84532,
      contracts: {},
    });

    expect(meta).toEqual(
      expect.objectContaining({
        name: 'Gateway First Image SBT',
        contractName: 'Gateway First Image SBT',
        image: `https://arweave.net/${imageTxId}`,
      }),
    );
    expect(checkTxExistsSpy).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
