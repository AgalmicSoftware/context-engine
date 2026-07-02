import type { Hash } from 'viem';
import type { Chain as WagmiChain } from 'wagmi';

export type UnknownObj = Record<string, unknown>;
export type HexString = `0x${string}`;
export type PortoChainLike = WagmiChain;

export interface PortoSignerAccount {
  address?: string;
  signMessage(args: { message: unknown }): Promise<Hash>;
  signTypedData(typedData: unknown): Promise<Hash>;
  signTransaction(transaction: unknown): Promise<Hash>;
}

export interface PortoWalletClient {
  account: { address: string };
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  estimateGas(args: {
    account: { address: string };
    to?: unknown;
    value?: bigint;
    data?: unknown;
  }): Promise<bigint>;
  sendTransaction(tx: UnknownObj): Promise<unknown>;
  signTypedData(typedData: unknown): Promise<unknown>;
  signMessage(args: { message: unknown }): Promise<unknown>;
}

export interface RecoverableSendErrorFlags {
  replacementUnderpriced: boolean;
  nonceTooLow: boolean;
  alreadyKnown: boolean;
  recoverable: boolean;
}

export interface PortoProviderMock extends UnknownObj {
  isPorto: true;
  isMetaMask: false;
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on(event: unknown, handler: unknown): void;
  removeListener(event: unknown, handler: unknown): void;
  enable(): Promise<string[]>;
}

export interface PortoReadProvider {
  send(method: string, params: unknown[]): Promise<unknown>;
}

export const parseTxSelector = (data: unknown): string => {
  const raw = String(data || '').trim().toLowerCase();
  if (!raw.startsWith('0x') || raw.length < 10) return '';
  return raw.slice(0, 10);
};

export const countHexDataBytes = (data: unknown): number => {
  const raw = String(data || '').trim().toLowerCase();
  if (!raw.startsWith('0x') || raw.length <= 2) return 0;
  return Math.floor((raw.length - 2) / 2);
};

export const parseGweiToWei = (value: unknown): bigint | null => {
  const raw = String(value || '').trim();
  if (!/^\d+(?:\.\d+)?$/.test(raw)) return null;
  const [wholeRaw, fracRaw = ''] = raw.split('.');
  const whole = BigInt(wholeRaw || '0');
  const frac = BigInt((`${fracRaw}000000000`).slice(0, 9));
  return (whole * 1000000000n) + frac;
};

export const uniqueRpcUrls = (urls: unknown[] = []): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  urls.forEach((entry) => {
    const value = String(entry || '').trim().replace(/\/+$/, '');
    if (!value || seen.has(value)) return;
    seen.add(value);
    out.push(value);
  });
  return out;
};

export const getErrorMessage = (error: unknown): string => (
  error && typeof error === 'object' && 'message' in error
    ? String((error as { message?: unknown }).message || error)
    : String(error || '')
);

export const toUnknownRecord = (value: unknown): Record<string, unknown> => (
  value && typeof value === 'object' ? value as Record<string, unknown> : {}
);

export const toBigIntInput = (value: unknown): string | number | bigint | boolean => (
  typeof value === 'string' ||
  typeof value === 'number' ||
  typeof value === 'bigint' ||
  typeof value === 'boolean'
    ? value
    : String(value)
);

export function buildPortoWalletClientAdapter(createdWalletClient: UnknownObj): PortoWalletClient {
  const clientAccount = toUnknownRecord(createdWalletClient.account);
  const requestMethod = createdWalletClient.request;
  const estimateGasMethod = createdWalletClient.estimateGas;
  const sendTransactionMethod = createdWalletClient.sendTransaction;
  const signTypedDataMethod = createdWalletClient.signTypedData;
  const signMessageMethod = createdWalletClient.signMessage;
  const accountSignTypedData = clientAccount.signTypedData;
  const accountSignMessage = clientAccount.signMessage;
  if (typeof requestMethod !== 'function') throw new Error('Porto wallet client missing request.');
  if (typeof sendTransactionMethod !== 'function') throw new Error('Porto wallet client missing sendTransaction.');
  return {
    account: clientAccount as { address: string },
    request: (args) => requestMethod.call(createdWalletClient, args) as Promise<unknown>,
    estimateGas: (args) => {
      if (typeof estimateGasMethod !== 'function') throw new Error('Porto wallet client missing estimateGas.');
      return estimateGasMethod.call(createdWalletClient, args) as Promise<bigint>;
    },
    sendTransaction: (tx) => sendTransactionMethod.call(createdWalletClient, tx) as Promise<unknown>,
    signTypedData: (typedData) => (
      typeof signTypedDataMethod === 'function'
        ? signTypedDataMethod.call(createdWalletClient, typedData) as Promise<unknown>
        : typeof accountSignTypedData === 'function'
          ? accountSignTypedData.call(clientAccount, typedData) as Promise<unknown>
          : Promise.reject(new Error('Porto wallet client missing signTypedData.'))
    ),
    signMessage: (args) => (
      typeof signMessageMethod === 'function'
        ? signMessageMethod.call(createdWalletClient, args) as Promise<unknown>
        : typeof accountSignMessage === 'function'
          ? accountSignMessage.call(clientAccount, args) as Promise<unknown>
          : Promise.reject(new Error('Porto wallet client missing signMessage.'))
    ),
  };
}

export function bufferToBase64URL(buffer: ArrayBuffer | ArrayBufferView): string {
  const bytes = buffer instanceof ArrayBuffer
    ? new Uint8Array(buffer)
    : new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  let string = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    string += String.fromCharCode(bytes[i]);
  }
  return btoa(string).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64URLToBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (base64.length % 4)) % 4;
  const padded = base64 + '='.repeat(padLen);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
