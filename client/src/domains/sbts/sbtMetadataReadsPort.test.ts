import type { SbtMetadataReadsPort } from './sbtPorts.js';

const readSbtMetadataSnapshot = async (
  port: SbtMetadataReadsPort,
  providerName: string,
  sbtAddress: string,
  groupKeyOrCfg: unknown,
) => {
  const [metadata, mintedTokens, groupPasswordHash] = await Promise.all([
    port.getSbtMetadata(providerName, sbtAddress, groupKeyOrCfg),
    port.getMintedTokens(providerName, sbtAddress, groupKeyOrCfg, {
      allowInjectedReadFallback: true,
    }),
    port.getGroupPasswordHash(providerName, sbtAddress, groupKeyOrCfg, {
      allowInjectedReadFallback: true,
    }),
  ]);

  return {
    metadata,
    mintedTokens,
    groupPasswordHash,
  };
};

describe('SbtMetadataReadsPort', () => {
  it('supports a fake metadata read port with the legacy call shape', async () => {
    const fakePort: SbtMetadataReadsPort = {
      getSbtMetadata: jest.fn(async () => ({ name: 'Alpha SBT' })),
      getMintedTokens: jest.fn(async () => '3'),
      getGroupPasswordHash: jest.fn(async () => '0xhash'),
    };
    const groupKeyOrCfg = { slug: 'alpha' };

    await expect(
      readSbtMetadataSnapshot(fakePort, 'none', '0x0000000000000000000000000000000000000001', groupKeyOrCfg)
    ).resolves.toEqual({
      metadata: { name: 'Alpha SBT' },
      mintedTokens: '3',
      groupPasswordHash: '0xhash',
    });

    expect(fakePort.getSbtMetadata).toHaveBeenCalledWith(
      'none',
      '0x0000000000000000000000000000000000000001',
      groupKeyOrCfg,
    );
    expect(fakePort.getMintedTokens).toHaveBeenCalledWith(
      'none',
      '0x0000000000000000000000000000000000000001',
      groupKeyOrCfg,
      { allowInjectedReadFallback: true },
    );
    expect(fakePort.getGroupPasswordHash).toHaveBeenCalledWith(
      'none',
      '0x0000000000000000000000000000000000000001',
      groupKeyOrCfg,
      { allowInjectedReadFallback: true },
    );
  });
});
