import { TELEGRAM_CHAT_LANES } from './constants.mjs';
import {
  buildTelegramCommandResponse,
  loadQuestionsForSession,
  loadSessionPolicy,
  persistAnswerDraft,
  readGroupSessionBinding,
  readPrivateSessionBinding,
} from './telegramCommands.mjs';
import { evaluateTelegramQuestionAuthoringPermission } from './telegramAuthoringPermissions.mjs';
import { persistTelegramProposedQuestion } from './telegramQuestionProposals.mjs';
import { resolveSessionInvocation } from './sessionPolicy.mjs';
import { telegramBotApiRequest } from './telegramSender.mjs';
import {
  loadTelegramLightweightGroups,
  persistTelegramChildSession,
  persistTelegramLightweightGroupProposal,
} from './telegramGroups.mjs';

function safeString(value) {
  return String(value || '').trim();
}

function lower(value) {
  return safeString(value).toLowerCase();
}

function sanitizeSessionSlug(value = '') {
  return lower(value).replace(/[^a-z0-9_-]/g, '').slice(0, 128);
}

function safeJsonParse(value, fallback = null) {
  const text = safeString(value);
  if (!text) return fallback;
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

function json(data, init = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...(init.headers || {}),
    },
  });
}

function firstValue(...values) {
  return values.find((value) => safeString(value) !== '');
}

function titleAnswer(value = '') {
  const normalized = lower(value);
  if (normalized === 'agree' || normalized === 'yes' || normalized === 'true') return 'Agree';
  if (normalized === 'disagree' || normalized === 'no' || normalized === 'false') return 'Disagree';
  if (normalized === 'unsure' || normalized === 'unknown' || normalized === 'maybe') return 'Unsure';
  return safeString(value);
}

function expectedAgentToken(env = {}) {
  return safeString(env.AGENT_BRIDGE_AGENT_API_TOKEN || env.AGENT_BRIDGE_OPENCLAW_AGENT_TOKEN);
}

function suppliedAgentToken(request) {
  const authorization = safeString(request.headers.get('authorization'));
  const bearer = authorization.match(/^Bearer\s+(.+)$/i);
  return safeString(
    bearer?.[1] ||
    request.headers.get('x-ce-agent-token') ||
    request.headers.get('x-context-engine-agent-token')
  );
}

function authenticateAgentHandoff(request, env = {}) {
  const expected = expectedAgentToken(env);
  if (!expected) {
    return { ok: false, status: 503, reason: 'agent_api_token_not_configured' };
  }
  const supplied = suppliedAgentToken(request);
  if (!supplied || supplied !== expected) {
    return { ok: false, status: 401, reason: 'agent_api_token_invalid' };
  }
  return { ok: true };
}

function normalizeAgentTelegramContext(input = {}) {
  const telegram = input.telegram && typeof input.telegram === 'object' && !Array.isArray(input.telegram)
    ? input.telegram
    : {};
  const telegramUserId = safeString(input.telegramUserId || input.userId || telegram.telegramUserId || telegram.userId);
  const username = safeString(input.username || telegram.username);
  const groupChatId = safeString(input.groupChatId || input.chatId || telegram.groupChatId || telegram.chatId);
  const chatId = groupChatId || telegramUserId;
  return {
    updateId: safeString(input.updateId) || `agent-${Date.now()}`,
    user: { telegramUserId, username },
    chat: {
      chatId,
      type: groupChatId ? 'supergroup' : 'private',
      isPrivate: !groupChatId,
    },
  };
}

async function readRequestJson(request) {
  if (request.method === 'GET' || request.method === 'HEAD') return {};
  return request.json().catch(() => ({}));
}

function inputFromRequest(request, body = {}) {
  const url = new URL(request.url);
  return {
    ...body,
    sessionSlug: safeString(body.sessionSlug || url.searchParams.get('sessionSlug')),
    telegramUserId: safeString(body.telegramUserId || url.searchParams.get('telegramUserId')),
    groupChatId: safeString(body.groupChatId || url.searchParams.get('groupChatId')),
    username: safeString(body.username || url.searchParams.get('username')),
  };
}

async function resolveHandoffContext({
  env = {},
  input = {},
} = {}) {
  const policy = await loadSessionPolicy(env);
  const normalized = normalizeAgentTelegramContext(input);
  if (!normalized.user.telegramUserId) {
    return { ok: false, status: 400, reason: 'telegram_user_required' };
  }
  const groupBinding = await readGroupSessionBinding(env, normalized);
  const privateBinding = await readPrivateSessionBinding(env, normalized);
  const sessionSlug = sanitizeSessionSlug(
    input.sessionSlug ||
    groupBinding?.sessionSlug ||
    privateBinding?.sessionSlug ||
    policy.defaultSessionSlug
  );
  const resolved = resolveSessionInvocation(policy, sessionSlug);
  if (!resolved.ok) {
    return { ok: false, status: 404, reason: resolved.reason || 'session_not_found', sessionSlug };
  }
  const permission = evaluateTelegramQuestionAuthoringPermission({
    env,
    normalized,
    session: resolved.session,
    groupBinding,
    privateBinding,
    requestedSessionSlug: resolved.session.sessionSlug,
  });
  if (!permission.ok) {
    return { ok: false, status: 403, reason: permission.reason, sessionSlug: resolved.session.sessionSlug };
  }
  return {
    ok: true,
    policy,
    session: resolved.session,
    normalized,
    groupBinding,
    privateBinding,
    permission,
  };
}

function questionIsLocked(question = {}) {
  const visibility = lower(question.visibility);
  return question.locked === true || ['private', 'sbt_gated', 'lit_encrypted'].includes(visibility);
}

function questionIsUnavailable(question = {}) {
  return question.payloadUnavailable === true || lower(question.visibility) === 'payload_unavailable';
}

function publicAgentQuestion(question = {}) {
  const questionId = safeString(question.questionId || question.id);
  const locked = questionIsLocked(question);
  const unavailable = questionIsUnavailable(question);
  const prompt = locked || unavailable
    ? ''
    : safeString(question.questionText || question.prompt || question.title);
  return {
    questionId,
    sessionSlug: sanitizeSessionSlug(question.sessionSlug),
    questionType: safeString(question.questionType || question.type || 'freeform') || 'freeform',
    prompt,
    options: Array.isArray(question.options) ? question.options.map(safeString).filter(Boolean) : [],
    answerable: Boolean(questionId && prompt && !locked && !unavailable),
    locked,
    payloadUnavailable: unavailable,
    proposed: question.proposed === true,
    source: safeString(question.source),
  };
}

async function handleQuestionsRequest({ env = {}, context = {}, waitUntil = null } = {}) {
  const loaded = await loadQuestionsForSession(env, context.session.sessionSlug, { waitUntil });
  const questions = (Array.isArray(loaded.questions) ? loaded.questions : [])
    .map(publicAgentQuestion)
    .filter((question) => question.questionId);
  return json({
    ok: true,
    sessionSlug: context.session.sessionSlug,
    permissionMode: context.permission.mode,
    questionSource: loaded.source || '',
    questionSourceReason: loaded.reason || '',
    questions,
  });
}

function normalizePreferenceEntries(input = {}) {
  const preferences = input.preferences && typeof input.preferences === 'object' && !Array.isArray(input.preferences)
    ? input.preferences
    : input;
  const byId = preferences.answersByQuestionId || preferences.draftsByQuestionId || input.answersByQuestionId;
  if (byId && typeof byId === 'object' && !Array.isArray(byId)) {
    return Object.entries(byId).map(([questionId, answer]) => ({ questionId, answer }));
  }
  const drafts = preferences.answers || preferences.drafts || input.answers || input.drafts;
  if (Array.isArray(drafts)) {
    return drafts.map((entry) => ({
      questionId: safeString(entry?.questionId || entry?.id),
      answer: entry,
    }));
  }
  return [];
}

function normalizeDraftForQuestion(answer = {}, question = {}) {
  const source = answer && typeof answer === 'object' && !Array.isArray(answer)
    ? answer
    : { value: answer };
  const questionType = safeString(question.questionType || source.questionType || 'freeform');
  const comments = safeString(source.comments || source.additionalComments || source.reason || source.rationale);
  if (questionType === 'binary') {
    const raw = lower(firstValue(source.value, source.answer, source.choice, source.stance, source.label));
    const value = raw === 'yes' || raw === 'true' ? 'agree'
      : raw === 'no' || raw === 'false' ? 'disagree'
      : raw === 'maybe' || raw === 'unknown' ? 'unsure'
      : raw;
    if (!['agree', 'disagree', 'unsure'].includes(value)) return null;
    return {
      label: titleAnswer(value),
      value: { questionType: 'binary', value, comments },
      controlType: 'agree_unsure_disagree',
    };
  }
  if (questionType === 'rating') {
    const value = Number(firstValue(source.value, source.rating, source.answer, source.label));
    if (!Number.isFinite(value)) return null;
    return {
      label: String(value),
      value: { questionType: 'rating', value, comments },
      controlType: 'rating_button',
    };
  }
  if (questionType === 'multichoice') {
    const values = Array.isArray(source.values)
      ? source.values.map(safeString).filter(Boolean)
      : [firstValue(source.value, source.answer, source.choice, source.label)].map(safeString).filter(Boolean);
    if (!values.length) return null;
    return {
      label: values.join(', '),
      value: { questionType: 'multichoice', values, comments },
      controlType: 'multi_select_toggle',
    };
  }
  const text = safeString(firstValue(source.text, source.value, source.answer, source.label));
  if (!text) return null;
  return {
    label: text.slice(0, 80),
    value: { questionType: 'freeform', text, comments },
    controlType: 'freeform_text',
  };
}

async function handlePreferencesRequest({ env = {}, context = {}, input = {}, waitUntil = null } = {}) {
  const loaded = await loadQuestionsForSession(env, context.session.sessionSlug, { waitUntil });
  const questions = (Array.isArray(loaded.questions) ? loaded.questions : [])
    .filter((question) => !questionIsLocked(question) && !questionIsUnavailable(question));
  const byId = new Map(questions.map((question) => [safeString(question.questionId || question.id), question]));
  const entries = normalizePreferenceEntries(input);
  const drafts = [];
  const skipped = [];
  for (const entry of entries) {
    const questionId = safeString(entry.questionId);
    const question = byId.get(questionId);
    if (!question) {
      skipped.push({ questionId, reason: 'question_not_active_or_answerable' });
      continue;
    }
    const draft = normalizeDraftForQuestion(entry.answer, question);
    if (!draft) {
      skipped.push({ questionId, reason: 'answer_not_understood' });
      continue;
    }
    const saved = await persistAnswerDraft({
      env,
      normalized: context.normalized,
      sessionSlug: context.session.sessionSlug,
      selectedQuestionId: questionId,
      answerLabel: draft.label,
      answerValue: JSON.stringify(draft.value),
      controlType: draft.controlType,
      submitLane: TELEGRAM_CHAT_LANES.MINI_APP,
      createdAt: input.createdAt || null,
    });
    if (!saved.ok) {
      skipped.push({ questionId, reason: saved.reason || 'draft_save_failed' });
      continue;
    }
    drafts.push({ questionId, answerLabel: draft.label, controlType: draft.controlType });
  }
  return json({
    ok: true,
    sessionSlug: context.session.sessionSlug,
    draftCount: drafts.length,
    skipped,
    drafts,
    reviewRequired: true,
    review: {
      route: '/telegram/mini-app',
      note: 'Drafted preferences are saved for user review. This endpoint does not submit answers.',
    },
  });
}

async function handlePoseRequest({
  env = {},
  context = {},
  input = {},
  fetchImpl = globalThis.fetch,
} = {}) {
  const prompt = safeString(input.prompt || input.questionText || input.text);
  const explicitQuestionId = safeString(input.questionId || input.id);
  let questionId = explicitQuestionId;
  if (!questionId && prompt) {
    const saved = await persistTelegramProposedQuestion({
      env,
      normalized: context.normalized,
      sessionSlug: context.session.sessionSlug,
      prompt,
      questionType: input.questionType || 'freeform',
      options: input.options,
      createdAt: input.createdAt || null,
    });
    if (!saved.ok) return json({ ok: false, reason: saved.reason || 'question_save_failed' }, { status: 400 });
    questionId = saved.questionId;
  }
  if (!questionId) {
    return json({ ok: false, reason: 'question_id_or_prompt_required' }, { status: 400 });
  }
  const update = {
    update_id: Date.now(),
    message: {
      message_id: Number(input.messageId || 1) || 1,
      text: `/q ${questionId}`,
      chat: {
        id: Number(context.permission.groupChatId || context.normalized.chat.chatId),
        type: 'supergroup',
        title: 'Context Engine Group',
      },
      from: {
        id: Number(context.normalized.user.telegramUserId),
        username: context.normalized.user.username || 'agent',
      },
    },
  };
  const commandResponse = await buildTelegramCommandResponse({ update, env, now: input.createdAt || null });
  const send = input.send !== false;
  let telegramSend = null;
  if (send && commandResponse.ok && commandResponse.response?.text && safeString(env.TELEGRAM_BOT_TOKEN)) {
    telegramSend = await telegramBotApiRequest({
      botToken: env.TELEGRAM_BOT_TOKEN,
      method: 'sendMessage',
      payload: {
        chat_id: commandResponse.response.chatId,
        text: commandResponse.response.text,
        reply_markup: commandResponse.response.replyMarkup || undefined,
      },
      fetchImpl,
    });
  }
  return json({
    ok: commandResponse.ok === true,
    sessionSlug: context.session.sessionSlug,
    questionId,
    posed: commandResponse.posed === true,
    sent: telegramSend ? telegramSend.ok === true : false,
    sendReason: telegramSend ? (telegramSend.ok ? '' : telegramSend.error) : (send ? 'telegram_bot_token_missing_or_send_skipped' : 'send_disabled'),
  }, { status: commandResponse.ok === true ? 200 : 400 });
}

function telegramOnlyRouteGuard(context = {}) {
  if (context.session?.telegramOnly === true) return null;
  return json({
    ok: false,
    reason: 'telegram_only_session_required',
    sessionSlug: context.session?.sessionSlug || '',
  }, { status: 403 });
}

async function handleGroupsRequest({ env = {}, context = {} } = {}) {
  const guard = telegramOnlyRouteGuard(context);
  if (guard) return guard;
  const groups = await loadTelegramLightweightGroups({
    env,
    session: context.session,
    telegramUserId: context.normalized.user.telegramUserId,
  });
  return json({
    ok: true,
    sessionSlug: context.session.sessionSlug,
    permissionMode: context.permission.mode,
    groups,
  });
}

async function handleGroupProposalRequest({ env = {}, context = {}, input = {} } = {}) {
  const guard = telegramOnlyRouteGuard(context);
  if (guard) return guard;
  const saved = await persistTelegramLightweightGroupProposal({
    env,
    session: context.session,
    normalized: context.normalized,
    input,
    createdAt: input.createdAt || null,
  });
  return json(saved, { status: saved.ok ? 200 : 400 });
}

async function handleChildSessionRequest({ env = {}, context = {}, input = {} } = {}) {
  const guard = telegramOnlyRouteGuard(context);
  if (guard) return guard;
  const saved = await persistTelegramChildSession({
    env,
    parentSession: context.session,
    normalized: context.normalized,
    input,
    createdAt: input.createdAt || null,
  });
  return json(saved, { status: saved.ok ? 200 : 400 });
}

export async function handleTelegramAgentHandoffRequest({
  request,
  env = {},
  waitUntil = null,
  fetchImpl = globalThis.fetch,
} = {}) {
  const auth = authenticateAgentHandoff(request, env);
  if (!auth.ok) return json({ ok: false, reason: auth.reason }, { status: auth.status });

  const url = new URL(request.url);
  const body = await readRequestJson(request);
  const input = inputFromRequest(request, body);
  const context = await resolveHandoffContext({ env, input });
  if (!context.ok) return json({ ok: false, reason: context.reason, sessionSlug: context.sessionSlug || '' }, { status: context.status });

  if (url.pathname === '/telegram/agent/api/questions' && request.method === 'GET') {
    return handleQuestionsRequest({ env, context, waitUntil });
  }
  if (url.pathname === '/telegram/agent/api/preferences' && request.method === 'POST') {
    return handlePreferencesRequest({ env, context, input, waitUntil });
  }
  if (url.pathname === '/telegram/agent/api/questions/pose' && request.method === 'POST') {
    return handlePoseRequest({ env, context, input, fetchImpl });
  }
  if (url.pathname === '/telegram/agent/api/groups' && request.method === 'GET') {
    return handleGroupsRequest({ env, context });
  }
  if (url.pathname === '/telegram/agent/api/groups/propose' && request.method === 'POST') {
    return handleGroupProposalRequest({ env, context, input });
  }
  if (url.pathname === '/telegram/agent/api/sessions/child' && request.method === 'POST') {
    return handleChildSessionRequest({ env, context, input });
  }
  return json({ ok: false, reason: 'telegram_agent_route_not_found' }, { status: 404 });
}

export const __test__telegramAgentHandoff = {
  authenticateAgentHandoff,
  normalizeAgentTelegramContext,
  normalizeDraftForQuestion,
  normalizePreferenceEntries,
  publicAgentQuestion,
  safeJsonParse,
};
