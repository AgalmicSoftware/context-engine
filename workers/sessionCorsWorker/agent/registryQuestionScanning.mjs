import { DEFAULT_LOG_CHUNK_SIZE, STORAGE_BACKENDS, QUESTIONS_ADDED_TOPIC0, rpcTimeoutMs, questionPayloadTimeoutMs, normalizeBytes32, decodeBytes32ArrayFromData } from './registryQuestionCore.mjs';
import { rpcWithFallback } from './registryQuestionSource.mjs';
import { isSkippedQuestionPayload, fetchQuestionPayload } from './registryQuestionPayloads.mjs';
import { payloadConcurrency, foregroundPayloadBatchSize } from './registryQuestionCache.mjs';

export async function fetchQuestionPayloads({
  rpcUrls = [],
  surveysAddress = '',
  questionIds = [],
  session = {},
  sessionSlug = '',
  pointerBackend = STORAGE_BACKENDS.ARWEAVE,
  getCloudflareAuth = null,
  seenQuestionIds = new Set(),
  env = {},
  fetchImpl = globalThis.fetch,
} = {}) {
  const ids = questionIds
    .map((id) => normalizeBytes32(id))
    .filter((id) => id && !seenQuestionIds.has(id));
  const results = new Array(ids.length);
  let cursor = 0;
  let payloadFailureCount = 0;
  let skippedSessionMismatchCount = 0;
  const workers = Array.from({
    length: Math.min(ids.length, payloadConcurrency(env)),
  }, async () => {
    while (cursor < ids.length) {
      const index = cursor;
      cursor += 1;
      const id = ids[index];
      seenQuestionIds.add(id);
      const question = await fetchQuestionPayload({
        rpcUrls,
        surveysAddress,
        questionId: id,
        session,
        sessionSlug,
        pointerBackend,
        getCloudflareAuth,
        env,
        fetchImpl,
        timeoutMs: questionPayloadTimeoutMs(env),
      }).catch(() => null);
      if (isSkippedQuestionPayload(question)) {
        skippedSessionMismatchCount += 1;
      } else if (question) {
        results[index] = question;
      } else {
        payloadFailureCount += 1;
      }
    }
  });
  await Promise.all(workers);
  return {
    attemptedCount: ids.length,
    payloadFailureCount,
    skippedSessionMismatchCount,
    questions: results.filter(Boolean),
  };
}

export async function scanQuestionRange({
  rpcUrls = [],
  surveysAddress = '',
  session = {},
  sessionSlug = '',
  pointerBackend = STORAGE_BACKENDS.ARWEAVE,
  getCloudflareAuth = null,
  fromBlock = 0,
  toBlock = 0,
  seenQuestionIds = new Set(),
  stopAfterFirstAvailable = false,
  foregroundPayloadLimit = 0,
  maxChunks = Infinity,
  env = {},
  fetchImpl = globalThis.fetch,
} = {}) {
  const summary = {
    ids: [],
    chunksAttempted: 0,
    chunksSucceeded: 0,
    chunksFailed: 0,
    errors: [],
    order: 'newest_first',
  };
  const questions = [];
  let payloadFailureCount = 0;
  let skippedSessionMismatchCount = 0;
  let lowestScannedBlock = null;
  let nextScanToBlock = null;
  if (!surveysAddress || toBlock < fromBlock) {
    return {
      completed: true,
      scan: summary,
      questions,
      payloadFailureCount,
      skippedSessionMismatchCount,
      lowestScannedBlock,
      nextScanToBlock,
    };
  }
  const chunkSize = DEFAULT_LOG_CHUNK_SIZE;
  const maxChunkCount = Number.isFinite(Number(maxChunks)) && Number(maxChunks) > 0
    ? Math.floor(Number(maxChunks))
    : Infinity;
  for (let to = toBlock; to >= fromBlock && summary.chunksAttempted < maxChunkCount;) {
    const from = Math.max(fromBlock, to - chunkSize + 1);
    summary.chunksAttempted += 1;
    const result = await rpcWithFallback({
      rpcUrls,
      method: 'eth_getLogs',
      params: [{
        address: surveysAddress,
        fromBlock: `0x${from.toString(16)}`,
        toBlock: `0x${to.toString(16)}`,
        topics: [QUESTIONS_ADDED_TOPIC0],
      }],
      fetchImpl,
      timeoutMs: rpcTimeoutMs(env),
    });
    if (!result.ok) {
      summary.chunksFailed += 1;
      if (summary.errors.length < 3) summary.errors.push(result.error || 'eth_getLogs failed');
      to = from - 1;
      continue;
    }
    summary.chunksSucceeded += 1;
    lowestScannedBlock = from;
    const chunkIds = [];
    const logs = Array.isArray(result.result) ? result.result : [];
    for (const log of logs.slice().reverse()) {
      for (const questionId of decodeBytes32ArrayFromData(log?.data || '', 0).reverse()) {
        if (chunkIds.includes(questionId)) continue;
        chunkIds.push(questionId);
        summary.ids.push(questionId);
      }
    }
    const firstAvailableBatchSize = stopAfterFirstAvailable
      ? foregroundPayloadBatchSize(env, foregroundPayloadLimit)
      : 0;
    const payloadBatches =
      firstAvailableBatchSize > 0
        ? Array.from({ length: Math.ceil(chunkIds.length / firstAvailableBatchSize) }, (_, index) =>
            chunkIds.slice(index * firstAvailableBatchSize, (index + 1) * firstAvailableBatchSize),
          )
      : [chunkIds];
    let stoppedWithinChunk = false;
    for (let batchIndex = 0; batchIndex < payloadBatches.length; batchIndex += 1) {
      const batchQuestionIds = payloadBatches[batchIndex];
      const payloads = await fetchQuestionPayloads({
        rpcUrls,
        surveysAddress,
        questionIds: batchQuestionIds,
        session,
        sessionSlug,
        pointerBackend,
        getCloudflareAuth,
        seenQuestionIds,
        env,
        fetchImpl,
      });
      payloadFailureCount += payloads.payloadFailureCount;
      skippedSessionMismatchCount += payloads.skippedSessionMismatchCount;
      questions.push(...payloads.questions);
      if (stopAfterFirstAvailable && questions.length > 0) {
        stoppedWithinChunk = batchIndex < payloadBatches.length - 1;
        nextScanToBlock = stoppedWithinChunk ? to : from - 1 >= fromBlock ? from - 1 : null;
        break;
      }
    }
    if (stopAfterFirstAvailable && questions.length > 0) {
      if (stoppedWithinChunk) {
        lowestScannedBlock = null;
      }
      break;
    }
    to = from - 1;
    if (to >= fromBlock && summary.chunksAttempted >= maxChunkCount) {
      nextScanToBlock = to;
      break;
    }
  }
  return {
    completed: nextScanToBlock == null && summary.chunksFailed === 0,
    scan: summary,
    questions,
    payloadFailureCount,
    skippedSessionMismatchCount,
    lowestScannedBlock,
    nextScanToBlock,
  };
}

export function mergeScanSummaries(left = {}, right = {}) {
  return {
    ids: [
      ...(Array.isArray(left.ids) ? left.ids : []),
      ...(Array.isArray(right.ids) ? right.ids : []),
    ],
    chunksAttempted: Number(left.chunksAttempted || 0) + Number(right.chunksAttempted || 0),
    chunksSucceeded: Number(left.chunksSucceeded || 0) + Number(right.chunksSucceeded || 0),
    chunksFailed: Number(left.chunksFailed || 0) + Number(right.chunksFailed || 0),
    errors: [
      ...(Array.isArray(left.errors) ? left.errors : []),
      ...(Array.isArray(right.errors) ? right.errors : []),
    ].slice(0, 3),
    order: 'newest_first',
  };
}
