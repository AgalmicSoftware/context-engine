// src/shims/permissionless-all.js
// One-file shim for ALL `permissionless` imports (e.g., 'permissionless/accounts').
// a result of updating Web3Auth from v8 to v10


const notAvailable = (name) => (..._args) => {
  throw new Error(`'${name}' is unavailable in this build (permissionless shim).`);
};

// Default export some importers expect
const defaultExport = { version: 'shim' };
export default defaultExport;

// Version tag
export const version = 'shim';

// --- Accounts / AA entry points commonly imported ---
export const toSmartAccount             = notAvailable('toSmartAccount');
export const createSmartAccountClient   = notAvailable('createSmartAccountClient');

export const toBiconomySmartAccount     = notAvailable('toBiconomySmartAccount');
export const toKernelSmartAccount       = notAvailable('toKernelSmartAccount');
export const toEcdsaKernelSmartAccount  = notAvailable('toEcdsaKernelSmartAccount');
export const toNexusSmartAccount        = notAvailable('toNexusSmartAccount');
export const toLightSmartAccount        = notAvailable('toLightSmartAccount');
export const toSafeSmartAccount         = notAvailable('toSafeSmartAccount');
export const toEcdsaSmartAccount        = notAvailable('toEcdsaSmartAccount');
export const toTrustSmartAccount        = notAvailable('toTrustSmartAccount'); // ← NEW

// “signerTo*” variants sometimes used
export const signerToSimpleSmartAccount = notAvailable('signerToSimpleSmartAccount');
export const signerToEcdsaSmartAccount  = notAvailable('signerToEcdsaSmartAccount');
export const signerToSafeSmartAccount   = notAvailable('signerToSafeSmartAccount');
export const signerToKernelSmartAccount = notAvailable('signerToKernelSmartAccount');
export const signerToLightSmartAccount  = notAvailable('signerToLightSmartAccount');
export const signerToNexusSmartAccount  = notAvailable('signerToNexusSmartAccount');
export const signerToTrustSmartAccount  = notAvailable('signerToTrustSmartAccount'); // ← NEW

// --- Bundler / user-op helpers (belt & suspenders) ---
export const getUserOperationHash        = notAvailable('getUserOperationHash');
export const sendUserOperation           = notAvailable('sendUserOperation');
export const waitForUserOperationReceipt = notAvailable('waitForUserOperationReceipt');
export const getSenderAddress            = notAvailable('getSenderAddress');
export const buildUserOperation          = notAvailable('buildUserOperation');

// Namespaced “actions” some libs import
export const bundlerActions        = {};
export const pimlicoBundlerActions = {};
export const paymasterActions      = {};
export const entryPoint            = {};

// Convenience namespace if something imports everything from 'permissionless/accounts'
export const accounts = {
  toSmartAccount,
  createSmartAccountClient,
  toBiconomySmartAccount,
  toKernelSmartAccount,
  toEcdsaKernelSmartAccount,
  toNexusSmartAccount,
  toLightSmartAccount,
  toSafeSmartAccount,
  toEcdsaSmartAccount,
  toTrustSmartAccount,           // ← NEW
  signerToSimpleSmartAccount,
  signerToEcdsaSmartAccount,
  signerToSafeSmartAccount,
  signerToKernelSmartAccount,
  signerToLightSmartAccount,
  signerToNexusSmartAccount,
  signerToTrustSmartAccount,     // ← NEW
};
