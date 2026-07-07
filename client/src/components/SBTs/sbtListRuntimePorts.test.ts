import { bindSbtListRuntimePorts } from './sbtListRuntimePorts';

describe('sbtListRuntimePorts', () => {
  it('resolves current runtime bindings when contract helpers are called', async () => {
    const firstContractScripts = {
      getGroupPasswordHash: jest.fn(async () => 'first-hash'),
      getRelevantBlockWindowForFilter: jest.fn(async () => ({ toBlock: 10 })),
    };
    const secondContractScripts = {
      getGroupPasswordHash: jest.fn(async () => 'second-hash'),
      getRelevantBlockWindowForFilter: jest.fn(async () => ({ toBlock: 22 })),
    };
    let currentContractScripts: unknown = firstContractScripts;

    const ports = bindSbtListRuntimePorts({
      contractScripts: () => currentContractScripts,
      hasCachedCreateSbtForm: () => jest.fn(() => false),
    });

    await expect(ports.contractScripts.getGroupPasswordHash('none', '0x1', 'alpha')).resolves.toBe('first-hash');
    await expect(ports.contractScripts.getRelevantBlockWindowForFilter({ slug: 'alpha' })).resolves.toEqual({
      toBlock: 10,
    });

    currentContractScripts = secondContractScripts;

    await expect(ports.contractScripts.getGroupPasswordHash('none', '0x2', 'beta')).resolves.toBe('second-hash');
    await expect(ports.contractScripts.getRelevantBlockWindowForFilter({ slug: 'beta' })).resolves.toEqual({
      toBlock: 22,
    });
    expect(secondContractScripts.getGroupPasswordHash).toHaveBeenCalledWith('none', '0x2', 'beta', undefined);
  });

  it('resolves current create-form cache reader when checking initial visibility', () => {
    const firstReader = jest.fn(() => false);
    const secondReader = jest.fn(() => true);
    let currentReader: unknown = firstReader;

    const ports = bindSbtListRuntimePorts({
      contractScripts: () => ({
        getGroupPasswordHash: jest.fn(),
        getRelevantBlockWindowForFilter: jest.fn(),
      }),
      hasCachedCreateSbtForm: () => currentReader,
    });

    expect(ports.hasCachedCreateSbtForm({ slug: 'alpha' })).toBe(false);

    currentReader = secondReader;

    expect(ports.hasCachedCreateSbtForm({ slug: 'beta' })).toBe(true);
    expect(secondReader).toHaveBeenCalledWith({ slug: 'beta' });
  });
});
