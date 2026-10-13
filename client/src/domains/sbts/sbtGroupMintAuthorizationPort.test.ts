import type { SbtGroupMintAuthorizationPort } from './sbtPorts.js';
import chainGateway from '../../utilities/web3/chainGateway.js';
import { sbtGroupMintAuthorizationPort } from './sbtGroupMintAuthorizationPort.js';

const buildGroupMintArtifacts = async (
  port: SbtGroupMintAuthorizationPort,
  password: string,
  sbtAddress: string,
  userAddress: string,
) => {
  const groupPasswordHash = await port.computeGroupPasswordHash({ password, sbtAddress });
  const signature = await port.signGroupMintAuthorization({
    password,
    sbtAddress,
    chainId: 11155420,
    userAddress,
    groupPasswordHash,
  });
  const invites = await port.generateInvitePayloads({
    password,
    sbtAddress,
    chainId: 11155420,
    nonces: ['1', 2],
    groupPasswordHash,
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

  it('supports a fake authorization port with SBT-scoped group mint inputs', async () => {
    const fakePort: SbtGroupMintAuthorizationPort = {
      computeGroupPasswordHash: jest.fn(async () => '0xhash'),
      signGroupMintAuthorization: jest.fn(async () => '0xsignature'),
      generateInvitePayloads: jest.fn(async () => [
        {
          chainId: '11155420',
          sbtAddress: '0x0000000000000000000000000000000000000001',
          nonce: '1',
          signature: '0xinvite1',
          inviteCode: 'inv1',
        },
        {
          chainId: '11155420',
          sbtAddress: '0x0000000000000000000000000000000000000001',
          nonce: '2',
          signature: '0xinvite2',
          inviteCode: 'inv2',
        },
      ]),
    };
    const sbtAddress = '0x0000000000000000000000000000000000000001';
    const userAddress = '0x0000000000000000000000000000000000000002';

    await expect(buildGroupMintArtifacts(fakePort, 'group password', sbtAddress, userAddress)).resolves.toEqual({
      groupPasswordHash: '0xhash',
      signature: '0xsignature',
      invites: [
        {
          chainId: '11155420',
          sbtAddress: '0x0000000000000000000000000000000000000001',
          nonce: '1',
          signature: '0xinvite1',
          inviteCode: 'inv1',
        },
        {
          chainId: '11155420',
          sbtAddress: '0x0000000000000000000000000000000000000001',
          nonce: '2',
          signature: '0xinvite2',
          inviteCode: 'inv2',
        },
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
      chainId: 11155420,
      groupPasswordHash: '0xhash',
    });
    expect(fakePort.generateInvitePayloads).toHaveBeenCalledWith({
      password: 'group password',
      sbtAddress,
      chainId: 11155420,
      nonces: ['1', 2],
      groupPasswordHash: '0xhash',
    });
  });

  it('delegates group mint authorization through call-time chainGateway property lookup', async () => {
    const computeGroupPasswordHash = jest
      .spyOn(chainGateway, 'computeGroupPasswordHash')
      .mockResolvedValue('0xfirstHash');
    const signGroupMintAuthorization = jest
      .spyOn(chainGateway, 'signGroupMintAuthorization')
      .mockResolvedValue('0xsecondSignature');
    const generateInvitePayloads = jest
      .spyOn(chainGateway, 'generateInvitePayloads')
      .mockResolvedValue([{ nonce: '2', signature: '0xsecondInvite', inviteCode: 'second' }]);
    const firstInput = {
      password: 'first password',
      sbtAddress: '0x0000000000000000000000000000000000000001',
    };

    await expect(sbtGroupMintAuthorizationPort.computeGroupPasswordHash(firstInput)).resolves.toBe('0xfirstHash');

    const signInput = {
      password: 'second password',
      chainId: 11155420,
      sbtAddress: '0x0000000000000000000000000000000000000002',
      userAddress: '0x0000000000000000000000000000000000000003',
      groupPasswordHash: `0x${'22'.repeat(32)}`,
    };
    const inviteInput = {
      password: 'second password',
      chainId: 11155420,
      sbtAddress: '0x0000000000000000000000000000000000000002',
      nonces: ['2'],
      groupPasswordHash: `0x${'22'.repeat(32)}`,
    };

    await expect(sbtGroupMintAuthorizationPort.signGroupMintAuthorization(signInput)).resolves.toBe(
      '0xsecondSignature',
    );
    await expect(sbtGroupMintAuthorizationPort.generateInvitePayloads(inviteInput)).resolves.toEqual([
      { nonce: '2', signature: '0xsecondInvite', inviteCode: 'second' },
    ]);

    expect(computeGroupPasswordHash).toHaveBeenCalledWith(firstInput);
    expect(signGroupMintAuthorization).toHaveBeenCalledWith(signInput);
    expect(generateInvitePayloads).toHaveBeenCalledWith(inviteInput);
  });
});
