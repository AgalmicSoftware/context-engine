import { normalizeRatingScale, ratingStepFor, DEFAULT_RATING_SCALE } from '../../../shared/questions/ratingScale.mjs';
import { selectCurrentSubmittedAnswers } from './submittedResults.mjs';
import { authorityError } from './authority.mjs';
import { safeString, lower, safeJsonParse, sanitizeSessionSlug, sha256Hex } from './runtimePrimitives.mjs';
import { loadQuestionsForSession, readAgentSkillUpdateFlag } from './agentSessionRuntime.mjs';
import { geoTagsFromRefs, inferQuestionTags, normalizeQuestionReferences, normalizeQuestionGeoRefs, normalizeQuestionTags, persistAgentProposedQuestion, sessionContextFromPolicySession } from './agentQuestionProposals.mjs';
import { assertNoSecretShape } from './redaction.mjs';
import { SUBMITTED_RESULT_STATUSES, submitRequestUserKvPrefix } from './agentSubmitQueue.mjs';
import { ADMIN_METRICS_SUBMIT_ENTRY_LIMIT, CE_AGENT_ACCESS_SKILL_VERSION } from './httpConstants.mjs';
import { sessionAgentOrigin, firstValue, json, safeAnswerString } from './httpInput.mjs';
import { listHandoffKvRecordsByPrefix } from './adminMetrics.mjs';

export function questionIsLocked(question = {}) {
  const visibility = lower(question.visibility);
  return question.locked === true || ['private', 'sbt_gated', 'lit_encrypted'].includes(visibility);
}

export function questionIsUnavailable(question = {}) {
  return question.payloadUnavailable === true || lower(question.visibility) === 'payload_unavailable';
}

export function publicAgentQuestion(question = {}, { session = {} } = {}) {
  const questionId = safeString(question.questionId || question.id);
  const locked = questionIsLocked(question);
  const unavailable = questionIsUnavailable(question);
  const prompt = locked || unavailable ? '' : safeString(question.questionText || question.prompt || question.title);
  const questionType = safeString(question.questionType || question.type || 'freeform') || 'freeform';
  const options = !locked && !unavailable && Array.isArray(question.options) ? question.options.map(safeString).filter(Boolean) : [];
  const references = locked || unavailable ? [] : normalizeQuestionReferences(question.references);
  const geoRefs =
    locked || unavailable ? [] : normalizeQuestionGeoRefs(question.geoRefs || question.geoIds || question.geoId);
  const explicitTags = locked || unavailable ? [] : normalizeQuestionTags(question.tags);
  const tags =
    locked || unavailable
      ? []
      : explicitTags.length
        ? explicitTags
        : inferQuestionTags({
            question,
            prompt,
            questionType,
            options,
            session,
            sessionContext: sessionContextFromPolicySession(session),
          });
  return {
    questionId,
    sessionSlug: sanitizeSessionSlug(question.sessionSlug),
    questionType,
    prompt,
    options,
    ...(questionType === 'rating' && !locked && !unavailable
      ? { scale: { ...(normalizeRatingScale(question) || DEFAULT_RATING_SCALE), step: ratingStepFor(question) } } : {}),
    ...(questionType === 'quadratic' ? { voiceCredits: question.voiceCredits ?? 99 } : {}),
    ...(questionType === 'multichoice' && question.singleSelect === true ? { singleSelect: true } : {}),
    tags,
    answerable: Boolean(questionId && prompt && !locked && !unavailable),
    locked,
    payloadUnavailable: unavailable,
    proposed: question.proposed === true,
    source: safeString(question.source),
    references,
    geoRefs,
  };
}

export function withPublicSkippedMalformed(loaded = {}, skippedMalformed = 0) {
  const count = Number(skippedMalformed || 0) || 0;
  if (count <= 0) return loaded;
  return {
    ...loaded,
    skippedMalformed: (Number(loaded.skippedMalformed || 0) || 0) + count,
  };
}

export function safePublicAgentQuestion(question = {}, options = {}) {
  try {
    const normalized = publicAgentQuestion(question, options);
    if (!normalized.questionId) return { question: null, skippedMalformed: 1 };
    return { question: normalized, skippedMalformed: 0 };
  } catch {
    return { question: null, skippedMalformed: 1 };
  }
}

export function agentQuestionAnswerRef(sessionSlug = '', questionId = '') {
  const slug = sanitizeSessionSlug(sessionSlug);
  const qid = safeString(questionId);
  return slug && qid ? `${slug}:${qid}` : '';
}

export function firstAnswerValue(...values) {
  return values.find((value) => safeAnswerString(value) !== '');
}

export function submitRecordAnswerForAgent(record = {}) {
  const answer =
    record.answer && typeof record.answer === 'object' && !Array.isArray(record.answer) ? record.answer : {};
  const parsed = safeJsonParse(answer.value || record.answerValue, null);
  const structured = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  const questionType = safeString(
    firstAnswerValue(structured.questionType, record.questionType, answer.questionType, record.controlType),
  );
  const label = safeAnswerString(firstAnswerValue(answer.label, structured.label, record.answerLabel));
  const base = {
    requestId: safeString(record.requestId),
    answeredAt: safeString(record.createdAt),
    status: safeString(record.status),
    questionType,
    ...(label ? { label } : {}),
  };
  if (questionType === 'quadratic') return { ...base, value: structured.value ?? answer.value, comments: safeString(structured.comments || answer.comments) };
  if (questionType === 'multichoice') {
    const values = Array.isArray(structured.values)
      ? structured.values.map(safeAnswerString).filter(Boolean)
      : [firstAnswerValue(structured.value, answer.value, record.answerValue)].map(safeAnswerString).filter(Boolean);
    return {
      ...base,
      values,
      ...(safeAnswerString(structured.comments) ? { comments: safeAnswerString(structured.comments) } : {}),
    };
  }
  if (questionType === 'freeform') {
    return {
      ...base,
      text: safeAnswerString(
        firstAnswerValue(structured.text, structured.value, answer.text, answer.value, record.answerText),
      ),
      ...(safeAnswerString(structured.comments) ? { comments: safeAnswerString(structured.comments) } : {}),
    };
  }
  const value = Object.hasOwn(structured, 'value')
    ? structured.value
    : firstAnswerValue(answer.value, record.answerValue);
  return {
    ...base,
    value,
    ...(safeAnswerString(structured.comments) ? { comments: safeAnswerString(structured.comments) } : {}),
  };
}

export async function loadAgentQuestionAnswerState({ env = {}, context = {}, questions = [] } = {}) {
  const telegramUserId = safeString(context.storageContext?.user?.telegramUserId);
  const questionByRef = new Map();
  const sessionSlugs = new Set();
  (Array.isArray(questions) ? questions : []).forEach((question) => {
    const ref = agentQuestionAnswerRef(question.sessionSlug || context.session?.sessionSlug, question.questionId);
    if (!ref) return;
    questionByRef.set(ref, question);
    sessionSlugs.add(ref.split(':')[0]);
  });
  if (!telegramUserId || !questionByRef.size || !sessionSlugs.size) {
    return {
      source: telegramUserId ? 'submit_records' : 'unavailable',
      answeredByRef: new Map(),
      answeredCount: 0,
      unansweredCount: questionByRef.size,
    };
  }
  const submittedStatuses = new Set(SUBMITTED_RESULT_STATUSES);
  const indexedRecordGroups = await Promise.all(
    [...sessionSlugs].map((sessionSlug) => {
      const prefix = submitRequestUserKvPrefix({ sessionSlug, telegramUserId });
      return prefix
        ? listHandoffKvRecordsByPrefix(env, prefix, {
            limit: ADMIN_METRICS_SUBMIT_ENTRY_LIMIT,
          })
        : [];
    }),
  );
  const records = selectCurrentSubmittedAnswers(indexedRecordGroups.flat().filter(record =>
    safeString(record.telegramUserId) === telegramUserId && submittedStatuses.has(safeString(record.status))));
  const answeredByRef = new Map();
  records.forEach((record) => {
    if (safeString(record.telegramUserId) !== telegramUserId) return;
    if (!submittedStatuses.has(safeString(record.status))) return;
    const ref = agentQuestionAnswerRef(record.sessionSlug, record.questionId);
    if (!questionByRef.has(ref)) return;
    answeredByRef.set(ref, {
      answeredByUser: true,
      answeredAt: safeString(record.createdAt),
      answerStatus: safeString(record.status),
      myAnswer: submitRecordAnswerForAgent(record),
    });
  });
  return {
    source: 'submit_records',
    answeredByRef,
    answeredCount: answeredByRef.size,
    unansweredCount: Math.max(0, questionByRef.size - answeredByRef.size),
  };
}

export function applyAgentQuestionAnswerState(questions = [], answerState = {}, context = {}) {
  const answeredByRef = answerState.answeredByRef instanceof Map ? answerState.answeredByRef : new Map();
  return (Array.isArray(questions) ? questions : []).map((question) => {
    const ref = agentQuestionAnswerRef(question.sessionSlug || context.session?.sessionSlug, question.questionId);
    const answered = ref ? answeredByRef.get(ref) : null;
    return {
      ...question,
      answeredByUser: answered?.answeredByUser === true,
      ...(answered?.answeredAt ? { answeredAt: answered.answeredAt } : {}),
      ...(answered?.answerStatus ? { answerStatus: answered.answerStatus } : {}),
      ...(answered?.myAnswer ? { myAnswer: answered.myAnswer } : {}),
    };
  });
}

export function sortAgentQuestionsByAnswerState(questions = []) {
  return (Array.isArray(questions) ? questions : [])
    .map((question, index) => ({ question, index }))
    .sort((left, right) => {
      const leftAnswered = left.question?.answeredByUser === true ? 1 : 0;
      const rightAnswered = right.question?.answeredByUser === true ? 1 : 0;
      return leftAnswered - rightAnswered || left.index - right.index;
    })
    .map((entry) => entry.question);
}

export function normalizePreferenceTagHints(input = {}) {
  const preferences =
    input.preferences && typeof input.preferences === 'object' && !Array.isArray(input.preferences)
      ? input.preferences
      : {};
  const profile =
    preferences.profile && typeof preferences.profile === 'object' && !Array.isArray(preferences.profile)
      ? preferences.profile
      : {};
  const source = [
    input.tags,
    input.interests,
    input.topics,
    preferences.tags,
    preferences.tagIds,
    preferences.interests,
    preferences.topics,
    preferences.sessionTags,
    profile.tags,
    profile.interests,
    profile.topics,
  ].flatMap((value) => (Array.isArray(value) ? value : safeString(value).split(/[\n,;|]+/)));
  return normalizeQuestionTags(source);
}

export function normalizePreferenceSessionHints(input = {}) {
  const preferences =
    input.preferences && typeof input.preferences === 'object' && !Array.isArray(input.preferences)
      ? input.preferences
      : {};
  const source = [
    input.sessionsAttended,
    input.attendedSessions,
    input.sessionSlugs,
    preferences.sessionsAttended,
    preferences.attendedSessions,
    preferences.sessionSlugs,
  ].flatMap((value) => (Array.isArray(value) ? value : safeString(value).split(/[\n,;|]+/)));
  const slugs = new Set();
  const names = new Set();
  source.forEach((entry) => {
    const raw =
      entry && typeof entry === 'object' && !Array.isArray(entry)
        ? firstValue(entry.sessionSlug, entry.slug, entry.id, entry.sessionName, entry.name, entry.title)
        : entry;
    const text = safeString(raw);
    if (!text) return;
    const slug = sanitizeSessionSlug(text);
    if (slug) slugs.add(slug);
    normalizeQuestionTags(text).forEach((tag) => names.add(tag));
  });
  return { slugs: [...slugs], tags: [...names] };
}

export function questionRelevance(
  question = {},
  { tagHints = [], sessionHints = { slugs: [], tags: [] }, session = {} } = {},
) {
  const qTags = normalizeQuestionTags(question.tags);
  const tagSet = new Set(qTags);
  const promptText = [
    question.prompt,
    question.questionType,
    Array.isArray(question.options) ? question.options.join(' ') : '',
    session.sessionName,
    session.sessionSlug,
    sessionContextFromPolicySession(session),
  ]
    .map((value) => safeString(value).toLowerCase())
    .join(' ');
  const matchedTags = [];
  let score = 0;
  tagHints.forEach((tag) => {
    if (tagSet.has(tag)) {
      score += 20;
      matchedTags.push(tag);
    } else if (tag && promptText.includes(tag.replace(/-/g, ' '))) {
      score += 6;
      matchedTags.push(tag);
    }
  });
  const matchedSessions = [];
  const questionSlug = sanitizeSessionSlug(question.sessionSlug || session.sessionSlug);
  sessionHints.slugs.forEach((slug) => {
    if (slug && slug === questionSlug) {
      score += 30;
      matchedSessions.push(slug);
    }
  });
  sessionHints.tags.forEach((tag) => {
    if (tagSet.has(tag) || promptText.includes(tag.replace(/-/g, ' '))) {
      score += 8;
      if (!matchedTags.includes(tag)) matchedTags.push(tag);
    }
  });
  return {
    score,
    matchedTags: [...new Set(matchedTags)],
    matchedSessions: [...new Set(matchedSessions)],
  };
}

export function rankQuestionsByPreferences(questions = [], input = {}, context = {}) {
  const tagHints = normalizePreferenceTagHints(input);
  const sessionHints = normalizePreferenceSessionHints(input);
  if (!tagHints.length && !sessionHints.slugs.length && !sessionHints.tags.length) {
    return {
      questions,
      relevance: {
        mode: 'none',
        tags: [],
        sessionsAttended: [],
      },
    };
  }
  const ranked = questions.map((question, index) => {
    const relevance = questionRelevance(question, {
      tagHints,
      sessionHints,
      session: context.session,
    });
    return { question: { ...question, relevance }, index, relevance };
  });
  const mode = lower(input.relevanceMode);
  const filtered = ['filter', 'relevant_only', 'relevant-only'].includes(mode)
    ? ranked.filter((entry) => entry.relevance.score > 0)
    : ranked;
  filtered.sort((left, right) => right.relevance.score - left.relevance.score || left.index - right.index);
  return {
    questions: filtered.map((entry) => entry.question),
    relevance: {
      mode: filtered.length === ranked.length ? 'rank' : 'filter',
      tags: tagHints,
      sessionsAttended: sessionHints.slugs,
      sessionTags: sessionHints.tags,
    },
  };
}

export function questionsResponseLimit(input = {}) {
  const value = Number(input.limit || input.count || input.topN || 0);
  if (!Number.isFinite(value) || value <= 0) return 50;
  return Math.max(1, Math.min(200, Math.floor(value)));
}

export async function loadPublicQuestionsForHandoff({ env = {}, context = {}, waitUntil = null, allowCapped = false } = {}) {
  const loaded = await loadQuestionsForSession(env, context.session.sessionSlug, { waitUntil });
  if (loaded.ok === false || loaded.complete === false && !(allowCapped && loaded.reason === 'agent_proposals_capped')) {
    throw authorityError('agent_questions_incomplete', 503);
  }
  const questions = [];
  let skippedMalformed = 0;
  (Array.isArray(loaded.questions) ? loaded.questions : []).forEach((question) => {
    const normalized = safePublicAgentQuestion(question, {
      session: context.session,
    });
    skippedMalformed += normalized.skippedMalformed;
    if (normalized.question) questions.push(normalized.question);
  });
  return {
    loaded: withPublicSkippedMalformed(loaded, skippedMalformed),
    questions,
  };
}

export async function handleQuestionsRequest({ env = {}, context = {}, input = {}, waitUntil = null } = {}) {
  const { loaded, questions } = await loadPublicQuestionsForHandoff({
    env,
    context,
    waitUntil,
    allowCapped: true,
  });
  const ranked = rankQuestionsByPreferences(questions, input, context);
  const answerState = await loadAgentQuestionAnswerState({
    env,
    context,
    questions: ranked.questions,
  });
  const rankedWithAnswerState = applyAgentQuestionAnswerState(ranked.questions, answerState, context);
  const requestedQuestionId = safeString(input.questionId);
  const responseQuestions = requestedQuestionId
    ? rankedWithAnswerState.filter((question) => safeString(question.questionId) === requestedQuestionId)
    : sortAgentQuestionsByAnswerState(rankedWithAnswerState);
  const limit = questionsResponseLimit(input);
  const page = await env.AGENT_SERVICES.paginate(responseQuestions, { limit, cursor: input.cursor,
    fingerprint: await sha256Hex(JSON.stringify(responseQuestions)) });
  const flag = await readAgentSkillUpdateFlag(env);
  const body = {
    ok: true,
    sessionSlug: context.session.sessionSlug,
    permissionMode: context.permission.mode,
    complete: loaded.complete !== false,
    questionSource: loaded.source || '',
    questionSourceReason: loaded.reason || '',
    ...(Number(loaded.skippedMalformed || 0) > 0 ? { skippedMalformed: Number(loaded.skippedMalformed || 0) } : {}),
    relevance: ranked.relevance,
    answerState: {
      source: answerState.source,
      answeredCount: answerState.answeredCount,
      unansweredCount: answerState.unansweredCount,
      sort: requestedQuestionId ? 'requested_question' : 'unanswered_first',
    },
    skillVersion: CE_AGENT_ACCESS_SKILL_VERSION,
    skillUpdateAvailable: flag.updateAvailable === true,
    questions: page.items,
    nextCursor: page.nextCursor,
    hasMore: page.hasMore,
    total: page.total,
  };
  assertNoSecretShape(body, "Agent questions response must not serialize secrets.");
  return json(body);
}

export async function handleTagsRequest({ env = {}, context = {}, waitUntil = null } = {}) {
  const { questions } = await loadPublicQuestionsForHandoff({
    env,
    context,
    waitUntil,
  });
  const counts = new Map();
  questions.forEach((question) => {
    normalizeQuestionTags(question.tags).forEach((tag) => {
      counts.set(tag, (counts.get(tag) || 0) + 1);
    });
  });
  const tags = Array.from(counts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((left, right) => right.count - left.count || left.tag.localeCompare(right.tag))
    .slice(0, 200);
  const payload = {
    ok: true,
    sessionSlug: context.session.sessionSlug,
    tags,
    total: tags.length,
  };
  assertNoSecretShape(payload, "Agent tags response must not serialize secrets.");
  return json(payload);
}

export function normalizeCreateQuestionBatch(input = {}) {
  const questions = Array.isArray(input.questions)
    ? input.questions
    : Array.isArray(input.questionDrafts)
      ? input.questionDrafts
      : [];
  return questions
    .slice(0, 21)
    .map((question) =>
      question && typeof question === 'object' && !Array.isArray(question) ? question : { prompt: question },
    );
}

export function normalizeSourceUrl(value = '') {
  const text = safeString(value).slice(0, 2000);
  if (!text) return '';
  try {
    const url = new URL(text);
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    return url.toString();
  } catch {
    return '';
  }
}

export function sourceTagForUrl(value = '') {
  const url = normalizeSourceUrl(value);
  if (!url) return '';
  const hostname = safeString(new URL(url).hostname)
    .replace(/^www\./i, '')
    .toLowerCase();
  return normalizeQuestionTags([`src:${hostname}`])[0] || '';
}

export function referencesForCreatedQuestion(question = {}, batchSourceUrl = '') {
  const explicit = normalizeQuestionReferences(question.references);
  if (explicit.length) return explicit;
  const sourceUrl = normalizeSourceUrl(question.sourceUrl || question.url || batchSourceUrl);
  if (!sourceUrl) return [];
  return normalizeQuestionReferences([
    {
      type: 'url',
      url: sourceUrl,
      title: question.sourceTitle || question.title,
    },
  ]);
}

export function geoRefsForCreatedQuestion(question = {}, input = {}) {
  return normalizeQuestionGeoRefs(
    question.geoRefs || question.geoIds || question.geoId || input.geoRefs || input.geoIds || input.geoId,
  );
}

export function singleSelectForCreatedQuestion(question = {}) {
  const type = lower(question.questionType || question.type);
  const mode = lower(question.selectionMode || question.selectMode || question.select_mode);
  return (
    question.singleSelect === true ||
    question.singleChoice === true ||
    question.oneSelectionOnly === true ||
    mode === 'single' ||
    type === 'single_choice' ||
    type === 'single-choice'
  );
}

export async function handleCreateQuestionsRequest({ env = {}, context = {}, input = {} } = {}) {
  const batch = normalizeCreateQuestionBatch(input);
  if (!batch.length) {
    return json({ ok: false, reason: 'questions_create_batch_required' }, { status: 400 });
  }
  if (batch.length > 20) {
    return json(
      {
        ok: false,
        reason: 'questions_create_batch_too_large',
        maxQuestions: 20,
      },
      { status: 400 },
    );
  }
  const batchSourceUrl = normalizeSourceUrl(input.sourceUrl || input.url || input.link);
  if ((input.sourceUrl || input.url || input.link) && !batchSourceUrl) {
    return json({ ok: false, reason: 'source_url_invalid' }, { status: 400 });
  }
  const created = [];
  const skipped = [];
  for (const question of batch) {
    const prompt = safeString(question.prompt || question.questionText || question.text)
      .replace(/\s+/g, ' ')
      .slice(0, 1000);
    if (!prompt) {
      skipped.push({ prompt: '', reason: 'question_prompt_missing' });
      continue;
    }
    const references = referencesForCreatedQuestion(question, batchSourceUrl);
    const geoRefs = geoRefsForCreatedQuestion(question, input);
    const questionSourceUrl = references.find((reference) => reference.type === 'url')?.url || '';
    const sourceTag = sourceTagForUrl(questionSourceUrl || batchSourceUrl);
    const tags = normalizeQuestionTags([
      ...geoTagsFromRefs(geoRefs),
      ...(Array.isArray(question.tags) ? question.tags : normalizeQuestionTags(question.tags)),
      ...(sourceTag ? [sourceTag] : []),
    ]);
    let saved = null;
    try {
      saved = await persistAgentProposedQuestion({
        env,
        normalized: context.storageContext,
        sessionSlug: context.session.sessionSlug,
        prompt,
        questionType: question.questionType || question.type || 'binary',
        options: question.options,
        voiceCredits: question.voiceCredits ?? 99,
        ratingScale: question.ratingScale ||
          question.rating_scale || {
            min: question.min,
            max: question.max,
            step: question.step,
          },
        singleSelect: singleSelectForCreatedQuestion(question),
        tags,
        references,
        geoRefs,
        sessionContext:
          question.sessionContext ||
          input.sessionContext ||
          input.context ||
          sessionContextFromPolicySession(context.session),
        metadata: {
          source: 'agent_handoff',
          authMode: safeString(context.authMode),
          endpoint: '/api/agent/questions/create',
          sourceUrl: questionSourceUrl || batchSourceUrl,
        },
        createdAt: input.createdAt || question.createdAt || null,
      });
    } catch (error) {
      skipped.push({
        prompt,
        reason: safeString(error?.message || error) || 'question_create_failed',
      });
      continue;
    }
    if (!saved.ok) {
      skipped.push({
        prompt,
        reason: saved.reason || 'question_create_failed',
      });
      continue;
    }
    created.push({
      questionId: saved.questionId,
      prompt: saved.record.prompt,
      questionType: saved.record.questionType,
      ...(saved.record.singleSelect === true ? { singleSelect: true } : {}),
      tags: saved.record.tags,
      references: saved.record.references || [],
      geoRefs: saved.record.geoRefs || [],
    });
  }
  const payload = {
    ok: true,
    sessionSlug: context.session.sessionSlug,
    created,
    skipped,
  };
  assertNoSecretShape(payload, "Agent questions/create response must not serialize secrets.");
  return json(payload);
}

export async function handleGeoBacklinkRequest({ env = {}, context = {}, input = {}, waitUntil = null } = {}) {
  const questionId = safeString(input.questionId);
  if (!questionId) {
    return json({ ok: false, reason: 'question_id_required' }, { status: 400 });
  }
  const { questions } = await loadPublicQuestionsForHandoff({
    env,
    context,
    waitUntil,
  });
  const question = questions.find((candidate) => safeString(candidate.questionId) === questionId);
  if (!question) {
    return json(
      {
        ok: false,
        reason: 'question_not_found',
        sessionSlug: context.session.sessionSlug,
        questionId,
      },
      { status: 404 },
    );
  }
  const requestedGeoRefs = normalizeQuestionGeoRefs(input.geoRefs || input.geoId);
  const existingGeoRefs = normalizeQuestionGeoRefs(question.geoRefs);
  const geoRefs = requestedGeoRefs.length ? requestedGeoRefs : existingGeoRefs;
  const worker = sessionAgentOrigin(env);
  const questionEndpoint = `${worker}/api/agent/questions`;
  const payload = {
    ok: true,
    sessionSlug: context.session.sessionSlug,
    questionId: question.questionId,
    geoRefs,
    backlink: {
      type: 'context-engine-question',
      source: 'context-engine',
      sessionSlug: context.session.sessionSlug,
      questionId: question.questionId,
      questionEndpoint,
      questionQuery: {
        sessionSlug: context.session.sessionSlug,
        questionId: question.questionId,
      },
      prompt: safeString(question.prompt).slice(0, 500),
      tags: normalizeQuestionTags(question.tags),
      geoRefs,
    },
    note: 'Post backlink with the agent Geo credentials. The CE worker does not call Geo or store Geo tokens.',
  };
  assertNoSecretShape(payload, "Agent geo-backlink response must not serialize secrets.");
  return json(payload);
}
