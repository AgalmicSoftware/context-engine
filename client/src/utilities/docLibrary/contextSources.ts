/** @file contextSources.ts: a session's context sources, as people add them and its AI reads them. */
import {
  ADMINS_ONLY_ACCESS,
  groupLockedAccess,
  CONTEXT_FILE_TYPES,
  CONTEXT_ROLE,
  CONTEXT_TAGS,
  CONTEXT_TEXT_ROLE,
  contextFileByteLimit,
  contextRoleOf,
  contextTagValue,
  resolveContextFileType,
} from '@ce-shared/sessionContextSources.mjs';
import type { SessionContextPromptSource } from '@ce-shared/sessionContextText.mjs';
import { getCorsProxyUrlOrThrow } from '../worker/corsProxy';
import { fetchWorkerWithAuth, hasCachedWorkerSessionToken } from '../worker/workerAuth.js';
import { readWorkerCapabilities } from '../worker/workerCapabilities';
import { defaultStrictAllowDemoFallback } from '../worker/workerSessionResolution.js';
import {
  isConfiguredAdmin,
  listSessionStorageRefsPage,
  readSessionStorageBlob,
  uploadDataToSessionStorage,
} from '../storage/storageClient';
import { toStr } from '../shared/primitives.js';

type UnknownRecord = Record<string, unknown>;

/** A file or link in a session's context, as its list shows it to the reader. */
export type ContextSource = {
  id: string;
  kind: 'link' | 'file';
  title: string;
  url: string;
  mime: string;
  size: number;
  createdAt: string;
  adminsOnly: boolean;
  /** The groups it is locked to; empty when it isn't. */
  lockedGroupIds: string[];
  /** The address that added it. */
  addedBy: string;
  /** When the Worker last read a link's page. */
  fetchedAt: string;
  /** A PDF's text as the session's AI read it. */
  reading: { id: string; model: string; at: string } | null;
};

export type ContextSourceOptions = {
  sessionSlug: string;
  sessionConfig: unknown;
  context?: unknown;
  /** Admins read as themselves first, so their admins-only items are included. */
  asAdmin?: boolean;
};

const MAX_LIST_PAGES = 5;
const asRecord = (value: unknown): UnknownRecord =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as UnknownRecord) : {};

const workerOptions = ({ sessionSlug, sessionConfig, context }: ContextSourceOptions) => ({
  sessionSlug,
  sessionConfig,
  context,
  allowDemoFallback: defaultStrictAllowDemoFallback(),
});

const workerBaseUrl = async (options: ContextSourceOptions): Promise<string> =>
  toStr(await getCorsProxyUrlOrThrow(workerOptions(options)))
    .trim()
    .replace(/\/+$/, '');

const workerHasFeature = async (options: ContextSourceOptions, feature: string): Promise<boolean> => {
  try {
    const capabilities = await readWorkerCapabilities(await workerBaseUrl(options), options.sessionSlug);
    return capabilities.features.includes(feature);
  } catch {
    return false;
  }
};

/** True when this session's Worker stores context sources (Session Workers from 0.9.0). */
export const workerSupportsContextSources = (options: ContextSourceOptions): Promise<boolean> =>
  workerHasFeature(options, 'context_sources_v1');

/** True when this session's Worker lets participants add files and lock them to a group. */
export const workerAcceptsParticipantContext = (options: ContextSourceOptions): Promise<boolean> =>
  workerHasFeature(options, 'participant_context_v1');

const toSource = (item: unknown): (ContextSource & { role: string; derivedFrom: string }) | null => {
  const record = asRecord(item);
  const metadata = asRecord(record.metadata);
  const id = toStr(asRecord(record.storageRef).id).trim();
  // contextSource is server-authored; tags alone never make an item context.
  if (!id || metadata.contextSource !== true) return null;
  const tags = metadata.tags;
  const role = contextRoleOf(tags);
  if (!role) return null;
  return {
    id,
    role,
    derivedFrom: contextTagValue(tags, CONTEXT_TAGS.derivedFrom),
    kind: contextTagValue(tags, CONTEXT_TAGS.kind) === 'link' ? 'link' : 'file',
    title: contextTagValue(tags, CONTEXT_TAGS.name),
    url: contextTagValue(tags, CONTEXT_TAGS.url),
    mime: toStr(metadata.contentType).split(';')[0].trim(),
    size: Number(metadata.size) || 0,
    createdAt: toStr(metadata.createdAt),
    adminsOnly: metadata.adminsOnly === true,
    lockedGroupIds: (Array.isArray(metadata.lockedGroupIds) ? metadata.lockedGroupIds : [])
      .map((groupId: unknown) => toStr(groupId).trim().toLowerCase())
      .filter(Boolean),
    addedBy: toStr(metadata.addedBy).toLowerCase(),
    fetchedAt: contextTagValue(tags, CONTEXT_TAGS.fetchedAt),
    reading:
      role === CONTEXT_TEXT_ROLE
        ? { id, model: contextTagValue(tags, CONTEXT_TAGS.readModel), at: contextTagValue(tags, CONTEXT_TAGS.readAt) }
        : null,
  };
};

/** The context sources this reader may see, oldest first, each PDF with its AI reading. */
export const listContextSources = async (options: ContextSourceOptions): Promise<ContextSource[]> => {
  const listRows = async (preferAnonymous: boolean) => {
    const rows: NonNullable<ReturnType<typeof toSource>>[] = [];
    let cursor: string | null = null;
    for (let page = 0; page < MAX_LIST_PAGES; page += 1) {
      const result = await listSessionStorageRefsPage({
        ...workerOptions(options),
        resource: 'docsContext',
        role: 'context',
        cursor,
        preferAnonymous,
        // Only an admin's own view may ask them to sign in again.
        prompt: !!options.asAdmin,
      });
      result.items.forEach((item) => {
        const source = toSource(item);
        if (source) rows.push(source);
      });
      if (result.listComplete || !result.cursor) break;
      cursor = result.cursor;
    }
    return rows;
  };
  // Someone already signed in to this session sees their groups' items too; listing never asks them to sign.
  const asThemselves = options.asAdmin || (await hasCachedWorkerSessionToken(workerOptions(options)));
  const rows = await listRows(!asThemselves).catch((error: unknown) => {
    // Their held sign-in can be refused, as after an access change: show what a signed-out visitor sees.
    if (options.asAdmin || !asThemselves) throw error;
    return listRows(true);
  });
  const readings = new Map(rows.filter((row) => row.role === CONTEXT_TEXT_ROLE).map((row) => [row.derivedFrom, row]));
  return rows
    .filter((row) => row.role === CONTEXT_ROLE)
    .map(({ role: _role, derivedFrom: _derivedFrom, ...source }) => ({
      ...source,
      reading: readings.get(source.id)?.reading || null,
    }))
    .sort((left, right) => (Date.parse(left.createdAt) || 0) - (Date.parse(right.createdAt) || 0));
};

const readText = async (id: string, options: ContextSourceOptions): Promise<string> => {
  const response = await readSessionStorageBlob({
    ...workerOptions(options),
    storageRef: { backend: 'cloudflare', id },
    preferAnonymous: !(options.asAdmin || (await hasCachedWorkerSessionToken(workerOptions(options)))),
  });
  return response.text();
};

/** A source's text for an AI: a link's page snapshot, a text file, or a PDF's AI reading ('' when unread). */
export const readContextSourceText = async (source: ContextSource, options: ContextSourceOptions): Promise<string> => {
  if (source.mime === CONTEXT_FILE_TYPES.pdf) return source.reading ? readText(source.reading.id, options) : '';
  const text = await readText(source.id, options);
  if (source.kind !== 'link') return text;
  try {
    const snapshot = asRecord(asRecord(JSON.parse(text)).snapshot);
    return toStr(snapshot.text);
  } catch {
    return '';
  }
};

/** The sources' texts for the shared prompt block; a source that cannot be read is left out. */
export const loadContextSourcesForAi = async (
  sources: ContextSource[],
  options: ContextSourceOptions,
): Promise<SessionContextPromptSource[]> => {
  const loaded = await Promise.all(
    sources.map(async (source) => {
      try {
        const text = await readContextSourceText(source, options);
        return text.trim()
          ? {
              title: source.title,
              kind: source.kind,
              url: source.url,
              text,
              readByAi: source.mime === CONTEXT_FILE_TYPES.pdf,
            }
          : null;
      } catch {
        return null;
      }
    }),
  );
  return loaded.filter((source): source is NonNullable<typeof source> => !!source);
};

/** Who added a source, for its list: "you", "an admin" or a short address. '' when unrecorded. */
export const contextAdderLabel = (
  { addedBy }: Pick<ContextSource, 'addedBy'>,
  sessionConfig: unknown,
  account: unknown,
): string => {
  if (!addedBy) return '';
  if (addedBy === toStr(account).trim().toLowerCase()) return 'you';
  return isConfiguredAdmin(sessionConfig, { account: addedBy })
    ? 'an admin'
    : `${addedBy.slice(0, 6)}…${addedBy.slice(-4)}`;
};

/** A session's files as a template lists them. Groups don't travel between sessions, so a locked file stays narrow. */
export const templateContextFiles = (sources: ContextSource[]): Array<{ name: string; adminsOnly: boolean }> =>
  sources
    .filter((source) => source.kind === 'file')
    .map((source) => ({ name: source.title, adminsOnly: source.adminsOnly || source.lockedGroupIds.length > 0 }));

const postContextAction = async (body: UnknownRecord, options: ContextSourceOptions): Promise<UnknownRecord> => {
  const baseUrl = await workerBaseUrl(options);
  const response = await fetchWorkerWithAuth(
    `${baseUrl}/storage/context`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    { ...workerOptions(options), workerUrl: baseUrl },
  );
  const result = asRecord(await response.json().catch(() => ({})));
  if (!response.ok)
    throw new Error(toStr(result.error) || `The Session Worker refused the change (${response.status}).`);
  return result;
};

/** Adds a link the Worker reads now; with `replaces`, refreshes that link's snapshot. */
export const addContextLink = async (
  {
    url,
    title = '',
    adminsOnly = false,
    replaces = '',
  }: { url: string; title?: string; adminsOnly?: boolean; replaces?: string },
  options: ContextSourceOptions,
): Promise<UnknownRecord> =>
  asRecord(
    (
      await postContextAction(
        { action: 'add-link', url, ...(title ? { title } : {}), adminsOnly, ...(replaces ? { replaces } : {}) },
        options,
      )
    ).source,
  );

/** Asks the session's AI to read a PDF source; its text replaces any earlier reading. */
export const readContextPdf = async (id: string, options: ContextSourceOptions): Promise<UnknownRecord> =>
  asRecord((await postContextAction({ action: 'read-pdf', id }, options)).text);

/** Removes a source and the AI's reading of it (named too, as a list can lag a recent reading). */
export const removeContextSource = async (
  source: Pick<ContextSource, 'id' | 'reading'>,
  options: ContextSourceOptions,
): Promise<void> => {
  await postContextAction(
    { action: 'remove', id: source.id, ...(source.reading ? { readingIds: [source.reading.id] } : {}) },
    options,
  );
};

/** A file the context accepts, or the reason it does not. */
export const checkContextFile = (file: { name?: string; type?: string; size?: number }): string => {
  const type = resolveContextFileType({ name: file.name, type: file.type });
  if (!type) return 'Add a PDF, Markdown, plain text, CSV or JSON file.';
  const limit = contextFileByteLimit(type);
  return (file.size || 0) > limit
    ? `${file.name || 'This file'} is larger than ${limit / (1024 * 1024)} MB, the most for a ${type === CONTEXT_FILE_TYPES.pdf ? 'PDF' : 'text file'}.`
    : '';
};

/** Who may read a file: anyone with access to the session, admins alone, or the members of some groups (and admins). */
export type ContextFileAccess = { adminsOnly?: boolean; groupIds?: string[] };

/** Uploads a file as a context source and returns its storage id. */
export const uploadContextFile = async (
  { file, adminsOnly = false, groupIds = [] }: { file: File } & ContextFileAccess,
  options: ContextSourceOptions,
): Promise<string> => {
  const problem = checkContextFile(file);
  if (problem) throw new Error(problem);
  const contentType = resolveContextFileType({ name: file.name, type: file.type });
  const result = await uploadDataToSessionStorage(new File([file], file.name, { type: contentType }), undefined, {
    ...workerOptions(options),
    resource: 'docsContext',
    contentType,
    tags: [
      { name: 'CE-DocLibrary', value: '1' },
      { name: CONTEXT_TAGS.kind, value: 'file' },
      { name: 'CE-DocStorage', value: 'cloudflare' },
      { name: CONTEXT_TAGS.role, value: CONTEXT_ROLE },
      { name: CONTEXT_TAGS.name, value: file.name.slice(0, 180) },
      { name: CONTEXT_TAGS.mime, value: contentType },
    ],
    ...(adminsOnly
      ? { accessConditions: ADMINS_ONLY_ACCESS }
      : groupIds.length
        ? { accessConditions: groupLockedAccess(groupIds) }
        : {}),
  });
  return toStr(result.id);
};
