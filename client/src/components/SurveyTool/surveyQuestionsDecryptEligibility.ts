// Pure decrypt-eligibility decisions extracted from SurveyQuestions.
// getPasskeyReady is a THUNK so passkey wallet readiness is probed ONLY for the
// embedded-wallet kind -- this preserves the original lazy evaluation exactly.
export type DecryptProviderKind = string | null | undefined;

export function decideAutoDecryptBlocked(
  providerKind: DecryptProviderKind,
  getPasskeyReady: () => boolean,
): boolean {
  if (providerKind === 'wagmi') return true;
  if (providerKind === 'passkey-eoa') return !getPasskeyReady();
  return false;
}

export function decideAutomaticPromptDecryptByKind(
  providerKind: DecryptProviderKind,
  getPasskeyReady: () => boolean,
): boolean {
  if (providerKind === 'web3auth') return true;
  if (providerKind === 'passkey-eoa') return getPasskeyReady();
  return false;
}
