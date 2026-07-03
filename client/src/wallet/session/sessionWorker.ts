/// <reference lib="webworker" />
import { ethers } from 'ethers';
import type { HexString, SignTypedDataPayload, SoftSessionPolicy } from '../types.js';
import { assertSoftSessionAllowed } from './sessionPolicy.js';

type InitMessage = {
  id: string;
  type: 'init';
  privateKey: HexString;
  rpcUrl: string;
  chainId: number;
  policy: SoftSessionPolicy;
};

type RequestMessage = {
  id: string;
  type: 'request';
  method: string;
  params?: unknown[];
};

type LockMessage = {
  id: string;
  type: 'lock';
};

type WorkerMessage = InitMessage | RequestMessage | LockMessage;

let wallet: ethers.Wallet | null = null;
let provider: ethers.providers.JsonRpcProvider | null = null;
let policy: SoftSessionPolicy | null = null;
let activeChainId = 0;
let lockTimer: ReturnType<typeof setTimeout> | null = null;

const postSuccess = (id: string, result: unknown) => {
  self.postMessage({ id, ok: true, result });
};

const postFailure = (id: string, error: unknown) => {
  self.postMessage({
    id,
    ok: false,
    error: error instanceof Error ? error.message : String(error || 'Wallet request failed.'),
  });
};

const clearTimer = () => {
  if (lockTimer) clearTimeout(lockTimer);
  lockTimer = null;
};

const lock = () => {
  clearTimer();
  wallet = null;
  provider = null;
  policy = null;
  activeChainId = 0;
};

const scheduleLock = () => {
  clearTimer();
  if (!policy) return;
  const delay = Math.max(0, Number(policy.expiresAt || 0) - Date.now());
  lockTimer = setTimeout(lock, delay);
};

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

const handleRequest = async (message: RequestMessage): Promise<unknown> => {
  if (!wallet || !provider || !policy) throw new Error('Passkey wallet is locked.');
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
    case 'eth_sendTransaction': {
      const tx = ((message.params?.[0] || {}) as Record<string, unknown>);
      assertSoftSessionAllowed({ policy, method: 'eth_sendTransaction', tx, chainId: activeChainId });
      const response = await wallet.sendTransaction({
        to: tx.to as string | undefined,
        data: tx.data as string | undefined,
        value: tx.value ? ethers.BigNumber.from(tx.value as any) : undefined,
        gasLimit: (tx.gas || tx.gasLimit) ? ethers.BigNumber.from((tx.gas || tx.gasLimit) as any) : undefined,
        gasPrice: tx.gasPrice ? ethers.BigNumber.from(tx.gasPrice as any) : undefined,
        maxFeePerGas: tx.maxFeePerGas ? ethers.BigNumber.from(tx.maxFeePerGas as any) : undefined,
        maxPriorityFeePerGas: tx.maxPriorityFeePerGas
          ? ethers.BigNumber.from(tx.maxPriorityFeePerGas as any)
          : undefined,
        nonce: tx.nonce as number | undefined,
      });
      return response.hash;
    }
    case 'eth_signTransaction': {
      const tx = ((message.params?.[0] || {}) as Record<string, unknown>);
      assertSoftSessionAllowed({ policy, method: 'eth_signTransaction', tx, chainId: activeChainId });
      return wallet.signTransaction(tx as ethers.providers.TransactionRequest);
    }
    default:
      return provider.send(message.method, message.params || []);
  }
};

self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;
  void (async () => {
    try {
      if (message.type === 'init') {
        activeChainId = Number(message.chainId || 0) || 0;
        provider = new ethers.providers.JsonRpcProvider(message.rpcUrl, activeChainId || undefined);
        wallet = new ethers.Wallet(message.privateKey, provider);
        policy = message.policy;
        scheduleLock();
        postSuccess(message.id, { address: wallet.address });
        return;
      }
      if (message.type === 'lock') {
        lock();
        postSuccess(message.id, true);
        return;
      }
      postSuccess(message.id, await handleRequest(message));
    } catch (error) {
      postFailure(message.id, error);
    }
  })();
};
