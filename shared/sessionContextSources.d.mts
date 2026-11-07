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
}>;

export const CONTEXT_SOURCE_LIMITS: Readonly<{
  pdfBytes: number;
  textFileBytes: number;
  pageBytes: number;
  snapshotChars: number;
  readTextChars: number;
  titleChars: number;
  urlChars: number;
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
export function groupLockedAccess(groupId: string): {
  match: 'any';
  conditions: Array<{ kind: string; role?: string; groupIds?: string[] }>;
};
export function lockedGroupOf(accessConditions: unknown): string;
/** The content type context sources accept for this file, or ''. */
export function resolveContextFileType(file?: { name?: string; type?: string }): string;
export function contextFileByteLimit(contentType: string): number;
