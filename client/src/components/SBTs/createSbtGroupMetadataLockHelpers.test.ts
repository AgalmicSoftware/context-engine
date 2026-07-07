import {
  areMetadataLockGateMapsEqual,
  areStringArraysEqual,
  buildCreateSbtMetadataLockSelectionState,
  createEmptyMetadataLockGateIds,
  getCreateSbtValidGateIds,
  getMetadataFieldLockGateIds,
  METADATA_LOCK_FIELDS,
  normalizeCreateSbtMetadataLockGateIdsForValidGates,
  normalizeMetadataLockGateIds,
  resolveCreateSbtEncryptedFieldGateValue,
  resolveCreateSbtLegacyDescriptionLockGateIds,
  resolveCreateSbtMetadataFieldGateIds,
  resolveCreateSbtRestoredMetadataLockGateIds,
  writeCreateSbtEncryptedFieldGate,
} from './createSbtGroupMetadataLockHelpers';

describe('createSbtGroupMetadataLockHelpers', () => {
  it('normalizes metadata lock gate id maps by supported field', () => {
    expect(METADATA_LOCK_FIELDS).toEqual(['name', 'description', 'tags', 'documentURLs', 'image']);
    expect(createEmptyMetadataLockGateIds()).toEqual({
      name: [],
      description: [],
      tags: [],
      documentURLs: [],
      image: [],
    });
    expect(areStringArraysEqual(['a', 'b'], ['a', 'b'])).toBe(true);
    expect(areStringArraysEqual(['a', 'b'], ['b', 'a'])).toBe(false);

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
  });

  it('builds metadata lock selection state from gate options', () => {
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
