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
};

export type WorkerCanonicalMetadataHydrationPort = {
  loadQuestions: (
    input?: WorkerCanonicalMetadataHydrationInput,
    deps?: WorkerCanonicalMetadataHydrationDeps,
  ) => Promise<WorkerCanonicalMetadataRow[]>;
  loadSurveys: (
    input?: WorkerCanonicalMetadataHydrationInput,
    deps?: WorkerCanonicalMetadataHydrationDeps,
  ) => Promise<WorkerCanonicalMetadataRow[]>;
};

const MAX_METADATA_LIST_PAGES = 50;
const METADATA_LIST_PAGE_SIZE = 100;
const MAX_METADATA_ITEMS = MAX_METADATA_LIST_PAGES * METADATA_LIST_PAGE_SIZE;
const METADATA_READ_CONCURRENCY = 8;

const isRecord = (value: unknown): value is UnknownRecord =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const readString = (value: unknown): string => String(value || '').trim();

const readPayloadResourceId = (payload: UnknownRecord, resource: WorkerCanonicalMetadataResource): string => {
  const rawId =
    resource === STORAGE_RESOURCE_KEYS.QUESTIONS
      ? payload.id || payload.questionId || payload.questionID
      : payload.surveyID || payload.id;
  return readString(rawId).toLowerCase();
};

const normalizeListedStorageRef = (
  item: UnknownRecord,
  resource: WorkerCanonicalMetadataResource,
): { createdAtMs: number; storageRef: StorageRef } | null => {
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
  };
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
  const payloadSessionId = normalizeWorkerCanonicalSessionIdHex(payload.sessionId);
  return (
    payloadSlug === sessionSlug &&
    canonicalizeSessionSlug(payloadSlug) === sessionSlug &&
    payloadSessionId === sessionId
  );
};

const loadWorkerCanonicalMetadata = async (
  resource: WorkerCanonicalMetadataResource,
  input: WorkerCanonicalMetadataHydrationInput = {},
  deps: WorkerCanonicalMetadataHydrationDeps = {},
): Promise<WorkerCanonicalMetadataRow[]> => {
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

  const uniqueItems: Array<{ createdAtMs: number; storageRef: StorageRef }> = [];
  const seenStorageRefs = new Set<string>();
  listedItems.forEach((item) => {
    const normalized = normalizeListedStorageRef(item, resource);
    const storageRefId = readString(normalized?.storageRef.id);
    if (!normalized || !storageRefId || seenStorageRefs.has(storageRefId)) return;
    seenStorageRefs.add(storageRefId);
    uniqueItems.push(normalized);
  });

  const rows: WorkerCanonicalMetadataRow[] = [];
  for (let offset = 0; offset < uniqueItems.length; offset += METADATA_READ_CONCURRENCY) {
    const batch = uniqueItems.slice(offset, offset + METADATA_READ_CONCURRENCY);
    const batchRows = await Promise.all(
      batch.map(async ({ createdAtMs, storageRef }): Promise<WorkerCanonicalMetadataRow | null> => {
        const response = await readBlob({
          storageRef,
          sessionSlug: target.sessionSlug,
          sessionConfig: target.sessionConfig,
          context,
          workerUrl: target.workerUrl,
        });
        const payload = await response.json().catch(() => null);
        if (!isRecord(payload) || !payloadMatchesTarget(payload, target)) return null;
        const id = readPayloadResourceId(payload, resource);
        if (!id) return null;
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
        };
      }),
    );
    rows.push(...batchRows.filter((row): row is WorkerCanonicalMetadataRow => !!row));
  }

  return rows.sort(
    (left, right) =>
      left.createdAtMs - right.createdAtMs ||
      left.storageRefId.localeCompare(right.storageRefId) ||
      left.id.localeCompare(right.id),
  );
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

const shouldReplaceMetadata = (existing: unknown, row: WorkerCanonicalMetadataRow): boolean => {
  if (!isRecord(existing)) return true;
  const existingCreatedAtMs = Number(existing.createdAtMs || 0);
  if (row.createdAtMs !== existingCreatedAtMs) return row.createdAtMs > existingCreatedAtMs;
  return row.storageRefId.localeCompare(readString(existing.storageRefId)) >= 0;
};

export const mergeWorkerCanonicalQuestionMetadata = (
  current: unknown,
  rows: WorkerCanonicalMetadataRow[],
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

  rows.forEach((row) => {
    if (!shouldReplaceMetadata(refs[row.id], row)) return;
    const existingQuestion = isRecord(questions[row.id]) ? (questions[row.id] as UnknownRecord) : {};
    questions[row.id] = {
      ...existingQuestion,
      ...row.payload,
      id: row.id,
    };
    refs[row.id] = {
      createdAtMs: row.createdAtMs,
      storageRefId: row.storageRefId,
    };
    delete pending[row.id];
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
  rows: WorkerCanonicalMetadataRow[],
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

  rows.forEach((row) => {
    if (!shouldReplaceMetadata(refs[row.id], row)) return;
    const existingSurvey = isRecord(surveys[row.id]) ? (surveys[row.id] as UnknownRecord) : {};
    surveys[row.id] = {
      ...existingSurvey,
      ...row.payload,
      id: row.id,
      surveyID: row.id,
    };
    refs[row.id] = {
      createdAtMs: row.createdAtMs,
      storageRefId: row.storageRefId,
    };
    delete pending[row.id];
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
): Promise<WorkerCanonicalMetadataRow[]> => loadWorkerCanonicalMetadata(STORAGE_RESOURCE_KEYS.QUESTIONS, input, deps);

export const loadWorkerCanonicalSurveys = (
  input: WorkerCanonicalMetadataHydrationInput = {},
  deps: WorkerCanonicalMetadataHydrationDeps = {},
): Promise<WorkerCanonicalMetadataRow[]> => loadWorkerCanonicalMetadata(STORAGE_RESOURCE_KEYS.SURVEYS, input, deps);

export const workerCanonicalMetadataHydrationPort: WorkerCanonicalMetadataHydrationPort = {
  loadQuestions: loadWorkerCanonicalQuestions,
  loadSurveys: loadWorkerCanonicalSurveys,
};
