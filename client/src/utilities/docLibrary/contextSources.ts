/** @file contextSources.ts: a session's context sources, as people add them and its AI reads them. */
import {
  ADMINS_ONLY_ACCESS,
  groupLockedAccess,
  CONTEXT_AGENT_ADDER,
  CONTEXT_FILE_TYPES,
  CONTEXT_ROLE,
  CONTEXT_SOURCE_LIMITS,
  CONTEXT_TAGS,
  CONTEXT_TEXT_ROLE,
  contextCardsOn,
  contextFileByteLimit,
  contextFileIsReadByAi,
  contextFileNoun,
  contextRoleOf,
  contextTagValue,
  isContextImage,
  resolveContextFileType,
} from '@ce-shared/sessionContextSources.mjs';
import { normalizeContextCard, type ContextCard, type ContextCardContent } from '@ce-shared/contextCards.mjs';
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
  /** True when an agent marked it as one it added. Self-declared, so only a label. */
  addedByAgent: boolean;
  /** The name that agent goes by; '' when it gave none or isn't an agent. */
  adderName: string;
  /** When the Worker last read a link's page. */
  fetchedAt: string;
  /** A PDF's text as the session's AI read it. */
  reading: { id: string; model: string; at: string } | null;
  /** What it is about, as the session's AI or a person wrote it; absent when it has no card. */
  card?: ContextCard;
  /** True when the Worker stores it encrypted: such an item takes no card. */
  encrypted?: boolean;
};

export type ContextSourceOptions = {
  sessionSlug: string;
  sessionConfig: unknown;
  context?: unknown;
  /** Admins read as themselves first, so their admins-only items are included. */
  asAdmin?: boolean;
  /** Listing may ask someone signed in to sign in to the session, so their groups' items are included. */
  prompt?: boolean;
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

/** True when this session's Worker keeps a card for each context source. */
export const workerSupportsContextCards = (options: ContextSourceOptions): Promise<boolean> =>
  workerHasFeature(options, 'context_cards_v1');

/**
 * Whether this session's Worker reads the session's context links for its AI by itself: true, false for an
 * older Worker, and null where it could not be asked. Null is not "no": reading the links from the browser as
 * well as on a Worker that does it could store a page twice.
 */
export const workerReadsSessionLinks = async (options: ContextSourceOptions): Promise<boolean | null> => {
  try {
    const capabilities = await readWorkerCapabilities(await workerBaseUrl(options), options.sessionSlug);
    return capabilities.unavailable ? null : capabilities.features.includes('session_link_reading_v1');
  } catch {
    return null;
  }
};

/** True when this session's Worker lets participants add links too (Session Workers from 0.9.2). */
export const workerAcceptsParticipantLinks = (options: ContextSourceOptions): Promise<boolean> =>
  workerHasFeature(options, 'participant_context_links_v1');

const toSource = (item: unknown): (ContextSource & { role: string; derivedFrom: string }) | null => {
  const record = asRecord(item);
  const metadata = asRecord(record.metadata);
  const id = toStr(asRecord(record.storageRef).id).trim();
  // contextSource is server-authored; tags alone never make an item context.
  if (!id || metadata.contextSource !== true) return null;
  const tags = metadata.tags;
  const role = contextRoleOf(tags);
  if (!role) return null;
  const addedByAgent = contextTagValue(tags, CONTEXT_TAGS.adderKind) === CONTEXT_AGENT_ADDER;
  // Cut to the card's limits again here: a list is only as careful as its Worker.
  const card = role === CONTEXT_ROLE ? normalizeContextCard(metadata.card) : null;
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
    addedByAgent,
    adderName: addedByAgent
      ? contextTagValue(tags, CONTEXT_TAGS.adderName).slice(0, CONTEXT_SOURCE_LIMITS.adderNameChars)
      : '',
    fetchedAt: contextTagValue(tags, CONTEXT_TAGS.fetchedAt),
    reading:
      role === CONTEXT_TEXT_ROLE
        ? { id, model: contextTagValue(tags, CONTEXT_TAGS.readModel), at: contextTagValue(tags, CONTEXT_TAGS.readAt) }
        : null,
    ...(card ? { card } : {}),
    ...(metadata.encrypted === true ? { encrypted: true } : {}),
  };
};

/** The context sources this reader may see, oldest first, each PDF with its AI reading. */
export const listContextSources = async (options: ContextSourceOptions): Promise<ContextSource[]> => {
  const listRows = async (preferAnonymous: boolean, prompt: boolean) => {
    const rows: NonNullable<ReturnType<typeof toSource>>[] = [];
    let cursor: string | null = null;
    for (let page = 0; page < MAX_LIST_PAGES; page += 1) {
      const result = await listSessionStorageRefsPage({
        ...workerOptions(options),
        resource: 'docsContext',
        role: 'context',
        cursor,
        preferAnonymous,
        prompt,
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
  // Someone signed in sees their groups' items too, asked to sign in only where the caller allows it.
  const prompt = !!options.asAdmin || (!!options.prompt && !!toStr(asRecord(options.context).account).trim());
  const asThemselves = prompt || (await hasCachedWorkerSessionToken(workerOptions(options)));
  const rows = await listRows(!asThemselves, prompt).catch((error: unknown) => {
    // A declined or refused sign-in, as after an access change, shows what a signed-out visitor sees.
    if (options.asAdmin || !asThemselves) throw error;
    return listRows(true, false);
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

const readStored = async (id: string, options: ContextSourceOptions): Promise<Response> =>
  readSessionStorageBlob({
    ...workerOptions(options),
    storageRef: { backend: 'cloudflare', id },
    preferAnonymous: !(options.asAdmin || (await hasCachedWorkerSessionToken(workerOptions(options)))),
    // Texts and previews load by themselves; the list that showed them was the place to sign in.
    prompt: false,
  });

const readText = async (id: string, options: ContextSourceOptions): Promise<string> =>
  (await readStored(id, options)).text();

/** A file source's bytes for a viewer, typed as its list says. */
export const readContextSourceBlob = async (
  source: Pick<ContextSource, 'id' | 'mime'>,
  options: ContextSourceOptions,
): Promise<Blob> => {
  const blob = await (await readStored(source.id, options)).blob();
  return !source.mime || blob.type === source.mime ? blob : new Blob([blob], { type: source.mime });
};

/** A source's text for an AI: a link's page snapshot, a text file, or the AI's reading of a PDF or image ('' when unread). */
export const readContextSourceText = async (source: ContextSource, options: ContextSourceOptions): Promise<string> => {
  if (contextFileIsReadByAi(source.mime)) return source.reading ? readText(source.reading.id, options) : '';
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
              readByAi: isContextImage(source.mime) ? ('image' as const) : source.mime === CONTEXT_FILE_TYPES.pdf,
            }
          : null;
      } catch {
        return null;
      }
    }),
  );
  return loaded.filter((source): source is NonNullable<typeof source> => !!source);
};

/**
 * Who added a source, for its list: "you", an agent's name as it gives it (or its
 * short address), "an admin" or a short address. '' when unrecorded. An agent picks
 * its own name, so lists mark its items with a separate "Agent" label, which no
 * name can supply or remove.
 */
export const contextAdderLabel = (
  {
    addedBy,
    addedByAgent = false,
    adderName = '',
  }: Pick<ContextSource, 'addedBy'> & Partial<Pick<ContextSource, 'addedByAgent' | 'adderName'>>,
  sessionConfig: unknown,
  account: unknown,
): string => {
  if (!addedBy) return '';
  if (addedBy === toStr(account).trim().toLowerCase()) return 'you';
  const short = `${addedBy.slice(0, 6)}…${addedBy.slice(-4)}`;
  if (addedByAgent) return adderName || short;
  return isConfiguredAdmin(sessionConfig, { account: addedBy }) ? 'an admin' : short;
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

/** Writes a source's card as a person, or with null takes it off. Admins write any; others their own source's. */
export const setContextCard = async (
  id: string,
  card: ContextCardContent | null,
  options: ContextSourceOptions,
): Promise<void> => {
  await postContextAction({ action: 'set-card', id, card }, options);
};

/** Asks the session's AI to write a source's card. Admins only: it is a call on the session's key. */
export const makeContextCard = async (id: string, options: ContextSourceOptions): Promise<void> => {
  await postContextAction({ action: 'make-card', id }, options);
};

/** True when a source may carry a card: not one the Worker stores encrypted. */
export const contextSourceTakesCard = (source: Pick<ContextSource, 'encrypted'>): boolean => source.encrypted !== true;

/** The sources the session's AI could write a card for: without one, able to carry one, and with text to describe. */
export const contextSourcesWithoutCards = (sources: ContextSource[]): ContextSource[] =>
  sources.filter(
    (source) =>
      !source.card && contextSourceTakesCard(source) && (!contextFileIsReadByAi(source.mime) || !!source.reading),
  );

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

/**
 * A file the context accepts, or the reason it does not. `images` says whether
 * the session takes images: only with Context cards on, as its Worker checks too.
 */
export const checkContextFile = (
  file: { name?: string; type?: string; size?: number },
  { images }: { images: boolean },
): string => {
  const type = resolveContextFileType({ name: file.name, type: file.type });
  if (!type) {
    return images
      ? 'Add a PDF, a PNG, JPEG or WebP image, or a Markdown, plain text, CSV or JSON file.'
      : 'Add a PDF, or a Markdown, plain text, CSV or JSON file.';
  }
  if (isContextImage(type) && !images) return 'A session takes images only once Context cards are on in its settings.';
  const limit = contextFileByteLimit(type);
  return (file.size || 0) > limit
    ? `${file.name || 'This file'} is larger than ${limit / (1024 * 1024)} MB, the most for ${isContextImage(type) ? 'an' : 'a'} ${contextFileNoun(type)}.`
    : '';
};

/** Who may read a file: anyone with access to the session, admins alone, or the members of some groups (and admins). */
export type ContextFileAccess = { adminsOnly?: boolean; groupIds?: string[] };

/** Uploads a file as a context source and returns its storage id. */
export const uploadContextFile = async (
  { file, adminsOnly = false, groupIds = [] }: { file: File } & ContextFileAccess,
  options: ContextSourceOptions,
): Promise<string> => {
  const problem = checkContextFile(file, { images: contextCardsOn(options.sessionConfig) });
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

const KIND_LABELS: Record<string, string> = {
  [CONTEXT_FILE_TYPES.pdf]: 'PDF',
  [CONTEXT_FILE_TYPES.md]: 'Markdown',
  [CONTEXT_FILE_TYPES.txt]: 'Text',
  [CONTEXT_FILE_TYPES.csv]: 'CSV',
  [CONTEXT_FILE_TYPES.json]: 'JSON',
  [CONTEXT_FILE_TYPES.png]: 'Image',
  [CONTEXT_FILE_TYPES.jpeg]: 'Image',
  [CONTEXT_FILE_TYPES.webp]: 'Image',
};
const FILE_EXTENSION = /\.(?:pdf|md|markdown|txt|csv|json|png|jpe?g|webp)$/i;

/** What a file picker for context offers: every accepted extension and type, images only where the session takes them. */
export const contextFileAccept = ({ images }: { images: boolean }): string => {
  const types = Object.entries(CONTEXT_FILE_TYPES).filter(([, type]) => images || !isContextImage(type));
  return [...types.map(([extension]) => `.${extension}`), ...new Set(types.map(([, type]) => type))].join(',');
};

/** What kind of source it is, in a word: Link, PDF, Image, Markdown, Text, CSV, JSON or File. */
export const contextSourceKindLabel = (source: Pick<ContextSource, 'kind' | 'mime' | 'title'>): string =>
  source.kind === 'link'
    ? 'Link'
    : KIND_LABELS[source.mime] || KIND_LABELS[resolveContextFileType({ name: source.title }) || ''] || 'File';

/** A source's name for its list: a file's without the extension its kind label already gives. */
export const contextSourceDisplayTitle = (source: Pick<ContextSource, 'kind' | 'title' | 'url'>): string => {
  if (source.kind === 'link') return source.title || source.url;
  return source.title.replace(FILE_EXTENSION, '').trim() || source.title;
};

/** A file's size in bytes, KB or MB (of 1,024), as the limits give them; '' when unknown. */
export const formatContextSize = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/**
 * The sources that repeat an earlier one: a link to the same address, or a file
 * of the same name, kind and size. Contents are not compared, so this is a strong hint.
 */
export const contextDuplicateIds = (sources: ContextSource[]): Set<string> => {
  const seen = new Set<string>();
  const repeats = new Set<string>();
  sources.forEach((source) => {
    const key =
      source.kind === 'link'
        ? `link ${source.url}`
        : `file ${source.mime} ${source.size} ${contextSourceDisplayTitle(source).toLowerCase()}`;
    if (seen.has(key)) repeats.add(source.id);
    seen.add(key);
  });
  return repeats;
};

const plainLine = (value: string): string =>
  value
    .replace(/\p{Cc}/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Typed text as the Markdown file it is stored as, named by its title or else its
 * first line, as an agent's note is. The type and size rules are a file's.
 */
export const buildContextNote = ({ text, title = '' }: { text: string; title?: string }): File => {
  const content = text.trim();
  if (!content) throw new Error('Write the text to add.');
  const named = plainLine(title);
  if (named.length > CONTEXT_SOURCE_LIMITS.titleChars) {
    throw new Error(`The title must be ${CONTEXT_SOURCE_LIMITS.titleChars} characters or fewer.`);
  }
  const firstLine = plainLine(content.split('\n')[0].replace(/^#+\s*/, '')).slice(0, CONTEXT_SOURCE_LIMITS.titleChars);
  const base = (named || firstLine || 'Note').replace(/\.(?:md|markdown)$/i, '') || 'Note';
  const note = new File([content], `${base}.md`, { type: CONTEXT_FILE_TYPES.md });
  if (note.size > CONTEXT_SOURCE_LIMITS.textFileBytes) {
    throw new Error(
      `The text is larger than ${CONTEXT_SOURCE_LIMITS.textFileBytes / (1024 * 1024)} MB, the most for a note.`,
    );
  }
  return note;
};
