const QUESTIONS_ADDED_TOPIC0 = '0x3b584fb360a325f39352e75bd13458807d8e31735ef4dadaeff99fc3e59b517a';
const GET_QUESTION_HASH_SELECTOR = '0x24b9f713';
const ZERO_BYTES32 = `0x${'00'.repeat(32)}`;
const MAX_QUESTIONS = 100;
const MAX_SCAN_BLOCKS = 2_000_000;
const RPC_CHUNK_SIZE = 100_000;
const BINARY_RESPONSE_OPTIONS = ['Agree', 'Unsure', 'Disagree'];

const trim = (value) => String(value == null ? '' : value).trim();
const lower = (value) => trim(value).toLowerCase();
const isObj = (value) => !!value && typeof value === 'object' && !Array.isArray(value);

const hasRestrictedPrompt = (question = {}) => {
  const visibility = lower(question.visibility || question.access || question.questionVisibility);
  return Boolean(
    question.promptEncrypted ||
    question.encryptedPrompt ||
    question.locked === true ||
    question.gated === true ||
    question.gate ||
    (Array.isArray(question.gates) && question.gates.length) ||
    /private|locked|gated|encrypted/.test(visibility)
  );
};

const normalizeQuestion = (value = {}) => {
  const question = isObj(value) ? value : {};
  const id = lower(question.id || question.questionId);
  const prompt = trim(question.prompt || question.question || question.title);
  if (!id || !prompt || hasRestrictedPrompt(question) || /connect.+decrypt|encrypted prompt/i.test(prompt)) return null;
  const type = lower(question.type || question.questionType || 'freeform') || 'freeform';
  const rawOptions = question.options || question.choices;
  const options = type === 'binary'
    ? [...BINARY_RESPONSE_OPTIONS]
    : (Array.isArray(rawOptions) ? rawOptions : [])
      .map((entry) => trim(isObj(entry) ? (entry.label || entry.value) : entry))
      .filter(Boolean);
  return {
    id,
    prompt,
    type,
    options,
  };
};

const dedupeQuestions = (questions = []) => {
  const seen = new Set();
  return questions.map(normalizeQuestion).filter((question) => {
    if (!question || seen.has(question.id)) return false;
    seen.add(question.id);
    return true;
  }).slice(0, MAX_QUESTIONS);
};

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
  const listResponse = await storageRoute({
    path: '/storage/list',
    method: 'GET',
    request: new Request(`${origin}/storage/list?resource=questions&limit=${MAX_QUESTIONS}`),
    env,
    config,
    slug,
    uploaderAddress: '',
    baseHeaders: {},
  });
  const listing = await readJsonResponse(listResponse);
  const items = Array.isArray(listing?.items) ? listing.items.slice(0, MAX_QUESTIONS) : [];
  const questions = [];
  for (const item of items) {
    const id = trim(item?.storageRef?.id || item?.metadata?.id || item?.id);
    if (!id) continue;
    // Deliberately sequential and bounded. Each read reuses the storage route's
    // per-item access checks, so this endpoint cannot widen question visibility.
    const readResponse = await storageRoute({
      path: '/storage/read',
      method: 'GET',
      request: new Request(`${origin}/storage/read?id=${encodeURIComponent(id)}`),
      env,
      config,
      slug,
      uploaderAddress: '',
      baseHeaders: {},
    });
    const payload = await readJsonResponse(readResponse);
    if (payload) questions.push(payload);
  }
  return dedupeQuestions(questions);
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
  normalizeQuestion,
  payloadSessionSlug,
  pickRpcUrls,
};
