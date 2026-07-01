import type { SbtMetadataReadsPort } from './sbtPorts.js';
import { bindSbtMetadataReadsPort } from './contractScriptsSbtMetadataReadsPort.js';

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

  it('binds metadata reads through a call-time contractScripts getter', async () => {
    const firstContractScripts = {
      getSbtMetadata: jest.fn(async () => ({ name: 'First' })),
      getMintedTokens: jest.fn(async () => '1'),
      getGroupPasswordHash: jest.fn(async () => '0xfirst'),
    };
    const secondContractScripts = {
      getSbtMetadata: jest.fn(async () => ({ name: 'Second' })),
      getMintedTokens: jest.fn(async () => '2'),
      getGroupPasswordHash: jest.fn(async () => '0xsecond'),
    };
    let currentContractScripts = firstContractScripts;
    const port = bindSbtMetadataReadsPort({
      contractScripts: () => currentContractScripts,
    });

    await expect(port.getSbtMetadata('none', '0x0000000000000000000000000000000000000001', 'alpha'))
      .resolves.toEqual({ name: 'First' });

    currentContractScripts = secondContractScripts;

    await expect(port.getMintedTokens('none', '0x0000000000000000000000000000000000000002', 'beta'))
      .resolves.toBe('2');
    await expect(port.getGroupPasswordHash('none', '0x0000000000000000000000000000000000000002', 'beta'))
      .resolves.toBe('0xsecond');

    expect(firstContractScripts.getSbtMetadata).toHaveBeenCalledWith(
      'none',
      '0x0000000000000000000000000000000000000001',
      'alpha',
    );
    expect(secondContractScripts.getMintedTokens).toHaveBeenCalledWith(
      'none',
      '0x0000000000000000000000000000000000000002',
      'beta',
      undefined,
    );
    expect(secondContractScripts.getGroupPasswordHash).toHaveBeenCalledWith(
      'none',
      '0x0000000000000000000000000000000000000002',
      'beta',
      undefined,
    );
  });
});
