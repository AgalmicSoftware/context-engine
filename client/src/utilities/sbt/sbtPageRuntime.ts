import contractScripts from '../web3/contractScripts.js';

type SbtPageTransactionResult = Record<string, unknown> & {
  transactionHash: string;
};

type SbtPageContractRuntime = {
  addHashedPasswords: (...args: unknown[]) => Promise<SbtPageTransactionResult>;
  burnToken: (...args: unknown[]) => Promise<SbtPageTransactionResult>;
  claimWithPassword: (...args: unknown[]) => Promise<SbtPageTransactionResult>;
  getOwnerByTokenId: (...args: unknown[]) => Promise<unknown>;
  getSBTTokenIdByOwner: (...args: unknown[]) => Promise<unknown>;
  getSbtHistorySummary: (...args: unknown[]) => Promise<unknown>;
  isPasswordValid: (...args: unknown[]) => Promise<boolean>;
  startClaim: (...args: unknown[]) => Promise<SbtPageTransactionResult>;
};

const contractScriptsRuntime = contractScripts as unknown as SbtPageContractRuntime;

export const addHashedPasswords = (...args: unknown[]): Promise<SbtPageTransactionResult> => (
  contractScriptsRuntime.addHashedPasswords(...args)
);

export const burnToken = (...args: unknown[]): Promise<SbtPageTransactionResult> => (
  contractScriptsRuntime.burnToken(...args)
);

export const claimWithPassword = (...args: unknown[]): Promise<SbtPageTransactionResult> => (
  contractScriptsRuntime.claimWithPassword(...args)
);

export const getOwnerByTokenId = (...args: unknown[]): Promise<unknown> => (
  contractScriptsRuntime.getOwnerByTokenId(...args)
);

export const getSBTTokenIdByOwner = (...args: unknown[]): Promise<unknown> => (
  contractScriptsRuntime.getSBTTokenIdByOwner(...args)
);

export const getSbtHistorySummary = (...args: unknown[]): Promise<unknown> => (
  contractScriptsRuntime.getSbtHistorySummary(...args)
);

export const isPasswordValid = (...args: unknown[]): Promise<boolean> => (
  contractScriptsRuntime.isPasswordValid(...args)
);

export const startClaim = (...args: unknown[]): Promise<SbtPageTransactionResult> => (
  contractScriptsRuntime.startClaim(...args)
);
