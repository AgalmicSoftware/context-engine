import { ethers } from 'ethers';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  SURVEYS_ABI,
  DEFAULT_CHAIN_ID,
  resolveRpcUrlsForChain,
  ARWEAVE_GATEWAY,
} from './constants.mjs';
import { debug, warn, error } from './log.mjs';
import { getSessionConfig, getSurveysAddress, getSessionMetadata } from './sessions.mjs';
import { getConfirmedSubmittedQuestionIds } from './submissionState.mjs';
// Shared pure utilities (symlinked from client/src/utilities/shared/)
import { hexToBase64url as _hexToBase64url } from './shared/questionUtils.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(process.env.CE_CC_DATA_DIR || resolve(__dirname, '..', '.data'));
const CACHE_DIR = resolve(DATA_DIR, 'question-cache');
const RESPONSES_DIR = resolve(DATA_DIR, 'responses');

const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const questionIdCache = new Map(); // slug → { ids: Set, ts }
const questionDataCache = new Map(); // questionId → questionPayload
// key includes slug + wallet + chain + surveys + question-id fingerprint -> { ids: Set<string>, ts: number }
const onChainAnsweredCache = new Map();
const pendingOnChainAnswered = new Map(); // cacheKey -> Promise<Set<string>>
const ON_CHAIN_ANSWERED_CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes
const MAX_ON_CHAIN_CACHE_SIZE = 100;
const ON_CHAIN_BATCH_SIZE = 5;

const providerCache = new Map(); // chainId → provider

function normalizePositiveBlockNumber(value) {
  const raw = Number(value);
  if (!Number.isFinite(raw) || raw <= 0) return null;
  return Math.floor(raw);
}

function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return h.toString(36);
}

function getProvider(chainId) {
  const cid = chainId || DEFAULT_CHAIN_ID;
  if (providerCache.has(cid)) return providerCache.get(cid);
  const rpcUrl = resolveRpcUrlsForChain(cid)[0];
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl, cid);
  providerCache.set(cid, provider);
  return provider;
}

// --- Arweave helpers ---
// hexToBase64url: shared implementation via symlink (client/src/utilities/shared/questionUtils.mjs)
// Strips trailing zero-padding before converting (Arweave txIds are shorter than 32 bytes)
function hexToBase64url(hex) {
  const cleaned = hex.startsWith('0x') ? hex.slice(2) : hex;
  let trimmed = cleaned.replace(/0+$/, '');
  if (trimmed.length % 2 !== 0) trimmed += '0';
  if (!trimmed) return null;
  return _hexToBase64url('0x' + trimmed);
}

async function downloadFromArweave(txId) {
  const url = `${ARWEAVE_GATEWAY}/${txId}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// --- Disk cache ---

function getCachePath(slug) {
  return resolve(CACHE_DIR, slug);
}

function loadCachedQuestion(slug, questionId) {
  const dir = getCachePath(slug);
  const file = resolve(dir, `${questionId.replace(/[^a-fA-F0-9x]/g, '_')}.json`);
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function saveCachedQuestion(slug, questionId, data) {
  const dir = getCachePath(slug);
  mkdirSync(dir, { recursive: true });
  const file = resolve(dir, `${questionId.replace(/[^a-fA-F0-9x]/g, '_')}.json`);
  writeFileSync(file, JSON.stringify(data, null, 2));
}

function loadAllCachedQuestionIds(slug) {
  const dir = getCachePath(slug);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      try {
        const data = JSON.parse(readFileSync(resolve(dir, f), 'utf8'));
        return data.id || null;
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

// --- On-chain question ID scanning ---
// Matches client/src/utilities/web3/contractScripts.js:fetchAllQuestionIDs

// Chunked log scanning — matches CE client's fetchLogsSmartWithProvider pattern
async function fetchLogsChunked(provider, filter, fromBlock, toBlock, chunkSize = 200_000) {
  const allLogs = [];
  for (let from = fromBlock; from <= toBlock; from += chunkSize) {
    const to = Math.min(from + chunkSize - 1, toBlock);
    try {
      const logs = await provider.getLogs({ ...filter, fromBlock: from, toBlock: to });
      if (logs.length > 0) allLogs.push(...logs);
    } catch (err) {
      // If chunk is too large, halve it and retry
      if (chunkSize > 10_000) {
        const half = Math.floor(chunkSize / 2);
        const retryLogs = await fetchLogsChunked(provider, filter, from, to, half);
        allLogs.push(...retryLogs);
      } else {
        error(`[questions] Log scan failed for blocks ${from}-${to}:`, err.message);
      }
    }
  }
  return allLogs;
}

// Fallback: scan last ~3 days if no startBlock in metadata
const FALLBACK_SCAN_BLOCKS = 130_000;

function getSessionQuestionBlockLimits(metadata) {
  return {
    start: normalizePositiveBlockNumber(metadata?.blockLimits?.start),
    end: normalizePositiveBlockNumber(metadata?.blockLimits?.end),
  };
}

function resolveQuestionScanToBlock(currentBlock, sessionEndBlock) {
  const latestBlock = Number.isFinite(currentBlock) && currentBlock > 0
    ? Math.floor(currentBlock)
    : 0;
  const endBlock = normalizePositiveBlockNumber(sessionEndBlock);
  return endBlock != null ? Math.min(latestBlock, endBlock) : latestBlock;
}

async function scanQuestionIds(surveysAddress, chainId, sessionStartBlock, sessionEndBlock) {
  const provider = getProvider(chainId);
  const contract = new ethers.Contract(surveysAddress, SURVEYS_ABI, provider);
  const filter = contract.filters.QuestionsAdded(null, null, null);

  const currentBlock = await provider.getBlockNumber();
  const startBlock = (normalizePositiveBlockNumber(sessionStartBlock) != null)
    ? normalizePositiveBlockNumber(sessionStartBlock)
    : Math.max(0, currentBlock - FALLBACK_SCAN_BLOCKS);
  const toBlock = resolveQuestionScanToBlock(currentBlock, sessionEndBlock);
  const scanSource = normalizePositiveBlockNumber(sessionStartBlock) != null ? 'from metadata' : 'fallback';
  const endSource = normalizePositiveBlockNumber(sessionEndBlock) != null ? ', end bounded' : '';
  debug(`[questions] Scanning QuestionsAdded on ${surveysAddress} (chain ${chainId || DEFAULT_CHAIN_ID}), blocks ${startBlock}..${toBlock} (${scanSource}${endSource})`);

  if (toBlock < startBlock) {
    warn(`[questions] Skipping QuestionsAdded scan on ${surveysAddress}; resolved block window is empty (${startBlock}..${toBlock})`);
    return new Set();
  }

  const rawFilter = { address: surveysAddress, topics: filter.topics };
  const rawLogs = await fetchLogsChunked(provider, rawFilter, startBlock, toBlock);

  const ids = new Set();
  for (const rawLog of rawLogs) {
    try {
      const parsed = contract.interface.parseLog(rawLog);
      const questionIds = parsed.args?.questionIds;
      if (questionIds) {
        for (const id of questionIds) {
          if (id && id !== ethers.constants.HashZero) {
            ids.add(id.toLowerCase());
          }
        }
      }
    } catch {
      // skip unparseable
    }
  }
  debug(`[questions] Found ${ids.size} unique question IDs from ${rawLogs.length} log entries`);
  return ids;
}

// --- Question data fetching ---
// Matches client/src/utilities/web3/contractScripts.js:getQuestionHash + getQuestionData

async function fetchQuestionData(questionId, surveysAddress, chainId) {
  // Check memory cache
  if (questionDataCache.has(questionId)) {
    return questionDataCache.get(questionId);
  }

  const provider = getProvider(chainId);
  const contract = new ethers.Contract(surveysAddress, SURVEYS_ABI, provider);

  const hashBytes = await contract.getQuestionHash(questionId);
  if (!hashBytes || hashBytes === ethers.constants.HashZero) return null;

  const txId = hexToBase64url(hashBytes);
  if (!txId) return null;

  const data = await downloadFromArweave(txId);
  if (!data) return null;

  data.id = data.id || questionId; // Ensure contract question ID is preserved
  data.arweaveTxId = txId;
  questionDataCache.set(questionId, data);
  return data;
}

// --- Public API ---

export async function fetchQuestionIds(slug, deps = {}) {
  const getSessionConfigImpl = typeof deps.getSessionConfig === 'function'
    ? deps.getSessionConfig
    : getSessionConfig;
  const getSessionMetadataImpl = typeof deps.getSessionMetadata === 'function'
    ? deps.getSessionMetadata
    : getSessionMetadata;
  const scanQuestionIdsImpl = typeof deps.scanQuestionIds === 'function'
    ? deps.scanQuestionIds
    : scanQuestionIds;

  // Check cache freshness
  const cached = questionIdCache.get(slug);
  if (cached && Date.now() - cached.ts < REFRESH_INTERVAL_MS) {
    return cached.ids;
  }

  const config = await getSessionConfigImpl(slug);
  const surveysAddress = getSurveysAddress(config);
  const chainId = config?.chainId || DEFAULT_CHAIN_ID;
  if (!surveysAddress) {
    error(`[questions] No surveys address found for session "${slug}"`);
    const diskIds = loadAllCachedQuestionIds(slug);
    return new Set(diskIds);
  }

  // Get session block window from metadata (blockLimits.start/end)
  let sessionStartBlock = null;
  let sessionEndBlock = null;
  try {
    const metadata = await getSessionMetadataImpl(slug);
    const blockLimits = getSessionQuestionBlockLimits(metadata);
    sessionStartBlock = blockLimits.start;
    sessionEndBlock = blockLimits.end;
  } catch { /* use fallback */ }

  debug(`[questions] Fetching question IDs for session "${slug}" (surveys=${surveysAddress}, chain=${chainId}, startBlock=${sessionStartBlock || 'fallback'}, endBlock=${sessionEndBlock || 'latest'})`);

  try {
    const ids = await scanQuestionIdsImpl(surveysAddress, chainId, sessionStartBlock, sessionEndBlock);
    questionIdCache.set(slug, { ids, ts: Date.now() });
    return ids;
  } catch (err) {
    error(`[questions] Failed to scan question IDs for ${slug}:`, err.message);
    const diskIds = loadAllCachedQuestionIds(slug);
    return new Set(diskIds);
  }
}

export async function getQuestionData(questionId, slug) {
  // Check disk cache first
  const cached = loadCachedQuestion(slug, questionId);
  if (cached) {
    questionDataCache.set(questionId, cached);
    return cached;
  }

  const config = await getSessionConfig(slug);
  const surveysAddress = getSurveysAddress(config);
  const chainId = config?.chainId || DEFAULT_CHAIN_ID;
  if (!surveysAddress) return null;

  try {
    const data = await fetchQuestionData(questionId, surveysAddress, chainId);
    if (data) {
      saveCachedQuestion(slug, questionId, data);
    }
    return data;
  } catch (err) {
    error(`[questions] Failed to fetch question ${questionId}:`, err.message);
    return null;
  }
}

function isUsableQuestion(q) {
  // Skip encrypted questions where prompt wasn't decrypted
  if (!q) return false;
  if (!q.prompt && q.promptEncrypted) return false;
  if (!q.prompt) return false;
  return true;
}

export function getAnsweredQuestionIds(slug, opts = {}) {
  const walletAddress = String(opts.walletAddress || opts.respondent || '').trim().toLowerCase();
  const dir = resolve(RESPONSES_DIR, slug);
  const answered = new Set();
  if (existsSync(dir)) {
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.json')) continue;
      try {
        const data = JSON.parse(readFileSync(resolve(dir, f), 'utf8'));
        if (walletAddress) {
          const respondent = String(data.respondent || '').trim().toLowerCase();
          if (!respondent || respondent !== walletAddress) continue;
        }
        if (data.questionId) answered.add(data.questionId.toLowerCase());
      } catch { /* skip unreadable */ }
    }
  }
  getConfirmedSubmittedQuestionIds(slug, { walletAddress }).forEach((questionId) => answered.add(questionId));
  return answered;
}

async function getOnChainAnsweredQuestionIds(slug, questionIds, walletAddress) {
  const wallet = String(walletAddress || '').trim().toLowerCase();
  const ids = Array.isArray(questionIds)
    ? questionIds.map((id) => String(id || '').trim()).filter(Boolean)
    : [];
  const validIds = ids.filter((qid) => ethers.utils.isHexString(qid, 32));
  if (!wallet || validIds.length === 0) return new Set();

  const sessionConfig = await getSessionConfig(slug);
  const surveysAddress = getSurveysAddress(sessionConfig);
  if (!surveysAddress) return new Set();

  const chainId = sessionConfig?.chainId || DEFAULT_CHAIN_ID;
  const normalizedSurveysAddress = String(surveysAddress).toLowerCase();
  const idsFingerprint = simpleHash(validIds.slice().sort().join(','));
  const cacheKey = `${slug}:${wallet}:${chainId}:${normalizedSurveysAddress}:${validIds.length}:${idsFingerprint}`;

  const cached = onChainAnsweredCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < ON_CHAIN_ANSWERED_CACHE_TTL_MS) {
    return cached.ids;
  }

  const pending = pendingOnChainAnswered.get(cacheKey);
  if (pending) {
    return pending;
  }

  const fetchPromise = (async () => {
    const provider = getProvider(chainId);
    const contract = new ethers.Contract(surveysAddress, SURVEYS_ABI, provider);

    const answered = new Set();
    const zeroHash = ethers.constants.HashZero.toLowerCase();
    let hadError = false;

    for (let i = 0; i < validIds.length; i += ON_CHAIN_BATCH_SIZE) {
      const batch = validIds.slice(i, i + ON_CHAIN_BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(async (qid) => {
          const result = await contract.getResponse(wallet, qid);
          if (result && String(result).toLowerCase() !== zeroHash) {
            answered.add(qid.toLowerCase());
          }
        })
      );
      for (const r of results) {
        if (r.status === 'rejected') hadError = true;
      }
    }

    if (hadError) {
      return new Set();
    }

    if (onChainAnsweredCache.size >= MAX_ON_CHAIN_CACHE_SIZE) {
      const entries = [...onChainAnsweredCache.entries()]
        .sort(([, a], [, b]) => a.ts - b.ts);
      const toRemove = entries.slice(0, Math.floor(MAX_ON_CHAIN_CACHE_SIZE / 2));
      for (const [key] of toRemove) onChainAnsweredCache.delete(key);
    }
    onChainAnsweredCache.set(cacheKey, { ids: answered, ts: Date.now() });
    return answered;
  })();

  pendingOnChainAnswered.set(cacheKey, fetchPromise);
  try {
    return await fetchPromise;
  } finally {
    pendingOnChainAnswered.delete(cacheKey);
  }
}

export async function getMergedAnsweredQuestionIds(slug, questionIds, walletAddress) {
  const local = getAnsweredQuestionIds(slug, { walletAddress });
  const remainingIds = Array.isArray(questionIds)
    ? questionIds.filter((questionId) => !local.has(String(questionId || '').trim().toLowerCase()))
    : [];
  if (remainingIds.length === 0) return local;
  let onChain = new Set();
  try {
    onChain = await getOnChainAnsweredQuestionIds(slug, remainingIds, walletAddress);
  } catch {
    // Best-effort: local answers still prevent duplicates in most flows.
  }
  return new Set([...local, ...onChain]);
}

// Track recently-served questions to prevent duplicates across concurrent CC sessions.
// Key: questionId (lowercase), Value: timestamp. Entries expire after SERVED_TTL_MS.
// When a question is answered (response submitted), call clearServed() to free the slot.
const recentlyServed = new Map();
const SERVED_TTL_MS = 10 * 60_000; // 10 minutes
const servedLocks = new Map();
const SERVED_LOCK_MS = 30_000; // prevents same-question races across concurrent hook requests

function pruneServedLocks(now = Date.now()) {
  for (const [k, until] of servedLocks) {
    if (until <= now) servedLocks.delete(k);
  }
}

function markServed(questionId, { allowRecent = false } = {}) {
  const key = questionId.toLowerCase();
  const now = Date.now();
  pruneServedLocks(now);

  const lockUntil = servedLocks.get(key);
  if (typeof lockUntil === 'number' && lockUntil > now) {
    return false;
  }

  const ts = recentlyServed.get(key);
  const isRecent = typeof ts === 'number' && now - ts <= SERVED_TTL_MS;
  if (!allowRecent && isRecent) {
    return false;
  }

  recentlyServed.set(key, now);
  servedLocks.set(key, now + SERVED_LOCK_MS);

  // Prune expired entries periodically
  if (recentlyServed.size > 200) {
    for (const [k, servedTs] of recentlyServed) {
      if (now - servedTs > SERVED_TTL_MS) recentlyServed.delete(k);
    }
  }
  return true;
}

export function clearServed(questionId) {
  if (!questionId) return;
  const key = questionId.toLowerCase();
  recentlyServed.delete(key);
  servedLocks.delete(key);
}

function isRecentlyServed(questionId) {
  const ts = recentlyServed.get(questionId.toLowerCase());
  if (!ts) return false;
  if (Date.now() - ts > SERVED_TTL_MS) {
    recentlyServed.delete(questionId.toLowerCase());
    return false;
  }
  return true;
}

function buildStages(ids, answeredSet, allowReanswer, isRecentlyServedFn = isRecentlyServed) {
  const allIds = Array.isArray(ids) ? [...ids] : [...(ids || [])];
  const unansweredIds = allIds.filter((id) => !answeredSet.has(id));
  const answeredIds = allIds.filter((id) => answeredSet.has(id));
  const stages = [
    {
      // Stage 1: unanswered + not recently served.
      pool: unansweredIds.filter((id) => !isRecentlyServedFn(id)),
      allowRecent: false,
    },
    {
      // Stage 2: unanswered + allow recently served.
      pool: unansweredIds,
      allowRecent: true,
    },
  ];

  if (!allowReanswer) return stages;

  stages.push(
    {
      // Stage 3 (allowReanswer only): answered + not recently served.
      pool: answeredIds.filter((id) => !isRecentlyServedFn(id)),
      allowRecent: false,
    },
    {
      // Stage 4 (allowReanswer only): all + not recently served.
      pool: allIds.filter((id) => !isRecentlyServedFn(id)),
      allowRecent: false,
    },
    {
      // Stage 5 (allowReanswer only): all questions.
      pool: allIds,
      allowRecent: true,
    },
  );

  return stages;
}

export async function getRandomUnseen(slug, opts = {}) {
  const walletAddr = String(opts.walletAddress || opts.respondent || '').trim().toLowerCase();
  const allowReanswer = opts.allowReanswer === true;
  const peek = opts.peek === true;
  const ids = await fetchQuestionIds(slug);
  if (!ids || ids.size === 0) {
    return { question: null, answeredCount: 0, totalCount: 0 };
  }

  const answeredSet = await getMergedAnsweredQuestionIds(slug, [...ids], walletAddr);
  const allIds = [...ids];
  const totalCount = ids.size;
  const answeredCount = answeredSet.size;
  const stages = buildStages(allIds, answeredSet, allowReanswer, isRecentlyServed);

  for (const stage of stages) {
    if (!stage.pool.length) continue;
    // Shuffle and try to find a usable question. Keep cap to avoid long tail latency.
    const shuffled = stage.pool.sort(() => Math.random() - 0.5);
    for (const qId of shuffled.slice(0, 10)) {
      if (!markServed(qId, { allowRecent: stage.allowRecent })) continue;
      const data = await getQuestionData(qId, slug);
      if (isUsableQuestion(data)) {
        if (peek) clearServed(qId);
        return { question: data, answeredCount, totalCount };
      }
      clearServed(qId);
    }
  }

  return { question: null, answeredCount, totalCount };
}

// --- Pre-warming ---
// Call after listing sessions to pre-fetch question IDs + data in background

const warmingInProgress = new Set();

export function warmQuestionCache(slug) {
  if (warmingInProgress.has(slug)) return;
  warmingInProgress.add(slug);
  debug(`[questions] Warming question cache for session "${slug}"...`);

  (async () => {
    try {
      const ids = await fetchQuestionIds(slug);
      if (!ids || ids.size === 0) return;

      // Pre-fetch up to 10 question data payloads
      const config = await getSessionConfig(slug);
      const surveysAddress = getSurveysAddress(config);
      const chainId = config?.chainId || DEFAULT_CHAIN_ID;
      if (!surveysAddress) return;

      let fetched = 0;
      for (const qId of ids) {
        if (fetched >= 10) break;
        // Skip if already in memory or disk cache
        if (questionDataCache.has(qId)) { fetched++; continue; }
        if (loadCachedQuestion(slug, qId)) { fetched++; continue; }
        try {
          const data = await fetchQuestionData(qId, surveysAddress, chainId);
          if (data) {
            saveCachedQuestion(slug, qId, data);
            fetched++;
          }
        } catch { /* continue with next */ }
      }
      debug(`[questions] Warmed ${fetched} questions for session "${slug}"`);
    } catch (err) {
      error(`[questions] Warming failed for "${slug}":`, err.message);
    } finally {
      warmingInProgress.delete(slug);
    }
  })();
}

export function formatQuestionForTerminal(question, slug, serverUrl) {
  if (!question) return null;

  const width = 56;
  const innerWidth = width - 4; // 2 padding each side
  const hr = '\u2500'.repeat(width);

  function wrapText(text, maxWidth) {
    const words = text.split(/\s+/);
    const lines = [];
    let line = '';
    for (const word of words) {
      if (line.length + word.length + 1 > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = line ? `${line} ${word}` : word;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  function pad(text) {
    return `\u2502  ${text.padEnd(innerWidth)}  \u2502`;
  }

  const lines = [];
  lines.push(`\u250c${hr}\u2510`);

  // Header
  const header = `Survey Question  \u00b7  ${slug || 'session'}`;
  lines.push(pad(header.slice(0, innerWidth)));
  lines.push(`\u251c${hr}\u2524`);

  // Question text
  const promptLines = wrapText(question.prompt || '(no prompt)', innerWidth);
  for (const pl of promptLines) {
    lines.push(pad(pl));
  }

  // Type + options footer
  lines.push(`\u251c${hr}\u2524`);
  let meta = `Type: ${question.type || 'unknown'}`;
  if (question.options && question.options.length > 0) {
    const opts = question.options.join(', ');
    if (meta.length + opts.length + 14 <= innerWidth) {
      meta += `  \u00b7  Options: ${opts}`;
    } else {
      lines.push(pad(meta));
      meta = `Options: ${opts}`;
    }
  }
  lines.push(pad(meta.slice(0, innerWidth)));
  lines.push(`\u2514${hr}\u2518`);

  if (serverUrl) {
    lines.push(`   \ud83d\udcad ${serverUrl}`);
  }

  return lines.join('\n');
}

async function registerQuestionScanWindowTests() {
  const testModule = await import('node:test');
  const assertModule = await import('node:assert/strict');
  const test = testModule.default || testModule.test;
  const assert = assertModule.default || assertModule;

  test('fetchQuestionIds forwards start/end block limits to scanQuestionIds', async () => {
    questionIdCache.clear();
    const slug = '__questions-bounded-window-forwarding__';
    const ids = new Set(['0x' + '11'.repeat(32)]);
    const sessionConfig = {
      chainId: DEFAULT_CHAIN_ID,
      contracts: {
        surveys: {
          address: '0x1111111111111111111111111111111111111111',
        },
      },
    };
    let scanArgs = null;

    const result = await fetchQuestionIds(slug, {
      getSessionConfig: async () => sessionConfig,
      getSessionMetadata: async () => ({ blockLimits: { start: 101.8, end: 205.9 } }),
      scanQuestionIds: async (...args) => {
        scanArgs = args;
        return ids;
      },
    });

    assert.equal(result, ids);
    assert.deepEqual(scanArgs, [
      sessionConfig.contracts.surveys.address,
      sessionConfig.chainId,
      101,
      205,
    ]);
  });

  test('resolveQuestionScanToBlock clamps future ends and preserves latest-block fallback', () => {
    assert.equal(resolveQuestionScanToBlock(500, 450), 450);
    assert.equal(resolveQuestionScanToBlock(500, 999), 500);
    assert.equal(resolveQuestionScanToBlock(500, null), 500);
    assert.equal(resolveQuestionScanToBlock(500, undefined), 500);
    assert.equal(resolveQuestionScanToBlock(500, 0), 500);
    assert.equal(resolveQuestionScanToBlock(500, 'not-a-number'), 500);
  });
}

if (
  process.env.NODE_TEST_CONTEXT
  && /(^|[\\/])lib[\\/]questions\.recently-served\.test\.mjs$/.test(process.argv[1] || '')
) {
  await registerQuestionScanWindowTests();
}

export const __test__questions = {
  buildStages,
  markServed,
  clearServed,
  isRecentlyServed,
  getSessionQuestionBlockLimits,
  normalizePositiveBlockNumber,
  resolveQuestionScanToBlock,
};
