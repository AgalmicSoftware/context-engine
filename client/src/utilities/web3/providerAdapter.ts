import {
  chainCurrency,
  chainHexId,
  chainHttpRpc,
  chainHttpRpcNoPath,
} from '../../variables/chains.js';
import {
  getReadProviderForChain,
  getReadProviderForGroup,
} from './rpcProviders.js';

type AnyRecord = Record<string, any>;

type ProviderSource = 'configured-read' | 'session-sponsored' | 'injected-wallet' | 'passkey-eoa' | 'web3auth';

type AdapterResult<T = unknown> = {
  ok: boolean;
  provider?: T;
  source?: ProviderSource;
  error?: string;
  recoverable?: boolean;
  status?: string;
};

type ResolveReadProviderOptions = {
  chainId?: unknown;
  groupKeyOrCfg?: unknown;
  purpose?: string;
  readOptions?: AnyRecord | null;
  allowInjectedReadFallback?: boolean;
  injectedProvider?: unknown;
  readProviderFactory?: (options: ResolveReadProviderOptions) => unknown;
};

type ResolveSignerProviderOptions = {
  providerName?: string;
  requireAccount?: boolean;
  allowInjectedSignerFallback?: boolean;
  injectedProvider?: unknown;
  web3AuthProvider?: unknown;
  passkeyProviderFactory?: () => unknown;
};

type WalletChainRequestOptions = {
  chain: AnyRecord;
  injectedProvider?: AnyRecord | null;
};

const getWindowLike = (): AnyRecord | null => (
  typeof window !== 'undefined' ? (window as unknown as AnyRecord) : null
);

const normalizeProviderName = (providerName: unknown): string => (
  String(providerName || '').trim().toLowerCase()
);

const errorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) return error.message;
  const record = error as AnyRecord;
  return String(record?.message || record?.reason || error || 'Wallet provider request failed.');
};

const getInjectedProvider = (injectedProvider?: unknown): unknown => {
  if (injectedProvider) return injectedProvider;
  const win = getWindowLike();
  return win?.ethereum || null;
};

const getWeb3AuthProvider = (web3AuthProvider?: unknown): unknown => {
  if (web3AuthProvider) return web3AuthProvider;
  const win = getWindowLike();
  return win?.web3authProvider || null;
};

const createPasskeyProvider = (factory?: () => unknown): unknown => {
  if (typeof factory === 'function') return factory();
  const win = getWindowLike();
  if (win?.__passkeyEoaProvider) return win.__passkeyEoaProvider;

  // Keep the dependency lazy so read-only adapter imports do not eagerly load wallet code.
  // eslint-disable-next-line global-require
  const wallet = require('../../wallet/passkeyWallet.js');
  if (wallet && typeof wallet.createPasskeyEip1193Provider === 'function') {
    return wallet.createPasskeyEip1193Provider();
  }
  return null;
};

const classifyReadSource = (provider: unknown): ProviderSource => {
  const meta = (provider as AnyRecord)?.__CE_RPC_META || {};
  if (meta?.sessionAccessStatus || meta?.sessionRpcSource) return 'session-sponsored';
  return 'configured-read';
};

export const resolveInjectedProvider = (injectedProvider?: unknown): AdapterResult => {
  const provider = getInjectedProvider(injectedProvider);
  if (!provider) {
    return {
      ok: false,
      error: 'Connected wallet provider not found or invalid (window.ethereum missing).',
      recoverable: true,
      status: 'missing-provider',
    };
  }
  return {
    ok: true,
    provider,
    source: 'injected-wallet',
  };
};

export const resolveReadProvider = (options: ResolveReadProviderOptions = {}): AdapterResult => {
  try {
    const provider = typeof options.readProviderFactory === 'function'
      ? options.readProviderFactory(options)
      : (
        options.groupKeyOrCfg !== undefined
          ? getReadProviderForGroup(options.groupKeyOrCfg as any, options.readOptions || null)
          : getReadProviderForChain(options.chainId)
      );

    return {
      ok: true,
      provider,
      source: classifyReadSource(provider),
    };
  } catch (error) {
    if (options.allowInjectedReadFallback) {
      const injected = resolveInjectedProvider(options.injectedProvider);
      if (injected.ok) return injected;
    }
    return {
      ok: false,
      error: errorMessage(error),
      recoverable: true,
      status: 'read-provider-unavailable',
    };
  }
};

export const resolveSignerProvider = (options: ResolveSignerProviderOptions = {}): AdapterResult => {
  const providerName = normalizeProviderName(options.providerName);

  if (providerName === 'passkey_eoa' || providerName === 'passkey-eoa') {
    const provider = createPasskeyProvider(options.passkeyProviderFactory);
    if (!provider) {
      return {
        ok: false,
        error: 'Passkey wallet provider is not available. Unlock your wallet first.',
        recoverable: true,
        status: 'missing-provider',
      };
    }
    return { ok: true, provider, source: 'passkey-eoa' };
  }

  if (providerName === 'web3auth') {
    const provider = getWeb3AuthProvider(options.web3AuthProvider);
    if (!provider) {
      return {
        ok: false,
        error: 'Selected wallet provider is not available. Log in or reconnect your wallet first.',
        recoverable: true,
        status: 'missing-provider',
      };
    }
    return { ok: true, provider, source: 'web3auth' };
  }

  if (providerName === 'wagmi') {
    return resolveInjectedProvider(options.injectedProvider);
  }

  if (providerName === 'none') {
    return {
      ok: false,
      error: 'Read-only provider is not allowed for transactions. Connect a wallet first.',
      recoverable: true,
      status: 'read-only-provider',
    };
  }

  if (options.allowInjectedSignerFallback) {
    return resolveInjectedProvider(options.injectedProvider);
  }

  return {
    ok: false,
    error: `Could not determine provider for "${options.providerName || ''}".`,
    recoverable: true,
    status: 'unknown-provider',
  };
};

export const normalizeWalletError = (error: unknown): AdapterResult => {
  const record = error as AnyRecord;
  const code = Number(record?.code || 0);
  const message = errorMessage(error);
  const lower = message.toLowerCase();

  if (code === 4001 || lower.includes('user rejected') || lower.includes('user denied')) {
    return {
      ok: false,
      error: 'Wallet request was cancelled.',
      recoverable: true,
      status: 'user-rejected',
    };
  }

  if (code === 4902) {
    return {
      ok: false,
      error: 'Wallet does not know this chain yet.',
      recoverable: true,
      status: 'unsupported-chain',
    };
  }

  return {
    ok: false,
    error: message,
    recoverable: true,
    status: 'wallet-error',
  };
};

const getChainIdHex = (chain: AnyRecord = {}): string => {
  const explicit = String(chain.chainIdHex || '').trim();
  if (explicit.startsWith('0x')) return explicit;
  const chainIdValue = chain.id ?? chain.chainId ?? explicit;
  const numericChainId = Number(chainIdValue || 0);
  if (Number.isFinite(numericChainId) && numericChainId > 0) {
    return `0x${numericChainId.toString(16)}`;
  }
  return chainHexId(chain);
};

export const addWalletChain = async ({
  chain,
  injectedProvider,
}: WalletChainRequestOptions): Promise<AdapterResult> => {
  const provider = getInjectedProvider(injectedProvider) as AnyRecord | null;
  if (!provider || typeof provider.request !== 'function') {
    return resolveInjectedProvider(provider) as AdapterResult;
  }

  const chainId = getChainIdHex(chain);
  if (!chainId || chainId === '0x0') {
    return {
      ok: false,
      error: 'Unsupported chain configuration.',
      recoverable: true,
      status: 'unsupported-chain',
    };
  }

  const rpcHttp = chainHttpRpcNoPath(chain) || chainHttpRpc(chain);
  const native = chainCurrency(chain);

  try {
    await provider.request({
      method: 'wallet_addEthereumChain',
      params: [{
        chainId,
        chainName: chain.name,
        nativeCurrency: native,
        rpcUrls: rpcHttp ? [rpcHttp] : [],
        blockExplorerUrls: [chain.blockExplorers?.default?.url].filter(Boolean),
      }],
    });
    return { ok: true, provider, source: 'injected-wallet', status: 'added' };
  } catch (error) {
    return normalizeWalletError(error);
  }
};

export const switchWalletChain = async ({
  chain,
  injectedProvider,
}: WalletChainRequestOptions): Promise<AdapterResult> => {
  const provider = getInjectedProvider(injectedProvider) as AnyRecord | null;
  if (!provider || typeof provider.request !== 'function') {
    return resolveInjectedProvider(provider) as AdapterResult;
  }

  const chainId = getChainIdHex(chain);
  if (!chainId || chainId === '0x0') {
    return {
      ok: false,
      error: 'Unsupported chain configuration.',
      recoverable: true,
      status: 'unsupported-chain',
    };
  }

  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId }],
    });
    return { ok: true, provider, source: 'injected-wallet', status: 'switched' };
  } catch (error) {
    const normalized = normalizeWalletError(error);
    if (normalized.status === 'unsupported-chain') {
      return addWalletChain({ chain, injectedProvider: provider });
    }
    return normalized;
  }
};
