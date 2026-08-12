import { updateCacheAtomic } from '../../utilities/cache/cacheScripts.js';
import { persistCommunitySbtHolderHydrationResults } from './communitySbtHolderHydrationCache.js';

jest.mock('../../utilities/cache/cacheScripts.js', () => ({
  updateCacheAtomic: jest.fn(),
}));

const updateCacheAtomicMock = updateCacheAtomic as jest.Mock;

describe('persistCommunitySbtHolderHydrationResults', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('merges a stale holder scan without erasing newer realtime counts or checkpoints', async () => {
    const current = {
      untouched: { sbtList: {} },
      '84532': {
        sbtList: {
          '0xsbt': {
            sbtAddress: '0xSBT',
            blockNumber: 105,
            countsLoaded: false,
            countsScanCheckpoint: { phase: 'activity', blockNumber: 110 },
            mintedAddresses: ['0xholder'],
            burnedAddresses: [],
            mintedCountByAddress: { '0xholder': 2 },
            burnedCountByAddress: {},
            mintedEventCount: 2,
            burnedEventCount: 0,
          },
        },
      },
    };
    updateCacheAtomicMock.mockImplementation(async (...args: unknown[]) => {
      const updater = args[2] as (value: unknown) => unknown;
      return updater(current);
    });

    const persisted = await persistCommunitySbtHolderHydrationResults({
      slug: 'edge',
      netKey: '84532',
      results: [
        {
          addr: '0xSBT',
          lower: '0xsbt',
          countsOk: true,
          mintedAddresses: ['0xholder'],
          burnedAddresses: [],
          counts: {
            scannedToBlock: 100,
            mintedCountByAddress: { '0xholder': 1 },
            burnedCountByAddress: {},
            mintedEventCount: 1,
            burnedEventCount: 0,
          },
        },
      ],
    });

    expect(updateCacheAtomicMock).toHaveBeenCalledWith('sbtCache', 'edge', expect.any(Function));
    expect(persisted).toMatchObject({
      untouched: { sbtList: {} },
      '84532': {
        sbtList: {
          '0xsbt': {
            blockNumber: 105,
            countsLoaded: false,
            countsScanCheckpoint: { phase: 'activity', blockNumber: 110 },
            mintedCountByAddress: { '0xholder': 2 },
            mintedEventCount: 2,
          },
        },
      },
    });
  });
});
