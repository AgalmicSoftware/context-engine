import type { SbtGroupMintAuthorizationPort } from './sbtPorts.js';
import chainGateway from '../../utilities/web3/chainGateway.js';
import { sbtGroupMintAuthorizationPort } from './sbtGroupMintAuthorizationPort.js';

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
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('supports a fake authorization port with scoped group mint inputs', async () => {
    const fakePort: SbtGroupMintAuthorizationPort = {
      computeGroupPasswordHash: jest.fn(() => '0xhash'),
      signGroupMintAuthorization: jest.fn(async () => '0xsignature'),
      generateInvitePayloads: jest.fn(async () => [
        { nonce: '1', signature: '0xinvite1', inviteCode: 'inv1' },
        { nonce: '2', signature: '0xinvite2', inviteCode: 'inv2' },
      ]),
    };
    const sbtAddress = '0x0000000000000000000000000000000000000001';
    const userAddress = '0x0000000000000000000000000000000000000002';

    await expect(
      buildGroupMintArtifacts(fakePort, 'group password', sbtAddress, userAddress, sbtAddress),
    ).resolves.toEqual({
      groupPasswordHash: '0xhash',
      signature: '0xsignature',
      invites: [
        { nonce: '1', signature: '0xinvite1', inviteCode: 'inv1' },
        { nonce: '2', signature: '0xinvite2', inviteCode: 'inv2' },
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

  it('delegates group mint authorization through call-time chainGateway property lookup', async () => {
    const computeGroupPasswordHash = jest
      .spyOn(chainGateway, 'computeGroupPasswordHash')
      .mockReturnValue('0xfirstHash');
    const signGroupMintAuthorization = jest
      .spyOn(chainGateway, 'signGroupMintAuthorization')
      .mockResolvedValue('0xsecondSignature');
    const generateInvitePayloads = jest.spyOn(chainGateway, 'generateInvitePayloads').mockResolvedValue([
      { nonce: '2', signature: '0xsecondInvite', inviteCode: 'second' },
    ]);
    const firstInput = {
      password: 'first password',
      sbtAddress: '0x0000000000000000000000000000000000000001',
    };

    expect(sbtGroupMintAuthorizationPort.computeGroupPasswordHash(firstInput)).toBe('0xfirstHash');

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

    await expect(sbtGroupMintAuthorizationPort.signGroupMintAuthorization(signInput)).resolves.toBe('0xsecondSignature');
    await expect(sbtGroupMintAuthorizationPort.generateInvitePayloads(inviteInput)).resolves.toEqual([
      { nonce: '2', signature: '0xsecondInvite', inviteCode: 'second' },
    ]);

    expect(computeGroupPasswordHash).toHaveBeenCalledWith(firstInput);
    expect(signGroupMintAuthorization).toHaveBeenCalledWith(signInput);
    expect(generateInvitePayloads).toHaveBeenCalledWith(inviteInput);
  });
});
