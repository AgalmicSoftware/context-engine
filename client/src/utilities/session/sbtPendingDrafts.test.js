import { buildPendingSbtDeploySessionConfig, clonePendingSbtDeployContracts } from './sbtPendingDrafts.js';

describe('sbtPendingDrafts helpers', () => {
  it('normalizes pending SBT contract entries from strings and alias fields', () => {
    expect(
      clonePendingSbtDeployContracts({
        featured: ' 0x00000000000000000000000000000000000000aa ',
        invite: {
          contractAddress: '0x00000000000000000000000000000000000000bb',
          chainID: '84532',
        },
        chainOnly: {
          chain: 11155420,
        },
        empty: '',
        list: ['0x00000000000000000000000000000000000000cc'],
      }),
    ).toEqual({
      featured: {
        address: '0x00000000000000000000000000000000000000aa',
      },
      invite: {
        address: '0x00000000000000000000000000000000000000bb',
        chainId: 84532,
      },
      chainOnly: {
        chainId: 11155420,
      },
    });
  });

  it('builds a minimal deploy session config from fallback inputs', () => {
    expect(
      buildPendingSbtDeploySessionConfig({
        sessionSlug: 'edge-session',
        networkChainId: '84532',
        contracts: {
          access: {
            addr: '0x00000000000000000000000000000000000000aa',
          },
        },
      }),
    ).toEqual({
      slug: 'edge-session',
      networkChainId: 84532,
      contracts: {
        access: {
          address: '0x00000000000000000000000000000000000000aa',
        },
      },
    });
  });

  it('prefers explicit contract input over session config contracts', () => {
    expect(
      buildPendingSbtDeploySessionConfig({
        sessionConfig: {
          sessionSlug: 'registry-session',
          chainId: 11155420,
          contracts: {
            stale: '0x00000000000000000000000000000000000000ff',
          },
        },
        contracts: {
          fresh: {
            target: '0x00000000000000000000000000000000000000dd',
            chainId: '84532',
          },
        },
      }),
    ).toEqual({
      slug: 'registry-session',
      networkChainId: 11155420,
      contracts: {
        fresh: {
          address: '0x00000000000000000000000000000000000000dd',
          chainId: 84532,
        },
      },
    });
  });

  it('returns null when no deploy context is available', () => {
    expect(
      buildPendingSbtDeploySessionConfig({
        sessionConfig: [],
        contracts: [],
      }),
    ).toBeNull();
  });
});
