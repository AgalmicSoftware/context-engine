import { ethers } from 'ethers';

import CreateSBTGroup from './CreateSBTGroup';
import { arweaveClient } from '../../utilities/arweave/arweaveClient.js';
import * as resourceKeys from '../../utilities/session/resourceKeys.js';
import { cryptoUtils } from '../../utilities/crypto/cryptography.js';

const makeInstance = (props = {}) => {
  const instance = new CreateSBTGroup(props);
  instance.setState = (update, cb) => {
    const next = typeof update === 'function' ? update(instance.state) : update;
    instance.state = { ...instance.state, ...next };
    if (cb) cb();
  };
  return instance;
};

const expectUploadFailureLog = (consoleErrorSpy, messagePattern) => {
  const loggedError = consoleErrorSpy.mock.calls.find(
    ([prefix, label]) => prefix === '[sbt]' && label === 'uploadTokenUriToArweave failed:',
  )?.[2];
  expect(loggedError).toBeInstanceOf(Error);
  expect(loggedError.message).toMatch(messagePattern);
};

describe('CreateSBTGroup metadata and deferred upload helpers', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete window.ethereum;
    delete window.__litHooks;
    delete window.litHooks;
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

    expect(preview).toEqual(
      expect.objectContaining({
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
        sessionSlugExplicit: true,
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
      }),
    );
    expect(preview.adminRecovery).toBeUndefined();
    expect(preview.encryptedFields.image).not.toHaveProperty('url');
    expect(preview.encryptedFields.image).not.toHaveProperty('mime');
    expect(preview.encryptedFields.image).not.toHaveProperty('name');
  });

  it('refreshes memoized render metadata when document hashes or creator account change', () => {
    const instance = makeInstance({
      account: '0xCreatorA',
      network: { id: 84532, name: 'Base Sepolia' },
      sessionSlug: 'test',
    });
    const baseArgs = {
      account: '0xCreatorA',
      authoringChain: { id: 84532, name: 'Base Sepolia' },
      authoringChainId: 84532,
      autoJoinUrl: '',
      create2Salt: '',
      currentTagInput: '',
      deferredDeployMode: false,
      documentIDHashes: 'hash-a',
      documentURLs: [],
      documentUrl: '',
      effectiveSessionSlug: 'test',
      groupPassword: '',
      imageChooserStatusText: '',
      imageChooserStatusTone: '',
      imageLoadError: '',
      metadataLockGateIds: {},
      network: 84532,
      predictableAddressActive: false,
      sbtAddress: '',
      sbtDescription: 'Description',
      sbtDistribution: instance.state.sbtDistribution,
      sbtImageFile: null,
      sbtImageUrl: '',
      sbtName: 'Alpha',
      shareableUrl: '',
      tags: [],
      tokenURI: '',
      useImageUrl: true,
    };
    instance.state = {
      ...instance.state,
      sbtName: 'Alpha',
      sbtDescription: 'Description',
      documentIDHashes: 'hash-a',
    };

    const first = instance.getCreateSbtRenderDerivations(baseArgs).metadataPreview;
    instance.props = {
      ...instance.props,
      account: '0xCreatorB',
    };
    instance.state = {
      ...instance.state,
      documentIDHashes: 'hash-b',
    };
    const second = instance.getCreateSbtRenderDerivations({
      ...baseArgs,
      account: '0xCreatorB',
      documentIDHashes: 'hash-b',
    }).metadataPreview;

    expect(first.creator).toBe('0xCreatorA');
    expect(first.documentIDHashes).toEqual(['hash-a']);
    expect(second.creator).toBe('0xCreatorB');
    expect(second.documentIDHashes).toEqual(['hash-b']);
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

    expect(() =>
      instance.requireRecipientsForGateSelection({
        gateIds: ['gate-1'],
        recipients: [],
        scopeLabel: 'content',
      }),
    ).toThrow('Selected lock access rule (gate-1) for content do not resolve to valid Lit recipients.');

    await expect(
      instance.encryptValueWithRecipients({
        value: 'secret',
        maskedValue: '[encrypted]',
        recipients: [],
      }),
    ).rejects.toThrow('Selected access rule does not provide any Lit recipients.');
  });

  it('uses scoped Lit hooks for locked metadata encryption when global hooks are absent', async () => {
    const scopedSaveKey = jest.fn();
    const encryptSpy = jest.spyOn(cryptoUtils, 'encryptEnvelopeValue').mockResolvedValue({ encrypted: true });
    const instance = makeInstance({
      provider: 'mock-provider',
      account: '0xCreator',
      litHooks: { saveKey: scopedSaveKey },
    });

    await expect(
      instance.encryptValueWithRecipients({
        value: 'secret',
        maskedValue: '[encrypted]',
        contextLabel: 'sbt:test:name',
        chainIdFallback: 11155420,
        recipients: [
          {
            chain: 'optimismSepolia',
            accessControlConditions: [{ contractAddress: '0x00000000000000000000000000000000000000aa' }],
          },
        ],
      }),
    ).resolves.toEqual({
      value: '[encrypted]',
      encrypted: { encrypted: true },
    });

    expect(encryptSpy).toHaveBeenCalledWith(
      'secret',
      expect.objectContaining({
        lit: expect.objectContaining({
          saveKey: scopedSaveKey,
        }),
      }),
    );
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
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    try {
      await expect(instance.uploadTokenUriToArweave()).rejects.toThrow(
        'name encryption access rules could not be resolved. Please reselect the lock or configure valid access rules.',
      );
      expectUploadFailureLog(
        consoleErrorSpy,
        /^name encryption access rules could not be resolved\. Please reselect the lock or configure valid access rules\.$/,
      );
    } finally {
      consoleErrorSpy.mockRestore();
    }
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
    const uploadSpy = jest.spyOn(arweaveClient, 'uploadDataToArweave').mockImplementation(async (data) => {
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
    const uploadSpy = jest.spyOn(arweaveClient, 'uploadDataToArweave').mockImplementation(async (data) => {
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
    const uploadSpy = jest.spyOn(arweaveClient, 'uploadDataToArweave').mockImplementation(async (data) => {
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
    const uploadSpy = jest
      .spyOn(arweaveClient, 'uploadDataToArweave')
      .mockImplementation(async (_data, _format, opts = {}) => {
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

    const uploadSpy = jest
      .spyOn(arweaveClient, 'uploadDataToArweave')
      .mockImplementation(async (_data, _format, opts = {}) => {
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
    expect(result).toEqual(
      expect.objectContaining({
        imageUploaded: true,
        sbtImageUrl: 'test-image-uri',
      }),
    );
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

    const uploadSpy = jest
      .spyOn(arweaveClient, 'uploadDataToArweave')
      .mockImplementation(async (_data, _format, opts = {}) => {
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

    const uploadSpy = jest.spyOn(arweaveClient, 'uploadDataToArweave');
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    try {
      await expect(instance.uploadTokenUriToArweave()).rejects.toThrow(
        'Set the session URL before adding this Group to the session.',
      );

      expect(uploadSpy).not.toHaveBeenCalled();
      expect(instance.state.mintingFailed).toBe(true);
      expect(instance.state.error).toBe('Set the session URL before adding this Group to the session.');
      expectUploadFailureLog(consoleErrorSpy, /^Set the session URL before adding this Group to the session\.$/);
    } finally {
      consoleErrorSpy.mockRestore();
    }
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

    const uploadSpy = jest.spyOn(arweaveClient, 'uploadDataToArweave');
    const getKeySpy = jest.spyOn(resourceKeys, 'getEffectiveArweaveKey').mockResolvedValue({});

    const result = await instance.handleDeferredSave();

    expect(uploadSpy).not.toHaveBeenCalled();
    expect(onSaveDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        tokenURI: '',
        metadataUploadStatus: 'pending-upload',
        authoringPayload: expect.objectContaining({
          sbtName: 'Deferred Group',
          tags: ['alpha'],
          _sessionSlug: 'publish-later',
        }),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        tokenURI: '',
        metadataUploadStatus: 'pending-upload',
        authoringPayload: expect.objectContaining({
          sbtName: 'Deferred Group',
          _sessionSlug: 'publish-later',
        }),
      }),
    );
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

    const uploadSpy = jest.spyOn(arweaveClient, 'uploadDataToArweave');

    const result = await instance.handleDeferredSave();

    expect(uploadSpy).not.toHaveBeenCalled();
    expect(onSaveDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        tokenURI: '',
        metadataUploadStatus: 'pending-upload',
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        tokenURI: '',
        metadataUploadStatus: 'pending-upload',
      }),
    );
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
    expect(onSaveDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        authoringPayload: expect.objectContaining({
          documentURLs: ['https://doc.test/pending'],
          documentUrl: '',
        }),
        metadataPreview: expect.objectContaining({
          documentURLs: ['https://doc.test/pending'],
        }),
      }),
    );
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

    expect(onSaveDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        tokenURI: '',
        metadataUploadStatus: 'pending-upload',
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        tokenURI: '',
        metadataUploadStatus: 'pending-upload',
      }),
    );
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
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    try {
      await expect(instance.uploadTokenUriToArweave()).rejects.toThrow(/could not be resolved/i);

      expect(instance.state.mintingFailed).toBe(true);
      expect(instance.state.error).toMatch(/could not be resolved/i);
      expectUploadFailureLog(consoleErrorSpy, /could not be resolved/i);
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});
