import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { ethers } from 'ethers';
import CreateSBTGroup from './CreateSBTGroup';
import styles from './CreateSBTGroup.module.scss';
import gateLockStyles from '../Gates/GateMultiSelectLock.module.scss';
import contractScripts from '../../utilities/web3/contractScripts.js';
import { arweaveScripts } from '../../utilities/arweave/arweaveScripts.js';
import * as cacheScripts from '../../utilities/cache/cacheScripts.js';
import * as resourceKeys from '../../utilities/session/resourceKeys.js';
import { cryptoUtils } from '../../utilities/crypto/cryptography.js';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { getScopedCreateSbtFormCacheKey } from '../../utilities/sbt/sbtCreateFormCache.js';
import {
  CreateSBTGroup,
  getScopedCreateSbtFormCacheKey,
  SBT_PASSWORD_RECOVERY_STORAGE_KEY,
} from '../../utilities/sbt/sbtPasswordRecoveryStore.js';
import { t } from '../../utilities/ui/terminology.js';

const mockFetchImageFromURL = jest.fn();

jest.mock('../../utilities/ui/imageScripts.js', () => {
  const actual = jest.requireActual('../../utilities/ui/imageScripts.js');
  return {
    __esModule: true,
    ...actual,
    fetchImageFromURL: (...args) => mockFetchImageFromURL(...args),
  };
});

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

// This broad suite intentionally keeps CreateSBT cache, deploy, gate, and mint flows whose setup crosses component concerns.
describe('CreateSBTGroup cache helpers', () => {
  setupCreateSBTGroupTestLifecycle();

  it('initializes a blank authoring form with open mint defaults', () => {
    const instance = makeInstance({ account: '0xAdmin' });

    expect(instance.state).toEqual(expect.objectContaining({
      sbtName: '',
      sbtDescription: '',
      sbtImageFile: null,
      sbtImageUrl: '',
      useImageUrl: false,
      tags: [],
      currentTagInput: '',
      documentURLs: [],
      documentUrl: '',
      groupPassword: '',
      metadataLockGateIds: {
        name: [],
        description: [],
        tags: [],
        documentURLs: [],
        image: [],
      },
      sbtCodes: [],
      groupSubmitted: false,
      predictableAddressEnabled: false,
      mintOptionsCollapsed: true,
      distributionOptionsCollapsed: true,
      numInviteLinks: 10,
      exportFormat: 'json',
    }));
    expect(instance.state.sbtDistribution).toEqual(expect.objectContaining({
      distributionOption: 'anyoneCanMint',
      adminAddress: '0xAdmin',
      burnAdmin: '0xAdmin',
      isLimited: false,
      isTimeLimited: false,
      unlisted: false,
      network: 'not connected',
    }));
    expect(instance.state.network).toBe('');
  });

  it('buildCachePayload normalizes dates and network metadata', () => {
    const instance = makeInstance({ network: { id: 5, name: 'Goerli' } });
    instance.state.sbtName = 'Alpha';
    instance.state.sbtDescription = 'Desc';
    instance.state.sbtImageUrl = 'https://img.test/logo.png';
    instance.state.useImageUrl = true;
    instance.state.tags = ['tag1', 'tag2'];
    instance.state.documentURLs = ['https://doc.test'];
    instance.state.documentUrl = 'https://doc.test/pending';
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
    expect(payload.documentUrl).toBe('https://doc.test/pending');
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

  it('saves generated password codes to the scoped recovery store without legacy createdSBTs writes', () => {
    localStorage.clear();
    const sbtAddress = '0xABC0000000000000000000000000000000000000';
    const instance = makeInstance({
      network: { id: 84532, name: 'Base Sepolia' },
      sessionSlug: 'test',
    });

    instance.persistCreatedSbtCodes({
      sbtAddress,
      hasPasswordMintOnChain: true,
      codesToStore: ['code-one', 'code-two'],
    });

    const recoveryStore = JSON.parse(localStorage.getItem(SBT_PASSWORD_RECOVERY_STORAGE_KEY));
    expect(recoveryStore.entries[`84532:${sbtAddress.toLowerCase()}`]).toEqual(expect.objectContaining({
      chainId: 84532,
      sbtAddress: sbtAddress.toLowerCase(),
      passwords: ['code-one', 'code-two'],
    }));
  });

  it('skips recovery-code persistence when the SBT has no password mint path', () => {
    localStorage.clear();
    const instance = makeInstance({
      network: { id: 84532, name: 'Base Sepolia' },
      sessionSlug: 'test',
    });

    const result = instance.persistCreatedSbtCodes({
      sbtAddress: '0xABC0000000000000000000000000000000000000',
      hasPasswordMintOnChain: false,
      codesToStore: ['unused-code'],
    });

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      status: 'empty-recovery-payload',
    }));
    expect(localStorage.getItem(SBT_PASSWORD_RECOVERY_STORAGE_KEY)).toBeNull();
  });

  it('renders a QR SVG into a PNG blob for download and copy helpers', async () => {
    const instance = makeInstance();
    document.body.innerHTML = '<svg id="hidden-page-qr" xmlns="http://www.w3.org/2000/svg"></svg>';
    const qrBlob = new Blob(['qr'], { type: 'image/png' });
    const originalCreateElement = document.createElement.bind(document);
    const originalImage = global.Image;
    const canvasContext = {
      fillStyle: '',
      fillRect: jest.fn(),
      drawImage: jest.fn(),
    };
    const createElementSpy = jest.spyOn(document, 'createElement').mockImplementation((tagName, options) => {
      const element = originalCreateElement(tagName, options);
      if (String(tagName).toLowerCase() === 'canvas') {
        element.getContext = jest.fn(() => canvasContext);
        element.toBlob = jest.fn((callback) => callback(qrBlob));
      }
      return element;
    });
    class MockImage {
      constructor() {
        this.width = 24;
        this.height = 24;
        this.onload = null;
      }

      set src(_value) {
        setTimeout(() => {
          if (this.onload) this.onload();
        }, 0);
      }
    }

    global.Image = MockImage;
    try {
      await expect(instance.processQrImage('hidden-page-qr')).resolves.toBe(qrBlob);
      expect(canvasContext.fillRect).toHaveBeenCalledWith(0, 0, 24, 24);
      expect(canvasContext.drawImage).toHaveBeenCalled();
    } finally {
      createElementSpy.mockRestore();
      global.Image = originalImage;
      document.body.innerHTML = '';
    }
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

  it('loadFormCache restores a pending document URL draft and expands the authoring sections', () => {
    const instance = makeInstance({ network: { id: 84532, name: 'Base Sepolia' }, sessionSlug: 'test' });
    instance.updateGroupHash = jest.fn();

    sessionStorage.setItem(
      getScopedCreateSbtFormCacheKey('test'),
      JSON.stringify({
        sbtName: 'Cached',
        documentUrl: 'https://doc.test/pending',
        _sessionSlug: 'test',
        sbtDistribution: {
          network: 84532,
        },
      })
    );

    const loaded = instance.loadFormCache();

    expect(loaded).toBe(true);
    expect(instance.state.documentURLs).toEqual([]);
    expect(instance.state.documentUrl).toBe('https://doc.test/pending');
    expect(instance.state.tokenInfoCollapsed).toBe(false);
    expect(instance.state.mintOptionsCollapsed).toBe(false);
    expect(instance.state.distributionOptionsCollapsed).toBe(false);
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

  it('canonicalizes bare Arweave image txids before metadata upload and preview serialization', async () => {
    const instance = makeInstance({
      account: '0xCreator',
      network: { id: 84532, name: 'Base Sepolia' },
      provider: 'mock-provider',
      sessionSlug: 'test',
    });
    const rawImageTxId = 'c'.repeat(43);
    instance.getSessionConfigForNetwork = jest.fn(() => ({ slug: 'test', networkChainId: 84532 }));
    instance.state = {
      ...instance.state,
      sbtName: 'Alpha',
      sbtDescription: 'Private details',
      sbtImageUrl: rawImageTxId,
      useImageUrl: true,
      sbtDistribution: {
        ...instance.state.sbtDistribution,
        burnAuth: 'AdminOnly',
        network: { name: 'Base Sepolia' },
      },
    };

    const preview = instance.buildMetadataPreview();
    expect(preview.image).toBe(`ar://${rawImageTxId}`);

    jest.spyOn(resourceKeys, 'getEffectiveArweaveKey').mockResolvedValue({ arweaveJwk: 'test-jwk' });
    const uploadSpy = jest.spyOn(arweaveScripts, 'uploadDataToArweave').mockImplementation(async (data) => {
      const parsed = JSON.parse(data);
      expect(parsed.image).toBe(`ar://${rawImageTxId}`);
      return 'test-token-uri';
    });

    await instance.uploadTokenUriToArweave();

    expect(uploadSpy).toHaveBeenCalled();
    expect(instance.state.tokenURI).toBe('test-token-uri');
  });

  it('preserves txId-only locked uploaded images in encrypted SBT metadata', async () => {
    const instance = makeInstance({
      account: '0xCreator',
      network: { id: 84532, name: 'Base Sepolia' },
      provider: 'mock-provider',
      sessionSlug: 'test',
    });
    const imageTxId = 'd'.repeat(43);
    const gateMap = {
      'gate-a': {
        gateId: 'gate-a',
        id: 'gate-a',
        label: 'Gate A',
        sbtAddress: '0x00000000000000000000000000000000000000aa',
        chainId: 84532,
      },
    };
    instance.getSessionConfigForNetwork = jest.fn(() => ({ slug: 'test', networkChainId: 84532 }));
    instance.resolveLockGateOptions = jest.fn(() => ({ gateMap, defaultGateId: 'gate-a' }));
    instance.buildGateObjectsAndRecipients = jest.fn(() => ({
      recipients: [{ accessControlConditions: [{ contractAddress: '0xgate' }], chain: 'baseSepolia' }],
    }));
    instance.requireRecipientsForGateSelection = jest.fn();
    const encryptSpy = jest.spyOn(instance, 'encryptValueWithRecipients').mockResolvedValue({
      value: '[encrypted]',
      encrypted: { ciphertext: 'wrong-image-fallback' },
    });
    instance.state = {
      ...instance.state,
      sbtName: 'Locked Image Group',
      sbtDescription: 'Uses uploaded encrypted image asset',
      useImageUrl: false,
      sbtImageFile: new File([new Uint8Array([1, 2, 3])], 'locked.png', { type: 'image/png' }),
      lockedImageAsset: {
        storage: 'lit-arweave',
        txId: imageTxId,
      },
      metadataLockGateIds: {
        ...instance.state.metadataLockGateIds,
        image: ['gate-a'],
      },
      sbtDistribution: {
        ...instance.state.sbtDistribution,
        burnAuth: 'AdminOnly',
        network: { name: 'Base Sepolia' },
      },
    };

    jest.spyOn(resourceKeys, 'getEffectiveArweaveKey').mockResolvedValue({ arweaveJwk: 'test-jwk' });
    const uploadSpy = jest.spyOn(arweaveScripts, 'uploadDataToArweave').mockImplementation(async (data) => {
      const parsed = JSON.parse(data);
      expect(parsed.image).toBe('');
      expect(parsed.encryptedFields.image).toEqual({
        storage: 'lit-arweave',
        txId: imageTxId,
      });
      expect(parsed.encryption.targets.image).toBe(true);
      return 'test-token-uri';
    });

    await instance.uploadTokenUriToArweave();

    expect(encryptSpy).not.toHaveBeenCalled();
    expect(uploadSpy).toHaveBeenCalled();
    expect(instance.state.tokenURI).toBe('test-token-uri');
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
      expect(opts.forceDirectArweaveUpload).toBe(false);
      expect(opts.adminAuth).toBeNull();
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

  it('falls back to direct image upload when worker bootstrap auth fetch fails and a wizard JWK is available', async () => {
    const signAdminAction = jest.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    const instance = makeInstance({
      account: '0xCreator',
      loginComplete: true,
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
    instance.state = {
      ...instance.state,
      useImageUrl: false,
      sbtImageFile: new File([new Uint8Array([1, 2, 3])], 'badge.png', { type: 'image/png' }),
      sbtDistribution: {
        ...instance.state.sbtDistribution,
        burnAuth: 'AdminOnly',
        network: { name: 'Anvil' },
      },
    };

    const uploadSpy = jest.spyOn(arweaveScripts, 'uploadDataToArweave').mockImplementation(async (_data, _format, opts = {}) => {
      expect(opts.forceDirectArweaveUpload).toBe(true);
      expect(opts.arweaveJwk).toBe('{"kty":"RSA"}');
      expect(opts.skipAuth).toBe(true);
      expect(opts.adminAuth).toBeNull();
      return 'test-image-uri';
    });

    const result = await instance.uploadImageToArweave();

    expect(signAdminAction).toHaveBeenCalledWith({
      statement: 'Admin request: bootstrap arweave upload',
      targetSlug: 'local-test',
      workerUrl: 'https://draft-upload.example.test',
    });
    expect(result).toEqual(expect.objectContaining({
      imageUploaded: true,
      sbtImageUrl: 'test-image-uri',
    }));
    expect(instance.state.sbtImageUrl).toBe('test-image-uri');
    uploadSpy.mockRestore();
  });

  it('falls back to direct tokenURI upload when worker bootstrap auth fetch fails and a wizard JWK is available', async () => {
    const signAdminAction = jest.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
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
    instance.state = {
      ...instance.state,
      sbtName: 'Local Draft',
      sbtDescription: 'Uploads with fallback',
      sbtDistribution: {
        ...instance.state.sbtDistribution,
        burnAuth: 'AdminOnly',
        network: { name: 'Anvil' },
      },
    };

    const uploadSpy = jest.spyOn(arweaveScripts, 'uploadDataToArweave').mockImplementation(async (_data, _format, opts = {}) => {
      expect(opts.forceDirectArweaveUpload).toBe(true);
      expect(opts.arweaveJwk).toBe('{"kty":"RSA"}');
      expect(opts.skipAuth).toBe(true);
      expect(opts.adminAuth).toBeNull();
      return 'test-token-uri';
    });

    await instance.uploadTokenUriToArweave();

    expect(signAdminAction).toHaveBeenCalledWith({
      statement: 'Admin request: bootstrap arweave upload',
      targetSlug: 'local-test',
      workerUrl: 'https://draft-upload.example.test',
    });
    expect(instance.state.tokenURI).toBe('test-token-uri');
    uploadSpy.mockRestore();
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

  it('auto-commits a pending document URL when submit saves a deferred draft', async () => {
    const onSaveDraft = jest.fn(async () => {});
    const instance = makeInstance({
      account: '0x1111111111111111111111111111111111111111',
      network: { id: 84532, name: 'Base Sepolia' },
      provider: 'mock-provider',
      sessionSlug: 'publish-later',
      deferredDeploy: true,
      attemptImmediateDeferredUpload: false,
      onSaveDraft,
    });
    instance.getSessionConfigForNetwork = jest.fn(() => ({
      slug: 'publish-later',
      networkChainId: 84532,
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
      documentUrl: 'https://doc.test/pending',
      sbtDistribution: {
        ...instance.state.sbtDistribution,
        burnAuth: 'AdminOnly',
        network: { name: 'Base Sepolia' },
      },
    };

    jest.spyOn(resourceKeys, 'getEffectiveArweaveKey').mockResolvedValue({});

    await instance.handleMintClick();

    expect(instance.state.documentURLs).toEqual(['https://doc.test/pending']);
    expect(instance.state.documentUrl).toBe('');
    expect(onSaveDraft).toHaveBeenCalledWith(expect.objectContaining({
      authoringPayload: expect.objectContaining({
        documentURLs: ['https://doc.test/pending'],
        documentUrl: '',
      }),
      metadataPreview: expect.objectContaining({
        documentURLs: ['https://doc.test/pending'],
      }),
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
      forceDirectArweaveUpload: false,
      arweaveJwk: '{"kty":"RSA"}',
      workerUrl: 'https://draft-upload.example.test',
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
      arweaveJwk: '{"kty":"RSA"}',
      workerUrl: 'https://draft-upload.example.test',
      skipAuth: true,
      adminAuth: null,
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

  it('renders metadata field locks without SBT badge text or inline gate dots', () => {
    const instance = makeInstance({
      network: { id: 84532, name: 'Base Sepolia' },
      sessionSlug: 'test',
    });
    instance.state = {
      ...instance.state,
      tokenInfoCollapsed: false,
      metadataLockGateIds: {
        ...instance.state.metadataLockGateIds,
        description: ['gate-1', 'gate-2'],
      },
    };
    instance.resolveLockGateOptions = jest.fn(() => ({
      gateOptions: [
        { id: 'gate-1', label: 'Alpha Gate', badgeLabel: 'Alpha Gate', color: '#5affc2' },
        { id: 'gate-2', label: 'Beta Gate', badgeLabel: 'Beta Gate', color: '#5b8cff' },
      ],
      defaultGateId: 'gate-1',
    }));

    render(instance.render());

    const descriptionRow = screen.getByTestId(E2E_TESTIDS.SBT_CREATE_DESCRIPTION_LOCK_ROW);
    const lock = within(descriptionRow).getByTestId(E2E_TESTIDS.GATE_LOCK);

    expect(within(lock).getByTestId(E2E_TESTIDS.GATE_LOCK_BUTTON)).toBeInTheDocument();
    expect(within(lock).queryByText(/\bSBT\b/i)).not.toBeInTheDocument();
    expect(within(lock).queryByText(/Alpha Gate/i)).not.toBeInTheDocument();
    expect(within(lock).queryByText(/Beta Gate/i)).not.toBeInTheDocument();
    expect(within(lock).queryByText(/\b\d+\s+gates?\b/i)).not.toBeInTheDocument();
    expect(lock.querySelector(`.${gateLockStyles.dots}`)).toBeNull();
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

  it('renders the time-limited mint input as a native datetime field and updates the end time', () => {
    const instance = makeInstance({
      network: { id: 84532, name: 'Base Sepolia' },
      sessionSlug: 'test',
    });
    instance.state = {
      ...instance.state,
      mintOptionsCollapsed: false,
      sbtDistribution: {
        ...instance.state.sbtDistribution,
        isTimeLimited: true,
        mintingEndTime: new Date('2026-04-06T12:30:00'),
      },
    };

    const { container } = render(instance.render());

    const input = container.querySelector('input[type="datetime-local"]');
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue('2026-04-06T12:30');

    fireEvent.change(input, { target: { value: '2026-04-06T13:45' } });

    expect(instance.state.sbtDistribution.mintingEndTime).toBeInstanceOf(Date);
    expect(instance.state.sbtDistribution.mintingEndTime.getFullYear()).toBe(2026);
    expect(instance.state.sbtDistribution.mintingEndTime.getMonth()).toBe(3);
    expect(instance.state.sbtDistribution.mintingEndTime.getDate()).toBe(6);
    expect(instance.state.sbtDistribution.mintingEndTime.getHours()).toBe(13);
    expect(instance.state.sbtDistribution.mintingEndTime.getMinutes()).toBe(45);
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

  it('clears and suppresses draft cache persistence after a successful mint', async () => {
    const sbtAddress = '0x00000000000000000000000000000000000000b2';
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
      sbtDescription: 'Cached before mint',
      tokenURI: 'ar://metadata',
      sbtDistribution: {
        ...instance.state.sbtDistribution,
        burnAuth: 'AdminOnly',
        distributionOption: 'anyoneCanMint',
      },
    };
    instance.getSessionConfigForNetwork = jest.fn(() => ({ slug: 'edge', networkChainId: 84532 }));
    instance.schedulePredictedAddressRefresh = jest.fn();

    const scopedKey = getScopedCreateSbtFormCacheKey('edge');
    instance.persistFormCache();
    expect(sessionStorage.getItem(scopedKey)).toContain('"Open Group"');

    const prevProps = instance.props;
    const prevState = { ...instance.state };
    jest.spyOn(contractScripts, 'countSBTCreated').mockResolvedValue(2);
    jest.spyOn(contractScripts, 'createSBT').mockResolvedValue({
      events: [{ event: 'SBTCreated', args: { sbtAddress } }],
    });

    await instance.mintSBT();

    expect(sessionStorage.getItem(scopedKey)).toBeNull();
    expect(instance._suppressFormCachePersistence).toBe(true);

    instance.componentDidUpdate(prevProps, prevState);

    expect(sessionStorage.getItem(scopedKey)).toBeNull();
  });

  it('persists password recovery codes during mint to the scoped recovery store', async () => {
    localStorage.clear();
    const sbtAddress = '0x00000000000000000000000000000000000000b3';
    const instance = makeInstance({
      provider: 'mock-provider',
      account: '0xCreator',
      loginComplete: true,
      network: { id: 84532, name: 'Base Sepolia' },
      sessionSlug: 'edge',
    });
    instance.state = {
      ...instance.state,
      sbtName: 'Password Group',
      tokenURI: 'ar://metadata',
      groupPassword: 'shared-secret',
      sbtDistribution: {
        ...instance.state.sbtDistribution,
        burnAuth: 'AdminOnly',
        distributionOption: 'groupPassword',
        isLimited: true,
        limitedNumber: 1,
      },
    };

    instance.getSessionConfigForNetwork = jest.fn(() => ({ slug: 'edge', networkChainId: 84532 }));
    jest.spyOn(instance, 'generateSBTInviteLinks').mockResolvedValue(undefined);
    jest.spyOn(contractScripts, 'countSBTCreated').mockResolvedValue(2);
    jest.spyOn(contractScripts, 'computeGroupPasswordHash').mockReturnValue(`0x${'33'.repeat(32)}`);
    jest.spyOn(contractScripts, 'createSBT').mockResolvedValue({
      logs: [
        makeFactoryReceiptLog('SBTCreated', [sbtAddress]),
      ],
    });

    await instance.mintSBT();

    expect(instance.generateSBTInviteLinks).toHaveBeenCalledWith(sbtAddress, ['shared-secret']);
    const recoveryStore = JSON.parse(localStorage.getItem(SBT_PASSWORD_RECOVERY_STORAGE_KEY));
    expect(recoveryStore.entries[`84532:${sbtAddress.toLowerCase()}`]).toEqual(expect.objectContaining({
      chainId: 84532,
      sbtAddress: sbtAddress.toLowerCase(),
      passwords: ['shared-secret'],
    }));
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

});
