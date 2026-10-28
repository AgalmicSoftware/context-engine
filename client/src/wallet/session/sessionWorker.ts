/// <reference lib="webworker" />
import { ethers } from 'ethers';
import type { HexString, SoftSessionPolicy } from '../types.js';
import { handleSoftSessionRequest } from './sessionRequest.js';

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
      if (!wallet || !provider || !policy) throw new Error('Passkey wallet is locked.');
      postSuccess(message.id, await handleSoftSessionRequest({ wallet, policy, activeChainId, message }));
    } catch (error) {
      postFailure(message.id, error);
    }
  })();
};
