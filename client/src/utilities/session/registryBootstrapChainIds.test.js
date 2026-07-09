import { DEFAULT_CHAIN_ID } from '../../variables/appConfig.js';
import { resolveSessionRegistryBootstrapChainIds } from './registryBootstrapChainIds.js';

const CONFIGURED_DEFAULT_CHAIN_ID = DEFAULT_CHAIN_ID;
const OTHER_CHAIN_ID = CONFIGURED_DEFAULT_CHAIN_ID === 84532 ? 8453 : 84532;

describe('resolveSessionRegistryBootstrapChainIds', () => {
  it('pins empty list scope to the active or default chain', () => {
    expect(
      resolveSessionRegistryBootstrapChainIds({
        scope: 'list',
        list: [],
        activeChainId: CONFIGURED_DEFAULT_CHAIN_ID,
        defaultChainId: OTHER_CHAIN_ID,
      }),
    ).toEqual([CONFIGURED_DEFAULT_CHAIN_ID]);

    expect(
      resolveSessionRegistryBootstrapChainIds({
        scope: 'list',
        list: [],
        activeChainId: 0,
        defaultChainId: CONFIGURED_DEFAULT_CHAIN_ID,
      }),
    ).toEqual([CONFIGURED_DEFAULT_CHAIN_ID]);
  });

  it('treats general-only list scope as a single-chain bootstrap', () => {
    expect(
      resolveSessionRegistryBootstrapChainIds({
        scope: 'list',
        list: ['general', ''],
        activeChainId: CONFIGURED_DEFAULT_CHAIN_ID,
        defaultChainId: OTHER_CHAIN_ID,
      }),
    ).toEqual([CONFIGURED_DEFAULT_CHAIN_ID]);
  });

  it('allows all-chain fanout only when scope explicitly needs broad registry coverage', () => {
    expect(
      resolveSessionRegistryBootstrapChainIds({
        scope: 'list',
        list: ['edge-session'],
        activeChainId: CONFIGURED_DEFAULT_CHAIN_ID,
        defaultChainId: OTHER_CHAIN_ID,
      }),
    ).toBeUndefined();

    expect(
      resolveSessionRegistryBootstrapChainIds({
        scope: 'all',
        list: [],
        activeChainId: CONFIGURED_DEFAULT_CHAIN_ID,
        defaultChainId: OTHER_CHAIN_ID,
      }),
    ).toBeUndefined();

    expect(
      resolveSessionRegistryBootstrapChainIds({
        scope: 'active',
        list: [],
        activeChainId: CONFIGURED_DEFAULT_CHAIN_ID,
        defaultChainId: OTHER_CHAIN_ID,
        forceAllChains: true,
      }),
    ).toBeUndefined();
  });
});
