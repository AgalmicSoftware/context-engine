import { isWorkerResponseNewer } from './workerResponseRecency';
import {
  STORAGE_READ_BATCH_MAX_IDS,
  listSessionStorageRefsPage,
  readSessionStorageBatch,
  readSessionStorageBlob,
} from '../storage/storageClient.js';
import { type WorkerCapabilities, readWorkerCapabilities } from '../worker/workerCapabilities';
import { resolveSessionCapabilityProjection } from '../session/sessionCapabilityProjection';
import { canonicalizeSessionSlug } from '../session/canonicalSessionContext';
import { normalizeWorkerCanonicalSessionIdHex } from '../session/sessionWorkerDiscovery';
import { resolveWorkerCanonicalStorageTarget } from '../../domains/surveys/workerCanonicalAuthoringPort';
import {
  WORKER_CANONICAL_CACHE_SCOPE_KEY,
  type WorkerCanonicalCacheIdentity,
  withWorkerCanonicalCacheIdentity,
  workerCanonicalCacheIdentityMatches,
} from './workerCanonicalCacheIdentity';

type UnknownRecord = Record<string, unknown>;

type WorkerStoragePage = {
  items: unknown[];
  cursor: string | null;
  listComplete: boolean;
};

type WorkerCanonicalResponseHydrationDeps = {
  listSessionStorageRefsPage?: (options: UnknownRecord) => Promise<WorkerStoragePage>;
  readSessionStorageBlob?: (options: UnknownRecord) => Promise<Response>;
  readSessionStorageBatch?: (options: UnknownRecord & { ids: string[] }) => Promise<unknown[]>;
  readWorkerCapabilities?: (workerUrl: string, slug: string) => Promise<WorkerCapabilities>;
};

export type WorkerCanonicalResponseRow = {
  questionId: string;
  responder: string;
  response: UnknownRecord;
  storageRefId: string;
  timestamp: number;
};

const MAX_RESPONSE_LIST_PAGES = 100;
const RESPONSE_READ_CONCURRENCY = 8;
const WORKER_RESPONSE_CACHE_VERSION = 1;

const isRecord = (value: unknown): value is UnknownRecord =>
  !!value && typeof value === 'object' && !Array.isArray(value);

// Response payloads are any participant's JSON, and converting an object with a
// broken toString throws, so only strings count as text here.
const readString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

// A survey submission stores one container beside the individual answers it
// repeats; answer readers use the individual records and skip the container.
const isSurveyResponseContainer = (payload: UnknownRecord): boolean =>
  Array.isArray(payload.responses) && !!readString(payload.surveyID || payload.surveyId);

export const isWorkerCanonicalSessionConfig = (value: unknown): boolean => {
  const projection = resolveSessionCapabilityProjection(value);
  return projection.profileValid && projection.isWorkerCanonical;
};

export const loadWorkerResponses = async (
  {
    account,
    providerLike,
    sessionSlug,
    sessionConfig,
    cachedStorageRefIds,
    startCursor,
    onPartial,
    onListed,
    ownResponses = false,
    signal,
  }: {
    account?: unknown;
    providerLike?: unknown;
    sessionSlug: string;
    sessionConfig: UnknownRecord;
    cachedStorageRefIds?: ReadonlySet<string>;
    // Continues a public listing where a capped run stopped.
    startCursor?: string | null;
    // Receives the cursor to continue from when the page cap stops the listing.
    onPartial?: (resumeCursor?: string) => void;
    // Receives every listed storage ref, read or reused, once a listing that
    // began at the first page is complete.
    onListed?: (storageRefIds: ReadonlySet<string>) => void;
    ownResponses?: boolean;
    signal?: AbortSignal;
  },
  deps: WorkerCanonicalResponseHydrationDeps = {},
): Promise<WorkerCanonicalResponseRow[]> => {
  if (!isWorkerCanonicalSessionConfig(sessionConfig)) return [];
  const target = resolveWorkerCanonicalStorageTarget({
    sessionSlug,
    sessionConfig,
  });
  const listPage = deps.listSessionStorageRefsPage || listSessionStorageRefsPage;
  const readBlob = deps.readSessionStorageBlob || readSessionStorageBlob;
  const context = { account, providerLike };
  const items: UnknownRecord[] = [];
  const seenCursors = new Set<string>();
  let cursor: string | null = (!ownResponses && readString(startCursor)) || null;
  const fromStart = !cursor;

  for (let pageIndex = 0; ownResponses || pageIndex < MAX_RESPONSE_LIST_PAGES; pageIndex += 1) {
    signal?.throwIfAborted();
    const page = await listPage({
      sessionSlug: target.sessionSlug,
      sessionConfig: target.sessionConfig,
      context,
      workerUrl: target.workerUrl,
      resource: 'responses',
      ...(ownResponses
        ? { ownResponses: { account: readString(account).toLowerCase(), sessionId: target.sessionId }, signal }
        : {}),
      cursor,
      limit: 100,
    });
    items.push(...(Array.isArray(page.items) ? page.items.filter(isRecord) : []));
    if (page.listComplete) {
      if (fromStart) {
        onListed?.(
          new Set(items.map((item) => readString(isRecord(item.storageRef) ? item.storageRef.id : '')).filter(Boolean)),
        );
      }
      break;
    }
    const nextCursor = readString(page.cursor);
    if (!nextCursor || seenCursors.has(nextCursor)) {
      throw new Error('Worker response storage pagination returned an invalid cursor.');
    }
    seenCursors.add(nextCursor);
    cursor = nextCursor;
    if (!ownResponses && pageIndex === MAX_RESPONSE_LIST_PAGES - 1) {
      onPartial?.(nextCursor);
    }
  }

  type WantedRead = { metadata: UnknownRecord; storageRef: UnknownRecord; storageRefId: string };
  const wanted: WantedRead[] = [];
  for (const item of items) {
    const storageRef = isRecord(item.storageRef) ? item.storageRef : {};
    const metadata = isRecord(item.metadata) ? item.metadata : {};
    const storageRefId = readString(storageRef.id);
    if (
      ownResponses &&
      (!storageRefId || readString(metadata.responder).toLowerCase() !== readString(account).toLowerCase())
    )
      throw new Error('The Worker returned an invalid own-response reference.');
    // Response payloads are immutable; an edit receives a new storage reference.
    if (storageRefId && !cachedStorageRefIds?.has(storageRefId)) wanted.push({ metadata, storageRef, storageRefId });
  }

  const toRow = ({ metadata, storageRefId }: WantedRead, payload: unknown): WorkerCanonicalResponseRow | null => {
    if (!isRecord(payload)) {
      if (ownResponses) throw new Error('A saved answer could not be read.');
      return null;
    }
    const payloadSlug = readString(payload.sessionSlug);
    const payloadSessionId = normalizeWorkerCanonicalSessionIdHex(payload.sessionId);
    if (
      payloadSlug !== target.sessionSlug ||
      canonicalizeSessionSlug(payloadSlug) !== target.sessionSlug ||
      payloadSessionId !== target.sessionId
    ) {
      if (ownResponses) throw new Error('A saved answer belongs to a different session.');
      return null;
    }
    const questionId = readString(payload.questionID || payload.questionId).toLowerCase();
    if (!questionId) {
      if (ownResponses && !isSurveyResponseContainer(payload))
        throw new Error('A saved answer has no question identity.');
      return null;
    }
    // The Worker derives this value from the authenticated uploader. Payload claims
    // are intentionally ignored so one participant cannot impersonate another.
    const responder = readString(metadata.responder).toLowerCase();
    if (!responder) return null;
    const createdAtMs = Date.parse(readString(metadata.createdAt));
    if (ownResponses && !(Number.isFinite(createdAtMs) && createdAtMs > 0))
      throw new Error('A saved answer has no valid timestamp.');
    return {
      questionId,
      responder,
      response: payload,
      storageRefId,
      timestamp: Number.isFinite(createdAtMs) && createdAtMs > 0 ? createdAtMs / 1000 : 1,
    };
  };

  // A Worker that reads a whole list page in one request costs two requests per
  // hundred answers; older Workers are read one answer at a time, a few at once.
  const readTarget = {
    sessionSlug: target.sessionSlug,
    sessionConfig: target.sessionConfig,
    context,
    workerUrl: target.workerUrl,
    ...(signal ? { signal } : {}),
  };
  const batched =
    !!wanted.length &&
    (
      await (deps.readWorkerCapabilities || readWorkerCapabilities)(readString(target.workerUrl), target.sessionSlug)
    ).features.includes('storage_read_batch_v1');
  const readBatch = deps.readSessionStorageBatch || readSessionStorageBatch;
  const step = batched ? STORAGE_READ_BATCH_MAX_IDS : RESPONSE_READ_CONCURRENCY;
  const rows: WorkerCanonicalResponseRow[] = [];
  for (let offset = 0; offset < wanted.length; offset += step) {
    signal?.throwIfAborted();
    const chunk = wanted.slice(offset, offset + step);
    const payloads = batched
      ? await readBatch({ ...readTarget, ids: chunk.map((read) => read.storageRefId) })
      : await Promise.all(
          chunk.map(async ({ storageRef }) => (await readBlob({ ...readTarget, storageRef })).json().catch(() => null)),
        );
    chunk.forEach((read, index) => {
      const row = toRow(read, payloads[index]);
      if (row) rows.push(row);
    });
  }

  return rows;
};

const createWorkerQuestionCacheNode = (): UnknownRecord => ({
  questionsLatestBlock: 0,
  questionsDiscoveryCheckpointBlock: 0,
  questions: {},
  questionResponses: {},
  questionResponsesMeta: {},
  questionResponsesLatestBlock: 0,
  pendingQuestionMetadata: {},
  arweaveTxCache: {},
  arweaveTxFailureCache: {},
  questionHydrationMeta: {},
  workerResponseStorageRefs: {},
});

// Refs a previous listing returned that this reader's complete listing no longer
// returns, such as answers whose access was revoked. Answers saved since the
// last listing have refs no listing returned yet, so they are never stale.
const dropStaleResponses = (
  byQuestion: UnknownRecord,
  staleRefIds: ReadonlySet<string>,
  readRefId: (questionId: string, responder: string) => string,
): UnknownRecord =>
  Object.fromEntries(
    Object.entries(byQuestion).map(([questionId, byResponder]) => [
      questionId,
      isRecord(byResponder)
        ? Object.fromEntries(
            Object.entries(byResponder).filter(([responder]) => !staleRefIds.has(readRefId(questionId, responder))),
          )
        : byResponder,
    ]),
  );

export const mergeWorkerQuestionResponses = (
  current: unknown,
  rows: WorkerCanonicalResponseRow[],
  slug: string,
  identity: WorkerCanonicalCacheIdentity,
  staleRefIds?: ReadonlySet<string>,
): UnknownRecord => {
  const next = isRecord(current) ? { ...current } : {};
  const cachedNetwork = isRecord(next[WORKER_CANONICAL_CACHE_SCOPE_KEY])
    ? (next[WORKER_CANONICAL_CACHE_SCOPE_KEY] as UnknownRecord)
    : createWorkerQuestionCacheNode();
  const network: UnknownRecord = workerCanonicalCacheIdentityMatches(cachedNetwork, identity)
    ? { ...cachedNetwork }
    : createWorkerQuestionCacheNode();
  if (network.workerResponseCacheVersion !== WORKER_RESPONSE_CACHE_VERSION) {
    // Old caches may already have consumed a newer same-second ref. Clear both
    // the payloads and seen refs before the runtime decides which blobs to reread.
    network.questionResponses = {};
    network.questionResponsesMeta = {};
    network.workerResponseStorageRefs = {};
  }
  network.workerResponseCacheVersion = WORKER_RESPONSE_CACHE_VERSION;
  const questions = isRecord(network.questions) ? { ...network.questions } : {};
  const tombstones = isRecord(network.workerQuestionMetadataTombstones) ? network.workerQuestionMetadataTombstones : {};
  let responses = isRecord(network.questionResponses) ? { ...network.questionResponses } : {};
  let responseMeta = isRecord(network.questionResponsesMeta) ? { ...network.questionResponsesMeta } : {};
  const seenRefs = isRecord(network.workerResponseStorageRefs) ? { ...network.workerResponseStorageRefs } : {};
  if (staleRefIds?.size) {
    const meta = responseMeta;
    const refOf = (questionId: string, responder: string): string => {
      const byResponder = meta[questionId];
      return isRecord(byResponder) && isRecord(byResponder[responder])
        ? readString(byResponder[responder].storageRefId)
        : '';
    };
    responses = dropStaleResponses(responses, staleRefIds, refOf);
    responseMeta = dropStaleResponses(meta, staleRefIds, refOf);
    staleRefIds.forEach((refId) => delete seenRefs[refId]);
  }

  rows.forEach((row) => {
    const storageRefId = readString(row.storageRefId);
    if (storageRefId && seenRefs[storageRefId] != null) return;
    if (storageRefId) seenRefs[storageRefId] = Number(row.timestamp || 0);
    const questionId = readString(row.questionId).toLowerCase();
    const responder = readString(row.responder).toLowerCase();
    if (!questionId || !responder) return;
    const byResponder = isRecord(responses[questionId]) ? { ...(responses[questionId] as UnknownRecord) } : {};
    const metaByResponder = isRecord(responseMeta[questionId])
      ? { ...(responseMeta[questionId] as UnknownRecord) }
      : {};
    if (!isWorkerResponseNewer(row.timestamp, storageRefId, metaByResponder[responder])) return;
    const incoming = { ts: row.timestamp, storageRefId };
    byResponder[responder] = row.response;
    metaByResponder[responder] = incoming;
    responses[questionId] = byResponder;
    responseMeta[questionId] = metaByResponder;
    if (!isRecord(questions[questionId]) && tombstones[questionId] !== true) {
      const prompt = readString(row.response.prompt || row.response.questionPrompt || row.response.questionText);
      if (prompt) {
        questions[questionId] = {
          id: questionId,
          questionId,
          questionID: questionId,
          prompt,
          question: prompt,
          text: prompt,
          type: readString(row.response.type || row.response.questionType) || 'binary',
          sessionSlug: slug,
          sessionSlugExplicit: true,
          source: 'worker-response-payload',
        };
      }
    }
  });
  next[WORKER_CANONICAL_CACHE_SCOPE_KEY] = withWorkerCanonicalCacheIdentity(
    {
      ...createWorkerQuestionCacheNode(),
      ...network,
      questions,
      questionResponses: responses,
      questionResponsesMeta: responseMeta,
      workerResponseStorageRefs: seenRefs,
    },
    identity,
  );
  return next;
};

const createWorkerUserData = (): UnknownRecord => ({
  sbts: [],
  createdSurveys: [],
  createdQuestions: [],
  surveyResponses: [],
  questionResponses: [],
});

export const mergeWorkerUserResponses = (
  current: unknown,
  rows: WorkerCanonicalResponseRow[],
  identity: WorkerCanonicalCacheIdentity,
  staleRefIds?: ReadonlySet<string>,
): UnknownRecord => {
  const source = isRecord(current) ? current : {};
  const next: UnknownRecord = {};
  Object.entries(source).forEach(([key, value]) => {
    if (!isRecord(value)) {
      next[key] = value;
      return;
    }
    const byScope = { ...value };
    if (
      Object.prototype.hasOwnProperty.call(byScope, WORKER_CANONICAL_CACHE_SCOPE_KEY) &&
      !workerCanonicalCacheIdentityMatches(byScope[WORKER_CANONICAL_CACHE_SCOPE_KEY], identity)
    ) {
      delete byScope[WORKER_CANONICAL_CACHE_SCOPE_KEY];
    }
    const worker = byScope[WORKER_CANONICAL_CACHE_SCOPE_KEY];
    if (
      staleRefIds?.size &&
      isRecord(worker) &&
      isRecord(worker.data) &&
      Array.isArray(worker.data.questionResponses)
    ) {
      byScope[WORKER_CANONICAL_CACHE_SCOPE_KEY] = {
        ...worker,
        data: {
          ...worker.data,
          questionResponses: (worker.data.questionResponses as UnknownRecord[]).filter(
            (entry) => !staleRefIds.has(readString(entry?.storageRefId)),
          ),
        },
      };
    }
    if (isRecord(worker) && worker.workerResponseCacheVersion !== WORKER_RESPONSE_CACHE_VERSION) {
      byScope[WORKER_CANONICAL_CACHE_SCOPE_KEY] = {
        ...worker,
        workerResponseCacheVersion: WORKER_RESPONSE_CACHE_VERSION,
        lastScanTimestamp: 0,
        data: { ...(isRecord(worker.data) ? worker.data : createWorkerUserData()), questionResponses: [] },
      };
    }
    next[key] = byScope;
  });
  rows.forEach((row) => {
    const questionId = readString(row.questionId).toLowerCase();
    const responder = readString(row.responder).toLowerCase();
    if (!questionId || !responder) return;
    if (!isRecord(next[responder])) next[responder] = {};
    const byScope = { ...(next[responder] as UnknownRecord) };
    const cachedNetwork = isRecord(byScope[WORKER_CANONICAL_CACHE_SCOPE_KEY])
      ? (byScope[WORKER_CANONICAL_CACHE_SCOPE_KEY] as UnknownRecord)
      : {};
    const network: UnknownRecord = workerCanonicalCacheIdentityMatches(cachedNetwork, identity)
      ? { ...cachedNetwork }
      : { lastBlockScanned: 0, lastScanTimestamp: 0, data: createWorkerUserData() };
    const data = isRecord(network.data) ? { ...network.data } : createWorkerUserData();
    const entries = Array.isArray(data.questionResponses)
      ? (data.questionResponses as UnknownRecord[]).map((entry) => ({ ...entry }))
      : [];
    data.questionResponses = entries;
    network.lastScanTimestamp = Math.max(Number(network.lastScanTimestamp || 0), Number(row.timestamp || 0));
    const existingIndex = entries.findIndex((entry) => readString(entry?.questionId).toLowerCase() === questionId);
    const incoming = {
      questionId,
      responder,
      response: row.response,
      timestamp: Number(row.timestamp || 0),
      storageRefId: readString(row.storageRefId),
    };
    if (existingIndex < 0) {
      entries.push(incoming);
    } else if (isWorkerResponseNewer(incoming.timestamp, incoming.storageRefId, entries[existingIndex])) {
      entries[existingIndex] = incoming;
    }
    network.data = data;
    network.workerResponseCacheVersion = WORKER_RESPONSE_CACHE_VERSION;
    byScope[WORKER_CANONICAL_CACHE_SCOPE_KEY] = withWorkerCanonicalCacheIdentity(network, identity);
    next[responder] = byScope;
  });
  return next;
};
