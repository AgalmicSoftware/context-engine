import {
  buildCreateSbtEncryptedImageAsset,
  buildCreateSbtFieldAccessDescriptor,
  buildCreateSbtGateObjectsAndRecipients,
  buildCreateSbtGateOptionsFromConfig,
  buildCreateSbtGateOptionsFromSessionSources,
  buildCreateSbtMetadataEncryption,
  buildCreateSbtPreviewEncryptedImageAsset,
  buildCreateSbtRecipientAccessControlState,
  normalizeCreateSbtLitGateChainIdFallback,
  requireCreateSbtRecipientsForGateSelection,
  resolveCreateSbtLitGateChainId,
  sanitizeCreateSbtGateForMetadata,
  stableGateColor,
} from './createSbtGroupHelpers';

describe('createSbtGroupMetadataGateHelpers', () => {
  it('normalizes Lit gate chain id fallbacks', () => {
    expect(normalizeCreateSbtLitGateChainIdFallback(84532)).toBe(84532);
    expect(normalizeCreateSbtLitGateChainIdFallback(' 11155420 ')).toBe('11155420');
    expect(normalizeCreateSbtLitGateChainIdFallback('  ')).toBeNull();
    expect(normalizeCreateSbtLitGateChainIdFallback({})).toBeNull();
    expect(resolveCreateSbtLitGateChainId('10', '84532')).toBe(10);
    expect(resolveCreateSbtLitGateChainId('', '84532')).toBe(84532);
    expect(resolveCreateSbtLitGateChainId('', 'not-number')).toBe('not-number');
  });

  it('sanitizes metadata lock gates without leaking raw gate fields', () => {
    const sanitized = sanitizeCreateSbtGateForMetadata({
      gateId: ' gate-a ',
      label: ' Alpha Gate ',
      badgeLabel: ' Badge ',
      secondaryLabel: ' Secondary ',
      resourceKey: ' ai ',
      color: '',
      mode: 'all',
      sbtAddresses: [' 0xA ', '0xa'],
      sbtAddress: '0xB',
      chainId: '84532',
      extraRawField: 'hidden',
    });

    expect(sanitized).toEqual({
      type: 'sbt',
      gateId: 'gate-a',
      id: 'gate-a',
      label: 'Alpha Gate',
      displayLabel: 'Alpha Gate',
      badgeLabel: 'Badge',
      secondaryLabel: 'Secondary',
      resourceKey: 'ai',
      color: stableGateColor('gate-a'),
      mode: 'all',
      requireAll: true,
      sbtAddresses: ['0xA', '0xB'],
      sbtAddress: '0xA',
      chainId: 84532,
      litChain: 'baseSepolia',
    });
    expect(sanitizeCreateSbtGateForMetadata({ gateId: 'gate-a' })).toBeNull();
    expect(sanitizeCreateSbtGateForMetadata({ sbtAddress: '0xA' })).toBeNull();
  });

  it('builds resolved metadata lock gates and deduped Lit recipients', () => {
    const addressA = '0x00000000000000000000000000000000000000aa';
    const addressB = '0x00000000000000000000000000000000000000bb';

    const result = buildCreateSbtGateObjectsAndRecipients({
      chainIdFallback: 84532,
      gateIds: ['gate-b', 'missing', 'gate-a', 'gate-duplicate'],
      gateMap: {
        'gate-a': {
          label: 'Alpha',
          sbtAddresses: [addressA, addressA.toUpperCase()],
          sbtAddress: addressB,
          mode: 'all',
        },
        'gate-b': {
          name: 'Beta',
          color: '#123456',
          sbtAddress: addressB,
          chainId: '11155420',
        },
        'gate-duplicate': {
          label: 'Alpha Copy',
          sbtAddress: addressB,
          chainId: '11155420',
        },
        skipped: { label: 'Skipped' },
      },
    });

    expect(result.gates.map((gate) => gate.gateId)).toEqual(['gate-b', 'gate-a', 'gate-duplicate']);
    expect(result.gates[0]).toMatchObject({
      gateId: 'gate-b',
      id: 'gate-b',
      label: 'Beta',
      color: '#123456',
      sbtAddresses: [addressB],
      sbtAddress: addressB,
      chainId: 11155420,
      litChain: 'optimismSepolia',
      mode: 'any',
      type: 'sbt',
    });
    expect(result.gates[1]).toMatchObject({
      gateId: 'gate-a',
      label: 'Alpha',
      sbtAddresses: [addressA, addressB],
      chainId: 84532,
      litChain: 'baseSepolia',
      mode: 'all',
    });
    expect(result.recipients).toHaveLength(2);
    expect(result.recipients[0]).toMatchObject({
      chain: 'optimismSepolia',
      accessControlConditions: [
        {
          contractAddress: addressB,
          chain: 'optimismSepolia',
          method: 'balanceOf',
        },
      ],
    });
    expect(result.recipients[1].accessControlConditions).toEqual([
      expect.objectContaining({ contractAddress: addressA, chain: 'baseSepolia' }),
      { operator: 'and' },
      expect.objectContaining({ contractAddress: addressB, chain: 'baseSepolia' }),
    ]);
  });

  it('requires Lit recipients when metadata lock gates are selected', () => {
    expect(() =>
      requireCreateSbtRecipientsForGateSelection({
        gateIds: ['gate-1'],
        recipients: [],
        scopeLabel: 'content',
        gateLowerLabel: 'access rule',
        gatesLowerLabel: 'access rules',
      }),
    ).toThrow('Selected lock access rule (gate-1) for content do not resolve to valid Lit recipients.');

    expect(() =>
      requireCreateSbtRecipientsForGateSelection({
        gateIds: ['gate-1', 'gate-2'],
        recipients: [],
        scopeLabel: 'image',
        gateLowerLabel: 'access rule',
        gatesLowerLabel: 'access rules',
      }),
    ).toThrow('Selected lock access rules (gate-1, gate-2) for image do not resolve to valid Lit recipients.');

    expect(() =>
      requireCreateSbtRecipientsForGateSelection({
        gateIds: [],
        recipients: [],
      }),
    ).not.toThrow();
    expect(() =>
      requireCreateSbtRecipientsForGateSelection({
        gateIds: ['gate-1'],
        recipients: [{ accessControlConditions: [] }],
      }),
    ).not.toThrow();
  });

  it('merges recipient access control conditions while preserving primary fallback fields', () => {
    const conditionA = { contractAddress: '0x00000000000000000000000000000000000000aa' };
    const conditionB = { contractAddress: '0x00000000000000000000000000000000000000bb' };

    expect(
      buildCreateSbtRecipientAccessControlState({
        recipients: [
          { accessControlConditions: [conditionA], chain: 'baseSepolia' },
          { accessControlConditions: 'bad', chain: 'ignored' },
          { accessControlConditions: [conditionB], chain: 'optimismSepolia' },
        ],
      }),
    ).toEqual({
      combinedAccessControlConditions: [conditionA, { operator: 'or' }, conditionB],
      primaryAccessControlConditions: [conditionA],
      primaryChain: 'baseSepolia',
      primaryRecipient: {
        accessControlConditions: [conditionA],
        chain: 'baseSepolia',
      },
    });

    expect(
      buildCreateSbtRecipientAccessControlState({
        recipients: ['bad', { accessControlConditions: [conditionB], chain: 'optimismSepolia' }],
      }),
    ).toEqual({
      combinedAccessControlConditions: [conditionB],
      primaryAccessControlConditions: undefined,
      primaryChain: null,
      primaryRecipient: {},
    });
  });

  it('builds encrypted image asset metadata from upload results and preview masks', () => {
    expect(
      buildCreateSbtEncryptedImageAsset({
        uploadResult: { txId: '  arweaveTx123  ' },
      }),
    ).toEqual({
      storage: 'lit-arweave',
      txId: 'arweaveTx123',
    });
    expect(
      buildCreateSbtEncryptedImageAsset({
        uploadResult: { txId: '   ' },
      }),
    ).toBeNull();
    expect(buildCreateSbtEncryptedImageAsset()).toBeNull();
    expect(buildCreateSbtPreviewEncryptedImageAsset('[encrypted]')).toEqual({
      storage: 'lit-arweave',
      txId: '[encrypted]',
    });
  });

  it('builds field access descriptors from selected lock gates', () => {
    const descriptor = buildCreateSbtFieldAccessDescriptor({
      chainIdFallback: 84532,
      gateIds: ['missing', 'gate-a', 'gate-b'],
      gateMap: {
        'gate-a': {
          gateId: 'gate-a',
          label: 'Alpha',
          sbtAddresses: ['0x00000000000000000000000000000000000000aa', '0x00000000000000000000000000000000000000aa'],
        },
        'gate-b': {
          gateId: 'gate-b',
          label: 'Beta',
          sbtAddress: '0x00000000000000000000000000000000000000bb',
          chainId: '11155420',
        },
      },
    });

    expect(descriptor).toMatchObject({
      type: 'sbt',
      gateIds: ['gate-a', 'gate-b'],
      sbtAddresses: ['0x00000000000000000000000000000000000000aa', '0x00000000000000000000000000000000000000bb'],
      sbtAddress: '0x00000000000000000000000000000000000000aa',
      chainId: 84532,
      litChain: 'baseSepolia',
    });
    expect(descriptor?.gates.map((gate) => gate.gateId)).toEqual(['gate-a', 'gate-b']);
    expect(
      buildCreateSbtFieldAccessDescriptor({
        gateIds: ['missing'],
        gateMap: { 'gate-a': { gateId: 'gate-a', sbtAddress: '0xA' } },
      }),
    ).toBeNull();
    expect(
      buildCreateSbtFieldAccessDescriptor({
        gateIds: ['gate-a'],
        gateMap: { 'gate-a': { gateId: 'gate-a' } },
      }),
    ).toBeNull();
  });

  it('builds metadata encryption envelopes from selected field gates', () => {
    const gateMap = {
      'gate-a': {
        gateId: 'gate-a',
        label: 'Alpha',
        sbtAddress: '0x00000000000000000000000000000000000000aa',
      },
      'gate-b': {
        gateId: 'gate-b',
        label: 'Beta',
        sbtAddress: '0x00000000000000000000000000000000000000bb',
      },
    };

    const payload = buildCreateSbtMetadataEncryption({
      chainIdFallback: 84532,
      defaultGateId: 'gate-b',
      encryptedFieldGates: {
        name: 'gate-a',
        description: ['gate-a', 'gate-b'],
        tags: ['missing'],
      },
      gateMap,
    });

    expect(payload.encryptedFieldGates).toEqual({
      name: 'gate-a',
      description: ['gate-a', 'gate-b'],
    });
    expect(payload.encryption).toMatchObject({
      enabled: true,
      status: 'lit-v1',
      defaultGateId: 'gate-b',
      gateIds: ['gate-a', 'gate-b'],
      targets: {
        name: true,
        description: true,
      },
    });
    expect(payload.encryption?.gates.map((gate) => gate.gateId)).toEqual(['gate-a', 'gate-b']);
    expect(
      buildCreateSbtMetadataEncryption({
        encryptedFieldGates: { name: ['missing'] },
        gateMap,
      }),
    ).toEqual({
      encryptedFieldGates: null,
      encryption: null,
    });
  });

  it('builds metadata gate options from explicit gates and canonical defaults', () => {
    const explicit = buildCreateSbtGateOptionsFromConfig({
      chainIdFallback: 84532,
      defaultGateId: 'gate-b',
      encryptionGates: [
        {
          id: 'gate-a',
          resourceKey: 'ai',
          sbtAddress: '0xA',
          mode: 'any',
        },
        {
          gateId: 'gate-b',
          secondaryLabel: 'surveyResponses',
          sbtAddresses: ['0xB', '0xC'],
          requireAll: true,
          chainId: 11155420,
        },
      ],
      sessionConfig: { sessionName: 'Alpha Session' },
    });

    expect(Object.keys(explicit.gateMap)).toEqual(['gate-a', 'gate-b']);
    expect(explicit.defaultGateId).toBe('gate-b');
    expect(explicit.gateOptions).toEqual([
      expect.objectContaining({
        id: 'gate-b',
        label: 'Alpha Session',
        secondaryLabel: '',
        sbtAddresses: ['0xB', '0xC'],
        requireAll: true,
        chainId: 11155420,
      }),
    ]);
    expect(explicit.gateMap['gate-b'].secondaryLabel).toBe('survey');

    const configuredDefault = buildCreateSbtGateOptionsFromConfig({
      chainIdFallback: 84532,
      sessionConfig: {
        slug: 'beta',
        sponsored: {
          defaultGateId: 'gate-default',
          gates: {
            'gate-ai': {
              gateId: 'gate-ai',
              resourceKey: 'ai',
              sbtAddress: '0xA',
            },
            'gate-default': {
              gateId: 'gate-default',
              resourceKey: 'default',
              sbtAddress: '0xD',
            },
          },
        },
      },
    });

    expect(configuredDefault.defaultGateId).toBe('gate-default');
    expect(configuredDefault.gateOptions).toEqual([
      expect.objectContaining({
        id: 'gate-default',
        label: 'beta',
        sbtAddress: '0xD',
      }),
    ]);
  });

  it('builds scoped metadata gate options from session sources', () => {
    const scoped = buildCreateSbtGateOptionsFromSessionSources({
      preferredSessionSlug: 'beta',
      chainIdFallback: 84532,
      sessionSources: [
        {
          sessionSlug: 'alpha',
          sessionConfig: { slug: 'alpha', sessionName: 'Alpha Session', networkChainId: 84532 },
          encryptionGates: [{ gateId: 'gate-a', sbtAddress: '0xA', resourceKey: 'default' }],
        },
        {
          sessionSlug: 'beta',
          sessionConfig: { slug: 'beta', sessionName: 'Beta Session', networkChainId: 11155420 },
          encryptionGates: [{ gateId: 'gate-b', sbtAddresses: ['0xB', '0xC'], mode: 'all' }],
        },
      ],
    });

    expect(scoped.defaultGateId).toBe('session:beta::gate-b');
    expect(scoped.gateOptions.map((gate) => gate.id)).toEqual(['session:alpha::gate-a', 'session:beta::gate-b']);
    expect(scoped.gateMap['session:beta::gate-b']).toEqual(
      expect.objectContaining({
        sourceGateId: 'gate-b',
        sourceSessionSlug: 'beta',
        label: 'Beta Session',
        requireAll: true,
        sbtAddresses: ['0xB', '0xC'],
        chainId: 11155420,
      }),
    );
    expect(
      buildCreateSbtGateOptionsFromSessionSources({
        sessionSources: [null, { sessionConfig: null }],
      }),
    ).toEqual({
      gateMap: {},
      gateOptions: [],
      defaultGateId: '',
    });
  });
});
