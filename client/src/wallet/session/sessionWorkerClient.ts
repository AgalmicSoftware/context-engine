import { ethers } from 'ethers';
import type { HexString, SignTypedDataPayload, SoftSessionPolicy } from '../types.js';
import { assertSoftSessionAllowed } from './sessionPolicy.js';

type InitOptions = {
  privateKey: HexString;
  rpcUrl: string;
  chainId: number;
  policy: SoftSessionPolicy;
};

export interface SoftSessionClient {
  init(options: InitOptions): Promise<string>;
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  lock(): Promise<void>;
}

const normalizeMessage = (message: unknown): string | Uint8Array => {
  if (typeof message === 'string' && /^0x(?:[0-9a-fA-F]{2})*$/.test(message)) {
    return ethers.utils.arrayify(message);
  }
  return String(message ?? '');
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

type BigNumberInput = Parameters<typeof ethers.BigNumber.from>[0];

const normalizeBigNumberInput = (value: unknown, field: string): BigNumberInput | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  if (ethers.BigNumber.isBigNumber(value)) return value;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint') return value;
  if (value instanceof Uint8Array) return value;
  if (Array.isArray(value) && value.every((item) => typeof item === 'number')) return value;
  throw new Error(`Invalid transaction ${field}.`);
};

const normalizeOptionalBigNumber = (value: unknown, field: string): ethers.BigNumber | undefined => {
  const input = normalizeBigNumberInput(value, field);
  return input === undefined ? undefined : ethers.BigNumber.from(input);
};

export const createInMemorySoftSessionClient = (): SoftSessionClient => {
  let wallet: ethers.Wallet | null = null;
  let provider: ethers.providers.JsonRpcProvider | null = null;
  let policy: SoftSessionPolicy | null = null;
  let chainId = 0;

  return {
    async init(options) {
      chainId = Number(options.chainId || 0) || 0;
      provider = new ethers.providers.JsonRpcProvider(options.rpcUrl, chainId || undefined);
      wallet = new ethers.Wallet(options.privateKey, provider);
      policy = options.policy;
      return wallet.address;
    },

    async request({ method, params = [] }) {
      if (!wallet || !provider || !policy) throw new Error('Passkey wallet is locked.');
      switch (method) {
        case 'eth_requestAccounts':
        case 'eth_accounts':
          return [wallet.address];
        case 'eth_chainId':
          return `0x${chainId.toString(16)}`;
        case 'net_version':
          return String(chainId);
        case 'personal_sign':
          assertSoftSessionAllowed({ policy, method: 'personal_sign', chainId });
          return wallet.signMessage(normalizeMessage(params[0]));
        case 'eth_signTypedData_v4': {
          assertSoftSessionAllowed({ policy, method: 'eth_signTypedData_v4', chainId });
          const typedData = normalizeTypedData(params[1] ?? params[0]);
          return wallet._signTypedData(typedData.domain, typedData.types, typedData.message);
        }
        case 'eth_sendTransaction': {
          const tx = (params[0] || {}) as Record<string, unknown>;
          assertSoftSessionAllowed({ policy, method: 'eth_sendTransaction', tx, chainId });
          const response = await wallet.sendTransaction({
            to: tx.to as string | undefined,
            data: tx.data as string | undefined,
            value: normalizeOptionalBigNumber(tx.value, 'value'),
            gasLimit: normalizeOptionalBigNumber(tx.gas ?? tx.gasLimit, 'gasLimit'),
            gasPrice: normalizeOptionalBigNumber(tx.gasPrice, 'gasPrice'),
            maxFeePerGas: normalizeOptionalBigNumber(tx.maxFeePerGas, 'maxFeePerGas'),
            maxPriorityFeePerGas: normalizeOptionalBigNumber(tx.maxPriorityFeePerGas, 'maxPriorityFeePerGas'),
            nonce: tx.nonce as number | undefined,
          });
          return response.hash;
        }
        case 'eth_signTransaction': {
          const tx = (params[0] || {}) as Record<string, unknown>;
          assertSoftSessionAllowed({ policy, method: 'eth_signTransaction', tx, chainId });
          return wallet.signTransaction(tx as ethers.providers.TransactionRequest);
        }
        default:
          throw new Error(`Unsupported passkey session method: ${method}`);
      }
    },

    async lock() {
      wallet = null;
      provider = null;
      policy = null;
      chainId = 0;
    },
  };
};

export const createWorkerSoftSessionClient = (): SoftSessionClient => {
  if (typeof Worker === 'undefined') return createInMemorySoftSessionClient();
  let worker: Worker | null = null;
  let seq = 0;
  const pending = new Map<string, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();

  const ensureWorker = async (): Promise<Worker> => {
    if (worker) return worker;
    const { createSessionWorker } = await import('./sessionWorkerFactory.js');
    worker = createSessionWorker();
    worker.onmessage = (event: MessageEvent<{ id: string; ok: boolean; result?: unknown; error?: string }>) => {
      const item = pending.get(event.data.id);
      if (!item) return;
      pending.delete(event.data.id);
      if (event.data.ok) item.resolve(event.data.result);
      else item.reject(new Error(event.data.error || 'Wallet worker request failed.'));
    };
    worker.onerror = (event) => {
      pending.forEach((item) => item.reject(new Error(event.message || 'Wallet worker failed.')));
      pending.clear();
    };
    return worker;
  };

  const callWorker = (payload: Record<string, unknown>): Promise<unknown> => {
    const id = `wallet-worker:${seq += 1}`;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      ensureWorker()
        .then((activeWorker) => activeWorker.postMessage({ ...payload, id }))
        .catch((error) => {
          pending.delete(id);
          reject(error);
        });
    });
  };

  return {
    async init(options) {
      const result = await callWorker({ type: 'init', ...options }) as { address?: string };
      return String(result?.address || '');
    },
    request(args) {
      return callWorker({ type: 'request', ...args });
    },
    async lock() {
      if (worker) {
        await callWorker({ type: 'lock' });
        worker.terminate();
        worker = null;
      }
      pending.clear();
    },
  };
};
