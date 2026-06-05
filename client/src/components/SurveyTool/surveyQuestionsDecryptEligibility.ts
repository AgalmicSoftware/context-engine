// Pure decrypt-eligibility decisions extracted from SurveyQuestions.
// getPortoReady is a THUNK so porto readiness is probed ONLY for the
// 'porto' kind -- this preserves the original lazy evaluation exactly.
export type DecryptProviderKind = string | null | undefined;

export function decideAutoDecryptBlocked(
  providerKind: DecryptProviderKind,
  getPortoReady: () => boolean,
): boolean {
  if (providerKind === 'wagmi') return true;
  if (providerKind === 'porto') return !getPortoReady();
  return false;
}

export function decideAutomaticPromptDecryptByKind(
  providerKind: DecryptProviderKind,
  getPortoReady: () => boolean,
): boolean {
  if (providerKind === 'web3auth') return true;
  if (providerKind === 'porto') return getPortoReady();
  return false;
}
