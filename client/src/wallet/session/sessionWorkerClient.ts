import { ethers } from 'ethers';
import type { HexString, SoftSessionPolicy } from '../types.js';
import { handleSoftSessionRequest } from './sessionRequest.js';
import { normalizeSessionTransaction } from './sessionTransaction.js';

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
      return handleSoftSessionRequest({ wallet, policy, activeChainId: chainId, message: { method, params } });
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
  let starting: Promise<Worker> | null = null;
  let generation = 0;
  let seq = 0;
  const pending = new Map<string, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();

  const ensureWorker = async (): Promise<Worker> => {
    if (worker) return worker;
    if (starting) return starting;
    const requestedGeneration = generation;
    starting = import('./sessionWorkerFactory.js')
      .then(({ createSessionWorker }) => {
        if (requestedGeneration !== generation) throw new Error('Passkey wallet is locked.');
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
      })
      .catch((error) => {
        if (requestedGeneration === generation) starting = null;
        throw error;
      });
    return starting;
  };

  const callWorker = (payload: Record<string, unknown>): Promise<unknown> => {
    const id = `wallet-worker:${(seq += 1)}`;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      ensureWorker()
        .then((activeWorker) => {
          if (pending.has(id)) activeWorker.postMessage({ ...payload, id });
        })
        .catch((error) => {
          pending.delete(id);
          reject(error);
        });
    });
  };

  return {
    async init(options) {
      const result = (await callWorker({ type: 'init', ...options })) as { address?: string };
      return String(result?.address || '');
    },
    request(args) {
      try {
        // Normalize before structured cloning strips genuine BigNumber prototypes.
        const params =
          args.method === 'eth_sendTransaction' || args.method === 'eth_signTransaction'
            ? [normalizeSessionTransaction(args.params?.[0], args.method)]
            : args.params;
        return callWorker({ type: 'request', ...args, params });
      } catch (error) {
        return Promise.reject(error);
      }
    },
    async lock() {
      // Termination discards the signer without waiting for a busy worker to acknowledge a lock.
      generation += 1;
      pending.forEach((item) => item.reject(new Error('Passkey wallet is locked.')));
      pending.clear();
      worker?.terminate();
      worker = null;
      starting = null;
    },
  };
};
