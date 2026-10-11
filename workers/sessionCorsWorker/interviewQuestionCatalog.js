const QUESTIONS_ADDED_TOPIC0 = '0x3b584fb360a325f39352e75bd13458807d8e31735ef4dadaeff99fc3e59b517a';
const GET_QUESTION_HASH_SELECTOR = '0x24b9f713';
const ZERO_BYTES32 = `0x${'00'.repeat(32)}`;
const MAX_QUESTIONS = 100;
// Room for re-uploads of the same id: the canonical version may sit beyond
// the first 100 stored rows.
const MAX_CLOUDFLARE_QUESTION_ROWS = MAX_QUESTIONS * 2;
const MAX_CLOUDFLARE_LIST_PAGES = 10;
const MAX_SCAN_BLOCKS = 2_000_000;
const RPC_CHUNK_SIZE = 100_000;
import { normalizePublicInterviewQuestions, hasRestrictedPrompt, hasRatingScaleMetadata, normalizeRatingScale, normalizeQuestion } from '../../shared/interviewQuestionCatalog.mjs';
import { resolveSessionAdminAddresses } from './storageRouteExecution.js';
import { selectCanonicalStorageVersions } from './storageResourceOwnership.js';
const trim = (value) => String(value == null ? '' : value).trim();
const lower = (value) => trim(value).toLowerCase();
const isObj = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const dedupeQuestions = (questions) => normalizePublicInterviewQuestions(questions, MAX_QUESTIONS);

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

const loadCloudflareQuestions = async ({ env, config, slug, storageRoute }) => {
  if (typeof storageRoute !== 'function') return [];
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
  const items = [];
  let cursor = '';
  for (let page = 0; page < MAX_CLOUDFLARE_LIST_PAGES && items.length < MAX_CLOUDFLARE_QUESTION_ROWS; page += 1) {
    const query = new URLSearchParams({ resource: 'questions', limit: String(MAX_QUESTIONS), ...(cursor ? { cursor } : {}) });
    const listing = await readJsonResponse(await callStorage('/storage/list', query.toString()));
    items.push(...(Array.isArray(listing?.items) ? listing.items : []));
    cursor = trim(listing?.cursor);
    if (!cursor || listing?.listComplete === true) break;
  }
  // Hidden ids arrive as markers without a storage reference.
  const hiddenIds = new Set(items
    .filter((item) => item?.hidden === true || item?.metadata?.hidden === true)
    .map((item) => lower(item?.metadata?.resourceId))
    .filter(Boolean));
  const candidates = [];
  for (const item of items.slice(0, MAX_CLOUDFLARE_QUESTION_ROWS)) {
    const id = trim(item?.storageRef?.id || item?.metadata?.id || item?.id);
    if (!id || item?.hidden === true) continue;
    // Deliberately sequential and bounded. Each read reuses the storage route's
    // per-item access checks, so this endpoint cannot widen question visibility.
    const payload = await readJsonResponse(await callStorage('/storage/read', `id=${encodeURIComponent(id)}`));
    const questionId = lower(payload?.id || payload?.questionId);
    if (!isObj(payload) || !questionId || hiddenIds.has(questionId)) continue;
    candidates.push({
      resourceId: questionId,
      createdAtMs: Date.parse(trim(item?.metadata?.createdAt)) || 0,
      storageRefId: id,
      uploader: trim(item?.metadata?.uploader),
      payload,
    });
  }
  // Same rule as the client: the first upload of an id wins unless a session
  // admin uploaded a newer one, so a re-upload cannot rewrite the catalog.
  const admins = resolveSessionAdminAddresses(config);
  return dedupeQuestions(
    selectCanonicalStorageVersions(candidates, { isAdmin: (address) => admins.has(address) })
      .map((candidate) => candidate.payload),
  );
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
  const length = Math.min(MAX_QUESTIONS, Number(BigInt(`0x${wordAt(clean, lengthWordIndex) || '0'}`)));
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
  if (!/^[a-zA-Z0-9_-]{1,43}$/.test(pointer)) return null;
  for (const gateway of ['https://ar-io.dev', 'https://arweave.net']) {
    try {
      const response = await fetchImpl(`${gateway}/${pointer}`, { headers: { accept: 'application/json' } });
      if (!response.ok) continue;
      const payload = await response.json();
      if (isObj(payload)) return payload;
    } catch {}
  }
  return null;
};

const loadOnChainQuestions = async ({ config, slug, fetchImpl }) => {
  const surveysAddress = pickContractAddress(config);
  const rpcUrls = pickRpcUrls(config);
  const start = Number(config?.blockLimits?.start);
  if (!/^0x[0-9a-fA-F]{40}$/.test(surveysAddress) || !rpcUrls.length || !Number.isFinite(start) || start < 0) {
    return [];
  }
  const latestHex = await rpc({ rpcUrls, method: 'eth_blockNumber', params: [], fetchImpl });
  const latest = Number(BigInt(latestHex));
  const configuredEnd = Number(config?.blockLimits?.end);
  const end = Number.isFinite(configuredEnd) && configuredEnd >= start ? Math.min(configuredEnd, latest) : latest;
  if (end < start || end - start > MAX_SCAN_BLOCKS) return [];

  const ids = [];
  for (let from = start; from <= end && ids.length < MAX_QUESTIONS; from += RPC_CHUNK_SIZE) {
    const to = Math.min(end, from + RPC_CHUNK_SIZE - 1);
    const logs = await rpc({
      rpcUrls,
      method: 'eth_getLogs',
      params: [{
        address: surveysAddress,
        fromBlock: `0x${from.toString(16)}`,
        toBlock: `0x${to.toString(16)}`,
        topics: [QUESTIONS_ADDED_TOPIC0],
      }],
      fetchImpl,
    });
    (Array.isArray(logs) ? logs : []).forEach((log) => {
      decodeQuestionIds(log?.data).forEach((id) => {
        if (!ids.includes(id) && ids.length < MAX_QUESTIONS) ids.push(id);
      });
    });
  }

  const questions = [];
  for (const id of ids) {
    const result = await rpc({
      rpcUrls,
      method: 'eth_call',
      params: [{ to: surveysAddress, data: `${GET_QUESTION_HASH_SELECTOR}${id.slice(2)}` }, 'latest'],
      fetchImpl,
    });
    const pointer = base64urlFromHex(result);
    if (!pointer) continue;
    const payload = await fetchArweaveQuestion(pointer, fetchImpl);
    if (payload && payloadSessionSlug(payload) === lower(slug)) {
      questions.push({ ...payload, id: payload.id || id });
    }
  }
  return dedupeQuestions(questions);
};

export const loadPublicInterviewQuestions = async ({
  env = {},
  config = {},
  slug = '',
  storageRoute,
  fetch: fetchImpl = globalThis.fetch,
} = {}) => {
  const cloudflareQuestions = await loadCloudflareQuestions({ env, config, slug, storageRoute });
  if (cloudflareQuestions.length) return cloudflareQuestions;
  return loadOnChainQuestions({ config, slug, fetchImpl });
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
