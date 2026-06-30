import contractScripts from '../web3/contractScripts.js';

type SbtPageTransactionResult = Record<string, unknown> & {
  transactionHash: string;
};

type SbtPageInvitePayload = Record<string, unknown> & {
  inviteCode: string;
  nonce?: unknown;
  signature?: unknown;
};

type SbtPageContractRuntime = {
  addHashedPasswords: (...args: unknown[]) => Promise<SbtPageTransactionResult>;
  burnToken: (...args: unknown[]) => Promise<SbtPageTransactionResult>;
  claim: (...args: unknown[]) => Promise<SbtPageTransactionResult>;
  claimWithInvite: (...args: unknown[]) => Promise<SbtPageTransactionResult>;
  claimWithPassword: (...args: unknown[]) => Promise<SbtPageTransactionResult>;
  computeGroupPasswordHash: (input: unknown) => string;
  generateInvitePayloads: (...args: unknown[]) => Promise<SbtPageInvitePayload[]>;
  getGroupPasswordHash: (...args: unknown[]) => Promise<string>;
  getMintedTokens: (...args: unknown[]) => Promise<unknown>;
  getOwnerByTokenId: (...args: unknown[]) => Promise<unknown>;
  getReadProviderForGroup: (...args: unknown[]) => unknown;
  getSBTTokenIdByOwner: (...args: unknown[]) => Promise<unknown>;
  getSbtHistorySummary: (...args: unknown[]) => Promise<unknown>;
  getSbtMetadata: (...args: unknown[]) => Promise<Record<string, unknown> | null | undefined>;
  isPasswordValid: (...args: unknown[]) => Promise<boolean>;
  mintWithGroupSignature: (...args: unknown[]) => Promise<SbtPageTransactionResult>;
  signGroupMintAuthorization: (...args: unknown[]) => Promise<unknown>;
  startClaim: (...args: unknown[]) => Promise<SbtPageTransactionResult>;
};

const contractScriptsRuntime = contractScripts as unknown as SbtPageContractRuntime;

export const addHashedPasswords = (...args: unknown[]): Promise<SbtPageTransactionResult> => (
  contractScriptsRuntime.addHashedPasswords(...args)
);

export const burnToken = (...args: unknown[]): Promise<SbtPageTransactionResult> => (
  contractScriptsRuntime.burnToken(...args)
);

export const claim = (...args: unknown[]): Promise<SbtPageTransactionResult> => (
  contractScriptsRuntime.claim(...args)
);

export const claimWithInvite = (...args: unknown[]): Promise<SbtPageTransactionResult> => (
  contractScriptsRuntime.claimWithInvite(...args)
);

export const claimWithPassword = (...args: unknown[]): Promise<SbtPageTransactionResult> => (
  contractScriptsRuntime.claimWithPassword(...args)
);

export const computeGroupPasswordHash = (input: unknown): string => (
  contractScriptsRuntime.computeGroupPasswordHash(input)
);

export const generateInvitePayloads = (...args: unknown[]): Promise<SbtPageInvitePayload[]> => (
  contractScriptsRuntime.generateInvitePayloads(...args)
);

export const getGroupPasswordHash = (...args: unknown[]): Promise<string> => (
  contractScriptsRuntime.getGroupPasswordHash(...args)
);

export const getMintedTokens = (...args: unknown[]): Promise<unknown> => (
  contractScriptsRuntime.getMintedTokens(...args)
);

export const getOwnerByTokenId = (...args: unknown[]): Promise<unknown> => (
  contractScriptsRuntime.getOwnerByTokenId(...args)
);

export const getReadProviderForGroup = (...args: unknown[]): unknown => (
  contractScriptsRuntime.getReadProviderForGroup(...args)
);

export const getSBTTokenIdByOwner = (...args: unknown[]): Promise<unknown> => (
  contractScriptsRuntime.getSBTTokenIdByOwner(...args)
);

export const getSbtHistorySummary = (...args: unknown[]): Promise<unknown> => (
  contractScriptsRuntime.getSbtHistorySummary(...args)
);

export const getSbtMetadata = (...args: unknown[]): Promise<Record<string, unknown> | null | undefined> => (
  contractScriptsRuntime.getSbtMetadata(...args)
);

export const isPasswordValid = (...args: unknown[]): Promise<boolean> => (
  contractScriptsRuntime.isPasswordValid(...args)
);

export const mintWithGroupSignature = (...args: unknown[]): Promise<SbtPageTransactionResult> => (
  contractScriptsRuntime.mintWithGroupSignature(...args)
);

export const signGroupMintAuthorization = (...args: unknown[]): Promise<unknown> => (
  contractScriptsRuntime.signGroupMintAuthorization(...args)
);

export const startClaim = (...args: unknown[]): Promise<SbtPageTransactionResult> => (
  contractScriptsRuntime.startClaim(...args)
);

export {
  getDemoSessionConfigBySlug,
  getSessionChainId,
  getSessionConfigBySlug,
  getSessionConfigBySlugOrDefault,
  normalizeSessionSlug,
} from '../web3/contractScripts.js';
