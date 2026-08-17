#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

const DEMO_POLIS_PATH = path.join(
  REPO_ROOT,
  'client',
  'src',
  'variables',
  'demo',
  'demo_polis_data.json'
);
const TREE_VOTES_PATH = path.join(
  REPO_ROOT,
  'client',
  'src',
  'variables',
  'demo',
  'historical_figures_tree_qs_and_votes.json'
);
const OUTPUT_PATH = path.join(
  REPO_ROOT,
  'client',
  'src',
  'variables',
  'demo',
  'demo_analysis_data.json'
);
const GENERATION_CONFIG_PATH = path.join(
  REPO_ROOT,
  'client',
  'src',
  'variables',
  'demo',
  'demo_analysis_generation_config.json'
);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

const generationConfig = readJson(GENERATION_CONFIG_PATH);

export const TREE_AGREE_THRESHOLD = 2;
export const TREE_DISAGREE_THRESHOLD = -2;
export const SEMANTIC_TREE_NODE_IDS_BY_QUESTION_ID = Object.freeze(
  generationConfig?.treeNodeIdsByQuestionId || {}
);
export const QUESTION_OVERRIDES_BY_QUESTION_ID = Object.freeze(
  generationConfig?.questionOverridesByQuestionId || {}
);
export const SYNTHETIC_PARTICIPANT_CONFIG = Object.freeze(
  generationConfig?.syntheticParticipantConfig || {}
);
const BASE_PROFILE_ID = 'historical_baseline';
const BASE_PROFILE_LABEL = 'Historical persona baseline';
const BASE_PROFILE_CONFIDENCE = 'High';
const BASE_PROFILE_RATIONALE = 'Original historical-figure vote row anchored to the canonical demo persona fixtures and explicit tree/POLIS mappings.';

const HASH_SEED = 2166136261 >>> 0;
const HASH_DIVISOR = 0xffffffff;
const UTC_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const UTC_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const clampNumber = (value, min, max) => Math.min(max, Math.max(min, value));
const padUtcTime = (value) => String(Number(value) || 0).padStart(2, '0');

const formatDemoUtcDateTime = (timestamp) => {
  const date = new Date(Number(timestamp));
  if (Number.isNaN(date.getTime())) return '';

  return [
    UTC_WEEKDAYS[date.getUTCDay()],
    UTC_MONTHS[date.getUTCMonth()],
    padUtcTime(date.getUTCDate()),
    `${padUtcTime(date.getUTCHours())}:${padUtcTime(date.getUTCMinutes())}:${padUtcTime(date.getUTCSeconds())}`,
    'UTC',
    date.getUTCFullYear(),
  ].join(' ');
};

const normalizeSourceTag = (value = '') => {
  const trimmed = String(value || '').trim().toLowerCase();
  if (!trimmed) return '';
  if (trimmed === 'sci-fi' || trimmed === 'scifi') return 'scifi';
  if (trimmed === 'lesswrong') return 'lesswrong';
  return trimmed;
};

const readSourceTags = (comment = {}) => String(comment?.sources || '')
  .split(',')
  .map((source) => normalizeSourceTag(source))
  .filter(Boolean);

const hashStringToUint32 = (value = '') => {
  let hash = HASH_SEED;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const hashToUnitInterval = (value = '') => hashStringToUint32(value) / HASH_DIVISOR;

const buildSyntheticParticipantAddress = (participant = {}, profileId = '') => {
  const seed = `${participant.participant || participant.xid || 'participant'}::${profileId}`;
  let hex = '';
  for (let index = 0; index < 5; index += 1) {
    hex += hashStringToUint32(`${seed}::${index}`).toString(16).padStart(8, '0');
  }
  return `0x${hex.slice(0, 40)}`;
};

const stepVoteToward = (currentVote, targetVote) => {
  const current = normalizePolisVote(currentVote);
  const target = normalizePolisVote(targetVote);
  if (target === null) return current;
  if (current === null) return target;
  if (current === target) return current;
  return current + Math.sign(target - current);
};

const buildQuestionSignalSummary = (participantsVotes = [], comments = []) => (
  (Array.isArray(comments) ? comments : []).map((comment, index) => {
    const counts = new Map([
      [-1, 0],
      [0, 0],
      [1, 0],
    ]);
    let total = 0;

    (Array.isArray(participantsVotes) ? participantsVotes : []).forEach((participant) => {
      const vote = normalizePolisVote(participant?.votes?.[String(index)]);
      if (vote === null) return;
      counts.set(vote, Number(counts.get(vote) || 0) + 1);
      total += 1;
    });

    const sortedCounts = [...counts.entries()].sort((left, right) => {
      if (right[1] !== left[1]) return right[1] - left[1];
      return right[0] - left[0];
    });
    const majorityVote = total > 0
      ? resolveQuestionMajorityVote(counts)
      : 0;
    const majorityRate = total > 0 ? Number(sortedCounts[0]?.[1] || 0) / total : 0;

    return {
      questionKey: String(index),
      questionType: String(comment?.type || '').trim().toLowerCase(),
      sourceTags: readSourceTags(comment),
      majorityVote,
      majorityRate,
      totalVotes: total,
    };
  })
);

export const resolveQuestionMajorityVote = (counts = new Map()) => {
  const sortedCounts = [...counts.entries()].sort((left, right) => {
    if (right[1] !== left[1]) return right[1] - left[1];
    return right[0] - left[0];
  });
  const topCount = Number(sortedCounts[0]?.[1] || 0);
  if (topCount <= 0) return 0;

  const tiedTopVotes = sortedCounts
    .filter(([, count]) => count === topCount)
    .map(([vote]) => normalizePolisVote(vote))
    .filter((vote) => vote !== null);

  return tiedTopVotes.length === 1 ? tiedTopVotes[0] : 0;
};

const getQuestionBias = (
  questionSignal = {},
  syntheticParticipantConfig = SYNTHETIC_PARTICIPANT_CONFIG
) => {
  const sourceWeights = syntheticParticipantConfig?.sourceMutationWeights || {};
  const typeWeights = syntheticParticipantConfig?.typeMutationWeights || {};
  const sourceTags = Array.isArray(questionSignal?.sourceTags) ? questionSignal.sourceTags : [];
  const sourceBias = sourceTags.length > 0
    ? sourceTags.reduce(
      (sum, sourceTag) => sum + Number(sourceWeights[normalizeSourceTag(sourceTag)] || 0),
      0
    ) / sourceTags.length
    : 0;
  const typeBias = Number(typeWeights[String(questionSignal?.questionType || '').trim().toLowerCase()] || 0);
  return sourceBias + typeBias;
};

const chooseTargetVote = ({
  questionSignal = {},
  profile = {},
  syntheticParticipantConfig = SYNTHETIC_PARTICIPANT_CONFIG,
  seed = '',
}) => {
  const weights = profile?.targetModeWeights || {};
  let majorityWeight = Number(weights.majority || 0);
  let unsureWeight = Number(weights.unsure || 0);
  const confidenceThreshold = Number(syntheticParticipantConfig?.majorityConfidenceThreshold || 0);

  if (questionSignal?.majorityRate < confidenceThreshold) {
    majorityWeight *= 0.55;
    unsureWeight += 0.15;
  }

  const totalWeight = Math.max(majorityWeight + unsureWeight, Number.EPSILON);
  const pick = hashToUnitInterval(`${seed}::target-mode`);
  const selectedMode = pick < (majorityWeight / totalWeight) ? 'majority' : 'unsure';

  return selectedMode === 'majority'
    ? normalizePolisVote(questionSignal?.majorityVote)
    : 0;
};

const buildSyntheticParticipantRows = ({
  baseParticipantsVotes = [],
  comments = [],
  syntheticParticipantConfig = SYNTHETIC_PARTICIPANT_CONFIG,
  mappedQuestionIds = new Set(),
}) => {
  const variantProfiles = Array.isArray(syntheticParticipantConfig?.variantProfiles)
    ? syntheticParticipantConfig.variantProfiles
    : [];
  if (variantProfiles.length === 0 || !Array.isArray(baseParticipantsVotes) || baseParticipantsVotes.length === 0) {
    return [];
  }

  const questionSignals = buildQuestionSignalSummary(baseParticipantsVotes, comments);
  const questionSignalByKey = new Map(
    questionSignals.map((questionSignal) => [questionSignal.questionKey, questionSignal])
  );

  return baseParticipantsVotes.flatMap((participant) => variantProfiles.map((profile, variantIndex) => {
    const votes = {};

    (Array.isArray(comments) ? comments : []).forEach((comment, questionIndex) => {
      const questionKey = String(questionIndex);
      const questionSignal = questionSignalByKey.get(questionKey) || {
        questionKey,
        questionType: String(comment?.type || '').trim().toLowerCase(),
        sourceTags: readSourceTags(comment),
        majorityVote: 0,
        majorityRate: 0,
      };
      const bias = getQuestionBias(questionSignal, syntheticParticipantConfig);
      const isMappedQuestion = mappedQuestionIds.has(questionKey);
      const mappedMultiplier = Number(
        syntheticParticipantConfig?.mappedQuestionMutationMultiplier ?? 1
      );
      const baseVote = normalizePolisVote(participant?.votes?.[questionKey]);
      const seedPrefix = [
        participant?.participant || participant?.xid || 'participant',
        profile?.id || `variant-${variantIndex}`,
        questionKey,
        comment?.nodeId || '',
      ].join('::');

      const mutationRate = clampNumber(
        (Number(profile?.mutationRate || 0) + bias) * (isMappedQuestion ? mappedMultiplier : 1),
        0,
        0.85
      );
      const missingVoteFillRate = clampNumber(
        Number(profile?.missingVoteFillRate || 0) + (bias * 0.75),
        0,
        0.95
      );
      const dropVoteRate = clampNumber(Number(profile?.dropVoteRate || 0), 0, 0.4);
      const targetVote = chooseTargetVote({
        questionSignal,
        profile,
        syntheticParticipantConfig,
        seed: seedPrefix,
      });

      if (baseVote === null) {
        if (hashToUnitInterval(`${seedPrefix}::fill`) < missingVoteFillRate && targetVote !== null) {
          votes[questionKey] = targetVote;
        }
        return;
      }

      let nextVote = baseVote;
      if (hashToUnitInterval(`${seedPrefix}::mutate`) < mutationRate) {
        nextVote = stepVoteToward(baseVote, targetVote);
      }
      if (hashToUnitInterval(`${seedPrefix}::drop`) < dropVoteRate) {
        return;
      }
      votes[questionKey] = nextVote;
    });

    const normalizedVotes = Object.values(votes).map((value) => Number(value));

    return {
      participant: buildSyntheticParticipantAddress(participant, `${profile?.id || variantIndex}`),
      xid: String(participant?.xid || '').trim(),
      groupId: Number(participant?.groupId ?? 0),
      profileId: String(profile?.id || `variant-${variantIndex}`).trim(),
      profileLabel: String(profile?.label || profile?.id || `Variant ${variantIndex + 1}`).trim(),
      profileConfidence: String(profile?.confidence || 'Medium').trim(),
      profileRationale: String(profile?.rationale || '').trim(),
      profileSourceType: 'synthetic_variant',
      profileParentXid: String(participant?.xid || '').trim(),
      nVotes: normalizedVotes.length,
      nAgree: normalizedVotes.filter((value) => value === 1).length,
      nDisagree: normalizedVotes.filter((value) => value === -1).length,
      votes,
    };
  }));
};

const applyCommentOverrides = (
  comment = {},
  questionKey = '',
  questionOverridesByQuestion = QUESTION_OVERRIDES_BY_QUESTION_ID
) => {
  const override = questionOverridesByQuestion?.[questionKey];
  if (!override || typeof override !== 'object') return comment;
  const normalizedOverride = {
    ...override,
  };
  if (
    !normalizedOverride.sources &&
    Array.isArray(normalizedOverride.sourceTags) &&
    normalizedOverride.sourceTags.length > 0
  ) {
    normalizedOverride.sources = normalizedOverride.sourceTags.join(', ');
  }
  if (!normalizedOverride.key_tension && normalizedOverride.keyTension) {
    normalizedOverride.key_tension = normalizedOverride.keyTension;
  }
  delete normalizedOverride.sourceTags;
  delete normalizedOverride.keyTension;
  const overriddenComment = {
    ...comment,
    ...normalizedOverride,
  };
  // A breakdown override can turn a poll into a binary statement. Do not
  // retain choices that no longer describe the overridden question.
  const overriddenType = String(overriddenComment?.type || '').trim().toLowerCase();
  if (overriddenType !== 'poll' && overriddenType !== 'multichoice' && !override.options) {
    delete overriddenComment.options;
  }
  return overriddenComment;
};

const normalizePolisVote = (value) => {
  const numericValue = Number(value);
  if (numericValue === 1 || numericValue === 0 || numericValue === -1) {
    return numericValue;
  }
  return null;
};

export const mapTreeVoteToTriState = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return null;
  if (numericValue >= TREE_AGREE_THRESHOLD) return 1;
  if (numericValue <= TREE_DISAGREE_THRESHOLD) return -1;
  return 0;
};

// Atlas node ids are not a safe automatic join key for these survey questions.
// Only use tree votes for question/node pairs that were manually validated as
// the same proposition.
export const getExplicitTreeVoteNodeIdForQuestion = (
  comment = {},
  questionKey = '',
  semanticTreeNodeIdsByQuestion = SEMANTIC_TREE_NODE_IDS_BY_QUESTION_ID
) => {
  const mappedNodeId = String(semanticTreeNodeIdsByQuestion?.[questionKey] || '').trim();
  if (!mappedNodeId) return null;

  const commentNodeId = String(comment?.nodeId || '').trim();
  return commentNodeId && commentNodeId === mappedNodeId ? mappedNodeId : null;
};

export const buildTreeVoteNodeIdsByQuestion = (
  comments = [],
  semanticTreeNodeIdsByQuestion = SEMANTIC_TREE_NODE_IDS_BY_QUESTION_ID
) => (Array.isArray(comments) ? comments : []).map((comment, index) => (
  getExplicitTreeVoteNodeIdForQuestion(comment, String(index), semanticTreeNodeIdsByQuestion)
));

export const deriveParticipantVotes = (
  participant = {},
  comments = [],
  treeVotesByFigure = {},
  treeNodeIdsByQuestion = buildTreeVoteNodeIdsByQuestion(comments)
) => {
  const derivedVotes = {};

  comments.forEach((comment, index) => {
    const questionKey = String(index);
    const treeNodeId = treeNodeIdsByQuestion[index];
    const treeVote = treeNodeId ? mapTreeVoteToTriState(treeVotesByFigure?.[treeNodeId]) : null;
    const fallbackVote = normalizePolisVote(participant?.votes?.[questionKey]);
    const nextVote = treeVote ?? fallbackVote;

    if (nextVote === null) return;
    derivedVotes[questionKey] = nextVote;
  });

  return derivedVotes;
};

const buildParticipantRow = (
  participant = {},
  comments = [],
  treeData = {},
  treeNodeIdsByQuestion = buildTreeVoteNodeIdsByQuestion(comments)
) => {
  const xid = String(participant?.xid || '').trim();
  const treeVotesByFigure = treeData?.[xid]?.votes || {};
  const votes = deriveParticipantVotes(
    participant,
    comments,
    treeVotesByFigure,
    treeNodeIdsByQuestion
  );
  const normalizedVotes = Object.values(votes).map((value) => Number(value));

  return {
    participant: String(participant?.participant || '').trim(),
    xid,
    groupId: Number(participant?.groupId ?? 0),
    profileId: BASE_PROFILE_ID,
    profileLabel: BASE_PROFILE_LABEL,
    profileConfidence: BASE_PROFILE_CONFIDENCE,
    profileRationale: BASE_PROFILE_RATIONALE,
    profileSourceType: 'historical_baseline',
    profileParentXid: xid,
    nVotes: normalizedVotes.length,
    nAgree: normalizedVotes.filter((value) => value === 1).length,
    nDisagree: normalizedVotes.filter((value) => value === -1).length,
    votes,
  };
};

const buildCommentRows = (
  comments = [],
  participantsVotes = []
) => comments.map((comment, index) => {
  const questionKey = String(index);
  const summary = participantsVotes.reduce((acc, participant) => {
    const vote = normalizePolisVote(participant?.votes?.[questionKey]);
    if (vote === 1) acc.agrees += 1;
    if (vote === -1) acc.disagrees += 1;
    return acc;
  }, { agrees: 0, disagrees: 0 });

  return {
    ...comment,
    datetime: formatDemoUtcDateTime(comment?.timestamp) || String(comment?.datetime || '').trim(),
    agrees: summary.agrees,
    disagrees: summary.disagrees,
  };
});

export const buildDemoAnalysisFixture = ({
  semanticTreeNodeIdsByQuestion = SEMANTIC_TREE_NODE_IDS_BY_QUESTION_ID,
  questionOverridesByQuestion = QUESTION_OVERRIDES_BY_QUESTION_ID,
  syntheticParticipantConfig = SYNTHETIC_PARTICIPANT_CONFIG,
} = {}) => {
  const demoPolisData = readJson(DEMO_POLIS_PATH);
  const treeData = readJson(TREE_VOTES_PATH);
  const comments = Array.isArray(demoPolisData?.comments) ? demoPolisData.comments : [];
  const participants = Array.isArray(demoPolisData?.participantsVotes)
    ? demoPolisData.participantsVotes
    : [];
  const normalizedComments = comments.map((comment, index) => (
    applyCommentOverrides(comment, String(index), questionOverridesByQuestion)
  ));
  const treeNodeIdsByQuestion = buildTreeVoteNodeIdsByQuestion(
    normalizedComments,
    semanticTreeNodeIdsByQuestion
  );

  const baseParticipantsVotes = participants.map((participant) => (
    buildParticipantRow(participant, normalizedComments, treeData, treeNodeIdsByQuestion)
  ));
  const mappedQuestionIds = new Set(
    treeNodeIdsByQuestion
      .map((treeNodeId, questionIndex) => (treeNodeId ? String(questionIndex) : null))
      .filter(Boolean)
  );
  const syntheticParticipantsVotes = buildSyntheticParticipantRows({
    baseParticipantsVotes,
    comments: normalizedComments,
    syntheticParticipantConfig,
    mappedQuestionIds,
  });
  const participantsVotes = [...baseParticipantsVotes, ...syntheticParticipantsVotes];

  return {
    comments: buildCommentRows(normalizedComments, participantsVotes),
    participantsVotes,
  };
};

export const stringifyDemoAnalysisFixture = (fixture = buildDemoAnalysisFixture()) => (
  `${JSON.stringify(fixture, null, 2)}\n`
);

export const writeDemoAnalysisFixture = (outputPath = OUTPUT_PATH) => {
  const fixture = buildDemoAnalysisFixture();
  fs.writeFileSync(outputPath, stringifyDemoAnalysisFixture(fixture));
  return {
    fixture,
    outputPath,
  };
};

const isMainModule = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

if (isMainModule) {
  const { fixture, outputPath } = writeDemoAnalysisFixture();
  console.log(
    `[generate-demo-analysis-fixture] wrote ${fixture.comments.length} questions and ${fixture.participantsVotes.length} participants to ${path.relative(REPO_ROOT, outputPath)}`
  );
}
