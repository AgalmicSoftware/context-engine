import { act, render, screen, within } from '@testing-library/react';

import CreateSBTGroup from './CreateSBTGroup';
import styles from './CreateSBTGroup.module.scss';
import { getDemoSessionConfigBySlug } from '../../utilities/web3/contractScripts.js';
import { getSessionContractsForChain, getSessionRegistryChains } from '../../variables/chains.js';

const makeInstance = (props = {}) => {
  const instance = new CreateSBTGroup(props);
  instance.setState = (update, cb) => {
    const next = typeof update === 'function' ? update(instance.state) : update;
    instance.state = { ...instance.state, ...next };
    if (cb) cb();
  };
  return instance;
};

describe('CreateSBTGroup authoring chain selection', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    delete window.ethereum;
  });

  it('limits the network dropdown to session-registry authoring chains and defaults to the session chain', () => {
    const authoringChain = getSessionRegistryChains().find(
      (chain) => getSessionContractsForChain(chain.id)?.sbtFactory,
    );
    expect(authoringChain).toBeTruthy();
    const instance = makeInstance({
      network: { id: 1, name: 'Ethereum Mainnet' },
      sessionConfigOverride: {
        slug: 'test',
        networkChainId: authoringChain.id,
      },
    });
    instance.state = {
      ...instance.state,
      mintOptionsCollapsed: false,
    };

    render(instance.render());

    const networkRow = screen.getByText('Network').closest(`.${styles.settingRow}`);
    expect(networkRow).toBeInTheDocument();
    const networkSelect = within(networkRow).getByRole('combobox');
    const options = within(networkSelect)
      .getAllByRole('option')
      .map((option) => option.textContent);

    expect(networkSelect).toHaveValue(String(authoringChain.id));
    expect(options).toContain(`${authoringChain.name} (${authoringChain.id})`);
    expect(options.some((option) => /\(1\)$/.test(option || ''))).toBe(false);
    expect(options).not.toContain('Ethereum Mainnet (1)');
  });

  it('keeps the resolved session config on the authoring chain instead of the wallet chain', () => {
    const authoringChain = getSessionRegistryChains().find(
      (chain) => getSessionContractsForChain(chain.id)?.sbtFactory,
    );
    expect(authoringChain).toBeTruthy();
    const sessionContracts = getSessionContractsForChain(authoringChain.id);
    const instance = makeInstance({
      network: { id: 1, name: 'Ethereum Mainnet' },
      sessionConfigOverride: {
        slug: 'test',
        networkChainId: authoringChain.id,
      },
    });

    const resolved = instance.getSessionConfigForNetwork();

    expect(resolved).toEqual(
      expect.objectContaining({
        slug: 'test',
        networkChainId: authoringChain.id,
        sbtFactoryAddress: sessionContracts.sbtFactory,
      }),
    );
    expect(resolved.contracts.sbtFactory).toEqual(
      expect.objectContaining({
        address: sessionContracts.sbtFactory,
        chainId: authoringChain.id,
      }),
    );
  });

  it('prefers the connected network over a pure Worker session legacy chain for standalone authoring', () => {
    const instance = makeInstance({
      network: { id: 84532, name: 'Base Sepolia' },
      preferConnectedNetworkForAuthoring: true,
      sessionConfigOverride: {
        slug: 'demo-sh',
        networkChainId: 11155420,
      },
    });
    instance.getAuthoringChainOptions = jest.fn(() => [
      { id: 84532, name: 'Base Sepolia' },
      { id: 11155420, name: 'OP Sepolia' },
    ]);

    expect(instance.resolveAuthoringChainId()).toBe(84532);
  });

  it('retains the session authoring chain for registry and hybrid contexts', () => {
    const instance = makeInstance({
      network: { id: 84532, name: 'Base Sepolia' },
      sessionConfigOverride: {
        slug: 'registry-session',
        networkChainId: 11155420,
      },
    });
    instance.getAuthoringChainOptions = jest.fn(() => [
      { id: 84532, name: 'Base Sepolia' },
      { id: 11155420, name: 'OP Sepolia' },
    ]);

    expect(instance.resolveAuthoringChainId()).toBe(11155420);
  });

  it('oss demo fallback sessions omit shipped SBT factory addresses', () => {
    const generalCfg = getDemoSessionConfigBySlug('', { allowDemoFallback: true });
    const testCfg = getDemoSessionConfigBySlug('test', { allowDemoFallback: true });

    expect(generalCfg?.contracts).toEqual({});
    expect(testCfg).toBeNull();
  });

  it('swaps authoring contracts to the selected registry chain instead of relabeling the session defaults', () => {
    const priorIncludeLocalRegistry = globalThis.CE_INCLUDE_LOCAL_SESSION_REGISTRY;
    globalThis.CE_INCLUDE_LOCAL_SESSION_REGISTRY = true;

    try {
      const localChainContracts = getSessionContractsForChain(31337);
      expect(localChainContracts.sbtFactory).toBeTruthy();

      const instance = makeInstance({
        network: { id: 84532, name: 'Base Sepolia' },
        sessionConfigOverride: {
          slug: 'test',
          networkChainId: 84532,
          contracts: {
            sbtFactory: {
              address: '0x0b065f0b9EeCE9d119aF8BD03AcfaE6c93A03c11',
              chainId: 84532,
            },
            surveys: {
              address: '0xcccb5c1a96b3e10f395e318ae75db24e45bd3808',
              chainId: 84532,
            },
          },
        },
      });
      instance.state = {
        ...instance.state,
        network: 31337,
      };

      const resolved = instance.getSessionConfigForNetwork();

      expect(resolved).toEqual(
        expect.objectContaining({
          slug: 'test',
          networkChainId: 31337,
          sbtFactoryAddress: localChainContracts.sbtFactory,
        }),
      );
      expect(resolved.contracts.sbtFactory).toEqual(
        expect.objectContaining({
          address: localChainContracts.sbtFactory,
          chainId: 31337,
        }),
      );
      expect(resolved.contracts.surveys).toEqual(
        expect.objectContaining({
          address: localChainContracts.surveys,
          chainId: 31337,
        }),
      );
    } finally {
      if (typeof priorIncludeLocalRegistry === 'undefined') {
        delete globalThis.CE_INCLUDE_LOCAL_SESSION_REGISTRY;
      } else {
        globalThis.CE_INCLUDE_LOCAL_SESSION_REGISTRY = priorIncludeLocalRegistry;
      }
    }
  });

  it('keeps the current authoring chain when the wallet switch request is rejected', async () => {
    const instance = makeInstance({
      account: '0x00000000000000000000000000000000000000aa',
      network: { id: 84532, name: 'Base Sepolia' },
      sessionConfigOverride: {
        slug: 'test',
        networkChainId: 84532,
      },
    });
    instance.state = {
      ...instance.state,
      network: 84532,
      sbtDistribution: {
        ...instance.state.sbtDistribution,
        network: { id: 84532, name: 'Base Sepolia' },
      },
    };
    instance.getAuthoringChainOptions = jest.fn(() => [
      { id: 84532, name: 'Base Sepolia' },
      { id: 31337, name: 'Anvil' },
    ]);

    const request = jest.fn().mockRejectedValue(Object.assign(new Error('User rejected network switch'), {
      code: 4001,
    }));
    window.ethereum = { request };

    await act(async () => {
      await instance.handleNetworkChange({ target: { value: '31337' } });
    });

      expect(request).toHaveBeenCalledWith({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x7a69' }],
      });
      expect(consoleErrorSpy).toHaveBeenCalledWith('[sbt]', 'Failed to switch network', switchError);
      expect(instance.state.network).toBe(84532);
      expect(instance.state.sbtDistribution.network).toEqual(
        expect.objectContaining({
          id: 84532,
          name: 'Base Sepolia',
        }),
      );
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});
