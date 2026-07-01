import type { SbtGroupMintAuthorizationPort } from './sbtPorts.js';

const buildGroupMintArtifacts = async (
  port: SbtGroupMintAuthorizationPort,
  password: string,
  sbtAddress: string,
  userAddress: string,
  walletScopeSbtAddress: string | null,
) => {
  const groupPasswordHash = port.computeGroupPasswordHash({
    password,
    sbtAddress: walletScopeSbtAddress,
  });
  const signature = await port.signGroupMintAuthorization({
    password,
    sbtAddress,
    userAddress,
    walletScopeSbtAddress,
  });
  const invites = await port.generateInvitePayloads({
    password,
    sbtAddress,
    nonces: ['1', 2],
    walletScopeSbtAddress,
  });

  return {
    groupPasswordHash,
    signature,
    invites,
  };
};

describe('SbtGroupMintAuthorizationPort', () => {
  it('supports a fake authorization port with scoped group mint inputs', async () => {
    const fakePort: SbtGroupMintAuthorizationPort = {
      computeGroupPasswordHash: jest.fn(() => '0xhash'),
      signGroupMintAuthorization: jest.fn(async () => '0xsignature'),
      generateInvitePayloads: jest.fn(async () => [
        { nonce: '1', signature: '0xinvite1', inviteCode: 'inv1' },
        { nonce: 2, signature: '0xinvite2', inviteCode: 'inv2' },
      ]),
    };
    const sbtAddress = '0x0000000000000000000000000000000000000001';
    const userAddress = '0x0000000000000000000000000000000000000002';

    await expect(
      buildGroupMintArtifacts(
        fakePort,
        'group password',
        sbtAddress,
        userAddress,
        sbtAddress,
      )
    ).resolves.toEqual({
      groupPasswordHash: '0xhash',
      signature: '0xsignature',
      invites: [
        { nonce: '1', signature: '0xinvite1', inviteCode: 'inv1' },
        { nonce: 2, signature: '0xinvite2', inviteCode: 'inv2' },
      ],
    });

    expect(fakePort.computeGroupPasswordHash).toHaveBeenCalledWith({
      password: 'group password',
      sbtAddress,
    });
    expect(fakePort.signGroupMintAuthorization).toHaveBeenCalledWith({
      password: 'group password',
      sbtAddress,
      userAddress,
      walletScopeSbtAddress: sbtAddress,
    });
    expect(fakePort.generateInvitePayloads).toHaveBeenCalledWith({
      password: 'group password',
      sbtAddress,
      nonces: ['1', 2],
      walletScopeSbtAddress: sbtAddress,
    });
  });
});
