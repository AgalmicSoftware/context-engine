import contractScripts, * as contractScriptsExports from '../web3/contractScripts.js';

type OnePageSessionInvitePayload = Record<string, unknown> & {
  nonce?: unknown;
  signature?: unknown;
};

type OnePageSessionTransactionResult = Record<string, unknown> & {
  transactionHash: string;
};

type OnePageSessionSbtMetadata = Record<string, unknown> & {
  hasPasswordMint?: boolean;
  image?: unknown;
  maxTokens?: unknown;
};

type OnePageSessionBalance = {
  gte: (value: unknown) => boolean;
};

type OnePageSessionContractRuntime = {
  claim: (...args: unknown[]) => Promise<OnePageSessionTransactionResult>;
  claimWithInvite: (...args: unknown[]) => Promise<OnePageSessionTransactionResult>;
  computeGroupPasswordHash: (input: unknown) => string;
  generateInvitePayloads: (...args: unknown[]) => Promise<OnePageSessionInvitePayload[]>;
  getETHBalance?: (...args: unknown[]) => Promise<OnePageSessionBalance>;
  getGroupPasswordHash: (...args: unknown[]) => Promise<string>;
  getMintedTokens: (...args: unknown[]) => Promise<unknown>;
  getNativeBalance?: (...args: unknown[]) => Promise<OnePageSessionBalance>;
  getSbtMetadata: (...args: unknown[]) => Promise<OnePageSessionSbtMetadata | null>;
  mintWithGroupSignature: (...args: unknown[]) => Promise<OnePageSessionTransactionResult>;
  signGroupMintAuthorization: (...args: unknown[]) => Promise<unknown>;
};

type OnePageSessionContractExports = {
  getAllSessionSlugs: (...args: unknown[]) => unknown[];
};

const contractRuntime = contractScripts as unknown as OnePageSessionContractRuntime;
const contractNamedExports = contractScriptsExports as unknown as OnePageSessionContractExports;

export const getAllSessionSlugs = (...args: unknown[]): unknown[] => (
  contractNamedExports.getAllSessionSlugs(...args)
);

export const getSbtMetadata = (...args: unknown[]): Promise<OnePageSessionSbtMetadata | null> => (
  contractRuntime.getSbtMetadata(...args)
);

export const getGroupPasswordHash = (...args: unknown[]): Promise<string> => (
  contractRuntime.getGroupPasswordHash(...args)
);

export const hasNativeBalanceReader = (): boolean => (
  typeof contractRuntime.getNativeBalance === 'function'
);

export const hasLegacyEthBalanceReader = (): boolean => (
  typeof contractRuntime.getETHBalance === 'function'
);

export const getNativeBalance = (...args: unknown[]): Promise<OnePageSessionBalance> => (
  contractRuntime.getNativeBalance?.(...args) ?? Promise.resolve(null as unknown as OnePageSessionBalance)
);

export const getLegacyEthBalance = (...args: unknown[]): Promise<OnePageSessionBalance> => (
  contractRuntime.getETHBalance?.(...args) ?? Promise.resolve(null as unknown as OnePageSessionBalance)
);

export const claimSbt = (...args: unknown[]): Promise<OnePageSessionTransactionResult> => (
  contractRuntime.claim(...args)
);

export const computeGroupPasswordHash = (input: unknown): string => (
  contractRuntime.computeGroupPasswordHash(input)
);

export const getMintedTokens = (...args: unknown[]): Promise<unknown> => (
  contractRuntime.getMintedTokens(...args)
);

export const generateInvitePayloads = (...args: unknown[]): Promise<OnePageSessionInvitePayload[]> => (
  contractRuntime.generateInvitePayloads(...args)
);

export const claimSbtWithInvite = (...args: unknown[]): Promise<OnePageSessionTransactionResult> => (
  contractRuntime.claimWithInvite(...args)
);

export const signGroupMintAuthorization = (...args: unknown[]): Promise<unknown> => (
  contractRuntime.signGroupMintAuthorization(...args)
);

export const mintWithGroupSignature = (...args: unknown[]): Promise<OnePageSessionTransactionResult> => (
  contractRuntime.mintWithGroupSignature(...args)
);
