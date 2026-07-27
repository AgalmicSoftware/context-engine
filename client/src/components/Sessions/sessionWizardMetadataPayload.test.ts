import {
  applySessionWizardMetadataUploadGuards,
  buildSessionWizardSecretFieldGateErrorMessage,
  getSessionWizardMetadataSecretFieldGateKeys,
  normalizeSessionWizardDefaultFeaturedSbtMetadata,
  resolveSessionWizardMetadataPayloadBase,
} from './sessionWizardMetadataPayload';

describe('normalizeSessionWizardDefaultFeaturedSbtMetadata', () => {
  it('normalizes string, address-object, and sbt-address entries without duplicates', () => {
    expect(
      normalizeSessionWizardDefaultFeaturedSbtMetadata([
        '0xAAA',
        { address: ' 0xbbb ' },
        { sbtAddress: '0xAAA' },
        '',
        {},
      ]),
    ).toEqual(['0xAAA', '0xbbb']);

    expect(normalizeSessionWizardDefaultFeaturedSbtMetadata('0x111, 0x222\n0x111')).toEqual(['0x111', '0x222']);
  });
});

describe('resolveSessionWizardMetadataPayloadBase', () => {
  it('describes base metadata identity without mutating the draft or owning upload effects', () => {
    const draft = {
      sessionName: ' Writers Room ',
      sessionInfo: '   ',
      slug: 'writers-room',
      sessionIdHex: '0xstale',
      sponsoredSbtAddress: '0xsponsored',
      autoFeatureSBTsWithFeaturedSbtTags: true,
      defaultFeaturedSBTs: ['0xAAA', { address: '0xbbb' }, { sbtAddress: '0xAAA' }],
      groupCreationPolicy: 'admin_only',
    };

    const metadata = resolveSessionWizardMetadataPayloadBase({
      draft,
      sessionId: '00000000-0000-0000-0000-000000000001',
    });

    expect(metadata).toEqual(
      expect.objectContaining({
        sessionName: 'Writers Room',
        slug: 'writers-room',
        sessionId: '00000000-0000-0000-0000-000000000001',
        sessionIdHex: '0x00000000000000000000000000000001',
        autoFeatureSBTsBySessionSlug: true,
        defaultFeaturedSBTs: ['0xAAA', '0xbbb'],
        groupCreationPolicy: 'admin_only',
      }),
    );
    expect(metadata).not.toHaveProperty('sessionInfo');
    expect(metadata).not.toHaveProperty('sponsoredSbtAddress');
    expect(metadata).not.toHaveProperty('autoFeatureSBTsWithFeaturedSbtTags');
    expect(draft).toEqual(
      expect.objectContaining({
        sessionName: ' Writers Room ',
        sponsoredSbtAddress: '0xsponsored',
        sessionIdHex: '0xstale',
      }),
    );
  });

  it('clears stale session hex when no valid session id is available', () => {
    expect(
      resolveSessionWizardMetadataPayloadBase({
        draft: {
          slug: 'general',
          sessionIdHex: '0x00000000000000000000000000000001',
        },
        sessionId: '',
      }),
    ).toEqual(
      expect.objectContaining({
        sessionId: '',
      }),
    );
    expect(
      resolveSessionWizardMetadataPayloadBase({
        draft: {
          slug: 'general',
          sessionIdHex: '0x00000000000000000000000000000001',
        },
        sessionId: '',
      }),
    ).not.toHaveProperty('sessionIdHex');
  });
});

describe('applySessionWizardMetadataUploadGuards', () => {
  it('strips secret metadata fields and applies upload-only gate budget descriptors in place', () => {
    const metadata = {
      ai: {
        provider: 'openai',
        mode: 'fast',
        providers: { openai: { apiKey: 'secret' } },
        models: {},
      },
      rpc: { url: 'https://private-rpc.example.test' },
      arweave: { jwk: 'secret-jwk' },
      faucet: {
        privateKey: 'secret-private-key',
        encryptedPrivateKey: 'secret-envelope',
        publicAddress: '0x0000000000000000000000000000000000000001',
      },
      encryptedFields: {
        'arweave.jwk': { ciphertext: 'secret' },
        sessionInfo: { ciphertext: 'public-ish' },
      },
      encryptedFieldGates: {
        sessionInfo: 'gate-public-ish',
      },
      lit: {
        network: 'datil',
      },
      perMemberSpendLimits: {
        arweave: 'existing-arweave-limit',
      },
    };

    const result = applySessionWizardMetadataUploadGuards({
      metadata,
      defaultGateId: 'gate-default',
      gateSelections: {
        ai: { perMemberLimit: '10' },
        txGas: { perMemberLimit: '2' },
      },
    });

    expect(result).toBe(metadata);
    expect(result.ai).toEqual({ models: {} });
    expect(result).not.toHaveProperty('rpc');
    expect(result).not.toHaveProperty('arweave');
    expect(result.faucet).toEqual({
      publicAddress: '0x0000000000000000000000000000000000000001',
    });
    expect(result.encryptedFields).toEqual({
      sessionInfo: { ciphertext: 'public-ish' },
    });
    expect(result.encryptedFieldGates).toEqual({
      sessionInfo: 'gate-public-ish',
    });
    expect(result.lit).toEqual({
      network: 'datil',
      defaultGateId: 'gate-default',
    });
    expect(result.perMemberSpendLimits).toEqual({
      arweave: 'existing-arweave-limit',
      ai: '10',
      txGas: '2',
    });
  });

  it('rejects secret field gates before upload guard stripping can hide them', () => {
    const metadata = {
      encryptedFieldGates: {
        'arweave.jwk': 'gate-secret',
        sessionInfo: 'gate-public-ish',
      },
      arweave: {
        jwk: 'secret-jwk',
      },
    };

    expect(getSessionWizardMetadataSecretFieldGateKeys(metadata)).toEqual(['arweave.jwk']);
    expect(buildSessionWizardSecretFieldGateErrorMessage(['arweave.jwk'])).toBe(
      'Worker secret fields cannot be locked in public metadata: arweave.jwk. Store secrets in the Worker panel instead.',
    );
    expect(() => applySessionWizardMetadataUploadGuards({ metadata })).toThrow(
      'Worker secret fields cannot be locked in public metadata: arweave.jwk. Store secrets in the Worker panel instead.',
    );
    expect(metadata.arweave).toEqual({ jwk: 'secret-jwk' });
  });
});
