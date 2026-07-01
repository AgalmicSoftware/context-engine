import type { SbtMintExecutionPort } from './sbtPorts.js';

const executeSbtMintFlows = async (
  port: SbtMintExecutionPort,
  providerName: string,
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
  it('supports a fake mint execution port with the legacy call shape', async () => {
    const fakePort: SbtMintExecutionPort = {
      claim: jest.fn(async () => ({ transactionHash: '0xpublic' })),
      claimWithInvite: jest.fn(async () => ({ transactionHash: '0xinvite' })),
      mintWithGroupSignature: jest.fn(async () => ({ transactionHash: '0xgroup' })),
    };
    const sbtAddress = '0x0000000000000000000000000000000000000001';

    await expect(
      executeSbtMintFlows(
        fakePort,
        'injected',
        sbtAddress,
        '7',
        '0xinviteSignature',
        '0xgroupSignature',
      )
    ).resolves.toEqual({
      publicTx: { transactionHash: '0xpublic' },
      inviteTx: { transactionHash: '0xinvite' },
      groupTx: { transactionHash: '0xgroup' },
    });

    expect(fakePort.claim).toHaveBeenCalledWith('injected', sbtAddress);
    expect(fakePort.claimWithInvite).toHaveBeenCalledWith(
      'injected',
      sbtAddress,
      '7',
      '0xinviteSignature',
    );
    expect(fakePort.mintWithGroupSignature).toHaveBeenCalledWith(
      'injected',
      sbtAddress,
      '0xgroupSignature',
    );
  });
});
