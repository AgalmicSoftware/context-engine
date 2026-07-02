/**
 * @module contractScriptsCorePureHelpers
 * @description Internal pure constants and helper functions shared by contractScripts internals.
 */

// SBT detail pages can render from on-chain fields alone, so tokenURI metadata
// reads must fail soft instead of keeping the whole view in a spinner.
export const SBT_TOKENURI_METADATA_TIMEOUT_MS = 4000;

export const runWithSoftTimeout = <T>(
  taskPromise: Promise<T> | T,
  {
    timeoutMs = 0,
    fallbackValue = null,
    onTimeout = null,
  }: {
    timeoutMs?: number;
    fallbackValue?: T | null;
    onTimeout?: (() => void) | null;
  } = {}
): Promise<T | null> => {
  const safeTimeoutMs = Number(timeoutMs);
  if (!Number.isFinite(safeTimeoutMs) || safeTimeoutMs <= 0) {
    return Promise.resolve(taskPromise);
  }
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = <Value>(handler: (value: Value) => void, value: Value): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      handler(value);
    };
    const timer = setTimeout(() => {
      try {
        if (typeof onTimeout === 'function') onTimeout();
      } catch {
        // best effort only
      }
      finish(resolve, fallbackValue);
    }, Math.max(1, Math.floor(safeTimeoutMs)));
    Promise.resolve(taskPromise).then(
      (value) => finish(resolve, value),
      (error) => finish(reject, error)
    );
  });
};

/* ------------------------------------------------------------------ */
/* GAS FALLBACK CONSTANTS                                              */
/* ------------------------------------------------------------------ */
// Measured baseline gas costs with 1.5x safety margin.
// Dynamic functions accept input size and scale linearly.
export const GAS_FALLBACKS = Object.freeze({
  // Surveys contract
  submitResponse: 150_000,
  addSurvey: (numQuestions: number): number => 200_000 + (80_000 * Math.max(numQuestions, 1)),
  addQuestions: (numQuestions: number): number => 150_000 + (80_000 * Math.max(numQuestions, 1)),
  submitResponses: (numQuestions: number): number => 200_000 + (60_000 * Math.max(numQuestions, 1)),
  // SBT Factory
  createSBT: (numPasswords: number): number => 5_000_000 + (50_000 * Math.max(numPasswords, 0)),
  createSBTDeterministic: (numPasswords: number): number => 5_000_000 + (50_000 * Math.max(numPasswords, 0)),
  createSBTDeterministicConfigured: (numPasswords: number): number => 5_600_000 + (50_000 * Math.max(numPasswords, 0)),
  // CustomSBT (already wired but kept here as source-of-truth docs)
  startClaim: 400_000,
  claimWithPassword: 700_000,
  claimWithInvite: 10_000_000,
  mintWithGroupSignature: 700_000,
  claim: 400_000,
  delegate: 350_000,
  addHashedPasswords: (numPasswords: number): number => 200_000 + (80_000 * Math.max(numPasswords, 1)),
  burn: 500_000,
});

export { extractChainId } from './chainIdResolution.js';
