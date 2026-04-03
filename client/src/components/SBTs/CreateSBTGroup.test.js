import { act, render, screen, within } from '@testing-library/react';
import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import CreateSBTGroup from './CreateSBTGroup';
import styles from './CreateSBTGroup.module.scss';
import contractScripts from '../../utilities/web3/contractScripts.js';
import { getDemoSessionConfigBySlug } from '../../utilities/web3/contractScripts.js';
import { arweaveScripts } from '../../utilities/arweave/arweaveScripts.js';
import * as cacheScripts from '../../utilities/cache/cacheScripts.js';
import * as resourceKeys from '../../utilities/session/resourceKeys.js';
import { cryptoUtils } from '../../utilities/crypto/cryptography.js';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { getSessionContractsForChain } from '../../variables/chains.js';
import { getScopedCreateSbtFormCacheKey } from '../../utilities/sbt/createSbtFormCache.js';
import { buildSbtDetailPath } from '../../utilities/sbt/sbtDetailPath.js';
import { t } from '../../utilities/ui/terminology.js';

const REGISTRY_CACHE_KEY = 'dg:sessionRegistryCache:v1';
const SBT_FACTORY_RECEIPT_TEST_IFACE = new ethers.utils.Interface([
  'event SBTCreated(address indexed sbtAddress)',
  'event SBTCreatedDeterministic(address indexed sbtAddress, bytes32 indexed salt)',
]);

const makeFactoryReceiptLog = (eventName, args) => {
  const encoded = SBT_FACTORY_RECEIPT_TEST_IFACE.encodeEventLog(
    SBT_FACTORY_RECEIPT_TEST_IFACE.getEvent(eventName),
    args
  );
  return {
    address: '0x00000000000000000000000000000000000000fa',
    topics: encoded.topics,
    data: encoded.data,
  };
};

const makeInstance = (props = {}) => {
  const instance = new CreateSBTGroup(props);
  instance.setState = (update, cb) => {
    const next = typeof update === 'function' ? update(instance.state) : update;
    instance.state = { ...instance.state, ...next };
    if (cb) cb();
  };
  return instance;
};

describe('CreateSBTGroup cache helpers', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete window.ethereum;
    delete window.__litHooks;
    delete window.litHooks;
  });

  it('buildCachePayload normalizes dates and network metadata', () => {
    const instance = makeInstance({ network: { id: 5, name: 'Goerli' } });
    instance.state.sbtName = 'Alpha';
    instance.state.sbtDescription = 'Desc';
    instance.state.sbtImageUrl = 'https://img.test/logo.png';
    instance.state.useImageUrl = true;
    instance.state.tags = ['tag1', 'tag2'];
    instance.state.documentURLs = ['https://doc.test'];
    instance.state.metadataLockGateIds = {
      ...instance.state.metadataLockGateIds,
      description: ['gate-description'],
    };
    instance.state.sbtDistribution = {
      ...instance.state.sbtDistribution,
      mintingEndTime: new Date('2024-01-01T00:00:00.000Z'),
      isLimited: true,
    };

    const payload = instance.buildCachePayload();

    expect(payload.sbtName).toBe('Alpha');
    expect(payload.tags).toEqual(['tag1', 'tag2']);
    expect(payload.documentURLs).toEqual(['https://doc.test']);
    expect(payload.metadataLockGateIds).toEqual(expect.objectContaining({
      description: ['gate-description'],
    }));
    expect(payload.sbtDistribution.mintingEndTime).toBe('2024-01-01T00:00:00.000Z');
    expect(payload.sbtDistribution.network).toBe(instance.getSelectedAuthoringChainId());
  });

  it('persistFormCache writes once for unchanged data', () => {
    const instance = makeInstance({ network: { id: 1 } });
    const spy = jest.spyOn(Storage.prototype, 'setItem');

    instance.persistFormCache();
    instance.persistFormCache();

    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('persistFormCache writes to the scoped cache key and clears legacy cache', () => {
    const instance = makeInstance({
      network: { id: 84532, name: 'Base Sepolia' },
      sessionSlug: 'test',
    });
    sessionStorage.setItem('createSbtFormCache', JSON.stringify({ sbtName: 'Legacy Draft' }));

    instance.state.sbtName = 'Scoped Draft';
    instance.persistFormCache();

    expect(sessionStorage.getItem('createSbtFormCache')).toBeNull();
    expect(sessionStorage.getItem(getScopedCreateSbtFormCacheKey('test'))).toContain('"Scoped Draft"');
  });

  it('loadFormCache restores tags and dates, then updates hash', () => {
    const instance = makeInstance({ network: { id: 84532, name: 'Base Sepolia' }, sessionSlug: 'test' });
    instance.updateGroupHash = jest.fn();

    sessionStorage.setItem(
      getScopedCreateSbtFormCacheKey('test'),
      JSON.stringify({
        sbtName: 'Cached',
        sbtDescription: 'Cached desc',
        tags: 'alpha, beta',
        documentURLs: ['https://doc.test'],
        metadataLockGateIds: {
          name: ['test-sbt'],
          description: ['test-sbt'],
          tags: [],
          documentURLs: [],
          image: [],
        },
        _sessionSlug: 'test',
        sbtDistribution: {
          mintingEndTime: '2024-02-02T00:00:00.000Z',
          hasAdmin: true,
        },
      })
    );

    const loaded = instance.loadFormCache();

    expect(loaded).toBe(true);
    expect(instance.state.tags).toEqual(['alpha', 'beta']);
    expect(instance.state.metadataLockGateIds).toEqual(expect.objectContaining({
      name: ['test-sbt'],
      description: ['test-sbt'],
    }));
    expect(instance.state.sbtDistribution.mintingEndTime).toBeInstanceOf(Date);
    expect(instance.state.tokenInfoCollapsed).toBe(false);
    expect(instance.updateGroupHash).toHaveBeenCalled();
  });

  it('keeps only the first section open for name-only cached drafts', () => {
    const instance = makeInstance({ network: { id: 84532, name: 'Base Sepolia' }, sessionSlug: 'test' });
    instance.updateGroupHash = jest.fn();

    sessionStorage.setItem(
      getScopedCreateSbtFormCacheKey('test'),
      JSON.stringify({
        sbtName: 'Cached',
        _sessionSlug: 'test',
        sbtDistribution: {
          distributionOption: 'anyoneCanMint',
          burnAuth: 'AdminOnly',
          network: 84532,
        },
      })
    );

    const loaded = instance.loadFormCache();

    expect(loaded).toBe(true);
    expect(instance.state.tokenInfoCollapsed).toBe(false);
    expect(instance.state.mintOptionsCollapsed).toBe(true);
    expect(instance.state.distributionOptionsCollapsed).toBe(true);
    expect(instance.updateGroupHash).toHaveBeenCalled();
  });

  it('persists deferred draft salts in the cache for deferred deploy mode', () => {
    const instance = makeInstance({
      deferredDeploy: true,
      network: { id: 84532, name: 'Base Sepolia' },
      sessionSlug: 'test',
    });
    instance.state.deferredCreate2Salt = 'draft/private-seed';

    const payload = instance.buildCachePayload();

    expect(payload.deferredCreate2Salt).toBe('draft/private-seed');
  });

  it('buildMetadataPreview matches the upload shape for default image and gated fields', () => {
    const instance = makeInstance({
      account: '0xCreator',
      network: { id: 84532, name: 'Base Sepolia' },
      sessionSlug: 'test',
    });

    instance.state.sbtName = 'Alpha';
    instance.state.sbtDescription = 'Private details';
    instance.state.sbtDistribution = {
      ...instance.state.sbtDistribution,
      burnAuth: 'AdminOnly',
      network: { name: 'Base Sepolia' },
      unlisted: true,
      isLimited: true,
      limitedNumber: 12,
      distributionOption: 'groupPassword',
    };
    instance.state.tags = ['alpha', '', 'beta'];
    instance.state.documentIDHashes = 'hash-a, hash-b';
    instance.state.documentURLs = ['https://doc.test/a'];
    instance.state.documentUrl = 'https://doc.test/b';
    instance.state.groupPassword = ' shared-secret ';
    instance.state.useImageUrl = false;
    instance.state.sbtImageFile = new File(['image'], 'badge.png', { type: 'image/png' });
    instance.state.metadataLockGateIds = {
      name: ['test-sbt'],
      description: ['test-sbt'],
      tags: ['test-sbt'],
      documentURLs: ['test-sbt'],
      image: ['test-sbt'],
    };
    instance.getSessionConfigForNetwork = jest.fn(() => ({
      sessionName: 'Test Session',
      networkChainId: 84532,
      sponsored: {
        defaultGateId: 'test-sbt',
        gates: {
          'test-sbt': {
            label: 'Test Gate',
            sbtAddresses: ['0x1111111111111111111111111111111111111111'],
            chainId: 84532,
            litChain: 'baseSepolia',
          },
        },
      },
      lit: {
        defaultGateId: 'test-sbt',
      },
      __registry: {
        gateAuthority: 'onchain',
        gatesByResource: {
          default: {
            gateId: 'test-sbt',
            sbtAddresses: ['0x1111111111111111111111111111111111111111'],
            lookupStatus: 'ok',
            chainId: 84532,
          },
        },
      },
    }));

    const preview = instance.buildMetadataPreview();

    expect(preview).toEqual(expect.objectContaining({
      v: 2,
      name: '',
      description: '',
      image: '',
      burnAuth: 'AdminOnly',
      network: 'Base Sepolia',
      unlisted: true,
      tags: [],
      maxTokens: 12,
      hasPasswordMint: true,
      chainID: 84532,
      creator: '0xCreator',
      documentIDHashes: ['hash-a', 'hash-b'],
      documentURLs: [],
      sessionSlug: 'test',
      encryptedFields: {
        name: '[encrypted]',
        description: '[encrypted]',
        tags: '[encrypted]',
        documentURLs: '[encrypted]',
        image: {
          storage: 'lit-arweave',
          txId: '[encrypted]',
        },
      },
      encryptedFieldGates: {
        name: 'test-sbt',
        description: 'test-sbt',
        tags: 'test-sbt',
        documentURLs: 'test-sbt',
        image: 'test-sbt',
      },
      encryption: expect.objectContaining({
        enabled: true,
        status: 'lit-v1',
        defaultGateId: 'test-sbt',
        gateIds: ['test-sbt'],
        targets: {
          name: true,
          description: true,
          tags: true,
          documentURLs: true,
          image: true,
        },
      }),
    }));
    expect(preview.adminRecovery).toBeUndefined();
    expect(preview.encryptedFields.image).not.toHaveProperty('url');
    expect(preview.encryptedFields.image).not.toHaveProperty('mime');
    expect(preview.encryptedFields.image).not.toHaveProperty('name');
  });

  it('stores only the Lit-Arweave txId in public locked-image metadata', () => {
    const instance = makeInstance();

    const asset = instance.buildEncryptedImageAsset({
      uploadResult: {
        txId: 'hi0eoC7jCAz4A0LFsBW_SYo02OWdXTfg3iIfMO9_2kw',
        url: 'lit://arweave/hi0eoC7jCAz4A0LFsBW_SYo02OWdXTfg3iIfMO9_2kw',
        mime: 'image/jpeg',
        name: 'face6.jpeg',
      },
      file: new File(['image'], 'face6.jpeg', { type: 'image/jpeg' }),
    });

    expect(asset).toEqual({
      storage: 'lit-arweave',
      txId: 'hi0eoC7jCAz4A0LFsBW_SYo02OWdXTfg3iIfMO9_2kw',
    });
  });

  it('uses terminology-aware access rule errors when Lit recipients are missing', async () => {
    const instance = makeInstance();
    window.__litHooks = { saveKey: jest.fn() };

    expect(() => instance.requireRecipientsForGateSelection({
      gateIds: ['gate-1'],
      recipients: [],
      scopeLabel: 'content',
    })).toThrow('Selected lock access rule (gate-1) for content do not resolve to valid Lit recipients.');

    await expect(instance.encryptValueWithRecipients({
      value: 'secret',
      maskedValue: '[encrypted]',
      recipients: [],
    })).rejects.toThrow('Selected access rule does not provide any Lit recipients.');
  });

  it('uses terminology-aware access rule errors when metadata locks reference missing gates', async () => {
    const instance = makeInstance({
      account: '0xCreator',
      network: { id: 84532, name: 'Base Sepolia' },
      provider: 'mock-provider',
      sessionSlug: 'test',
    });
    instance.getSelectedAuthoringChainId = jest.fn(() => 84532);
    instance.resolveLockGateOptions = jest.fn(() => ({
      gateMap: {
        validGate: {
          id: 'validGate',
          gateId: 'validGate',
        },
      },
      defaultGateId: 'validGate',
    }));
    instance.state = {
      ...instance.state,
      metadataLockGateIds: {
        ...instance.state.metadataLockGateIds,
        name: ['missing-gate'],
      },
    };

    await expect(instance.uploadTokenUriToArweave()).rejects.toThrow(
      'name encryption access rules could not be resolved. Please reselect the lock or configure valid access rules.'
    );
  });

  it('omits public admin recovery metadata when uploading group-password SBT metadata', async () => {
    const instance = makeInstance({
      account: '0xCreator',
      network: { id: 84532, name: 'Base Sepolia' },
      provider: 'mock-provider',
      sessionSlug: 'test',
    });
    instance.getSessionConfigForNetwork = jest.fn(() => ({ slug: 'test', networkChainId: 84532 }));
    instance.state = {
      ...instance.state,
      sbtName: 'Alpha',
      sbtDescription: 'Private details',
      groupPassword: 'shared-secret',
      sbtDistribution: {
        ...instance.state.sbtDistribution,
        burnAuth: 'AdminOnly',
        network: { name: 'Base Sepolia' },
        distributionOption: 'groupPassword',
      },
    };

    jest.spyOn(resourceKeys, 'getEffectiveArweaveKey').mockResolvedValue({ arweaveJwk: 'test-jwk' });
    const uploadSpy = jest.spyOn(arweaveScripts, 'uploadDataToArweave').mockImplementation(async (data) => {
      const parsed = JSON.parse(data);
      expect(parsed.adminRecovery).toBeUndefined();
      return 'test-token-uri';
    });

    await instance.uploadTokenUriToArweave();

    expect(uploadSpy).toHaveBeenCalled();
    expect(instance.state.tokenURI).toBe('test-token-uri');
    expect(instance.state.tokenUriUploaded).toBe(true);
    expect(instance.state.currentStep).toBe(3);
  });

  it('passes the session wizard Arweave JWK override through deferred uploads for fallback handling', async () => {
    const signAdminAction = jest.fn(async () => ({
      address: '0xCreator',
      message: 'signed-message',
      signature: '0xsigned',
      sessionSlug: 'local-test',
    }));
    const instance = makeInstance({
      account: '0xCreator',
      network: { id: 31337, name: 'Anvil' },
      provider: 'mock-provider',
      sessionSlug: '',
      deferredDeploy: true,
      arweaveJwkOverride: '{"kty":"RSA"}',
      signAdminAction,
    });
    instance.getSessionConfigForNetwork = jest.fn(() => ({ slug: 'local-test', networkChainId: 31337 }));
    instance.state = {
      ...instance.state,
      sbtName: 'Local Draft',
      sbtDescription: 'Uploads with override',
      sbtDistribution: {
        ...instance.state.sbtDistribution,
        burnAuth: 'AdminOnly',
        network: { name: 'Anvil' },
      },
    };

    const resourceSpy = jest.spyOn(resourceKeys, 'getEffectiveArweaveKey');
    const uploadSpy = jest.spyOn(arweaveScripts, 'uploadDataToArweave').mockImplementation(async (_data, _format, opts = {}) => {
      expect(opts.arweaveJwk).toBe('{"kty":"RSA"}');
      expect(opts.sessionSlug).toBe('local-test');
      expect(opts.skipAuth).toBe(true);
      expect(opts.forceDirectArweaveUpload).toBeUndefined();
      expect(opts.adminAuth).toBeUndefined();
      return 'test-token-uri';
    });

    await instance.uploadTokenUriToArweave();

    expect(resourceSpy).not.toHaveBeenCalled();
    expect(signAdminAction).not.toHaveBeenCalled();
    expect(uploadSpy).toHaveBeenCalled();
    expect(instance.state.tokenURI).toBe('test-token-uri');
    uploadSpy.mockRestore();
    resourceSpy.mockRestore();
  });

  it('requires a session slug before deferred draft metadata uploads', async () => {
    const instance = makeInstance({
      account: '0xCreator',
      network: { id: 84532, name: 'Base Sepolia' },
      provider: 'mock-provider',
      sessionSlug: '',
      deferredDeploy: true,
    });
    instance.getSessionConfigForNetwork = jest.fn(() => ({ networkChainId: 84532 }));
    instance.state = {
      ...instance.state,
      sbtName: 'Deferred Group',
      sbtDescription: 'Needs a session slug',
      sbtDistribution: {
        ...instance.state.sbtDistribution,
        burnAuth: 'AdminOnly',
        network: { name: 'Base Sepolia' },
      },
    };

    const uploadSpy = jest.spyOn(arweaveScripts, 'uploadDataToArweave');

    await expect(instance.uploadTokenUriToArweave()).rejects.toThrow(
      'Set the session URL before adding this Group to the session.'
    );

    expect(uploadSpy).not.toHaveBeenCalled();
    expect(instance.state.mintingFailed).toBe(true);
    expect(instance.state.error).toBe('Set the session URL before adding this Group to the session.');
  });

  it('saves a pending-upload draft when no worker or immediate Arweave upload path is available', async () => {
    const onSaveDraft = jest.fn(async () => {});
    const instance = makeInstance({
      account: '0xCreator',
      network: { id: 84532, name: 'Base Sepolia' },
      provider: 'mock-provider',
      sessionSlug: 'publish-later',
      deferredDeploy: true,
      onSaveDraft,
    });
    instance.getSessionConfigForNetwork = jest.fn(() => ({ slug: 'publish-later', networkChainId: 84532 }));
    instance.resolvePredictableDeployPlan = jest.fn(async ({ tokenURI }) => ({
      predictedAddress: '0x1111111111111111111111111111111111111111',
      displayName: 'Deferred Group',
      contractName: 'Deferred Group',
      symbol: 'CE-SBT-DEFER',
      create2Salt: 'draft/test',
      limitedNumber: 0,
      adminAddress: '0xCreator',
      mintingEndTimeUnix: 0,
      hasPasswordMintOnChain: false,
      burnAuthEnum: 0,
      hashedPasswords: [],
      tokenURI,
      finalGroupPasswordHash: ethers.constants.HashZero,
      createOptions: { useConfiguredDeterministic: true, initializeGroupPasswordHash: false },
      distributionOption: 'anyoneCanMint',
      passwordList: [],
      groupPassword: '',
      usesInviteCodes: false,
    }));
    instance.state = {
      ...instance.state,
      sbtName: 'Deferred Group',
      sbtDescription: 'Upload later',
      sbtImageFile: new File(['image-bytes'], 'badge.png', { type: 'image/png' }),
      tags: ['alpha'],
      sbtDistribution: {
        ...instance.state.sbtDistribution,
        burnAuth: 'AdminOnly',
        network: { name: 'Base Sepolia' },
      },
    };

    const uploadSpy = jest.spyOn(arweaveScripts, 'uploadDataToArweave');
    const getKeySpy = jest.spyOn(resourceKeys, 'getEffectiveArweaveKey').mockResolvedValue({});

    const result = await instance.handleDeferredSave();

    expect(uploadSpy).not.toHaveBeenCalled();
    expect(onSaveDraft).toHaveBeenCalledWith(expect.objectContaining({
      tokenURI: '',
      metadataUploadStatus: 'pending-upload',
      authoringPayload: expect.objectContaining({
        sbtName: 'Deferred Group',
        tags: ['alpha'],
        _sessionSlug: 'publish-later',
      }),
    }));
    expect(result).toEqual(expect.objectContaining({
      tokenURI: '',
      metadataUploadStatus: 'pending-upload',
      authoringPayload: expect.objectContaining({
        sbtName: 'Deferred Group',
        _sessionSlug: 'publish-later',
      }),
    }));
    expect(result.authoringPayload._imageDataUrl).toMatch(/^data:image\/png;base64,/);
    getKeySpy.mockRestore();
  });

  it('keeps wizard deferred drafts pending until publish when immediate draft upload is disabled', async () => {
    const onSaveDraft = jest.fn(async () => {});
    const instance = makeInstance({
      account: '0x1111111111111111111111111111111111111111',
      network: { id: 84532, name: 'Base Sepolia' },
      provider: 'mock-provider',
      sessionSlug: 'publish-later',
      deferredDeploy: true,
      attemptImmediateDeferredUpload: false,
      arweaveJwkOverride: '{"kty":"RSA"}',
      onSaveDraft,
    });
    instance.getSessionConfigForNetwork = jest.fn(() => ({
      slug: 'publish-later',
      networkChainId: 84532,
      corsWorkerUrl: 'https://draft-upload.example.test',
    }));
    instance.resolvePredictableDeployPlan = jest.fn(async ({ tokenURI }) => ({
      predictedAddress: '0x1111111111111111111111111111111111111111',
      displayName: 'Deferred Group',
      contractName: 'Deferred Group',
      symbol: 'CE-SBT-DEFER',
      create2Salt: 'draft/test',
      limitedNumber: 0,
      adminAddress: '0x1111111111111111111111111111111111111111',
      mintingEndTimeUnix: 0,
      hasPasswordMintOnChain: false,
      burnAuthEnum: 0,
      hashedPasswords: [],
      tokenURI,
      finalGroupPasswordHash: ethers.constants.HashZero,
      createOptions: { useConfiguredDeterministic: true, initializeGroupPasswordHash: false },
      distributionOption: 'anyoneCanMint',
      passwordList: [],
      groupPassword: '',
      usesInviteCodes: false,
    }));
    instance.state = {
      ...instance.state,
      sbtName: 'Deferred Group',
      sbtDescription: 'Upload at publish',
      sbtDistribution: {
        ...instance.state.sbtDistribution,
        burnAuth: 'AdminOnly',
        network: { name: 'Base Sepolia' },
      },
    };

    const uploadSpy = jest.spyOn(arweaveScripts, 'uploadDataToArweave');

    const result = await instance.handleDeferredSave();

    expect(uploadSpy).not.toHaveBeenCalled();
    expect(onSaveDraft).toHaveBeenCalledWith(expect.objectContaining({
      tokenURI: '',
      metadataUploadStatus: 'pending-upload',
    }));
    expect(result).toEqual(expect.objectContaining({
      tokenURI: '',
      metadataUploadStatus: 'pending-upload',
    }));
  });

  it('falls back to a pending-upload draft when deferred metadata upload fails with worker auth address errors', async () => {
    const onSaveDraft = jest.fn(async () => {});
    const instance = makeInstance({
      account: '0x1111111111111111111111111111111111111111',
      network: { id: 84532, name: 'Base Sepolia' },
      provider: 'mock-provider',
      sessionSlug: 'publish-later',
      deferredDeploy: true,
      onSaveDraft,
    });
    instance.getSessionConfigForNetwork = jest.fn(() => ({
      slug: 'publish-later',
      networkChainId: 84532,
      corsWorkerUrl: 'https://draft-upload.example.test',
    }));
    instance.resolvePredictableDeployPlan = jest.fn(async ({ tokenURI }) => ({
      predictedAddress: '0x1111111111111111111111111111111111111111',
      displayName: 'Deferred Group',
      contractName: 'Deferred Group',
      symbol: 'CE-SBT-DEFER',
      create2Salt: 'draft/test',
      limitedNumber: 0,
      adminAddress: '0x1111111111111111111111111111111111111111',
      mintingEndTimeUnix: 0,
      hasPasswordMintOnChain: false,
      burnAuthEnum: 0,
      hashedPasswords: [],
      tokenURI,
      finalGroupPasswordHash: ethers.constants.HashZero,
      createOptions: { useConfiguredDeterministic: true, initializeGroupPasswordHash: false },
      distributionOption: 'anyoneCanMint',
      passwordList: [],
      groupPassword: '',
      usesInviteCodes: false,
    }));
    instance.state = {
      ...instance.state,
      sbtName: 'Deferred Group',
      sbtDescription: 'Upload later',
      sbtDistribution: {
        ...instance.state.sbtDistribution,
        burnAuth: 'AdminOnly',
        network: { name: 'Base Sepolia' },
      },
    };

    jest.spyOn(resourceKeys, 'getEffectiveArweaveKey').mockResolvedValue({});
    jest.spyOn(instance, 'uploadImageToArweave').mockResolvedValue({
      imageUploaded: true,
      sbtImageUrl: '',
      lockedImageAsset: null,
    });
    jest.spyOn(instance, 'uploadTokenUriToArweave').mockRejectedValue(new Error('Invalid address.'));

    const result = await instance.handleDeferredSave();

    expect(onSaveDraft).toHaveBeenCalledWith(expect.objectContaining({
      tokenURI: '',
      metadataUploadStatus: 'pending-upload',
    }));
    expect(result).toEqual(expect.objectContaining({
      tokenURI: '',
      metadataUploadStatus: 'pending-upload',
    }));
    expect(instance.state.error).toBe('');
    expect(instance.state.mintingFailed).toBe(false);
  });

  it('prefers worker-backed deferred uploads for JWK-backed drafts when a worker URL is available', async () => {
    const signAdminAction = jest.fn(async () => ({
      address: '0xCreator',
      message: 'signed-message',
      signature: '0xsigned',
      sessionSlug: 'local-test',
    }));
    const instance = makeInstance({
      account: '0xCreator',
      network: { id: 31337, name: 'Anvil' },
      provider: 'mock-provider',
      sessionSlug: '',
      deferredDeploy: true,
      arweaveJwkOverride: '{"kty":"RSA"}',
      signAdminAction,
    });
    instance.getSessionConfigForNetwork = jest.fn(() => ({
      slug: 'local-test',
      networkChainId: 31337,
      corsWorkerUrl: 'https://draft-upload.example.test',
    }));
    await expect(instance.buildArweaveUploadRequestOptions()).resolves.toEqual({
      sessionSlug: 'local-test',
      sessionConfig: {
        slug: 'local-test',
        networkChainId: 31337,
        corsWorkerUrl: 'https://draft-upload.example.test',
      },
      context: {
        account: '0xCreator',
        providerLike: 'mock-provider',
        chainId: 31337,
      },
      skipAuth: true,
      adminAuth: {
        address: '0xCreator',
        message: 'signed-message',
        signature: '0xsigned',
        sessionSlug: 'local-test',
      },
    });
    expect(signAdminAction).toHaveBeenCalledWith({
      statement: 'Admin request: bootstrap arweave upload',
      targetSlug: 'local-test',
      workerUrl: 'https://draft-upload.example.test',
    });
  });

  it('still allows deferred drafts to explicitly force direct Arweave upload', async () => {
    const signAdminAction = jest.fn();
    const instance = makeInstance({
      account: '0xCreator',
      network: { id: 31337, name: 'Anvil' },
      provider: 'mock-provider',
      sessionSlug: '',
      deferredDeploy: true,
      arweaveJwkOverride: '{"kty":"RSA"}',
      preferDirectArweaveUpload: true,
      signAdminAction,
    });
    instance.getSessionConfigForNetwork = jest.fn(() => ({
      slug: 'local-test',
      networkChainId: 31337,
      corsWorkerUrl: 'https://draft-upload.example.test',
    }));

    await expect(instance.buildArweaveUploadRequestOptions()).resolves.toEqual({
      sessionSlug: 'local-test',
      sessionConfig: {
        slug: 'local-test',
        networkChainId: 31337,
        corsWorkerUrl: 'https://draft-upload.example.test',
      },
      context: {
        account: '0xCreator',
        providerLike: 'mock-provider',
        chainId: 31337,
      },
      skipAuth: true,
      forceDirectArweaveUpload: true,
    });
    expect(signAdminAction).not.toHaveBeenCalled();
  });

  it('fails closed when stale cached lock gate ids cannot be resolved', async () => {
    const instance = makeInstance({
      account: '0xCreator',
      network: { id: 84532, name: 'Base Sepolia' },
      provider: 'mock-provider',
      sessionSlug: 'test',
    });

    instance.resolveLockGateOptions = jest.fn(() => ({ gateMap: {} }));
    instance.state = {
      ...instance.state,
      sbtName: 'Alpha',
      sbtDescription: 'Private details',
      sbtImageUrl: 'https://img.test/logo.png',
      tags: ['alpha'],
      documentURLs: ['https://doc.test/a'],
      metadataLockGateIds: {
        name: ['stale-name-gate'],
        description: ['stale-description-gate'],
        tags: ['stale-tags-gate'],
        documentURLs: ['stale-docs-gate'],
        image: [],
      },
      sbtDistribution: {
        ...instance.state.sbtDistribution,
        burnAuth: 'AdminOnly',
        network: { name: 'Base Sepolia' },
      },
    };

    jest.spyOn(resourceKeys, 'getEffectiveArweaveKey').mockResolvedValue({ arweaveJwk: 'test-jwk' });

    await expect(instance.uploadTokenUriToArweave()).rejects.toThrow(/could not be resolved/i);

    expect(instance.state.mintingFailed).toBe(true);
    expect(instance.state.error).toMatch(/could not be resolved/i);
  });

  it('renders GateMultiSelectLock beside the description field', () => {
    const instance = makeInstance({
      network: { id: 84532, name: 'Base Sepolia' },
      sessionSlug: 'test',
    });
    instance.state.tokenInfoCollapsed = false;

    render(instance.render());

    const descriptionRow = screen.getByTestId(E2E_TESTIDS.SBT_CREATE_DESCRIPTION_LOCK_ROW);
    expect(within(descriptionRow).getByTestId(E2E_TESTIDS.GATE_LOCK)).toBeInTheDocument();
    expect(screen.getByTestId(E2E_TESTIDS.SBT_CREATE_NAME_LOCK_ROW)).toBeInTheDocument();
    expect(screen.getByTestId(E2E_TESTIDS.SBT_CREATE_IMAGE_LOCK_ROW)).toBeInTheDocument();
    expect(screen.getAllByTestId(E2E_TESTIDS.GATE_LOCK)).toHaveLength(5);
  });

  it('auto-enables predictable deployment with an auto salt when standalone group password is selected', () => {
    const instance = makeInstance({
      network: { id: 84532, name: 'Base Sepolia' },
      sessionSlug: 'test',
    });
    instance.persistFormCache = jest.fn();

    const prevState = {
      ...instance.state,
      sbtDistribution: { ...instance.state.sbtDistribution },
    };

    instance.state = {
      ...instance.state,
      sbtName: 'Alpha Group',
      sbtDistribution: {
        ...instance.state.sbtDistribution,
        distributionOption: 'groupPassword',
      },
      predictableAddressEnabled: false,
      create2Salt: '',
    };

    instance.componentDidUpdate(instance.props, prevState);

    expect(instance.state.predictableAddressEnabled).toBe(true);
    expect(instance.state.create2Salt).toBe(instance.buildAutoCreate2SaltSource());
    expect(instance.persistFormCache).toHaveBeenCalledTimes(1);
  });

  it('clears the auto-generated predictable deployment salt when leaving group password distribution', () => {
    const instance = makeInstance({
      network: { id: 84532, name: 'Base Sepolia' },
      sessionSlug: 'test',
    });
    instance.persistFormCache = jest.fn();

    const initialState = {
      ...instance.state,
      sbtDistribution: { ...instance.state.sbtDistribution },
    };

    instance.state = {
      ...instance.state,
      sbtName: 'Alpha Group',
      sbtDistribution: {
        ...instance.state.sbtDistribution,
        distributionOption: 'groupPassword',
      },
      predictableAddressEnabled: false,
      create2Salt: '',
    };

    instance.componentDidUpdate(instance.props, initialState);

    expect(instance.state.predictableAddressEnabled).toBe(true);
    expect(instance.state.create2Salt).toBe(instance.buildAutoCreate2SaltSource());

    const prevGroupPasswordState = {
      ...instance.state,
      sbtDistribution: { ...instance.state.sbtDistribution },
    };

    instance.state = {
      ...instance.state,
      sbtDistribution: {
        ...instance.state.sbtDistribution,
        distributionOption: 'anyoneCanMint',
      },
    };

    instance.componentDidUpdate(instance.props, prevGroupPasswordState);

    expect(instance.state.predictableAddressEnabled).toBe(false);
    expect(instance.state.create2Salt).toBe('');
    expect(instance.persistFormCache).toHaveBeenCalledTimes(2);
  });

  it('preserves manual predictable deployment salts when leaving group password distribution', () => {
    const instance = makeInstance({
      network: { id: 84532, name: 'Base Sepolia' },
      sessionSlug: 'test',
    });
    instance.persistFormCache = jest.fn();

    const initialState = {
      ...instance.state,
      sbtDistribution: { ...instance.state.sbtDistribution },
    };

    instance.state = {
      ...instance.state,
      sbtDistribution: {
        ...instance.state.sbtDistribution,
        distributionOption: 'groupPassword',
      },
      predictableAddressEnabled: true,
      create2Salt: 'manual/test-salt',
    };

    instance.componentDidUpdate(instance.props, initialState);

    const prevGroupPasswordState = {
      ...instance.state,
      sbtDistribution: { ...instance.state.sbtDistribution },
    };

    instance.state = {
      ...instance.state,
      sbtDistribution: {
        ...instance.state.sbtDistribution,
        distributionOption: 'anyoneCanMint',
      },
    };

    instance.componentDidUpdate(instance.props, prevGroupPasswordState);

    expect(instance.state.predictableAddressEnabled).toBe(true);
    expect(instance.state.create2Salt).toBe('manual/test-salt');
    expect(instance.persistFormCache).toHaveBeenCalled();
  });

  it('disables the predictable-address toggle while group password distribution is selected', () => {
    const instance = makeInstance({
      network: { id: 84532, name: 'Base Sepolia' },
      sessionSlug: 'test',
    });
    instance.state = {
      ...instance.state,
      mintOptionsCollapsed: false,
      sbtDistribution: {
        ...instance.state.sbtDistribution,
        distributionOption: 'groupPassword',
      },
      predictableAddressEnabled: true,
      create2Salt: 'test/alpha-group',
    };

    render(instance.render());

    expect(screen.getByTestId(E2E_TESTIDS.SBT_CREATE_PREDICTABLE_TOGGLE)).toBeDisabled();
  });

  it('limits the network dropdown to session-registry authoring chains and defaults to the session chain', () => {
    const instance = makeInstance({
      network: { id: 1, name: 'Ethereum Mainnet' },
      sessionConfigOverride: {
        slug: 'test',
        networkChainId: 84532,
      },
    });
    instance.state = {
      ...instance.state,
      mintOptionsCollapsed: false,
    };

    render(instance.render());

    const networkRow = screen.getByText('Network').closest(`.${styles.settingRow}`);
    expect(networkRow).toBeInTheDocument();
    const networkSelect = within(networkRow).getByRole('combobox');
    const options = within(networkSelect).getAllByRole('option').map((option) => option.textContent);

    expect(networkSelect).toHaveValue('84532');
    expect(options).toContain('Base Sepolia (84532)');
    expect(options.some((option) => /\(1\)$/.test(option || ''))).toBe(false);
    expect(options).not.toContain('Base (8453)');
  });

  it('keeps the resolved session config on the authoring chain instead of the wallet chain', () => {
    const instance = makeInstance({
      network: { id: 1, name: 'Ethereum Mainnet' },
      sessionConfigOverride: {
        slug: 'test',
        networkChainId: 84532,
      },
    });

    const resolved = instance.getSessionConfigForNetwork();

    expect(resolved).toEqual(expect.objectContaining({
      slug: 'test',
      networkChainId: 84532,
      sbtFactoryAddress: '0x538A48BC439A36D2A86e63114DCD9c429d2ddEcA',
    }));
    expect(resolved.contracts.sbtFactory).toEqual(expect.objectContaining({
      address: '0x538A48BC439A36D2A86e63114DCD9c429d2ddEcA',
      chainId: 84532,
    }));
  });

  it('oss demo fallback sessions omit shipped SBT factory addresses', () => {
    const generalCfg = getDemoSessionConfigBySlug('', { allowDemoFallback: true });
    const testCfg = getDemoSessionConfigBySlug('test', { allowDemoFallback: true });

    expect(generalCfg?.contracts).toEqual({});
    expect(testCfg).toBeNull();
  });

  it('swaps authoring contracts to the selected registry chain instead of relabeling the session defaults', () => {
    const priorIncludeLocalRegistry = globalThis.CE_INCLUDE_LOCAL_SESSION_REGISTRY;
    globalThis.CE_INCLUDE_LOCAL_SESSION_REGISTRY = true;

    try {
      const localChainContracts = getSessionContractsForChain(31337);
      expect(localChainContracts.sbtFactory).toBeTruthy();

      const instance = makeInstance({
        network: { id: 84532, name: 'Base Sepolia' },
        sessionConfigOverride: {
          slug: 'test',
          networkChainId: 84532,
          contracts: {
            sbtFactory: {
              address: '0x0b065f0b9EeCE9d119aF8BD03AcfaE6c93A03c11',
              chainId: 84532,
            },
            surveys: {
              address: '0xcccb5c1a96b3e10f395e318ae75db24e45bd3808',
              chainId: 84532,
            },
          },
        },
      });
      instance.state = {
        ...instance.state,
        network: 31337,
      };

      const resolved = instance.getSessionConfigForNetwork();

      expect(resolved).toEqual(expect.objectContaining({
        slug: 'test',
        networkChainId: 31337,
        sbtFactoryAddress: localChainContracts.sbtFactory,
      }));
      expect(resolved.contracts.sbtFactory).toEqual(expect.objectContaining({
        address: localChainContracts.sbtFactory,
        chainId: 31337,
      }));
      expect(resolved.contracts.surveys).toEqual(expect.objectContaining({
        address: localChainContracts.surveys,
        chainId: 31337,
      }));
    } finally {
      if (typeof priorIncludeLocalRegistry === 'undefined') {
        delete globalThis.CE_INCLUDE_LOCAL_SESSION_REGISTRY;
      } else {
        globalThis.CE_INCLUDE_LOCAL_SESSION_REGISTRY = priorIncludeLocalRegistry;
      }
    }
  });

  it('keeps the current authoring chain when the wallet switch request is rejected', async () => {
    const instance = makeInstance({
      account: '0x00000000000000000000000000000000000000aa',
      network: { id: 84532, name: 'Base Sepolia' },
      sessionConfigOverride: {
        slug: 'test',
        networkChainId: 84532,
      },
    });
    instance.state = {
      ...instance.state,
      network: 84532,
      sbtDistribution: {
        ...instance.state.sbtDistribution,
        network: { id: 84532, name: 'Base Sepolia' },
      },
    };
    instance.getAuthoringChainOptions = jest.fn(() => ([
      { id: 84532, name: 'Base Sepolia' },
      { id: 31337, name: 'Anvil' },
    ]));

    const request = jest.fn().mockRejectedValue(Object.assign(new Error('User rejected network switch'), {
      code: 4001,
    }));
    window.ethereum = { request };

    await act(async () => {
      await instance.handleNetworkChange({ target: { value: '31337' } });
    });

    expect(request).toHaveBeenCalledWith({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0x7a69' }],
    });
    expect(instance.state.network).toBe(84532);
    expect(instance.state.sbtDistribution.network).toEqual(expect.objectContaining({
      id: 84532,
      name: 'Base Sepolia',
    }));
  });

  it('uses a solid background surface in deferred deploy modal mode', () => {
    const instance = makeInstance({
      deferredDeploy: true,
      network: { id: 84532, name: 'Base Sepolia' },
      sessionSlug: 'test',
    });
    instance.state.tokenInfoCollapsed = false;

    render(instance.render());

    const panel = document.getElementById(styles.createGroupExpanded);
    expect(panel).toBeInTheDocument();
    expect(panel).toHaveStyle('--ce-create-group-surface-bg: #11182c');
    expect(screen.getByRole('heading', { name: 'Add to Session' })).toBeInTheDocument();
  });

  it('auto-expands all sections in deferred deploy modal mode', () => {
    const instance = makeInstance({
      deferredDeploy: true,
      network: { id: 84532, name: 'Base Sepolia' },
      sessionSlug: 'test',
    });

    render(instance.render());

    const tokenInfoHeader = document.querySelector(
      `[data-testid="${E2E_TESTIDS.SBT_CREATE_SECTION_HEADER}"][data-ce-section-key="tokenInfoCollapsed"]`
    );
    const mintOptionsHeader = document.querySelector(
      `[data-testid="${E2E_TESTIDS.SBT_CREATE_SECTION_HEADER}"][data-ce-section-key="mintOptionsCollapsed"]`
    );
    const distributionHeader = document.querySelector(
      `[data-testid="${E2E_TESTIDS.SBT_CREATE_SECTION_HEADER}"][data-ce-section-key="distributionOptionsCollapsed"]`
    );

    expect(tokenInfoHeader).toHaveAttribute('aria-expanded', 'true');
    expect(mintOptionsHeader).toHaveAttribute('aria-expanded', 'true');
    expect(distributionHeader).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId(E2E_TESTIDS.SBT_CREATE_NAME_INPUT)).toBeInTheDocument();
    expect(screen.getByTestId(E2E_TESTIDS.SBT_CREATE_PREDICTABLE_TOGGLE)).toBeInTheDocument();
    expect(screen.getByText('One-use URLs')).toBeInTheDocument();
  });

  it('opens the first section by default and hides open section titles', () => {
    const instance = makeInstance({
      network: { id: 84532, name: 'Base Sepolia' },
      sessionSlug: 'test',
    });

    render(instance.render());

    const tokenInfoHeader = document.querySelector(
      `[data-testid="${E2E_TESTIDS.SBT_CREATE_SECTION_HEADER}"][data-ce-section-key="tokenInfoCollapsed"]`
    );
    const mintOptionsHeader = document.querySelector(
      `[data-testid="${E2E_TESTIDS.SBT_CREATE_SECTION_HEADER}"][data-ce-section-key="mintOptionsCollapsed"]`
    );

    expect(tokenInfoHeader).toHaveAttribute('aria-expanded', 'true');
    expect(within(tokenInfoHeader).queryByText('Info')).not.toBeInTheDocument();
    expect(screen.getByTestId(E2E_TESTIDS.SBT_CREATE_NAME_INPUT)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Name')).toBeInTheDocument();
    expect(screen.getByText('Image')).toBeInTheDocument();
    expect(mintOptionsHeader).toHaveAttribute('aria-expanded', 'false');
    expect(within(mintOptionsHeader).getByText('Collect Options')).toBeInTheDocument();
  });

  it('groups the compact token info controls into shared desktop rows', () => {
    const instance = makeInstance({
      network: { id: 84532, name: 'Base Sepolia' },
      sessionSlug: 'test',
    });
    instance.state.tokenInfoCollapsed = false;

    const { container } = render(instance.render());

    const topGrid = container.querySelector(`.${styles.tokenInfoTopGrid}`);
    const metaGrid = container.querySelector(`.${styles.tokenInfoMetaGrid}`);

    expect(topGrid).toBeInTheDocument();
    expect(metaGrid).toBeInTheDocument();
    expect(topGrid).toContainElement(screen.getByTestId(E2E_TESTIDS.SBT_CREATE_NAME_LOCK_ROW));
    expect(topGrid).toContainElement(screen.getByTestId(E2E_TESTIDS.SBT_CREATE_DESCRIPTION_LOCK_ROW));
    expect(topGrid).toContainElement(screen.getByTestId(E2E_TESTIDS.SBT_CREATE_IMAGE_LOCK_ROW));
    expect(metaGrid).toContainElement(screen.getByTestId(E2E_TESTIDS.SBT_CREATE_DOCS_LOCK_ROW));
    expect(metaGrid).toContainElement(screen.getByTestId(E2E_TESTIDS.SBT_CREATE_TAGS_LOCK_ROW));
  });

  it('removes redundant docs and tags headings while keeping a compact image chooser surface', () => {
    const instance = makeInstance({
      network: { id: 84532, name: 'Base Sepolia' },
      sessionSlug: 'test',
    });
    instance.state.tokenInfoCollapsed = false;

    render(instance.render());

    const imageRow = screen.getByTestId(E2E_TESTIDS.SBT_CREATE_IMAGE_LOCK_ROW);
    const docsRow = screen.getByTestId(E2E_TESTIDS.SBT_CREATE_DOCS_LOCK_ROW);
    const tagsRow = screen.getByTestId(E2E_TESTIDS.SBT_CREATE_TAGS_LOCK_ROW);

    expect(screen.queryByText(/^Document URLs$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Tags$/)).not.toBeInTheDocument();
    expect(within(imageRow).getByRole('button', { name: /^URL$/i })).toBeInTheDocument();
    expect(within(imageRow).getByRole('button', { name: /Upload image/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Document URL')).toBeInTheDocument();
    expect(screen.getByLabelText('Add tag')).toBeInTheDocument();
    expect(imageRow.querySelector(`.${styles.imageUploadBody}`)).toBeInTheDocument();
    expect(imageRow.querySelector(`.${styles.imagePreviewSurface}`)).not.toBeInTheDocument();
    expect(docsRow.querySelector(`.${styles.inlineFieldLockControl}`)).toBeInTheDocument();
    expect(tagsRow.querySelector(`.${styles.tagsInlineRow}`)).toBeInTheDocument();
  });

  it('keeps docs and tags rows visually flat without extra nested card backgrounds', () => {
    const scssPath = path.join(__dirname, 'CreateSBTGroup.module.scss');
    const scss = fs.readFileSync(scssPath, 'utf8');

    expect(scss).toMatch(/\.tokenInfoMetaCard\s*{[\s\S]*?padding:\s*0;[\s\S]*?background:\s*transparent;[\s\S]*?border:\s*none;/);
    expect(scss).toMatch(/\.tagsContainer\s*{[\s\S]*?padding:\s*0;[\s\S]*?background:\s*transparent;[\s\S]*?border:\s*none;/);
  });

  it('adds a narrow-panel stack for mobile create-sbt fields', () => {
    const scssPath = path.join(__dirname, 'CreateSBTGroup.module.scss');
    const scss = fs.readFileSync(scssPath, 'utf8');

    expect(scss).toMatch(/#createGroupExpanded\s*{[\s\S]*?container-type:\s*inline-size;[\s\S]*?container-name:\s*create-sbt-panel;/);
    expect(scss).toMatch(/@mixin\s+tokenInfoNarrowLayout\s*{[\s\S]*?\.tokenInfoTopGrid,[\s\S]*?grid-template-columns:\s*1fr;/);
    expect(scss).toMatch(/@mixin\s+tokenInfoNarrowLayout\s*{[\s\S]*?#addDocUrlSection\s*>\s*\.addDocUrlActionButton\s*{[\s\S]*?width:\s*100%;/);
    expect(scss).toMatch(/@container\s+create-sbt-panel\s*\(max-width:\s*820px\)\s*{\s*@include\s+tokenInfoNarrowLayout;/);
  });

  it('uses muted large section header titles and collapses open headers to chevrons only', () => {
    const scssPath = path.join(__dirname, 'CreateSBTGroup.module.scss');
    const scss = fs.readFileSync(scssPath, 'utf8');

    expect(scss).toMatch(/\.sectionHeaderButton\s*{[\s\S]*?font-family:\s*var\(--ce-font-body\);/);
    expect(scss).toMatch(/\.sectionHeaderButtonOpen\s*{[\s\S]*?justify-content:\s*flex-end;/);
    expect(scss).toMatch(/\.sectionHeaderTitleText\s*{[\s\S]*?font-size:\s*1\.62rem;[\s\S]*?color:\s*rgba\(255,\s*255,\s*255,\s*0\.5\);/);
  });

  it('keeps option guidance out of inline copy and in tooltips only', () => {
    const instance = makeInstance({
      network: { id: 84532, name: 'Base Sepolia' },
      sessionSlug: 'test',
    });
    instance.state = {
      ...instance.state,
      tokenInfoCollapsed: false,
      distributionOptionsCollapsed: false,
    };

    render(instance.render());

    expect(screen.queryByText('Choose who can remove this Group after collect.')).not.toBeInTheDocument();
    expect(screen.queryByText('Override the deployer if a different burn admin should manage revocation.')).not.toBeInTheDocument();
    expect(screen.queryByText('Pick the chain where the Group contract will be deployed.')).not.toBeInTheDocument();
    expect(screen.queryByText('This draft is pinned to the session chain.')).not.toBeInTheDocument();
    expect(screen.queryByText('Use deterministic deployment so the final Group address is known ahead of time.')).not.toBeInTheDocument();
    expect(screen.queryByText('Generate a unique claim link for each participant.')).not.toBeInTheDocument();
    expect(screen.queryByText('Hide this group from the public list while keeping direct access intact.')).not.toBeInTheDocument();
  });

  it('shows a pending group-name message before deterministic preview inputs are complete', () => {
    const instance = makeInstance({
      account: '0xCreator',
      network: { id: 84532, name: 'Base Sepolia' },
      sessionSlug: 'test',
    });
    instance.state = {
      ...instance.state,
      mintOptionsCollapsed: false,
      predictableAddressEnabled: true,
    };

    render(instance.render());

    expect(screen.getByTestId(E2E_TESTIDS.SBT_CREATE_PREDICTED_ADDRESS)).toHaveTextContent('Pending group name…');
    expect(screen.queryByText('Enter a group name to preview the address.')).not.toBeInTheDocument();
    expect(screen.queryByText(/Salt auto-generated from this session and group name:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Deterministic contract symbol:/)).not.toBeInTheDocument();
    expect(screen.queryByText('Customize salt')).not.toBeInTheDocument();
  });

  it('shows a pending admin-account message when the creator wallet is still missing', () => {
    const instance = makeInstance({
      account: '',
      network: { id: 84532, name: 'Base Sepolia' },
      sessionSlug: 'test',
    });
    instance.state = {
      ...instance.state,
      mintOptionsCollapsed: false,
      predictableAddressEnabled: true,
      sbtName: 'Alpha',
    };

    render(instance.render());

    expect(screen.getByTestId(E2E_TESTIDS.SBT_CREATE_PREDICTED_ADDRESS)).toHaveTextContent('Pending admin account…');
    expect(screen.queryByText('Connect a wallet to preview the address.')).not.toBeInTheDocument();
  });

  it('syncs the connected account into the admin defaults when login finishes later', () => {
    const connectedAccount = '0x00000000000000000000000000000000000000aa';
    const instance = makeInstance({
      account: '',
      network: { id: 84532, name: 'Base Sepolia' },
      sessionSlug: 'test',
    });
    instance.state = {
      ...instance.state,
      sbtDistribution: {
        ...instance.state.sbtDistribution,
        burnAdmin: '',
        adminAddress: '',
      },
    };

    const prevProps = { ...instance.props };
    const prevState = {
      ...instance.state,
      sbtDistribution: { ...instance.state.sbtDistribution },
    };
    instance.props = {
      ...instance.props,
      account: connectedAccount,
    };

    instance.componentDidUpdate(prevProps, prevState);

    expect(instance.state.sbtDistribution.burnAdmin).toBe(connectedAccount);
    expect(instance.state.sbtDistribution.adminAddress).toBe(connectedAccount);
  });

  it('preserves a custom admin address when a new wallet connects', () => {
    const previousAccount = '0x00000000000000000000000000000000000000aa';
    const customAdmin = '0x00000000000000000000000000000000000000bb';
    const nextAccount = '0x00000000000000000000000000000000000000cc';
    const instance = makeInstance({
      account: previousAccount,
      network: { id: 84532, name: 'Base Sepolia' },
      sessionSlug: 'test',
    });
    instance.state = {
      ...instance.state,
      sbtDistribution: {
        ...instance.state.sbtDistribution,
        burnAdmin: customAdmin,
        adminAddress: customAdmin,
      },
    };

    const prevProps = { ...instance.props };
    const prevState = {
      ...instance.state,
      sbtDistribution: { ...instance.state.sbtDistribution },
    };
    instance.props = {
      ...instance.props,
      account: nextAccount,
    };

    instance.componentDidUpdate(prevProps, prevState);

    expect(instance.state.sbtDistribution.burnAdmin).toBe(customAdmin);
    expect(instance.state.sbtDistribution.adminAddress).toBe(customAdmin);
  });

  it('intentionally collapses CreateSBT lock options to the canonical default session gate', () => {
    const instance = makeInstance({
      network: { id: 84532, name: 'Base Sepolia' },
      sessionSlug: 'test',
    });
    instance.getSessionConfigForNetwork = jest.fn(() => ({
      sessionName: 'FOR TEST 12',
      networkChainId: 84532,
      sponsored: {
        defaultGateId: 'default_gate',
        gates: {
          default_gate: {
            label: 'Default Gate',
            sbtAddresses: ['0x2222222222222222222222222222222222222222'],
            chainId: 84532,
            litChain: 'baseSepolia',
          },
          ai_gate: {
            label: 'AI Gate',
            sbtAddresses: ['0x1111111111111111111111111111111111111111'],
            chainId: 84532,
            litChain: 'baseSepolia',
          },
          doc_gate: {
            label: 'Docs Gate',
            sbtAddresses: ['0x3333333333333333333333333333333333333333'],
            chainId: 84532,
            litChain: 'baseSepolia',
          },
        },
      },
      lit: {
        defaultGateId: 'default_gate',
      },
      __registry: {
        gateAuthority: 'onchain',
        gatesByResource: {
          default: {
            gateId: 'default_gate',
            sbtAddresses: ['0x2222222222222222222222222222222222222222'],
            lookupStatus: 'ok',
            chainId: 84532,
          },
          ai: {
            gateId: 'ai_gate',
            sbtAddresses: ['0x1111111111111111111111111111111111111111'],
            lookupStatus: 'ok',
            chainId: 84532,
          },
          docUrls: {
            gateId: 'doc_gate',
            sbtAddresses: ['0x3333333333333333333333333333333333333333'],
            lookupStatus: 'ok',
            chainId: 84532,
          },
        },
      },
    }));
    instance.state = {
      ...instance.state,
      tokenInfoCollapsed: false,
      openLockKey: 'name',
      metadataLockGateIds: {
        ...instance.state.metadataLockGateIds,
        name: ['default_gate'],
      },
    };

    const { gateOptions, defaultGateId } = instance.resolveLockGateOptions();

    expect(defaultGateId).toBe('default_gate');
    expect(gateOptions).toEqual([
      expect.objectContaining({
        id: 'default_gate',
        label: 'FOR TEST 12',
        displayLabel: 'FOR TEST 12',
        badgeLabel: 'FOR TEST 12',
        secondaryLabel: '',
        sbtAddress: '0x2222222222222222222222222222222222222222',
      }),
    ]);

    render(instance.render());

    const popover = screen.getByTestId(E2E_TESTIDS.GATE_LOCK_POPOVER);
    expect(within(popover).getAllByTestId(E2E_TESTIDS.GATE_LOCK_ROW)).toHaveLength(1);
    expect(within(popover).getByText('FOR TEST 12')).toBeInTheDocument();
    expect(within(popover).queryByText('FOR TEST 12 (ai)')).not.toBeInTheDocument();
    expect(within(popover).queryByText('FOR TEST 12 (default)')).not.toBeInTheDocument();
    expect(within(popover).queryByText('FOR TEST 12 (docs)')).not.toBeInTheDocument();
  });

  it('keeps the simplified distribution options visible and the shared lock popover mounted through the gate lock button slot', () => {
    const instance = makeInstance({
      network: { id: 84532, name: 'Base Sepolia' },
      sessionSlug: 'test',
    });
    instance.getSessionConfigForNetwork = jest.fn(() => ({
      sessionName: 'FOR TEST 12',
      networkChainId: 84532,
      sponsored: {
        defaultGateId: 'default_gate',
        gates: {
          default_gate: {
            label: 'Default Gate',
            sbtAddresses: ['0x2222222222222222222222222222222222222222'],
            chainId: 84532,
            litChain: 'baseSepolia',
          },
        },
      },
      lit: {
        defaultGateId: 'default_gate',
      },
      __registry: {
        gateAuthority: 'onchain',
        gatesByResource: {
          default: {
            gateId: 'default_gate',
            sbtAddresses: ['0x2222222222222222222222222222222222222222'],
            lookupStatus: 'ok',
            chainId: 84532,
          },
        },
      },
    }));
    instance.state = {
      ...instance.state,
      tokenInfoCollapsed: false,
      distributionOptionsCollapsed: false,
      openLockKey: 'name',
      metadataLockGateIds: {
        ...instance.state.metadataLockGateIds,
        name: ['default_gate'],
      },
    };

    render(instance.render());

    expect(screen.getByText('One-use URLs')).toBeInTheDocument();
    expect(screen.getByText('Group Password')).toBeInTheDocument();
    expect(screen.getByText('public URL')).toBeInTheDocument();
    expect(screen.getByText('Unlisted')).toBeInTheDocument();

    const nameRow = screen.getByTestId(E2E_TESTIDS.SBT_CREATE_NAME_LOCK_ROW);
    expect(within(nameRow).getByTestId(E2E_TESTIDS.GATE_LOCK_BUTTON)).toBeInTheDocument();
    expect(screen.getByTestId(E2E_TESTIDS.GATE_LOCK_POPOVER)).toBeInTheDocument();
    expect(within(screen.getByTestId(E2E_TESTIDS.GATE_LOCK_POPOVER)).getByText('FOR TEST 12')).toBeInTheDocument();
  });

  it('exposes stable section header hooks for deferred deploy E2E flows', () => {
    const instance = makeInstance({
      deferredDeploy: true,
      network: { id: 84532, name: 'Base Sepolia' },
      sessionSlug: 'test',
    });

    render(instance.render());

    expect(document.querySelector(
      `[data-testid="${E2E_TESTIDS.SBT_CREATE_SECTION_HEADER}"][data-ce-section-key="tokenInfoCollapsed"]`
    )).not.toBeNull();
    expect(document.querySelector(
      `[data-testid="${E2E_TESTIDS.SBT_CREATE_SECTION_HEADER}"][data-ce-section-key="mintOptionsCollapsed"]`
    )).not.toBeNull();
  });

  it('surfaces the visible error banner through a stable E2E hook', () => {
    const instance = makeInstance({
      deferredDeploy: true,
      network: { id: 84532, name: 'Base Sepolia' },
      sessionSlug: 'test',
    });
    instance.state = {
      ...instance.state,
      error: 'Upload metadata before adding this Group to the session.',
    };

    render(instance.render());

    expect(screen.getByTestId(E2E_TESTIDS.SBT_CREATE_ERROR)).toHaveTextContent(
      'Upload metadata before adding this Group to the session.'
    );
  });

  it('unions scoped lock gates from provided SBT list session sources without colliding duplicate gate ids', () => {
    const instance = makeInstance({
      network: { id: 84532, name: 'Base Sepolia' },
      sessionSlug: 'alpha',
      lockGatePreferredSessionSlug: 'beta',
      lockGateSessionSources: [
        {
          sessionSlug: 'alpha',
          sessionConfig: {
            slug: 'alpha',
            sessionName: 'Alpha',
            networkChainId: 84532,
            sponsored: {
              defaultGateId: 'default_gate',
              gates: {
                default_gate: {
                  label: 'Alpha Gate',
                  sbtAddresses: ['0x1111111111111111111111111111111111111111'],
                  chainId: 84532,
                  litChain: 'baseSepolia',
                },
              },
            },
            lit: {
              defaultGateId: 'default_gate',
            },
          },
        },
        {
          sessionSlug: 'beta',
          sessionConfig: {
            slug: 'beta',
            sessionName: 'Beta',
            networkChainId: 84532,
            sponsored: {
              defaultGateId: 'default_gate',
              gates: {
                default_gate: {
                  label: 'Beta Gate',
                  sbtAddresses: ['0x2222222222222222222222222222222222222222'],
                  chainId: 84532,
                  litChain: 'baseSepolia',
                },
              },
            },
            lit: {
              defaultGateId: 'default_gate',
            },
          },
        },
      ],
    });
    instance.getSelectedAuthoringChainId = jest.fn(() => 84532);
    instance.getSelectedAuthoringChain = jest.fn(() => ({ id: 84532, name: 'Base Sepolia' }));

    const { gateOptions, gateMap, defaultGateId } = instance.resolveLockGateOptions();
    const alphaGate = gateOptions.find((gate) => gate.label === 'Alpha');
    const betaGate = gateOptions.find((gate) => gate.label === 'Beta');

    expect(gateOptions).toHaveLength(2);
    expect(new Set(gateOptions.map((gate) => gate.id)).size).toBe(2);
    expect(alphaGate).toEqual(expect.objectContaining({
      id: expect.stringMatching(/^session:alpha::default_gate$/),
      sourceGateId: 'default_gate',
      sourceSessionSlug: 'alpha',
      sbtAddress: '0x1111111111111111111111111111111111111111',
    }));
    expect(betaGate).toEqual(expect.objectContaining({
      id: expect.stringMatching(/^session:beta::default_gate$/),
      sourceGateId: 'default_gate',
      sourceSessionSlug: 'beta',
      sbtAddress: '0x2222222222222222222222222222222222222222',
    }));
    expect(defaultGateId).toBe(betaGate.id);
    expect(gateMap[alphaGate.id]).toEqual(expect.objectContaining({
      sourceSessionSlug: 'alpha',
    }));
    expect(gateMap[betaGate.id]).toEqual(expect.objectContaining({
      sourceSessionSlug: 'beta',
    }));

    instance.state = {
      ...instance.state,
      sbtDescription: 'Hidden details',
      metadataLockGateIds: {
        ...instance.state.metadataLockGateIds,
        description: [betaGate.id],
      },
    };

    const preview = instance.buildMetadataPreview();

    expect(preview.encryptedFieldGates).toEqual(expect.objectContaining({
      description: betaGate.id,
    }));
    expect(preview.encryption).toEqual(expect.objectContaining({
      enabled: true,
      defaultGateId: betaGate.id,
      gateIds: [betaGate.id],
      gates: [
        expect.objectContaining({
          gateId: betaGate.id,
          sbtAddress: '0x2222222222222222222222222222222222222222',
        }),
      ],
    }));
  });

  it('keeps unresolved non-general lock readers strict even when the general session is authoritative', () => {
    const priorRegistryCache = localStorage.getItem(REGISTRY_CACHE_KEY);
    localStorage.setItem(REGISTRY_CACHE_KEY, JSON.stringify({
      sessions: {
        '': {
          slug: '',
          sessionName: 'Registry General',
          networkChainId: 84532,
          sponsored: {
            defaultGateId: 'general_gate',
            gates: {
              general_gate: {
                label: 'General Gate',
                sbtAddresses: ['0x1111111111111111111111111111111111111111'],
                chainId: 84532,
                litChain: 'baseSepolia',
              },
            },
          },
          lit: {
            defaultGateId: 'general_gate',
          },
          __registry: {
            gateAuthority: 'onchain',
            gatesByResource: {
              default: {
                gateId: 'general_gate',
                sbtAddresses: ['0x1111111111111111111111111111111111111111'],
                lookupStatus: 'ok',
                chainId: 84532,
              },
            },
          },
        },
      },
    }));

    try {
      const instance = makeInstance({
        network: { id: 84532, name: 'Base Sepolia' },
        sessionSlug: 'missing-session',
      });

      const resolved = instance.getSessionConfigForNetwork();
      const { gateOptions, defaultGateId } = instance.resolveLockGateOptions();

      expect(resolved).toBe('missing-session');
      expect(defaultGateId).toBe('');
      expect(gateOptions).toEqual([]);
    } finally {
      if (priorRegistryCache == null) {
        localStorage.removeItem(REGISTRY_CACHE_KEY);
      } else {
        localStorage.setItem(REGISTRY_CACHE_KEY, priorRegistryCache);
      }
    }
  });

  it('passes unresolved non-general slugs through mint routing instead of inheriting general', async () => {
    const priorRegistryCache = localStorage.getItem(REGISTRY_CACHE_KEY);
    localStorage.setItem(REGISTRY_CACHE_KEY, JSON.stringify({
      sessions: {
        '': {
          slug: '',
          sessionName: 'Registry General',
          networkChainId: 84532,
          contracts: {
            sbtFactory: {
              address: '0x9999999999999999999999999999999999999999',
              chainId: 84532,
            },
          },
        },
      },
    }));

    const instance = makeInstance({
      provider: 'mock-provider',
      account: '0xCreator',
      loginComplete: true,
      network: { id: 84532, name: 'Base Sepolia' },
      sessionSlug: 'missing-session',
    });
    instance.state = {
      ...instance.state,
      sbtName: 'Strict Group',
      tokenURI: 'ar://metadata',
      sbtDistribution: {
        ...instance.state.sbtDistribution,
        burnAuth: 'AdminOnly',
        distributionOption: 'anyoneCanMint',
      },
    };

    const countSpy = jest.spyOn(contractScripts, 'countSBTCreated').mockResolvedValue(0);
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const createSpy = jest
      .spyOn(contractScripts, 'createSBT')
      .mockRejectedValue(new Error('Missing SBT factory for missing-session'));

    try {
      await instance.mintSBT();

      expect(countSpy).toHaveBeenCalledWith('mock-provider', 'missing-session');
      expect(createSpy).toHaveBeenCalledWith(
        'mock-provider',
        'Strict Group',
        'CE-SBT-1',
        0,
        '0xCreator',
        0,
        false,
        0,
        [],
      'ar://metadata',
      expect.anything(),
      'missing-session',
      '',
      {}
      );
      expect(instance.state.mintingFailed).toBe(true);
      expect(instance.state.error).toContain('missing-session');
    } finally {
      consoleSpy.mockRestore();
      if (priorRegistryCache == null) {
        localStorage.removeItem(REGISTRY_CACHE_KEY);
      } else {
        localStorage.setItem(REGISTRY_CACHE_KEY, priorRegistryCache);
      }
    }
  });

  it('uses a placeholder on-chain contract name when the SBT name is locked', async () => {
    const instance = makeInstance({
      provider: 'mock-provider',
      account: '0xCreator',
      loginComplete: true,
      network: { id: 84532, name: 'Base Sepolia' },
    });
    instance.state = {
      ...instance.state,
      sbtName: 'Private Name',
      tokenURI: 'ar://metadata',
      metadataLockGateIds: {
        ...instance.state.metadataLockGateIds,
        name: ['test-sbt'],
      },
      sbtDistribution: {
        ...instance.state.sbtDistribution,
        burnAuth: 'AdminOnly',
      },
    };

    instance.getSessionConfigForNetwork = jest.fn(() => ({ slug: 'test', networkChainId: 84532 }));
    const countCreatedSpy = jest.spyOn(contractScripts, 'countSBTCreated').mockResolvedValue(11);
    const createSpy = jest.spyOn(contractScripts, 'createSBT').mockResolvedValue({
      logs: [
        makeFactoryReceiptLog('SBTCreated', [
          '0x00000000000000000000000000000000000000a1',
        ]),
      ],
    });

    await instance.mintSBT();

    expect(createSpy).toHaveBeenCalledWith(
      'mock-provider',
      'CE-SBT-12',
      'CE-SBT-12',
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      'ar://metadata',
      expect.anything(),
      expect.anything(),
      expect.anything(),
      {}
    );
    countCreatedSpy.mockRestore();
    createSpy.mockRestore();
  });

  it('uses the predicted address when group-password hashes are computed for deterministic deploys', async () => {
    const instance = makeInstance({
      provider: 'mock-provider',
      account: '0xCreator',
      loginComplete: true,
      network: { id: 84532, name: 'Base Sepolia' },
    });
    instance.state = {
      ...instance.state,
      sbtName: 'Scoped Group',
      tokenURI: 'ar://metadata',
      groupPassword: 'shared-secret',
      create2Salt: 'deterministic-salt',
      sbtDistribution: {
        ...instance.state.sbtDistribution,
        burnAuth: 'AdminOnly',
        distributionOption: 'groupPassword',
      },
    };

    instance.getSessionConfigForNetwork = jest.fn(() => ({ slug: 'test', networkChainId: 84532 }));
    const predictedAddress = '0x00000000000000000000000000000000000000f1';
    const deterministicSymbol = `CE-SBT-${ethers.utils.id('deterministic-salt').slice(2, 8).toUpperCase()}`;
    jest.spyOn(contractScripts, 'predictSBTAddress').mockResolvedValue(predictedAddress);
    const hashSpy = jest
      .spyOn(contractScripts, 'computeGroupPasswordHash')
      .mockReturnValue(`0x${'11'.repeat(32)}`);
    const createSpy = jest.spyOn(contractScripts, 'createSBT').mockResolvedValue({
      logs: [
        makeFactoryReceiptLog('SBTCreatedDeterministic', [
          predictedAddress,
          ethers.utils.id('deterministic-salt'),
        ]),
      ],
    });

    await instance.mintSBT();

    expect(hashSpy).toHaveBeenCalledWith({
      password: 'shared-secret',
      sbtAddress: predictedAddress,
    });
    expect(createSpy).toHaveBeenCalledWith(
      'mock-provider',
      'Scoped Group',
      deterministicSymbol,
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      'ar://metadata',
      `0x${'11'.repeat(32)}`,
      expect.anything(),
      'deterministic-salt',
      {
        useConfiguredDeterministic: true,
        initializeGroupPasswordHash: true,
      }
    );
  });

  it('prefers the deferred draft salt over the public slug/name auto salt', () => {
    const instance = makeInstance({
      deferredDeploy: true,
      network: { id: 84532, name: 'Base Sepolia' },
      sessionSlug: 'edge',
    });
    instance.state = {
      ...instance.state,
      sbtName: 'Deferred Group',
      create2Salt: '',
      deferredCreate2Salt: 'draft/private-seed',
    };

    expect(instance.buildAutoCreate2SaltSource()).toBe('edge/deferred-group');
    expect(instance.getResolvedCreate2SaltSource()).toBe('draft/private-seed');
  });

  it('stores an explicit no-factory reason when deterministic preview cannot resolve an address', async () => {
    const instance = makeInstance({
      provider: 'mock-provider',
      account: '0xCreator',
      loginComplete: true,
      network: { id: 84532, name: 'Base Sepolia' },
    });
    instance._isMounted = true;
    instance.state = {
      ...instance.state,
      sbtName: 'No Factory Group',
      groupPassword: 'shared-secret',
      create2Salt: 'deterministic-salt',
      predictableAddressEnabled: true,
      sbtDistribution: {
        ...instance.state.sbtDistribution,
        burnAuth: 'AdminOnly',
        distributionOption: 'groupPassword',
      },
    };

    instance.getSessionConfigForNetwork = jest.fn(() => ({
      slug: 'test',
      networkChainId: 84532,
      contracts: {},
    }));
    jest.spyOn(contractScripts, 'predictSBTAddress').mockResolvedValue('');

    await act(async () => {
      await instance.refreshPredictedAddress();
    });

    expect(instance.state.predictedAddress).toBe('');
    expect(instance.state.predictedAddressStatus).toBe('No Group factory configured for this session.');
  });

  it('ignores older predicted-address responses after newer deterministic inputs are requested', async () => {
    const instance = makeInstance({
      provider: 'mock-provider',
      account: '0xCreator',
      loginComplete: true,
      network: { id: 84532, name: 'Base Sepolia' },
    });
    instance._isMounted = true;
    instance.state = {
      ...instance.state,
      sbtName: 'Race Group',
      groupPassword: 'shared-secret',
      create2Salt: 'salt-one',
      sbtDistribution: {
        ...instance.state.sbtDistribution,
        burnAuth: 'AdminOnly',
        distributionOption: 'groupPassword',
      },
    };

    instance.getSessionConfigForNetwork = jest.fn(() => ({
      slug: 'test',
      networkChainId: 84532,
      contracts: {
        sbtFactory: { address: '0x1111111111111111111111111111111111111111', chainId: 84532 },
      },
    }));

    let resolveFirstPrediction;
    let resolveSecondPrediction;
    const firstPrediction = new Promise((resolve) => {
      resolveFirstPrediction = resolve;
    });
    const secondPrediction = new Promise((resolve) => {
      resolveSecondPrediction = resolve;
    });

    const predictSpy = jest.spyOn(contractScripts, 'predictSBTAddress')
      .mockImplementationOnce(() => firstPrediction)
      .mockImplementationOnce(() => secondPrediction);

    const firstRefresh = instance.refreshPredictedAddress();
    instance.state = {
      ...instance.state,
      create2Salt: 'salt-two',
    };
    const secondRefresh = instance.refreshPredictedAddress();

    resolveSecondPrediction('0x00000000000000000000000000000000000000b2');
    await secondRefresh;
    expect(instance.state.predictedAddress).toBe('0x00000000000000000000000000000000000000b2');

    resolveFirstPrediction('0x00000000000000000000000000000000000000a1');
    await firstRefresh;

    expect(instance.state.predictedAddress).toBe('0x00000000000000000000000000000000000000b2');
    expect(predictSpy).toHaveBeenCalledTimes(2);
  });

  it('recomputes the deterministic deploy plan when the cached preview is stale', async () => {
    const instance = makeInstance({
      provider: 'mock-provider',
      account: '0xCreator',
      loginComplete: true,
      network: { id: 84532, name: 'Base Sepolia' },
      sessionSlug: 'test',
      deferredDeploy: true,
    });
    instance.state = {
      ...instance.state,
      sbtName: 'Deferred Group',
      tokenURI: 'ar://metadata',
      groupPassword: 'shared-secret',
      create2Salt: 'deterministic-salt-two',
      predictedAddress: '0x00000000000000000000000000000000000000d4',
      sbtDistribution: {
        ...instance.state.sbtDistribution,
        burnAuth: 'AdminOnly',
        distributionOption: 'groupPassword',
      },
    };
    instance._predictedAddressShapeSignature = 'stale-signature';
    instance.getSessionConfigForNetwork = jest.fn(() => ({
      slug: 'test',
      networkChainId: 84532,
      contracts: {
        sbtFactory: { address: '0x1111111111111111111111111111111111111111', chainId: 84532 },
      },
    }));

    const freshPredictedAddress = '0x00000000000000000000000000000000000000e5';
    const predictSpy = jest.spyOn(contractScripts, 'predictSBTAddress').mockResolvedValue(freshPredictedAddress);
    const hashSpy = jest
      .spyOn(contractScripts, 'computeGroupPasswordHash')
      .mockReturnValue(`0x${'55'.repeat(32)}`);

    const payload = await instance.buildDeferredDraftPayload();

    expect(predictSpy).toHaveBeenCalledTimes(1);
    expect(hashSpy).toHaveBeenCalledWith({
      password: 'shared-secret',
      sbtAddress: freshPredictedAddress,
    });
    expect(payload.predictedAddress).toBe(freshPredictedAddress);
    expect(payload.finalGroupPasswordHash).toBe(`0x${'55'.repeat(32)}`);
  });

  it('builds a deferred draft payload with the predicted address and deterministic deploy args', async () => {
    const onSaveDraft = jest.fn().mockResolvedValue(undefined);
    const instance = makeInstance({
      provider: 'mock-provider',
      account: '0xCreator',
      loginComplete: true,
      network: { id: 84532, name: 'Base Sepolia' },
      sessionSlug: 'test',
      deferredDeploy: true,
      onSaveDraft,
    });
    instance.state = {
      ...instance.state,
      sbtName: 'Deferred Group',
      tokenURI: 'ar://metadata',
      groupPassword: 'shared-secret',
      create2Salt: 'deterministic-salt',
      predictedAddress: '0x00000000000000000000000000000000000000d4',
      sbtDistribution: {
        ...instance.state.sbtDistribution,
        burnAuth: 'AdminOnly',
        distributionOption: 'groupPassword',
      },
    };

    instance.getSessionConfigForNetwork = jest.fn(() => ({ slug: 'test', networkChainId: 84532 }));
    instance._predictedAddressShapeSignature = instance.buildPredictableDeploySignature(
      instance.buildPredictableDeployShape()
    );
    const predictSpy = jest.spyOn(contractScripts, 'predictSBTAddress');
    jest.spyOn(contractScripts, 'computeGroupPasswordHash').mockReturnValue(`0x${'44'.repeat(32)}`);

    const payload = await instance.buildDeferredDraftPayload();

    expect(predictSpy).not.toHaveBeenCalled();
    expect(payload).toEqual(expect.objectContaining({
      predictedAddress: '0x00000000000000000000000000000000000000d4',
      displayName: 'Deferred Group',
      tokenURI: 'ar://metadata',
      finalGroupPasswordHash: `0x${'44'.repeat(32)}`,
      createOptions: {
        useConfiguredDeterministic: true,
        initializeGroupPasswordHash: true,
      },
    }));
  });

  it('stores a public auto-mint session URL for anyone-can-mint SBTs', async () => {
    const sbtAddress = '0x00000000000000000000000000000000000000b1';
    const instance = makeInstance({
      provider: 'mock-provider',
      account: '0xCreator',
      loginComplete: true,
      network: { id: 84532, name: 'Base Sepolia' },
      sessionSlug: 'edge',
    });
    instance.state = {
      ...instance.state,
      sbtName: 'Open Group',
      tokenURI: 'ar://metadata',
      sbtDistribution: {
        ...instance.state.sbtDistribution,
        burnAuth: 'AdminOnly',
        distributionOption: 'anyoneCanMint',
      },
    };

    instance.getSessionConfigForNetwork = jest.fn(() => ({ slug: 'edge', networkChainId: 84532 }));
    jest.spyOn(contractScripts, 'countSBTCreated').mockResolvedValue(2);
    jest.spyOn(contractScripts, 'createSBT').mockResolvedValue({
      events: [{ event: 'SBTCreated', args: { sbtAddress } }],
    });

    await instance.mintSBT();

    expect(instance.state.autoJoinUrl).toBe(`http://localhost/session/edge?sbt=${encodeURIComponent(sbtAddress)}&auto=1`);
    expect(instance.state.shareableUrl).toBe(instance.state.autoJoinUrl);
  });

  it('renders the open-mint URL card in the success UI for anyone-can-mint SBTs', () => {
    const sbtAddress = '0x00000000000000000000000000000000000000b1';
    const instance = makeInstance({ sessionSlug: 'edge' });
    instance.state = {
      ...instance.state,
      startedMinting: true,
      currentStep: 3,
      sbtMinted: true,
      sbtAddress,
      shareableUrl: `http://localhost/session/edge?sbt=${encodeURIComponent(sbtAddress)}&auto=1`,
      autoJoinUrl: `http://localhost/session/edge?sbt=${encodeURIComponent(sbtAddress)}&auto=1`,
      sbtDistribution: {
        ...instance.state.sbtDistribution,
        distributionOption: 'anyoneCanMint',
      },
    };

    render(instance.render());

    expect(screen.getByRole('heading', { name: 'Created' })).toBeInTheDocument();
    expect(screen.getByText(`${t('minted')}!`)).toBeInTheDocument();
    expect(screen.getByText(t('mint'))).toBeInTheDocument();
    expect(screen.getByText('Contract Address:')).toBeInTheDocument();
    expect(screen.getByTitle('Copy Link to Page')).toBeInTheDocument();
    expect(screen.getByTitle('Bookmark')).toBeInTheDocument();
    expect(screen.getByTitle('Copy Address')).toBeInTheDocument();
    const openMintCard = screen.getByTestId(E2E_TESTIDS.SBT_CREATE_OPEN_MINT_URL);
    expect(openMintCard).toHaveTextContent('URL Where Anyone Can Join');
    expect(openMintCard).toHaveTextContent('/session/edge?sbt=');
  });

  it('prepends PUBLIC_URL when building the session auto-join URL', () => {
    const previousPublicUrl = process.env.PUBLIC_URL;
    process.env.PUBLIC_URL = '/ce/';

    try {
      const sbtAddress = '0x00000000000000000000000000000000000000b1';
      const instance = makeInstance({ sessionSlug: 'edge' });

      expect(instance.buildSessionAutoJoinUrl(sbtAddress)).toBe(
        `http://localhost/ce/session/edge?sbt=${encodeURIComponent(sbtAddress)}&auto=1`
      );
    } finally {
      if (previousPublicUrl === undefined) delete process.env.PUBLIC_URL;
      else process.env.PUBLIC_URL = previousPublicUrl;
    }
  });

  it('canonicalizes reserved session aliases when building the session auto-join URL', () => {
    const sbtAddress = '0x00000000000000000000000000000000000000b1';

    expect(makeInstance({ sessionSlug: 'general' }).buildSessionAutoJoinUrl(sbtAddress)).toBe(
      `http://localhost/session?sbt=${encodeURIComponent(sbtAddress)}&auto=1`
    );
    expect(makeInstance({ sessionSlug: 'debate' }).buildSessionAutoJoinUrl(sbtAddress)).toBe(
      `http://localhost/session/debate?sbt=${encodeURIComponent(sbtAddress)}&auto=1`
    );
  });

  it('builds session-hinted SBT detail page paths when a session slug is known', () => {
    const sbtAddress = '0x00000000000000000000000000000000000000b1';

    expect(makeInstance({ sessionSlug: 'edge' }).buildSbtPagePath(sbtAddress)).toBe(
      buildSbtDetailPath(sbtAddress, 'edge')
    );
    expect(makeInstance({ sessionSlug: 'general' }).buildSbtPagePath(sbtAddress)).toBe(
      buildSbtDetailPath(sbtAddress)
    );
  });

  it('renders the success page link with the resolved session hint', () => {
    const sbtAddress = '0x00000000000000000000000000000000000000b1';
    const instance = makeInstance({ sessionSlug: 'edge' });
    instance.state = {
      ...instance.state,
      startedMinting: true,
      sbtMinted: true,
      sbtAddress,
    };

    render(instance.render());

    expect(screen.getByTestId(E2E_TESTIDS.SBT_CREATE_SUCCESS_PAGE_LINK)).toHaveAttribute(
      'href',
      buildSbtDetailPath(sbtAddress, 'edge')
    );
    expect(screen.getByTestId(E2E_TESTIDS.SBT_CREATE_SUCCESS_PAGE_LINK)).toHaveAttribute(
      'title',
      'Open Page in New Tab'
    );
    expect(screen.getByText(`Page (${sbtAddress})`)).toBeInTheDocument();
  });

  it('canonicalizes reserved session aliases when building limited invite links', async () => {
    const sbtAddress = '0x00000000000000000000000000000000000000b1';
    const encodedPassword = encodeURIComponent(
      cryptoUtils.encodeGroupPasswordForUrl('shared-secret')
    );
    const buildInviteInstance = (sessionSlug) => {
      const instance = makeInstance({ sessionSlug });
      instance.state = {
        ...instance.state,
        sbtDistribution: {
          ...instance.state.sbtDistribution,
          isLimited: true,
          distributionOption: 'groupPassword',
        },
      };
      return instance;
    };

    const generalInstance = buildInviteInstance('general');
    await generalInstance.generateSBTInviteLinks(sbtAddress, ['shared-secret']);
    expect(generalInstance.state.sbtInviteLinks).toEqual([
      `http://localhost/session?auto=1&sbt=${encodeURIComponent(sbtAddress)}&gp=${encodedPassword}`,
    ]);

    const debateInstance = buildInviteInstance('debate');
    await debateInstance.generateSBTInviteLinks(sbtAddress, ['shared-secret']);
    expect(debateInstance.state.sbtInviteLinks).toEqual([
      `http://localhost/session/debate?auto=1&sbt=${encodeURIComponent(sbtAddress)}&gp=${encodedPassword}`,
    ]);
  });

  it('builds unlimited invite links with session-hinted SBT detail paths', async () => {
    const sbtAddress = '0x00000000000000000000000000000000000000b1';
    const instance = makeInstance({ sessionSlug: 'edge' });
    const expectedInvitePath = buildSbtDetailPath(sbtAddress, 'edge')
      .replace(/\?session=edge$/, '/shared-secret?session=edge');

    await instance.generateSBTInviteLinks(sbtAddress, ['shared-secret']);

    expect(instance.state.sbtInviteLinks).toEqual([
      `http://localhost${expectedInvitePath}`,
    ]);
  });

  it('reads bookmark cache with clone:false before mutating sbt bookmarks', async () => {
    const instance = makeInstance({ sessionSlug: 'edge' });
    instance.state.bookmarkedSbtsSet = new Set();
    const peekSpy = jest
      .spyOn(cacheScripts, 'peekCacheSync')
      .mockReturnValue({ sbts: ['0xaaa'] });
    const writeSpy = jest
      .spyOn(cacheScripts, 'writeCache')
      .mockResolvedValue(true);

    instance.bookmarkSBT('0xbbb');
    await Promise.resolve();

    expect(peekSpy).toHaveBeenCalledWith('bookmarksCache', 'edge', { clone: false });
    expect(writeSpy).toHaveBeenCalledWith(
      'bookmarksCache',
      'edge',
      expect.objectContaining({
        sbts: expect.arrayContaining(['0xaaa', '0xbbb']),
      })
    );
  });

  it('componentWillUnmount clears countdown interval and tracked reset timers', () => {
    jest.useFakeTimers();
    try {
      const instance = makeInstance();
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

      const timeoutA = setTimeout(() => {}, 2000);
      const timeoutB = setTimeout(() => {}, 1500);
      const intervalId = setInterval(() => {}, 1000);

      instance._isMounted = true;
      instance._trackedTimeouts.set('copyLinkSuccess', timeoutA);
      instance._trackedTimeouts.set('copyJsonSuccess', timeoutB);
      instance.countdownTimer = intervalId;

      instance.componentWillUnmount();

      expect(instance._isMounted).toBe(false);
      expect(instance.countdownTimer).toBeNull();
      expect(instance._trackedTimeouts.size).toBe(0);
      expect(clearIntervalSpy).toHaveBeenCalledWith(intervalId);
      expect(clearTimeoutSpy).toHaveBeenCalledWith(timeoutA);
      expect(clearTimeoutSpy).toHaveBeenCalledWith(timeoutB);
    } finally {
      jest.useRealTimers();
    }
  });

  it('uses defaultSbtTags as a relevant auto-apply list instead of blindly seeding every default', () => {
    const instance = makeInstance({ defaultSbtTags: 'rxc, debate, governance' });
    instance.loadBookmarks = jest.fn();
    jest.spyOn(instance, 'loadFormCache').mockReturnValue(false);

    instance.componentDidMount();

    expect(instance.state.tags).toEqual([]);

    instance.setState({
      sbtName: 'Debate badge',
      sbtDescription: 'Governance working group',
    });
    instance.syncRelevantDefaultTags();

    expect(instance.state.tags).toEqual(['debate', 'governance']);
    expect(instance.state.autoAppliedDefaultTags).toEqual(['debate', 'governance']);
    expect(instance.state.dismissedDefaultTags).toEqual([]);
  });

  it('keeps removed auto-applied default tags dismissed on future relevance syncs', () => {
    const instance = makeInstance({ defaultSbtTags: 'debate, governance' });
    instance.persistFormCache = jest.fn();
    instance.setState({
      sbtName: 'Debate badge',
      sbtDescription: 'Governance working group',
    });

    instance.syncRelevantDefaultTags();
    expect(instance.state.tags).toEqual(['debate', 'governance']);

    instance.removeTag(0);
    expect(instance.state.tags).toEqual(['governance']);
    expect(instance.state.dismissedDefaultTags).toEqual(['debate']);

    instance.setState({
      sbtDescription: 'Debate and governance working group',
    });
    instance.syncRelevantDefaultTags();

    expect(instance.state.tags).toEqual(['governance']);
    expect(instance.state.dismissedDefaultTags).toEqual(['debate']);
  });

  it('removes auto-applied default tags after the draft stops matching them', () => {
    const instance = makeInstance({ defaultSbtTags: 'debate, governance' });
    instance.setState({
      sbtName: 'Debate badge',
      sbtDescription: 'Governance working group',
    });

    instance.syncRelevantDefaultTags();
    expect(instance.state.tags).toEqual(['debate', 'governance']);
    expect(instance.state.autoAppliedDefaultTags).toEqual(['debate', 'governance']);

    instance.setState({
      sbtName: 'Community badge',
      sbtDescription: 'Local meetup coordination',
    });
    instance.syncRelevantDefaultTags();

    expect(instance.state.tags).toEqual([]);
    expect(instance.state.autoAppliedDefaultTags).toEqual([]);
    expect(instance.state.showTagsInput).toBe(false);
  });
});
