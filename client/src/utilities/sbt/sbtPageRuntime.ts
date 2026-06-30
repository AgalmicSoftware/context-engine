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

const sbtPageRuntime: SbtPageContractRuntime = {
  addHashedPasswords: (...args) => contractScriptsRuntime.addHashedPasswords(...args),
  burnToken: (...args) => contractScriptsRuntime.burnToken(...args),
  claim: (...args) => contractScriptsRuntime.claim(...args),
  claimWithInvite: (...args) => contractScriptsRuntime.claimWithInvite(...args),
  claimWithPassword: (...args) => contractScriptsRuntime.claimWithPassword(...args),
  computeGroupPasswordHash: (input) => contractScriptsRuntime.computeGroupPasswordHash(input),
  generateInvitePayloads: (...args) => contractScriptsRuntime.generateInvitePayloads(...args),
  getGroupPasswordHash: (...args) => contractScriptsRuntime.getGroupPasswordHash(...args),
  getMintedTokens: (...args) => contractScriptsRuntime.getMintedTokens(...args),
  getOwnerByTokenId: (...args) => contractScriptsRuntime.getOwnerByTokenId(...args),
  getReadProviderForGroup: (...args) => contractScriptsRuntime.getReadProviderForGroup(...args),
  getSBTTokenIdByOwner: (...args) => contractScriptsRuntime.getSBTTokenIdByOwner(...args),
  getSbtHistorySummary: (...args) => contractScriptsRuntime.getSbtHistorySummary(...args),
  getSbtMetadata: (...args) => contractScriptsRuntime.getSbtMetadata(...args),
  isPasswordValid: (...args) => contractScriptsRuntime.isPasswordValid(...args),
  mintWithGroupSignature: (...args) => contractScriptsRuntime.mintWithGroupSignature(...args),
  signGroupMintAuthorization: (...args) => contractScriptsRuntime.signGroupMintAuthorization(...args),
  startClaim: (...args) => contractScriptsRuntime.startClaim(...args),
};

export default sbtPageRuntime;

export {
  getDemoSessionConfigBySlug,
  getSessionChainId,
  getSessionConfigBySlug,
  getSessionConfigBySlugOrDefault,
  normalizeSessionSlug,
} from '../web3/contractScripts.js';
