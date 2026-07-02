import type { SbtMintExecutionPort, SbtProviderRef } from './sbtPorts.js';
import { bindSbtMintExecutionPort } from './contractScriptsSbtMintExecutionPort.js';

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
  it('supports a fake mint execution port with the legacy call shape', async () => {
    const fakePort: SbtMintExecutionPort = {
      claim: jest.fn(async () => ({ transactionHash: '0xpublic' })),
      claimWithInvite: jest.fn(async () => ({ transactionHash: '0xinvite' })),
      mintWithGroupSignature: jest.fn(async () => ({ transactionHash: '0xgroup' })),
    };
    const sbtAddress = '0x0000000000000000000000000000000000000001';
    const providerRef = { selectedAddress: '0x0000000000000000000000000000000000000002' };

    await expect(
      executeSbtMintFlows(
        fakePort,
        providerRef,
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

    expect(fakePort.claim).toHaveBeenCalledWith(providerRef, sbtAddress);
    expect(fakePort.claimWithInvite).toHaveBeenCalledWith(
      providerRef,
      sbtAddress,
      '7',
      '0xinviteSignature',
    );
    expect(fakePort.mintWithGroupSignature).toHaveBeenCalledWith(
      providerRef,
      sbtAddress,
      '0xgroupSignature',
    );
  });

  it('binds mint execution through a call-time contractScripts getter', async () => {
    const firstContractScripts = {
      claim: jest.fn(async () => ({ transactionHash: '0xfirstClaim' })),
      claimWithInvite: jest.fn(async () => ({ transactionHash: '0xfirstInvite' })),
      mintWithGroupSignature: jest.fn(async () => ({ transactionHash: '0xfirstGroup' })),
    };
    const secondContractScripts = {
      claim: jest.fn(async () => ({ transactionHash: '0xsecondClaim' })),
      claimWithInvite: jest.fn(async () => ({ transactionHash: '0xsecondInvite' })),
      mintWithGroupSignature: jest.fn(async () => ({ transactionHash: '0xsecondGroup' })),
    };
    let currentContractScripts = firstContractScripts;
    const port = bindSbtMintExecutionPort({
      contractScripts: () => currentContractScripts,
    });

    await expect(port.claim('injected', '0x0000000000000000000000000000000000000001'))
      .resolves.toEqual({ transactionHash: '0xfirstClaim' });

    currentContractScripts = secondContractScripts;

    await expect(
      port.claimWithInvite(
        'injected',
        '0x0000000000000000000000000000000000000002',
        '8',
        '0xinviteSignature',
      )
    ).resolves.toEqual({ transactionHash: '0xsecondInvite' });
    await expect(
      port.mintWithGroupSignature(
        'injected',
        '0x0000000000000000000000000000000000000002',
        '0xgroupSignature',
      )
    ).resolves.toEqual({ transactionHash: '0xsecondGroup' });

    expect(firstContractScripts.claim).toHaveBeenCalledWith(
      'injected',
      '0x0000000000000000000000000000000000000001',
    );
    expect(secondContractScripts.claimWithInvite).toHaveBeenCalledWith(
      'injected',
      '0x0000000000000000000000000000000000000002',
      '8',
      '0xinviteSignature',
    );
    expect(secondContractScripts.mintWithGroupSignature).toHaveBeenCalledWith(
      'injected',
      '0x0000000000000000000000000000000000000002',
      '0xgroupSignature',
    );
  });
});
