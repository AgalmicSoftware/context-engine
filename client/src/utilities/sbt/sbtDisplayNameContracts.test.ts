import {
  SBT_MASKED_FIELD_VALUE,
  buildSbtDisplayCacheEntry,
  buildSbtDisplayInflightLookupKey,
  buildSbtDisplayLabelMemoKey,
  buildSbtDisplayRetryStateKey,
  getLegacySbtEncryptedFieldKeys,
  getSbtDisplayAddressLower,
  getSbtMetadataDescriptionText,
  getSbtMetadataDisplayNameValue,
  isSbtDisplayMetadataRecord,
  isSbtMetadataFieldLocked,
  normalizeSbtDisplayChainId,
  resolveSbtDisplayRetryAllowed,
  resolveSbtMetadataLookupDecision,
  resolveSbtCacheEntryChainId,
  resolveSbtCacheEntryFromBucket,
  resolveSbtDisplayCacheWriteNetKey,
  resolveSbtDisplayNameFromCacheValue,
  shouldPersistSbtDisplayMetadata,
  shouldWriteSbtDisplayLabelMemoEntry,
} from './sbtDisplayNameContracts.js';

describe('sbtDisplayNameContracts', () => {
  it('recognizes only metadata-like records', () => {
    expect(isSbtDisplayMetadataRecord({})).toBe(true);
    expect(isSbtDisplayMetadataRecord(Object.create(null))).toBe(true);
    expect(isSbtDisplayMetadataRecord([])).toBe(true);
    expect(isSbtDisplayMetadataRecord(null)).toBe(false);
    expect(isSbtDisplayMetadataRecord('name')).toBe(false);
  });

  it('exposes stable legacy encrypted-field aliases', () => {
    expect(getLegacySbtEncryptedFieldKeys('name')).toEqual(['nameEncrypted', 'encryptedName']);
    expect(getLegacySbtEncryptedFieldKeys('description')).toEqual(['descriptionEncrypted', 'encryptedDescription']);
    expect(getLegacySbtEncryptedFieldKeys('tags')).toEqual(['tagsEncrypted', 'encryptedTags']);
    expect(getLegacySbtEncryptedFieldKeys('documentURLs')).toEqual(['documentURLsEncrypted', 'docUrlsEncrypted']);
    expect(getLegacySbtEncryptedFieldKeys('image')).toEqual(['imageEncrypted', 'encryptedImage']);
    expect(getLegacySbtEncryptedFieldKeys(' name ')).toEqual([]);
    expect(getLegacySbtEncryptedFieldKeys('unknown')).toEqual([]);
  });

  it('detects locked fields from modern and legacy shapes without mutating metadata', () => {
    const info = {
      nameLocked: true,
      encryptedFields: {
        description: 1,
      },
      encryptedTags: true,
      encryptedImage: true,
      documentURLsEncrypted: true,
    };
    const before = JSON.stringify(info);

    expect(isSbtMetadataFieldLocked(info, 'name')).toBe(true);
    expect(isSbtMetadataFieldLocked(info, 'description')).toBe(true);
    expect(isSbtMetadataFieldLocked(info, 'tags')).toBe(true);
    expect(isSbtMetadataFieldLocked(info, 'image')).toBe(true);
    expect(isSbtMetadataFieldLocked(info, 'documentURLs')).toBe(true);
    expect(isSbtMetadataFieldLocked(info, 'unknown')).toBe(false);
    expect(isSbtMetadataFieldLocked({ nameLocked: true }, ' name ')).toBe(false);
    expect(JSON.stringify(info)).toBe(before);
  });

  it('preserves display-name fallback ordering and locked-name masking', () => {
    expect(
      getSbtMetadataDisplayNameValue({
        name: '',
        title: 'Title Name',
        symbol: 'SYM',
        contractName: 'Contract',
      }),
    ).toBe('Title Name');
    expect(
      getSbtMetadataDisplayNameValue({
        name: '',
        title: '',
        symbol: 'SYM',
        contractName: 'Contract',
      }),
    ).toBe('SYM');
    expect(
      getSbtMetadataDisplayNameValue({
        name: '',
        title: '',
        symbol: '',
        contractName: 'Contract',
      }),
    ).toBe('Contract');
    expect(
      getSbtMetadataDisplayNameValue({
        name: '',
        title: 'Visible Title',
        encryptedName: true,
      }),
    ).toBe(SBT_MASKED_FIELD_VALUE);
    expect(
      getSbtMetadataDisplayNameValue({
        name: 'Visible Name',
        encryptedName: true,
      }),
    ).toBe('Visible Name');
  });

  it('preserves description fallback and malformed input behavior', () => {
    expect(getSbtMetadataDescriptionText({ description: '  Details  ' })).toBe('Details');
    expect(getSbtMetadataDescriptionText({ description: '', encryptedDescription: true })).toBe(SBT_MASKED_FIELD_VALUE);
    expect(getSbtMetadataDescriptionText({ description: '' })).toBe('');
    expect(getSbtMetadataDescriptionText(null)).toBe('');
    expect(getSbtMetadataDisplayNameValue(null)).toBe('');
    expect(isSbtMetadataFieldLocked(null, 'name')).toBe(false);
  });

  it('normalizes cache addresses and chain IDs without broad coercion', () => {
    expect(getSbtDisplayAddressLower('  0xABC  ')).toBe('0xabc');
    expect(normalizeSbtDisplayChainId('84532')).toBe(84532);
    expect(normalizeSbtDisplayChainId(10.8)).toBe(10.8);
    expect(normalizeSbtDisplayChainId('0')).toBe(0);
    expect(normalizeSbtDisplayChainId('not-a-chain')).toBe(0);
    expect(normalizeSbtDisplayChainId(-1)).toBe(0);
  });

  it('preserves memo and retry key formats', () => {
    expect(
      buildSbtDisplayLabelMemoKey({
        addressLower: '  0xABC  ',
        preferredSlug: ' Edge Session ',
        chainId: '84532',
      }),
    ).toBe('0xabc|edge session|84532');
    expect(
      buildSbtDisplayLabelMemoKey({
        addressLower: null,
        preferredSlug: null,
        chainId: 'not-a-chain',
      }),
    ).toBe('||0');
    expect(
      buildSbtDisplayRetryStateKey({
        addressLower: ' 0xABC ',
        slug: ' Edge Session ',
        chainId: '84532',
      }),
    ).toBe(' 0xABC |edge session|84532');
    expect(
      buildSbtDisplayRetryStateKey({
        addressLower: null,
        slug: null,
        chainId: 'not-a-chain',
      }),
    ).toBe('null||0');
    expect(buildSbtDisplayInflightLookupKey('0xabc|edge|84532')).toBe('0xabc|edge|84532|lookup');
  });

  it('resolves retry allowance from retry state entries without mutating them', () => {
    const entry = { nextRetryAt: 2000 };
    const before = JSON.stringify(entry);

    expect(resolveSbtDisplayRetryAllowed(null, 1000)).toBe(true);
    expect(resolveSbtDisplayRetryAllowed(entry, 1000)).toBe(false);
    expect(resolveSbtDisplayRetryAllowed(entry, 2000)).toBe(true);
    expect(resolveSbtDisplayRetryAllowed({ nextRetryAt: 'later' }, 1000)).toBe(true);
    expect(JSON.stringify(entry)).toBe(before);
  });

  it('resolves metadata lookup retry decisions for missing, unnamed, and named metadata', () => {
    const unnamed = { name: '', title: '', symbol: '' };
    const locked = { name: '', encryptedName: true };
    const named = { name: 'Visible Name' };
    const before = JSON.stringify({ unnamed, locked, named });

    expect(resolveSbtMetadataLookupDecision(null)).toEqual({
      status: 'missing',
      hasMetadataRecord: false,
      name: '',
      shouldMarkFailure: true,
      shouldClearFailure: false,
      shouldUseResult: false,
    });
    expect(resolveSbtMetadataLookupDecision(unnamed)).toEqual({
      status: 'unnamed',
      hasMetadataRecord: true,
      name: '',
      shouldMarkFailure: true,
      shouldClearFailure: false,
      shouldUseResult: false,
    });
    expect(resolveSbtMetadataLookupDecision(locked)).toEqual({
      status: 'named',
      hasMetadataRecord: true,
      name: SBT_MASKED_FIELD_VALUE,
      shouldMarkFailure: false,
      shouldClearFailure: true,
      shouldUseResult: true,
    });
    expect(resolveSbtMetadataLookupDecision(named)).toEqual({
      status: 'named',
      hasMetadataRecord: true,
      name: 'Visible Name',
      shouldMarkFailure: false,
      shouldClearFailure: true,
      shouldUseResult: true,
    });
    expect(JSON.stringify({ unnamed, locked, named })).toBe(before);
  });

  it('preserves display memo write eligibility', () => {
    expect(
      shouldWriteSbtDisplayLabelMemoEntry({
        memoKey: ' 0xabc|edge|84532 ',
        value: { name: 'Visible Name' },
      }),
    ).toBe(true);
    expect(
      shouldWriteSbtDisplayLabelMemoEntry({
        memoKey: '',
        value: { name: 'Visible Name' },
      }),
    ).toBe(false);
    expect(
      shouldWriteSbtDisplayLabelMemoEntry({
        memoKey: '0xabc|edge|84532',
        value: { name: '' },
      }),
    ).toBe(false);
    expect(
      shouldWriteSbtDisplayLabelMemoEntry({
        memoKey: '0xabc|edge|84532',
        value: null,
      }),
    ).toBe(false);
  });

  it('preserves display metadata persistence eligibility', () => {
    expect(shouldPersistSbtDisplayMetadata({ name: '' })).toBe(true);
    expect(shouldPersistSbtDisplayMetadata({ name: '', encryptedName: true })).toBe(true);
    expect(shouldPersistSbtDisplayMetadata([])).toBe(true);
    expect(shouldPersistSbtDisplayMetadata(null)).toBe(false);
    expect(shouldPersistSbtDisplayMetadata('metadata')).toBe(false);
  });

  it('selects cache entries by exact bucket key or embedded SBT address without mutation', () => {
    const addressA = '0x1111111111111111111111111111111111111111';
    const addressB = '0x2222222222222222222222222222222222222222';
    const bucket = {
      sbtList: {
        [addressA.toLowerCase()]: {
          sbtAddress: addressA,
          sbtInfo: { name: 'Direct Entry', chainID: 84532 },
        },
        alias: {
          sbtAddress: addressB,
          sbtInfo: { name: 'Alias Entry', chainID: 84532 },
        },
      },
    };
    const before = JSON.stringify(bucket);

    expect(resolveSbtCacheEntryFromBucket(bucket, addressA.toLowerCase())).toBe(bucket.sbtList[addressA.toLowerCase()]);
    expect(resolveSbtCacheEntryFromBucket(bucket, addressB.toLowerCase())).toBe(bucket.sbtList.alias);
    expect(resolveSbtCacheEntryFromBucket({ sbtList: null }, addressA.toLowerCase())).toBeNull();
    expect(resolveSbtCacheEntryFromBucket(null, addressA.toLowerCase())).toBeNull();
    expect(JSON.stringify(bucket)).toBe(before);
  });

  it('resolves cache entry chain IDs from metadata, entry, then net key', () => {
    expect(resolveSbtCacheEntryChainId({ sbtInfo: { chainID: '84532' } }, '10')).toBe(84532);
    expect(resolveSbtCacheEntryChainId({ sbtInfo: { chainId: '10' } }, '84532')).toBe(10);
    expect(resolveSbtCacheEntryChainId({ chainID: '11155420' }, '84532')).toBe(11155420);
    expect(resolveSbtCacheEntryChainId({ chainId: '10' }, '84532')).toBe(10);
    expect(resolveSbtCacheEntryChainId({}, '84532')).toBe(84532);
    expect(resolveSbtCacheEntryChainId({}, 'not-a-chain')).toBe(0);
  });

  it('resolves display names from cache values while preserving chain filters and fallback order', () => {
    const address = '0x3333333333333333333333333333333333333333';
    const cacheValue = {
      10: {
        sbtList: {
          [address.toLowerCase()]: {
            sbtAddress: address,
            sbtInfo: { name: 'Wrong Chain', chainID: 10 },
          },
        },
      },
      84532: {
        sbtList: {
          alias: {
            sbtAddress: address,
            sbtInfo: { name: '', title: 'Base Title', symbol: 'BASE', chainID: 84532 },
          },
        },
      },
    };

    expect(
      resolveSbtDisplayNameFromCacheValue(cacheValue, address.toLowerCase(), {
        expectedChainId: 84532,
      }),
    ).toEqual(
      expect.objectContaining({
        name: 'Base Title',
        netKey: '84532',
        chainId: 84532,
        entry: cacheValue[84532].sbtList.alias,
      }),
    );
    expect(
      resolveSbtDisplayNameFromCacheValue(cacheValue, address.toLowerCase(), {
        expectedChainId: 11155420,
      }),
    ).toBeNull();
    expect(resolveSbtDisplayNameFromCacheValue(null, address.toLowerCase())).toBeNull();
  });

  it('selects cache write network keys without mutating cache input', () => {
    const address = '0x4444444444444444444444444444444444444444';
    const cacheObj = {
      10: {
        sbtList: {
          [address.toLowerCase()]: {
            sbtAddress: address,
            sbtInfo: { name: 'Optimism Name', chainID: 10 },
          },
        },
      },
      84532: {
        sbtList: {
          alias: {
            sbtAddress: address,
            sbtInfo: { name: 'Base Name', chainID: 84532 },
          },
        },
      },
    };
    const before = JSON.stringify(cacheObj);

    expect(
      resolveSbtDisplayCacheWriteNetKey({
        cacheObj,
        addressLower: address.toLowerCase(),
        chainId: 84532,
        info: { chainID: 10 },
      }),
    ).toBe('84532');
    expect(
      resolveSbtDisplayCacheWriteNetKey({
        cacheObj,
        addressLower: address.toLowerCase(),
        chainId: null,
        info: { chainID: 10 },
      }),
    ).toBe('10');
    expect(
      resolveSbtDisplayCacheWriteNetKey({
        cacheObj,
        addressLower: '0x5555555555555555555555555555555555555555',
        chainId: 11155420,
        info: { chainID: 84532 },
      }),
    ).toBe('11155420');
    expect(
      resolveSbtDisplayCacheWriteNetKey({
        cacheObj,
        addressLower: '0x5555555555555555555555555555555555555555',
        chainId: null,
        info: { chainID: 84532 },
      }),
    ).toBe('84532');
    expect(
      resolveSbtDisplayCacheWriteNetKey({
        cacheObj: { 84532: { sbtList: {} } },
        addressLower: address.toLowerCase(),
      }),
    ).toBe('84532');
    expect(
      resolveSbtDisplayCacheWriteNetKey({
        cacheObj: { 84532: {}, 10: {} },
        addressLower: address.toLowerCase(),
      }),
    ).toBe('');
    expect(JSON.stringify(cacheObj)).toBe(before);
  });

  it('builds cache entries by preserving existing fields and merging metadata', () => {
    const existingEntry = {
      sbtAddress: '0xold',
      ownerCount: 2,
      sbtInfo: {
        name: 'Old Name',
        description: 'Old description',
        encryptedName: true,
      },
    };
    const metadata = {
      name: '',
      title: 'New Title',
      chainID: 84532,
    };
    const before = JSON.stringify({ existingEntry, metadata });

    expect(
      buildSbtDisplayCacheEntry({
        existingEntry,
        checksum: '0xnew',
        metadata,
        slug: 'edge',
      }),
    ).toEqual({
      sbtAddress: '0xnew',
      ownerCount: 2,
      sbtInfo: {
        name: '',
        description: 'Old description',
        encryptedName: true,
        title: 'New Title',
        chainID: 84532,
      },
      slug: 'edge',
    });
    expect(
      buildSbtDisplayCacheEntry({
        existingEntry: null,
        checksum: '0xnew',
        metadata: { encryptedName: true },
        slug: 'edge',
      }),
    ).toEqual({
      sbtAddress: '0xnew',
      sbtInfo: { encryptedName: true },
      slug: 'edge',
    });
    expect(JSON.stringify({ existingEntry, metadata })).toBe(before);
  });
});
