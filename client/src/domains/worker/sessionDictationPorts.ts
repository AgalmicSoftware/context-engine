/** @file sessionDictationPorts.ts: whether a session writes a person's speech down, for any box with a microphone. */
import { readWorkerResourcePresence } from '../../utilities/worker/workerResourcePresence';
import { toStr } from '../../utilities/shared/primitives.js';

/** The session and the person speaking; `account` is empty for a visitor. */
export type DictationOptions = { sessionSlug: string; sessionConfig: unknown; account: string };

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

/** True once the session's end time has passed, when the Worker stops writing speech down. */
export const sessionEnded = (sessionConfig: unknown): boolean => {
  const endsAt = Date.parse(toStr(asRecord(sessionConfig).sessionEndsAt));
  return Number.isFinite(endsAt) && endsAt <= Date.now();
};

// The Worker's rule for writing down speech in a session it runs: transcription among the scopes it gives a
// signed-in participant, or a signed-out visitor where no sign-in condition stands in the way. A signed-in
// person's sign-in condition is the Worker's to check.
const transcriptionOpen = (config: Record<string, unknown>, signedIn: boolean): boolean => {
  const policy = asRecord(config.workerAuthority);
  const conditions = asRecord(policy.loginGate).conditions;
  const gated =
    Array.isArray(conditions) &&
    conditions.some((condition) => !!condition && typeof condition === 'object' && !Array.isArray(condition));
  const list = signedIn ? policy.participantScopes : policy.anonymousScopes;
  return (
    Number(policy.version) === 1 &&
    (signedIn || !gated) &&
    (Array.isArray(list) ? list : []).some((scope) => toStr(scope).trim().toLowerCase() === 'transcribe') &&
    asRecord(config.scopes).transcribe !== false
  );
};

/**
 * Whether speech can be written down here as for an answer: the session pays for AI, hasn't ended, and gives
 * this person, signed in or not, transcription. Asked when the box opens, and only a real answer counts:
 * `null` when the Worker couldn't be read, so the next open asks again.
 */
export const dictationOffered = async (options: DictationOptions): Promise<boolean | null> => {
  const { sessionSlug, sessionConfig, account } = options;
  const config = asRecord(sessionConfig);
  if (sessionEnded(config) || !transcriptionOpen(config, !!account)) return false;
  const presence = await readWorkerResourcePresence({ sessionSlug, sessionConfig, context: { account } }).catch(
    () => null,
  );
  return presence ? presence.ai : null;
};

/**
 * True for a visitor the session writes no speech down for, though it would once they sign in: it pays for AI,
 * hasn't ended, and gives signed-in participants transcription. False when the Worker couldn't be read, so
 * nothing is promised.
 */
export const dictationNeedsSignIn = async (options: DictationOptions): Promise<boolean> => {
  const { sessionSlug, sessionConfig, account } = options;
  const config = asRecord(sessionConfig);
  if (account || sessionEnded(config) || transcriptionOpen(config, false) || !transcriptionOpen(config, true))
    return false;
  const presence = await readWorkerResourcePresence({ sessionSlug, sessionConfig, context: { account } }).catch(
    () => null,
  );
  return presence?.ai === true;
};
