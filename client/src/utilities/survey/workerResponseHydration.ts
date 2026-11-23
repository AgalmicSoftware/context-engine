import { isWorkerResponseNewer } from './workerResponseRecency';
import {
  STORAGE_READ_BATCH_MAX_IDS,
  isConfiguredAdmin,
  listSessionStorageRefsPage,
  readSessionStorageBatch,
  readSessionStorageBlob,
} from '../storage/storageClient.js';
import { type WorkerCapabilities, readWorkerCapabilities } from '../worker/workerCapabilities';
import { isWorkerSignInNeededError } from '../worker/workerAuth';
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

export type WorkerResponseLoadProgress = { loaded: number; listed: number; listComplete: boolean };

export type WorkerCanonicalResponseRow = {
  questionId: string;
  responder: string;
  response: UnknownRecord;
  storageRefId: string;
  timestamp: number;
};

const MAX_RESPONSE_LIST_PAGES = 100;
// Answers asked for in one request. The Worker lists up to 500; one from before that lists 100 and hands back a
// cursor, so both are read to the end.
export const RESPONSE_LIST_PAGE_SIZE = 500;
// One load lists this many answers at most, whatever the page size; the rest are reached from its last cursor.
const MAX_LISTED_RESPONSES = MAX_RESPONSE_LIST_PAGES * 100;
const RESPONSE_READ_CONCURRENCY = 8;
// Batch reads in flight at once while the listing continues: each costs the Worker a few seconds cold.
export const RESPONSE_BATCH_CONCURRENCY = 6;
export const SIGNED_IN_READ_LIMIT_MS = 15_000;
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

/** Whether this reader gets answers' research material from the Worker: a session admin (authors get their own). */
export const readsResearchMaterial = (sessionConfig: unknown, account: unknown): boolean =>
  isConfiguredAdmin(sessionConfig, { account });

// A signed-in read the page cannot make without asking, or one the Worker refuses: reading signed out is all that's left.
const cannotSignInQuietly = (error: unknown): boolean =>
  isWorkerSignInNeededError(error) ||
  /authenticate with the worker|\((401|403)\)/i.test(error instanceof Error ? error.message : String(error));

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
    onRows,
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
    // Receives each batch's rows as they land, with how many listed answers are in hand (read or reused).
    onRows?: (rows: WorkerCanonicalResponseRow[], progress: WorkerResponseLoadProgress) => void;
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
  // A load keeps the reader it started as. One started signed out reads signed out to its end: a members-only
  // session's refusal ends it. Were its refused page sent again under a sign-in that landed meanwhile, it would
  // read every answer for a reader who is gone, beside the load that sign-in starts.
  const signedOutLoad = !readString(account) && !ownResponses ? { anonymousOnly: true as const } : {};
  const items: UnknownRecord[] = [];
  const seenCursors = new Set<string>();
  let cursor: string | null = (!ownResponses && readString(startCursor)) || null;
  const fromStart = !cursor;

  type WantedRead = { metadata: UnknownRecord; storageRef: UnknownRecord; storageRefId: string };
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
      // Not this session's answer, even in one's own list: one stored under this link while it named another
      // session is left out, as Results leave it out, rather than failing the load and with it every submit.
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
    ...signedOutLoad,
  };
  // The Worker sends an answer's research material only to its author and the session's admins, so those reads
  // go signed in: a signed-out copy would drop it from Results, the export, and a resubmitted answer. Everyone
  // else's answers are read signed out first, as before.
  const reader = readString(account).toLowerCase();
  const readsAllWhole = ownResponses || readsResearchMaterial(target.sessionConfig, account);
  const signedIn = ({ metadata }: WantedRead) =>
    readsAllWhole || (!!reader && readString(metadata.responder).toLowerCase() === reader);
  // Own answers are read signed in as before. Results never ask anyone to sign: without a token held, these reads
  // go signed out, and the copies come back marked so a later load reads them again.
  // Once the page can't sign in quietly, or a signed-in read outlasts the limit, the rest of this load go signed out,
  // so the limit is paid once. Any other failure (a busy Worker) is the batch's to retry, signed in.
  let signedInGaveUp = false;
  const readWhole = async <T>(
    read: (auth: { preferAnonymous?: false; prompt?: false; signal?: AbortSignal }) => Promise<T>,
  ) => {
    signal?.throwIfAborted();
    if (ownResponses) return read({ preferAnonymous: false });
    if (signedInGaveUp) return read({});
    // A silent sign-in that never settles (a passkey sheet closed unanswered) must not hold Results: past a limit,
    // the signed-in read is dropped and read signed out.
    const limit = new AbortController();
    const stop = () => limit.abort(signal?.reason);
    signal?.addEventListener('abort', stop, { once: true });
    let timer: ReturnType<typeof setTimeout> | undefined;
    let timedOut = false;
    try {
      return await Promise.race([
        read({ preferAnonymous: false, prompt: false, signal: limit.signal }),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            timedOut = true;
            limit.abort();
            reject(new Error('The signed-in read took too long.'));
          }, SIGNED_IN_READ_LIMIT_MS);
        }),
      ]);
    } catch (error) {
      signal?.throwIfAborted();
      if (!timedOut && !cannotSignInQuietly(error)) throw error;
      signedInGaveUp = true;
      return read({});
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', stop);
    }
  };
  let batched: boolean | null = null;
  // A signed-out batch a members-only session refuses is read again signed in, and only then does this tab know
  // the route needs a sign-in (workerSignInRoutes). Until one has come back, a signed-in reader's batches go one
  // at a time, so the first is the only one sent twice; a signed-out reader has no sign-in to learn.
  let signedOutRouteKnown = !reader || readsAllWhole;
  const readBatch = deps.readSessionStorageBatch || readSessionStorageBatch;
  const readPayloads = async (chunk: WantedRead[]): Promise<unknown[]> => {
    const payloads: unknown[] = [];
    if (batched) {
      // At most two requests a chunk: the reader's own answers (or all, for an admin) signed in, the rest as before.
      for (const whole of [true, false]) {
        const part = chunk.map((read, index) => ({ read, index })).filter(({ read }) => signedIn(read) === whole);
        if (!part.length) continue;
        const ids = part.map(({ read: entry }) => entry.storageRefId);
        const read = whole
          ? await readWhole((auth) => readBatch({ ...readTarget, ...auth, ids }))
          : await readBatch({ ...readTarget, ids });
        if (!whole) signedOutRouteKnown = true;
        part.forEach(({ index }, at) => {
          payloads[index] = read[at];
        });
      }
      return payloads;
    }
    return Promise.all(
      chunk.map(async (read) =>
        (signedIn(read)
          ? await readWhole((auth) => readBlob({ ...readTarget, ...auth, storageRef: read.storageRef }))
          : await readBlob({ ...readTarget, storageRef: read.storageRef })
        )
          .json()
          .catch(() => null),
      ),
    );
  };

  // Each page's reads start as it is listed, a few batches at once, so reading overlaps the listing. Rows keep
  // listing order. A batch that fails is read once more; if that fails too, the load fails, never hangs.
  const chunks: WantedRead[][] = [];
  const chunkRows: WorkerCanonicalResponseRow[][] = [];
  let queued: WantedRead[] = [];
  let wantedCount = 0;
  let readCount = 0;
  let listComplete = false;
  let listingDone = false;
  let failure: { error: unknown } | null = null;
  let next = 0;
  let active = 0;
  let resolveIdle: () => void = () => {};
  const idle = new Promise<void>((resolve) => {
    resolveIdle = resolve;
  });
  const reportProgress = (rows: WorkerCanonicalResponseRow[]) =>
    onRows?.(rows, { loaded: items.length - wantedCount + readCount, listed: items.length, listComplete });
  const settleIfIdle = () => {
    if (listingDone && active === 0 && (failure || next >= chunks.length)) resolveIdle();
  };
  const runChunk = async (chunk: WantedRead[], at: number) => {
    let payloads: unknown[];
    try {
      payloads = await readPayloads(chunk);
    } catch (error) {
      if (signal?.aborted) throw error;
      payloads = await readPayloads(chunk);
    }
    if (failure) return;
    const rows = chunk.flatMap((read, index) => toRow(read, payloads[index]) || []);
    chunkRows[at] = rows;
    readCount += chunk.length;
    reportProgress(rows);
  };
  const pump = () => {
    const limit = batched && signedOutRouteKnown ? RESPONSE_BATCH_CONCURRENCY : 1;
    while (!failure && active < limit && next < chunks.length) {
      const at = next++;
      active += 1;
      void runChunk(chunks[at], at)
        .catch((error: unknown) => {
          failure = failure || { error };
        })
        .finally(() => {
          active -= 1;
          pump();
          settleIfIdle();
        });
    }
  };
  const queueReads = async (pageItems: UnknownRecord[]) => {
    for (const item of pageItems) {
      const storageRef = isRecord(item.storageRef) ? item.storageRef : {};
      const metadata = isRecord(item.metadata) ? item.metadata : {};
      const storageRefId = readString(storageRef.id);
      if (
        ownResponses &&
        (!storageRefId || readString(metadata.responder).toLowerCase() !== readString(account).toLowerCase())
      )
        throw new Error('The Worker returned an invalid own-response reference.');
      // Response payloads are immutable; an edit receives a new storage reference.
      if (storageRefId && !cachedStorageRefIds?.has(storageRefId)) {
        queued.push({ metadata, storageRef, storageRefId });
        wantedCount += 1;
      }
    }
    if (queued.length && batched === null) {
      batched = (
        await (deps.readWorkerCapabilities || readWorkerCapabilities)(readString(target.workerUrl), target.sessionSlug)
      ).features.includes('storage_read_batch_v1');
    }
    const step = batched ? STORAGE_READ_BATCH_MAX_IDS : RESPONSE_READ_CONCURRENCY;
    while (queued.length >= step) chunks.push(queued.splice(0, step));
    pump();
  };

  try {
    for (let pageIndex = 0; ; pageIndex += 1) {
      signal?.throwIfAborted();
      if (failure) break;
      const page = await listPage({
        sessionSlug: target.sessionSlug,
        sessionConfig: target.sessionConfig,
        context,
        workerUrl: target.workerUrl,
        resource: 'responses',
        ...(ownResponses
          ? { ownResponses: { account: readString(account).toLowerCase(), sessionId: target.sessionId } }
          : signedOutLoad),
        // A load told to stop drops the page it is waiting for, too.
        ...(signal ? { signal } : {}),
        cursor,
        limit: RESPONSE_LIST_PAGE_SIZE,
      });
      const pageItems = Array.isArray(page.items) ? page.items.filter(isRecord) : [];
      items.push(...pageItems);
      await queueReads(pageItems);
      // Count each listed page too: rows already cached need no read, so a reload could otherwise count nothing.
      if (!page.listComplete) reportProgress([]);
      if (page.listComplete) {
        listComplete = true;
        if (fromStart) {
          onListed?.(
            new Set(
              items.map((item) => readString(isRecord(item.storageRef) ? item.storageRef.id : '')).filter(Boolean),
            ),
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
      if (!ownResponses && (pageIndex === MAX_RESPONSE_LIST_PAGES - 1 || items.length >= MAX_LISTED_RESPONSES)) {
        onPartial?.(nextCursor);
        break;
      }
    }
    if (queued.length) chunks.push(queued);
    queued = [];
    pump();
  } catch (error) {
    failure = failure || { error };
  }
  listingDone = true;
  settleIfIdle();
  await idle;
  if (failure) throw (failure as { error: unknown }).error;
  return chunkRows.flat();
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

// The Worker sends an answer's research material only to its author and the admins, so one stored answer can be
// cached stripped (read signed out) or whole. Whatever lands first, the whole copy is kept: it replaces a stripped
// copy of the same stored answer, and a stripped copy never replaces it.
const fillsWithheldCopy = (cached: unknown, cachedMeta: unknown, row: WorkerCanonicalResponseRow): boolean =>
  isRecord(cached) &&
  cached.interviewProvenanceWithheld === true &&
  row.response?.interviewProvenanceWithheld !== true &&
  !!readString(row.storageRefId) &&
  isRecord(cachedMeta) &&
  readString(cachedMeta.storageRefId) === readString(row.storageRefId);

export const mergeWorkerQuestionResponses = (
  current: unknown,
  rows: WorkerCanonicalResponseRow[],
  slug: string,
  identity: WorkerCanonicalCacheIdentity,
  staleRefIds?: ReadonlySet<string>,
  // Refs merged earlier in this same load, judged again here: a row a mid-load merge saw but ranked below a copy
  // since dropped as stale must not be skipped as already seen.
  rejudgedRefIds?: ReadonlySet<string>,
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
  rejudgedRefIds?.forEach((refId) => delete seenRefs[refId]);

  rows.forEach((row) => {
    const storageRefId = readString(row.storageRefId);
    const questionId = readString(row.questionId).toLowerCase();
    const responder = readString(row.responder).toLowerCase();
    const byResponder = isRecord(responses[questionId]) ? { ...(responses[questionId] as UnknownRecord) } : {};
    const metaByResponder = isRecord(responseMeta[questionId])
      ? { ...(responseMeta[questionId] as UnknownRecord) }
      : {};
    const fills = fillsWithheldCopy(byResponder[responder], metaByResponder[responder], row);
    if (storageRefId && seenRefs[storageRefId] != null && !fills) return;
    if (storageRefId) seenRefs[storageRefId] = Number(row.timestamp || 0);
    if (!questionId || !responder) return;
    if (!fills && !isWorkerResponseNewer(row.timestamp, storageRefId, metaByResponder[responder])) return;
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
    } else if (
      isWorkerResponseNewer(incoming.timestamp, incoming.storageRefId, entries[existingIndex]) ||
      fillsWithheldCopy(entries[existingIndex].response, entries[existingIndex], row)
    ) {
      entries[existingIndex] = incoming;
    }
    network.data = data;
    network.workerResponseCacheVersion = WORKER_RESPONSE_CACHE_VERSION;
    byScope[WORKER_CANONICAL_CACHE_SCOPE_KEY] = withWorkerCanonicalCacheIdentity(network, identity);
    next[responder] = byScope;
  });
  return next;
};
