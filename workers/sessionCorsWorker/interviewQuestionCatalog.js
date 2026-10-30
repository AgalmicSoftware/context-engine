const QUESTIONS_ADDED_TOPIC0 = '0x3b584fb360a325f39352e75bd13458807d8e31735ef4dadaeff99fc3e59b517a';
const GET_QUESTION_HASH_SELECTOR = '0x24b9f713';
const ZERO_BYTES32 = `0x${'00'.repeat(32)}`;
const MAX_QUESTIONS = 100;
// Payload reads across legacy rows and chosen versions, with room for rows
// that turn out unreadable or restricted.
const MAX_PAYLOAD_READS = MAX_QUESTIONS * 2;
// One Worker invocation may make 1,000 KV operations, some spent before the
// catalog runs. A listed page costs about MAX_QUESTIONS + 2 (index list,
// hidden-id list, one metadata read per row) and a payload read about one, so
// the walk stops early enough to leave room for its reads.
const CATALOG_KV_OPERATION_BUDGET = 800;
const MAX_CLOUDFLARE_LIST_PAGES = Math.floor((CATALOG_KV_OPERATION_BUDGET - MAX_PAYLOAD_READS) / (MAX_QUESTIONS + 2));
const MAX_SCAN_BLOCKS = 2_000_000;
const RPC_CHUNK_SIZE = 100_000;
const MAX_LOG_CHUNKS = MAX_SCAN_BLOCKS / RPC_CHUNK_SIZE;
const MAX_POINTER_READS = 200;
const MAX_CANDIDATES = 2000;
const catalog = (questions = [], incomplete = false) => ({ questions, incomplete });
const retryableReadStatus = status => !status || status === 408 || status === 429 || status >= 500;
import { normalizePublicInterviewQuestions, hasRestrictedPrompt, hasRatingScaleMetadata, normalizeRatingScale, normalizeQuestion } from '../../shared/interviewQuestionCatalog.mjs';
import { selectCanonicalStorageVersions } from './storageResourceOwnership.js';
const trim = (value) => String(value == null ? '' : value).trim();
const lower = (value) => trim(value).toLowerCase();
const isObj = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const dedupeQuestions = (questions) => normalizePublicInterviewQuestions(questions, MAX_QUESTIONS);
// The id normalizeQuestion will serve the payload under.
const payloadQuestionId = (payload) => lower(payload?.id || payload?.questionId);

const readJsonResponse = async (response) => {
  if (!response || Number(response.status || 0) < 200 || Number(response.status || 0) >= 300) return null;
  try {
    return await response.clone().json();
  } catch {
    try {
      return JSON.parse(await response.text());
    } catch {
      return null;
    }
  }
};

// A walk that cannot finish (the page cap above, a failed page) may miss a later
// admin correction. Without a current-version index it still chooses among
// every row it listed, which covers more rows than the former 200-row window.
const listQuestionRows = async (callStorage) => {
  const items = [];
  const seenCursors = new Set();
  let cursor = '';
  let complete = false;
  for (let page = 0; page < MAX_CLOUDFLARE_LIST_PAGES; page += 1) {
    const query = new URLSearchParams({ resource: 'questions', limit: String(MAX_QUESTIONS), ...(cursor ? { cursor } : {}) });
    let listing;
    try { listing = await readJsonResponse(await callStorage('/storage/list', query.toString())); } catch { break; }
    if (!Array.isArray(listing?.items)) break;
    items.push(...listing.items);
    if (listing.listComplete === true) { complete = true; break; }
    // A filtered page can be empty; only a fresh cursor continues the walk.
    cursor = trim(listing.cursor);
    if (!cursor || seenCursors.has(cursor)) break;
    seenCursors.add(cursor);
  }
  return { items, incomplete: !complete };
};

const loadCloudflareQuestions = async ({ env, config, slug, storageRoute }) => {
  if (typeof storageRoute !== 'function') return catalog();
  const origin = 'https://session-worker.invalid';
  const callStorage = (path, query) => storageRoute({
    path,
    method: 'GET',
    request: new Request(`${origin}${path}?${query}`),
    env,
    config,
    slug,
    uploaderAddress: '',
    baseHeaders: {},
  });
  const listing = await listQuestionRows(callStorage);
  const { items } = listing;
  let incomplete = listing.incomplete;
  // Hidden ids arrive as markers without a storage reference.
  const hiddenIds = new Set(items
    .filter((item) => item?.hidden === true || item?.metadata?.hidden === true)
    .map((item) => lower(item?.metadata?.resourceId))
    .filter(Boolean));
  // Deliberately sequential and bounded. Each read reuses the storage route's
  // per-item access checks, so this endpoint cannot widen question visibility.
  const readPayload = async (storageRefId) => {
    try {
      const response = await callStorage('/storage/read', `id=${encodeURIComponent(storageRefId)}`);
      if (retryableReadStatus(response?.status)) incomplete = true;
      const payload = await readJsonResponse(response);
      return isObj(payload) ? payload : null;
    } catch { incomplete = true; return null; }
  };
  const versions = [];
  const legacyVersions = [];
  for (const item of items) {
    const storageRefId = trim(item?.storageRef?.id || item?.metadata?.id || item?.id);
    if (!storageRefId || item?.hidden === true) continue;
    const version = {
      resourceId: lower(item?.metadata?.resourceId),
      createdAtMs: Date.parse(trim(item?.metadata?.createdAt)) || 0,
      storageRefId,
      uploader: trim(item?.metadata?.uploader),
      uploadAuthority: item?.metadata?.uploadAuthority,
    };
    (version.resourceId ? versions : legacyVersions).push(version);
  }
  // Rows stored before resourceId was recorded name their question only in the
  // payload. They predate admin stamps, so the earliest wins: read oldest first.
  legacyVersions.sort((left, right) => left.createdAtMs - right.createdAtMs);
  // Legacy reads leave at least MAX_QUESTIONS reads for the chosen versions.
  const legacyReads = legacyVersions.slice(0, MAX_PAYLOAD_READS - MAX_QUESTIONS);
  for (const version of legacyReads) {
    const payload = await readPayload(version.storageRefId);
    const resourceId = payloadQuestionId(payload);
    if (resourceId) versions.push({ ...version, resourceId, payload });
  }
  // Only an upload-time admin stamp can replace the earliest ordinary version.
  const candidates = selectCanonicalStorageVersions(versions)
    .filter((version) => !hiddenIds.has(version.resourceId));
  const chosen = candidates.slice(0, MAX_PAYLOAD_READS - legacyReads.length);
  const questions = [];
  for (const version of chosen) {
    if (questions.length >= MAX_QUESTIONS) break;
    const payload = version.payload || await readPayload(version.storageRefId);
    // A payload naming another question must not stand in for this one, and
    // falling back to another version could serve someone else's copy.
    if (payloadQuestionId(payload) === version.resourceId && normalizeQuestion(payload)) questions.push(payload);
  }
  return catalog(dedupeQuestions(questions), incomplete || legacyVersions.length > legacyReads.length || candidates.length > chosen.length);
};

const pickContractAddress = (config = {}) => {
  const contracts = isObj(config.contracts) ? config.contracts : {};
  const surveys = isObj(contracts.surveys) ? contracts.surveys.address : contracts.surveys;
  return trim(surveys || contracts.survey || config.surveysAddress || config.surveyAddress);
};

const pickRpcUrls = (config = {}) => {
  const chainId = trim(config.networkChainId || config.registryChainId || config.chainId || '11155420');
  const rpcConfig = isObj(config.rpc) ? config.rpc : {};
  const pathProvider = isObj(rpcConfig?.providers?.path)
    ? rpcConfig.providers.path
    : isObj(rpcConfig.path)
      ? rpcConfig.path
      : {};
  const byChainMap = isObj(config.rpcUrlsByChainId)
    ? config.rpcUrlsByChainId
    : isObj(pathProvider.rpcUrlsByChainId)
      ? pathProvider.rpcUrlsByChainId
      : {};
  const byChain = byChainMap[chainId];
  const source = [
    ...(Array.isArray(byChain) ? byChain : [byChain]),
    ...(Array.isArray(config.rpcUrls) ? config.rpcUrls : [config.rpcUrl]),
    ...(Array.isArray(pathProvider.rpcUrls) ? pathProvider.rpcUrls : [pathProvider.rpcUrl]),
  ];
  return [...new Set(source.map(trim).filter((value) => /^https:\/\//i.test(value)))];
};

const rpc = async ({ rpcUrls, method, params, fetchImpl }) => {
  let lastError;
  for (const rpcUrl of rpcUrls) {
    try {
      const response = await fetchImpl(rpcUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      });
      const data = await response.json();
      if (!response.ok || data?.error) throw new Error(data?.error?.message || `RPC ${method} failed.`);
      return data.result;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error(`No RPC URL succeeded for ${method}.`);
};

const wordAt = (hex, index) => trim(hex).replace(/^0x/, '').slice(index * 64, index * 64 + 64);

const decodeQuestionIds = (data = '') => {
  const clean = trim(data).replace(/^0x/, '');
  if (clean.length < 128) return [];
  const offsetBytes = Number(BigInt(`0x${wordAt(clean, 0) || '0'}`));
  const lengthWordIndex = offsetBytes / 32;
  const length = Math.min(MAX_CANDIDATES + 1, Math.max(0, Math.floor(clean.length / 64) - lengthWordIndex - 1), Number(BigInt(`0x${wordAt(clean, lengthWordIndex) || '0'}`)));
  const ids = [];
  for (let index = 0; index < length; index += 1) {
    const id = `0x${wordAt(clean, lengthWordIndex + 1 + index)}`.toLowerCase();
    if (/^0x[0-9a-f]{64}$/.test(id) && id !== ZERO_BYTES32) ids.push(id);
  }
  return ids;
};

const base64urlFromHex = (hex = '') => {
  const clean = trim(hex).replace(/^0x/, '');
  if (!/^[0-9a-fA-F]{64}$/.test(clean)) return '';
  const bytes = new Uint8Array(clean.match(/.{2}/g).map((part) => Number.parseInt(part, 16)));
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const payloadSessionSlug = (payload = {}) => {
  const session = isObj(payload.session) ? payload.session : {};
  for (const candidate of [
    payload.sessionSlug,
    payload.session_slug,
    payload.groupSlug,
    session.sessionSlug,
    session.slug,
    payload.session,
  ]) {
    if (typeof candidate !== 'string' && typeof candidate !== 'number') continue;
    const normalized = lower(candidate).replace(/[^a-z0-9_-]/g, '').slice(0, 128);
    if (normalized) return normalized;
  }
  return '';
};

const fetchArweaveQuestion = async (pointer, fetchImpl) => {
  if (!/^[a-zA-Z0-9_-]{1,43}$/.test(pointer)) return { payload: null, retryable: false };
  let retryable = false;
  for (const gateway of ['https://ar-io.dev', 'https://arweave.net']) {
    let response;
    try { response = await fetchImpl(`${gateway}/${pointer}`, { headers: { accept: 'application/json' } }); }
    catch { retryable = true; continue; }
    if (!response?.ok) {
      retryable ||= retryableReadStatus(response?.status);
      continue;
    }
    // Invalid JSON is a terminal payload problem, not a transport outage.
    const payload = await response.json().catch(() => null);
    if (isObj(payload)) return { payload, retryable: false };
  }
  return { payload: null, retryable };
};

const loadOnChainQuestions = async ({ config, slug, fetchImpl }) => {
  const surveysAddress = pickContractAddress(config);
  const rpcUrls = pickRpcUrls(config);
  const start = Number(config?.blockLimits?.start);
  if (!/^0x[0-9a-fA-F]{40}$/.test(surveysAddress) || !rpcUrls.length || !Number.isSafeInteger(start) || start < 0) {
    return catalog();
  }
  const latestHex = await rpc({ rpcUrls, method: 'eth_blockNumber', params: [], fetchImpl });
  const latest = Number(BigInt(latestHex));
  const configuredEnd = Number(config?.blockLimits?.end);
  const end = Number.isSafeInteger(configuredEnd) && configuredEnd >= start ? Math.min(configuredEnd, latest) : latest;
  if (end < start) return catalog();
  const scanEnd = Math.min(end, start + MAX_SCAN_BLOCKS - 1);
  const questions = [];
  const seen = new Set();
  let incomplete = false;
  let pointerReads = 0;
  let candidates = 0;
  let chunks = 0;
  for (let from = start; from <= scanEnd && chunks < MAX_LOG_CHUNKS; from += RPC_CHUNK_SIZE) {
    chunks += 1;
    const to = Math.min(scanEnd, from + RPC_CHUNK_SIZE - 1);
    let logs;
    try {
      logs = await rpc({ rpcUrls, method: 'eth_getLogs', params: [{
        address: surveysAddress, fromBlock: `0x${from.toString(16)}`, toBlock: `0x${to.toString(16)}`,
        topics: [QUESTIONS_ADDED_TOPIC0],
      }], fetchImpl });
    } catch { return catalog(questions, true); }
    if (!Array.isArray(logs)) return catalog(questions, true);
    for (const log of logs) {
      for (const id of decodeQuestionIds(log?.data)) {
        if (++candidates > MAX_CANDIDATES) return catalog(questions, true);
        if (seen.has(id)) continue;
        seen.add(id);
        if (pointerReads >= MAX_POINTER_READS) return catalog(questions, true);
        pointerReads += 1;
        let result;
        try {
          result = await rpc({ rpcUrls, method: 'eth_call', params: [
            { to: surveysAddress, data: `${GET_QUESTION_HASH_SELECTOR}${id.slice(2)}` }, 'latest',
          ], fetchImpl });
        } catch { incomplete = true; continue; }
        const pointer = base64urlFromHex(result);
        if (!pointer || result === ZERO_BYTES32) continue;
        // At most two gateway fetches for each of the bounded pointer reads.
        const { payload, retryable } = await fetchArweaveQuestion(pointer, fetchImpl);
        if (!payload) { incomplete ||= retryable; continue; }
        if (payloadSessionSlug(payload) !== lower(slug)) continue;
        const question = normalizeQuestion({ ...payload, id });
        if (question) questions.push(question);
        if (questions.length >= MAX_QUESTIONS) return catalog(questions, incomplete);
      }
    }
  }
  return catalog(questions, incomplete || scanEnd < end);
};

export const loadPublicInterviewQuestions = async ({
  env = {},
  config = {},
  slug = '',
  storageRoute,
  fetch: fetchImpl = globalThis.fetch,
} = {}) => {
  const cloudflareQuestions = await loadCloudflareQuestions({ env, config, slug, storageRoute });
  if (cloudflareQuestions.questions.length) return cloudflareQuestions;
  const onChain = await loadOnChainQuestions({ config, slug, fetchImpl });
  return catalog(onChain.questions, cloudflareQuestions.incomplete || onChain.incomplete);
};

export const __test__interviewQuestionCatalog = {
  base64urlFromHex,
  decodeQuestionIds,
  dedupeQuestions,
  hasRestrictedPrompt,
  hasRatingScaleMetadata,
  normalizeQuestion,
  payloadSessionSlug,
  pickRpcUrls,
  normalizeRatingScale,
};
