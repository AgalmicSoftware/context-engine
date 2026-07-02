import type { SbtOwnershipReadsPort } from './sbtPorts.js';
import { bindSbtOwnershipReadsPort } from './contractScriptsSbtOwnershipReadsPort.js';

const readSbtOwnershipSnapshot = async (
  port: SbtOwnershipReadsPort,
  sbtAddress: string,
  sessionSlug: string,
) => {
  const [owner, tokenId, historySummary] = await Promise.all([
    port.getOwnerByTokenId('none', sbtAddress, '3', sessionSlug),
    port.getSBTTokenIdByOwner('none', sbtAddress, '0x0000000000000000000000000000000000000002', sessionSlug),
    port.getSbtHistorySummary('none', sbtAddress, sessionSlug),
  ]);

  return { owner, tokenId, historySummary };
};

describe('SbtOwnershipReadsPort', () => {
  it('supports a fake ownership reads port with the legacy call shape', async () => {
    const fakePort: SbtOwnershipReadsPort = {
      getOwnerByTokenId: jest.fn(async () => '0x0000000000000000000000000000000000000002'),
      getSBTTokenIdByOwner: jest.fn(async () => '3'),
      getSbtHistorySummary: jest.fn(async () => ({ totalMinted: '4', activeSupply: '3' })),
    };
    const sbtAddress = '0x0000000000000000000000000000000000000001';

    await expect(readSbtOwnershipSnapshot(fakePort, sbtAddress, 'alpha')).resolves.toEqual({
      owner: '0x0000000000000000000000000000000000000002',
      tokenId: '3',
      historySummary: { totalMinted: '4', activeSupply: '3' },
    });

    expect(fakePort.getOwnerByTokenId).toHaveBeenCalledWith('none', sbtAddress, '3', 'alpha');
    expect(fakePort.getSBTTokenIdByOwner).toHaveBeenCalledWith(
      'none',
      sbtAddress,
      '0x0000000000000000000000000000000000000002',
      'alpha',
    );
    expect(fakePort.getSbtHistorySummary).toHaveBeenCalledWith('none', sbtAddress, 'alpha');
  });

  it('binds ownership reads through a call-time contractScripts getter', async () => {
    const firstContractScripts = {
      getOwnerByTokenId: jest.fn(async () => '0x0000000000000000000000000000000000000003'),
      getSBTTokenIdByOwner: jest.fn(async () => '7'),
      getSbtHistorySummary: jest.fn(async () => ({ totalMinted: '8' })),
    };
    const secondContractScripts = {
      getOwnerByTokenId: jest.fn(async () => '0x0000000000000000000000000000000000000004'),
      getSBTTokenIdByOwner: jest.fn(async () => '9'),
      getSbtHistorySummary: jest.fn(async () => ({ totalMinted: '10' })),
    };
    let currentContractScripts = firstContractScripts;
    const port = bindSbtOwnershipReadsPort({
      contractScripts: () => currentContractScripts,
    });

    await expect(port.getOwnerByTokenId('none', '0x0000000000000000000000000000000000000001', '7', 'alpha'))
      .resolves.toBe('0x0000000000000000000000000000000000000003');

    currentContractScripts = secondContractScripts;

    await expect(port.getSBTTokenIdByOwner(
      'none',
      '0x0000000000000000000000000000000000000002',
      '0x0000000000000000000000000000000000000005',
      'beta',
    )).resolves.toBe('9');
    await expect(port.getSbtHistorySummary('none', '0x0000000000000000000000000000000000000002', 'beta'))
      .resolves.toEqual({ totalMinted: '10' });

    expect(firstContractScripts.getOwnerByTokenId).toHaveBeenCalledWith(
      'none',
      '0x0000000000000000000000000000000000000001',
      '7',
      'alpha',
    );
    expect(secondContractScripts.getSBTTokenIdByOwner).toHaveBeenCalledWith(
      'none',
      '0x0000000000000000000000000000000000000002',
      '0x0000000000000000000000000000000000000005',
      'beta',
    );
    expect(secondContractScripts.getSbtHistorySummary).toHaveBeenCalledWith(
      'none',
      '0x0000000000000000000000000000000000000002',
      'beta',
    );
  });
});
