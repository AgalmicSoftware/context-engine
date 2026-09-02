import { safeString, lower, safeJsonParse } from './runtimePrimitives.mjs';
import { assertNoSecretShape, redactSecrets } from './redaction.mjs';

const ANSWER_DRAFT_KV_PREFIX = 'telegram:answer-draft:';
const AGENT_QUESTION_VOTE_DECISION_KV_PREFIX = 'telegram:agent-question-vote-decision:v1:';
export const AGENT_QUESTION_VOTE_RECOMMENDATION_KV_PREFIX = 'telegram:agent-question-vote-recommendation:v1:';
const PROPOSED_QUESTION_KV_PREFIX = 'telegram:proposed-question:';
const LIGHTWEIGHT_GROUP_PROPOSAL_KV_PREFIX = 'telegram:lightweight-group-proposal:';

function sanitizeSessionSlug(value = '') {
  return lower(value).replace(/[^a-z0-9_-]/g, '').slice(0, 128);
}

async function listKvRecordsByPrefix(env = {}, prefix = '', {
  limit = 200,
} = {}) {
  const kv = env?.AGENT_ACTION_KV;
  if (!prefix || !kv || typeof kv.list !== 'function' || typeof kv.get !== 'function') return [];
  const records = [];
  const maxRecords = Math.max(1, Math.min(1000, Number(limit) || 200));
  let cursor = undefined;
  do {
    const page = await kv.list({
      prefix,
      limit: maxRecords,
      ...(cursor ? { cursor } : {}),
    }).catch(() => null);
    const keys = Array.isArray(page?.keys) ? page.keys : [];
    for (const entry of keys) {
      const key = safeString(entry?.name || entry);
      if (!key) continue;
      const record = safeJsonParse(await kv.get(key).catch(() => null), null);
      if (record && typeof record === 'object' && !Array.isArray(record)) {
        records.push({ ...record, key });
      }
      if (records.length >= maxRecords) return records;
    }
    cursor = page?.list_complete === false ? safeString(page.cursor) : '';
  } while (cursor);
  return records;
}

export async function listKvKeyMetadataByPrefix(env = {}, prefix = '', {
  limit = 200,
} = {}) {
  const kv = env?.AGENT_ACTION_KV;
  if (!prefix || !kv || typeof kv.list !== 'function') return [];
  const entries = [];
  const maxRecords = Math.max(1, Math.min(1000, Number(limit) || 200));
  let cursor = undefined;
  do {
    const page = await kv.list({
      prefix,
      limit: maxRecords,
      ...(cursor ? { cursor } : {}),
    }).catch(() => null);
    const keys = Array.isArray(page?.keys) ? page.keys : [];
    for (const entry of keys) {
      const key = safeString(entry?.name || entry);
      if (!key) continue;
      entries.push({
        key,
        metadata: entry && typeof entry === 'object' && !Array.isArray(entry)
          ? (entry.metadata || null)
          : null,
      });
      if (entries.length >= maxRecords) return entries;
    }
    cursor = page?.list_complete === false ? safeString(page.cursor) : '';
  } while (cursor);
  return entries;
}

async function readKvRecord(env = {}, key = '') {
  const kv = env?.AGENT_ACTION_KV;
  if (!key || !kv || typeof kv.get !== 'function') return null;
  const record = safeJsonParse(await kv.get(key).catch(() => null), null);
  return record && typeof record === 'object' && !Array.isArray(record)
    ? { ...record, key }
    : null;
}

export function buildTelegramAgentActivityMetadata({
  type = '',
  status = '',
  createdAt = '',
  pendingAction = '',
  sessionSlug = '',
  questionId = '',
  telegramUserId = '',
  targetTelegramUserId = '',
  editCount = null,
  originSource = '',
} = {}) {
  const metadata = {
    v: 1,
    t: safeString(type),
    s: safeString(status),
    c: safeString(createdAt),
    p: safeString(pendingAction),
    sg: sanitizeSessionSlug(sessionSlug),
    questionId: safeString(questionId),
  };
  const userId = safeString(telegramUserId);
  const targetUserId = safeString(targetTelegramUserId);
  if (userId) metadata.u = userId;
  if (targetUserId) metadata.tu = targetUserId;
  if (editCount !== null && editCount !== undefined && Number.isFinite(Number(editCount))) {
    metadata.e = Number(editCount);
  }
  const origin = safeString(originSource);
  if (origin) metadata.o = origin.slice(0, 64);
  assertNoSecretShape(metadata, 'Telegram agent activity metadata must not serialize secrets.');
  return metadata;
}

function recordFromActivityMetadata(metadata = {}, key = '') {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata) || Number(metadata.v) !== 1) return null;
  const type = safeString(metadata.t);
  const common = {
    key,
    sessionSlug: sanitizeSessionSlug(metadata.sg),
    questionId: safeString(metadata.questionId || metadata.q),
    status: safeString(metadata.s),
    createdAt: safeString(metadata.c),
    selectedAt: safeString(metadata.c),
    telegramUserId: safeString(metadata.u),
  };
  if (!common.sessionSlug || !type) return null;
  if (type === 'answer_draft') {
    return {
      ...common,
      answerLabel: '',
      answerValue: '',
      controlType: '',
      editCount: Number(metadata.e || 0),
      originSource: safeString(metadata.o),
    };
  }
  if (type === 'proposed_question') {
    return {
      ...common,
      createdByTelegramUserId: safeString(metadata.u),
      prompt: '',
      questionType: '',
      tags: [],
    };
  }
  if (type === 'group_proposal') {
    return {
      ...common,
      proposedBy: safeString(metadata.u),
      targetTelegramUserId: safeString(metadata.tu),
      message: '',
    };
  }
  return null;
}

function createdAtOf(item = {}) {
  return safeString(item.createdAt || item.updatedAt || item.selectedAt || item.approvedAt);
}

function publicItem(item = {}, {
  includeContent = false,
} = {}) {
  const out = redactSecrets(item);
  if (!includeContent) delete out.content;
  assertNoSecretShape(out, 'Telegram agent activity items must not serialize secrets.');
  return out;
}

function draftItem(record = {}, options = {}) {
  return publicItem({
    type: 'answer_draft',
    sessionSlug: sanitizeSessionSlug(record.sessionSlug),
    questionId: safeString(record.questionId),
    createdAt: safeString(record.selectedAt || record.createdAt),
    status: safeString(record.status || 'draft_saved'),
    editCount: Number(record.editCount || 0),
    originSource: safeString(record.originSource || record.origin?.source),
    summary: options.includeContent
      ? `Draft: ${safeString(record.answerLabel).slice(0, 140)}`
      : 'Answer draft saved for review',
    pendingAction: 'review_draft',
    content: {
      answerLabel: safeString(record.answerLabel),
      answerValue: safeString(record.answerValue),
      controlType: safeString(record.controlType),
    },
  }, options);
}

function recommendationItems(record = {}, options = {}) {
  const recommendations = Array.isArray(record.recommendations) ? record.recommendations : [];
  return recommendations.map((recommendation) => publicItem({
    type: 'question_vote_recommendation',
    sessionSlug: sanitizeSessionSlug(record.sessionSlug),
    questionId: safeString(recommendation.questionId),
    createdAt: safeString(record.createdAt),
    status: 'pending_review',
    summary: `Suggested ${safeString(recommendation.suggestedVote || 'vote')} vote`,
    pendingAction: 'approve_or_override_agent_question_votes',
    content: {
      prompt: safeString(recommendation.prompt),
      suggestedVote: safeString(recommendation.suggestedVote),
      reason: safeString(recommendation.reason),
      confidence: recommendation.confidence ?? null,
    },
  }, options));
}

function decisionItems(record = {}, options = {}) {
  const decisions = Array.isArray(record.decisions) ? record.decisions : [];
  return decisions.map((decision) => publicItem({
    type: 'question_vote_decision',
    sessionSlug: sanitizeSessionSlug(record.sessionSlug),
    questionId: safeString(decision.questionId),
    createdAt: safeString(record.createdAt),
    status: decision.applied ? 'applied' : safeString(decision.approvalStatus || 'pending_review'),
    summary: decision.applied
      ? `Applied ${safeString(decision.finalVote || decision.suggestedVote)} vote`
      : `Pending ${safeString(decision.suggestedVote || decision.finalVote || 'vote')} decision`,
    pendingAction: decision.applied ? '' : 'approve_or_override_agent_question_votes',
    content: {
      suggestedVote: safeString(decision.suggestedVote),
      finalVote: safeString(decision.finalVote),
      reason: safeString(decision.reason),
      agentNote: safeString(decision.agentNote),
      humanNote: safeString(decision.humanNote),
    },
  }, options));
}

function proposedQuestionItem(record = {}, options = {}) {
  const prompt = safeString(record.prompt);
  return publicItem({
    type: 'proposed_question',
    sessionSlug: sanitizeSessionSlug(record.sessionSlug),
    questionId: safeString(record.questionId),
    createdAt: safeString(record.createdAt),
    status: safeString(record.status || 'active'),
    summary: prompt ? `Question proposed: ${prompt.slice(0, 140)}` : 'Question proposed for review',
    pendingAction: '',
    content: {
      prompt,
      questionType: safeString(record.questionType),
      tags: Array.isArray(record.tags) ? record.tags.map(safeString).filter(Boolean) : [],
    },
  }, options);
}

function groupProposalItem(record = {}, options = {}) {
  return publicItem({
    type: 'group_proposal',
    sessionSlug: sanitizeSessionSlug(record.sessionSlug),
    createdAt: safeString(record.createdAt),
    status: safeString(record.status || 'pending_user_decision'),
    summary: safeString(record.message) || 'Group membership suggestion',
    pendingAction: 'review_group_proposal',
    content: {
      categoryId: safeString(record.categoryId),
      optionIds: Array.isArray(record.optionIds) ? record.optionIds.map(safeString).filter(Boolean) : [],
      message: safeString(record.message),
    },
  }, options);
}

async function listMetadataBackedRecords(env = {}, prefix = '', {
  includeContent = false,
  limit = 200,
  filter = () => true,
} = {}) {
  if (includeContent) {
    return (await listKvRecordsByPrefix(env, prefix, { limit })).filter(filter);
  }
  const entries = await listKvKeyMetadataByPrefix(env, prefix, { limit });
  const records = [];
  for (const entry of entries) {
    const metadataRecord = recordFromActivityMetadata(entry.metadata, entry.key);
    if (metadataRecord && filter(metadataRecord)) {
      records.push(metadataRecord);
      continue;
    }
    const record = await readKvRecord(env, entry.key);
    if (record && filter(record)) records.push(record);
  }
  return records;
}

export async function listTelegramAgentActivity({
  env = {},
  telegramUserId = '',
  sessionSlugs = [],
  includeContent = false,
  limit = 50,
} = {}) {
  const userId = safeString(telegramUserId);
  if (!userId) return [];
  const slugs = Array.from(new Set((Array.isArray(sessionSlugs) ? sessionSlugs : [sessionSlugs])
    .map(sanitizeSessionSlug)
    .filter(Boolean)));
  const slugSet = new Set(slugs);
  const options = { includeContent };
  const items = [];

  const drafts = await listMetadataBackedRecords(env, `${ANSWER_DRAFT_KV_PREFIX}${userId}:`, {
    includeContent,
    limit: 300,
    filter: (record) => !slugSet.size || slugSet.has(sanitizeSessionSlug(record.sessionSlug)),
  });
  drafts
    .forEach((record) => items.push(draftItem(record, options)));

  for (const slug of slugs) {
    const recommendations = await listKvRecordsByPrefix(env, `${AGENT_QUESTION_VOTE_RECOMMENDATION_KV_PREFIX}${slug}:${userId}:`, { limit: 300 });
    recommendations
      .filter((record) => safeString(record.telegramUserId) === userId)
      .forEach((record) => items.push(...recommendationItems(record, options)));

    const decisions = await listKvRecordsByPrefix(env, `${AGENT_QUESTION_VOTE_DECISION_KV_PREFIX}${slug}:${userId}:`, { limit: 300 });
    decisions
      .filter((record) => safeString(record.telegramUserId) === userId)
      .forEach((record) => items.push(...decisionItems(record, options)));

    const proposed = await listMetadataBackedRecords(env, `${PROPOSED_QUESTION_KV_PREFIX}${slug}:`, {
      includeContent,
      limit: 1000,
      filter: (record) => safeString(record.createdByTelegramUserId) === userId,
    });
    proposed
      .forEach((record) => items.push(proposedQuestionItem(record, options)));

    const groupProposals = await listMetadataBackedRecords(env, `${LIGHTWEIGHT_GROUP_PROPOSAL_KV_PREFIX}${slug}:`, {
      includeContent,
      limit: 1000,
      filter: (record) => [record.proposedBy, record.targetTelegramUserId].map(safeString).includes(userId),
    });
    groupProposals
      .forEach((record) => items.push(groupProposalItem(record, options)));
  }

  return items
    .filter(Boolean)
    .sort((left, right) => Date.parse(createdAtOf(right)) - Date.parse(createdAtOf(left)))
    .slice(0, Math.max(1, Math.min(100, Number(limit) || 50)));
}

export function summarizeTelegramAgentActivityCounts(items = []) {
  const counts = {
    total: 0,
    drafts: 0,
    pendingVotes: 0,
    voteDecisions: 0,
    proposedQuestions: 0,
    groupProposals: 0,
  };
  for (const item of Array.isArray(items) ? items : []) {
    counts.total += 1;
    if (item.type === 'answer_draft') counts.drafts += 1;
    if (item.type === 'question_vote_recommendation') counts.pendingVotes += 1;
    if (item.type === 'question_vote_decision') counts.voteDecisions += 1;
    if (item.type === 'proposed_question') counts.proposedQuestions += 1;
    if (item.type === 'group_proposal') counts.groupProposals += 1;
  }
  return counts;
}
