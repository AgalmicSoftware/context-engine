import {
  buildDocLibraryCommonTags,
  buildDocLibraryPlaintextFileMetaTags,
  buildDocLibraryRoleTags,
  buildDocLibrarySbtTags,
  buildDocLibrarySessionTags,
  mergeTags,
  normalizeSbtAddress,
  normalizeSessionIdHex,
} from './tags.js';

describe('docLibrary tags', () => {
  it('normalizes session ids only when they resolve to 16 bytes', () => {
    expect(normalizeSessionIdHex('0xAABBCCDDEEFF00112233445566778899')).toBe('0xaabbccddeeff00112233445566778899');
    expect(normalizeSessionIdHex('aa-bb-cc-dd-ee-ff-00-11-22-33-44-55-66-77-88-99')).toBe(
      '0xaabbccddeeff00112233445566778899',
    );
    expect(normalizeSessionIdHex('0x1234')).toBe('');
    expect(normalizeSessionIdHex('not-a-session')).toBe('');
  });

  it('normalizes SBT addresses through ethers address validation', () => {
    expect(normalizeSbtAddress('0x00000000000000000000000000000000000000AA')).toBe(
      '0x00000000000000000000000000000000000000aa',
    );
    expect(normalizeSbtAddress('0xnot-an-address')).toBe('');
  });

  it('builds common, session, and SBT tags without empty values', () => {
    expect(buildDocLibraryCommonTags({ kind: 'photo', storage: 'arweave' })).toEqual([
      { name: 'CE-DocLibrary', value: '1' },
      { name: 'CE-DocKind', value: 'photo' },
      { name: 'CE-DocStorage', value: 'arweave' },
    ]);
    expect(buildDocLibraryCommonTags({ kind: '', storage: '' })).toEqual([{ name: 'CE-DocLibrary', value: '1' }]);
    expect(buildDocLibrarySessionTags({ sessionIdHex: 'aabbccddeeff00112233445566778899' })).toEqual([
      { name: 'CE-SessionId', value: '0xaabbccddeeff00112233445566778899' },
    ]);
    expect(
      buildDocLibrarySbtTags({
        chainId: '11155420',
        sbtAddress: '0x00000000000000000000000000000000000000AA',
      }),
    ).toEqual([
      { name: 'CE-SbtChainId', value: '11155420' },
      { name: 'CE-SbtAddress', value: '0x00000000000000000000000000000000000000aa' },
    ]);
  });

  it('truncates plaintext file metadata and role tags to stable tag lengths', () => {
    const [nameTag, mimeTag, sizeTag] = buildDocLibraryPlaintextFileMetaTags({
      name: `${'n'.repeat(200)}   `,
      mime: `${'m'.repeat(140)}   `,
      size: 12345,
    });

    expect(nameTag).toEqual({ name: 'CE-DocName', value: 'n'.repeat(179) });
    expect(mimeTag).toEqual({ name: 'CE-DocMime', value: 'm'.repeat(119) });
    expect(sizeTag).toEqual({ name: 'CE-DocSize', value: '12345' });

    expect(
      buildDocLibraryRoleTags({
        role: 'PHOTO',
        derivedFromTxId: `${'t'.repeat(100)}   `,
      }),
    ).toEqual([
      { name: 'CE-DocRole', value: 'photo' },
      { name: 'CE-DocDerivedFromTx', value: 't'.repeat(79) },
    ]);
  });

  it('merges only string-valued tags and trims their names and values', () => {
    expect(
      mergeTags(
        [
          { name: ' CE-A ', value: ' one ' },
          { name: 'CE-Empty', value: ' ' },
        ],
        null,
        [
          { name: 'CE-B', value: 'two' },
          { name: 'CE-C', value: 3 },
        ],
      ),
    ).toEqual([
      { name: 'CE-A', value: 'one' },
      { name: 'CE-B', value: 'two' },
    ]);
  });
});
