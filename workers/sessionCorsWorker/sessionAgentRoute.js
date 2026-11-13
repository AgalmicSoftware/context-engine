import {
  SESSION_AGENT_LIMITS, buildSessionAgentMessages, sessionAgentMinAnswers, sessionAgentSettingOf,
} from '../../shared/sessionAgent.mjs';
import { buildSessionEndedResponse } from '../shared/sessionLifecycle.mjs';
import { AI_MODEL_NOT_ALLOWED } from './aiRequestPolicy.js';
import { isModelAllowed, normalizeAiRequestPayload } from './aiRequestNormalization.js';
import { forEveryone, loadParticipantContextSources } from './contextSourceLoader.js';
import {
  evaluateResultsAnalysisViewerEligibility,
  loadWorkerCanonicalResultsAnalysisSource,
  readPublishedResultsAnalysisArtifact,
} from './resultsAnalysisGeneration.js';
import { canOptOut } from './sessionAgentOptOuts.js';
import { isListedResultsBuilder } from './resultsBuild.js';
import { callSessionConfigCoordinator } from './sessionConfigAuthority.js';
import {
  authorizeCloudflareStorageResourceRead,
  createRequesterAccessChecks,
  resolveSessionAdminAddresses,
} from './storageRouteExecution.js';

// POST /session-agent/status says how this person would be answered,
// POST /session-agent/ask answers one question, and POST /session-agent/opt-out
// turns the agent's use of their answers and files off or on. Each question
// judges who may ask afresh and gathers what the person's answer style may
// read; the page sends only the question.
export const SESSION_AGENT_PATHS = Object.freeze(['/session-agent/status', '/session-agent/ask', '/session-agent/opt-out']);
const OPT_OUTS_UNAVAILABLE = 'Who turned the Session Agent off couldn’t be read just now. Try again shortly.';

const callOptOutStore = (env, slug, operation, payload = {}) =>
  callSessionConfigCoordinator({ env, slug, path: `session-agent/${operation}`, ...payload });

const trim = (value) => (typeof value === 'string' ? value.trim() : '');
const lower = (value) => trim(value).toLowerCase();
const clip = (value, max) => (value.length <= max ? value : `${value.slice(0, Math.max(0, max - 1)).trimEnd()}…`);

const NOT_ADMITTED = {
  ok: false, status: 403, error: 'The Session Agent isn’t open to you in this session.', reason: 'session_agent_not_admitted',
};

const UNCHECKED = { ok: false, status: 503, error: 'Who may ask could not be checked just now. Try again shortly.' };

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
const resultsText = (artifact) => {
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
const readMemberAnswers = async ({ env, slug, config, optedOut, minAnswers = 1, deps }) => {
  const source = await (deps.loadWorkerCanonicalResultsAnalysisSource || loadWorkerCanonicalResultsAnalysisSource)({ env, slug, config });
  if (!source?.ok) return null;
  const byQuestion = new Map(source.snapshot.questions.map((question) => [
    question.id, { question: trim(question.prompt), scale: scaleText(question), counted: COUNTED_TYPES.has(question.type), answers: [] },
  ]));
  source.snapshot.responses.forEach((response) => {
    const from = source.participantAddresses?.get(response.participantId);
    const group = byQuestion.get(response.questionId);
    if (!group || !from || optedOut.has(from)) return;
    const given = (Array.isArray(response.answer) ? response.answer : [response.answer]).map(trim).filter(Boolean);
    const comment = trim(response.additional);
    const answer = group.counted
      ? { choices: given, text: comment }
      : { choices: [], text: [given.join('; '), comment].filter(Boolean).join(' — ') };
    if (answer.choices.length || answer.text) group.answers.push(answer);
  });
  return [...byQuestion.values()].filter((group) => group.answers.length >= minAnswers)
    .map(({ question, scale, answers }) => ({ question, ...(scale ? { scale } : {}), answers }));
};

// What each style reads, decided here and nowhere else. General: the
// session's context, the files open to everyone, and results the person may
// see. Detailed: every file they may read, and members' answers as well.
// Neither reads the answers or files of anyone who opted out; the published
// results, built from everyone's answers, are read as the Results page shows them.
const gatherMaterial = async ({ env, slug, config, setting, address, scopes, asker, access, optedOut, deps }) => {
  const detailed = asker.answers === 'detailed';
  const [sources, results, answers] = await Promise.all([
    loadParticipantContextSources({
      env, slug, config, deps, principal: lower(address), leaveOutUploaders: optedOut,
      // A General asker reads the files open to everyone the session admits;
      // each read checks the session's own gate again, as a file read does.
      readable: detailed ? access.canRead : async (row) => forEveryone(row, config) && access.canRead(row),
    }),
    readVisibleResults({ env, slug, config, address, scopes, deps }),
    detailed ? readMemberAnswers({
      env, slug, config, optedOut, deps, minAnswers: asker.audience === 'admin' ? 1 : sessionAgentMinAnswers(setting),
    }) : [],
  ]);
  return { material: { sessionContext: config?.sessionContext, sources, results, answers: answers || [] }, answersUnavailable: answers === null };
};

// A price for an audience will be checked here, refusing with 402 until it
// is paid. It runs after the material is fixed, so paying never widens it.
const checkSessionAgentPayment = async () => ({ ok: true });

const PROXIES = { anthropic: 'proxyAnthropic', openai: 'proxyOpenAI', openrouter: 'proxyOpenRouter', custom: 'proxyCustomRPC' };

const askAi = async ({ messages, config, secrets, address, scopes, headers, deps }) => {
  const request = (deps.normalizeAiRequestPayload || normalizeAiRequestPayload)({
    payload: { taskType: 'session-agent', messages, max_tokens: 3000, max_output_tokens: 3000 },
    config,
  });
  const { provider, payload } = request;
  if (!isModelAllowed(payload.model, provider)) return { ok: false, status: 403, body: AI_MODEL_NOT_ALLOWED };
  const proxy = deps[PROXIES[provider]];
  if (!proxy) return { ok: false, status: 503, body: { error: 'The session’s AI provider can’t answer the Session Agent.' } };
  const response = await proxy({
    payload, config, secrets, baseHeaders: headers, ...(provider === 'custom' ? { auth: { address, scopes } } : {}),
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

const accessFor = ({ env, config, slug, address, scopes, deps }) =>
  createRequesterAccessChecks({ env, config, slug, requesterAddress: address, authScopes: scopes, deps });

export const dispatchSessionAgentRoute = async ({ path, body, config, slug, address, env, limit, headers, scopes, deps } = {}) => {
  const json = (payload, status = 200) => deps.json(payload, status, headers);
  const setting = sessionAgentSettingOf(config?.sessionAgent);
  const store = deps.callSessionAgentOptOutStore || callOptOutStore;
  if (path === '/session-agent/opt-out') {
    const saved = await store(env, slug, 'set', { address, optedOut: body?.optedOut });
    if (!saved.ok) return json({ error: saved.status === 400 ? saved.body?.error : OPT_OUTS_UNAVAILABLE }, saved.status === 400 ? 400 : 503);
    return json({ optedOut: saved.body.optedOut });
  }
  if (!setting) {
    return path === '/session-agent/status'
      ? json({ on: false, answers: null, audience: null })
      : json({ error: 'This session has no Session Agent.', reason: 'session_agent_off' }, 403);
  }
  // An ended session, or one with AI off, answers no one, so status says so too.
  const ended = buildSessionEndedResponse({ config, headers, json: deps.json, now: deps.now });
  if (ended) return ended;
  if (config?.scopes?.ai === false) return json({ error: 'AI is turned off for this session.', reason: 'ai_disabled' }, 403);
  // Status only decides what the page shows, so it reads the sign-in's
  // scopes; each question checks them afresh before anything is read.
  if (path === '/session-agent/status') {
    const [asker, own] = await Promise.all([
      resolveAsker({
        setting, config, address, aiScope: scopes?.ai === true, access: accessFor({ env, config, slug, address, scopes, deps }),
      }),
      canOptOut(address) ? store(env, slug, 'read', { address }) : { ok: true, body: { optedOut: false } },
    ]);
    if (!asker.ok && asker.status === 503) return json({ error: asker.error }, 503);
    if (!own.ok) return json({ error: OPT_OUTS_UNAVAILABLE }, 503);
    return json({
      on: true, answers: asker.ok ? asker.answers : null, audience: asker.ok ? asker.audience : null, optedOut: own.body.optedOut === true,
    });
  }

  const question = trim(body?.question);
  if (!question) return json({ error: 'Ask a question.' }, 400);
  if (question.length > SESSION_AGENT_LIMITS.questionChars) {
    return json({ error: `A question can be at most ${SESSION_AGENT_LIMITS.questionChars} characters.` }, 400);
  }
  // The /ai route's checks: the current AI scope, which every asker needs,
  // then its rate limit.
  const preflight = await deps.evaluateAuthenticatedRoutePreflight({
    scopes, scope: 'ai', route: 'ai', allowWithoutScope: true, config, env, slug, address, limit, headers,
    deps: { checkRateLimit: deps.checkRateLimit, computeScopesForLogin: deps.computeScopesForLogin, json: deps.json },
  });
  if (!preflight?.ok) return preflight?.response || json({ error: 'Current authorization check failed.' }, 403);
  const currentScopes = { ...scopes, ai: preflight.tokenHasScope === true };
  const access = accessFor({ env, config, slug, address, scopes: currentScopes, deps });
  const asker = await resolveAsker({ setting, config, address, aiScope: preflight.tokenHasScope === true, access });
  if (!asker.ok) return json({ error: asker.error, ...(asker.reason ? { reason: asker.reason } : {}) }, asker.status);
  const secretContext = await deps.resolveAuthenticatedRouteSecrets({
    env, slug, headers, deps: { getSessionSecrets: deps.getSessionSecrets, json: deps.json },
  });
  // Missing secrets come back as a 401, which the page would take for its sign-in.
  if (!secretContext?.ok) return json({ error: 'The session’s AI isn’t set up.' }, 503);

  // Who opted out is read on every question, so no answer goes ahead without it.
  const optOuts = await store(env, slug, 'list');
  if (!optOuts.ok) return json({ error: OPT_OUTS_UNAVAILABLE }, 503);
  const optedOut = new Set(optOuts.body.addresses);
  const { material, answersUnavailable } = await gatherMaterial({
    env, slug, config, setting, address, scopes: currentScopes, asker, access, optedOut, deps,
  });
  const payment = await (deps.checkSessionAgentPayment || checkSessionAgentPayment)({ audience: asker.audience, answers: asker.answers });
  if (!payment?.ok) return json({ error: payment?.error || 'This answer needs payment first.', reason: 'session_agent_payment_required' }, 402);
  const { messages, read } = buildSessionAgentMessages({ setting, style: asker.answers, question, material });
  const reply = await askAi({ messages, config, secrets: secretContext.secrets, address, scopes: currentScopes, headers, deps });
  if (!reply.ok) return json(reply.body, reply.status);
  return json({
    answer: reply.answer,
    answers: asker.answers,
    audience: asker.audience,
    read,
    ...(answersUnavailable ? { note: 'Members’ answers couldn’t be read for this answer.' } : {}),
  });
};
