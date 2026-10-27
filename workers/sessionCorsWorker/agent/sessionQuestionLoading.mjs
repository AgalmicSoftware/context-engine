import { safeString, sanitizeSessionSlug } from './runtimePrimitives.mjs';
import { selectCanonicalStorageVersions } from '../../../shared/storage/canonicalStorageVersions.mjs';
import { listCachedSessionQuestions, payloadConcurrency } from './sessionQuestions.mjs';
import { loadSessionPolicy } from './sessionPolicyLoader.mjs';
import { MAX_WORKER_QUESTION_LIST_PAGES } from './runtimeCore.mjs';
import { normalizePreloadedQuestionRecord, selectWorkerCloudflareQuestionItems, questionIsPayloadUnavailable, cloudflareQuestionItemHasInlinePayload, questionRecordMalformedReason, orderQuestionsForPresentationWithSummary, withSkippedMalformed, orderQuestionsForPresentation, withAgentProposedQuestions } from './hostedQuestionNormalization.mjs';

export function sessionUsesWorkerBackedQuestions(session) {
  return session.sessionModeProfile?.authority?.mode === 'worker_canonical';
}

export async function buildWorkerStorageAuth({ env }) {
  await env.AGENT_SERVICES.current();
  return { ok: true, internal: true, workerUrl: env.AGENT_CONTEXT.origin };
}

export async function fetchWorkerCloudflareJson({ env, path }) {
  const response = await env.AGENT_SERVICES.storage(path);
  const body = await response.json().catch(() => null);
  return response.ok ? { ok: true, body } : { ok: false, status: response.status, reason: 'agent_storage_read_denied' };
}

export async function loadWorkerCloudflareQuestions({
  env = {},
  session = {},
  questionLimit = 0,
  preferredQuestionIds = [],
  fetchImpl = env.QUESTION_FETCH || env.REGISTRY_FETCH || globalThis.fetch,
} = {}) {
  const sessionSlug = sanitizeSessionSlug(session.sessionSlug || session.slug);
  let auth = null;
  try {
    auth = await buildWorkerStorageAuth({ env, session, fetchImpl });
  } catch (error) {
    return {
      ok: false,
      reason: 'telegram_only_cloudflare_questions_list_failed',
      authReason: 'session_worker_auth_failed',
      error: safeString(error?.message || error),
      questions: [],
    };
  }
  if (!auth?.ok) {
    return {
      ok: false,
      reason: 'telegram_only_cloudflare_questions_list_failed',
      authReason: safeString(auth?.reason),
      questions: [],
    };
  }
  const items = [];
  const seenCursors = new Set();
  let cursor = '';
  let listComplete = false;
  for (let page = 0; page < MAX_WORKER_QUESTION_LIST_PAGES && !listComplete; page += 1) {
    const query = new URLSearchParams({ resource: 'questions', limit: '100', ...(cursor ? { cursor } : {}) });
    const listed = await fetchWorkerCloudflareJson({
      auth,
      path: `/storage/list?${query}`,
      env,
      fetchImpl,
    });
    if (!listed.ok) {
      return {
        ok: false,
        reason: 'telegram_only_cloudflare_questions_list_failed',
        error: listed.error,
        status: listed.status || 0,
        questions: [],
      };
    }
    if (Array.isArray(listed.body?.items)) items.push(...listed.body.items);
    cursor = safeString(listed.body?.cursor);
    // A filtered page can be empty and still continue. Workers that predate
    // pagination send neither field and list everything at once.
    listComplete = listed.body?.listComplete === true || (listed.body?.listComplete === undefined && !cursor);
    if (!listComplete && (!cursor || seenCursors.has(cursor))) {
      return {
        ok: false,
        reason: 'telegram_only_cloudflare_questions_list_failed',
        error: 'Worker question list cursor is missing or repeated.',
        questions: [],
      };
    }
    seenCursors.add(cursor);
  }
  if (!listComplete) return { ok: false, reason: 'agent_questions_list_incomplete', questions: [] };
  // Every upload of a question shares its id; present only the version each
  // reader chooses. Rows stored before resourceId was recorded pass through.
  const versionOf = (item) => ({
    resourceId: safeString(item?.metadata?.resourceId),
    createdAtMs: Date.parse(safeString(item?.metadata?.createdAt)) || 0,
    storageRefId: safeString(item?.storageRef?.id || item?.id),
    uploadAuthority: item?.metadata?.uploadAuthority,
  });
  const listedVersions = items.filter((item) => item?.hidden !== true).map(versionOf);
  const currentRefs = new Set(selectCanonicalStorageVersions(listedVersions).map((version) => version.storageRefId));
  const currentItems = items.filter((item) => {
    const version = versionOf(item);
    return item?.hidden !== true && (!version.resourceId || currentRefs.has(version.storageRefId));
  });
  const selectedItems = selectWorkerCloudflareQuestionItems(currentItems, {
    questionLimit,
    preferredQuestionIds,
  });
  const questions = [];
  const readErrors = [];
  const readItem = async (item, index) => {
    const storageRef = item?.storageRef && typeof item.storageRef === 'object' && !Array.isArray(item.storageRef)
      ? item.storageRef
      : {};
    const id = safeString(storageRef.id || item?.id);
    if (!id) return null;
    if (cloudflareQuestionItemHasInlinePayload(item)) {
      const normalized = normalizePreloadedQuestionRecord(
        {
          ...(item && typeof item === 'object' && !Array.isArray(item) ? item : {}),
          storageRef,
        },
        {
          index,
          fallbackSessionSlug: sessionSlug,
          source: 'telegram_only_cloudflare_questions',
          },
      );
      if (normalized && !questionIsPayloadUnavailable(normalized) && !questionRecordMalformedReason(normalized)) {
        return { question: normalized, version: versionOf(item) };
      }
    }
    const read = await fetchWorkerCloudflareJson({
      auth,
      path: `/storage/read?id=${encodeURIComponent(id)}`,
      env,
      fetchImpl,
    });
    if (!read.ok) {
      return { error: { id, reason: read.reason, status: read.status || 0, error: read.error || '' } };
    }
    const normalized = normalizePreloadedQuestionRecord(
      {
        ...(read.body && typeof read.body === 'object' && !Array.isArray(read.body) ? read.body : {}),
        storageRef,
      },
      {
        index,
        fallbackSessionSlug: sessionSlug,
        source: 'telegram_only_cloudflare_questions',
        },
    );
    return normalized ? { question: normalized, version: versionOf(item) } : null;
  };
  // Reads share the Worker's few outbound connections; an unbounded batch starts
  // every read's timeout while it still waits for one.
  const readResults = new Array(selectedItems.length);
  let nextRead = 0;
  await Promise.all(Array.from({ length: Math.min(selectedItems.length, payloadConcurrency(env)) }, async () => {
    while (nextRead < selectedItems.length) {
      const index = nextRead;
      nextRead += 1;
      readResults[index] = await readItem(selectedItems[index], index);
    }
  }));
  // Legacy rows name their question only in the payload; fold them into the
  // same version choice now that their ids are known.
  const loaded = readResults
    .filter((result) => result?.question)
    .map(({ question, version }) => ({
      question,
      version: { ...version, resourceId: version.resourceId || safeString(question.questionId) },
    }));
  const chosenRefs = new Set(
    selectCanonicalStorageVersions(loaded.map(({ version }) => version)).map((version) => version.storageRefId),
  );
  loaded.forEach(({ question, version }) => {
    if (!version.resourceId || chosenRefs.has(version.storageRefId)) questions.push(question);
  });
  readResults.forEach((result) => {
    if (result?.error) readErrors.push(result.error);
  });
  return {
    ok: readErrors.length === 0 || questions.length > 0,
    reason: readErrors.length && questions.length === 0
      ? 'telegram_only_cloudflare_questions_read_failed'
      : (questions.length ? 'telegram_only_cloudflare_questions_loaded' : 'telegram_only_cloudflare_questions_empty'),
    source: 'telegram_only_cloudflare_storage',
    questions,
    questionCount: questions.length,
    complete: listComplete && selectedItems.length >= currentItems.length && readErrors.length === 0,
    loadedCount: questions.length,
    discoveredCount: currentItems.length,
    payloadFailureCount: readErrors.length,
    readErrors,
  };
}

export async function loadWorkerQuestionsForSession(env, sessionSlug, options = {}) {
  const policy = await loadSessionPolicy(env);
  const session = policy.linkedSessions.find(value => value.sessionSlug === sessionSlug);
  if (!session || !sessionUsesWorkerBackedQuestions(session)) return null;
  const result = await loadWorkerCloudflareQuestions({ env, session, ...options });
  return { ...result, questions: orderQuestionsForPresentation(result.questions || []) };
}

export async function loadQuestionsForSession(env = {}, sessionSlug = '', options = {}) {
  const hosted = await loadWorkerQuestionsForSession(env, sessionSlug, options);
  const result = hosted || await listCachedSessionQuestions({ env, sessionSlug, ...options });
  const summary = orderQuestionsForPresentationWithSummary(result.questions || []);
  return withAgentProposedQuestions(env, sessionSlug, { ...result, questions: summary.questions })
    .then(value => withSkippedMalformed(value, summary.skippedMalformed));
 }
