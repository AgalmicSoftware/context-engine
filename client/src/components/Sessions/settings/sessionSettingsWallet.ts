import { cryptoUtils } from '../../../utilities/crypto/cryptography.js';

type WalletRequest = (input: { method: string; params?: unknown[] }) => Promise<unknown>;

/**
 * The wallet that would sign a registry write: its account and network, read
 * without a prompt. Empty values when no wallet answers.
 */
export const readSigningWallet = async (providerLike: unknown): Promise<{ address: string; chainId: number }> => {
  try {
    const wallet = cryptoUtils._getProvider(
      (providerLike || 'wagmi') as Parameters<typeof cryptoUtils._getProvider>[0],
    ) as { request?: WalletRequest } | null;
    if (typeof wallet?.request !== 'function') return { address: '', chainId: 0 };
    const [accounts, chainId] = await Promise.all([
      wallet.request({ method: 'eth_accounts' }),
      wallet.request({ method: 'eth_chainId' }),
    ]);
    return {
      address: String((Array.isArray(accounts) && accounts[0]) || '').trim(),
      chainId: Number(chainId) || 0,
    };
  } catch {
    return { address: '', chainId: 0 };
  }
};
