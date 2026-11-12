/** This browser has no passkeys at all, as in many apps' built-in browsers: a different browser is the fix. */
export class PasskeysUnavailableError extends Error {
  name = 'PasskeysUnavailableError';
  constructor() {
    super('Passkeys are not available in this browser.');
  }
}
