import { safeString, lower, stableJson, sha256Hex } from './runtimePrimitives.mjs';
import { normalizeQuestionTags, persistAgentProposedQuestion, sessionContextFromPolicySession } from './agentQuestionProposals.mjs';
import { loadAgentQuestionQueueConfig, saveAgentQuestionQueueConfig, selectNextAgentQuestion } from './agentQuestionQueue.mjs';
import { json } from './httpInput.mjs';
import { loadPublicQuestionsForHandoff, rankQuestionsByPreferences } from './questions.mjs';
import { requireQuestionQueueAdmin } from './adminAuthority.mjs';

export async function handleNextQuestionRequest({ env = {}, context = {}, input = {}, waitUntil = null } = {}) {
  const { loaded, questions } = await loadPublicQuestionsForHandoff({
    env,
    context,
    waitUntil,
  });
  const ranked = rankQuestionsByPreferences(questions, input, context);
  const queueConfig = await loadAgentQuestionQueueConfig({
    env,
    sessionSlug: context.session.sessionSlug,
  });
  const selected = await selectNextAgentQuestion({
    env,
    sessionSlug: context.session.sessionSlug,
    telegramUserId: context.storageContext.user.telegramUserId,
    questions: ranked.questions,
    sponsoredQuestionIds: queueConfig.sponsoredQuestionIds,
    input,
    createdAt: input.createdAt || null,
  });
  return json(
    {
      ok: selected.ok,
      sessionSlug: context.session.sessionSlug,
      permissionMode: context.permission.mode,
      questionSource: loaded.source || '',
      questionSourceReason: loaded.reason || '',
      relevance: ranked.relevance,
      queueConfig: {
        source: queueConfig.source || '',
        sponsoredQuestionCount: queueConfig.sponsoredQuestionIds.length,
      },
      question: selected.question || null,
      sponsored: selected.sponsored === true,
      reason: selected.reason,
      queue: selected.queue,
    },
    { status: selected.ok ? 200 : 404 },
  );
}

export function normalizeQuestionQueueRefs(value = []) {
  const source = Array.isArray(value) ? value : safeString(value).split(/[\n,;|]+/);
  return source
    .map((entry) => {
      if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
        return safeString(entry.questionId || entry.id || entry.value || entry.label || entry.name);
      }
      return safeString(entry);
    })
    .filter(Boolean)
    .filter((entry, index, values) => values.indexOf(entry) === index)
    .slice(0, 50);
}

export function normalizeQuestionQueueReferenceInputs(input = {}) {
  return normalizeQuestionQueueRefs(
    input.references ||
      input.reference ||
      input.queries ||
      input.query ||
      input.sponsoredQuestionRefs ||
      input.questionRefs ||
      input.sponsoredQuestionIds ||
      input.questionIds ||
      input.sponsoredQuestions ||
      input.questionsToSponsor ||
      input.ids,
  );
}

export function questionQueueCandidates(questions = []) {
  return (Array.isArray(questions) ? questions : [])
    .filter((question) => question?.answerable === true)
    .filter((question) => safeString(question.questionId) && safeString(question.prompt));
}

export function findQuestionQueueCandidate(questions = [], ref = '') {
  const token = safeString(ref);
  if (!token) return null;
  const numeric = Number(token);
  if (Number.isInteger(numeric) && numeric > 0 && numeric <= questions.length) {
    return questions[numeric - 1] || null;
  }
  const normalized = lower(token);
  return (
    questions.find(
      (question) =>
        lower(question.questionId) === normalized ||
        lower(question.id) === normalized ||
        lower(question.questionId).startsWith(normalized),
    ) || null
  );
}

export function tokenizeQuestionQueueReference(value = '') {
  const stop = new Set([
    'a',
    'an',
    'and',
    'are',
    'as',
    'be',
    'by',
    'for',
    'from',
    'is',
    'it',
    'make',
    'mark',
    'of',
    'on',
    'or',
    'question',
    'questions',
    'sponsor',
    'sponsored',
    'that',
    'the',
    'this',
    'to',
    'with',
  ]);
  return lower(value)
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !stop.has(token))
    .filter((token, index, values) => values.indexOf(token) === index)
    .slice(0, 16);
}

export function questionQueueCandidateSearchText(question = {}) {
  return [
    question.questionId,
    question.prompt,
    question.questionType,
    Array.isArray(question.tags) ? question.tags.join(' ') : '',
    Array.isArray(question.options) ? question.options.join(' ') : '',
  ]
    .map((value) => safeString(value).toLowerCase())
    .join(' ');
}

export function scoreQuestionQueueCandidate(question = {}, ref = '') {
  const tokens = tokenizeQuestionQueueReference(ref);
  if (!tokens.length) return 0;
  const haystack = questionQueueCandidateSearchText(question);
  let score = 0;
  tokens.forEach((token) => {
    if (lower(question.questionId) === token) score += 100;
    if (haystack.includes(token)) score += 10;
    if ((Array.isArray(question.tags) ? question.tags : []).map(lower).includes(token)) score += 12;
  });
  return score;
}

export function findQuestionQueueCandidateByText(questions = [], ref = '') {
  const scored = questions
    .map((question) => ({
      question,
      score: scoreQuestionQueueCandidate(question, ref),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score);
  return scored[0]?.question || null;
}

export function resolveQuestionQueueRefs(input = {}, questions = []) {
  const refs = normalizeQuestionQueueRefs(
    input.sponsoredQuestionIds || input.questionIds || input.sponsoredQuestions || input.questions || input.ids,
  );
  const ids = [];
  const skipped = [];
  refs.forEach((ref) => {
    const question = findQuestionQueueCandidate(questions, ref);
    const questionId = safeString(question?.questionId);
    if (!question || !questionId) {
      skipped.push(ref);
      return;
    }
    if (!ids.includes(questionId)) ids.push(questionId);
  });
  return { refs, ids, skipped };
}

export function resolveNaturalQuestionQueueRefs(input = {}, questions = []) {
  const refs = normalizeQuestionQueueReferenceInputs(input);
  const instruction = safeString(input.instruction || input.promptRequest || input.request);
  if (!refs.length && instruction && !/\b(create|draft|new|write|add)\b/i.test(instruction)) {
    refs.push(instruction);
  }
  const ids = [];
  const matches = [];
  const skipped = [];
  refs.forEach((ref) => {
    const question = findQuestionQueueCandidate(questions, ref) || findQuestionQueueCandidateByText(questions, ref);
    const questionId = safeString(question?.questionId);
    if (!question || !questionId) {
      skipped.push(ref);
      return;
    }
    if (!ids.includes(questionId)) ids.push(questionId);
    matches.push({
      ref,
      question: questionQueueCandidateSummary(question, questions.indexOf(question)),
    });
  });
  return { refs, ids, matches, skipped };
}

export function topicFromInstruction(value = '') {
  const text = safeString(value).replace(/\s+/g, ' ');
  if (!text) return '';
  const quoted = text.match(/["“”']([^"“”']{4,160})["“”']/);
  if (quoted?.[1]) return safeString(quoted[1]);
  const about = text.match(/\babout\s+(.+?)(?:\s+(?:and|then)\s+(?:make|mark|sponsor)|$)/i);
  if (about?.[1]) {
    return safeString(about[1])
      .replace(/\b(as|a)?\s*sponsored\s+question\b.*$/i, '')
      .replace(/\b(make|mark)\s+it\s+sponsored\b.*$/i, '')
      .replace(/[.?!]+$/g, '');
  }
  return '';
}

export function normalizeQuestionDraftInputs(input = {}) {
  const source = input.createQuestions || input.newQuestions || input.questionsToCreate || input.draftQuestions || [];
  const entries = Array.isArray(source) ? source : source ? [source] : [];
  const questions = entries
    .map((entry) => {
      if (typeof entry === 'string') return { prompt: entry };
      if (entry && typeof entry === 'object' && !Array.isArray(entry)) return entry;
      return null;
    })
    .filter(Boolean);
  const directPrompt = safeString(input.createQuestionPrompt || input.newQuestionPrompt);
  if (directPrompt) questions.push({ prompt: directPrompt, questionType: input.questionType });
  const instruction = safeString(input.instruction || input.promptRequest || input.request);
  if (input.create === true && instruction) {
    const topic = topicFromInstruction(instruction) || (!questions.length ? instruction : '');
    if (topic)
      questions.push({
        prompt: `Should this session prioritize ${topic}?`,
        questionType: input.questionType || 'binary',
      });
  } else if (/\b(create|draft|new|write|add)\b/i.test(instruction) && /\bquestion\b/i.test(instruction)) {
    const topic = topicFromInstruction(instruction);
    if (topic)
      questions.push({
        prompt: `Should this session prioritize ${topic}?`,
        questionType: input.questionType || 'binary',
      });
  }
  return questions
    .map((entry) => ({
      prompt: safeString(entry.prompt || entry.questionText || entry.text)
        .replace(/\s+/g, ' ')
        .slice(0, 1000),
      questionType: safeString(entry.questionType || entry.type || input.questionType || 'binary') || 'binary',
      options: Array.isArray(entry.options) ? entry.options.map(safeString).filter(Boolean).slice(0, (entry.questionType || entry.type || input.questionType) === 'quadratic' ? Infinity : 12) : [],
      ...((entry.questionType || entry.type || input.questionType) === 'quadratic' ? { voiceCredits: entry.voiceCredits ?? input.voiceCredits ?? 99 } : {}),
      tags: normalizeQuestionTags(entry.tags || input.tags),
      sessionContext: safeString(
        entry.sessionContext ||
          input.sessionContext ||
          input.context ||
          sessionContextFromPolicySession(input.session || {}),
      ),
    }))
    .filter((entry) => entry.prompt)
    .filter(
      (entry, index, values) =>
        values.findIndex((candidate) => lower(candidate.prompt) === lower(entry.prompt)) === index,
    )
    .slice(0, 20);
}

export function questionQueueCandidateSummary(question = {}, index = 0) {
  return {
    index: index + 1,
    questionId: safeString(question.questionId),
    questionType: safeString(question.questionType),
    prompt: safeString(question.prompt),
    tags: Array.isArray(question.tags) ? question.tags.map(safeString).filter(Boolean) : [],
  };
}

export function isQuestionQueueClearRequested(input = {}) {
  const operation = lower(input.operation);
  const clear = lower(input.clearQueue);
  return ['clear', 'reset', 'none', 'empty'].includes(operation) || ['true', '1', 'yes', 'on'].includes(clear);
}

export async function buildSponsoredQuestionPlan({ env = {}, context = {}, input = {}, waitUntil = null } = {}) {
  const admin = await requireQuestionQueueAdmin({
    env,
    context,
    input,
    allowDelegatedAdmin: true,
  });
  if (!admin.ok) return { ok: false, admin, status: admin.status || 403 };
  const { loaded, questions } = await loadPublicQuestionsForHandoff({
    env,
    context,
    waitUntil,
  });
  const candidates = questionQueueCandidates(questions);
  const resolved = resolveNaturalQuestionQueueRefs(input, candidates);
  const drafts = normalizeQuestionDraftInputs({
    ...input,
    session: context.session,
  });
  const sponsoredQuestionIds = [...resolved.ids];
  const queueConfig = await loadAgentQuestionQueueConfig({
    env,
    sessionSlug: context.session.sessionSlug,
  });
  const existingSponsoredQuestionIds = Array.isArray(queueConfig.sponsoredQuestionIds)
    ? queueConfig.sponsoredQuestionIds
    : [];
  const mode = input.replace === true || lower(input.mode) === 'replace' ? 'replace' : 'append';
  const planDigest = await sha256Hex(stableJson({ mode, sponsoredQuestionIds, draftQuestions: drafts }));
  return {
    ok: true,
    sessionSlug: context.session.sessionSlug,
    permissionMode: context.permission.mode,
    admin: {
      accountAddress: admin.manager.accountAddress,
      canManageSponsoredQuestions: true,
    },
    questionSource: loaded.source || '',
    questionSourceReason: loaded.reason || '',
    existingSponsoredQuestionIds,
    mode,
    planDigest,
    resolvedExistingQuestions: resolved.matches,
    draftQuestions: drafts,
    sponsoredQuestionIds,
    skipped: resolved.skipped,
    candidates: candidates.slice(0, 25).map(questionQueueCandidateSummary),
    requiresConfirmation: true,
    confirmation: {
      endpoint: '/api/agent/question-queue/apply',
      required:
        'Show resolvedExistingQuestions and draftQuestions to the admin, then send approved: true and this planDigest to apply only after explicit approval.',
    },
  };
}

export function hasExplicitSponsoredQueueApproval(input = {}) {
  const flags = [input.approved, input.confirm, input.confirmed];
  return !flags.includes(false) && flags.includes(true);
}

export async function handleQuestionQueuePlanRequest({ env = {}, context = {}, input = {}, waitUntil = null } = {}) {
  const plan = await buildSponsoredQuestionPlan({
    env,
    context,
    input,
    waitUntil,
  });
  if (!plan.ok) {
    return json(
      {
        ok: false,
        reason: plan.admin?.reason || 'question_queue_admin_required',
        accountAddress: plan.admin?.accountAddress || '',
      },
      { status: plan.status || 403 },
    );
  }
  return json(plan);
}

export async function handleQuestionQueueApplyRequest({ env = {}, context = {}, input = {}, waitUntil = null } = {}) {
  const plan = await buildSponsoredQuestionPlan({
    env,
    context,
    input,
    waitUntil,
  });
  if (!plan.ok) {
    return json(
      {
        ok: false,
        reason: plan.admin?.reason || 'question_queue_admin_required',
        accountAddress: plan.admin?.accountAddress || '',
      },
      { status: plan.status || 403 },
    );
  }
  if (!hasExplicitSponsoredQueueApproval(input)) {
    return json(
      {
        ...plan,
        ok: false,
        reason: 'sponsored_question_confirmation_required',
      },
      { status: 400 },
    );
  }
  if (Object.hasOwn(input, 'planDigest') && input.planDigest !== plan.planDigest) {
    return json(
      { ...plan, ok: false, reason: 'sponsored_question_plan_changed' },
      { status: 409 },
    );
  }
  const createdQuestions = [];
  const createdQuestionIds = [];
  for (const draft of plan.draftQuestions) {
    const saved = await persistAgentProposedQuestion({
      env,
      normalized: context.storageContext,
      sessionSlug: context.session.sessionSlug,
      prompt: draft.prompt,
      questionType: draft.questionType,
      options: draft.options,
      voiceCredits: draft.voiceCredits ?? 99,
      ratingScale: draft.ratingScale || draft.rating_scale || null,
      tags: draft.tags,
      sessionContext: draft.sessionContext || sessionContextFromPolicySession(context.session),
      metadata: {
        source: 'agent_handoff',
        authMode: safeString(context.authMode),
        endpoint: '/api/agent/question-queue/apply',
        sponsoredQuestion: true,
        approvalText: safeString(input.approvalText || input.confirmationText || input.userApproval).slice(0, 500),
      },
      createdAt: input.createdAt || null,
    });
    if (!saved.ok) {
      plan.skipped.push({
        prompt: draft.prompt,
        reason: saved.reason || 'question_create_failed',
      });
      continue;
    }
    createdQuestionIds.push(saved.questionId);
    createdQuestions.push({
      questionId: saved.questionId,
      prompt: saved.question?.prompt || draft.prompt,
      questionType: saved.question?.questionType || draft.questionType,
    });
  }
  const baseIds = plan.mode === 'replace' ? [] : plan.existingSponsoredQuestionIds;
  const nextIds = [...baseIds, ...plan.sponsoredQuestionIds, ...createdQuestionIds]
    .map(safeString)
    .filter(Boolean)
    .filter((id, index, values) => values.indexOf(id) === index)
    .slice(0, 50);
  if (!nextIds.length) {
    return json(
      {
        ...plan,
        ok: false,
        reason: 'sponsored_question_targets_required',
        createdQuestions,
      },
      { status: 400 },
    );
  }
  const saved = await saveAgentQuestionQueueConfig({
    env,
    sessionSlug: context.session.sessionSlug,
    sponsoredQuestionIds: nextIds,
    updatedByTelegramUserId: context.storageContext.user.telegramUserId,
    updatedByAccountAddress: plan.admin.accountAddress,
    createdAt: input.createdAt || null,
  });
  if (!saved.ok) {
    return json(
      {
        ok: false,
        reason: saved.reason || 'question_queue_save_failed',
        sessionSlug: context.session.sessionSlug,
      },
      { status: 500 },
    );
  }
  return json({
    ok: true,
    sessionSlug: context.session.sessionSlug,
    mode: plan.mode,
    saved: true,
    questionQueue: {
      sponsoredQuestionIds: saved.config.sponsoredQuestionIds,
      sponsoredQuestionCount: saved.config.sponsoredQuestionIds.length,
      updatedAt: saved.config.updatedAt,
    },
    resolvedExistingQuestions: plan.resolvedExistingQuestions,
    createdQuestions,
    skipped: plan.skipped,
    approval: {
      approved: true,
      approvalText: safeString(input.approvalText || input.confirmationText || input.userApproval).slice(0, 500),
    },
  });
}

export async function handleQuestionQueueRequest({
  env = {},
  context = {},
  input = {},
  waitUntil = null,
  method = 'GET',
} = {}) {
  const admin = await requireQuestionQueueAdmin({ env, context, input });
  if (!admin.ok) {
    return json(
      {
        ok: false,
        reason: admin.reason,
        accountAddress: admin.accountAddress || '',
      },
      { status: admin.status || 403 },
    );
  }

  const { loaded, questions } = await loadPublicQuestionsForHandoff({
    env,
    context,
    waitUntil,
  });
  const candidates = questionQueueCandidates(questions);
  const candidateSummaries = candidates.map(questionQueueCandidateSummary);
  const writeRequested = safeString(method).toUpperCase() !== 'GET';
  const clearRequested = isQuestionQueueClearRequested(input);
  let skipped = [];
  let saved = null;

  if (writeRequested) {
    const resolved = clearRequested ? { refs: [], ids: [], skipped: [] } : resolveQuestionQueueRefs(input, candidates);
    skipped = resolved.skipped;
    if (!clearRequested && !resolved.refs.length) {
      return json(
        {
          ok: false,
          reason: 'question_queue_question_ids_required',
          sessionSlug: context.session.sessionSlug,
          candidates: candidateSummaries,
        },
        { status: 400 },
      );
    }
    if (!clearRequested && !resolved.ids.length) {
      return json(
        {
          ok: false,
          reason: 'question_queue_no_matching_questions',
          sessionSlug: context.session.sessionSlug,
          skipped,
          candidates: candidateSummaries,
        },
        { status: 400 },
      );
    }
    saved = await saveAgentQuestionQueueConfig({
      env,
      sessionSlug: context.session.sessionSlug,
      sponsoredQuestionIds: clearRequested ? [] : resolved.ids,
      updatedByTelegramUserId: context.storageContext.user.telegramUserId,
      updatedByAccountAddress: admin.manager.accountAddress,
      createdAt: input.createdAt || null,
    });
    if (!saved.ok) {
      return json(
        {
          ok: false,
          reason: saved.reason || 'question_queue_save_failed',
          sessionSlug: context.session.sessionSlug,
        },
        { status: 500 },
      );
    }
  }

  const queueConfig =
    saved?.config ||
    (await loadAgentQuestionQueueConfig({
      env,
      sessionSlug: context.session.sessionSlug,
    }));
  return json({
    ok: true,
    sessionSlug: context.session.sessionSlug,
    permissionMode: context.permission.mode,
    questionSource: loaded.source || '',
    questionSourceReason: loaded.reason || '',
    questionQueue: {
      source: queueConfig.source || (saved ? 'kv' : ''),
      sponsoredQuestionIds: Array.isArray(queueConfig.sponsoredQuestionIds) ? queueConfig.sponsoredQuestionIds : [],
      sponsoredQuestionCount: Array.isArray(queueConfig.sponsoredQuestionIds)
        ? queueConfig.sponsoredQuestionIds.length
        : 0,
      updatedAt: safeString(queueConfig.updatedAt),
    },
    saved: saved?.ok === true,
    skipped,
    candidates: candidateSummaries,
  });
}
