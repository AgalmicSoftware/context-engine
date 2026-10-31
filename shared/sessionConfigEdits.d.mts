/** The fields POST /admin/set-config accepts for a Worker-canonical session. */
export const WORKER_CANONICAL_SET_CONFIG_KEYS: readonly string[];

export type SessionConfigEditClassification = {
  /** Edited paths that keep participants signed in, such as `sessionName`. */
  content: string[];
  /** Edited paths that raise `authzEpoch`, such as `defaultTags` or `interviewMode.hiddenDraftShare`. */
  authority: string[];
  /** True when saving signs participants out; the same verdict the Worker reaches. */
  signsParticipantsOut: boolean;
};

export function sessionConfigRequiresReauthorization(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): boolean;

/**
 * Splits the edits between two config records the way the Worker does on save.
 * `after` is the current config with the edited top-level fields replaced,
 * holding values as the Worker stores them (trimmed text).
 */
export function classifySessionConfigEdits(before: unknown, after: unknown): SessionConfigEditClassification;
