import { GROUP_AGENT_LIMITS, buildGroupAgentMessages, groupAgentSettingOf } from '../../shared/groupAgent.mjs';
import { buildSessionEndedResponse } from '../shared/sessionLifecycle.mjs';
import { AI_MODEL_NOT_ALLOWED } from './aiRequestPolicy.js';
import { isModelAllowed, normalizeAiRequestPayload } from './aiRequestNormalization.js';
import { loadParticipantContextSources } from './contextSourceLoader.js';
import {
  evaluateResultsAnalysisViewerEligibility,
  loadWorkerCanonicalResultsAnalysisSource,
  readPublishedResultsAnalysisArtifact,
} from './resultsAnalysisGeneration.js';
import {
  authorizeCloudflareStorageResourceRead,
  createRequesterAccessChecks,
  resolveSessionAdminAddresses,
} from './storageRouteExecution.js';

// POST /group-agent/status says how this person would be answered, and
// POST /group-agent/ask answers one question. Each request judges who may ask
// afresh and gathers what the person's answer style may read; the page sends
// only the question.
export const GROUP_AGENT_PATHS = Object.freeze(['/group-agent/status', '/group-agent/ask']);

const trim = (value) => (typeof value === 'string' ? value.trim() : '');
const lower = (value) => trim(value).toLowerCase();
const clip = (value, max) => (value.length <= max ? value : `${value.slice(0, Math.max(0, max - 1)).trimEnd()}…`);

// Admins, as the config names them now, get Detailed answers; anyone else,
// the first audience that admits them. An outage before a match leaves the
// answer unknown, so it refuses.
const resolveAsker = async ({ setting, config, address, access }) => {
  if (resolveSessionAdminAddresses(config).has(lower(address))) {
    return { ok: true, answers: 'detailed', audience: 'admin' };
  }
  for (const [index, audience] of setting.audiences.entries()) {
    const result = await access.admits(audience.who);
    if (result.outcome === 'unavailable') {
      return { ok: false, status: 503, error: 'Who may ask could not be checked just now. Try again shortly.' };
    }
    if (result.ok) return { ok: true, answers: audience.answers, audience: index };
  }
  return { ok: false, status: 403, error: 'The Group Agent isn’t open to you in this session.', reason: 'group_agent_not_admitted' };
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

// Results reach an answer only for those who may see them on the page.
const readVisibleResults = async ({ env, slug, config, address, scopes, admin, deps }) => {
  if (!admin) {
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

// Members' answers by question, as the session's own analysis reads them:
// latest per person, withheld and locked answers left out, with no names.
const readMemberAnswers = async ({ env, slug, config, deps }) => {
  const source = await (deps.loadWorkerCanonicalResultsAnalysisSource || loadWorkerCanonicalResultsAnalysisSource)({ env, slug, config });
  if (!source?.ok) return null;
  const byQuestion = new Map();
  source.aiSnapshot.responses.forEach((response) => {
    const answer = [trim(response.answer), trim(response.additional)].filter(Boolean).join(' — ');
    if (!answer) return;
    const group = byQuestion.get(response.questionId) || { question: trim(response.questionPrompt), answers: [] };
    group.answers.push(answer);
    byQuestion.set(response.questionId, group);
  });
  return [...byQuestion.values()];
};

// What each style reads, decided here and nowhere else. General: the
// session's context, the files open to everyone, and results the person may
// see. Detailed: every file they may read, and members' answers as well.
const gatherMaterial = async ({ env, slug, config, address, scopes, asker, access, deps }) => {
  const detailed = asker.answers === 'detailed';
  const [sources, results, answers] = await Promise.all([
    loadParticipantContextSources({
      env, slug, config, deps, principal: lower(address), ...(detailed ? { readable: access.canRead } : {}),
    }),
    readVisibleResults({ env, slug, config, address, scopes, admin: asker.audience === 'admin', deps }),
    detailed ? readMemberAnswers({ env, slug, config, deps }) : [],
  ]);
  return { material: { sessionContext: config?.sessionContext, sources, results, answers: answers || [] }, answersUnavailable: answers === null };
};

// A price for an audience will be checked here, refusing with 402 until it
// is paid. It runs after the material is fixed, so paying never widens it.
const checkGroupAgentPayment = async () => ({ ok: true });

const PROXIES = { anthropic: 'proxyAnthropic', openai: 'proxyOpenAI', openrouter: 'proxyOpenRouter', custom: 'proxyCustomRPC' };

const askAi = async ({ messages, config, secrets, address, scopes, headers, deps }) => {
  const request = (deps.normalizeAiRequestPayload || normalizeAiRequestPayload)({
    payload: { taskType: 'group-agent', messages, max_tokens: 3000, max_output_tokens: 3000 },
    config,
  });
  const { provider, payload } = request;
  if (!isModelAllowed(payload.model, provider)) return { ok: false, status: 403, body: AI_MODEL_NOT_ALLOWED };
  const proxy = deps[PROXIES[provider]];
  if (!proxy) return { ok: false, status: 503, body: { error: 'The session’s AI provider can’t answer the Group Agent.' } };
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
  const answer = clip(trim(data?.completion), GROUP_AGENT_LIMITS.answerChars);
  return answer ? { ok: true, answer } : { ok: false, status: 502, body: { error: 'The Group Agent gave no answer. Try again.' } };
};

const accessFor = ({ env, config, slug, address, scopes, deps }) =>
  createRequesterAccessChecks({ env, config, slug, requesterAddress: address, authScopes: scopes, deps });

export const dispatchGroupAgentRoute = async ({ path, body, config, slug, address, env, limit, headers, scopes, deps } = {}) => {
  const json = (payload, status = 200) => deps.json(payload, status, headers);
  const setting = groupAgentSettingOf(config?.groupAgent);
  // Status only decides what the page shows, so it reads the sign-in's
  // scopes; each question checks them afresh before anything is read.
  if (path === '/group-agent/status') {
    if (!setting) return json({ on: false, answers: null, audience: null });
    const asker = await resolveAsker({ setting, config, address, access: accessFor({ env, config, slug, address, scopes, deps }) });
    if (!asker.ok && asker.status === 503) return json({ error: asker.error }, 503);
    return json({ on: true, answers: asker.ok ? asker.answers : null, audience: asker.ok ? asker.audience : null });
  }

  const ended = buildSessionEndedResponse({ config, headers, json: deps.json, now: deps.now });
  if (ended) return ended;
  if (!setting) return json({ error: 'This session has no Group Agent.', reason: 'group_agent_off' }, 403);
  if (config?.scopes?.ai === false) return json({ error: 'AI is turned off for this session.', reason: 'ai_disabled' }, 403);
  const question = trim(body?.question);
  if (!question) return json({ error: 'Ask a question.' }, 400);
  if (question.length > GROUP_AGENT_LIMITS.questionChars) {
    return json({ error: `A question can be at most ${GROUP_AGENT_LIMITS.questionChars} characters.` }, 400);
  }
  // The /ai route's checks: the current AI scope, then its rate limit.
  const preflight = await deps.evaluateAuthenticatedRoutePreflight({
    scopes, scope: 'ai', route: 'ai', allowWithoutScope: true, config, env, slug, address, limit, headers,
    deps: { checkRateLimit: deps.checkRateLimit, computeScopesForLogin: deps.computeScopesForLogin, json: deps.json },
  });
  if (!preflight?.ok) return preflight?.response || json({ error: 'Current authorization check failed.' }, 403);
  const currentScopes = { ...scopes, ai: preflight.tokenHasScope === true };
  const access = accessFor({ env, config, slug, address, scopes: currentScopes, deps });
  const asker = await resolveAsker({ setting, config, address, access });
  if (!asker.ok) return json({ error: asker.error, ...(asker.reason ? { reason: asker.reason } : {}) }, asker.status);
  const secretContext = await deps.resolveAuthenticatedRouteSecrets({
    env, slug, headers, deps: { getSessionSecrets: deps.getSessionSecrets, json: deps.json },
  });
  // Missing secrets come back as a 401, which the page would take for its sign-in.
  if (!secretContext?.ok) return json({ error: 'The session’s AI isn’t set up.' }, 503);

  const { material, answersUnavailable } = await gatherMaterial({ env, slug, config, address, scopes: currentScopes, asker, access, deps });
  const payment = await (deps.checkGroupAgentPayment || checkGroupAgentPayment)({ audience: asker.audience, answers: asker.answers });
  if (!payment?.ok) return json({ error: payment?.error || 'This answer needs payment first.', reason: 'group_agent_payment_required' }, 402);
  const { messages, read } = buildGroupAgentMessages({ setting, style: asker.answers, question, material });
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
