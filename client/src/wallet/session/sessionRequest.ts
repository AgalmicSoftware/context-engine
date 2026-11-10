import { ethers } from 'ethers';
import type { SignTypedDataPayload, SoftSessionPolicy } from '../types.js';
import { assertSoftSessionAllowed } from './sessionPolicy.js';
import { normalizeSessionTransaction } from './sessionTransaction.js';

const normalizeTypedData = (payload: unknown): Required<Pick<SignTypedDataPayload, 'domain' | 'types' | 'message'>> => {
  const typedData = typeof payload === 'string' ? JSON.parse(payload) : payload;
  const record = (typedData && typeof typedData === 'object' ? typedData : {}) as SignTypedDataPayload;
  const { EIP712Domain: _domainType, ...types } = record.types || {};
  return {
    domain: record.domain || {},
    types,
    message: record.message || {},
  };
};

const normalizeMessage = (message: unknown): string | Uint8Array => {
  if (typeof message === 'string' && /^0x(?:[0-9a-fA-F]{2})*$/.test(message)) {
    return ethers.utils.arrayify(message);
  }
  return String(message ?? '');
};

export const handleSoftSessionRequest = async ({
  wallet,
  policy,
  activeChainId,
  message,
}: {
  wallet: ethers.Wallet;
  policy: SoftSessionPolicy;
  activeChainId: number;
  message: { method: string; params?: unknown[] };
}): Promise<unknown> => {
  switch (message.method) {
    case 'eth_requestAccounts':
    case 'eth_accounts':
      return [wallet.address];
    case 'eth_chainId':
      return `0x${activeChainId.toString(16)}`;
    case 'net_version':
      return String(activeChainId);
    case 'personal_sign': {
      assertSoftSessionAllowed({ policy, method: 'personal_sign', chainId: activeChainId });
      return wallet.signMessage(normalizeMessage(message.params?.[0]));
    }
    case 'eth_signTypedData_v4': {
      assertSoftSessionAllowed({ policy, method: 'eth_signTypedData_v4', chainId: activeChainId });
      const typedData = normalizeTypedData(message.params?.[1] ?? message.params?.[0]);
      return wallet._signTypedData(typedData.domain, typedData.types, typedData.message);
    }
    case 'eth_sendTransaction':
    case 'eth_signTransaction': {
      const tx = normalizeSessionTransaction(message.params?.[0], message.method);
      // Policy and signer must consume the same quantities; never pass the raw request on.
      assertSoftSessionAllowed({ policy, method: message.method, tx, chainId: activeChainId });
      if (message.method === 'eth_signTransaction') return wallet.signTransaction(tx);
      return (await wallet.sendTransaction(tx)).hash;
    }
    default:
      throw new Error(`Unsupported passkey session method: ${message.method}`);
  }
};
