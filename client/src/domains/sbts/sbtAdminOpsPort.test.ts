import type { SbtAdminOpsPort, SbtProviderRef } from './sbtPorts.js';
import chainGateway from '../../utilities/web3/chainGateway.js';
import { sbtAdminOpsPort } from './sbtAdminOpsPort.js';

const executeSbtAdminOps = async (port: SbtAdminOpsPort, providerName: SbtProviderRef, sbtAddress: string) => {
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
  afterEach(() => {
    jest.restoreAllMocks();
  });

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

  it('delegates admin ops through call-time chainGateway property lookup', async () => {
    const addHashedPasswords = jest
      .spyOn(chainGateway, 'addHashedPasswords')
      .mockResolvedValue({ transactionHash: '0xfirstAdd' });
    const burnToken = jest.spyOn(chainGateway, 'burnToken').mockResolvedValue({ transactionHash: '0xsecondBurn' });
    const claimWithPassword = jest
      .spyOn(chainGateway, 'claimWithPassword')
      .mockResolvedValue({ transactionHash: '0xsecondPassword' });
    const isPasswordValid = jest.spyOn(chainGateway, 'isPasswordValid').mockResolvedValue(true);
    const startClaim = jest.spyOn(chainGateway, 'startClaim').mockResolvedValue({ transactionHash: '0xsecondStart' });

    await expect(
      sbtAdminOpsPort.addHashedPasswords('injected', '0x0000000000000000000000000000000000000001', ['0xfirst']),
    ).resolves.toEqual({ transactionHash: '0xfirstAdd' });

    await expect(
      sbtAdminOpsPort.burnToken('injected', '0x0000000000000000000000000000000000000002', '5'),
    ).resolves.toEqual({ transactionHash: '0xsecondBurn' });
    await expect(
      sbtAdminOpsPort.claimWithPassword('injected', '0x0000000000000000000000000000000000000002', 'pw'),
    ).resolves.toEqual({ transactionHash: '0xsecondPassword' });
    await expect(
      sbtAdminOpsPort.isPasswordValid('none', '0x0000000000000000000000000000000000000002', '0xhash', 'beta'),
    ).resolves.toBe(true);
    await expect(
      sbtAdminOpsPort.startClaim('injected', '0x0000000000000000000000000000000000000002', '0xcommit'),
    ).resolves.toEqual({ transactionHash: '0xsecondStart' });

    expect(addHashedPasswords).toHaveBeenCalledWith('injected', '0x0000000000000000000000000000000000000001', [
      '0xfirst',
    ]);
    expect(burnToken).toHaveBeenCalledWith('injected', '0x0000000000000000000000000000000000000002', '5');
    expect(claimWithPassword).toHaveBeenCalledWith('injected', '0x0000000000000000000000000000000000000002', 'pw');
    expect(isPasswordValid).toHaveBeenCalledWith(
      'none',
      '0x0000000000000000000000000000000000000002',
      '0xhash',
      'beta',
    );
    expect(startClaim).toHaveBeenCalledWith('injected', '0x0000000000000000000000000000000000000002', '0xcommit');
  });
});
