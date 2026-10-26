export { recoveryKeyFingerprint } from '../../shared/crypto/recoveryKeyFingerprint.mjs';

// Add the ephemeral display only AFTER all durable receipts have been written.
// Replays pass through the safe receipt, which never contains this field.
export const withFreshRecoveryKey = (safeResult, freshResult) => {
  const source = freshResult?.body;
  if (freshResult?.ok !== true || source?.envelopeKekSecretSet !== true ||
      source?.envelopeKekSecretPreserved === true || !/^[0-9a-f]{64}$/i.test(source?.recoveryKey || '')) return safeResult;
  return { ...safeResult, body: { ...safeResult.body, recoveryKey: source.recoveryKey } };
};
