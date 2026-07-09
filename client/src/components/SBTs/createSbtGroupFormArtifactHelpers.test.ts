import {
  METADATA_LOCK_FIELDS,
  areMetadataLockGateMapsEqual,
  areStringArraysEqual,
  buildCreateSbtDeferredDraftCreate2Salt,
  buildCreateSbtDocumentUrlAdditionPatch,
  buildCreateSbtDocumentUrlRemovalPatch,
  buildCreateSbtFormCachePayload,
  buildCreateSbtImagePreviewState,
  buildCreateSbtInviteLinks,
  buildCreateSbtJsonPreviewData,
  buildCreateSbtMetadataLockSelectionPatch,
  buildCreateSbtMetadataLockSelectionState,
  buildCreateSbtPasswordExportFile,
  buildEffectiveCreateSbtDocumentUrls,
  createEmptyMetadataLockGateIds,
  generateCreateSbtInviteNonces,
  generateCreateSbtRandomHexString,
  getCanonicalCreateSbtMetadataImageUrl,
  getCreateSbtBurnAuthEnum,
  getCreateSbtValidGateIds,
  getFetchableCreateSbtImageUrl,
  getMetadataFieldLockGateIds,
  normalizeCreateSbtDocumentUrlDraft,
  normalizeCreateSbtMetadataLockGateIdsForValidGates,
  normalizeMetadataLockGateIds,
  removeCreateSbtDocumentUrlAtIndex,
  resolveCreateSbtDocumentUrlInputState,
  resolveCreateSbtEncryptedFieldGateValue,
  resolveCreateSbtInviteCodeList,
  resolveCreateSbtLegacyDescriptionLockGateIds,
  resolveCreateSbtMetadataFieldGateIds,
  resolveCreateSbtMetadataImageSource,
  resolveCreateSbtPasswordGenerationCount,
  resolveCreateSbtPredictablePasswordListDecision,
  resolveCreateSbtRestoredMetadataLockGateIds,
  writeCreateSbtEncryptedFieldGate,
} from './createSbtGroupHelpers';

describe('createSbtGroupFormArtifactHelpers', () => {
  it('normalizes effective document URLs with pending draft limits', () => {
    expect(normalizeCreateSbtDocumentUrlDraft(' https://docs.example/a ')).toBe('https://docs.example/a');
    expect(
      buildEffectiveCreateSbtDocumentUrls({
        documentURLs: [' https://docs.example/a ', '', null, 'https://docs.example/b'],
        documentUrl: ' https://docs.example/c ',
      }),
    ).toEqual(['https://docs.example/a', 'https://docs.example/b', 'https://docs.example/c']);
    expect(
      buildEffectiveCreateSbtDocumentUrls({
        documentURLs: Array.from({ length: 10 }, (_, index) => `https://docs.example/${index}`),
        documentUrl: 'https://docs.example/overflow',
      }),
    ).toHaveLength(10);
    expect(
      buildEffectiveCreateSbtDocumentUrls({
        documentURLs: 'bad',
        documentUrl: '',
      }),
    ).toEqual([]);
    expect(
      resolveCreateSbtDocumentUrlInputState({
        documentURLs: ['https://docs.example/a'],
        documentUrl: ' https://docs.example/b ',
      }),
    ).toEqual({
      canAddDocumentUrl: true,
      documentUrlCount: 1,
    });
    expect(
      resolveCreateSbtDocumentUrlInputState({
        documentURLs: ['https://docs.example/a'],
        documentUrl: '   ',
      }),
    ).toEqual({
      canAddDocumentUrl: false,
      documentUrlCount: 1,
    });
    expect(
      resolveCreateSbtDocumentUrlInputState({
        documentURLs: Array.from({ length: 10 }, (_, index) => `https://docs.example/${index}`),
        documentUrl: 'https://docs.example/overflow',
      }),
    ).toEqual({
      canAddDocumentUrl: false,
      documentUrlCount: 10,
    });
    expect(
      buildCreateSbtDocumentUrlAdditionPatch({
        documentURLs: ['https://docs.example/a'],
        documentUrl: 'https://docs.example/b',
      }),
    ).toEqual({
      documentURLs: ['https://docs.example/a', 'https://docs.example/b'],
      documentUrl: '',
    });
    expect(
      buildCreateSbtDocumentUrlAdditionPatch({
        documentURLs: 'bad',
        documentUrl: 'https://docs.example/a',
      }),
    ).toEqual({
      documentURLs: ['https://docs.example/a'],
      documentUrl: '',
    });
  });

  it('removes document URLs with native splice index behavior', () => {
    expect(removeCreateSbtDocumentUrlAtIndex(['a', 'b', 'c'], 1)).toEqual(['a', 'c']);
    expect(removeCreateSbtDocumentUrlAtIndex(['a', 'b', 'c'], -1)).toEqual(['a', 'b']);
    expect(removeCreateSbtDocumentUrlAtIndex(['a', 'b', 'c'], 'bad')).toEqual(['b', 'c']);
    expect(removeCreateSbtDocumentUrlAtIndex('bad', 0)).toEqual([]);
    expect(
      buildCreateSbtDocumentUrlRemovalPatch({
        documentURLs: ['a', 'b', 'c'],
        index: 1,
      }),
    ).toEqual({
      documentURLs: ['a', 'c'],
    });
  });

  it('builds form cache payloads with serialized distribution and normalized fields', () => {
    const endTime = new Date('2026-01-02T03:04:05.000Z');
    const payload = buildCreateSbtFormCachePayload({
      selectedAuthoringChainId: 11155420,
      effectiveSessionSlug: 'edge-session',
      state: {
        sbtName: '  Edge SBT  ',
        sbtDescription: '  Useful group  ',
        sbtImageUrl: 'https://example.com/sbt.png',
        useImageUrl: true,
        sbtDistribution: {
          type: 'password',
          mintingEndTime: endTime,
          network: 84532,
        },
        tags: ['Alpha'],
        documentIDHashes: ['hash-a'],
        documentURLs: ['https://docs.example/a'],
        documentUrl: ' https://docs.example/pending ',
        groupPassword: 'pw',
        metadataLockGateIds: {
          name: 'gate-a',
          description: ['gate-b'],
          ignored: ['gate-c'],
        },
        predictableAddressEnabled: 'yes',
        autoAppliedDefaultTags: ['Default'],
        dismissedDefaultTags: 'bad',
        numInviteLinks: 3,
        exportFormat: 'csv',
        create2Salt: 'salt-a',
        deferredCreate2Salt: 'salt-b',
      },
    });

    expect(payload).toMatchObject({
      sbtName: 'Edge SBT',
      sbtDescription: 'Useful group',
      sbtImageUrl: 'https://example.com/sbt.png',
      useImageUrl: true,
      tags: ['Alpha'],
      documentIDHashes: ['hash-a'],
      documentURLs: ['https://docs.example/a'],
      documentUrl: 'https://docs.example/pending',
      groupPassword: 'pw',
      predictableAddressEnabled: true,
      autoAppliedDefaultTags: ['Default'],
      dismissedDefaultTags: [],
      numInviteLinks: 3,
      exportFormat: 'csv',
      create2Salt: 'salt-a',
      deferredCreate2Salt: 'salt-b',
      _sessionSlug: 'edge-session',
    });
    expect(payload.sbtDistribution).toEqual({
      type: 'password',
      mintingEndTime: '2026-01-02T03:04:05.000Z',
      network: 11155420,
    });
    expect(payload.metadataLockGateIds).toEqual({
      name: ['gate-a'],
      description: ['gate-b'],
      tags: [],
      documentURLs: [],
      image: [],
    });

    expect(
      buildCreateSbtFormCachePayload({
        state: { sbtName: 'Name', sbtDistribution: { mintingEndTime: '' } },
      }).sbtDistribution.network,
    ).toBe('not connected');
  });

  it('builds CreateSBT JSON preview data with normalized token URI and distribution fields', () => {
    const txId = 'DqYBh1qm9GvaTOGkF5R7abnLoB3OPiXNNBcTsYPtlRc';
    const groupPasswordPreview = buildCreateSbtJsonPreviewData({
      authoringChain: { name: 'OP Sepolia' },
      autoJoinUrl: 'https://app.example/session?sbt=0xabc',
      groupPassword: 'secret',
      network: 'Fallback Network',
      sbtAddress: '0xabc',
      sbtDistribution: {
        distributionOption: 'groupPassword',
      },
      sbtName: 'Preview SBT',
      shareableUrl: 'https://app.example/sbt/0xabc',
      tokenURI: `ar://${txId}`,
    });

    expect(groupPasswordPreview).toMatchObject({
      sbtName: 'Preview SBT',
      sbtAddress: '0xabc',
      network: 'OP Sepolia',
      distribution: 'groupPassword',
      groupPassword: 'secret',
      autoJoinUrl: 'https://app.example/session?sbt=0xabc',
      shareableUrl: 'https://app.example/sbt/0xabc',
    });
    expect(String(groupPasswordPreview.tokenURI)).toContain(txId);
    expect(String(groupPasswordPreview.tokenURI)).toMatch(/^https:\/\//);

    expect(
      buildCreateSbtJsonPreviewData({
        network: 'Base Sepolia',
        sbtDistribution: {
          distributionOption: 'open',
        },
        tokenURI: 'https://example.test/token.json',
      }),
    ).toEqual({
      sbtName: '',
      sbtAddress: '',
      tokenURI: 'https://example.test/token.json',
      network: 'Base Sepolia',
      distribution: 'open',
      groupPassword: undefined,
      autoJoinUrl: '',
      shareableUrl: '',
    });
  });

  it('builds CreateSBT metadata lock selection state from gate options', () => {
    expect(
      buildCreateSbtMetadataLockSelectionState({
        gateOptions: [{ id: 'gate-a' }, { id: '' }, { id: 'gate-b' }],
        metadataLockGateIds: {
          name: ['gate-a', 'missing'],
          description: 'gate-b',
          tags: ['missing'],
          documentURLs: ['gate-a', 'gate-b'],
          image: null,
        },
      }),
    ).toEqual({
      validGateIds: ['gate-a', 'gate-b'],
      nameSelectedGateIds: ['gate-a'],
      descriptionSelectedGateIds: ['gate-b'],
      tagsSelectedGateIds: [],
      docsSelectedGateIds: ['gate-a', 'gate-b'],
      imageSelectedGateIds: [],
    });
    expect(
      buildCreateSbtMetadataLockSelectionState({
        metadataLockGateIds: {
          name: ['gate-a'],
        },
      }),
    ).toMatchObject({
      validGateIds: [],
      nameSelectedGateIds: ['gate-a'],
    });
  });

  it('builds CreateSBT image preview status state', () => {
    const previewFile = { name: 'badge.png' };
    expect(
      buildCreateSbtImagePreviewState({
        sbtImageFile: previewFile,
      }),
    ).toMatchObject({
      effectiveImageStatusText: '',
      effectiveImageStatusTone: 'default',
      hasImagePreview: true,
      hasPendingImagePreview: false,
      previewFile,
      showImagePreviewError: false,
    });
    expect(
      buildCreateSbtImagePreviewState({
        sbtImageUrl: ' https://example.test/badge.png ',
        useImageUrl: true,
      }),
    ).toMatchObject({
      effectiveImageStatusText: 'Loading preview...',
      effectiveImageStatusTone: 'loading',
      hasImagePreview: false,
      hasPendingImagePreview: true,
      previewFile: null,
      showImagePreviewError: false,
    });
    expect(
      buildCreateSbtImagePreviewState({
        imageLoadError: true,
        sbtImageUrl: 'https://example.test/bad.png',
        useImageUrl: true,
      }),
    ).toMatchObject({
      effectiveImageStatusText: 'Image preview unavailable.',
      effectiveImageStatusTone: 'error',
      hasImagePreview: false,
      hasPendingImagePreview: false,
      showImagePreviewError: true,
    });
    expect(
      buildCreateSbtImagePreviewState({
        imageChooserStatusText: 'Custom status',
        imageChooserStatusTone: 'error',
        sbtImageUrl: 'https://example.test/badge.png',
        useImageUrl: true,
      }),
    ).toMatchObject({
      effectiveImageStatusText: 'Custom status',
      effectiveImageStatusTone: 'error',
      hasPendingImagePreview: true,
    });
  });

  it('maps burn auth labels to contract enum values', () => {
    expect(getCreateSbtBurnAuthEnum('AdminOnly')).toBe(0);
    expect(getCreateSbtBurnAuthEnum('OwnerOnly')).toBe(1);
    expect(getCreateSbtBurnAuthEnum('Both')).toBe(2);
    expect(getCreateSbtBurnAuthEnum('Neither')).toBe(3);
    expect(() => getCreateSbtBurnAuthEnum('bad')).toThrow('Unsupported burnAuth value: bad');
  });

  it('builds CreateSBT password export files', () => {
    expect(
      buildCreateSbtPasswordExportFile({
        autoJoinUrl: 'https://app.example/session?sbt=0xabc&auto=1',
        date: '2026-05-05',
        exportFormat: 'json',
        passwordList: ['pw1', 'pw2'],
        sbtDistribution: { isLimited: false },
        sbtInviteLinks: ['https://app.example/sbt/0xabc/pw1'],
        sbtName: 'Alpha',
        sbtSymbol: 'ALP',
      }),
    ).toEqual({
      content: JSON.stringify(
        [
          {
            index: 0,
            password: 'pw1',
            inviteLink: 'https://app.example/sbt/0xabc/pw1',
          },
          {
            index: 1,
            password: 'pw2',
            inviteLink: 'https://app.example/session?sbt=0xabc&auto=1',
          },
        ],
        null,
        2,
      ),
      fileName: 'ALP_Alpha_passwords_2026-05-05.json',
      mimeType: 'application/json',
    });

    expect(
      buildCreateSbtPasswordExportFile({
        autoJoinUrl: 'fallback',
        date: '2026-05-05',
        exportFormat: 'csv',
        passwordList: ['gp1'],
        sbtDistribution: { isLimited: true, distributionOption: 'groupPassword' },
        sbtInviteLinks: [],
        sbtName: 'Beta',
        sbtSymbol: 'BET',
      }),
    ).toEqual({
      content: 'index,groupPassword,inviteLink\n0,gp1,fallback',
      fileName: 'BET_Beta_group-passwords_2026-05-05.csv',
      mimeType: 'text/csv',
    });

    expect(
      buildCreateSbtPasswordExportFile({
        exportFormat: 'txt',
        passwordList: ['unused'],
      }),
    ).toEqual({
      content: '',
      fileName: '',
      mimeType: 'text/csv',
    });
  });

  it('builds CreateSBT invite links for password and group-password flows', () => {
    expect(
      buildCreateSbtInviteLinks({
        base: 'https://app.example',
        detailPath: '/sbt/0xabc?session=alpha',
        passwordList: ['pw 1', 'pw/2'],
      }),
    ).toEqual([
      'https://app.example/sbt/0xabc/pw%201?session=alpha',
      'https://app.example/sbt/0xabc/pw%2F2?session=alpha',
    ]);

    expect(
      buildCreateSbtInviteLinks({
        base: 'https://app.example',
        demoPath: '/session/alpha',
        encodeGroupPassword: (code) => `encoded:${code}`,
        isInvite: true,
        passwordList: ['group code'],
        sbtAddress: '0xABC',
      }),
    ).toEqual(['https://app.example/session/alpha?auto=1&sbt=0xABC&gp=encoded%3Agroup%20code']);
    expect(
      resolveCreateSbtInviteCodeList({
        listOverride: ['override', 0],
        passwordList: ['state'],
      }),
    ).toEqual(['override', '']);
    expect(
      resolveCreateSbtInviteCodeList({
        listOverride: [],
        passwordList: ['state', null],
      }),
    ).toEqual(['state', '']);
  });

  it('resolves CreateSBT password generation counts', () => {
    expect(
      resolveCreateSbtPasswordGenerationCount({
        numInviteLinks: 7,
        sbtDistribution: { isLimited: true, limitedNumber: 3 },
      }),
    ).toBe(3);
    expect(
      resolveCreateSbtPasswordGenerationCount({
        numInviteLinks: 7.8,
        sbtDistribution: { isLimited: true, limitedNumber: 0 },
      }),
    ).toBe(7);
    expect(
      resolveCreateSbtPasswordGenerationCount({
        numInviteLinks: 'bad',
        sbtDistribution: { isLimited: false, limitedNumber: 4 },
      }),
    ).toBe(0);
    expect(
      resolveCreateSbtPasswordGenerationCount({
        numInviteLinks: -2,
        sbtDistribution: null,
      }),
    ).toBe(0);
    expect(
      resolveCreateSbtPredictablePasswordListDecision({
        usesClaimCodes: false,
      }),
    ).toEqual({
      passwordListPatch: null,
      returnValue: [],
      shouldUpdatePasswordList: false,
    });
    expect(
      resolveCreateSbtPredictablePasswordListDecision({
        passwordList: ['pw1', '', 'pw2'],
        targetCount: 2,
        usesClaimCodes: true,
      }),
    ).toEqual({
      passwordListPatch: null,
      returnValue: ['pw1', 'pw2'],
      shouldUpdatePasswordList: false,
    });
    expect(
      resolveCreateSbtPredictablePasswordListDecision({
        generatePassword: (length) => `pw-${length}`,
        passwordList: ['pw1'],
        targetCount: 3,
        usesClaimCodes: true,
      }),
    ).toEqual({
      passwordListPatch: ['pw-32', 'pw-32', 'pw-32'],
      returnValue: null,
      shouldUpdatePasswordList: true,
    });
    expect(
      resolveCreateSbtPredictablePasswordListDecision({
        allowStateMutation: false,
        generatePassword: () => 'unused',
        passwordList: [],
        targetCount: 1,
        usesClaimCodes: true,
      }),
    ).toEqual({
      passwordListPatch: null,
      returnValue: null,
      shouldUpdatePasswordList: false,
    });
  });

  it('generates CreateSBT random hex strings from injected sources', () => {
    expect(
      generateCreateSbtRandomHexString({
        length: 5,
        getRandomValues: (arr) => {
          arr[0] = 0xab;
          arr[1] = 0xcd;
          arr[2] = 0xef;
          return arr;
        },
        randomBytes: () => {
          throw new Error('fallback should not run');
        },
      }),
    ).toBe('abcde');

    expect(
      generateCreateSbtRandomHexString({
        length: 4,
        randomBytes: () => [1, 2],
      }),
    ).toBe('0102');

    expect(
      generateCreateSbtRandomHexString({
        length: 'bad',
        randomBytes: () => [255],
      }),
    ).toBe('');
  });

  it('builds deferred draft CREATE2 salts from injected random bytes', () => {
    expect(
      buildCreateSbtDeferredDraftCreate2Salt({
        randomBytes: (length) => Array.from({ length }, (_, index) => index),
      }),
    ).toBe('draft/000102030405060708090a0b0c0d0e0f');

    expect(
      buildCreateSbtDeferredDraftCreate2Salt({
        prefix: 'pending/',
        randomBytes: () => [0xab, 0xcd, 0xef],
      }),
    ).toBe('pending/abcdef');
  });

  it('generates CreateSBT invite nonces from injected sources', () => {
    let browserCall = 0;
    expect(
      generateCreateSbtInviteNonces({
        bytesToNonce: (bytes) => `nonce-${Array.from(bytes)[0]}`,
        count: 2,
        getRandomValues: (arr) => {
          browserCall += 1;
          arr.fill(browserCall);
          return arr;
        },
        randomBytes: () => {
          throw new Error('fallback should not run');
        },
      }),
    ).toEqual(['nonce-1', 'nonce-2']);

    let fallbackCall = 4;
    expect(
      generateCreateSbtInviteNonces({
        bytesToNonce: (bytes) => `nonce-${Array.from(bytes)[0]}`,
        count: '2.9',
        randomBytes: () => {
          fallbackCall += 1;
          return new Uint8Array(12).fill(fallbackCall);
        },
      }),
    ).toEqual(['nonce-5', 'nonce-6']);

    expect(
      generateCreateSbtInviteNonces({
        count: 'bad',
        randomBytes: () => new Uint8Array(12).fill(9),
      }),
    ).toEqual([]);
  });

  it('normalizes CreateSBT image URLs for preview fetching and metadata', () => {
    const txId = 'a'.repeat(43);

    expect(getFetchableCreateSbtImageUrl(` ${txId} `)).toMatch(/^https?:\/\//);
    expect(getFetchableCreateSbtImageUrl('ftp://example.com/image.png')).toBe('');
    expect(getFetchableCreateSbtImageUrl('not a url')).toBe('');
    expect(getCanonicalCreateSbtMetadataImageUrl(` ${txId} `)).toBe(`ar://${txId}`);
    expect(getCanonicalCreateSbtMetadataImageUrl(`https://arweave.net/${txId}`)).toBe(`https://arweave.net/${txId}`);
    expect(getCanonicalCreateSbtMetadataImageUrl('')).toBe('');
    expect(
      resolveCreateSbtMetadataImageSource({
        defaultImageUrl: 'default',
        getCanonicalMetadataImageUrl: (value) =>
          String(value || '')
            .trim()
            .toUpperCase(),
        sbtImageUrl: ' explicit ',
        useImageUrl: false,
      }),
    ).toBe('EXPLICIT');
    expect(
      resolveCreateSbtMetadataImageSource({
        defaultImageUrl: 'default',
        getCanonicalMetadataImageUrl: (value) =>
          String(value || '')
            .trim()
            .toUpperCase(),
        sbtImageUrl: '',
        useImageUrl: true,
      }),
    ).toBe('DEFAULT');
    expect(
      resolveCreateSbtMetadataImageSource({
        defaultImageUrl: ' default ',
        getCanonicalMetadataImageUrl: (value) =>
          String(value || '')
            .trim()
            .toUpperCase(),
        sbtImageUrl: '',
      }),
    ).toBe('DEFAULT');
  });

  it('compares string arrays without normalizing order', () => {
    const shared = ['a'];

    expect(areStringArraysEqual(shared, shared)).toBe(true);
    expect(areStringArraysEqual(['a', 2], ['a', '2'])).toBe(true);
    expect(areStringArraysEqual(['a', 'b'], ['b', 'a'])).toBe(false);
    expect(areStringArraysEqual(['a'], null as unknown as unknown[])).toBe(false);
  });

  it('normalizes metadata lock gate id maps by supported field', () => {
    expect(METADATA_LOCK_FIELDS).toEqual(['name', 'description', 'tags', 'documentURLs', 'image']);
    expect(createEmptyMetadataLockGateIds()).toEqual({
      name: [],
      description: [],
      tags: [],
      documentURLs: [],
      image: [],
    });
    const normalized = normalizeMetadataLockGateIds({
      name: [' gate-a ', ''],
      description: 'gate-b',
      ignored: ['gate-c'],
    });

    expect(normalized).toEqual({
      name: ['gate-a'],
      description: ['gate-b'],
      tags: [],
      documentURLs: [],
      image: [],
    });
    expect(getMetadataFieldLockGateIds(normalized, 'name')).toEqual(['gate-a']);
    expect(areMetadataLockGateMapsEqual(normalized, { ...normalized })).toBe(true);
    expect(
      areMetadataLockGateMapsEqual(normalized, {
        ...normalized,
        name: ['gate-other'],
      }),
    ).toBe(false);
    expect(
      normalizeCreateSbtMetadataLockGateIdsForValidGates(
        {
          name: ['gate-a', 'missing'],
          description: 'gate-b',
          tags: ['missing'],
          documentURLs: ['gate-a', 'gate-b'],
          image: null,
        },
        ['gate-a', 'gate-b'],
      ),
    ).toEqual({
      name: ['gate-a'],
      description: ['gate-b'],
      tags: [],
      documentURLs: ['gate-a', 'gate-b'],
      image: [],
    });
    expect(
      buildCreateSbtMetadataLockSelectionPatch({
        fieldKey: 'tags',
        metadataLockGateIds: normalized,
        openLockKey: 'tags-lock',
        selectedGateIds: ['gate-b', 'missing'],
        validGateIds: ['gate-a', 'gate-b'],
      }),
    ).toEqual({
      metadataLockGateIds: {
        ...normalized,
        tags: ['gate-b'],
      },
      openLockKey: 'tags-lock',
    });
    expect(
      buildCreateSbtMetadataLockSelectionPatch({
        fieldKey: 'name',
        metadataLockGateIds: normalized,
        openLockKey: 'name-lock',
        selectedGateIds: ['missing'],
        validGateIds: ['gate-a'],
      }),
    ).toEqual({
      metadataLockGateIds: {
        ...normalized,
        name: [],
      },
      openLockKey: '',
    });
  });

  it('resolves metadata field gate ids against known gate options', () => {
    expect(
      resolveCreateSbtMetadataFieldGateIds({
        fieldKey: 'name',
        lockMap: { name: ['gate-a', 'gate-b'] },
        validGateIds: ['gate-b', 'gate-a'],
      }),
    ).toEqual(['gate-a', 'gate-b']);
    expect(
      resolveCreateSbtMetadataFieldGateIds({
        fieldKey: 'description',
        lockMap: { description: 'gate-a' },
        validGateIds: ['gate-a'],
      }),
    ).toEqual(['gate-a']);
    expect(
      resolveCreateSbtMetadataFieldGateIds({
        fieldKey: 'tags',
        lockMap: { tags: [] },
        validGateIds: [],
      }),
    ).toEqual([]);
    expect(() =>
      resolveCreateSbtMetadataFieldGateIds({
        fieldKey: 'image',
        gatesLowerLabel: 'locks',
        lockMap: { image: ['gate-a', 'missing-gate'] },
        validGateIds: ['gate-a'],
      }),
    ).toThrow('image encryption locks could not be resolved. Please reselect the lock or configure valid locks.');
  });

  it('resolves encrypted field gate values with scalar and array shapes', () => {
    expect(
      resolveCreateSbtEncryptedFieldGateValue({
        selectedGateIds: ['gate-a'],
        validGateIds: ['gate-a', 'gate-b'],
      }),
    ).toBe('gate-a');
    expect(
      resolveCreateSbtEncryptedFieldGateValue({
        selectedGateIds: ['gate-a', 'gate-b'],
        validGateIds: ['gate-b', 'gate-a'],
      }),
    ).toEqual(['gate-a', 'gate-b']);
    expect(
      resolveCreateSbtEncryptedFieldGateValue({
        selectedGateIds: ['missing'],
        validGateIds: ['gate-a'],
      }),
    ).toBeNull();
    expect(
      resolveCreateSbtEncryptedFieldGateValue({
        selectedGateIds: ['gate-a'],
        validGateIds: [],
      }),
    ).toBe('gate-a');

    const fieldGates: Record<string, unknown> = {};
    expect(
      writeCreateSbtEncryptedFieldGate({
        fieldKey: 'name',
        selectedGateIds: ['gate-a'],
        target: fieldGates,
        validGateIds: ['gate-a', 'gate-b'],
      }),
    ).toBe(true);
    expect(fieldGates).toEqual({ name: 'gate-a' });
    expect(
      writeCreateSbtEncryptedFieldGate({
        fieldKey: 'tags',
        selectedGateIds: ['gate-a', 'gate-b'],
        target: fieldGates,
        validGateIds: ['gate-a', 'gate-b'],
      }),
    ).toBe(true);
    expect(fieldGates.tags).toEqual(['gate-a', 'gate-b']);
    expect(
      writeCreateSbtEncryptedFieldGate({
        fieldKey: 'image',
        selectedGateIds: ['missing'],
        target: fieldGates,
        validGateIds: ['gate-a'],
      }),
    ).toBe(false);
    expect(fieldGates.image).toBeUndefined();
  });

  it('restores metadata lock gate ids from cached and legacy payload fields', () => {
    const gateOptions = [
      { id: 'gate-a', sbtAddresses: ['0xAAA'] },
      { id: 'gate-b', sbtAddresses: ['0xBBB'] },
      { id: 'gate-c', sbtAddresses: ['0xAAA', '0xCCC'] },
      { label: 'missing id', sbtAddresses: ['0xDDD'] },
    ];

    expect(getCreateSbtValidGateIds(gateOptions)).toEqual(['gate-a', 'gate-b', 'gate-c']);
    expect(
      resolveCreateSbtLegacyDescriptionLockGateIds({
        parsed: { descriptionGateSBTs: [{ address: ' 0xaaa ' }, '0xBBB'] },
        gateOptions,
      }),
    ).toEqual(['gate-a', 'gate-b']);

    expect(
      resolveCreateSbtRestoredMetadataLockGateIds({
        parsed: {
          metadataLockGateIds: { name: ['name-gate'], description: ['cached-description'] },
          descriptionLockGateIds: ['legacy-description'],
          tagsLockGateIds: ['tags-gate'],
          docsLockGateIds: 'docs-gate',
        },
        gateOptions,
      }),
    ).toEqual({
      name: ['name-gate'],
      description: ['cached-description'],
      tags: ['tags-gate'],
      documentURLs: ['docs-gate'],
      image: [],
    });

    expect(
      resolveCreateSbtRestoredMetadataLockGateIds({
        parsed: {
          descriptionGateSBTs: ['0xbbb'],
        },
        gateOptions,
      }).description,
    ).toEqual(['gate-b']);
  });
});
