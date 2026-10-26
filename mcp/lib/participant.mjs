import { createTestEthRequester } from './testEth.mjs';
import { createRegistrySession } from './registrySession.mjs';
import { compareChainOrder } from './registryChain.mjs';
import { normalizeLabel } from './config.mjs';
import { describeError } from './mcpServer.mjs';
import { readAgentState, updateAgentState } from './agentState.mjs';
import { buildQuestionRecord, buildResponseRecord, isLockedQuestion, isSingleSelect, questionIdMatchesContent, ratingScaleFor } from './records.mjs';
import { latestAnswersByQuestion, respondersWithAnswers, summarizeQuestion } from './results.mjs';
import { listSessionSbts } from './sbtClaims.mjs';
import { buildSessionWebUrl, normalizeSessionSlug, normalizeWorkerOrigin, parseSessionLink } from './sessionLinks.mjs';
import { createWorkerClient, normalizeSessionIdHex, text, WorkerRequestError } from './workerClient.mjs';

const PUBLIC_RESULTS = 'public_full_if_storage_public';
const MAX_ANSWERS_PER_CALL = 25;
// The web client stops at 5,000 questions too.
const MAX_QUESTIONS = 5000;
// Listing your own answers scans every answer key in the session, 100 per page.
const OWN_ANSWER_PAGES = 1000;
const OWN_ANSWER_DEADLINE_MS = 60_000;
// One scan of the agent's own answers is reused this long; answers it gives
// meanwhile come from its local record.
const OWN_ANSWER_SCAN_MAX_AGE_MS = 10 * 60 * 1000;
const DEFAULT_RESULT_RECORDS = 2000;
const MAX_RESULT_RECORDS = 10000;
const READ_CONCURRENCY = 6;
// Reading stored records is bounded per tool call, whatever a Worker lists.
const READ_DEADLINE_MS = 90_000;
const MAX_CACHED_RECORDS = 20_000;
const MISSING_RECORD_RETRY_MS = 60_000;
const MAX_OWN_ANSWER_ITEMS = 5000;
const MAX_TITLE_LENGTH = 120;
const MAX_CONTEXT_PARAGRAPHS = 4;
const MAX_CONTEXT_LENGTH = 2000;
const MAX_CONTEXT_LINKS = 4;

// Agent-supplied arguments may be numbers or strings; Worker data uses text().
const trim = (value) => (typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : '');
const isRecord = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const sessionKey = (info) => info.kind === 'registry' ? `registry ${info.chainId || 11155420} ${info.slug}` : `${info.workerOrigin} ${info.slug}`;

const mapLimit = async (items, limit, task) => {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await task(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
};

const contextOf = (config) => {
  const context = isRecord(config?.sessionContext) ? config.sessionContext : {};
  const paragraphs = (Array.isArray(context.paragraphs) ? context.paragraphs.map(text) : [text(context.body)])
    .filter(Boolean)
    .slice(0, MAX_CONTEXT_PARAGRAPHS)
    .map((paragraph) => paragraph.slice(0, MAX_CONTEXT_LENGTH));
  const links = (Array.isArray(context.links) ? context.links : [])
    .filter((link) => isRecord(link) && /^https?:\/\//i.test(text(link.url)))
    .slice(0, MAX_CONTEXT_LINKS)
    .map((link) => ({ label: (text(link.label) || text(link.url)).slice(0, 200), url: text(link.url).slice(0, 2000) }));
  return { title: text(context.title).slice(0, 200), paragraphs, links };
};

const idList = (value) => new Set((Array.isArray(value) ? value : []).map((id) => text(id).toLowerCase()).filter(Boolean));

const stringOptions = (payload) => (Array.isArray(payload.options) ? payload.options.filter((option) => typeof option === 'string') : []);

const finiteNumber = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return undefined;
};

const SCALE_KEYS = ['min', 'minimum', 'max', 'maximum', 'minLabel', 'lowLabel', 'maxLabel', 'highLabel'];

// Keeps only plain numbers and strings, so later scale helpers never touch untrusted objects.
const cleanScale = (record) => {
  if (!isRecord(record)) return {};
  const out = {};
  SCALE_KEYS.forEach((key) => {
    if (typeof record[key] === 'string' || (typeof record[key] === 'number' && Number.isFinite(record[key]))) out[key] = record[key];
  });
  return out;
};

/** Copies a stored question into plain, checked values; everything downstream uses this copy. */
const sanitizeQuestion = (payload, id) => {
  const scale = cleanScale(payload.scale);
  const ratingScale = cleanScale(payload.ratingScale);
  const credits = finiteNumber(payload.voiceCredits);
  const question = {
    id,
    type: payload.type,
    prompt: payload.prompt,
    ...cleanScale(payload),
    ...(Array.isArray(payload.options) ? { options: stringOptions(payload) } : {}),
    ...(payload.singleSelect === true ? { singleSelect: true } : {}),
    ...(payload.oneSelectionOnly === true ? { oneSelectionOnly: true } : {}),
    ...(payload.singleChoice === true ? { singleChoice: true } : {}),
    ...(Number.isSafeInteger(payload.maxSelections) ? { maxSelections: payload.maxSelections } : {}),
    ...(credits !== undefined ? { voiceCredits: credits } : {}),
    ...(Object.keys(scale).length ? { scale } : {}),
    ...(Object.keys(ratingScale).length ? { ratingScale } : {}),
    ...(isLockedQuestion(payload) ? { locked: true } : {}),
    ...(payload.participant?.kind === 'agent' ? { participant: { kind: 'agent' } } : {}),
  };
  ratingScaleFor(question); // throws here, inside the caller's per-record guard, if anything is still wrong
  return question;
};

const contentMatchesId = (question, id) =>
  questionIdMatchesContent(id, {
    type: question.type,
    prompt: question.prompt,
    options: stringOptions(question),
    singleSelect: isSingleSelect(question),
    voiceCredits: question.voiceCredits ?? 99,
  });

/** Picks the canonical version per question id like the web client does. */
const chooseQuestionVersion = (versions) => {
  const admin = versions.filter((version) => version.uploaderIsAdmin);
  if (admin.length) return admin.sort((left, right) => (left.createdAt < right.createdAt ? 1 : -1))[0];
  // A version that hashes to its id beats the others; otherwise (including
  // locked versions, which cannot be checked) the earliest wins.
  const ranked = [...versions].sort((left, right) => {
    const leftMatches = left.contentMatches === true ? 0 : 1;
    const rightMatches = right.contentMatches === true ? 0 : 1;
    if (leftMatches !== rightMatches) return leftMatches - rightMatches;
    return left.createdAt < right.createdAt ? -1 : left.createdAt > right.createdAt ? 1 : 0;
  });
  return ranked[0];
};

const describeQuestion = (question, myAnswer) => {
  const options = stringOptions(question);
  const entry = {
    id: question.id,
    type: question.type,
    prompt: question.prompt,
    ...(question.type === 'multichoice' || question.type === 'quadratic' ? { options } : {}),
    ...(question.type === 'multichoice' ? { singleSelect: isSingleSelect(question) } : {}),
    ...(question.type === 'quadratic' ? { voiceCredits: question.voiceCredits ?? 99 } : {}),
    ...(question.type === 'rating' ? { scale: ratingScaleFor(question) } : {}),
    ...(question.highlighted ? { highlighted: true } : {}),
    ...(question.authoredByAgent ? { authoredBySelfDeclaredAgent: true } : {}),
  };
  if (myAnswer) {
    entry.myAnswer = {
      value: myAnswer.payload?.answer?.value,
      ...(text(myAnswer.payload?.additional?.value) ? { comment: text(myAnswer.payload.additional.value) } : {}),
      answeredAt: myAnswer.createdAt,
    };
  }
  return entry;
};

// Authoring inputs compared like the web client's question matcher: trimmed
// text and options, single-select, and credits (which may be stored as text).
const sameAuthoringInputs = (stored, record) => {
  const inputs = (question) =>
    JSON.stringify([
      question.type,
      text(question.prompt),
      stringOptions(question).map((option) => option.trim()),
      isSingleSelect(question),
      Number(question.voiceCredits ?? 99),
    ]);
  return inputs(stored) === inputs(record);
};

const progressNotes = (questions, mine) => ({
  ...(questions.locked ? { lockedQuestions: questions.locked } : {}),
  ...(questions.complete === false ? { questionsComplete: false } : {}),
  ...(mine.complete === false
    ? { myAnswersComplete: false, note: 'This session is large: answers made outside this agent may not all be listed.' }
    : {}),
});

export const createParticipant = ({ config, wallet, fetchImpl = globalThis.fetch, now = () => Date.now(), sbt = null, createProvider, sleep, registry = {} }) => {
  const requestTestEth = createTestEthRequester({ config, wallet, createProvider, now, sleep });
  const sessions = new Map(); // key -> { info, client, records: Map(storageId -> payload), missing: Map(storageId -> time) }
  let state = null;
  // The signal of the tool call in progress (the server runs calls one at a time).
  let signal = null;
  const checkpoint = () => {
    if (signal?.aborted) throw new Error('Stopped before finishing.');
  };
  const withSignal = (method) => async (args = {}, extra = {}) => {
    signal = extra?.signal || null;
    try {
      return await method(args);
    } finally {
      signal = null;
    }
  };

  const loadState = async () => {
    if (!state) state = await readAgentState(config.stateDir);
    return state;
  };
  const saveState = async (mutate) => {
    state = await updateAgentState(config.stateDir, mutate);
  };

  const profile = () => ({
    displayName: trim(state?.profile?.displayName ?? config.profile.displayName),
    modelId: trim(state?.profile?.modelId ?? config.profile.modelId),
    platform: trim(state?.profile?.platform ?? config.profile.platform),
  });

  // Sign in as the link's web app only when the agent already trusts it.
  const trustedOriginsFor = (preferred) =>
    config.trustedAppOrigins.includes(preferred)
      ? [preferred, ...config.trustedAppOrigins.filter((origin) => origin !== preferred)]
      : config.trustedAppOrigins;

  const openSession = async (info) => {
    const key = sessionKey(info);
    if (!sessions.has(key)) {
      const onchain = info.kind === 'registry' ? await createRegistrySession({ info, config, wallet, fetchImpl, now, options: registry }) : null;
      if (onchain) info = { ...info, workerOrigin: onchain.workerOrigin };
      sessions.set(key, {
        info: { ...info },
        registry: onchain,
        client: createWorkerClient({
          workerOrigin: info.workerOrigin,
          slug: info.slug,
          trustedOrigins: trustedOriginsFor(info.appOrigin),
          wallet,
          fetchImpl,
          now,
          ...(onchain ? { registryConfigLoader: onchain.loadConfig } : {}),
        }),
        records: new Map(),
        missing: new Map(),
      });
    }
    return sessions.get(key);
  };

  const remember = (ctx, title, recruitmentSource) =>
    saveState((fresh) => {
      const key = sessionKey(ctx.info);
      const stored = isRecord(fresh.sessions[key]) ? fresh.sessions[key] : {};
      // A different session behind the same link starts with no remembered answers.
      const previous = stored.sessionId && stored.sessionId !== ctx.client.sessionId ? {} : stored;
      fresh.sessions[key] = {
        ...previous,
        sessionId: ctx.client.sessionId,
        workerOrigin: ctx.info.workerOrigin,
        ...(ctx.registry ? { kind: 'registry', chainId: ctx.info.chainId || 11155420 } : {}),
        slug: ctx.info.slug,
        appOrigin: ctx.info.appOrigin,
        title,
        ...(recruitmentSource ? { recruitmentSource } : {}),
        joinedAt: previous.joinedAt || new Date(now()).toISOString(),
      };
      fresh.current = key;
    });

  const sessionState = (ctx) => {
    const entry = state?.sessions?.[sessionKey(ctx.info)];
    return isRecord(entry) ? entry : {};
  };

  // The agent keeps its own record of what it answered, so a very large
  // session whose answer listing is cut short still shows its answers.
  const rememberAnswers = (ctx, answered) =>
    saveState((fresh) => {
      const entry = fresh.sessions[sessionKey(ctx.info)];
      if (!isRecord(entry) || entry.sessionId !== ctx.client.sessionId) return;
      entry.answers = isRecord(entry.answers) ? entry.answers : {};
      answered.forEach(({ questionId, record, answeredAt, chainOrder }) => {
        entry.answers[questionId] = { value: record.answer.value, comment: record.additional.value, answeredAt,
          ...(ctx.registry && chainOrder ? chainOrder : {}) };
      });
    });

  /** Resolves a slug, link, or the current session to an open session. */
  const resolveSession = async (session) => {
    await loadState();
    const ref = trim(session);
    if (/^https?:\/\//i.test(ref)) {
      const parsed = parseSessionLink(ref, { allowLocalWorkers: config.allowLocalWorkers });
      const key = sessionKey(parsed);
      if (!state.sessions[key]) throw new Error('Join this session first with join_session.');
      return openSession(state.sessions[key]);
    }
    let key = state.current;
    if (ref) {
      const slug = normalizeSessionSlug(ref);
      const matches = Object.keys(state.sessions).filter((candidate) => state.sessions[candidate]?.slug === slug);
      if (matches.length > 1) throw new Error(`Several joined sessions are named "${slug}"; pass the session link instead.`);
      key = matches[0] || '';
      if (!key) throw new Error(`No joined session named "${slug}". Join it first with join_session.`);
    }
    const entry = state.sessions[key];
    if (!key || !isRecord(entry)) throw new Error('No session joined yet. Call join_session with a session link.');
    return openSession({
      workerOrigin: normalizeWorkerOrigin(entry.workerOrigin, { allowLocalWorkers: config.allowLocalWorkers }),
      slug: normalizeSessionSlug(entry.slug),
      appOrigin: text(entry.appOrigin),
      ...(entry.kind === 'registry' ? { kind: 'registry', chainId: entry.chainId } : {}),
    });
  };

  // Re-reads the session config every 30 seconds so admin changes (blocked
  // questions, results visibility, end time) apply to a long-running agent.
  const ensureReady = async (ctx) => {
    await ctx.client.refreshConfig();
    ctx.info.appOrigin = ctx.client.loginOrigin;
    if (!ctx.registry) await ctx.client.ensureToken();
    return ctx.client.config;
  };

  const cacheRecord = (ctx, storageId, payload) => {
    ctx.records.set(storageId, payload);
    if (ctx.records.size > MAX_CACHED_RECORDS) ctx.records.delete(ctx.records.keys().next().value);
  };

  const readCached = async (ctx, storageId) => {
    if (ctx.records.has(storageId)) return ctx.records.get(storageId);
    // A record can be briefly missing while the Worker's index catches up, so a miss is retried after a minute.
    if (now() - (ctx.missing.get(storageId) ?? -Infinity) < MISSING_RECORD_RETRY_MS) return null;
    let payload = null;
    try {
      payload = await ctx.client.read(storageId);
    } catch (error) {
      if (!(error instanceof WorkerRequestError) || error.status !== 404) throw error;
    }
    if (payload === null) {
      ctx.missing.set(storageId, now());
      if (ctx.missing.size > MAX_CACHED_RECORDS) ctx.missing.delete(ctx.missing.keys().next().value);
    } else {
      ctx.missing.delete(storageId);
      cacheRecord(ctx, storageId, payload);
    }
    return payload;
  };

  /** Reads records until the per-call deadline; records left unread come back undefined. */
  const readMany = async (ctx, storageIds) => {
    const deadline = now() + READ_DEADLINE_MS;
    let complete = true;
    const payloads = await mapLimit(storageIds, READ_CONCURRENCY, async (storageId) => {
      if (!ctx.records.has(storageId) && (now() >= deadline || signal?.aborted)) {
        complete = false;
        return undefined;
      }
      return readCached(ctx, storageId);
    });
    return { payloads, complete };
  };

  const loadQuestions = async (ctx) => {
    const sessionConfig = await ensureReady(ctx);
    if (ctx.registry) {
      const result = await ctx.registry.loadQuestions({ signal });
      const highlighted = idList(sessionConfig.HIGHLIGHTED_QUESTION_IDS);
      const all = [];
      for (const row of result.items) {
        try {
          if (!isRecord(row.payload) || typeof row.payload.type !== 'string') continue;
          const payload = isLockedQuestion(row.payload) ? { ...row.payload, prompt: '[encrypted]', locked: true } : row.payload;
          if (typeof payload.prompt !== 'string') continue;
          all.push({ ...sanitizeQuestion(payload, row.id), highlighted: highlighted.has(row.id), createdAt: row.createdAt,
            authoredByAgent: payload.participant?.kind === 'agent' });
        } catch { /* One malformed record must not hide the others. */ }
      }
      all.sort((a, b) => Number(b.highlighted) - Number(a.highlighted) || a.createdAt.localeCompare(b.createdAt));
      const questions = all.filter((question) => !isLockedQuestion(question));
      questions.lockedIds = new Set(all.filter(isLockedQuestion).map((question) => question.id));
      questions.locked = questions.lockedIds.size;
      questions.complete = result.complete;
      return questions;
    }
    const { items, complete } = await ctx.client.listAll('questions', { maxItems: MAX_QUESTIONS, signal });
    const hidden = new Set(items.filter((item) => item.hidden === true).map((item) => text(item.metadata?.resourceId).toLowerCase()));
    const rows = items.filter((item) => item.hidden !== true && text(item.storageRef?.id));
    const { payloads, complete: readComplete } = await readMany(ctx, rows.map((item) => text(item.storageRef.id)));
    const blocked = idList(sessionConfig.BLOCKED_QUESTION_IDS);
    const highlighted = idList(sessionConfig.HIGHLIGHTED_QUESTION_IDS);
    const versions = new Map();
    rows.forEach((item, index) => {
      // One malformed record must not hide the others.
      try {
        const payload = payloads[index];
        if (!isRecord(payload) || typeof payload.prompt !== 'string' || typeof payload.type !== 'string') return;
        // Same rule as the web client: the slug must match; a session id, when present, too.
        if (text(payload.sessionSlug) !== ctx.info.slug) return;
        if (text(payload.sessionId) && normalizeSessionIdHex(text(payload.sessionId)) !== ctx.client.sessionId) return;
        const id = (text(payload.id) || text(item.metadata?.resourceId)).toLowerCase();
        if (!id || hidden.has(id) || blocked.has(id)) return;
        const question = sanitizeQuestion(payload, id);
        const list = versions.get(id) || [];
        list.push({
          payload: question,
          createdAt: text(item.metadata?.createdAt),
          uploaderIsAdmin: item.metadata?.uploaderIsAdmin === true,
          contentMatches: question.locked ? null : contentMatchesId(question, id),
        });
        versions.set(id, list);
      } catch {
        // skip the record
      }
    });
    const all = [...versions.entries()].map(([id, list]) => {
      const chosen = chooseQuestionVersion(list);
      return {
        ...chosen.payload,
        id,
        prompt: chosen.payload.prompt,
        createdAt: chosen.createdAt,
        highlighted: highlighted.has(id),
        authoredByAgent: chosen.payload?.participant?.kind === 'agent',
      };
    });
    all.sort((left, right) => {
      if (left.highlighted !== right.highlighted) return left.highlighted ? -1 : 1;
      return left.createdAt < right.createdAt ? -1 : left.createdAt > right.createdAt ? 1 : 0;
    });
    // Locked questions are for certain members and need encrypted answers.
    const questions = all.filter((question) => !isLockedQuestion(question));
    questions.locked = all.length - questions.length;
    questions.lockedIds = new Set(all.filter((question) => isLockedQuestion(question)).map((question) => question.id));
    questions.complete = complete && readComplete;
    return questions;
  };

  const toEntries = async (ctx, items) => {
    const rows = items.filter((item) => text(item.storageRef?.id));
    const { payloads, complete } = await readMany(ctx, rows.map((item) => text(item.storageRef.id)));
    const entries = rows.map((item, index) => ({
      storageId: text(item.storageRef.id),
      createdAt: text(item.metadata?.createdAt) || text(item.storageRef?.createdAt),
      responder: text(item.metadata?.responder),
      payload: payloads[index],
    }));
    entries.complete = complete;
    return entries;
  };

  // Listing your own answers scans the whole session's answer index, so one
  // scan is reused for a while; answers given since come from the local record.
  const scanMyAnswers = async (ctx) => {
    if (ctx.ownScan && (!ctx.registry || ctx.ownScan.complete) && now() - ctx.ownScan.at < OWN_ANSWER_SCAN_MAX_AGE_MS && ctx.ownScan.sessionId === ctx.client.sessionId) {
      return ctx.ownScan;
    }
    if (ctx.registry) {
      const questions = await loadQuestions(ctx);
      const questionIds = new Set(questions.map((question) => question.id));
      const { entries, complete, chainOrders } = await ctx.registry.readAnswers({ questionIds, maxRecords: MAX_OWN_ANSWER_ITEMS, mine: true, signal });
      const latest = latestAnswersByQuestion(entries, { registryConfig: ctx.client.config, questionIds });
      const answers = new Map();
      latest.forEach((byResponder, id) => { if (byResponder.has(wallet.address.toLowerCase())) answers.set(id, byResponder.get(wallet.address.toLowerCase())); });
      ctx.ownScan = { at: now(), sessionId: ctx.client.sessionId, answers, complete, chainOrders };
      return ctx.ownScan;
    }
    const { items, complete: listed } = await ctx.client.listAll('responses', {
      mine: true,
      maxItems: MAX_OWN_ANSWER_ITEMS,
      maxPages: OWN_ANSWER_PAGES,
      deadlineMs: OWN_ANSWER_DEADLINE_MS,
      signal,
    });
    const entries = await toEntries(ctx, items);
    const complete = listed && entries.complete;
    const latest = latestAnswersByQuestion(entries, { sessionSlug: ctx.info.slug, sessionId: ctx.client.sessionId });
    const answers = new Map();
    const self = wallet.address.toLowerCase();
    latest.forEach((byResponder, questionId) => {
      const entry = byResponder.get(self);
      if (entry) answers.set(questionId, entry);
    });
    ctx.ownScan = { at: now(), sessionId: ctx.client.sessionId, answers, complete };
    return ctx.ownScan;
  };

  const loadMyAnswers = async (ctx) => {
    await ensureReady(ctx);
    const scan = await scanMyAnswers(ctx);
    const mine = new Map(scan.answers);
    let complete = scan.complete;
    const blocks = new Map();
    // Add answers this agent recorded locally since the scan (or that it did not reach).
    await loadState();
    const local = sessionState(ctx).sessionId === ctx.client.sessionId && isRecord(sessionState(ctx).answers) ? sessionState(ctx).answers : {};
    for (const [questionId, answer] of Object.entries(local)) {
      if (!isRecord(answer)) continue;
      // An incomplete registry scan cannot establish whether a saved plaintext
      // answer has since been cleared or encrypted by another client.
      if (ctx.registry && !scan.complete) continue;
      const known = mine.get(questionId);
      const chainOrder = scan.chainOrders?.get(questionId);
      if (ctx.registry && chainOrder && compareChainOrder(answer, chainOrder) < 0) continue;
      const newer = ctx.registry ? !known || compareChainOrder(answer, known) > 0 : !known || text(answer.answeredAt) > known.createdAt;
      // A remembered answer whose block a reorganization replaced was never answered.
      if (!newer) continue;
      const replaced = ctx.registry && await ctx.registry.replacedWrite(answer, blocks);
      if (replaced === null) complete = false;
      if (!replaced) {
        mine.set(questionId, {
          createdAt: text(answer.answeredAt),
          ...(ctx.registry ? { blockNumber: answer.blockNumber, transactionIndex: answer.transactionIndex, logIndex: answer.logIndex } : {}),
          payload: { answer: { value: answer.value }, additional: { value: answer.comment } },
        });
      }
    }
    // A cleared answer (the web client uploads '') leaves the question unanswered.
    [...mine.entries()].forEach(([questionId, entry]) => {
      const value = entry?.payload?.answer?.value;
      if (value === '' || value === null || value === undefined || (Array.isArray(value) && !value.length)) mine.delete(questionId);
    });
    mine.complete = complete;
    return mine;
  };

  const sessionSummary = (ctx, sessionConfig) => ({
    session: ctx.info.slug,
    title: (text(sessionConfig.sessionName) || ctx.info.slug).slice(0, MAX_TITLE_LENGTH),
    webUrl: buildSessionWebUrl(ctx.info),
    resultsPublic: sessionConfig?.sessionModeProfile?.results?.visibility === PUBLIC_RESULTS,
  });

  const methods = {
    async whoami() {
      await loadState();
      return {
        address: wallet.address,
        profile: profile(),
        currentSession: state.sessions[state.current]?.slug || null,
        sessions: await mapLimit(Object.values(state.sessions).filter(isRecord), READ_CONCURRENCY, async (entry) => ({
            session: entry.slug,
            title: entry.title || entry.slug,
            webUrl: buildSessionWebUrl(entry),
            joinedAt: entry.joinedAt,
            testEth: await resolveSession(buildSessionWebUrl(entry)).then((ctx) => ctx.client.describeTestEth())
              .catch(() => ({ offered: false, reason: 'Session availability could not be checked.' })),
          })),
      };
    },

    async setProfile({ displayName, modelId, platform } = {}) {
      const next = {};
      if (displayName !== undefined) next.displayName = normalizeLabel(displayName, 'displayName');
      if (modelId !== undefined) next.modelId = normalizeLabel(modelId, 'modelId');
      if (platform !== undefined) next.platform = normalizeLabel(platform, 'platform');
      await saveState((fresh) => {
        fresh.profile = { ...fresh.profile, ...next };
      });
      return { profile: profile(), note: 'Applies to answers and statements submitted from now on.' };
    },

    async joinSession({ link, worker, session, inviteCode, groupPassword, claimPassword } = {}) {
      let parsed;
      if (trim(link)) {
        parsed = parseSessionLink(link, { allowLocalWorkers: config.allowLocalWorkers });
      } else if (trim(worker) && trim(session)) {
        parsed = {
          appOrigin: config.appOrigin,
          slug: normalizeSessionSlug(session),
          workerOrigin: normalizeWorkerOrigin(worker, { allowLocalWorkers: config.allowLocalWorkers }),
          joinGroupId: '',
          sbtClaims: [],
          recruitmentSource: '',
        };
      } else {
        throw new Error('Pass a session link, or both worker and session.');
      }
      // Joining always starts a fresh client, so a session that changed identity can be joined again.
      sessions.delete(sessionKey(parsed));
      const ctx = await openSession(parsed);
      const sessionConfig = await ctx.client.loadConfig();
      ctx.info.appOrigin = ctx.client.loginOrigin;
      const outcome = { ...sessionSummary(ctx, sessionConfig), address: wallet.address };

      // Like the web app, only SBTs the link marks for automatic claiming are claimed on join.
      const claims = parsed.sbtClaims.filter((claim) => claim.auto);
      const offered = parsed.sbtClaims.filter((claim) => !claim.auto).map((claim) => claim.sbt);
      if (offered.length) outcome.sbtsToClaimWithClaimSbt = offered;
      const separateCodes = {
        inviteCode: trim(inviteCode),
        groupPassword: trim(groupPassword),
        claimPassword: trim(claimPassword),
      };
      const hasSeparateCodes = Object.values(separateCodes).some(Boolean);
      if (hasSeparateCodes && claims.length !== 1) {
        throw new Error('Codes given separately need a link that offers exactly one SBT to claim; otherwise use claim_sbt for each SBT.');
      }
      if (claims.length && !sbt) throw new Error('SBT claims are not available in this build.');

      // Sign in before anything else. Hosted sessions admit by role or group,
      // never by SBT, so a failed sign-in ends the join before any claim
      // spends gas or a one-time invite.
      let loginError = null;
      let tokenClaims = await ctx.client.login().catch((error) => {
        if (!ctx.registry) throw error;
        loginError = error;
        return {};
      });
      await remember(ctx, outcome.title, parsed.recruitmentSource);
      if (claims.length) {
        outcome.sbtClaims = [];
        for (const claim of claims) {
          checkpoint();
          try {
            outcome.sbtClaims.push(
              await sbt.claim({
                ctx,
                sbtAddress: claim.sbt,
                inviteCode: claim.inviteCode || separateCodes.inviteCode,
                groupPassword: claim.groupPassword || separateCodes.groupPassword,
                claimPassword: separateCodes.claimPassword,
                signal,
              }),
            );
          } catch (error) {
            outcome.sbtClaims.push({ sbt: claim.sbt, status: 'failed', error: describeError(error) });
          }
        }
        // Refresh the token so access that depends on the new token applies.
        tokenClaims = await ctx.client.login().then((claims) => { loginError = null; return claims; }).catch(() => tokenClaims);
      }
      outcome.testEth = await ctx.client.describeTestEth();
      outcome.signedIn = !loginError;
      if (loginError) {
        outcome.readOnlyReason = describeError(loginError);
        outcome.note = 'Joined read-only: public questions and results are available, but uploads, answers, statements, and faucet requests need Worker access.';
      }
      const scopes = isRecord(tokenClaims?.scopes) ? tokenClaims.scopes : {};
      outcome.scopes = Object.keys(scopes).filter((scope) => scopes[scope] === true);
      if (parsed.joinGroupId) {
        checkpoint();
        try {
          if (ctx.registry) throw new Error('Worker groups are not available in on-chain sessions.');
          await ctx.client.joinGroup(parsed.joinGroupId);
          outcome.joinedGroup = parsed.joinGroupId;
        } catch (error) {
          outcome.groupJoinError = describeError(error);
        }
      }
      outcome.description = text(sessionConfig.sessionInfo).slice(0, MAX_CONTEXT_LENGTH);
      outcome.context = contextOf(sessionConfig);
      const sessionSbts = listSessionSbts(sessionConfig);
      if (sessionSbts.length) outcome.sessionSbts = sessionSbts;
      outcome.next = 'Read the context, then call list_questions and answer.';
      return outcome;
    },

    async requestTestEth({ session } = {}) {
      const ctx = await resolveSession(session);
      return requestTestEth({ ctx, signal });
    },

    async getSession({ session } = {}) {
      const ctx = await resolveSession(session);
      const sessionConfig = await ensureReady(ctx);
      const [questions, mine] = await Promise.all([loadQuestions(ctx), loadMyAnswers(ctx)]);
      const endsAt = text(sessionConfig.sessionEndsAt);
      const sessionSbts = listSessionSbts(sessionConfig);
      return {
        ...sessionSummary(ctx, sessionConfig),
        testEth: await ctx.client.describeTestEth(),
        description: text(sessionConfig.sessionInfo).slice(0, MAX_CONTEXT_LENGTH),
        context: contextOf(sessionConfig),
        ...(endsAt ? { endsAt } : {}),
        ...(sessionSbts.length ? { sessionSbts } : {}),
        questions: questions.length,
        answeredByMe: questions.filter((question) => mine.has(question.id)).length,
        ...progressNotes(questions, mine),
      };
    },

    async listQuestions({ session, filter = 'unanswered', limit = 25 } = {}) {
      if (!['unanswered', 'answered', 'all'].includes(filter)) throw new Error('filter must be unanswered, answered, or all.');
      const max = Math.min(Math.max(Number(limit) || 25, 1), 100);
      const ctx = await resolveSession(session);
      const [questions, mine] = await Promise.all([loadQuestions(ctx), loadMyAnswers(ctx)]);
      const matching = questions.filter((question) =>
        filter === 'all' ? true : filter === 'answered' ? mine.has(question.id) : !mine.has(question.id),
      );
      return {
        session: ctx.info.slug,
        total: questions.length,
        answeredByMe: questions.filter((question) => mine.has(question.id)).length,
        matching: matching.length,
        ...progressNotes(questions, mine),
        questions: matching.slice(0, max).map((question) => describeQuestion(question, mine.get(question.id))),
      };
    },

    async answer({ session, answers } = {}) {
      if (!Array.isArray(answers) || !answers.length) throw new Error('Pass at least one answer.');
      if (answers.length > MAX_ANSWERS_PER_CALL) throw new Error(`Send at most ${MAX_ANSWERS_PER_CALL} answers per call.`);
      const ctx = await resolveSession(session);
      const sessionConfig = await ensureReady(ctx);
      const endsAt = Date.parse(text(sessionConfig.sessionEndsAt));
      if (Number.isFinite(endsAt) && endsAt <= now()) throw new Error('This session has ended and no longer accepts answers.');
      const questions = new Map((await loadQuestions(ctx)).map((question) => [question.id, question]));
      const recruitmentSource = text(sessionState(ctx).recruitmentSource);
      const results = [];
      const answered = [];
      const pendingAnswers = [];
      let txHash;
      let reconciliationRequired = false;
      const seen = new Set();
      for (const item of answers) {
        const questionId = trim(item?.questionId).toLowerCase();
        if (seen.has(questionId)) {
          results.push({ questionId, ok: false, error: 'This question appears more than once in the call; send one answer per question.' });
          continue;
        }
        seen.add(questionId);
        const question = questions.get(questionId);
        if (!question) {
          results.push({ questionId, ok: false, error: 'Unknown question id, or a question locked to certain members; call list_questions.' });
          continue;
        }
        let built;
        try {
          built = buildResponseRecord({
            question,
            value: item.value,
            comment: item.comment,
            importance: item.importance,
            conviction: item.conviction,
            responder: wallet.address,
            session: { sessionSlug: ctx.info.slug, sessionId: ctx.client.sessionId },
            profile: profile(),
            recruitmentSource,
          });
        } catch {
          built = { ok: false, error: 'This question is stored in a form agents cannot answer.' };
        }
        if (!built.ok) {
          results.push({ questionId, ok: false, error: built.error });
          continue;
        }
        if (signal?.aborted) {
          results.push({ questionId, ok: false, error: 'Stopped before this answer was sent.' });
          continue;
        }
        if (ctx.registry) {
          pendingAnswers.push({ questionId, record: built.record });
          continue;
        }
        try {
          const storageRef = await ctx.client.upload({ resource: 'responses', data: JSON.stringify(built.record) });
          if (text(storageRef?.id)) cacheRecord(ctx, text(storageRef.id), built.record);
          answered.push({ questionId, record: built.record, answeredAt: text(storageRef?.createdAt) || new Date(now()).toISOString() });
          results.push({ questionId, ok: true, answer: built.record.answer.value });
        } catch (error) {
          results.push({ questionId, ok: false, error: describeError(error) });
        }
      }
      if (pendingAnswers.length) {
        try {
          const submitted = await ctx.registry.submitAnswers({ client: ctx.client, records: pendingAnswers.map((item) => item.record),
            fund: () => requestTestEth({ ctx, signal }), signal });
          txHash = submitted.txHash;
          pendingAnswers.forEach(({ questionId, record }) => {
            answered.push({ questionId, record, answeredAt: new Date(now()).toISOString(), chainOrder: {
              blockNumber: submitted.receipt.blockNumber, blockHash: submitted.receipt.blockHash,
              transactionIndex: submitted.receipt.transactionIndex, logIndex: submitted.receipt.logs.at(-1)?.logIndex || 0,
            } });
            results.push({ questionId, ok: true, answer: record.answer.value });
          });
        } catch (error) {
          if (typeof error.txHash === 'string' && /^0x[0-9a-f]{64}$/i.test(error.txHash)) txHash = error.txHash;
          reconciliationRequired = error.reconciliationRequired === true;
          pendingAnswers.forEach(({ questionId }) => results.push({ questionId, ok: false, error: describeError(error) }));
        }
      }
      let warning;
      if (answered.length) {
        try { await rememberAnswers(ctx, answered); }
        catch {
          // Local bookkeeping cannot undo a successful upload or confirmed tx.
          // Keep the successful result so an agent does not repeat remote effects.
          ctx.ownScan = null;
          warning = 'Answers were submitted, but the local answer history could not be saved. Do not resubmit them to fix this warning.';
        }
      }
      return {
        session: ctx.info.slug,
        ...(txHash ? { txHash } : {}),
        ...(reconciliationRequired ? { reconciliationRequired: true } : {}),
        ...(warning ? { warning } : {}),
        submitted: results.filter((result) => result.ok).length,
        failed: results.filter((result) => !result.ok).length,
        results,
      };
    },

    async addStatement({ session, prompt, type = 'binary', options, singleSelect, voiceCredits, tags } = {}) {
      const ctx = await resolveSession(session);
      const sessionConfig = await ensureReady(ctx);
      const built = buildQuestionRecord({
        type,
        prompt,
        options,
        singleSelect,
        voiceCredits,
        tags,
        creator: wallet.address,
        session: {
          sessionSlug: ctx.info.slug,
          sessionId: ctx.client.sessionId,
          sessionName: text(sessionConfig.sessionName).slice(0, MAX_TITLE_LENGTH),
        },
        profile: profile(),
      });
      if (!built.ok) throw new Error(built.error);
      if (ctx.registry) {
        const result = await ctx.registry.addStatement({ client: ctx.client, record: built.record,
          fund: () => requestTestEth({ ctx, signal }), signal });
        return { session: ctx.info.slug, questionId: built.id, created: true, prompt: built.record.prompt, txHash: result.txHash };
      }
      const tagList = [
        { name: 'CE-SessionId', value: ctx.client.sessionId },
        { name: 'CE-SessionSlug', value: ctx.info.slug },
        { name: 'CE-Resource', value: 'questions' },
        { name: 'CE-ResourceId', value: built.id },
      ];
      checkpoint();
      try {
        const storageRef = await ctx.client.upload({ resource: 'questions', data: built.record, tags: tagList });
        if (text(storageRef?.id)) cacheRecord(ctx, text(storageRef.id), built.record);
        return { session: ctx.info.slug, questionId: built.id, created: true, prompt: built.record.prompt };
      } catch (error) {
        if (error instanceof WorkerRequestError && error.status === 409 && /hidden/i.test(`${error.code} ${error.message}`)) {
          throw new Error('A session admin removed this statement, so it cannot be added again.');
        }
        if (error instanceof WorkerRequestError && error.status === 409) {
          // Another author owns this id. It already exists only when readers can
          // see a version of it; otherwise (for example an admin hid it) the refusal stands.
          const current = await loadQuestions(ctx);
          const existing = current.find((question) => question.id === built.id);
          if (!existing && current.lockedIds.has(built.id)) {
            throw new Error('A statement with this wording already exists, locked to certain members.');
          }
          if (!existing) {
            throw new Error('A statement with this wording exists but is not available to participants (an admin may have removed it).');
          }
          return {
            session: ctx.info.slug,
            questionId: built.id,
            created: false,
            alreadyExists: true,
            prompt: existing.prompt,
            ...(sameAuthoringInputs(existing, built.record) ? {} : { note: 'The existing statement differs only in capitalization or spacing.' }),
          };
        }
        throw error;
      }
    },

    async getResults({ session, questionIds, maxRecords = DEFAULT_RESULT_RECORDS } = {}) {
      const ctx = await resolveSession(session);
      const sessionConfig = await ensureReady(ctx);
      if (sessionConfig?.sessionModeProfile?.results?.visibility !== PUBLIC_RESULTS) {
        return {
          session: ctx.info.slug,
          resultsPublic: false,
          note: 'This session does not publish results to participants. Only your own answers are visible (see list_questions with filter "answered").',
        };
      }
      const cap = Math.min(Math.max(Number(maxRecords) || DEFAULT_RESULT_RECORDS, 1), MAX_RESULT_RECORDS);
      const questions = await loadQuestions(ctx);
      const wanted = Array.isArray(questionIds) && questionIds.length ? idList(questionIds) : null;
      let entries;
      let complete;
      let listedCount;
      const knownIds = new Set(questions.map((question) => question.id));
      if (ctx.registry) {
        const result = await ctx.registry.readAnswers({ questionIds: knownIds, maxRecords: cap, signal });
        entries = result.entries;
        complete = result.complete;
        listedCount = entries.length;
      } else {
        const result = await ctx.client.listAll('responses', { maxItems: MAX_RESULT_RECORDS, signal });
        const listed = result.items
          .filter((item) => text(item.storageRef?.id))
          .sort((left, right) => (text(left.metadata?.createdAt) < text(right.metadata?.createdAt) ? 1 : -1));
        entries = await toEntries(ctx, listed.slice(0, cap));
        complete = result.complete;
        listedCount = listed.length;
      }
      const latest = latestAnswersByQuestion(entries, {
        sessionSlug: ctx.info.slug,
        sessionId: ctx.client.sessionId,
        ...(ctx.registry ? { registryConfig: sessionConfig, questionIds: knownIds } : {}),
      });
      // Like the web report: participants who gave at least one valid answer to a visible question.
      const participants = new Set(questions.flatMap((question) => respondersWithAnswers(question, latest.get(question.id))));
      return {
        session: ctx.info.slug,
        resultsPublic: true,
        webUrl: buildSessionWebUrl(ctx.info),
        participants: participants.size,
        partial: !complete || listedCount > cap || questions.complete === false || entries.complete === false,
        questions: questions
          .filter((question) => !wanted || wanted.has(question.id))
          .map((question) => summarizeQuestion(question, latest.get(question.id))),
      };
    },

    async joinGroup({ session, groupId } = {}) {
      const ctx = await resolveSession(session);
      if (ctx.registry) throw new Error('Worker groups are not available in on-chain sessions.');
      await ensureReady(ctx);
      const id = trim(groupId);
      if (!/^[A-Za-z0-9._:-]{1,128}$/.test(id)) throw new Error('Pass a valid group id.');
      checkpoint();
      await ctx.client.joinGroup(id);
      return { session: ctx.info.slug, joinedGroup: id };
    },

    async claimSbt({ session, sbt: sbtAddress, inviteCode, groupPassword, claimPassword } = {}) {
      if (!sbt) throw new Error('SBT claims are not available in this build.');
      const ctx = await resolveSession(session);
      await ctx.client.refreshConfig();
      ctx.info.appOrigin = ctx.client.loginOrigin;
      // A signed-in agent can use the session faucet; claiming works without it.
      await ctx.client.ensureToken().catch(() => {});
      const result = await sbt.claim({
        ctx,
        sbtAddress: trim(sbtAddress),
        inviteCode: trim(inviteCode),
        groupPassword: trim(groupPassword),
        claimPassword: trim(claimPassword),
        signal,
      });
      // Sign in again so access that depends on the token applies right away.
      await ctx.client.login().catch(() => {});
      return result;
    },
  };
  return Object.fromEntries(Object.entries(methods).map(([name, method]) => [name, withSignal(method)]));
};
