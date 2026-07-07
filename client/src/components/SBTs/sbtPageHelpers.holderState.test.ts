import {
  buildSbtPageAccountDerivedStatePatch,
  buildSbtPageHolderListSignature,
  buildSbtPageLocalBurnSuccessPatch,
  buildSbtPageLocalMintSuccessPatch,
  buildSbtPagePrimaryMetadataStatePatch,
  resolveSbtPageUserAdminStatus,
} from './sbtPageHelpers';

describe('sbtPageHelpers holder state helpers', () => {
  it('builds primary metadata state patches with admin status', () => {
    expect(
      resolveSbtPageUserAdminStatus({
        account: '0xAdmin',
        sbtInfo: { admin: '0xadmin' },
      }),
    ).toBe(true);
    expect(
      resolveSbtPageUserAdminStatus({
        account: '0xAdmin',
        sbtInfo: { admin_: '0xother' },
      }),
    ).toBe(false);
    expect(
      resolveSbtPageUserAdminStatus({
        account: '',
        sbtInfo: { admin: '0xadmin' },
      }),
    ).toBe('');
    const nextInfo = { admin: '0xAdmin' };
    expect(
      buildSbtPagePrimaryMetadataStatePatch({
        account: '0xadmin',
        extraState: { loadingMintersBurners: false },
        nextSbtInfo: nextInfo,
        prevSbtInfo: { stale: true },
      }),
    ).toEqual({
      sbtInfo: nextInfo,
      userIsSbtAdmin: true,
      loadingMintersBurners: false,
    });
    expect(
      buildSbtPagePrimaryMetadataStatePatch({
        account: '0xadmin',
        nextSbtInfo: { admin_: '0xOther' },
        prevSbtInfo: { stale: true },
      }),
    ).toEqual({
      sbtInfo: { admin_: '0xOther' },
      userIsSbtAdmin: false,
    });
    expect(
      buildSbtPagePrimaryMetadataStatePatch({
        account: '0xadmin',
        nextSbtInfo: null,
        prevSbtInfo: { stale: true },
      }),
    ).toEqual({
      sbtInfo: { stale: true },
      userIsSbtAdmin: '',
    });
  });

  it('builds account-derived holder and admin state patches', () => {
    const holder = '0x00000000000000000000000000000000000000aa';
    const other = '0x00000000000000000000000000000000000000bb';

    expect(
      buildSbtPageAccountDerivedStatePatch({
        account: holder,
        state: {
          mintedAddresses: [holder, holder, other],
          burnedAddresses: [holder],
          sbtInfo: { admin_: holder },
          userHasSBT: false,
          userIsSbtAdmin: false,
        },
      }),
    ).toEqual({
      userHasSBT: true,
      userIsSbtAdmin: true,
    });

    expect(
      buildSbtPageAccountDerivedStatePatch({
        account: holder,
        state: {
          mintedAddresses: [holder],
          burnedAddresses: [],
          sbtInfo: { admin: other },
          userHasSBT: true,
          userIsSbtAdmin: false,
        },
      }),
    ).toBeNull();

    expect(
      buildSbtPageAccountDerivedStatePatch({
        account: '',
        state: {
          mintedAddresses: [holder],
          burnedAddresses: [],
          sbtInfo: { admin: holder },
          userHasSBT: true,
          userIsSbtAdmin: true,
        },
      }),
    ).toEqual({
      userHasSBT: false,
      userIsSbtAdmin: '',
    });
  });

  it('builds local mint success holder patches', () => {
    const holder = '0x00000000000000000000000000000000000000aa';
    const other = '0x00000000000000000000000000000000000000bb';

    expect(
      buildSbtPageLocalMintSuccessPatch({
        addrLower: holder,
        prevState: {
          mintedAddresses: [other],
          burnedAddresses: [holder, other],
        },
      }),
    ).toEqual({
      mintedAddresses: [other, holder],
      burnedAddresses: [other],
      userHasSBT: true,
    });

    expect(
      buildSbtPageLocalMintSuccessPatch({
        addrLower: '',
        prevState: {
          mintedAddresses: [other],
          burnedAddresses: [holder],
        },
      }),
    ).toBeNull();
  });

  it('builds local burn success holder patches', () => {
    const holder = '0x00000000000000000000000000000000000000aa';
    const other = '0x00000000000000000000000000000000000000bb';

    expect(
      buildSbtPageLocalBurnSuccessPatch({
        addrLower: holder,
        prevState: {
          mintedAddresses: [holder, other],
          burnedAddresses: [],
          filteredMintedUsers: [holder, other],
          showModal: true,
        },
      }),
    ).toEqual({
      burnedAddresses: [holder],
      userHasSBT: false,
      filteredMintedUsers: [other],
      filteredMintedUsersSignature: buildSbtPageHolderListSignature([other]),
    });

    expect(
      buildSbtPageLocalBurnSuccessPatch({
        addrLower: holder,
        prevState: {
          mintedAddresses: [holder],
          burnedAddresses: [],
          filteredMintedUsers: [holder],
          filteredMintedUsersSignature: 'prev',
        },
      }),
    ).toEqual({
      burnedAddresses: [holder],
      userHasSBT: false,
      filteredMintedUsers: [],
      filteredMintedUsersSignature: buildSbtPageHolderListSignature([]),
    });

    expect(
      buildSbtPageLocalBurnSuccessPatch({
        addrLower: holder,
        prevState: {
          mintedAddresses: [holder],
          burnedAddresses: [],
          filteredMintedUsersSignature: 'prev',
        },
      }),
    ).toEqual({
      burnedAddresses: [holder],
      userHasSBT: false,
      filteredMintedUsers: [],
      filteredMintedUsersSignature: 'prev',
    });
  });
});
