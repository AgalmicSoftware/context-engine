import type { ethers } from 'ethers';
import type { SbtMetadataReadsPort, SbtProviderRef } from './sbtPorts.js';
import { bindSbtMetadataReadsPort } from './sbtMetadataReadsPort.js';

const readSbtMetadataSnapshot = async (
  port: SbtMetadataReadsPort,
  providerName: SbtProviderRef,
  sbtAddress: string,
  groupKeyOrCfg: unknown,
) => {
  const [metadata, mintedTokens, groupPasswordHash, creationBlock] = await Promise.all([
    port.getSbtMetadata(providerName, sbtAddress, groupKeyOrCfg),
    port.getMintedTokens(providerName, sbtAddress, groupKeyOrCfg, {
      allowInjectedReadFallback: true,
    }),
    port.getGroupPasswordHash(providerName, sbtAddress, groupKeyOrCfg, {
      allowInjectedReadFallback: true,
    }),
    port.getSbtCreationBlockByAddress(providerName, sbtAddress, groupKeyOrCfg, {
      allowInjectedReadFallback: true,
    }),
  ]);

  return {
    metadata,
    mintedTokens,
    groupPasswordHash,
    creationBlock,
  };
};

describe('SbtMetadataReadsPort', () => {
  it('supports a fake metadata read port with the legacy call shape', async () => {
    const fakePort: SbtMetadataReadsPort = {
      getSbtMetadata: jest.fn(async () => ({ name: 'Alpha SBT' })),
      getMintedTokens: jest.fn(async () => '3'),
      getGroupPasswordHash: jest.fn(async () => '0xhash'),
      getSbtCreationBlockByAddress: jest.fn(async () => 12),
      getSbtOnChainConfig: jest.fn(async () => ({
        maxTokens: '10',
        collectionBurnAuth: '1',
        mintingEndTime: '0',
        hasPasswordMint: false,
        admin: '0x0000000000000000000000000000000000000002',
        owner: '0x0000000000000000000000000000000000000003',
      })),
    };
    const groupKeyOrCfg = { slug: 'alpha' };
    const providerRef = { selectedAddress: '0x0000000000000000000000000000000000000004' };

    await expect(
      readSbtMetadataSnapshot(fakePort, providerRef, '0x0000000000000000000000000000000000000001', groupKeyOrCfg),
    ).resolves.toEqual({
      metadata: { name: 'Alpha SBT' },
      mintedTokens: '3',
      groupPasswordHash: '0xhash',
      creationBlock: 12,
    });

    expect(fakePort.getSbtMetadata).toHaveBeenCalledWith(
      providerRef,
      '0x0000000000000000000000000000000000000001',
      groupKeyOrCfg,
    );
    expect(fakePort.getMintedTokens).toHaveBeenCalledWith(
      providerRef,
      '0x0000000000000000000000000000000000000001',
      groupKeyOrCfg,
      { allowInjectedReadFallback: true },
    );
    expect(fakePort.getGroupPasswordHash).toHaveBeenCalledWith(
      providerRef,
      '0x0000000000000000000000000000000000000001',
      groupKeyOrCfg,
      { allowInjectedReadFallback: true },
    );
    expect(fakePort.getSbtCreationBlockByAddress).toHaveBeenCalledWith(
      providerRef,
      '0x0000000000000000000000000000000000000001',
      groupKeyOrCfg,
      { allowInjectedReadFallback: true },
    );
  });

  it('binds metadata reads through a call-time chainGateway getter', async () => {
    const firstChainGateway = {
      getSbtMetadata: jest.fn(async () => ({ name: 'First' })),
      getMintedTokens: jest.fn(async () => '1'),
      getGroupPasswordHash: jest.fn(async () => '0xfirst'),
      getSbtCreationBlockByAddress: jest.fn(async () => 11),
    };
    const secondChainGateway = {
      getSbtMetadata: jest.fn(async () => ({ name: 'Second' })),
      getMintedTokens: jest.fn(async () => '2'),
      getGroupPasswordHash: jest.fn(async () => '0xsecond'),
      getSbtCreationBlockByAddress: jest.fn(async () => 22),
    };
    let currentChainGateway = firstChainGateway;
    const port = bindSbtMetadataReadsPort({
      chainGateway: () => currentChainGateway,
    });

    await expect(port.getSbtMetadata('none', '0x0000000000000000000000000000000000000001', 'alpha')).resolves.toEqual({
      name: 'First',
    });

    currentChainGateway = secondChainGateway;

    await expect(port.getMintedTokens('none', '0x0000000000000000000000000000000000000002', 'beta')).resolves.toBe('2');
    await expect(port.getGroupPasswordHash('none', '0x0000000000000000000000000000000000000002', 'beta')).resolves.toBe(
      '0xsecond',
    );
    await expect(
      port.getSbtCreationBlockByAddress('none', '0x0000000000000000000000000000000000000002', 'beta'),
    ).resolves.toBe(22);

    expect(firstChainGateway.getSbtMetadata).toHaveBeenCalledWith(
      'none',
      '0x0000000000000000000000000000000000000001',
      'alpha',
    );
    expect(secondChainGateway.getMintedTokens).toHaveBeenCalledWith(
      'none',
      '0x0000000000000000000000000000000000000002',
      'beta',
      undefined,
    );
    expect(secondChainGateway.getGroupPasswordHash).toHaveBeenCalledWith(
      'none',
      '0x0000000000000000000000000000000000000002',
      'beta',
      undefined,
    );
    expect(secondChainGateway.getSbtCreationBlockByAddress).toHaveBeenCalledWith(
      'none',
      '0x0000000000000000000000000000000000000002',
      'beta',
    );
  });

  it('reads on-chain config through the SBT read provider', async () => {
    const provider = {} as ethers.providers.Provider;
    const contract = {
      maxTokens: jest.fn(async () => '10'),
      collectionBurnAuth: jest.fn(async () => '1'),
      mintingEndTime: jest.fn(async () => '0'),
      hasPasswordMint: jest.fn(async () => false),
      admin: jest.fn(async () => '0x0000000000000000000000000000000000000002'),
      owner: jest.fn(async () => '0x0000000000000000000000000000000000000003'),
    };
    const chainGateway = {
      getSbtMetadata: jest.fn(async () => ({ name: 'Alpha' })),
      getMintedTokens: jest.fn(async () => '1'),
      getGroupPasswordHash: jest.fn(async () => '0xhash'),
      getSbtCreationBlockByAddress: jest.fn(async () => 12),
      getReadProviderForGroup: jest.fn(() => provider),
    };
    const createOnChainConfigContract = jest.fn(() => contract);
    const port = bindSbtMetadataReadsPort({
      chainGateway: () => chainGateway,
      createOnChainConfigContract,
    });
    const sbtAddress = '0x0000000000000000000000000000000000000001';

    await expect(port.getSbtOnChainConfig('none', sbtAddress, 'alpha')).resolves.toEqual({
      maxTokens: '10',
      collectionBurnAuth: '1',
      mintingEndTime: '0',
      hasPasswordMint: false,
      admin: '0x0000000000000000000000000000000000000002',
      owner: '0x0000000000000000000000000000000000000003',
    });

    expect(chainGateway.getReadProviderForGroup).toHaveBeenCalledWith('alpha', {
      contractKey: 'sbtFactory',
    });
    expect(createOnChainConfigContract).toHaveBeenCalledWith(
      sbtAddress,
      expect.arrayContaining([
        'function maxTokens() view returns (uint256)',
        'function owner() view returns (address)',
      ]),
      provider,
    );
    expect(contract.maxTokens).toHaveBeenCalled();
    expect(contract.collectionBurnAuth).toHaveBeenCalled();
    expect(contract.mintingEndTime).toHaveBeenCalled();
    expect(contract.hasPasswordMint).toHaveBeenCalled();
    expect(contract.admin).toHaveBeenCalled();
    expect(contract.owner).toHaveBeenCalled();
  });

  it('only invokes requested on-chain config methods', async () => {
    const provider = {} as ethers.providers.Provider;
    const contract = {
      maxTokens: jest.fn(async () => '10'),
      collectionBurnAuth: jest.fn(async () => '2'),
      mintingEndTime: jest.fn(async () => '0'),
      hasPasswordMint: jest.fn(async () => true),
      admin: jest.fn(async () => '0x0000000000000000000000000000000000000002'),
      owner: jest.fn(async () => '0x0000000000000000000000000000000000000003'),
    };
    const chainGateway = {
      getSbtMetadata: jest.fn(async () => ({ name: 'Alpha' })),
      getMintedTokens: jest.fn(async () => '1'),
      getGroupPasswordHash: jest.fn(async () => '0xhash'),
      getSbtCreationBlockByAddress: jest.fn(async () => 12),
      getReadProviderForGroup: jest.fn(() => provider),
    };
    const port = bindSbtMetadataReadsPort({
      chainGateway: () => chainGateway,
      createOnChainConfigContract: jest.fn(() => contract),
    });

    await expect(
      port.getSbtOnChainConfig('none', '0x0000000000000000000000000000000000000001', 'alpha', {
        collectionBurnAuth: true,
        adminAndOwner: true,
      }),
    ).resolves.toEqual({
      maxTokens: null,
      collectionBurnAuth: '2',
      mintingEndTime: null,
      hasPasswordMint: null,
      admin: '0x0000000000000000000000000000000000000002',
      owner: '0x0000000000000000000000000000000000000003',
    });

    expect(contract.maxTokens).not.toHaveBeenCalled();
    expect(contract.collectionBurnAuth).toHaveBeenCalledTimes(1);
    expect(contract.mintingEndTime).not.toHaveBeenCalled();
    expect(contract.hasPasswordMint).not.toHaveBeenCalled();
    expect(contract.admin).toHaveBeenCalledTimes(1);
    expect(contract.owner).toHaveBeenCalledTimes(1);
  });

  it('returns null for a requested on-chain config method that times out', async () => {
    jest.useFakeTimers();
    try {
      const provider = {} as ethers.providers.Provider;
      const contract = {
        maxTokens: jest.fn(() => new Promise<unknown>(() => undefined)),
        collectionBurnAuth: jest.fn(async () => '2'),
        mintingEndTime: jest.fn(async () => '0'),
        hasPasswordMint: jest.fn(async () => true),
        admin: jest.fn(async () => '0x0000000000000000000000000000000000000002'),
        owner: jest.fn(async () => '0x0000000000000000000000000000000000000003'),
      };
      const chainGateway = {
        getSbtMetadata: jest.fn(async () => ({ name: 'Alpha' })),
        getMintedTokens: jest.fn(async () => '1'),
        getGroupPasswordHash: jest.fn(async () => '0xhash'),
        getSbtCreationBlockByAddress: jest.fn(async () => 12),
        getReadProviderForGroup: jest.fn(() => provider),
      };
      const port = bindSbtMetadataReadsPort({
        chainGateway: () => chainGateway,
        createOnChainConfigContract: jest.fn(() => contract),
      });

      const result = port.getSbtOnChainConfig('none', '0x0000000000000000000000000000000000000001', 'alpha', {
        maxTokens: true,
      });
      await jest.advanceTimersByTimeAsync(750);

      await expect(result).resolves.toEqual({
        maxTokens: null,
        collectionBurnAuth: null,
        mintingEndTime: null,
        hasPasswordMint: null,
        admin: null,
        owner: null,
      });
      expect(contract.maxTokens).toHaveBeenCalledTimes(1);
      expect(contract.collectionBurnAuth).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('returns null for a requested on-chain config method that rejects', async () => {
    const provider = {} as ethers.providers.Provider;
    const contract = {
      maxTokens: jest.fn(async () => '10'),
      collectionBurnAuth: jest.fn(async () => {
        throw new Error('burn read failed');
      }),
      mintingEndTime: jest.fn(async () => '0'),
      hasPasswordMint: jest.fn(async () => true),
      admin: jest.fn(async () => '0x0000000000000000000000000000000000000002'),
      owner: jest.fn(async () => '0x0000000000000000000000000000000000000003'),
    };
    const chainGateway = {
      getSbtMetadata: jest.fn(async () => ({ name: 'Alpha' })),
      getMintedTokens: jest.fn(async () => '1'),
      getGroupPasswordHash: jest.fn(async () => '0xhash'),
      getSbtCreationBlockByAddress: jest.fn(async () => 12),
      getReadProviderForGroup: jest.fn(() => provider),
    };
    const port = bindSbtMetadataReadsPort({
      chainGateway: () => chainGateway,
      createOnChainConfigContract: jest.fn(() => contract),
    });

    await expect(
      port.getSbtOnChainConfig('none', '0x0000000000000000000000000000000000000001', 'alpha', {
        collectionBurnAuth: true,
      }),
    ).resolves.toEqual({
      maxTokens: null,
      collectionBurnAuth: null,
      mintingEndTime: null,
      hasPasswordMint: null,
      admin: null,
      owner: null,
    });

    expect(contract.collectionBurnAuth).toHaveBeenCalledTimes(1);
    expect(contract.maxTokens).not.toHaveBeenCalled();
  });

  it('throws when no SBT read provider resolver is available', async () => {
    const chainGateway = {
      getSbtMetadata: jest.fn(async () => ({ name: 'Alpha' })),
      getMintedTokens: jest.fn(async () => '1'),
      getGroupPasswordHash: jest.fn(async () => '0xhash'),
      getSbtCreationBlockByAddress: jest.fn(async () => 12),
    };
    const port = bindSbtMetadataReadsPort({
      chainGateway: () => chainGateway,
      createOnChainConfigContract: jest.fn(() => ({
        maxTokens: jest.fn(async () => '10'),
        collectionBurnAuth: jest.fn(async () => '2'),
        mintingEndTime: jest.fn(async () => '0'),
        hasPasswordMint: jest.fn(async () => false),
        admin: jest.fn(async () => '0x0000000000000000000000000000000000000002'),
        owner: jest.fn(async () => '0x0000000000000000000000000000000000000003'),
      })),
    });

    await expect(
      port.getSbtOnChainConfig('none', '0x0000000000000000000000000000000000000001', 'alpha', { maxTokens: true }),
    ).rejects.toThrow('Unable to resolve read provider for SBT on-chain config.');
  });
});
