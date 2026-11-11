/** The fields POST /admin/set-config accepts for a Worker-canonical session. */
export const WORKER_CANONICAL_SET_CONFIG_KEYS: readonly string[];

/** The highlighted and hidden question and survey ID lists; editing them signs no one out. */
export const CURATED_ID_LIST_KEYS: readonly string[];
/** The most IDs one curated list holds. */
export const MAX_CURATED_IDS: number;
/** True for a list of at most MAX_CURATED_IDS IDs, each 1-128 letters, digits or `._:-`. */
export function validCuratedIdList(value: unknown): value is string[];
/** The most results admins one session lists. */
export const MAX_RESULTS_ADMINS: number;
/** True for at most MAX_RESULTS_ADMINS distinct addresses; results admins build debate atlases and nothing else. */
export function validResultsAdminAddresses(value: unknown): value is string[];
/** The most characters a session's instructions for AI agents hold. */
export const MAX_AGENT_INSTRUCTIONS_CHARS: number;
/** True for text of at most MAX_AGENT_INSTRUCTIONS_CHARS; the Worker serves it at /llms.txt. */
export function validAgentInstructions(value: unknown): value is string;

export type SessionConfigEditClassification = {
  /** Edited paths that keep participants signed in, such as `sessionName`. */
  content: string[];
  /** Edited paths that raise `authzEpoch`, such as `defaultTags` or `interviewMode.hiddenDraftShare`. */
  authority: string[];
  /** True when saving signs participants out; the same verdict the Worker reaches. */
  signsParticipantsOut: boolean;
};

/** The stored `ai` after set-config receives `sent`: sent subkeys replace, omitted ones stay. */
export function mergeSetConfigAi(stored: unknown, sent: unknown): unknown;

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
