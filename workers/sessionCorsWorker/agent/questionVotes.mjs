import { safeString, lower, safeJsonParse, stableFingerprint, kvKeySafePart, sanitizeSessionSlug } from './runtimePrimitives.mjs';
import { normalizeQuestionTags } from './agentQuestionProposals.mjs';
import { buildOpaqueActionId } from './opaqueActions.mjs';
import { assertNoSecretShape } from './redaction.mjs';
import { loadAgentSettings } from './agentSettings.mjs';
import { AGENT_QUESTION_VOTE_RECOMMENDATION_KV_PREFIX, listAgentActivity } from './agentActivity.mjs';
import { AGENT_QUESTION_VOTE_DECISION_KV_PREFIX, QUESTION_VOTE_KV_PREFIX } from './httpConstants.mjs';
import { firstValue, json } from './httpInput.mjs';
import { loadPublicQuestionsForHandoff, normalizePreferenceSessionHints, normalizePreferenceTagHints, questionRelevance } from './questions.mjs';

export function normalizeAgentQuestionVote(value = '') {
  const vote = lower(value);
  return vote === 'up' || vote === 'down' ? vote : '';
}

export function agentQuestionVoteKey({ sessionSlug = '', questionId = '', telegramUserId = '' } = {}) {
  const slug = sanitizeSessionSlug(sessionSlug);
  const qid = kvKeySafePart(questionId);
  const user = kvKeySafePart(telegramUserId);
  if (!slug || !qid || !user) return '';
  return `${QUESTION_VOTE_KV_PREFIX}${slug}:${qid}:${user}`;
}

export function normalizeQuestionIdSet(value) {
  const source = Array.isArray(value) ? value : safeString(value).split(/[\n,;|]+/);
  return new Set(source.map(safeString).filter(Boolean));
}

export function normalizeNegativePreferenceTagHints(input = {}) {
  const preferences =
    input.preferences && typeof input.preferences === 'object' && !Array.isArray(input.preferences)
      ? input.preferences
      : {};
  const source = [
    input.deprioritizeTags,
    input.downvoteTags,
    input.irrelevantTags,
    input.avoidTags,
    preferences.deprioritizeTags,
    preferences.downvoteTags,
    preferences.irrelevantTags,
    preferences.avoidTags,
    preferences.dislikedTags,
  ].flatMap((value) => (Array.isArray(value) ? value : safeString(value).split(/[\n,;|]+/)));
  return normalizeQuestionTags(source);
}

export function recommendationLimit(input = {}) {
  const value = Number(input.limit || input.topN || input.count || 10);
  if (!Number.isFinite(value) || value <= 0) return 10;
  return Math.max(1, Math.min(20, Math.floor(value)));
}

export function buildQuestionVoteRecommendations(questions = [], input = {}, context = {}) {
  const tagHints = normalizePreferenceTagHints(input);
  const negativeTags = normalizeNegativePreferenceTagHints(input);
  const sessionHints = normalizePreferenceSessionHints(input);
  const preferences =
    input.preferences && typeof input.preferences === 'object' && !Array.isArray(input.preferences)
      ? input.preferences
      : {};
  const importantIds = normalizeQuestionIdSet(input.importantQuestionIds || preferences.importantQuestionIds);
  const deprioritizeIds = normalizeQuestionIdSet(input.deprioritizeQuestionIds || preferences.deprioritizeQuestionIds);
  const limit = recommendationLimit(input);
  const hasTargeting = Boolean(
    tagHints.length ||
    negativeTags.length ||
    sessionHints.slugs.length ||
    sessionHints.tags.length ||
    importantIds.size ||
    deprioritizeIds.size,
  );
  const candidates = (Array.isArray(questions) ? questions : []).filter((question) => question.answerable === true);
  const entries = candidates
    .map((question, fallbackOrder) => {
      const positive = questionRelevance(question, {
        tagHints,
        sessionHints,
        session: context.session,
      });
      const negative = questionRelevance(question, {
        tagHints: negativeTags,
        sessionHints: { slugs: [], tags: [] },
        session: context.session,
      });
      let positiveScore = positive.score;
      let negativeScore = negative.score;
      if (importantIds.has(question.questionId)) positiveScore += 50;
      if (deprioritizeIds.has(question.questionId)) negativeScore += 50;
      const suggestedVote = negativeScore > positiveScore && negativeScore > 0 ? 'down' : 'up';
      const relevanceScore = Math.max(positiveScore, negativeScore);
      const hasTargetedMatch = relevanceScore > 0;
      const score = hasTargetedMatch ? relevanceScore : candidates.length - fallbackOrder;
      const confidence = Math.max(0.35, Math.min(0.95, 0.45 + score / 100));
      const matchedTags = suggestedVote === 'down' ? negative.matchedTags : positive.matchedTags;
      const reason = matchedTags.length
        ? `Matched ${suggestedVote === 'down' ? 'deprioritized' : 'relevant'} tags: ${matchedTags.join(', ')}.`
        : 'No strong tag match; surfaced from the active question list for human review.';
      return {
        questionId: question.questionId,
        questionType: question.questionType,
        prompt: question.prompt,
        tags: Array.isArray(question.tags) ? question.tags : [],
        suggestedVote,
        score,
        confidence: Number(confidence.toFixed(2)),
        reason,
        agentNote: `Suggested ${suggestedVote}vote: ${reason}`,
        relevance: {
          positiveScore,
          negativeScore,
          matchedTags,
          matchedSessions: positive.matchedSessions,
        },
        hasTargetedMatch,
        relevanceScore,
        fallbackOrder,
      };
    })
    .filter((entry) => !hasTargeting || entry.hasTargetedMatch);
  entries.sort((left, right) => {
    if (!hasTargeting) return left.fallbackOrder - right.fallbackOrder;
    return right.relevanceScore - left.relevanceScore ||
      (left.suggestedVote === right.suggestedVote ? 0 : left.suggestedVote === 'up' ? -1 : 1) ||
      left.fallbackOrder - right.fallbackOrder;
  });
  return {
    recommendations: entries.slice(0, limit).map(({ hasTargetedMatch, relevanceScore, fallbackOrder, ...entry }) => entry),
    relevance: {
      tags: tagHints,
      downvoteTags: negativeTags,
      sessionsAttended: sessionHints.slugs,
      sessionTags: sessionHints.tags,
    },
  };
}

export async function persistAgentQuestionVoteRecommendations({
  env = {},
  context = {},
  input = {},
  recommendations = [],
  createdAt = new Date().toISOString(),
} = {}) {
  const kv = env?.AGENT_ACTION_KV;
  if (!kv || typeof kv.put !== 'function')
    return {
      ok: false,
      reason: 'question_vote_recommendation_storage_unavailable',
    };
  const telegramUserId = safeString(context.storageContext?.user?.telegramUserId);
  const sessionSlug = sanitizeSessionSlug(context.session?.sessionSlug);
  if (!telegramUserId || !sessionSlug)
    return {
      ok: false,
      reason: 'question_vote_recommendation_context_incomplete',
    };
  const requestId =
    safeString(input.requestId || input.idempotencyKey) ||
    buildOpaqueActionId(
      `agent_question_vote_recommendations|${sessionSlug}|${telegramUserId}|${stableFingerprint(recommendations)}|${createdAt}`,
    );
  const record = {
    type: 'telegram_agent_question_vote_recommendation',
    version: 1,
    requestId,
    sessionSlug,
    telegramUserId,
    status: 'pending_review',
    source: 'agent_handoff',
    authMode: safeString(context.authMode),
    recommendations: (Array.isArray(recommendations) ? recommendations : []).slice(0, 20).map((recommendation) => ({
      questionId: safeString(recommendation.questionId),
      prompt: safeString(recommendation.prompt).slice(0, 500),
      suggestedVote: normalizeAgentQuestionVote(recommendation.suggestedVote),
      reason: safeString(recommendation.reason).slice(0, 800),
      confidence: Number(recommendation.confidence || 0) || 0,
    })),
    createdAt,
  };
  assertNoSecretShape(record, "Agent question vote recommendation records must not serialize secrets.");
  await kv.put(
    `${AGENT_QUESTION_VOTE_RECOMMENDATION_KV_PREFIX}${sessionSlug}:${kvKeySafePart(telegramUserId)}:${requestId}`,
    JSON.stringify(record),
  );
  return { ok: true, requestId, record };
}

export const SECRETISH_METADATA_KEY_RE =
  /(?:secret|token|api.?key|private.?key|password|authorization|bearer|signature|mnemonic|seed)/i;

export function sanitizeResearchMetadata(value, { depth = 0, maxString = 600 } = {}) {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string') return value.slice(0, maxString);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    if (depth >= 3) return [];
    return value.slice(0, 20).map((entry) => sanitizeResearchMetadata(entry, { depth: depth + 1, maxString }));
  }
  if (typeof value !== 'object') return safeString(value).slice(0, maxString);
  if (depth >= 3) return {};
  const result = {};
  Object.entries(value)
    .slice(0, 30)
    .forEach(([key, entry]) => {
      const safeKey = safeString(key)
        .replace(/[^a-zA-Z0-9_.:-]+/g, '_')
        .slice(0, 80);
      if (!safeKey || SECRETISH_METADATA_KEY_RE.test(safeKey)) return;
      result[safeKey] = sanitizeResearchMetadata(entry, {
        depth: depth + 1,
        maxString,
      });
    });
  return result;
}

export function normalizeAgentMetadata(input = {}) {
  const agent =
    input.agent && typeof input.agent === 'object' && !Array.isArray(input.agent)
      ? input.agent
      : input.agentMetadata && typeof input.agentMetadata === 'object' && !Array.isArray(input.agentMetadata)
        ? input.agentMetadata
        : {};
  return sanitizeResearchMetadata({
    agentId: firstValue(input.agentId, agent.agentId, agent.id),
    agentName: firstValue(input.agentName, agent.agentName, agent.name),
    platform: firstValue(input.agentPlatform, agent.platform, agent.vendor),
    model: firstValue(input.model, agent.model),
    version: firstValue(input.agentVersion, agent.version),
  });
}

export function normalizeApprovalText(value = '') {
  return safeString(sanitizeResearchMetadata(value, { maxString: 1500 }));
}

export function explicitApprovalValue(value) {
  if (value === true || value === false) return value;
  const normalized = lower(value);
  if (['approve', 'approved', 'accept', 'accepted', 'yes', 'use', 'used', 'true'].includes(normalized)) return true;
  if (['reject', 'rejected', 'disapprove', 'decline', 'skip', 'no', 'false'].includes(normalized)) return false;
  return null;
}

export function approvalFromNaturalLanguage(approvalText = '', questionId = '') {
  const text = lower(approvalText);
  if (!text) return null;
  const qid = lower(questionId);
  if (qid && text.includes(qid)) {
    const index = text.indexOf(qid);
    const local = text.slice(Math.max(0, index - 48), Math.min(text.length, index + qid.length + 48));
    if (/\b(reject|rejected|disapprove|decline|skip|do not|don't|no)\b/.test(local)) return false;
    if (/\b(approve|approved|accept|accepted|yes|use|looks good)\b/.test(local)) return true;
  }
  if (/\b(approve all|accept all|use all|looks good|yes,? apply|apply all)\b/.test(text)) return true;
  if (/\b(reject all|decline all|do not apply|don't apply|no,? do not)\b/.test(text)) return false;
  return null;
}

export function finalVoteFromNaturalLanguage(approvalText = '', questionId = '') {
  const text = lower(approvalText);
  const qid = lower(questionId);
  if (!text || !qid || !text.includes(qid)) return '';
  const index = text.indexOf(qid);
  const local = text.slice(Math.max(0, index - 48), Math.min(text.length, index + qid.length + 48));
  if (/\b(up|upvote|\+1)\b/.test(local)) return 'up';
  if (/\b(down|downvote|-1)\b/.test(local)) return 'down';
  return '';
}

export async function applyAgentQuestionVotes({
  env = {},
  context = {},
  input = {},
  questions = [],
  recommendations = [],
  createdAt = new Date().toISOString(),
} = {}) {
  const kv = env?.AGENT_ACTION_KV;
  if (!kv || typeof kv.put !== 'function') {
    return { ok: false, reason: 'question_vote_storage_unavailable' };
  }
  const telegramUserId = safeString(context.storageContext?.user?.telegramUserId);
  const sessionSlug = sanitizeSessionSlug(context.session?.sessionSlug);
  if (!telegramUserId || !sessionSlug) return { ok: false, reason: 'question_vote_context_incomplete' };
  const settings = await loadAgentSettings({
    env,
    sessionSlug,
    telegramUserId,
  });
  const autoApplyRequested = input.autoApply === true || lower(input.applyMode) === 'auto';
  if (autoApplyRequested && settings.agentAutoApplyQuestionVotes === false) {
    return {
      ok: false,
      reason: 'agent_question_vote_auto_apply_disabled',
      settings: { agentAutoApplyQuestionVotes: false },
    };
  }

  const questionById = new Map(
    (Array.isArray(questions) ? questions : [])
      .filter((question) => question.answerable === true)
      .map((question) => [safeString(question.questionId), question]),
  );
  const recommendationById = new Map(
    (Array.isArray(recommendations) ? recommendations : []).map((recommendation) => [
      safeString(recommendation.questionId),
      recommendation,
    ]),
  );
  const decisionInputs = Array.isArray(input.decisions)
    ? input.decisions
    : Array.isArray(input.votes)
      ? input.votes
      : [];
  const sourceDecisions = decisionInputs.length ? decisionInputs : autoApplyRequested ? recommendations : [];
  const approvalText = normalizeApprovalText(input.approvalText || input.humanApproval || input.userApproval || '');
  const agentMetadata = normalizeAgentMetadata(input);
  const actionMetadata = sanitizeResearchMetadata({
    ...(input.metadata && typeof input.metadata === 'object' && !Array.isArray(input.metadata) ? input.metadata : {}),
    source: 'agent_handoff',
    authMode: safeString(context.authMode),
    clientSource: firstValue(input.source, input.client, input.integration, input.metadata?.source),
    runId: firstValue(input.runId, input.requestRunId, input.metadata?.runId),
    requestId: firstValue(input.requestId, input.idempotencyKey, input.metadata?.requestId),
    preferenceTags: normalizePreferenceTagHints(input),
    downvoteTags: normalizeNegativePreferenceTagHints(input),
  });
  const appliedVotes = [];
  const skipped = [];
  const decisions = [];
  for (const entry of sourceDecisions) {
    const questionId = safeString(entry?.questionId || entry?.id);
    const question = questionById.get(questionId);
    if (!question) {
      skipped.push({ questionId, reason: 'question_not_active_or_answerable' });
      continue;
    }
    const recommendation = recommendationById.get(questionId) || {};
    const suggestedVote = normalizeAgentQuestionVote(entry?.suggestedVote || recommendation.suggestedVote);
    const naturalVote = finalVoteFromNaturalLanguage(approvalText, questionId);
    const finalVote = normalizeAgentQuestionVote(entry?.finalVote || entry?.vote || naturalVote || suggestedVote);
    if (!finalVote) {
      skipped.push({ questionId, reason: 'vote_not_understood' });
      continue;
    }
    const explicitApproval = explicitApprovalValue(
      entry?.approved ?? entry?.approval ?? entry?.decision ?? entry?.status,
    );
    const naturalApproval = approvalFromNaturalLanguage(approvalText, questionId);
    const approved = autoApplyRequested ? true : (explicitApproval ?? naturalApproval ?? false);
    const approvalStatus = autoApplyRequested
      ? 'agent_auto_applied'
      : approved
        ? 'caller_authorized'
        : 'caller_rejected_or_missing';
    const decision = {
      questionId,
      suggestedVote: suggestedVote || finalVote,
      finalVote,
      approved,
      applied: approved,
      overridden: approved && Boolean(suggestedVote) && finalVote !== suggestedVote,
      approvalStatus,
      agentNote: safeString(entry?.agentNote || recommendation.agentNote).slice(0, 800),
      humanNote: safeString(entry?.humanNote || entry?.note).slice(0, 800),
      reason: safeString(entry?.reason || recommendation.reason).slice(0, 800),
      confidence: Number(entry?.confidence || recommendation.confidence || 0) || 0,
    };
    decisions.push(decision);
    if (!approved) {
      skipped.push({ questionId, reason: 'question_vote_not_approved' });
      continue;
    }
    const voteKey = agentQuestionVoteKey({
      sessionSlug,
      questionId,
      telegramUserId,
    });
    if (!voteKey) {
      skipped.push({ questionId, reason: 'question_vote_ref_incomplete' });
      continue;
    }
    const previous = typeof kv.get === 'function' ? safeJsonParse(await kv.get(voteKey).catch(() => null), null) : null;
    const voteRecord = {
      type: 'telegram_mini_app_question_vote',
      version: 1,
      sessionSlug,
      questionId,
      telegramUserId,
      vote: finalVote,
      weight: 1,
      votingMode: 'single',
      source: 'agent_handoff',
      agentMetadata,
      agentNote: decision.agentNote,
      agentSuggestedVote: decision.suggestedVote,
      applyConsent: { source: autoApplyRequested ? 'agent_auto_apply' : 'caller_assertion', approved },
      // Caller authorization permits the vote but is not independently verified human review.
      // Keep the legacy record shape for readers without creating new human-review evidence.
      humanApproval: {
        status: approvalStatus,
        approved: false,
        humanReviewed: false,
        overridden: decision.overridden,
        approvalText,
        humanNote: decision.humanNote,
      },
      actionMetadata,
      quadraticVoting: {
        enabled: false,
        maxCredits: 1,
        upgradePath: 'replace weight with credit-derived weight after credit allocation is enabled',
      },
      createdAt: safeString(previous?.createdAt) || createdAt,
      updatedAt: createdAt,
    };
    assertNoSecretShape(voteRecord, "Agent question vote records must not serialize secrets.");
    await kv.put(voteKey, JSON.stringify(voteRecord));
    appliedVotes.push({ questionId, vote: finalVote, voteKey, approvalStatus });
  }
  const decisionFingerprint = stableFingerprint({
    sessionSlug,
    telegramUserId,
    decisions,
    approvalText,
    actionMetadata,
  });
  const requestId =
    safeString(input.requestId || input.idempotencyKey) ||
    buildOpaqueActionId(`agent_question_votes|${sessionSlug}|${telegramUserId}|${decisionFingerprint}|${createdAt}`);
  const decisionRecordKey = `${AGENT_QUESTION_VOTE_DECISION_KV_PREFIX}${sessionSlug}:${kvKeySafePart(telegramUserId)}:${requestId}`;
  const decisionRecord = {
    type: 'telegram_agent_question_vote_decision',
    version: 1,
    requestId,
    sessionSlug,
    telegramUserId,
    autoApplyRequested,
    autoApplyAllowed: settings.agentAutoApplyQuestionVotes !== false,
    approvalText,
    agentMetadata,
    actionMetadata,
    decisions,
    appliedVotes,
    skipped,
    createdAt,
  };
  assertNoSecretShape(decisionRecord, "Agent question vote decision records must not serialize secrets.");
  await kv.put(decisionRecordKey, JSON.stringify(decisionRecord));
  return {
    ok: true,
    requestId,
    decisionRecordKey,
    settings: {
      agentAutoApplyQuestionVotes: settings.agentAutoApplyQuestionVotes !== false,
    },
    appliedVotes,
    skipped,
    decisions,
  };
}

export async function handleQuestionVoteRecommendationsRequest({ env = {}, context = {}, input = {}, waitUntil = null } = {}) {
  if ((input.autoApply === true || lower(input.applyMode) === 'auto') && !context.delegation?.scopes?.includes('apply_question_votes')) return json({ ok: false, reason: 'agent_token_scope_denied', requiredScope: 'apply_question_votes' }, { status: 403 });
  const { loaded, questions } = await loadPublicQuestionsForHandoff({
    env,
    context,
    waitUntil,
  });
  const built = buildQuestionVoteRecommendations(questions, input, context);
  const recommendationRecord = built.recommendations.length
    ? await persistAgentQuestionVoteRecommendations({
        env,
        context,
        input,
        recommendations: built.recommendations,
        createdAt: input.createdAt || new Date().toISOString(),
      })
    : { ok: false, reason: 'no_recommendations' };
  const settings = await loadAgentSettings({
    env,
    sessionSlug: context.session.sessionSlug,
    telegramUserId: context.storageContext.user.telegramUserId,
  });
  let autoApply = null;
  if (input.autoApply === true || lower(input.applyMode) === 'auto') {
    autoApply =
      settings.agentAutoApplyQuestionVotes === false
        ? {
            ok: false,
            reason: 'agent_question_vote_auto_apply_disabled',
            appliedVotes: [],
          }
        : await applyAgentQuestionVotes({
            env,
            context,
            input: { ...input, autoApply: true },
            questions,
            recommendations: built.recommendations,
          });
  }
  return json({
    ok: true,
    sessionSlug: context.session.sessionSlug,
    permissionMode: context.permission.mode,
    questionSource: loaded.source || '',
    questionSourceReason: loaded.reason || '',
    metaQuestion: {
      questionId: 'meta-question-importance',
      prompt: 'Which active questions are most important for this user to prioritize?',
      responseMode: 'approve_or_override_agent_question_votes',
    },
    settings: {
      agentAutoApplyQuestionVotes: settings.agentAutoApplyQuestionVotes !== false,
    },
    relevance: built.relevance,
    recommendations: built.recommendations,
    recommendationRecord: recommendationRecord.ok
      ? {
          requestId: recommendationRecord.requestId,
          status: recommendationRecord.record.status,
        }
      : null,
    autoApply,
    approval: {
      endpoint: '/api/agent/question-votes/apply',
      note: 'Send authorized, rejected, or overridden vote decisions. Approval text is stored as a caller assertion, not verified human-review evidence.',
    },
  });
}

export async function handleQuestionVoteApplyRequest({ env = {}, context = {}, input = {}, waitUntil = null } = {}) {
  const { questions } = await loadPublicQuestionsForHandoff({
    env,
    context,
    waitUntil,
  });
  const recommendations = Array.isArray(input.recommendations)
    ? input.recommendations
    : buildQuestionVoteRecommendations(questions, input, context).recommendations;
  const applied = await applyAgentQuestionVotes({
    env,
    context,
    input,
    questions,
    recommendations,
  });
  return json(applied, { status: applied.ok ? 200 : 400 });
}

export async function handleActionsRequest({ env = {}, context = {}, input = {} } = {}) {
  const sessionSlug = sanitizeSessionSlug(context.session?.sessionSlug || input.sessionSlug);
  const items = await listAgentActivity({
    env,
    telegramUserId: context.storageContext.user.telegramUserId,
    sessionSlugs: sessionSlug ? [sessionSlug] : [],
    includeContent: true,
    limit: Number(input.limit || 50) || 50,
  });
  assertNoSecretShape(items, "Agent activity response must not serialize secrets.");
  return json({
    ok: true,
    sessionSlug,
    telegramUserId: context.storageContext.user.telegramUserId,
    actions: items,
  });
}
