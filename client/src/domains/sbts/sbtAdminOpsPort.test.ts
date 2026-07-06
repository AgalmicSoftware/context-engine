import type { SbtAdminOpsPort, SbtProviderRef } from './sbtPorts.js';
import { bindSbtAdminOpsPort } from './sbtAdminOpsPort.js';

const executeSbtAdminOps = async (
  port: SbtAdminOpsPort,
  providerName: SbtProviderRef,
  sbtAddress: string,
) => {
  const [addTx, burnTx, passwordTx, isValid, startTx] = await Promise.all([
    port.addHashedPasswords(providerName, sbtAddress, ['0xhash1', '0xhash2']),
    port.burnToken(providerName, sbtAddress, '4'),
    port.claimWithPassword(providerName, sbtAddress, 'open sesame'),
    port.isPasswordValid(providerName, sbtAddress, '0xpasswordHash', 'alpha'),
    port.startClaim(providerName, sbtAddress, '0xcommit'),
  ]);

  return { addTx, burnTx, passwordTx, isValid, startTx };
};

describe('SbtAdminOpsPort', () => {
  it('supports a fake admin ops port with the legacy call shape', async () => {
    const fakePort: SbtAdminOpsPort = {
      addHashedPasswords: jest.fn(async () => ({ transactionHash: '0xadd' })),
      burnToken: jest.fn(async () => ({ transactionHash: '0xburn' })),
      claimWithPassword: jest.fn(async () => ({ transactionHash: '0xpassword' })),
      isPasswordValid: jest.fn(async () => true),
      startClaim: jest.fn(async () => ({ transactionHash: '0xstart' })),
    };
    const providerRef = { selectedAddress: '0x0000000000000000000000000000000000000002' };
    const sbtAddress = '0x0000000000000000000000000000000000000001';

    await expect(executeSbtAdminOps(fakePort, providerRef, sbtAddress)).resolves.toEqual({
      addTx: { transactionHash: '0xadd' },
      burnTx: { transactionHash: '0xburn' },
      passwordTx: { transactionHash: '0xpassword' },
      isValid: true,
      startTx: { transactionHash: '0xstart' },
    });

    expect(fakePort.addHashedPasswords).toHaveBeenCalledWith(providerRef, sbtAddress, ['0xhash1', '0xhash2']);
    expect(fakePort.burnToken).toHaveBeenCalledWith(providerRef, sbtAddress, '4');
    expect(fakePort.claimWithPassword).toHaveBeenCalledWith(providerRef, sbtAddress, 'open sesame');
    expect(fakePort.isPasswordValid).toHaveBeenCalledWith(providerRef, sbtAddress, '0xpasswordHash', 'alpha');
    expect(fakePort.startClaim).toHaveBeenCalledWith(providerRef, sbtAddress, '0xcommit');
  });

  it('binds admin ops through a call-time chainGateway getter', async () => {
    const firstChainGateway = {
      addHashedPasswords: jest.fn(async () => ({ transactionHash: '0xfirstAdd' })),
      burnToken: jest.fn(async () => ({ transactionHash: '0xfirstBurn' })),
      claimWithPassword: jest.fn(async () => ({ transactionHash: '0xfirstPassword' })),
      isPasswordValid: jest.fn(async () => false),
      startClaim: jest.fn(async () => ({ transactionHash: '0xfirstStart' })),
    };
    const secondChainGateway = {
      addHashedPasswords: jest.fn(async () => ({ transactionHash: '0xsecondAdd' })),
      burnToken: jest.fn(async () => ({ transactionHash: '0xsecondBurn' })),
      claimWithPassword: jest.fn(async () => ({ transactionHash: '0xsecondPassword' })),
      isPasswordValid: jest.fn(async () => true),
      startClaim: jest.fn(async () => ({ transactionHash: '0xsecondStart' })),
    };
    let currentChainGateway = firstChainGateway;
    const port = bindSbtAdminOpsPort({
      chainGateway: () => currentChainGateway,
    });

    await expect(port.addHashedPasswords('injected', '0x0000000000000000000000000000000000000001', ['0xfirst']))
      .resolves.toEqual({ transactionHash: '0xfirstAdd' });

    currentChainGateway = secondChainGateway;

    await expect(port.burnToken('injected', '0x0000000000000000000000000000000000000002', '5'))
      .resolves.toEqual({ transactionHash: '0xsecondBurn' });
    await expect(port.claimWithPassword('injected', '0x0000000000000000000000000000000000000002', 'pw'))
      .resolves.toEqual({ transactionHash: '0xsecondPassword' });
    await expect(port.isPasswordValid('none', '0x0000000000000000000000000000000000000002', '0xhash', 'beta'))
      .resolves.toBe(true);
    await expect(port.startClaim('injected', '0x0000000000000000000000000000000000000002', '0xcommit'))
      .resolves.toEqual({ transactionHash: '0xsecondStart' });

    expect(firstChainGateway.addHashedPasswords).toHaveBeenCalledWith(
      'injected',
      '0x0000000000000000000000000000000000000001',
      ['0xfirst'],
    );
    expect(secondChainGateway.burnToken).toHaveBeenCalledWith(
      'injected',
      '0x0000000000000000000000000000000000000002',
      '5',
    );
    expect(secondChainGateway.claimWithPassword).toHaveBeenCalledWith(
      'injected',
      '0x0000000000000000000000000000000000000002',
      'pw',
    );
    expect(secondChainGateway.isPasswordValid).toHaveBeenCalledWith(
      'none',
      '0x0000000000000000000000000000000000000002',
      '0xhash',
      'beta',
    );
    expect(secondChainGateway.startClaim).toHaveBeenCalledWith(
      'injected',
      '0x0000000000000000000000000000000000000002',
      '0xcommit',
    );
  });
});
