import { ethers } from 'ethers';
import { responseReadWindowOptions, historicalResponseReadError } from '../../shared/responseReadWindow.mjs';
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
  let endBlock = null;
  let readEnd;
  let windowKey;
  let questionMark = null;
  let questionCursor;
  const pending = new Map();
  const questions = new Map();
  const payloads = new Map();
  const localAnswers = new Map();
  const answerScans = new Map();
  let loadingQuestions;

  const containsBlock = (block) => Number.isSafeInteger(block) && block >= startBlock && (endBlock === null || block <= readEnd);
  const readWindowEnd = async () => {
    const head = await chainRequest(() => provider.getBlockNumber());
    readEnd = endBlock === null ? head : Math.min(endBlock, head);
    return readEnd;
  };
  const configuredBlock = (value, name) => {
    if (value == null) return null;
    const block = Number(value);
    if ((typeof value !== 'number' && typeof value !== 'string') || String(value).trim() === '' || !Number.isSafeInteger(block) || block < 0) {
      throw new Error(`Invalid session block limit: ${name} must be a nonnegative integer.`);
    }
    return block;
  };

  const loadConfig = async () => {
    await checkRegistryChain(provider, chainId);
    const slug = info.slug || 'general';
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
    const head = await chainRequest(() => provider.getBlockNumber());
    const nextStart = configuredBlock(metadata.blockLimits?.start, 'start') ?? await findStartBlock(provider, Number(row[5]), head);
    const nextEnd = configuredBlock(metadata.blockLimits?.end, 'end');
    if (nextEnd !== null && nextEnd < nextStart) throw new Error('Invalid session block window: end must not precede start.');
    const nextKey = `${nextStart}:${nextEnd ?? 'head'}`;
    startBlock = nextStart;
    endBlock = nextEnd;
    readEnd = endBlock === null ? head : Math.min(endBlock, head);
    if (windowKey !== nextKey) {
      windowKey = nextKey;
      questionCursor = { block: startBlock, offset: 0 };
      questionMark = null;
      pending.clear();
      for (const [id, entry] of questions) if (!entry.local || !containsBlock(entry.blockNumber)) questions.delete(id);
      answerScans.clear();
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

  // A block hash commits to every earlier block. Each reader keeps the hash of the
  // head it scanned under; when that block changes, a reorganization replaced
  // history the reader already used, and it rebuilds from the session start.
  const readBlock = (number, blocks) => {
    if (!blocks.has(number)) blocks.set(number, chainRequest(() => provider.getBlock(number)).catch(() => null));
    return blocks.get(number);
  };
  const readHeadMark = async (number, blocks) => {
    const block = await readBlock(number, blocks);
    return block?.hash ? { number, hash: block.hash } : null;
  };
  const historyReplaced = async (mark, blocks) => {
    if (!mark?.hash) return false;
    const block = await readBlock(mark.number, blocks);
    // A missing block means this RPC node is behind; it cannot disprove the mark yet.
    return block?.hash ? block.hash !== mark.hash : null;
  };
  /** True if replaced, false if retained, null if the RPC cannot verify it yet. */
  const replacedWrite = (entry, blocks = new Map()) => historyReplaced(entry?.blockHash ? { number: entry.blockNumber, hash: entry.blockHash } : null, blocks);
  const visibleQuestions = () => {
    const blocked = new Set((Array.isArray(sessionConfig.BLOCKED_QUESTION_IDS) ? sessionConfig.BLOCKED_QUESTION_IDS : []).map(normalized));
    return [...questions.values()].filter((entry) => !blocked.has(entry.id) && containsBlock(entry.blockNumber));
  };

  const readQuestions = async ({ signal } = {}) => {
    const deadline = now() + 90000;
    const blocks = new Map();
    const end = await readWindowEnd();
    let complete = true;
    const replaced = await historyReplaced(questionMark, blocks);
    // Advancing a cursor without verifying its prior mark leaves new blocks
    // uncovered: a later reorg above that old mark would never be noticed.
    if (replaced === null) return { items: visibleQuestions(), complete: false };
    if (replaced) {
      questions.clear();
      pending.clear();
      questionCursor = { block: startBlock, offset: 0 };
      questionMark = null;
    }
    for (const [id, entry] of questions) {
      if (!entry.local) continue;
      const replaced = await replacedWrite(entry, blocks);
      if (replaced === null) complete = false;
      if (replaced) questions.delete(id);
    }
    if (pending.size < MAX_CACHE && questions.size < MAX_QUESTIONS) {
      const head = await readHeadMark(end, blocks);
      if (head) {
        const scanned = await scanRegistryLogs({ provider, filter: filter('QuestionsAdded'), cursor: questionCursor,
          toBlock: head.number, maxLogs: 1000, deadline, now, signal });
        questionCursor = scanned.cursor;
        complete = complete && scanned.complete;
        if (replaced !== null && (!questionMark || head.number >= questionMark.number)) questionMark = head;
        for (const log of scanned.logs) {
          const event = surveys.interface.parseLog(log);
          event.args.questionIds.forEach((id, index) => {
            if (event.args.surveyIds[index] === ethers.constants.HashZero && !questions.has(normalized(id))) pending.set(normalized(id), log);
          });
        }
      } else complete = false;
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
    return { items: visibleQuestions(), complete: complete && !pending.size && questions.size < MAX_QUESTIONS };
  };
  const loadQuestions = (args) => {
    if (!loadingQuestions) loadingQuestions = readQuestions(args).finally(() => { loadingQuestions = null; });
    return loadingQuestions;
  };

  const readAnswers = async ({ questionIds, maxRecords = 10000, mine = false, signal } = {}) => {
    const known = new Set(questionIds);
    const deadline = now() + 90000;
    const blocks = new Map();
    let verified = true;
    const responseFilter = filter('ResponsesSubmitted');
    if (mine) responseFilter.topics.push(ethers.utils.hexZeroPad(wallet.address, 32));
    const head = await readWindowEnd();
    const scope = [...known].sort().join(',');
    let state = answerScans.get(mine);
    const replaced = !!state && state.scope === scope && head >= state.head && await historyReplaced(state.mark, blocks);
    if (replaced === null) {
      // Keep the previous payloads too; current contract pointers may already
      // name answers from the unverified blocks we must not scan yet. Confirmed
      // local writes can fill this gap, but cannot replace a newer chain answer.
      const held = new Map((state.result?.entries || []).map((entry) =>
        [`${entry.questionId}:${normalized(entry.responder)}`, entry]));
      const chainOrders = new Map(state.result?.chainOrders || []);
      for (const entry of localAnswers.values()) {
        if (!known.has(entry.questionId) || !containsBlock(entry.blockNumber)) continue;
        const key = `${entry.questionId}:${normalized(entry.responder)}`;
        if ([state.latest.get(key), held.get(key)].some((previous) => previous && compareChainOrder(entry, previous) < 0)) continue;
        chainOrders.set(entry.questionId, entry);
        held.delete(key);
        if (registryResponseMatchesSession(entry.payload, sessionConfig) && entry.payload.answer?.encrypted !== true &&
            normalized(entry.payload.questionID || entry.payload.questionId) === entry.questionId) held.set(key, entry);
      }
      return { entries: [...held.values()].sort((a, b) => compareChainOrder(b, a)).slice(0, maxRecords),
        complete: false, chainOrders, unreadAnswers: state.result?.unreadAnswers || 0 };
    }
    if (!state || state.scope !== scope || head < state.head || replaced) {
      state = { scope, head: startBlock - 1, mark: null, ranges: [], latest: new Map(), capped: false };
    } else state = { ...state, ranges: state.ranges.map((range) => ({ ...range })), latest: new Map(state.latest) };
    // New blocks take priority while older ranges retain their cursor. Restarting
    // from session creation permanently misses answers beyond one scan's budget.
    if (head > state.head) {
      const mark = await readHeadMark(head, blocks);
      if (mark) {
        state.ranges.unshift({ from: Math.max(startBlock, state.head + 1), cursor: { block: head, offset: 0 } });
        state.head = head;
        if (replaced !== null) state.mark = mark;
      } else verified = false;
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
    for (const [id, entry] of localAnswers) {
      if (!known.has(entry.questionId) || !containsBlock(entry.blockNumber)) continue;
      // A write can land above the last scanned head, or survive a scope reset.
      const replaced = await replacedWrite(entry, blocks);
      if (replaced === null) verified = false;
      if (replaced) { localAnswers.delete(id); continue; }
      if (!scannedAll && entry.blockNumber <= head) continue;
      const key = `${entry.questionId}:${normalized(entry.responder)}`;
      if (!latest.has(key) || compareChainOrder(entry, latest.get(key)) > 0) latest.set(key, { ...entry, local: true });
    }
    const candidates = [...latest.values()].sort((a, b) => compareChainOrder(b, a));
    const chainOrders = new Map(candidates.filter((entry) => normalized(entry.responder) === normalized(wallet.address))
      .map((entry) => [entry.questionId, entry]));
    const entries = [];
    let complete = verified && scannedAll && candidates.length <= maxRecords;
    let unreadAnswers = 0;
    let next = 0;
    const selected = candidates.slice(0, maxRecords);
    await Promise.all(Array.from({ length: Math.min(6, selected.length) }, async () => {
      while (next < selected.length) {
        if (now() >= deadline || signal?.aborted) { complete = false; break; }
        const entry = selected[next++];
        try {
          const { blockTag } = responseReadWindowOptions(endBlock === null ? null : { blockTag: head }, entry.responder, entry.questionId);
          let pointer;
          if (entry.local) pointer = entry.storageId;
          else {
            try {
              pointer = await chainRequest(() => blockTag == null
                ? surveys.getResponse(entry.responder, entry.questionId)
                : surveys.getResponse(entry.responder, entry.questionId, { blockTag }));
            } catch (error) {
              throw blockTag == null ? error : historicalResponseReadError(error, blockTag);
            }
          }
          const payload = await readPayload(pointer);
          if (!registryResponseMatchesSession(payload, sessionConfig) || payload.answer?.encrypted === true) continue;
          if (normalized(payload.questionID || payload.questionId) !== entry.questionId) continue;
          const block = await readBlock(entry.blockNumber, blocks);
          if (!block) complete = false;
          const createdAt = block?.timestamp ? new Date(Number(block.timestamp) * 1000).toISOString() : entry.createdAt || '';
          entries.push({ ...entry, storageId: pointer, createdAt, payload });
        } catch { complete = false; unreadAnswers++; }
      }
    }));
    unreadAnswers += selected.length - next;
    state.result = { entries, complete, chainOrders, unreadAnswers };
    return state.result;
  };

  const writer = createRegistryWriter({ provider, chainId, wallet, surveys, slug: info.slug, remember: (resource, id, payload, pointer, receipt) => {
    cache(pointer, payload);
    const entry = { id, questionId: id, payload, storageId: pointer, responder: wallet.address,
      blockNumber: receipt.blockNumber, blockHash: receipt.blockHash, transactionIndex: receipt.transactionIndex,
      logIndex: receipt.logs.at(-1)?.logIndex || 0, createdAt: new Date(now()).toISOString() };
    if (resource === 'questions') questions.set(id, { ...entry, local: true });
    else localAnswers.set(id, entry);
  } });
  return { loadConfig, loadQuestions, readAnswers, replacedWrite, containsBlock, get windowKey() { return windowKey; }, ...writer, get config() { return sessionConfig; }, workerOrigin };
};
