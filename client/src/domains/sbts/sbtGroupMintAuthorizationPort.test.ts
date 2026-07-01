import type { SbtGroupMintAuthorizationPort } from './sbtPorts.js';
import {
  bindSbtGroupMintAuthorizationPort,
} from './contractScriptsSbtGroupMintAuthorizationPort.js';

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

  it('binds group mint authorization through a call-time contractScripts getter', async () => {
    const firstContractScripts = {
      computeGroupPasswordHash: jest.fn(() => '0xfirstHash'),
      signGroupMintAuthorization: jest.fn(async () => '0xfirstSignature'),
      generateInvitePayloads: jest.fn(async () => [
        { nonce: '1', signature: '0xfirstInvite', inviteCode: 'first' },
      ]),
    };
    const secondContractScripts = {
      computeGroupPasswordHash: jest.fn(() => '0xsecondHash'),
      signGroupMintAuthorization: jest.fn(async () => '0xsecondSignature'),
      generateInvitePayloads: jest.fn(async () => [
        { nonce: '2', signature: '0xsecondInvite', inviteCode: 'second' },
      ]),
    };
    let currentContractScripts = firstContractScripts;
    const port = bindSbtGroupMintAuthorizationPort({
      contractScripts: () => currentContractScripts,
    });
    const firstInput = {
      password: 'first password',
      sbtAddress: '0x0000000000000000000000000000000000000001',
    };

    expect(port.computeGroupPasswordHash(firstInput)).toBe('0xfirstHash');

    currentContractScripts = secondContractScripts;

    const signInput = {
      password: 'second password',
      sbtAddress: '0x0000000000000000000000000000000000000002',
      userAddress: '0x0000000000000000000000000000000000000003',
      walletScopeSbtAddress: '0x0000000000000000000000000000000000000002',
    };
    const inviteInput = {
      password: 'second password',
      sbtAddress: '0x0000000000000000000000000000000000000002',
      nonces: ['2'],
      walletScopeSbtAddress: '0x0000000000000000000000000000000000000002',
    };

    await expect(port.signGroupMintAuthorization(signInput))
      .resolves.toBe('0xsecondSignature');
    await expect(port.generateInvitePayloads(inviteInput))
      .resolves.toEqual([
        { nonce: '2', signature: '0xsecondInvite', inviteCode: 'second' },
      ]);

    expect(firstContractScripts.computeGroupPasswordHash).toHaveBeenCalledWith(firstInput);
    expect(secondContractScripts.signGroupMintAuthorization).toHaveBeenCalledWith(signInput);
    expect(secondContractScripts.generateInvitePayloads).toHaveBeenCalledWith(inviteInput);
  });
});
