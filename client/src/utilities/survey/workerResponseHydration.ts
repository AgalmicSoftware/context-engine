import { listSessionStorageRefsPage, readSessionStorageBlob } from '../storage/storageClient.js';
import { isResponseRecencyNewer, toResponseRecencyPair } from './responseRecency.js';

type UnknownRecord = Record<string, unknown>;

type WorkerStoragePage = {
  items: unknown[];
  cursor: string | null;
  listComplete: boolean;
};

type WorkerCanonicalResponseHydrationDeps = {
  listSessionStorageRefsPage?: (options: UnknownRecord) => Promise<WorkerStoragePage>;
  readSessionStorageBlob?: (options: UnknownRecord) => Promise<Response>;
};

export type WorkerCanonicalResponseRow = {
  questionId: string;
  responder: string;
  response: UnknownRecord;
  storageRefId: string;
  timestamp: number;
};

const WORKER_CANONICAL_RESPONSE_CACHE_SCOPE_KEY = 'worker';

const MAX_RESPONSE_LIST_PAGES = 100;
const RESPONSE_READ_CONCURRENCY = 8;

const isRecord = (value: unknown): value is UnknownRecord =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const readString = (value: unknown): string => String(value || '').trim();

export const isWorkerCanonicalSessionConfig = (value: unknown): boolean => {
  const config = isRecord(value) ? value : {};
  const profile = isRecord(config.sessionModeProfile) ? config.sessionModeProfile : {};
  const authority = isRecord(profile.authority) ? profile.authority : {};
  return authority.mode === 'worker_canonical';
};

export const loadWorkerResponses = async (
  {
    sessionSlug,
    sessionConfig,
  }: {
    sessionSlug: string;
    sessionConfig: UnknownRecord;
  },
  deps: WorkerCanonicalResponseHydrationDeps = {},
): Promise<WorkerCanonicalResponseRow[]> => {
  if (!isWorkerCanonicalSessionConfig(sessionConfig)) return [];
  const listPage = deps.listSessionStorageRefsPage || listSessionStorageRefsPage;
  const readBlob = deps.readSessionStorageBlob || readSessionStorageBlob;
  const items: UnknownRecord[] = [];
  const seenCursors = new Set<string>();
  let cursor: string | null = null;

  for (let pageIndex = 0; pageIndex < MAX_RESPONSE_LIST_PAGES; pageIndex += 1) {
    const page = await listPage({
      sessionSlug,
      sessionConfig,
      resource: 'responses',
      cursor,
      limit: 100,
    });
    items.push(...(Array.isArray(page.items) ? page.items.filter(isRecord) : []));
    if (page.listComplete) break;
    const nextCursor = readString(page.cursor);
    if (!nextCursor || seenCursors.has(nextCursor)) {
      throw new Error('Worker response storage pagination returned an invalid cursor.');
    }
    seenCursors.add(nextCursor);
    cursor = nextCursor;
    if (pageIndex === MAX_RESPONSE_LIST_PAGES - 1) {
      throw new Error('Worker response storage pagination exceeded the safety limit.');
    }
  }

  const rows: WorkerCanonicalResponseRow[] = [];
  for (let offset = 0; offset < items.length; offset += RESPONSE_READ_CONCURRENCY) {
    const batch = items.slice(offset, offset + RESPONSE_READ_CONCURRENCY);
    const batchRows = await Promise.all(
      batch.map(async (item): Promise<WorkerCanonicalResponseRow | null> => {
        const storageRef = isRecord(item.storageRef) ? item.storageRef : {};
        const metadata = isRecord(item.metadata) ? item.metadata : {};
        const storageRefId = readString(storageRef.id);
        if (!storageRefId) return null;
        const response = await readBlob({
          storageRef,
          sessionSlug,
          sessionConfig,
        });
        const payload = await response.json().catch(() => null);
        if (!isRecord(payload)) return null;
        const questionId = readString(payload.questionID || payload.questionId).toLowerCase();
        if (!questionId) return null;
        // The Worker derives this value from the authenticated uploader. Payload claims
        // are intentionally ignored so one participant cannot impersonate another.
        const responder = readString(metadata.responder).toLowerCase();
        if (!responder) return null;
        const createdAtMs = Date.parse(readString(metadata.createdAt));
        return {
          questionId,
          responder,
          response: payload,
          storageRefId,
          timestamp: Number.isFinite(createdAtMs) && createdAtMs > 0 ? Math.floor(createdAtMs / 1000) : 1,
        };
      }),
    );
    rows.push(...batchRows.filter((row): row is WorkerCanonicalResponseRow => !!row));
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

export const mergeWorkerQuestionResponses = (
  current: unknown,
  rows: WorkerCanonicalResponseRow[],
  slug: string,
): UnknownRecord => {
  const next = isRecord(current) ? current : {};
  const scope = WORKER_CANONICAL_RESPONSE_CACHE_SCOPE_KEY;
  if (!isRecord(next[scope])) next[scope] = createWorkerQuestionCacheNode();
  const network = next[scope] as UnknownRecord;
  if (!isRecord(network.questions)) network.questions = {};
  if (!isRecord(network.questionResponses)) network.questionResponses = {};
  if (!isRecord(network.questionResponsesMeta)) network.questionResponsesMeta = {};
  if (!isRecord(network.workerResponseStorageRefs)) network.workerResponseStorageRefs = {};
  const questions = network.questions as UnknownRecord;
  const responses = network.questionResponses as UnknownRecord;
  const responseMeta = network.questionResponsesMeta as UnknownRecord;
  const seenRefs = network.workerResponseStorageRefs as UnknownRecord;

  rows.forEach((row) => {
    const storageRefId = readString(row.storageRefId);
    if (storageRefId && seenRefs[storageRefId] != null) return;
    if (storageRefId) seenRefs[storageRefId] = Number(row.timestamp || 0);
    const questionId = readString(row.questionId).toLowerCase();
    const responder = readString(row.responder).toLowerCase();
    if (!questionId || !responder) return;
    if (!isRecord(responses[questionId])) responses[questionId] = {};
    if (!isRecord(responseMeta[questionId])) responseMeta[questionId] = {};
    const byResponder = responses[questionId] as UnknownRecord;
    const metaByResponder = responseMeta[questionId] as UnknownRecord;
    const incoming = toResponseRecencyPair({ timestamp: row.timestamp }, row.response);
    if (!isResponseRecencyNewer(incoming, toResponseRecencyPair(metaByResponder[responder]))) return;
    byResponder[responder] = row.response;
    metaByResponder[responder] = incoming;
    if (!isRecord(questions[questionId])) {
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
  return next;
};

const createWorkerUserData = (): UnknownRecord => ({
  sbts: [],
  createdSurveys: [],
  createdQuestions: [],
  surveyResponses: [],
  questionResponses: [],
});

export const mergeWorkerUserResponses = (current: unknown, rows: WorkerCanonicalResponseRow[]): UnknownRecord => {
  const next = isRecord(current) ? current : {};
  const scope = WORKER_CANONICAL_RESPONSE_CACHE_SCOPE_KEY;
  rows.forEach((row) => {
    const questionId = readString(row.questionId).toLowerCase();
    const responder = readString(row.responder).toLowerCase();
    if (!questionId || !responder) return;
    if (!isRecord(next[responder])) next[responder] = {};
    const byScope = next[responder] as UnknownRecord;
    if (!isRecord(byScope[scope])) {
      byScope[scope] = { lastBlockScanned: 0, lastScanTimestamp: 0, data: createWorkerUserData() };
    }
    const network = byScope[scope] as UnknownRecord;
    if (!isRecord(network.data)) network.data = createWorkerUserData();
    const data = network.data as UnknownRecord;
    if (!Array.isArray(data.questionResponses)) data.questionResponses = [];
    network.lastScanTimestamp = Math.max(Number(network.lastScanTimestamp || 0), Number(row.timestamp || 0));
    const entries = data.questionResponses as UnknownRecord[];
    const existingIndex = entries.findIndex((entry) => readString(entry?.questionId).toLowerCase() === questionId);
    const incoming = { questionId, responder, response: row.response, timestamp: Number(row.timestamp || 0) };
    if (existingIndex < 0) {
      entries.push(incoming);
    } else if (isResponseRecencyNewer(incoming, entries[existingIndex])) {
      entries[existingIndex] = incoming;
    }
  });
  return next;
};
