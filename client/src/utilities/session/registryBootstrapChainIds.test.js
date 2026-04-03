import { resolveSessionRegistryBootstrapChainIds } from './registryBootstrapChainIds.js';

describe('resolveSessionRegistryBootstrapChainIds', () => {
  it('pins empty list scope to the active or default chain', () => {
    expect(resolveSessionRegistryBootstrapChainIds({
      scope: 'list',
      list: [],
      activeChainId: 11155420,
      defaultChainId: 84532,
    })).toEqual([11155420]);

    expect(resolveSessionRegistryBootstrapChainIds({
      scope: 'list',
      list: [],
      activeChainId: 0,
      defaultChainId: 11155420,
    })).toEqual([11155420]);
  });

  it('treats general-only list scope as a single-chain bootstrap', () => {
    expect(resolveSessionRegistryBootstrapChainIds({
      scope: 'list',
      list: ['general', ''],
      activeChainId: 11155420,
      defaultChainId: 84532,
    })).toEqual([11155420]);
  });

  it('allows all-chain fanout only when scope explicitly needs broad registry coverage', () => {
    expect(resolveSessionRegistryBootstrapChainIds({
      scope: 'list',
      list: ['edge-session'],
      activeChainId: 11155420,
      defaultChainId: 84532,
    })).toBeUndefined();

    expect(resolveSessionRegistryBootstrapChainIds({
      scope: 'all',
      list: [],
      activeChainId: 11155420,
      defaultChainId: 84532,
    })).toBeUndefined();

    expect(resolveSessionRegistryBootstrapChainIds({
      scope: 'active',
      list: [],
      activeChainId: 11155420,
      defaultChainId: 84532,
      forceAllChains: true,
    })).toBeUndefined();
  });
});
