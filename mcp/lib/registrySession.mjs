import { ethers } from 'ethers';
import contracts from '../../client/src/variables/contracts.json' with { type: 'json' };
import registryAbi from '../../client/src/contractsABI/SESSION_REGISTRY_ABI.json' with { type: 'json' };
import surveysAbi from '../../client/src/contractsABI/SURVEYS_ABI.json' with { type: 'json' };
import rpcDefaults from '../../shared/rpcDefaults.cjs';
import { normalizeWorkerOrigin } from './sessionLinks.mjs';
import { text, normalizeSessionIdHex } from './workerClient.mjs';
import { chainRequest } from './chainErrors.mjs';
import { checkRegistryChain, findStartBlock, scanRegistryLogs, compareChainOrder } from './registryChain.mjs';
import { readRegistryMetadata, fetchArweaveJson, hexToArweaveId } from './registryPayloads.mjs';
import { createRegistryWriter } from './registryWrites.mjs';
import { registryQuestionMatchesSession, registryResponseMatchesSession } from './registryIdentity.mjs';

const MAX_QUESTIONS = 5000;
const MAX_CACHE = 20000;
const normalized = (value) => text(value).toLowerCase();

const checkMetadata = (metadata) => {
  const profile = metadata.sessionModeProfile;
  if (profile && profile.authority?.mode !== 'evm_registry_canonical') throw new Error('Only registry session profiles are supported by registry links.');
  const payloadEncryption = metadata.storageProfile?.payloadAccessControl?.encryption;
  if ((profile && profile.encryption?.mode !== 'none') ||
      (metadata.encryption?.mode && metadata.encryption.mode !== 'none') ||
      (payloadEncryption && payloadEncryption !== 'none') || text(metadata.encryptedMetadataURI) ||
      Object.keys(metadata.encryptedFields || {}).length || metadata.encrypted === true ||
      metadata.corsWorkerUrl?.encrypted === true || /^\s*(?:\{|enc:|lit:)/i.test(text(metadata.corsWorkerUrl))) {
    // Future work, intentionally disabled: Lit-encrypted registry sessions.
    // A later version could decrypt locked prompts and answers through the
    // session Worker's Chipotle path (shared/litChipotleAction.mjs).
    // if (payload.encryption?.mode === 'lit') {
    //   return await decryptThroughWorkerChipotle({ client, payload, sessionSlug });
    // }
    throw new Error('Encrypted registry sessions are unsupported; use an unencrypted session.');
  }
};

/** Resolves registry authority separately from the Worker used only for sign-in and uploads. */
export const createRegistrySession = async ({ info, config, wallet, fetchImpl = globalThis.fetch, now = Date.now, options = {} }) => {
  const chainId = options.chainId ?? info.chainId ?? 11155420;
  if (chainId !== 11155420 && !(config.allowLocalWorkers && chainId === 31337)) throw new Error('Registry sessions require OP Sepolia (or an explicitly enabled local chain).');
  const rpcUrl = config.rpcUrl || rpcDefaults.getPublicRpcUrls(chainId)[0];
  const provider = options.provider || new ethers.providers.StaticJsonRpcProvider({ url: rpcUrl, timeout: 15000 }, chainId);
  await checkRegistryChain(provider, chainId);
  const registryAddress = options.addresses?.sessionRegistry || contracts.sessionRegistryAddresses[chainId];
  if (!ethers.utils.isAddress(registryAddress)) throw new Error('No SessionRegistry address is configured for this chain.');
  const createContract = options.createContract || ((address, abi) => new ethers.Contract(address, abi, provider));
  const registry = createContract(registryAddress, registryAbi);
  let sessionConfig;
  let workerOrigin;
  let surveys;
  let startBlock;
  let questionCursor;
  const pending = new Map();
  const questions = new Map();
  const payloads = new Map();
  const localAnswers = new Map();
  const answerScans = new Map();
  let loadingQuestions;

  const loadConfig = async () => {
    await checkRegistryChain(provider, chainId);
    const slug = info.slug === 'general' ? '' : info.slug;
    const row = await chainRequest(() => registry.getSessionBySlug(slug));
    if (normalized(row[0]) !== slug) throw new Error('The registry returned a different session.');
    if (text(row[3])) throw new Error('Encrypted registry metadata is unsupported; use an unencrypted session.');
    if (Number(row[1]) !== chainId) throw new Error('The session uses a different chain from this registry.');
    const metadata = await readRegistryMetadata(row[2], { fetchImpl });
    checkMetadata(metadata);
    // Deliberately never request or use the registry's rpcUrl field.
    const fields = await chainRequest(() => registry.getSessionFields(slug, ['corsWorkerUrl']));
    const workerUrl = text(fields[0]) || text(metadata.corsWorkerUrl);
    if (/^\s*(?:\{|enc:|lit:)/i.test(workerUrl)) throw new Error('Encrypted Worker URLs are unsupported; use an unencrypted registry session.');
    const nextOrigin = normalizeWorkerOrigin(workerUrl, { allowLocalWorkers: config.allowLocalWorkers });
    const contractEntry = metadata.contracts?.surveys;
    const address = options.addresses?.surveys || text(contractEntry?.address || contractEntry?.contractAddress || contractEntry) || contracts.sessionContractsByChain[chainId]?.surveys;
    if (!ethers.utils.isAddress(address)) throw new Error('The session has no valid Surveys contract.');
    if (contractEntry?.chainId && Number(contractEntry.chainId) !== chainId) throw new Error('The Surveys contract uses a different chain.');
    if ((workerOrigin && workerOrigin !== nextOrigin) || (surveys && normalized(surveys.address) !== normalized(address))) {
      throw new Error('The session Worker or Surveys contract changed; join this session again.');
    }
    workerOrigin = nextOrigin;
    if (!surveys) surveys = createContract(address, surveysAbi);
    sessionConfig = { ...metadata, slug: info.slug, networkChainId: chainId, sessionId: normalizeSessionIdHex(row[7]), corsWorkerUrl: workerOrigin,
      contracts: { ...metadata.contracts, surveys: { address, chainId } } };
    if (startBlock === undefined) {
      const configured = Number(metadata.blockLimits?.start);
      const head = await chainRequest(() => provider.getBlockNumber());
      startBlock = metadata.blockLimits?.start !== undefined && Number.isSafeInteger(configured) && configured >= 0
        ? configured : await findStartBlock(provider, Number(row[5]), head);
      questionCursor = { block: startBlock, offset: 0 };
    }
    return sessionConfig;
  };
  await loadConfig();

  const cache = (pointer, payload) => {
    payloads.set(pointer, payload);
    if (payloads.size > MAX_CACHE) payloads.delete(payloads.keys().next().value);
  };
  const readPayload = async (pointer) => {
    if (payloads.has(pointer)) return payloads.get(pointer);
    const payload = await fetchArweaveJson(hexToArweaveId(pointer), { fetchImpl });
    cache(pointer, payload);
    return payload;
  };
  const filter = (eventName) => ({ address: surveys.address, topics: [surveys.interface.getEventTopic(eventName)] });

  const readQuestions = async ({ signal } = {}) => {
    const deadline = now() + 90000;
    let complete = true;
    if (pending.size < MAX_CACHE && questions.size < MAX_QUESTIONS) {
      const scanned = await scanRegistryLogs({ provider, filter: filter('QuestionsAdded'), cursor: questionCursor,
        toBlock: await chainRequest(() => provider.getBlockNumber()), maxLogs: 1000, deadline, now, signal });
      questionCursor = scanned.cursor;
      complete = scanned.complete;
      for (const log of scanned.logs) {
        const event = surveys.interface.parseLog(log);
        event.args.questionIds.forEach((id, index) => {
          if (event.args.surveyIds[index] === ethers.constants.HashZero && !questions.has(normalized(id))) pending.set(normalized(id), log);
        });
      }
    } else complete = false;
    const work = [...pending.entries()];
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(6, work.length) }, async () => {
      while (next < work.length && now() < deadline && !signal?.aborted && questions.size < MAX_QUESTIONS) {
        const [id, log] = work[next++];
        try {
          const pointer = await chainRequest(() => surveys.getQuestionHash(id));
          const payload = await readPayload(pointer);
          const matches = registryQuestionMatchesSession(payload, sessionConfig);
          if (matches) questions.set(id, { id, payload: { ...payload, id }, createdAt: String(log.blockNumber).padStart(16, '0'), ...log });
          pending.delete(id);
        } catch { complete = false; }
      }
    }));
    const blocked = new Set((Array.isArray(sessionConfig.BLOCKED_QUESTION_IDS) ? sessionConfig.BLOCKED_QUESTION_IDS : []).map(normalized));
    return { items: [...questions.values()].filter((entry) => !blocked.has(entry.id)), complete: complete && !pending.size && questions.size < MAX_QUESTIONS };
  };
  const loadQuestions = (args) => {
    if (!loadingQuestions) loadingQuestions = readQuestions(args).finally(() => { loadingQuestions = null; });
    return loadingQuestions;
  };

  const readAnswers = async ({ questionIds, maxRecords = 10000, mine = false, signal } = {}) => {
    const known = new Set(questionIds);
    const deadline = now() + 90000;
    const responseFilter = filter('ResponsesSubmitted');
    if (mine) responseFilter.topics.push(ethers.utils.hexZeroPad(wallet.address, 32));
    const head = await chainRequest(() => provider.getBlockNumber());
    const scope = [...known].sort().join(',');
    let state = answerScans.get(mine);
    if (!state || state.scope !== scope || head < state.head) {
      state = { scope, head: startBlock - 1, ranges: [], latest: new Map(), capped: false };
    } else state = { ...state, ranges: state.ranges.map((range) => ({ ...range })), latest: new Map(state.latest) };
    // New blocks take priority while older ranges retain their cursor. Restarting
    // from session creation permanently misses answers beyond one scan's budget.
    if (head > state.head) {
      state.ranges.unshift({ from: Math.max(startBlock, state.head + 1), cursor: { block: head, offset: 0 } });
      state.head = head;
    }
    // Bound pending ranges even if the chain advances faster than RPC scans.
    // Merging old gaps only re-reads events; latest-by-chain-order deduplicates them.
    if (state.ranges.length > 64) {
      const oldest = state.ranges.pop();
      state.ranges.at(-1).from = oldest.from;
    }
    const logs = [];
    let requests = 0;
    while (state.ranges.length && requests < 100 && logs.length < 10000 && now() < deadline && !signal?.aborted) {
      const range = state.ranges[0];
      const scan = await scanRegistryLogs({ provider, filter: responseFilter, cursor: range.cursor,
        fromBlock: range.from, toBlock: head, descending: true, maxLogs: 10000 - logs.length,
        maxRequests: 100 - requests, deadline, now, signal });
      requests += scan.requests;
      logs.push(...scan.logs);
      range.cursor = scan.cursor;
      if (scan.complete) state.ranges.shift();
      else break;
    }
    for (const log of logs) {
      const { args } = surveys.interface.parseLog(log);
      if (args.surveyId !== ethers.constants.HashZero) continue;
      if (mine && normalized(args.responder) !== normalized(wallet.address)) continue;
      for (const id of args.questionIds) {
        if (!known.has(normalized(id))) continue;
        const key = `${normalized(id)}:${normalized(args.responder)}`;
        const entry = { ...log, questionId: normalized(id), responder: args.responder };
        if (!state.latest.has(key) || compareChainOrder(entry, state.latest.get(key)) > 0) {
          state.latest.set(key, entry);
          if (state.latest.size > MAX_CACHE) {
            state.latest = new Map([...state.latest].sort((a, b) => compareChainOrder(b[1], a[1])).slice(0, 10000));
            state.capped = true;
          }
        }
      }
    }
    if (state.latest.size > 10000) {
      state.latest = new Map([...state.latest].sort((a, b) => compareChainOrder(b[1], a[1])).slice(0, 10000));
      state.capped = true;
    }
    answerScans.set(mine, state);
    const scannedAll = !state.ranges.length && !state.capped;
    const latest = new Map(state.latest);
    // Confirmed local writes fill propagation gaps, but must not resurrect an
    // older plaintext answer after a newer encrypted or cleared chain answer.
    for (const entry of localAnswers.values()) {
      if (!known.has(entry.questionId)) continue;
      if (!scannedAll && entry.blockNumber <= head) continue;
      const key = `${entry.questionId}:${normalized(entry.responder)}`;
      if (!latest.has(key) || compareChainOrder(entry, latest.get(key)) > 0) latest.set(key, { ...entry, local: true });
    }
    const candidates = [...latest.values()].sort((a, b) => compareChainOrder(b, a));
    const chainOrders = new Map(candidates.filter((entry) => normalized(entry.responder) === normalized(wallet.address))
      .map((entry) => [entry.questionId, entry]));
    const entries = [];
    const blockTimes = new Map();
    let complete = scannedAll && candidates.length <= maxRecords;
    let next = 0;
    const selected = candidates.slice(0, maxRecords);
    await Promise.all(Array.from({ length: Math.min(6, selected.length) }, async () => {
      while (next < selected.length) {
        if (now() >= deadline || signal?.aborted) { complete = false; break; }
        const entry = selected[next++];
        try {
          const pointer = entry.local ? entry.storageId : await chainRequest(() => surveys.getResponse(entry.responder, entry.questionId));
          const payload = await readPayload(pointer);
          if (!registryResponseMatchesSession(payload, sessionConfig) || payload.answer?.encrypted === true) continue;
          if (normalized(payload.questionID || payload.questionId) !== entry.questionId) continue;
          if (!blockTimes.has(entry.blockNumber)) blockTimes.set(entry.blockNumber, chainRequest(() => provider.getBlock(entry.blockNumber)));
          const block = await blockTimes.get(entry.blockNumber);
          const createdAt = block?.timestamp ? new Date(Number(block.timestamp) * 1000).toISOString() : '';
          entries.push({ ...entry, storageId: pointer, createdAt, payload });
        } catch { complete = false; }
      }
    }));
    return { entries, complete, chainOrders };
  };

  const writer = createRegistryWriter({ provider, chainId, wallet, surveys, slug: info.slug, remember: (resource, id, payload, pointer, receipt) => {
    cache(pointer, payload);
    const entry = { id, questionId: id, payload, storageId: pointer, responder: wallet.address,
      blockNumber: receipt.blockNumber, transactionIndex: receipt.transactionIndex, logIndex: receipt.logs.at(-1)?.logIndex || 0,
      createdAt: new Date(now()).toISOString() };
    if (resource === 'questions') questions.set(id, entry);
    else localAnswers.set(id, entry);
  } });
  return { loadConfig, loadQuestions, readAnswers, ...writer, get config() { return sessionConfig; }, workerOrigin };
};
