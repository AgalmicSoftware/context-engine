import type { SbtMintExecutionPort, SbtProviderRef } from './sbtPorts.js';
import chainGateway from '../../utilities/web3/chainGateway.js';
import { sbtMintExecutionPort } from './sbtMintExecutionPort.js';

const executeSbtMintFlows = async (
  port: SbtMintExecutionPort,
  providerName: SbtProviderRef,
  sbtAddress: string,
  nonce: string,
  inviteSignature: string,
  groupSignature: string,
) => {
  const [publicTx, inviteTx, groupTx] = await Promise.all([
    port.claim(providerName, sbtAddress),
    port.claimWithInvite(providerName, sbtAddress, nonce, inviteSignature),
    port.mintWithGroupSignature(providerName, sbtAddress, groupSignature),
  ]);

  return {
    publicTx,
    inviteTx,
    groupTx,
  };
};

describe('SbtMintExecutionPort', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('supports a fake mint execution port with the legacy call shape', async () => {
    const fakePort: SbtMintExecutionPort = {
      claim: jest.fn(async () => ({ transactionHash: '0xpublic' })),
      claimWithInvite: jest.fn(async () => ({ transactionHash: '0xinvite' })),
      mintWithGroupSignature: jest.fn(async () => ({ transactionHash: '0xgroup' })),
    };
    const sbtAddress = '0x0000000000000000000000000000000000000001';
    const providerRef = { selectedAddress: '0x0000000000000000000000000000000000000002' };

    await expect(
      executeSbtMintFlows(fakePort, providerRef, sbtAddress, '7', '0xinviteSignature', '0xgroupSignature'),
    ).resolves.toEqual({
      publicTx: { transactionHash: '0xpublic' },
      inviteTx: { transactionHash: '0xinvite' },
      groupTx: { transactionHash: '0xgroup' },
    });

    expect(fakePort.claim).toHaveBeenCalledWith(providerRef, sbtAddress);
    expect(fakePort.claimWithInvite).toHaveBeenCalledWith(providerRef, sbtAddress, '7', '0xinviteSignature');
    expect(fakePort.mintWithGroupSignature).toHaveBeenCalledWith(providerRef, sbtAddress, '0xgroupSignature');
  });

  it('delegates mint execution through call-time chainGateway property lookup', async () => {
    const claim = jest.spyOn(chainGateway, 'claim').mockResolvedValue({ transactionHash: '0xfirstClaim' });
    const claimWithInvite = jest
      .spyOn(chainGateway, 'claimWithInvite')
      .mockResolvedValue({ transactionHash: '0xsecondInvite' });
    const mintWithGroupSignature = jest
      .spyOn(chainGateway, 'mintWithGroupSignature')
      .mockResolvedValue({ transactionHash: '0xsecondGroup' });

    await expect(
      sbtMintExecutionPort.claim('injected', '0x0000000000000000000000000000000000000001'),
    ).resolves.toEqual({ transactionHash: '0xfirstClaim' });

    await expect(
      sbtMintExecutionPort.claimWithInvite(
        'injected',
        '0x0000000000000000000000000000000000000002',
        '8',
        '0xinviteSignature',
      ),
    ).resolves.toEqual({ transactionHash: '0xsecondInvite' });
    await expect(
      sbtMintExecutionPort.mintWithGroupSignature(
        'injected',
        '0x0000000000000000000000000000000000000002',
        '0xgroupSignature',
      ),
    ).resolves.toEqual({ transactionHash: '0xsecondGroup' });

    expect(claim).toHaveBeenCalledWith('injected', '0x0000000000000000000000000000000000000001');
    expect(claimWithInvite).toHaveBeenCalledWith(
      'injected',
      '0x0000000000000000000000000000000000000002',
      '8',
      '0xinviteSignature',
    );
    expect(mintWithGroupSignature).toHaveBeenCalledWith(
      'injected',
      '0x0000000000000000000000000000000000000002',
      '0xgroupSignature',
    );
  });
});
