import type { SbtOwnershipReadsPort } from './sbtPorts.js';
import chainGateway from '../../utilities/web3/chainGateway.js';
import { sbtOwnershipReadsPort } from './sbtOwnershipReadsPort.js';

const readSbtOwnershipSnapshot = async (port: SbtOwnershipReadsPort, sbtAddress: string, sessionSlug: string) => {
  const [owner, tokenId, historySummary] = await Promise.all([
    port.getOwnerByTokenId('none', sbtAddress, '3', sessionSlug),
    port.getSBTTokenIdByOwner('none', sbtAddress, '0x0000000000000000000000000000000000000002', sessionSlug),
    port.getSbtHistorySummary('none', sbtAddress, sessionSlug),
  ]);

  return { owner, tokenId, historySummary };
};

describe('SbtOwnershipReadsPort', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

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

  it('delegates ownership reads through call-time chainGateway property lookup', async () => {
    const getOwnerByTokenId = jest
      .spyOn(chainGateway, 'getOwnerByTokenId')
      .mockResolvedValue('0x0000000000000000000000000000000000000003');
    const getSBTTokenIdByOwner = jest.spyOn(chainGateway, 'getSBTTokenIdByOwner').mockResolvedValue('9');
    const getSbtHistorySummary = jest
      .spyOn(chainGateway, 'getSbtHistorySummary')
      .mockResolvedValue({ totalMinted: '10' });

    await expect(
      sbtOwnershipReadsPort.getOwnerByTokenId('none', '0x0000000000000000000000000000000000000001', '7', 'alpha'),
    ).resolves.toBe('0x0000000000000000000000000000000000000003');

    await expect(
      sbtOwnershipReadsPort.getSBTTokenIdByOwner(
        'none',
        '0x0000000000000000000000000000000000000002',
        '0x0000000000000000000000000000000000000005',
        'beta',
      ),
    ).resolves.toBe('9');
    await expect(
      sbtOwnershipReadsPort.getSbtHistorySummary('none', '0x0000000000000000000000000000000000000002', 'beta'),
    ).resolves.toEqual({ totalMinted: '10' });

    expect(getOwnerByTokenId).toHaveBeenCalledWith('none', '0x0000000000000000000000000000000000000001', '7', 'alpha');
    expect(getSBTTokenIdByOwner).toHaveBeenCalledWith(
      'none',
      '0x0000000000000000000000000000000000000002',
      '0x0000000000000000000000000000000000000005',
      'beta',
    );
    expect(getSbtHistorySummary).toHaveBeenCalledWith('none', '0x0000000000000000000000000000000000000002', 'beta');
  });
});
