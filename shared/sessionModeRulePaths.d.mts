/** Worker-reported mode path -> the rules-table codes it can stand for. */
export const WORKER_MODE_PATH_RULE_CODES: Readonly<Record<string, readonly string[]>>;

/** The path in a Worker mode error message, or '' for any other message. */
export function parseWorkerModeErrorPath(message: unknown): string;

/**
 * One rules-table code for a Worker path. Pass the client's
 * validateSessionModeProfile issues to pick among several codes; returns ''
 * when the path has no rules-table code.
 */
export function ruleCodeForWorkerModePath(
  path: string,
  issues?: ReadonlyArray<{ path: string; code: string }>,
): string;
