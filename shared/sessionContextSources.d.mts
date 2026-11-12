export const CONTEXT_ROLE: 'context';
export const CONTEXT_TEXT_ROLE: 'context-text';

export const CONTEXT_TAGS: Readonly<{
  role: 'CE-DocRole';
  kind: 'CE-DocKind';
  name: 'CE-DocName';
  mime: 'CE-DocMime';
  url: 'CE-ContextUrl';
  fetchedAt: 'CE-ContextFetchedAt';
  derivedFrom: 'CE-DocDerivedFromTx';
  readBy: 'CE-ReadBy';
  readModel: 'CE-ReadModel';
  readAt: 'CE-ReadAt';
  adderKind: 'CE-AdderKind';
  adderName: 'CE-AdderName';
}>;

export const CONTEXT_SOURCE_LIMITS: Readonly<{
  pdfBytes: number;
  textFileBytes: number;
  pageBytes: number;
  snapshotChars: number;
  readTextChars: number;
  titleChars: number;
  urlChars: number;
  lockedGroups: number;
  adderNameChars: number;
}>;

export const CONTEXT_FILE_TYPES: Readonly<{
  pdf: 'application/pdf';
  md: 'text/markdown';
  markdown: 'text/markdown';
  txt: 'text/plain';
  csv: 'text/csv';
  json: 'application/json';
}>;

/** The worker_role condition that makes an item admins only. */
export const ADMINS_ONLY_ACCESS: Readonly<{
  match: 'all';
  conditions: ReadonlyArray<Readonly<{ kind: 'worker_role'; role: 'admin' }>>;
}>;

export function contextTagValue(tags: unknown, name: string): string;
export function contextRoleOf(tags: unknown): '' | 'context' | 'context-text';
export function isAdminsOnlyAccess(accessConditions: unknown): boolean;
export function participantsMayAddContext(config: unknown): boolean;
/** The one adder mark an item may carry: an agent's. */
export const CONTEXT_AGENT_ADDER: 'agent';
/** An agent's name as an item carries it: one line of plain text, cut to fit. */
export function agentAdderName(name?: string): string;
/** The tags that mark an item an agent added, with the name it goes by when it has one. */
export function agentAdderTags(name?: string): Array<{ name: string; value: string }>;
/** Why an item's adder tags are refused, or '' when they are fine. */
export function contextAdderProblem(tags: unknown): string;
export function groupLockedAccess(groupIds: string[]): {
  match: 'any';
  conditions: Array<{ kind: string; role?: string; groupIds?: string[] }>;
};
/** The groups an item is locked to, or none for any other rule. */
export function lockedGroupsOf(accessConditions: unknown): string[];
/** The content type context sources accept for this file, or ''. */
export function resolveContextFileType(file?: { name?: string; type?: string }): string;
export function contextFileByteLimit(contentType: string): number;
