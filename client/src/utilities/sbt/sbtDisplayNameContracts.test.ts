import {
  SBT_MASKED_FIELD_VALUE,
  getLegacySbtEncryptedFieldKeys,
  getSbtMetadataDescriptionText,
  getSbtMetadataDisplayNameValue,
  isSbtDisplayMetadataRecord,
  isSbtMetadataFieldLocked,
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
});
