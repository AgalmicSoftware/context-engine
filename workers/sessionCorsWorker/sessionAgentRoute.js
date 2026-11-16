import {
  SESSION_AGENT_LIMITS, buildSessionAgentMessages, sessionAgentMinAnswers, sessionAgentOpenToAnyone, sessionAgentSettingOf,
  sessionAgentStoresChats,
} from '../../shared/sessionAgent.mjs';
import { namesSomeone } from '../../shared/sessionAgentExport.mjs';
import { buildSessionEndedResponse } from '../shared/sessionLifecycle.mjs';
import { AI_MODEL_NOT_ALLOWED } from './aiRequestPolicy.js';
import { proxyWorkersAi } from './aiProviderExecution.js';
import { WORKERS_AI_PROVIDER } from '../../shared/workersAiModels.mjs';
import { isModelAllowed, normalizeAiRequestPayload } from './aiRequestNormalization.js';
import { CONTEXT_READ_LIMITS, forEveryone, loadParticipantContextSources } from './contextSourceLoader.js';
import {
  evaluateResultsAnalysisViewerEligibility,
  loadWorkerCanonicalResultsAnalysisSource,
  readPublishedResultsAnalysisArtifact,
} from './resultsAnalysisGeneration.js';
import { canOptOut } from './sessionAgentOptOuts.js';
import { isListedResultsBuilder } from './resultsBuild.js';
import { callSessionConfigCoordinator } from './sessionConfigAuthority.js';
import { resolveAiDailyLimit } from './aiRateLimitPolicy.js';
import { resolveAnonymousIpDailyLimit } from './anonymousRateLimitPolicy.js';
import { RESULTS_ANALYSIS_SCAN_LIMITS } from './storageScanBudget.js';
import {
  authorizeCloudflareStorageResourceRead,
  createRequesterAccessChecks,
  resolveSessionAdminAddresses,
} from './storageRouteExecution.js';

// POST /session-agent/status says how this person would be answered,
// POST /session-agent/ask answers one question, and POST /session-agent/opt-out
// turns the agent's use of their answers and files off or on. Each question
// judges who may ask afresh and gathers what the person's answer style may
// read; the page sends the question and, where the session stores chats,
// whether to store this one, with the asker's address or without, and a name.
export const SESSION_AGENT_PATHS = Object.freeze([
  '/session-agent/status', '/session-agent/ask', '/session-agent/opt-out', '/session-agent/attribution',
]);
const OPT_OUTS_UNAVAILABLE = 'Who turned the Session Agent off couldn’t be read just now. Try again shortly.';

const callOptOutStore = (env, slug, operation, payload = {}) =>
  callSessionConfigCoordinator({ env, slug, path: `session-agent/${operation}`, ...payload });

/** The session's stored chats, in its coordinator: `add`, `list`, `all` and `delete`. */
export const callSessionAgentHistoryStore = (env, slug, operation, payload = {}) =>
  callSessionConfigCoordinator({ env, slug, path: `session-agent-history/${operation}`, ...payload });

const trim = (value) => (typeof value === 'string' ? value.trim() : '');
const lower = (value) => trim(value).toLowerCase();
const clip = (value, max) => (value.length <= max ? value : `${value.slice(0, Math.max(0, max - 1)).trimEnd()}…`);

const NOT_ADMITTED = {
  ok: false, status: 403, error: 'The Session Agent isn’t open to you in this session.', reason: 'session_agent_not_admitted',
};

const UNCHECKED = { ok: false, status: 503, error: 'Who may ask could not be checked just now. Try again shortly.' };

// Asking without signing in spends the session's AI for people it can't
// name, so it is bounded twice a day: by network address, and for the session
// as a whole whatever addresses the questions come from.
export const SESSION_AGENT_SIGNED_OUT = Object.freeze({ perNetworkPerDay: 10, perSessionPerDay: 300, bodyBytes: 4096 });
const SIGN_IN_TO_ASK = { error: 'Sign in to ask the Session Agent.', reason: 'session_agent_sign_in_required' };
const SIGNED_OUT_LIMIT = {
  error: 'The Session Agent has answered all it can today for people who aren’t signed in. Sign in to ask, or try again tomorrow.',
  reason: 'session_agent_signed_out_limit',
};

// Counts one signed-out question against both limits; a response when either
// is used up or can't be counted, otherwise nothing. Both are the Session
// Agent's own counts, apart from the session's other signed-out AI use, so
// neither can use up the other. The session's own daily limit for a network
// address that isn't signed in, when it sets one, lowers the ten.
const countSignedOutQuestion = async ({ env, slug, config, identity, deps, json }) => {
  const own = resolveAnonymousIpDailyLimit(config);
  for (const [address, limit, route] of [
    [identity, own > 0 ? Math.min(own, SESSION_AGENT_SIGNED_OUT.perNetworkPerDay) : SESSION_AGENT_SIGNED_OUT.perNetworkPerDay, 'session-agent-signed-out'],
    ['anon:everyone', SESSION_AGENT_SIGNED_OUT.perSessionPerDay, 'session-agent-signed-out-all'],
  ]) {
    const allowed = await deps.checkRateLimit({ env, slug, address, limit, route });
    if (allowed === null) return json({ error: UNCHECKED.error }, 503);
    if (!allowed) return json(SIGNED_OUT_LIMIT, 429);
  }
  return null;
};

// Everyone who asks needs the session's AI access, as on the /ai route.
// Admins, as the config names them now, then get Detailed answers. Anyone
// else must pass the session's own gate, so the agent is never open to
// someone the session keeps out, whatever the audiences say; then the first
// audience that admits them sets their answers. An outage before a match
// leaves the answer unknown, so it refuses.
const resolveAsker = async ({ setting, config, address, aiScope, access }) => {
  if (!aiScope) return NOT_ADMITTED;
  if (resolveSessionAdminAddresses(config).has(lower(address))) {
    return { ok: true, answers: 'detailed', audience: 'admin' };
  }
  const gate = await access.sessionGate();
  if (!gate.ok) return gate.unavailable ? UNCHECKED : NOT_ADMITTED;
  for (const [index, audience] of setting.audiences.entries()) {
    const result = await access.admits(audience.who);
    if (result.outcome === 'unavailable') return UNCHECKED;
    if (result.ok) return { ok: true, answers: audience.answers, audience: index };
  }
  return NOT_ADMITTED;
};

// The published results analysis as lines of plain text, without IDs.
const TEXT_FIELDS = ['overview', 'title', 'label', 'summary', 'description'];
export const resultsText = (artifact) => {
  const lines = [];
  const walk = (value) => {
    if (Array.isArray(value)) return value.forEach(walk);
    if (!value || typeof value !== 'object' || value.available === false) return undefined;
    const own = TEXT_FIELDS.map((field) => trim(value[field])).filter(Boolean);
    if (own.length) lines.push(own.join(': '));
    return Object.values(value).forEach(walk);
  };
  walk(artifact?.sections);
  return lines.join('\n');
};

// Results reach an answer only for those who may see them on the page:
// viewers under the rule AI Views follow, and anyone listed to build results
// (admins and results admins) on any session.
const readVisibleResults = async ({ env, slug, config, address, scopes, deps }) => {
  if (!isListedResultsBuilder(config, address)) {
    if (!(deps.evaluateResultsAnalysisViewerEligibility || evaluateResultsAnalysisViewerEligibility)({ config })?.ok) return '';
    for (const resource of ['generatedArtifacts', 'questions', 'responses']) {
      const access = await (deps.authorizeCloudflareStorageResourceRead || authorizeCloudflareStorageResourceRead)({
        env, config, slug, resource, requesterAddress: address, authScopes: scopes, deps,
      });
      if (!access?.ok) return '';
    }
  }
  try {
    const published = await (deps.readPublishedResultsAnalysisArtifact || readPublishedResultsAnalysisArtifact)({
      env, slug, config, includeSnapshot: false, deps,
    });
    return published?.ok ? resultsText(published.artifact) : '';
  } catch {
    return '';
  }
};

// Every member's answer by question, as the session's own analysis reads them:
// latest per person, withheld and locked answers left out, with no names.
// Only answers from an address that hasn't opted out are used; one without an
// address couldn't have said either way, so it stays out. An answer to a
// question with set options is the options chosen, which the prompt counts;
// any other answer is what the person wrote.
const COUNTED_TYPES = new Set(['binary', 'rating', 'multichoice']);
// What a rating's numbers mean, such as "1 (Strongly agree) to 5 (Strongly disagree)".
const scaleText = ({ scale } = {}) => {
  if (!scale) return '';
  const end = (value, label) => (trim(label) && trim(label) !== String(value) ? `${value} (${trim(label)})` : `${value}`);
  return `${end(scale.min, scale.minLabel)} to ${end(scale.max, scale.maxLabel)}`;
};
// Someone who is not an admin gets nothing from a question fewer than
// `minAnswers` members answered: a count of one, or the one answer left when
// the asker keeps their own out, would be a single person's answer.
// The answer is `{ groups, questions, leftOut }`: the session's questions as
// its analysis reads them, and how many answers stayed out because their
// author opted out, how many because they have no address to opt out with,
// and how many questions for having too few answers.
export const TOO_MANY_STORED = Symbol('too many stored versions');
// With `writers`, each answer also says whose it is (`from`), for an export
// that shows it; the agent's own answers are never given that.
export const readMemberAnswers = async ({ env, slug, config, optedOut, minAnswers = 1, writers = false, deps }) => {
  const source = await (deps.loadWorkerCanonicalResultsAnalysisSource || loadWorkerCanonicalResultsAnalysisSource)({ env, slug, config });
  if (!source?.ok) return source?.reason === 'results_analysis_snapshot_limit' ? TOO_MANY_STORED : null;
  const leftOut = { optedOut: 0, withoutAddress: 0, belowMinAnswers: 0 };
  const questions = source.snapshot.questions.map((question) => ({ ...question, scale: scaleText(question) }));
  const byQuestion = new Map(questions.map((question) => [
    question.id, { question: trim(question.prompt), scale: question.scale, counted: COUNTED_TYPES.has(question.type), answers: [] },
  ]));
  source.snapshot.responses.forEach((response) => {
    const from = source.participantAddresses?.get(response.participantId);
    const group = byQuestion.get(response.questionId);
    if (!group) return;
    if (!from) {
      leftOut.withoutAddress += 1;
      return;
    }
    if (optedOut.has(from)) {
      leftOut.optedOut += 1;
      return;
    }
    const given = (Array.isArray(response.answer) ? response.answer : [response.answer]).map(trim).filter(Boolean);
    const comment = trim(response.additional);
    const answer = group.counted
      ? { choices: given, text: comment }
      : { choices: [], text: [given.join('; '), comment].filter(Boolean).join(' — ') };
    if (answer.choices.length || answer.text) group.answers.push(writers ? { ...answer, from } : answer);
  });
  const answered = [...byQuestion.values()].filter((group) => group.answers.length);
  const kept = answered.filter((group) => group.answers.length >= minAnswers);
  leftOut.belowMinAnswers = answered.length - kept.length;
  return {
    groups: kept.map(({ question, scale, answers }) => ({ question, ...(scale ? { scale } : {}), answers })),
    questions,
    leftOut,
  };
};

// What each style reads, decided here and nowhere else. General: the
// session's context, the files open to everyone, and results the person may
// see. Detailed: every file they may read, and members' answers as well.
// Neither reads the answers or files of anyone who opted out; the published
// results, built from everyone's answers, are read as the Results page shows them.
const gatherMaterial = async ({ env, slug, config, setting, address, scopes, asker, access, optedOut, deps }) => {
  const detailed = asker.answers === 'detailed';
  const [context, results, answers] = await Promise.all([
    loadParticipantContextSources({
      env, slug, config, deps, principal: lower(address), leaveOutUploaders: optedOut, totalChars: SESSION_AGENT_LIMITS.contextChars,
      // A General asker reads the files open to everyone the session admits;
      // each read checks the session's own gate again, as a file read does.
      readable: detailed ? access.canRead : async (row) => forEveryone(row, config) && access.canRead(row),
    }),
    readVisibleResults({ env, slug, config, address, scopes, deps }),
    detailed ? readMemberAnswers({
      env, slug, config, optedOut, deps, minAnswers: asker.audience === 'admin' ? 1 : sessionAgentMinAnswers(setting),
    }) : { groups: [] },
  ]);
  return {
    material: { sessionContext: config?.sessionContext, sources: context.sources, results, answers: answers?.groups || [] },
    answersUnavailable: answers === TOO_MANY_STORED ? 'too_many' : answers === null,
    contextLeftOut: context.leftOut,
    // The groups whose locked files this answer may draw on.
    lockedTo: [...new Set(context.sources.filter((source) => !source.everyone).flatMap((source) => source.groupIds))].sort(),
  };
};

// A price for an audience will be checked here, refusing with 402 until it
// is paid. It runs after the material is fixed, so paying never widens it.
const checkSessionAgentPayment = async () => ({ ok: true });

const PROXIES = { anthropic: 'proxyAnthropic', openai: 'proxyOpenAI', openrouter: 'proxyOpenRouter', custom: 'proxyCustomRPC', 'workers-ai': 'proxyWorkersAi' };
// Workers AI calls the Worker's own binding, so it needs no wiring through deps.
const DIRECT_PROXIES = { 'workers-ai': proxyWorkersAi };

const sessionAgentRequest = ({ messages, config, deps }) => (deps.normalizeAiRequestPayload || normalizeAiRequestPayload)({
  payload: { taskType: 'session-agent', messages, max_tokens: 3000, max_output_tokens: 3000 },
  config,
});

// The provider a question would go to. A session's own AI endpoint takes no
// request from someone who isn't signed in, here as on the Worker's other routes.
const answersSignedOut = ({ config, deps }) => sessionAgentRequest({ messages: [], config, deps }).provider !== 'custom';

const askAi = async ({ messages, config, secrets, address, scopes, env, headers, deps }) => {
  const { provider, payload } = sessionAgentRequest({ messages, config, deps });
  if (!isModelAllowed(payload.model, provider)) return { ok: false, status: 403, body: AI_MODEL_NOT_ALLOWED };
  const proxy = deps[PROXIES[provider]] || DIRECT_PROXIES[provider];
  if (!proxy) return { ok: false, status: 503, body: { error: 'The session’s AI provider can’t answer the Session Agent.' } };
  const response = await proxy({
    payload, config, secrets, env, baseHeaders: headers, ...(provider === 'custom' ? { auth: { address, scopes } } : {}),
  });
  const data = await response.json().catch(() => ({}));
  // Provider errors never reach the page as they are, and never as a 401,
  // which the page would take for its own sign-in failing.
  if (!response.ok) {
    return response.status === 429
      ? { ok: false, status: 429, body: { error: 'The session’s AI is busy. Try again shortly.' } }
      : { ok: false, status: 502, body: { error: 'The session’s AI couldn’t answer. Try again.' } };
  }
  const answer = clip(trim(data?.completion), SESSION_AGENT_LIMITS.answerChars);
  return answer ? { ok: true, answer } : { ok: false, status: 502, body: { error: 'The Session Agent gave no answer. Try again.' } };
};

// What the asker wants kept of this exchange: nothing unless the session
// stores chats and they asked for it, and their address only if they chose it.
const storeRequestOf = ({ body, setting, address }) => {
  const { store, attribution, name } = body || {};
  if (store !== undefined && typeof store !== 'boolean') return { error: 'Say whether to store this chat.' };
  if (attribution !== undefined && !['address', 'anonymous'].includes(attribution)) {
    return { error: 'A stored chat carries your address or no address.' };
  }
  if (name !== undefined && typeof name !== 'string') return { error: 'A name must be text.' };
  if (trim(name).length > SESSION_AGENT_LIMITS.nameChars) {
    return { error: `A name can be at most ${SESSION_AGENT_LIMITS.nameChars} characters.` };
  }
  if (!sessionAgentStoresChats(setting) || store !== true) return { keep: false };
  return { keep: true, by: attribution === 'address' && canOptOut(address) ? lower(address) : '', name: trim(name) };
};

// Stores one exchange the asker asked to keep. A question that may name
// someone is answered but not kept, and a failed write never fails the answer.
// The entry says whom the answer was fit for, because an answer can hold what
// only they may read: an admin's or results admin's (admins-only context,
// thinly answered questions, results not yet open), or a group's locked files.
const storeExchange = async ({ env, slug, request, question, reply, style, adminOnly, lockedTo, signedOut, deps }) => {
  if (namesSomeone(question)) return { stored: false, why: 'This chat wasn’t stored: the question holds an address, an email or a long number.' };
  const entry = {
    day: new Date(deps.now?.() ?? Date.now()).toISOString().slice(0, 10),
    answers: style,
    question,
    answer: reply,
    ...(adminOnly ? { scope: 'admin' } : {}),
    ...(!adminOnly && lockedTo.length ? { groups: lockedTo } : {}),
    // So an admin can tell a visitor's chats from members' with no address.
    ...(signedOut ? { signedOut: true } : {}),
    ...(request.by ? { by: request.by } : {}),
    ...(request.name ? { name: request.name } : {}),
  };
  let saved = null;
  try {
    saved = await (deps.callSessionAgentHistoryStore || callSessionAgentHistoryStore)(env, slug, 'add', { entry });
  } catch {
    saved = null;
  }
  if (saved?.ok) return { stored: true };
  return saved?.body?.reason === 'session_agent_history_off'
    ? { stored: false, why: 'This chat wasn’t stored: the session no longer records chats.' }
    : { stored: false, why: 'This chat couldn’t be stored just now.' };
};

const accessFor = ({ env, config, slug, address, scopes, deps }) =>
  createRequesterAccessChecks({ env, config, slug, requesterAddress: address, authScopes: scopes, deps });

// `signedOut` is `{ identity }` for someone not signed in: `address` is then
// empty and `scopes` are those a first sign-in would be given. They are
// admitted as that sign-in would be, get General answers whatever the audience
// says, and have no switches.
export const dispatchSessionAgentRoute = async ({ path, body, config, slug, address, env, headers, scopes, deps, signedOut = null } = {}) => {
  const json = (payload, status = 200) => deps.json(payload, status, headers);
  const setting = sessionAgentSettingOf(config?.sessionAgent);
  const store = deps.callSessionAgentOptOutStore || callOptOutStore;
  if (signedOut && (path === '/session-agent/opt-out' || path === '/session-agent/attribution')) {
    return json({ error: 'Sign in to change this.', reason: 'session_agent_sign_in_required' }, 401);
  }
  const openToThem = !signedOut || (sessionAgentOpenToAnyone(setting) && answersSignedOut({ config, deps }));
  if (path === '/session-agent/opt-out') {
    const saved = await store(env, slug, 'set', { address, optedOut: body?.optedOut });
    if (!saved.ok) return json({ error: saved.status === 400 ? saved.body?.error : OPT_OUTS_UNAVAILABLE }, saved.status === 400 ? 400 : 503);
    return json({ optedOut: saved.body.optedOut });
  }
  // Whether exports may show this person's address beside what they wrote and added.
  if (path === '/session-agent/attribution') {
    const saved = await store(env, slug, 'set-unattributed', { address, unattributed: body?.unattributed });
    if (!saved.ok) return json({ error: saved.status === 400 ? saved.body?.error : OPT_OUTS_UNAVAILABLE }, saved.status === 400 ? 400 : 503);
    return json({ unattributed: saved.body.unattributed });
  }
  if (!setting) {
    return path === '/session-agent/status'
      ? json({ on: false, answers: null, audience: null })
      : json({ error: 'This session has no Session Agent.', reason: 'session_agent_off' }, 403);
  }
  // An ended session, or one with AI off, answers no one. Status still
  // answers, saying why in `closed`: each person's two switches stay theirs to
  // set for as long as the session's material can be exported.
  const ended = buildSessionEndedResponse({ config, headers, json: deps.json, now: deps.now });
  const aiOff = config?.scopes?.ai === false;
  // Status only decides what the page shows, so it reads the sign-in's
  // scopes; each question checks them afresh before anything is read.
  if (path === '/session-agent/status') {
    const closed = ended ? 'session_ended' : aiOff ? 'ai_disabled' : '';
    const [asker, own] = await Promise.all([
      closed || !openToThem ? { ok: false } : resolveAsker({
        setting, config, address, aiScope: scopes?.ai === true, access: accessFor({ env, config, slug, address, scopes, deps }),
      }),
      canOptOut(address) ? store(env, slug, 'read', { address }) : { ok: true, body: {} },
    ]);
    if (!asker.ok && asker.status === 503) return json({ error: asker.error }, 503);
    if (!own.ok) return json({ error: OPT_OUTS_UNAVAILABLE }, 503);
    return json({
      on: true,
      answers: asker.ok ? (signedOut ? 'general' : asker.answers) : null,
      audience: asker.ok ? asker.audience : null,
      optedOut: own.body.optedOut === true,
      // Only someone signed in with an address has an address to leave off.
      ...(canOptOut(address) ? { unattributed: own.body.unattributed === true } : {}),
      recording: sessionAgentStoresChats(setting),
      ...(closed ? { closed } : {}),
      ...(signedOut ? { signedOut: true } : {}),
    });
  }
  if (ended) return ended;
  if (aiOff) return json({ error: 'AI is turned off for this session.', reason: 'ai_disabled' }, 403);

  const question = trim(body?.question);
  if (!question) return json({ error: 'Ask a question.' }, 400);
  if (question.length > SESSION_AGENT_LIMITS.questionChars) {
    return json({ error: `A question can be at most ${SESSION_AGENT_LIMITS.questionChars} characters.` }, 400);
  }
  const storeRequest = storeRequestOf({ body, setting, address });
  if (storeRequest.error) return json({ error: storeRequest.error }, 400);
  let currentScopes = scopes;
  let asker = null;
  let countQuestion = null;
  if (signedOut) {
    // Admitted as a first sign-in would be, and only for General answers.
    if (!openToThem) return json(SIGN_IN_TO_ASK, 401);
    asker = await resolveAsker({
      setting, config, address, aiScope: scopes?.ai === true, access: accessFor({ env, config, slug, address, scopes, deps }),
    });
    // Signing in may admit them, through a group or an SBT, where this could not.
    if (!asker.ok) return asker.status === 503 ? json({ error: asker.error }, 503) : json(SIGN_IN_TO_ASK, 401);
    asker = { ...asker, answers: 'general' };
    countQuestion = () => countSignedOutQuestion({ env, slug, config, identity: signedOut.identity, deps, json });
  } else {
    // The /ai route's checks: the current AI scope, which every asker needs,
    // then its rate limit, counted once nothing below can refuse the question.
    const preflight = await deps.evaluateAuthenticatedRoutePreflight({
      scopes, scope: 'ai', route: 'ai', allowWithoutScope: true, config, env, slug, address, limit: resolveAiDailyLimit(config), headers,
      deps: { checkRateLimit: deps.checkRateLimit, computeScopesForLogin: deps.computeScopesForLogin, json: deps.json },
      countLater: true,
    });
    if (!preflight?.ok) return preflight?.response || json({ error: 'Current authorization check failed.' }, 403);
    currentScopes = { ...scopes, ai: preflight.tokenHasScope === true };
    asker = await resolveAsker({
      setting, config, address, aiScope: preflight.tokenHasScope === true, access: accessFor({ env, config, slug, address, scopes: currentScopes, deps }),
    });
    if (!asker.ok) return json({ error: asker.error, ...(asker.reason ? { reason: asker.reason } : {}) }, asker.status);
    countQuestion = () => preflight.count?.();
  }
  const access = accessFor({ env, config, slug, address, scopes: currentScopes, deps });
  const secretContext = await deps.resolveAuthenticatedRouteSecrets({
    env, slug, headers, deps: { getSessionSecrets: deps.getSessionSecrets, json: deps.json },
  });
  // Missing secrets come back as a 401, which the page would take for its sign-in.
  // Cloudflare's models need no key, so a session answering on them needs none stored.
  const keyless = sessionAgentRequest({ messages: [], config, deps }).provider === WORKERS_AI_PROVIDER;
  if (!secretContext?.ok && !keyless) return json({ error: 'The session’s AI isn’t set up.' }, 503);

  // Who opted out is read on every question, so no answer goes ahead without it.
  const optOuts = await store(env, slug, 'list');
  if (!optOuts.ok) return json({ error: OPT_OUTS_UNAVAILABLE }, 503);
  const refused = await countQuestion();
  if (refused) return refused;
  const optedOut = new Set(optOuts.body.addresses);
  const { material, answersUnavailable, contextLeftOut, lockedTo } = await gatherMaterial({
    env, slug, config, setting, address, scopes: currentScopes, asker, access, optedOut, deps,
  });
  const payment = await (deps.checkSessionAgentPayment || checkSessionAgentPayment)({ audience: asker.audience, answers: asker.answers });
  if (!payment?.ok) return json({ error: payment?.error || 'This answer needs payment first.', reason: 'session_agent_payment_required' }, 402);
  const { messages, read, contextOmitted } = buildSessionAgentMessages({ setting, style: asker.answers, question, material });
  const reply = await askAi({ messages, config, secrets: secretContext?.ok ? secretContext.secrets : {}, address, scopes: currentScopes, env, headers, deps });
  if (!reply.ok) return json(reply.body, reply.status);
  const kept = storeRequest.keep
    ? await storeExchange({
      env, slug, request: storeRequest, question, reply: reply.answer, style: asker.answers, lockedTo, deps, signedOut: !!signedOut,
      adminOnly: asker.audience === 'admin' || isListedResultsBuilder(config, address),
    })
    : null;
  const notes = [
    answersUnavailable === 'too_many'
      ? `Members’ answers weren’t read: this session stores more than ${RESULTS_ANALYSIS_SCAN_LIMITS.rows.toLocaleString('en-US')} question and answer versions, the most the Session Agent can read at once.`
      : answersUnavailable ? 'Members’ answers couldn’t be read for this answer.' : '',
    contextLeftOut > 0 || contextOmitted > 0
      ? `Some of the session’s context wasn’t read: the Session Agent reads at most ${SESSION_AGENT_LIMITS.contextChars.toLocaleString('en-US')} characters or ${CONTEXT_READ_LIMITS.sources} items of it.`
      : '',
    kept?.why || '',
  ].filter(Boolean);
  return json({
    answer: reply.answer,
    answers: asker.answers,
    audience: asker.audience,
    read,
    // Said whenever the session stores chats, so an asker knows what became of this one.
    ...(sessionAgentStoresChats(setting) ? { stored: kept?.stored === true } : {}),
    ...(notes.length ? { note: notes.join(' ') } : {}),
  });
};
