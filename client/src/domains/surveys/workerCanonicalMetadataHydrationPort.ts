import { peekCacheSync } from '../../utilities/cache/cacheScripts';
import { generateQuestionId } from '../../utilities/shared/questionUtils.mjs';
import { canonicalizeSessionSlug } from '../../utilities/session/canonicalSessionContext';
import { normalizeWorkerCanonicalSessionIdHex } from '../../utilities/session/sessionWorkerDiscovery';
import { listSessionStorageRefsPage, readSessionStorageBlob } from '../../utilities/storage/storageClient';
import {
  STORAGE_BACKENDS,
  STORAGE_RESOURCE_KEYS,
  attachStorageRefCompatibilityFields,
  normalizeStorageRef,
  type StorageRef,
} from '../../utilities/storage/storageRefs';
import { resolveWorkerCanonicalStorageTarget } from './workerCanonicalAuthoringPort';
import {
  WORKER_CANONICAL_CACHE_SCOPE_KEY,
  type WorkerCanonicalCacheIdentity,
  resolveWorkerCanonicalCacheIdentity,
  withWorkerCanonicalCacheIdentity,
  workerCanonicalCacheIdentityMatches,
} from '../../utilities/survey/workerCanonicalCacheIdentity';

type UnknownRecord = Record<string, unknown>;

type WorkerStoragePage = {
  items: unknown[];
  cursor: string | null;
  listComplete: boolean;
};

type WorkerCanonicalMetadataHydrationDeps = {
  listSessionStorageRefsPage?: (options: UnknownRecord) => Promise<WorkerStoragePage>;
  readSessionStorageBlob?: (options: UnknownRecord) => Promise<Response>;
};

type WorkerCanonicalMetadataHydrationInput = {
  account?: unknown;
  providerLike?: unknown;
  sessionConfig?: unknown;
  sessionSlug?: unknown;
};

type WorkerCanonicalMetadataResource = typeof STORAGE_RESOURCE_KEYS.QUESTIONS | typeof STORAGE_RESOURCE_KEYS.SURVEYS;

export type WorkerCanonicalMetadataRow = {
  createdAtMs: number;
  id: string;
  payload: UnknownRecord;
  storageRef: StorageRef;
  storageRefId: string;
  // Server-recorded upload authority; absent stamps have ordinary precedence.
  uploadAuthority?: string | null;
};

// An admin hid this id on the Worker; merges drop any cached copy.
export type WorkerCanonicalHiddenMetadataRow = {
  hidden: true;
  id: string;
};

export type WorkerCanonicalMetadataEntry = WorkerCanonicalMetadataRow | WorkerCanonicalHiddenMetadataRow;

export type WorkerCanonicalMetadataHydrationPort = {
  loadQuestions: (
    input?: WorkerCanonicalMetadataHydrationInput,
    deps?: WorkerCanonicalMetadataHydrationDeps,
  ) => Promise<WorkerCanonicalMetadataEntry[]>;
  loadSurveys: (
    input?: WorkerCanonicalMetadataHydrationInput,
    deps?: WorkerCanonicalMetadataHydrationDeps,
  ) => Promise<WorkerCanonicalMetadataEntry[]>;
};

type CachedVersion = {
  admin: boolean;
  uploadAuthority: string | null;
  createdAtMs: number;
  storageRefId: string;
  // Whether a plaintext question hashes to its id; null when it cannot be checked.
  verified: boolean | null;
};

const MAX_METADATA_LIST_PAGES = 50;
const METADATA_LIST_PAGE_SIZE = 100;
const MAX_METADATA_ITEMS = MAX_METADATA_LIST_PAGES * METADATA_LIST_PAGE_SIZE;
const METADATA_READ_CONCURRENCY = 8;

const isRecord = (value: unknown): value is UnknownRecord =>
  !!value && typeof value === 'object' && !Array.isArray(value);

// Stored payloads are any uploader's JSON, and converting an object with a
// broken toString throws, so only strings count as text here.
const readString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const isTextOrAbsent = (value: unknown): boolean => value == null || typeof value === 'string';

const isHiddenEntry = (entry: WorkerCanonicalMetadataEntry): entry is WorkerCanonicalHiddenMetadataRow =>
  (entry as WorkerCanonicalHiddenMetadataRow).hidden === true;

const METADATA_CACHE_NAMESPACES = {
  [STORAGE_RESOURCE_KEYS.QUESTIONS]: 'questionsCache',
  [STORAGE_RESOURCE_KEYS.SURVEYS]: 'surveysCache',
} as const;

const METADATA_REFS_FIELDS = {
  [STORAGE_RESOURCE_KEYS.QUESTIONS]: 'workerQuestionMetadataRefs',
  [STORAGE_RESOURCE_KEYS.SURVEYS]: 'workerSurveyMetadataRefs',
} as const;

const isLockedQuestionPayload = (payload: UnknownRecord): boolean =>
  !!payload.promptEncrypted || isRecord(payload.encryption) || readString(payload.prompt) === '[encrypted]';

// Plaintext question ids are hashes of their authoring inputs, so a version
// whose content does not hash to its id is a rewrite. Locked questions keep
// their plaintext private, so their check is unknown (null), never a pass.
const questionPayloadMatchesId = (id: string, payload: UnknownRecord): boolean | null => {
  if (isLockedQuestionPayload(payload)) return null;
  try {
    const options = Array.isArray(payload.options) ? payload.options : [];
    const voiceCredits = Number(payload.voiceCredits ?? 99);
    const singleSelect = !!(payload.singleSelect || payload.oneSelectionOnly);
    return (
      String(generateQuestionId(payload.type, payload.prompt, options, singleSelect, voiceCredits)).toLowerCase() === id
    );
  } catch {
    return false;
  }
};

const compareStorageIds = (left: string, right: string): number => (left === right ? 0 : left < right ? -1 : 1);

// Match Worker readers: newest immutable admin stamp, otherwise earliest upload.
// Hash compatibility is diagnostic only: comparing it only for plaintext pairs
// makes mixed plaintext/locked precedence nontransitive and order-dependent.
const isPreferredVersion = (candidate: CachedVersion, current: CachedVersion | null): boolean => {
  if (!current || candidate.storageRefId === current.storageRefId) return true;
  if (candidate.admin !== current.admin) return candidate.admin;
  const age =
    candidate.createdAtMs - current.createdAtMs || compareStorageIds(candidate.storageRefId, current.storageRefId);
  return candidate.admin ? age > 0 : age < 0;
};

// Storage refs are immutable. Cached refs that already retain the server's
// authority stamp need no reread; older derived flags must be refreshed.
const readCachedStorageRefIds = (
  resource: WorkerCanonicalMetadataResource,
  sessionSlug: unknown,
  identity: WorkerCanonicalCacheIdentity,
): Set<string> => {
  const cache = peekCacheSync<UnknownRecord>(METADATA_CACHE_NAMESPACES[resource], readString(sessionSlug), {
    clone: false,
  });
  const node = isRecord(cache) ? cache[WORKER_CANONICAL_CACHE_SCOPE_KEY] : null;
  if (!isRecord(node) || !workerCanonicalCacheIdentityMatches(node, identity)) return new Set();
  const items = node[resource === STORAGE_RESOURCE_KEYS.QUESTIONS ? 'questions' : 'surveys'];
  const refs = node[METADATA_REFS_FIELDS[resource]];
  if (!isRecord(items) || !isRecord(refs)) return new Set();
  return new Set(
    Object.entries(refs)
      .filter(
        ([id, ref]) =>
          isRecord(items[id]) && isRecord(ref) && Object.prototype.hasOwnProperty.call(ref, 'uploadAuthority'),
      )
      .map(([, ref]) => readString((ref as UnknownRecord).storageRefId))
      .filter(Boolean),
  );
};

const mapWithConcurrency = async <T, R>(items: T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> => {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  const runWorker = async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await task(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, runWorker));
  return results;
};

const readPayloadResourceId = (payload: UnknownRecord, resource: WorkerCanonicalMetadataResource): string => {
  const rawId =
    resource === STORAGE_RESOURCE_KEYS.QUESTIONS
      ? payload.id || payload.questionId || payload.questionID
      : payload.surveyID || payload.id;
  return readString(rawId).toLowerCase();
};

type ListedStorageRef = {
  createdAtMs: number;
  storageRef: StorageRef;
  uploadAuthority: string | null;
};

const normalizeListedStorageRef = (
  item: UnknownRecord,
  resource: WorkerCanonicalMetadataResource,
): ListedStorageRef | null => {
  const metadata = isRecord(item.metadata) ? item.metadata : {};
  const listedResource = readString(metadata.resource);
  if (listedResource && listedResource !== resource) return null;
  const rawStorageRef = isRecord(item.storageRef) ? item.storageRef : {};
  const storageRef = normalizeStorageRef(
    {
      ...rawStorageRef,
      createdAt: rawStorageRef.createdAt || metadata.createdAt,
    },
    {
      fallbackBackend: STORAGE_BACKENDS.CLOUDFLARE,
      resource,
    },
  );
  if (
    !storageRef ||
    storageRef.backend !== STORAGE_BACKENDS.CLOUDFLARE ||
    (storageRef.resource && storageRef.resource !== resource)
  ) {
    return null;
  }
  const createdAtMs = Date.parse(readString(metadata.createdAt || storageRef.createdAt));
  return {
    createdAtMs: Number.isFinite(createdAtMs) && createdAtMs > 0 ? createdAtMs : 0,
    storageRef,
    uploadAuthority: typeof metadata.uploadAuthority === 'string' ? metadata.uploadAuthority : null,
  };
};

const readHiddenMarkerId = (item: UnknownRecord, resource: WorkerCanonicalMetadataResource): string => {
  const metadata = isRecord(item.metadata) ? item.metadata : {};
  if (item.hidden !== true && metadata.hidden !== true) return '';
  if (readString(metadata.resource) && readString(metadata.resource) !== resource) return '';
  return readString(metadata.resourceId).toLowerCase();
};

const payloadMatchesTarget = (
  payload: UnknownRecord,
  {
    sessionId,
    sessionSlug,
  }: {
    sessionId: string;
    sessionSlug: string;
  },
): boolean => {
  const payloadSlug = readString(payload.sessionSlug);
  const rawPayloadSessionId = readString(payload.sessionId);
  const payloadSessionId = normalizeWorkerCanonicalSessionIdHex(rawPayloadSessionId);
  return (
    payloadSlug === sessionSlug &&
    canonicalizeSessionSlug(payloadSlug) === sessionSlug &&
    (!rawPayloadSessionId || payloadSessionId === sessionId)
  );
};

const loadWorkerCanonicalMetadata = async (
  resource: WorkerCanonicalMetadataResource,
  input: WorkerCanonicalMetadataHydrationInput = {},
  deps: WorkerCanonicalMetadataHydrationDeps = {},
): Promise<WorkerCanonicalMetadataEntry[]> => {
  const target = resolveWorkerCanonicalStorageTarget({
    sessionConfig: input.sessionConfig,
    sessionSlug: input.sessionSlug,
  });
  const listPage = deps.listSessionStorageRefsPage || listSessionStorageRefsPage;
  const readBlob = deps.readSessionStorageBlob || readSessionStorageBlob;
  const context = {
    account: input.account,
    providerLike: input.providerLike,
  };
  const listedItems: UnknownRecord[] = [];
  const seenCursors = new Set<string>();
  let cursor: string | null = null;

  for (let pageIndex = 0; pageIndex < MAX_METADATA_LIST_PAGES; pageIndex += 1) {
    const page = await listPage({
      sessionSlug: target.sessionSlug,
      sessionConfig: target.sessionConfig,
      context,
      workerUrl: target.workerUrl,
      resource,
      cursor,
      limit: METADATA_LIST_PAGE_SIZE,
    });
    const pageItems = Array.isArray(page.items) ? page.items.filter(isRecord) : [];
    listedItems.push(...pageItems);
    if (listedItems.length > MAX_METADATA_ITEMS) {
      throw new Error('worker_metadata_storage_item_limit_exceeded');
    }
    if (page.listComplete) break;
    const nextCursor = readString(page.cursor);
    if (!nextCursor || seenCursors.has(nextCursor)) {
      throw new Error('worker_metadata_storage_invalid_cursor');
    }
    seenCursors.add(nextCursor);
    cursor = nextCursor;
    if (pageIndex === MAX_METADATA_LIST_PAGES - 1) {
      throw new Error('worker_metadata_storage_page_limit_exceeded');
    }
  }

  const cachedStorageRefIds = readCachedStorageRefIds(
    resource,
    input.sessionSlug,
    resolveWorkerCanonicalCacheIdentity({ sessionConfig: target.sessionConfig, sessionSlug: target.sessionSlug }),
  );
  const hiddenIds = new Set<string>();
  const uniqueItems: ListedStorageRef[] = [];
  const seenStorageRefs = new Set<string>();
  listedItems.forEach((item) => {
    const hiddenId = readHiddenMarkerId(item, resource);
    if (hiddenId) {
      hiddenIds.add(hiddenId);
      return;
    }
    const normalized = normalizeListedStorageRef(item, resource);
    const storageRefId = readString(normalized?.storageRef.id);
    if (!normalized || !storageRefId || seenStorageRefs.has(storageRefId)) return;
    seenStorageRefs.add(storageRefId);
    if (!cachedStorageRefIds.has(storageRefId)) uniqueItems.push(normalized);
  });

  const readRow = async ({
    createdAtMs,
    storageRef,
    uploadAuthority,
  }: ListedStorageRef): Promise<WorkerCanonicalMetadataRow | null> => {
    const response = await readBlob({
      storageRef,
      sessionSlug: target.sessionSlug,
      sessionConfig: target.sessionConfig,
      context,
      workerUrl: target.workerUrl,
    });
    const payload = await response.json().catch(() => null);
    if (!isRecord(payload) || !payloadMatchesTarget(payload, target)) return null;
    // A non-text title crashes survey views; such a row cannot be a survey.
    if (resource === STORAGE_RESOURCE_KEYS.SURVEYS && typeof payload.title !== 'string') return null;
    // Likewise a non-text prompt or type crashes question cards.
    if (
      resource === STORAGE_RESOURCE_KEYS.QUESTIONS &&
      !(isTextOrAbsent(payload.prompt) && isTextOrAbsent(payload.type))
    ) {
      return null;
    }
    const id = readPayloadResourceId(payload, resource);
    if (!id || hiddenIds.has(id)) return null;
    const compatiblePayload = attachStorageRefCompatibilityFields(
      {
        ...payload,
        id,
        ...(resource === STORAGE_RESOURCE_KEYS.QUESTIONS ? {} : { surveyID: id }),
        sessionId: target.sessionId,
        sessionSlug: target.sessionSlug,
        sessionSlugExplicit: true,
        source: 'worker-session-storage',
        storageRef,
      },
      { resource },
    );
    return {
      createdAtMs,
      id,
      payload: compatiblePayload,
      storageRef,
      storageRefId: storageRef.id,
      uploadAuthority,
    };
  };
  const readRows = await mapWithConcurrency(uniqueItems, METADATA_READ_CONCURRENCY, readRow);
  const rows = readRows
    .filter((row): row is WorkerCanonicalMetadataRow => !!row)
    .sort(
      (left, right) =>
        left.createdAtMs - right.createdAtMs ||
        compareStorageIds(left.storageRefId, right.storageRefId) ||
        compareStorageIds(left.id, right.id),
    );
  return [...[...hiddenIds].map((id): WorkerCanonicalHiddenMetadataRow => ({ hidden: true, id })), ...rows];
};

const createWorkerQuestionCacheNode = (): UnknownRecord => ({
  questionsLatestBlock: 0,
  questionsDiscoveryCheckpointBlock: 0,
  questions: {},
  questionResponses: {},
  questionResponsesMeta: {},
  pendingQuestionMetadata: {},
  questionResponsesLatestBlock: 0,
  arweaveTxCache: {},
  arweaveTxFailureCache: {},
  questionHydrationMeta: {},
  workerQuestionMetadataRefs: {},
});

const createWorkerSurveyCacheNode = (): UnknownRecord => ({
  surveysLatestBlock: 0,
  surveys: {},
  surveyResponses: {},
  surveyResponsesLatestBlock: {},
  pendingSurveyMetadata: {},
  workerSurveyMetadataRefs: {},
});

const readCachedVersion = (ref: unknown, verifyCachedItem: () => boolean | null): CachedVersion | null => {
  if (!isRecord(ref)) return null;
  return {
    admin: ref.uploadAuthority === 'admin',
    uploadAuthority: typeof ref.uploadAuthority === 'string' ? ref.uploadAuthority : null,
    createdAtMs: Number(ref.createdAtMs || 0),
    storageRefId: readString(ref.storageRefId),
    // Always re-check the cached copy: older refs have no flag, or a flag that
    // counted a locked rewrite as verified.
    verified: verifyCachedItem(),
  };
};

const mergeMetadataEntries = ({
  entries,
  items,
  pending,
  refs,
  toItem,
  verify,
}: {
  entries: WorkerCanonicalMetadataEntry[];
  items: UnknownRecord;
  pending: UnknownRecord;
  refs: UnknownRecord;
  toItem: (row: WorkerCanonicalMetadataRow, base: UnknownRecord) => UnknownRecord;
  verify: (id: string, payload: UnknownRecord) => boolean | null;
}): void => {
  const hiddenIds = new Set(entries.filter(isHiddenEntry).map((entry) => entry.id));
  hiddenIds.forEach((id) => {
    delete items[id];
    delete refs[id];
    delete pending[id];
  });
  entries.forEach((entry) => {
    if (isHiddenEntry(entry) || hiddenIds.has(entry.id)) return;
    const existing = isRecord(items[entry.id]) ? (items[entry.id] as UnknownRecord) : null;
    const current = readCachedVersion(refs[entry.id], () => (existing ? verify(entry.id, existing) : null));
    const candidate: CachedVersion = {
      admin: entry.uploadAuthority === 'admin',
      uploadAuthority: entry.uploadAuthority ?? null,
      createdAtMs: entry.createdAtMs,
      storageRefId: entry.storageRefId,
      verified: verify(entry.id, entry.payload),
    };
    if (!isPreferredVersion(candidate, current)) return;
    // Refresh the same version in place; a different version replaces the
    // cached copy outright so none of the old version's fields linger.
    const base = existing && current?.storageRefId === entry.storageRefId ? existing : {};
    items[entry.id] = toItem(entry, base);
    refs[entry.id] = candidate;
    delete pending[entry.id];
  });
};

export const mergeWorkerCanonicalQuestionMetadata = (
  current: unknown,
  rows: WorkerCanonicalMetadataEntry[],
  identity: WorkerCanonicalCacheIdentity,
): UnknownRecord => {
  const next = isRecord(current) ? { ...current } : {};
  const cachedNetwork = isRecord(next[WORKER_CANONICAL_CACHE_SCOPE_KEY])
    ? (next[WORKER_CANONICAL_CACHE_SCOPE_KEY] as UnknownRecord)
    : createWorkerQuestionCacheNode();
  const existingNetwork = workerCanonicalCacheIdentityMatches(cachedNetwork, identity)
    ? cachedNetwork
    : createWorkerQuestionCacheNode();
  const network = { ...existingNetwork };
  const questions = isRecord(network.questions) ? { ...network.questions } : {};
  const pending = isRecord(network.pendingQuestionMetadata) ? { ...network.pendingQuestionMetadata } : {};
  const refs = isRecord(network.workerQuestionMetadataRefs) ? { ...network.workerQuestionMetadataRefs } : {};

  mergeMetadataEntries({
    entries: rows,
    items: questions,
    pending,
    refs,
    toItem: (row, base) => ({ ...base, ...row.payload, id: row.id }),
    verify: questionPayloadMatchesId,
  });

  next[WORKER_CANONICAL_CACHE_SCOPE_KEY] = withWorkerCanonicalCacheIdentity(
    {
      ...createWorkerQuestionCacheNode(),
      ...network,
      questions,
      pendingQuestionMetadata: pending,
      workerQuestionMetadataRefs: refs,
    },
    identity,
  );
  return next;
};

export const mergeWorkerCanonicalSurveyMetadata = (
  current: unknown,
  rows: WorkerCanonicalMetadataEntry[],
  identity: WorkerCanonicalCacheIdentity,
): UnknownRecord => {
  const next = isRecord(current) ? { ...current } : {};
  const cachedNetwork = isRecord(next[WORKER_CANONICAL_CACHE_SCOPE_KEY])
    ? (next[WORKER_CANONICAL_CACHE_SCOPE_KEY] as UnknownRecord)
    : createWorkerSurveyCacheNode();
  const existingNetwork = workerCanonicalCacheIdentityMatches(cachedNetwork, identity)
    ? cachedNetwork
    : createWorkerSurveyCacheNode();
  const network = { ...existingNetwork };
  const surveys = isRecord(network.surveys) ? { ...network.surveys } : {};
  const pending = isRecord(network.pendingSurveyMetadata) ? { ...network.pendingSurveyMetadata } : {};
  const refs = isRecord(network.workerSurveyMetadataRefs) ? { ...network.workerSurveyMetadataRefs } : {};

  mergeMetadataEntries({
    entries: rows,
    items: surveys,
    pending,
    refs,
    toItem: (row, base) => ({ ...base, ...row.payload, id: row.id, surveyID: row.id }),
    verify: () => true,
  });

  next[WORKER_CANONICAL_CACHE_SCOPE_KEY] = withWorkerCanonicalCacheIdentity(
    {
      ...createWorkerSurveyCacheNode(),
      ...network,
      surveys,
      pendingSurveyMetadata: pending,
      workerSurveyMetadataRefs: refs,
    },
    identity,
  );
  return next;
};

export const loadWorkerCanonicalQuestions = (
  input: WorkerCanonicalMetadataHydrationInput = {},
  deps: WorkerCanonicalMetadataHydrationDeps = {},
): Promise<WorkerCanonicalMetadataEntry[]> => loadWorkerCanonicalMetadata(STORAGE_RESOURCE_KEYS.QUESTIONS, input, deps);

export const loadWorkerCanonicalSurveys = (
  input: WorkerCanonicalMetadataHydrationInput = {},
  deps: WorkerCanonicalMetadataHydrationDeps = {},
): Promise<WorkerCanonicalMetadataEntry[]> => loadWorkerCanonicalMetadata(STORAGE_RESOURCE_KEYS.SURVEYS, input, deps);

// The authoring inputs a question id is hashed from, compared exactly: the
// hash trims and lowercases the prompt, skips options for most types and joins
// multichoice options with commas, so equal ids can hide different questions.
// Surrounding spaces in the prompt or options are ignored, as the hash ignores
// them, and voice credits may be stored as text ("120"); everything else,
// including case, must match.
const trimText = (value: unknown): unknown => (typeof value === 'string' ? value.trim() : value);
const readVoiceCredits = (value: unknown): number =>
  value == null ? 99 : typeof value === 'number' || typeof value === 'string' ? Number(value) : NaN;
const readQuestionAuthoringInputs = (payload: UnknownRecord): string =>
  JSON.stringify([
    payload.type,
    trimText(payload.prompt),
    Array.isArray(payload.options) ? payload.options.map(trimText) : [],
    !!(payload.singleSelect || payload.oneSelectionOnly),
    readVoiceCredits(payload.voiceCredits),
  ]);

// Loads the session's questions once and returns a check for whether readers
// already see a given question under its id: a stored Worker version won that
// id and has exactly the same authoring inputs. Response hydration also writes
// placeholder questions from responders' payloads; those have no stored version
// and never match. Locked or unknown questions never match either.
export const loadWorkerCanonicalQuestionMatcher = async (
  input: WorkerCanonicalMetadataHydrationInput = {},
  deps: WorkerCanonicalMetadataHydrationDeps = {},
): Promise<(question: UnknownRecord) => boolean> => {
  const target = resolveWorkerCanonicalStorageTarget({
    sessionConfig: input.sessionConfig,
    sessionSlug: input.sessionSlug,
  });
  const rows = await loadWorkerCanonicalQuestions(input, deps);
  const cache = peekCacheSync<UnknownRecord>(
    METADATA_CACHE_NAMESPACES[STORAGE_RESOURCE_KEYS.QUESTIONS],
    readString(input.sessionSlug),
    { clone: false },
  );
  const identity = resolveWorkerCanonicalCacheIdentity({
    sessionConfig: target.sessionConfig,
    sessionSlug: target.sessionSlug,
  });
  const node = mergeWorkerCanonicalQuestionMetadata(cache, rows, identity)[WORKER_CANONICAL_CACHE_SCOPE_KEY];
  const questions = isRecord(node) && isRecord(node.questions) ? node.questions : {};
  const refs =
    isRecord(node) && isRecord(node[METADATA_REFS_FIELDS[STORAGE_RESOURCE_KEYS.QUESTIONS]])
      ? (node[METADATA_REFS_FIELDS[STORAGE_RESOURCE_KEYS.QUESTIONS]] as UnknownRecord)
      : {};
  return (question) => {
    const id = readPayloadResourceId(question, STORAGE_RESOURCE_KEYS.QUESTIONS);
    const stored = id ? questions[id] : null;
    return (
      isRecord(refs[id]) &&
      isRecord(stored) &&
      questionPayloadMatchesId(id, question) === true &&
      readQuestionAuthoringInputs(stored) === readQuestionAuthoringInputs(question)
    );
  };
};

export const workerCanonicalMetadataHydrationPort: WorkerCanonicalMetadataHydrationPort = {
  loadQuestions: loadWorkerCanonicalQuestions,
  loadSurveys: loadWorkerCanonicalSurveys,
};
