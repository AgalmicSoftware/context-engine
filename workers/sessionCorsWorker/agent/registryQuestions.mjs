import { normalizeQuestionPayload, lockedQuestionPlaceholder } from './registryQuestionPayloads.mjs';
import { safeString, lower } from './runtimePrimitives.mjs';
import { resolveRegistryRpcUrls } from './registrySessions.mjs';
import { questionMemoryCache, STORAGE_BACKENDS, normalizeChainId, normalizeBlock, resolveQuestionStorageBackend, normalizeHexAddress } from './registryQuestionCore.mjs';
import { resolveSurveysAddress, buildCloudflareQuestionStorageAuth, fetchSessionConfigForQuestions, currentBlockNumber, resolveScanWindow } from './registryQuestionSource.mjs';
import { cacheTtlSeconds, foregroundChunks, sessionQuestionCacheKey, normalizeQuestionIndex, isFreshQuestionIndex, filterQuestionRecordsForSession, isPayloadUnavailableQuestion, hasPayloadUnavailableQuestions, scopedCachedIndexForReturn, cacheNeedsImmediateScopeRefresh, scheduleIndexRefresh, readKvQuestionIndex, writeKvQuestionIndex, questionIdFromRecord, mergeQuestionRecords, mergeQuestionRanges, removeScannedQuestionRange } from './registryQuestionCache.mjs';
import { fetchQuestionPayloads, scanQuestionRange, mergeScanSummaries } from './registryQuestionScanning.mjs';

// Cached plaintext is never an authorization decision. Cloudflare payload
// conditions can change with membership even when config revision is unchanged.
async function authorizeCachedIndex(env, index) {
  await env.AGENT_SERVICES.current();
  const questions = [];
  for (const question of index.questions || []) {
    const ref = question.storageRef;
    if (ref?.backend !== STORAGE_BACKENDS.CLOUDFLARE) { questions.push(question); continue; }
    const args = { questionId: question.questionId || question.id, pointerId: ref.id,
      pointerBackend: STORAGE_BACKENDS.CLOUDFLARE, sessionSlug: env.AGENT_CONTEXT.slug };
    const response = await env.AGENT_SERVICES.storage(`/storage/read?id=${encodeURIComponent(ref.id)}`);
    if (!response.ok) {
      if (![401, 403, 404].includes(response.status)) throw new Error('question_authority_unavailable');
      questions.push(lockedQuestionPlaceholder(args));
      continue;
    }
    const fresh = normalizeQuestionPayload(await response.json(), args);
    questions.push(fresh?.sessionSlug === env.AGENT_CONTEXT.slug ? fresh : lockedQuestionPlaceholder(args));
  }
  return { ...index, questions, questionCount: questions.length };
}

export async function refreshSessionQuestionIndex({
  env = {},
  sessionSlug = '',
  existingIndex = null,
  mode = 'complete',
  foregroundPayloadLimit = 0,
  fetchImpl = globalThis.fetch,
} = {}) {
  const slug = lower(sessionSlug);
  const key = sessionQuestionCacheKey(env, slug);
  const previous = normalizeQuestionIndex(existingIndex);
  const rpcUrls = resolveRegistryRpcUrls(env);
  if (!rpcUrls.length) {
    return { ok: false, reason: 'question_rpc_url_missing', sessionSlug: slug, questions: [] };
  }

  const session = await fetchSessionConfigForQuestions({
    env,
    sessionSlug: slug,
    rpcUrls,
    fetchImpl,
  });
  const surveysAddress = normalizeHexAddress(session.surveysAddress) || resolveSurveysAddress(env, session.chainId);
  if (!surveysAddress) {
    return { ok: false, reason: 'surveys_address_missing', sessionSlug: slug, questions: [] };
  }
  const pointerBackend = resolveQuestionStorageBackend(session, env);
  let cloudflareAuthPromise = null;
  const getCloudflareAuth = pointerBackend === STORAGE_BACKENDS.CLOUDFLARE
    ? () => {
        if (!cloudflareAuthPromise) {
          cloudflareAuthPromise = buildCloudflareQuestionStorageAuth({
            env,
            session: { ...session, sessionSlug: slug },
            fetchImpl,
          }).catch((error) => ({
            ok: false,
            reason: safeString(error?.message || error) || 'cloudflare_question_auth_failed',
          }));
        }
        return cloudflareAuthPromise;
      }
    : null;

  let currentBlock = 0;
  try {
    currentBlock = await currentBlockNumber({ rpcUrls, fetchImpl });
  } catch (error) {
    return {
      ok: false,
      reason: 'question_current_block_failed',
      error: safeString(error?.message || error),
      sessionSlug: slug,
      questions: previous?.questions || [],
    };
  }
  const scanWindow = resolveScanWindow({ currentBlock, session, env });
  if (scanWindow.sessionScoped !== true) {
    return {
      ok: false,
      reason: 'question_scan_window_unscoped',
      sessionSlug: slug,
      source: 'live_session_question_cache',
      chainId: normalizeChainId(session.chainId),
      surveysAddress,
      scanWindow,
      questions: previous?.questions || [],
    };
  }

  const previousQuestions = filterQuestionRecordsForSession(previous?.questions || [], slug);
  const retryUnavailableQuestions = previousQuestions.filter(isPayloadUnavailableQuestion);
  const retryQuestionIds = retryUnavailableQuestions
    .map(questionIdFromRecord)
    .filter(Boolean);
  let questions = previousQuestions.filter((question) => !isPayloadUnavailableQuestion(question));
  const seenQuestionIds = new Set(questions.map(questionIdFromRecord).filter(Boolean));
  let indexedFromBlock = previous?.indexedFromBlock;
  let indexedToBlock = previous?.indexedToBlock;
  let nextScanToBlock = previous?.nextScanToBlock;
  let complete = previous?.complete === true;
  let aggregateScan = previous?.scan || {};
  let unresolvedRanges = previous?.unresolvedRanges || [];
  let skippedSessionMismatchCount = Number(previous?.skippedSessionMismatchCount || 0) || 0;

  if (retryQuestionIds.length) {
    const retryPayloads = await fetchQuestionPayloads({
      rpcUrls,
      surveysAddress,
      questionIds: retryQuestionIds,
      session,
      sessionSlug: slug,
      pointerBackend,
      getCloudflareAuth,
      seenQuestionIds,
      env,
      fetchImpl,
    });
    skippedSessionMismatchCount += Number(retryPayloads.skippedSessionMismatchCount || 0) || 0;
    questions = mergeQuestionRecords(questions, retryPayloads.questions, 'append');
  }

  const ranges = [];
  const hasCoverage = indexedFromBlock != null && indexedToBlock != null;
  if (hasCoverage && indexedToBlock < scanWindow.toBlock) {
    ranges.push({
      fromBlock: indexedToBlock + 1,
      toBlock: scanWindow.toBlock,
      placement: 'prepend',
      label: 'delta',
    });
  }
  ranges.push(...unresolvedRanges.map(range => ({ ...range, placement: 'append', label: 'retry' })));
  if (!hasCoverage) {
    ranges.push({
      fromBlock: scanWindow.fromBlock,
      toBlock: scanWindow.toBlock,
      placement: 'append',
      label: 'initial',
    });
  } else if (complete !== true || indexedFromBlock > scanWindow.fromBlock) {
    const historicalTo = Math.min(
      normalizeBlock(nextScanToBlock) ?? indexedFromBlock - 1,
      scanWindow.toBlock
    );
    if (historicalTo >= scanWindow.fromBlock) {
      ranges.push({
        fromBlock: scanWindow.fromBlock,
        toBlock: historicalTo,
        placement: 'append',
        label: 'historical',
      });
    }
  }

  for (const range of ranges) {
    const firstAvailableMode = mode === 'until_first_available' && questions.length === 0;
    const rangeResult = await scanQuestionRange({
      rpcUrls,
      surveysAddress,
      session,
      sessionSlug: slug,
      pointerBackend,
      getCloudflareAuth,
      fromBlock: range.fromBlock,
      toBlock: range.toBlock,
      seenQuestionIds,
      stopAfterFirstAvailable: firstAvailableMode,
      foregroundPayloadLimit: firstAvailableMode ? foregroundPayloadLimit : 0,
      maxChunks: firstAvailableMode ? foregroundChunks(env) : Infinity,
      env,
      fetchImpl,
    });
    questions = mergeQuestionRecords(questions, rangeResult.questions, range.placement);
    skippedSessionMismatchCount += Number(rangeResult.skippedSessionMismatchCount || 0) || 0;
    aggregateScan = mergeScanSummaries(aggregateScan, rangeResult.scan);
    // The bounds describe attempted coverage; saved gaps prevent it from
    // becoming complete until every failed chunk has actually succeeded.
    unresolvedRanges = mergeQuestionRanges([
      ...removeScannedQuestionRange(unresolvedRanges, rangeResult.lowestScannedBlock, range.toBlock),
      ...rangeResult.unresolvedRanges,
    ]);
    if (rangeResult.lowestScannedBlock != null) {
      indexedToBlock = Math.max(indexedToBlock ?? range.toBlock, range.toBlock);
      indexedFromBlock = Math.min(indexedFromBlock ?? rangeResult.lowestScannedBlock, rangeResult.lowestScannedBlock);
    }
    nextScanToBlock = rangeResult.nextScanToBlock;
    if (nextScanToBlock != null) break;
  }

  const payloadFailureCount = questions.filter(isPayloadUnavailableQuestion).length;
  complete = indexedFromBlock != null && indexedFromBlock <= scanWindow.fromBlock &&
    indexedToBlock != null && indexedToBlock >= scanWindow.toBlock &&
    nextScanToBlock == null && unresolvedRanges.length === 0 && payloadFailureCount === 0;
  const hadReadFailures = unresolvedRanges.length > 0 || payloadFailureCount > 0;
  const ok = questions.length > 0 || !hadReadFailures;
  const reason = questions.length
    ? complete ? 'live_questions_indexed' : 'live_questions_index_partial'
    : !complete && !hadReadFailures ? 'live_questions_indexing'
      : unresolvedRanges.length > 0
        ? Number(aggregateScan.chunksSucceeded || 0) === 0 ? 'question_log_scan_failed' : 'question_log_scan_partial_failed'
        : payloadFailureCount > 0 ? 'question_payload_load_failed' : 'live_questions_empty';

  const result = {
    ok,
    reason,
    sessionSlug: slug,
    source: 'telegram_worker_question_index',
    cacheLayer: 'fresh',
    cachedAtMs: Date.now(),
    chainId: normalizeChainId(session.chainId),
    surveysAddress,
    questionStorageBackend: pointerBackend,
    scanWindow,
    indexedFromBlock,
    indexedToBlock,
    targetFromBlock: scanWindow.fromBlock,
    targetToBlock: scanWindow.toBlock,
    nextScanToBlock,
    unresolvedRanges,
    complete,
    scan: aggregateScan,
    discoveredCount: aggregateScan.ids?.length || 0,
    payloadFailureCount,
    skippedSessionMismatchCount,
    questionCount: questions.length,
    questions,
  };
  questionMemoryCache.set(key, result);
  await writeKvQuestionIndex(env, key, result);
  return result;
}

export async function listCachedSessionQuestions({
  env = {},
  sessionSlug = '',
  fetchImpl = env.QUESTION_FETCH || env.REGISTRY_FETCH || globalThis.fetch,
  waitUntil = null,
  forceRefresh = false,
  questionLimit = 0,
} = {}) {
  const slug = lower(sessionSlug);
  const ttlSeconds = cacheTtlSeconds(env);
  const key = sessionQuestionCacheKey(env, slug);
  const memory = scopedCachedIndexForReturn(questionMemoryCache.get(key), 'memory', slug);
  if (!forceRefresh && memory && isFreshQuestionIndex(memory, ttlSeconds) && !cacheNeedsImmediateScopeRefresh(memory)) {
    if (!hasPayloadUnavailableQuestions(memory)) {
      scheduleIndexRefresh({ waitUntil, env, sessionSlug: slug, existingIndex: memory, fetchImpl });
      return authorizeCachedIndex(env, memory);
    }
  }
  const kv = await readKvQuestionIndex(env, key);
  if (!forceRefresh && kv && isFreshQuestionIndex(kv, ttlSeconds)) {
    questionMemoryCache.set(key, kv);
    const cached = scopedCachedIndexForReturn(kv, 'kv', slug);
    if (!cacheNeedsImmediateScopeRefresh(cached) && !hasPayloadUnavailableQuestions(cached)) {
      scheduleIndexRefresh({ waitUntil, env, sessionSlug: slug, existingIndex: cached, fetchImpl });
      return authorizeCachedIndex(env, cached);
    }
  }
  const durableCached = scopedCachedIndexForReturn(kv || memory, kv ? 'kv' : 'memory', slug);
  const refreshBaseIndex = cacheNeedsImmediateScopeRefresh(durableCached) ? null : durableCached;
  if (!forceRefresh && refreshBaseIndex && typeof waitUntil === 'function' && !hasPayloadUnavailableQuestions(refreshBaseIndex)) {
    scheduleIndexRefresh({ waitUntil, env, sessionSlug: slug, existingIndex: refreshBaseIndex, refreshExpired: true, fetchImpl });
    return authorizeCachedIndex(env, refreshBaseIndex);
  }

  const firstResult = await refreshSessionQuestionIndex({
    env,
    sessionSlug: slug,
    existingIndex: refreshBaseIndex,
    mode: forceRefresh || typeof waitUntil !== 'function' ? 'complete' : 'until_first_available',
    foregroundPayloadLimit: questionLimit,
    fetchImpl,
  });
  if (
    typeof waitUntil === 'function' &&
    firstResult.ok &&
    firstResult.complete !== true &&
    firstResult.nextScanToBlock != null
  ) {
    scheduleIndexRefresh({ waitUntil, env, sessionSlug: slug, existingIndex: firstResult, fetchImpl });
  }
  return authorizeCachedIndex(env, firstResult);
}
