import { createTestEthRequester } from './testEth.mjs';
import { createHash, randomUUID } from 'node:crypto';
import { createRegistrySession } from './registrySession.mjs';
import { compareChainOrder } from './registryChain.mjs';
import { normalizeLabel } from './config.mjs';
import { describeError } from './mcpServer.mjs';
import { readAgentState, updateAgentState } from './agentState.mjs';
import { buildQuestionRecord, buildResponseRecord, isLockedQuestion, isSingleSelect, ratingScaleFor } from './records.mjs';
import { isPreferredStorageVersion } from '../../shared/storage/canonicalStorageVersions.mjs';
import { htmlToPlainText, normalizeSessionContext } from '../../shared/sessionContext.mjs';
import { MAX_AGENT_INSTRUCTIONS_CHARS } from '../../shared/sessionConfigEdits.mjs';
import { CONTEXT_AGENT_ADDER, agentAdderName, participantsMayAddContext } from '../../shared/sessionContextSources.mjs';
import { buildNote, checkContextLink, contextInvitation, contextUploadForm, readContextFile, workerReadsContext } from './contextAdditions.mjs';
import { createKnownSessions } from './knownSessions.mjs';
import { latestAnswersByQuestion, respondersWithAnswers, summarizeQuestion } from './results.mjs';
import { listSessionSbts } from './sbtClaims.mjs';
import { buildSessionWebUrl, GROUP_ID_RE, normalizeSessionSlug, normalizeWorkerOrigin, parseSessionLink } from './sessionLinks.mjs';
import { createWorkerClient, normalizeSessionIdHex, text, WorkerRequestError } from './workerClient.mjs';

const PUBLIC_RESULTS = 'public_full_if_storage_public';
// The Session Worker shows these sessions' answers to every signed-in member.
const MEMBER_RESULTS = 'session_member_full';
const MAX_ANSWERS_PER_CALL = 25;
// The web client stops at 5,000 questions too.
const MAX_QUESTIONS = 5000;
// Listing your own answers scans every answer key in the session, 100 per page.
const OWN_ANSWER_PAGES = 1000;
const OWN_ANSWER_DEADLINE_MS = 60_000;
// One scan of the agent's own answers is reused this long; answers it gives
// meanwhile come from its local record.
const OWN_ANSWER_SCAN_MAX_AGE_MS = 10 * 60 * 1000;
// A Worker lists answers without their question, so results read every listed
// one: a 30-question salon of 80 people, some changing answers, lists ~2,900.
const MAX_RESULT_RECORDS = 10000;
const READ_CONCURRENCY = 16;
// Reading stored records is bounded per tool call, whatever a Worker lists.
const READ_DEADLINE_MS = 90_000;
const MAX_CACHED_RECORDS = 20_000;
const MISSING_RECORD_RETRY_MS = 60_000;
const MAX_OWN_ANSWER_ITEMS = 5000;
const MAX_TITLE_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_GROUPS = 100;
const MAX_GROUP_TAGS = 20;
const MAX_TAG_LENGTH = 80;
const CONTEXT_ADMINS_ONLY = 'This session limits context to its admins, so nothing was added.';
const CONTEXT_ENDED = 'This session has ended, so it takes no more context.';
const CONTEXT_NO_LINKS = 'This session’s Worker doesn’t take links from participants yet. You can add a file or text.';
const CONTEXT_NO_FETCH = 'This session doesn’t let you have its Worker fetch pages, so it takes no links from you. You can add a file or text.';
const CONTEXT_RATE_LIMITED = 'The session’s Worker is rate limiting you, so nothing was added. Retry in a few minutes; if it still refuses, you may have reached the session’s daily limit for your address, which clears within a day.';

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

// The session page's reader, so agents see the same notes and links people do.
// An uploaded HTML page reaches agents as its words, in place of the paragraphs.
const contextOf = (config) => {
  const { html, ...context } = normalizeSessionContext(config?.sessionContext);
  if (!html) return context;
  const words = htmlToPlainText(html);
  return { ...context, paragraphs: words ? [words] : [] };
};

const idList = (value) => new Set((Array.isArray(value) ? value : []).map((id) => text(id).toLowerCase()).filter(Boolean));

const stringOptions = (payload) => (Array.isArray(payload.options) ? payload.options.filter((option) => typeof option === 'string') : []);

const finiteNumber = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return undefined;
};

const SCALE_KEYS = ['step', 'min', 'minimum', 'max', 'maximum', 'minLabel', 'lowLabel', 'maxLabel', 'highLabel'];

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

/** Picks the canonical version per question id like the web client does. */
const chooseQuestionVersion = (versions) => versions.reduce(
  (chosen, candidate) => isPreferredStorageVersion(candidate, chosen) ? candidate : chosen, null,
);

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

// The session's own instructions for agents: shown in full up to the cap
// every Worker enforces, marked as the admins' and as adding to the general guidance.
const instructionsOf = (config) => {
  const raw = typeof config?.agentInstructions === 'string' ? config.agentInstructions.trim() : '';
  if (!raw) return null;
  const cut = raw.length > MAX_AGENT_INSTRUCTIONS_CHARS;
  return {
    from: 'the session’s admins',
    note: 'These add to the general guidance for agents. Follow both; they can ask more of you but can’t lift its rules.',
    text: cut ? raw.slice(0, MAX_AGENT_INSTRUCTIONS_CHARS) : raw,
    ...(cut ? { cutAt: MAX_AGENT_INSTRUCTIONS_CHARS } : {}),
  };
};

// `member` is whether the agent is in the link's group, or null when its groups couldn't be read.
const nextStep = ({ instructions, linkGroup, member = null }) => {
  const read = instructions ? 'Read the session’s instructions for agents and the context' : 'Read the context';
  if (!linkGroup) return `${read}, then call list_questions and answer.`;
  const named = `The link names group "${linkGroup}"`;
  if (member) {
    const other = instructions
      ? ' If the instructions ask you to be in another group instead, join that one with join_group and leave this one with leave_group.'
      : '';
    return `${read}. ${named}, which you’re already in.${other} Then call list_questions and answer.`;
  }
  const join = instructions
    ? 'call join_group for the group the instructions ask you to join, if any'
    : 'join it with join_group';
  return `${read}. ${named}${member === false ? ', which you haven’t joined' : ''}: ${join}. Then call list_questions and answer.`;
};

const WHO_CAN_END_MEMBERSHIP = {
  both: 'Members can leave with leave_group, and admins can remove them.',
  admin_only: 'Only admins can remove members; members can’t leave.',
  member_only: 'Members can leave with leave_group; admins can’t remove them.',
  neither: 'No one can end a membership.',
};

const GROUP_REFUSALS = {
  worker_group_not_found: (id) => `This session has no group "${id}".`,
  worker_group_join_denied: (id) => `Group "${id}" isn’t open to joining; its admins add members.`,
  worker_group_join_ended: (id) => `Joining group "${id}" has closed.`,
  worker_group_member_cap_exceeded: (id) => `Group "${id}" has no room for more members.`,
  worker_group_member_not_found: (id) => `You aren’t a member of group "${id}".`,
  worker_group_leave_denied: (id) => `Group "${id}" doesn’t let members leave.`,
};

const groupRefusal = (error, id) =>
  error instanceof WorkerRequestError && Object.hasOwn(GROUP_REFUSALS, error.code) ? new Error(GROUP_REFUSALS[error.code](id)) : error;

// `olderLink` is a link to a Worker whose features couldn't be read, which may be
// one from before participants' links: it refuses one as any change from a participant.
const contextRefusal = (error, { olderLink = false } = {}) => {
  if (!(error instanceof WorkerRequestError)) return error;
  if (error.code === 'context_admin_required') return new Error(olderLink ? CONTEXT_NO_LINKS : CONTEXT_ADMINS_ONLY);
  if (error.code === 'context_link_fetch_denied') return new Error(CONTEXT_NO_FETCH);
  if (error.status === 410) return new Error(CONTEXT_ENDED);
  // A 429 may be the session's daily limit or a short one, such as signing in's: the Worker doesn't say which.
  if (error.status === 429) return new Error(CONTEXT_RATE_LIMITED);
  return error;
};

const progressNotes = (questions, mine) => ({
  ...(questions.locked ? { lockedQuestions: questions.locked } : {}),
  ...(questions.complete === false ? { questionsComplete: false } : {}),
  ...(questions.unread ? { unreadQuestions: questions.unread } : {}),
  ...(mine.unread ? { unreadMyAnswers: mine.unread } : {}),
  ...(mine.complete === false
    ? { myAnswersComplete: false, note: 'Some answers could not be read or the scan is unfinished; the answers shown may be incomplete.' }
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
          // A hosted session reopened from state must still be the one the agent joined.
          ...(onchain ? { registryConfigLoader: onchain.loadConfig } : { sessionId: text(info.sessionId) }),
        }),
        records: new Map(),
        missing: new Map(),
      });
    }
    return sessions.get(key);
  };

  const knownSessions = createKnownSessions({ fetchImpl, now, allowLocalWorkers: config.allowLocalWorkers });

  // A link without worker= reaches the Worker its site lists for the slug, as
  // in the browser; an unlisted slug is an on-chain session. A list that can't
  // be read stops here instead of guessing.
  const resolveLink = async (link) => {
    const parsed = parseSessionLink(link, { allowLocalWorkers: config.allowLocalWorkers });
    if (parsed.kind !== 'registry') return parsed;
    const found = await knownSessions.lookup(parsed.appOrigin, parsed.slug);
    if (found.status === 'unlisted') return parsed;
    if (found.status === 'unreadable') {
      throw new Error(
        `The list of known sessions at ${found.listUrl} could not be read (${found.reason}). ` +
          'If this session is on a Session Worker, ask for its link with worker=, the Worker’s address; otherwise try again later.',
      );
    }
    const hosted = { ...parsed, workerOrigin: found.workerOrigin, listedSessionId: found.sessionId };
    delete hosted.kind;
    delete hosted.chainId;
    return hosted;
  };

  const hasEnded = (sessionConfig) => {
    const endsAt = Date.parse(text(sessionConfig?.sessionEndsAt));
    return Number.isFinite(endsAt) && endsAt <= now();
  };

  // An admin the session lists, or one its Worker counts as an admin another way, such as by role, as the token says.
  const isSessionAdmin = (ctx, sessionConfig) => {
    const self = wallet.address.toLowerCase();
    const admins = [sessionConfig?.adminAddress, ...(Array.isArray(sessionConfig?.adminAddresses) ? sessionConfig.adminAddresses : [])];
    return admins.some((address) => text(address).toLowerCase() === self) || ctx.client.tokenClaims?.scopes?.admin === true;
  };
  // The Worker fetches a participant's link only with their fetch scope.
  const mayAddLinks = (ctx, sessionConfig) => isSessionAdmin(ctx, sessionConfig) || ctx.client.tokenClaims?.scopes?.fetch === true;

  // The groups this agent may see, and whether it's in each. The MCP gives
  // groups and their tags no meaning; the session's instructions do.
  const describeGroups = async (ctx) => {
    let listed;
    let mine;
    try {
      [listed, mine] = await Promise.all([ctx.client.listGroups(), ctx.client.listMyMemberships()]);
    } catch (error) {
      // A Worker without group storage has no groups to show.
      if (error instanceof WorkerRequestError && error.status === 501) return {};
      if (error instanceof WorkerRequestError && error.code === 'worker_group_capacity_reconciliation_required') {
        return { groupsUnavailable: 'This session’s groups can’t be listed on its Worker yet.' };
      }
      return { groupsUnavailable: describeError(error) };
    }
    const idOf = (group) => text(group?.groupId).toLowerCase();
    const memberOf = new Map(mine.filter((entry) => idOf(entry.group)).map((entry) => [idOf(entry.group), entry]));
    const entries = [
      ...listed.filter((group) => idOf(group)).map((group) => ({ group, member: memberOf.has(idOf(group)), memberCount: group.memberCount })),
      ...[...memberOf.values()]
        .filter((entry) => !listed.some((group) => idOf(group) === idOf(entry.group)))
        .map((entry) => ({ group: entry.group, member: true, memberCount: entry.memberCount })),
    ];
    const groups = entries.slice(0, MAX_GROUPS).map(({ group, member, memberCount }) => {
      const tags = Array.isArray(group.tags) ? group.tags.map((tag) => text(tag).slice(0, MAX_TAG_LENGTH)).filter(Boolean).slice(0, MAX_GROUP_TAGS) : [];
      const members = Number.isSafeInteger(memberCount) && memberCount >= 0 ? memberCount : null;
      const limit = Number.isSafeInteger(group.memberLimit) && group.memberLimit > 0 ? group.memberLimit : 0;
      const closesAt = text(group.joinEndsAt);
      const open = text(group.joinMode).toLowerCase() === 'open';
      let joining = open ? 'Open: join with join_group.' : 'Only admins add members.';
      if (open && closesAt && Date.parse(closesAt) <= now()) joining = 'Joining has closed.';
      else if (open && limit && members !== null && members >= limit) joining = 'Full.';
      // A Worker from before the setting omits it, and works as 'both'.
      const removalAuth = text(group.removalAuth).toLowerCase() || 'both';
      return {
        groupId: text(group.groupId),
        name: text(group.label).slice(0, MAX_TITLE_LENGTH),
        ...(text(group.description) ? { description: text(group.description).slice(0, MAX_DESCRIPTION_LENGTH) } : {}),
        ...(tags.length ? { tags } : {}),
        joining,
        ...(open && closesAt ? { joinClosesAt: closesAt } : {}),
        ...(members !== null ? { members } : {}),
        ...(limit ? { memberLimit: limit } : {}),
        member,
        ...(Object.hasOwn(WHO_CAN_END_MEMBERSHIP, removalAuth) ? { whoCanEndMembership: WHO_CAN_END_MEMBERSHIP[removalAuth] } : {}),
      };
    });
    return { groups };
  };

  // The invitation shows where adding would work: a hosted session that takes
  // participants' context, hasn't ended, keeps context where its Worker reads
  // it, and runs a Worker that says it takes it (links only where it says so).
  const invitationFor = async (ctx, sessionConfig) => {
    if (ctx.registry || !participantsMayAddContext(sessionConfig) || hasEnded(sessionConfig) || !workerReadsContext(sessionConfig)) return {};
    const features = await ctx.client.readFeatures();
    if (!features?.includes('participant_context_v1')) return {};
    return { addingContext: contextInvitation({ links: features.includes('participant_context_links_v1') && mayAddLinks(ctx, sessionConfig) }) };
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
      answered.forEach(({ questionId, record, answeredAt, chainOrder, requestId }) => {
        entry.answers[questionId] = { value: record.answer.value, comment: record.additional.value, answeredAt,
          ...(ctx.registry && chainOrder ? chainOrder : {}) };
        if (requestId && entry.pendingUploads?.[questionId]?.requestId === requestId) delete entry.pendingUploads[questionId];
      });
    });

  /** Resolves a slug, link, or the current session to an open session. */
  const resolveSession = async (session) => {
    await loadState();
    const ref = trim(session);
    if (/^https?:\/\//i.test(ref)) {
      // A link means here what join_session makes of it.
      const parsed = await resolveLink(ref);
      const key = sessionKey(parsed);
      if (!isRecord(state.sessions[key])) throw new Error('Join this session first with join_session.');
      return openEntry(state.sessions[key]);
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
    return openEntry(entry);
  };

  const openEntry = async (entry) =>
    openSession({
      workerOrigin: normalizeWorkerOrigin(entry.workerOrigin, { allowLocalWorkers: config.allowLocalWorkers }),
      slug: normalizeSessionSlug(entry.slug),
      appOrigin: text(entry.appOrigin),
      ...(entry.kind === 'registry' ? { kind: 'registry', chainId: entry.chainId } : { sessionId: text(entry.sessionId) }),
    });

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
    // A listed 404 is unread, including during its retry minute. A fetched
    // malformed/null payload is instead excluded by the normal record rules.
    if (now() - (ctx.missing.get(storageId) ?? -Infinity) < MISSING_RECORD_RETRY_MS) return undefined;
    try {
      const payload = await ctx.client.read(storageId);
      ctx.missing.delete(storageId);
      cacheRecord(ctx, storageId, payload);
      return payload;
    } catch (error) {
      if (!(error instanceof WorkerRequestError) || error.status !== 404) throw error;
      ctx.missing.set(storageId, now());
      if (ctx.missing.size > MAX_CACHED_RECORDS) ctx.missing.delete(ctx.missing.keys().next().value);
      return undefined;
    }
  };

  /** Records not reached or not readable come back undefined and keep the read incomplete. */
  const readMany = async (ctx, storageIds) => {
    const deadline = now() + READ_DEADLINE_MS;
    const payloads = await mapLimit(storageIds, READ_CONCURRENCY, async (storageId) => {
      if (!ctx.records.has(storageId) && (now() >= deadline || signal?.aborted)) return undefined;
      return readCached(ctx, storageId).catch(() => undefined);
    });
    const unread = payloads.filter(payload => payload === undefined).length;
    return { payloads, complete: unread === 0, unread };
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
    const blocked = idList(sessionConfig.BLOCKED_QUESTION_IDS);
    const rows = items.filter((item) => item.hidden !== true && text(item.storageRef?.id) &&
      !hidden.has(text(item.metadata?.resourceId).toLowerCase()) && !blocked.has(text(item.metadata?.resourceId).toLowerCase()));
    const { payloads, complete: readComplete, unread } = await readMany(ctx, rows.map((item) => text(item.storageRef.id)));
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
          createdAtMs: Date.parse(text(item.metadata?.createdAt)) || 0,
          storageRefId: text(item.storageRef.id),
          uploadAuthority: item.metadata?.uploadAuthority,
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
    questions.unread = unread;
    return questions;
  };

  const toEntries = async (ctx, items) => {
    const rows = items.filter((item) => item.hidden !== true && text(item.storageRef?.id));
    const { payloads, complete, unread } = await readMany(ctx, rows.map((item) => text(item.storageRef.id)));
    const entries = rows.map((item, index) => ({
      storageId: text(item.storageRef.id),
      createdAt: text(item.metadata?.createdAt) || text(item.storageRef?.createdAt),
      responder: text(item.metadata?.responder),
      payload: payloads[index],
    }));
    entries.complete = complete;
    entries.unread = unread;
    return entries;
  };

  // Listing your own answers scans the whole session's answer index, so one
  // scan is reused for a while; answers given since come from the local record.
  const scanMyAnswers = async (ctx) => {
    if (ctx.ownScan && ctx.ownScan.complete && now() - ctx.ownScan.at < OWN_ANSWER_SCAN_MAX_AGE_MS && ctx.ownScan.sessionId === ctx.client.sessionId && ctx.ownScan.windowKey === ctx.registry?.windowKey) {
      return ctx.ownScan;
    }
    if (ctx.registry) {
      const questions = await loadQuestions(ctx);
      const questionIds = new Set(questions.map((question) => question.id));
      const { entries, complete, chainOrders, unreadAnswers } = await ctx.registry.readAnswers({ questionIds, maxRecords: MAX_OWN_ANSWER_ITEMS, mine: true, signal });
      const latest = latestAnswersByQuestion(entries, { registryConfig: ctx.client.config, questionIds });
      const answers = new Map();
      latest.forEach((byResponder, id) => { if (byResponder.has(wallet.address.toLowerCase())) answers.set(id, byResponder.get(wallet.address.toLowerCase())); });
      ctx.ownScan = { at: now(), sessionId: ctx.client.sessionId, windowKey: ctx.registry.windowKey, answers, complete, chainOrders, unread: unreadAnswers };
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
    ctx.ownScan = { at: now(), sessionId: ctx.client.sessionId, answers, complete, unread: entries.unread };
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
      if (ctx.registry && (!scan.complete || !ctx.registry.containsBlock(answer.blockNumber))) continue;
      const known = mine.get(questionId);
      const chainOrder = scan.chainOrders?.get(questionId);
      if (ctx.registry && chainOrder && compareChainOrder(answer, chainOrder) < 0) continue;
      const newer = ctx.registry ? !known || compareChainOrder(answer, known) > 0 : !known || text(answer.answeredAt) > known.createdAt;
      // A remembered answer whose block a reorganization replaced was never answered.
      if (!newer) continue;
      const replaced = ctx.registry ? await ctx.registry.replacedWrite(answer, blocks) : false;
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
    mine.unread = scan.unread;
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
            testEth: await openEntry(entry).then((ctx) => ctx.client.describeTestEth())
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
        parsed = await resolveLink(link);
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
      // A listed Worker must serve the session the list names, as the browser checks, before any sign-in.
      if (parsed.listedSessionId && ctx.client.sessionId !== parsed.listedSessionId) {
        sessions.delete(sessionKey(parsed));
        throw new Error(
          `The Session Worker listed for "${parsed.slug}" answers for a different session, so it was not joined. ` +
            'Ask for the session’s link with worker=, the Worker’s address.',
        );
      }
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
      outcome.description = text(sessionConfig.sessionInfo).slice(0, MAX_DESCRIPTION_LENGTH);
      outcome.context = contextOf(sessionConfig);
      const instructions = instructionsOf(sessionConfig);
      if (instructions) outcome.agentInstructions = instructions;
      const sessionSbts = listSessionSbts(sessionConfig);
      if (sessionSbts.length) outcome.sessionSbts = sessionSbts;
      // The link's group is named, not joined, so the agent can read the session's instructions first.
      const linkGroup = ctx.registry ? '' : parsed.joinGroupId;
      if (!ctx.registry) {
        checkpoint();
        Object.assign(outcome, await describeGroups(ctx), await invitationFor(ctx, sessionConfig));
        if (linkGroup) outcome.linkGroup = linkGroup;
      }
      const member = outcome.groups
        ? outcome.groups.some((group) => group.member && group.groupId.toLowerCase() === linkGroup.toLowerCase())
        : null;
      outcome.next = nextStep({ instructions, linkGroup, member });
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
      const instructions = instructionsOf(sessionConfig);
      return {
        ...sessionSummary(ctx, sessionConfig),
        testEth: await ctx.client.describeTestEth(),
        description: text(sessionConfig.sessionInfo).slice(0, MAX_DESCRIPTION_LENGTH),
        context: contextOf(sessionConfig),
        ...(instructions ? { agentInstructions: instructions } : {}),
        ...(endsAt ? { endsAt } : {}),
        ...(sessionSbts.length ? { sessionSbts } : {}),
        ...(ctx.registry ? {} : await describeGroups(ctx)),
        ...(ctx.registry ? {} : await invitationFor(ctx, sessionConfig)),
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
      const loaded = await loadQuestions(ctx);
      const questions = new Map(loaded.map((question) => [question.id, question]));
      const recruitmentSource = text(sessionState(ctx).recruitmentSource);
      const results = [];
      const answered = [];
      const pendingAnswers = [];
      const operationId = randomUUID();
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
          // Some questions could not be read just now (a busy session), so this one may exist.
          results.push({ questionId, ok: false, error: loaded.complete === false
            ? 'This question could not be read just now; the session may be busy. Retry in a few seconds.'
            : 'Unknown question id, or a question locked to certain members; call list_questions.' });
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
          const data = JSON.stringify(built.record);
          const digest = createHash('sha256').update(data).digest('hex');
          let requestId;
          // A tool call can time out after storage succeeded. Keep its key before
          // sending, under the same wallet/session state lock as answer history.
          await saveState((fresh) => {
            const entry = fresh.sessions[sessionKey(ctx.info)];
            if (!isRecord(entry) || entry.sessionId !== ctx.client.sessionId) throw new Error('Session identity changed; join again before answering.');
            entry.pendingUploads = isRecord(entry.pendingUploads) ? entry.pendingUploads : {};
            const previous = entry.pendingUploads[questionId];
            requestId = previous?.payloadDigest === digest && trim(previous.requestId)
              ? previous.requestId : `answer:v1:${operationId}:${questionId}`;
            entry.pendingUploads[questionId] = { payloadDigest: digest, requestId };
          });
          checkpoint();
          const storageRef = await ctx.client.upload({ resource: 'responses', data, requestId, signal });
          if (text(storageRef?.id)) cacheRecord(ctx, text(storageRef.id), built.record);
          answered.push({ questionId, requestId, record: built.record, answeredAt: text(storageRef?.createdAt) || new Date(now()).toISOString() });
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
        const storageRef = await ctx.client.upload({ resource: 'questions', data: built.record, tags: tagList, signal });
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

    async getResults({ session, questionIds, maxRecords = MAX_RESULT_RECORDS } = {}) {
      const ctx = await resolveSession(session);
      const sessionConfig = await ensureReady(ctx);
      const visibility = sessionConfig?.sessionModeProfile?.results?.visibility;
      if (visibility !== PUBLIC_RESULTS && visibility !== MEMBER_RESULTS) {
        return {
          session: ctx.info.slug,
          resultsPublic: false,
          note: 'This session does not publish results to participants. Only your own answers are visible (see list_questions with filter "answered").',
        };
      }
      const cap = Math.min(Math.max(Number(maxRecords) || MAX_RESULT_RECORDS, 1), MAX_RESULT_RECORDS);
      const questions = await loadQuestions(ctx);
      const wanted = Array.isArray(questionIds) && questionIds.length ? idList(questionIds) : null;
      let entries;
      let complete;
      let listedCount;
      let unreadAnswers;
      const knownIds = new Set(questions.map((question) => question.id));
      if (ctx.registry) {
        const result = await ctx.registry.readAnswers({ questionIds: knownIds, maxRecords: cap, signal });
        entries = result.entries;
        complete = result.complete;
        listedCount = entries.length;
        unreadAnswers = result.unreadAnswers;
      } else {
        const result = await ctx.client.listAll('responses', { maxItems: MAX_RESULT_RECORDS, signal });
        const listed = result.items
          .filter((item) => text(item.storageRef?.id))
          .sort((left, right) => (text(left.metadata?.createdAt) < text(right.metadata?.createdAt) ? 1 : -1));
        entries = await toEntries(ctx, listed.slice(0, cap));
        complete = result.complete;
        listedCount = listed.length;
        unreadAnswers = entries.unread;
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
        resultsPublic: visibility === PUBLIC_RESULTS,
        ...(visibility === MEMBER_RESULTS ? { note: 'This session shows results to its signed-in members only.' } : {}),
        webUrl: buildSessionWebUrl(ctx.info),
        participants: participants.size,
        unreadAnswers,
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
      if (!GROUP_ID_RE.test(id)) throw new Error('Pass a valid group id.');
      checkpoint();
      await ctx.client.joinGroup(id, { signal }).catch((error) => {
        throw groupRefusal(error, id);
      });
      return { session: ctx.info.slug, joinedGroup: id };
    },

    async leaveGroup({ session, groupId } = {}) {
      const ctx = await resolveSession(session);
      if (ctx.registry) throw new Error('Worker groups are not available in on-chain sessions.');
      await ensureReady(ctx);
      const id = trim(groupId);
      if (!GROUP_ID_RE.test(id)) throw new Error('Pass a valid group id.');
      checkpoint();
      await ctx.client.leaveGroup(id, { signal }).catch((error) => {
        throw groupRefusal(error, id);
      });
      return { session: ctx.info.slug, leftGroup: id };
    },

    async addContext({ session, file, url, text: note, title, adminsOnly = false } = {}) {
      const given = { file, url, text: note };
      const chosen = Object.keys(given).filter((key) => given[key] !== undefined && given[key] !== '');
      if (chosen.length !== 1) throw new Error('Pass exactly one of file, url or text.');
      const [kind] = chosen;
      if (kind === 'file' && title !== undefined) throw new Error('A file keeps its own name; pass title only with url or text.');
      if (adminsOnly !== undefined && typeof adminsOnly !== 'boolean') throw new Error('adminsOnly must be true or false.');
      const ctx = await resolveSession(session);
      if (ctx.registry) throw new Error('Adding context isn’t available in on-chain sessions yet.');
      const sessionConfig = await ensureReady(ctx);
      if (!workerReadsContext(sessionConfig)) {
        throw new Error('This session keeps its files where its Session Worker can’t read them, so it takes no context.');
      }
      // The Worker decides; these say why before a file is read or a page fetched.
      let featuresUnread = false;
      if (!isSessionAdmin(ctx, sessionConfig)) {
        if (!participantsMayAddContext(sessionConfig)) throw new Error(CONTEXT_ADMINS_ONLY);
        if (hasEnded(sessionConfig)) throw new Error(CONTEXT_ENDED);
        const features = await ctx.client.readFeatures();
        featuresUnread = !features;
        if (features && !features.includes('participant_context_v1')) {
          throw new Error('This session’s Worker doesn’t take context from participants yet.');
        }
        if (kind === 'url' && features && !features.includes('participant_context_links_v1')) throw new Error(CONTEXT_NO_LINKS);
        if (kind === 'url' && !mayAddLinks(ctx, sessionConfig)) throw new Error(CONTEXT_NO_FETCH);
      }
      // Cleaned as the Worker requires, for links as for files and notes.
      const adderName = agentAdderName(profile().displayName);
      const visibleTo = adminsOnly ? 'the session’s admins' : 'everyone in the session';
      try {
        if (kind === 'url') {
          const link = checkContextLink({ url, title });
          checkpoint();
          const result = await ctx.client.contextAction({
            action: 'add-link',
            url: link.url,
            ...(link.title ? { title: link.title } : {}),
            adminsOnly,
            adder: CONTEXT_AGENT_ADDER,
            ...(adderName ? { adderName } : {}),
          }, { signal });
          const source = isRecord(result?.source) ? result.source : {};
          return { session: ctx.info.slug, added: 'link', id: text(source.id), url: link.url, title: text(source.title) || link.title, visibleTo };
        }
        const upload = kind === 'file' ? await readContextFile(file, { stateDir: config.stateDir }) : buildNote({ text: note, title });
        checkpoint();
        const storageRef = await ctx.client.uploadForm(contextUploadForm(upload, { adminsOnly, adderName }), { signal });
        return { session: ctx.info.slug, added: kind, id: text(storageRef?.id), name: upload.name, visibleTo };
      } catch (error) {
        throw contextRefusal(error, { olderLink: kind === 'url' && featuresUnread });
      }
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
