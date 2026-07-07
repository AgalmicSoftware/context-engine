import rpcDefaults from '../../variables/rpcDefaults.js';
import {
  buildSessionWizardWorkerRpcUrlMap,
  getSessionWizardWorkerDeployValidationError,
  resolveFallbackRpcUrl,
} from './sessionWizardWorkerRpc';

const { getPathRpcUrl } = rpcDefaults;

describe('SessionWizard worker RPC configuration', () => {
  it('does not fall back to the default chain RPC for unknown chains', () => {
    expect(resolveFallbackRpcUrl(777777)).toBe('');
  });

  it('keeps explicit worker RPC URLs ahead of built-in defaults', () => {
    const map = buildSessionWizardWorkerRpcUrlMap({
      chainId: 84532,
      pathProvider: {
        rpcUrl: 'https://generic-private.example/rpc',
        rpcUrlsByChainId: {
          84532: 'https://chain-specific.example/rpc',
        },
      },
    });

    expect(map['84532'][0]).toBe('https://chain-specific.example/rpc');
    expect(map['84532'][1]).toBe('https://generic-private.example/rpc');
  });

  it('keeps fallback RPCs ahead of PATH RPCs for chains with faucet fallback policy', () => {
    const map = buildSessionWizardWorkerRpcUrlMap({
      chainId: 84532,
      pathProvider: {},
    });

    expect(map['84532'][0]).toBe(resolveFallbackRpcUrl(84532));
    expect(map['84532']).toContain(getPathRpcUrl(84532));
  });

  it('keeps fallback RPCs ahead of PATH RPCs for OP Sepolia worker defaults', () => {
    const map = buildSessionWizardWorkerRpcUrlMap({
      chainId: 11155420,
      pathProvider: {},
    });

    expect(map['11155420'][0]).toBe(resolveFallbackRpcUrl(11155420));
    expect(map['11155420']).toContain(getPathRpcUrl(11155420));
  });

  it('keeps PATH RPCs ahead of fallback RPCs for chains without faucet fallback policy', () => {
    const map = buildSessionWizardWorkerRpcUrlMap({
      chainId: 8453,
      pathProvider: {},
    });

    expect(map['8453'][0]).toBe(getPathRpcUrl(8453));
    expect(map['8453']).toContain(resolveFallbackRpcUrl(8453));
  });

  it('requires a chain-specific RPC URL before deploy when no default exists', () => {
    expect(
      getSessionWizardWorkerDeployValidationError({
        registryAddress: '0xregistry',
        registryChainId: 777777,
        pathProvider: {},
        faucetRpcUrl: '',
      }),
    ).toBe('RPC URL is required for chain 777777 before deploying a worker.');
  });
});
