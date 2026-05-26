import {
  SBT_MASKED_FIELD_VALUE,
  getLegacySbtEncryptedFieldKeys,
  getSbtDisplayAddressLower,
  getSbtMetadataDescriptionText,
  getSbtMetadataDisplayNameValue,
  isSbtDisplayMetadataRecord,
  isSbtMetadataFieldLocked,
  normalizeSbtDisplayChainId,
  resolveSbtCacheEntryChainId,
  resolveSbtCacheEntryFromBucket,
  resolveSbtDisplayNameFromCacheValue,
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
    expect(getLegacySbtEncryptedFieldKeys('description')).toEqual([
      'descriptionEncrypted',
      'encryptedDescription',
    ]);
    expect(getLegacySbtEncryptedFieldKeys('tags')).toEqual(['tagsEncrypted', 'encryptedTags']);
    expect(getLegacySbtEncryptedFieldKeys('documentURLs')).toEqual([
      'documentURLsEncrypted',
      'docUrlsEncrypted',
    ]);
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
    expect(getSbtMetadataDisplayNameValue({
      name: '',
      title: 'Title Name',
      symbol: 'SYM',
      contractName: 'Contract',
    })).toBe('Title Name');
    expect(getSbtMetadataDisplayNameValue({
      name: '',
      title: '',
      symbol: 'SYM',
      contractName: 'Contract',
    })).toBe('SYM');
    expect(getSbtMetadataDisplayNameValue({
      name: '',
      title: '',
      symbol: '',
      contractName: 'Contract',
    })).toBe('Contract');
    expect(getSbtMetadataDisplayNameValue({
      name: '',
      title: 'Visible Title',
      encryptedName: true,
    })).toBe(SBT_MASKED_FIELD_VALUE);
    expect(getSbtMetadataDisplayNameValue({
      name: 'Visible Name',
      encryptedName: true,
    })).toBe('Visible Name');
  });

  it('preserves description fallback and malformed input behavior', () => {
    expect(getSbtMetadataDescriptionText({ description: '  Details  ' })).toBe('Details');
    expect(getSbtMetadataDescriptionText({ description: '', encryptedDescription: true }))
      .toBe(SBT_MASKED_FIELD_VALUE);
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

    expect(resolveSbtCacheEntryFromBucket(bucket, addressA.toLowerCase()))
      .toBe(bucket.sbtList[addressA.toLowerCase()]);
    expect(resolveSbtCacheEntryFromBucket(bucket, addressB.toLowerCase()))
      .toBe(bucket.sbtList.alias);
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

    expect(resolveSbtDisplayNameFromCacheValue(cacheValue, address.toLowerCase(), {
      expectedChainId: 84532,
    })).toEqual(expect.objectContaining({
      name: 'Base Title',
      netKey: '84532',
      chainId: 84532,
      entry: cacheValue[84532].sbtList.alias,
    }));
    expect(resolveSbtDisplayNameFromCacheValue(cacheValue, address.toLowerCase(), {
      expectedChainId: 11155420,
    })).toBeNull();
    expect(resolveSbtDisplayNameFromCacheValue(null, address.toLowerCase())).toBeNull();
  });
});
