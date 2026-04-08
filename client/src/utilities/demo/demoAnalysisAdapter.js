import historicalFigureDemographics from '../../variables/demo/historical_figure_demographics.js';

export const DEMO_ANALYSIS_RESPONSE_OPTIONS = Object.freeze(['Agree', 'Unsure', 'Disagree']);
const EMPTY_DEMO_ANALYSIS_SOURCE = Object.freeze({
  comments: [],
  participantsVotes: [],
});

export const DEMO_ANALYSIS_DEMOGRAPHIC_DIMENSIONS = Object.freeze([
  { label: 'Era', field: 'eraBucket' },
  { label: 'Region', field: 'region' },
  { label: 'Country', field: 'country' },
  { label: 'Gender', field: 'gender' },
  { label: 'Affiliation', field: 'affiliation' },
  { label: 'Atlas Category', field: 'atlasCategory' },
]);

const VOTE_LABEL_BY_VALUE = Object.freeze({
  '-1': 'Disagree',
  0: 'Unsure',
  1: 'Agree',
});

const PRIMARY_TAG_TYPE = 'category';
const SECONDARY_TAG_TYPE = 'source';

const toTitleCase = (value = '') => String(value || '')
  .toLowerCase()
  .split(/\s+/)
  .filter(Boolean)
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
  .join(' ');

const slugify = (value = '') => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

const normalizeSourceName = (value = '') => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  if (trimmed === 'arxiv') return 'arXiv';
  if (trimmed === 'LessWrong') return 'LessWrong';
  return toTitleCase(trimmed);
};

export const buildQuestionTags = (comment = {}) => {
  const tags = [];
  const category = String(comment?.category || '').trim();
  if (category) {
    tags.push({
      tagID: `category:${slugify(category)}`,
      tagName: toTitleCase(category),
      tagType: PRIMARY_TAG_TYPE,
      rawValue: category,
      isPrimary: true,
    });
  }

  const seenSources = new Set();
  const rawSources = String(comment?.sources || '')
    .split(',')
    .map((part) => String(part || '').trim())
    .filter(Boolean);

  rawSources.forEach((source) => {
    const normalizedId = slugify(source);
    if (!normalizedId || seenSources.has(normalizedId)) return;
    seenSources.add(normalizedId);
    tags.push({
      tagID: `source:${normalizedId}`,
      tagName: normalizeSourceName(source),
      tagType: SECONDARY_TAG_TYPE,
      rawValue: source,
      isPrimary: false,
    });
  });

  return tags;
};

const buildQuestions = (comments = []) => comments.map((comment, index) => ({
  id: String(index),
  commentId: String(comment?.commentId || index),
  index,
  text: String(comment?.commentBody || '').trim(),
  type: 'poll',
  options: DEMO_ANALYSIS_RESPONSE_OPTIONS.slice(),
  semanticOrder: DEMO_ANALYSIS_RESPONSE_OPTIONS.slice(),
  participationCount: 0,
  category: String(comment?.category || '').trim(),
  sources: String(comment?.sources || '')
    .split(',')
    .map((part) => String(part || '').trim())
    .filter(Boolean),
}));

const incrementMapCount = (map, key) => {
  map.set(key, Number(map.get(key) || 0) + 1);
};

const getParticipantSegments = (participant = {}, metadata = {}) => {
  const segments = [{ segmentKey: 'All', category: 'All', value: 'All' }];
  DEMO_ANALYSIS_DEMOGRAPHIC_DIMENSIONS.forEach(({ label, field }) => {
    const value = String(metadata?.[field] || '').trim();
    if (!value) return;
    segments.push({
      segmentKey: `${label}:${value}`,
      category: label,
      value,
    });
  });
  return segments;
};

const buildDemographicSummary = (participantsVotes = [], metadataByXid = {}) => {
  const countsByCategory = new Map(
    DEMO_ANALYSIS_DEMOGRAPHIC_DIMENSIONS.map(({ label }) => [label, new Map()])
  );

  participantsVotes.forEach((participant) => {
    const xid = String(participant?.xid || '').trim();
    const metadata = metadataByXid[xid];
    if (!metadata) return;
    DEMO_ANALYSIS_DEMOGRAPHIC_DIMENSIONS.forEach(({ label, field }) => {
      const value = String(metadata?.[field] || '').trim();
      if (!value) return;
      incrementMapCount(countsByCategory.get(label), value);
    });
  });

  return DEMO_ANALYSIS_DEMOGRAPHIC_DIMENSIONS.reduce((acc, { label }) => {
    const counts = countsByCategory.get(label) || new Map();
    acc[label] = Array.from(counts.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((left, right) => {
        if (right.count !== left.count) return right.count - left.count;
        return left.value.localeCompare(right.value);
      });
    return acc;
  }, {});
};

export const buildDemoAnalysisData = (
  sourceData = EMPTY_DEMO_ANALYSIS_SOURCE,
  metadataByXid = historicalFigureDemographics
) => {
  const comments = Array.isArray(sourceData?.comments) ? sourceData.comments : [];
  const participantsVotes = Array.isArray(sourceData?.participantsVotes)
    ? sourceData.participantsVotes
    : [];

  const questions = buildQuestions(comments);
  const flatResponses = [];
  const segmentCounts = {};
  const questionTagsData = {};

  const unresolvedXids = participantsVotes
    .map((participant) => String(participant?.xid || '').trim())
    .filter((xid) => xid && !metadataByXid?.[xid]);
  if (unresolvedXids.length > 0) {
    throw new Error(`Missing demo analysis demographics for: ${unresolvedXids.join(', ')}`);
  }

  questions.forEach((question) => {
    const questionId = question.id;
    const responseCountsBySegment = new Map();
    const denominatorsBySegment = new Map();

    participantsVotes.forEach((participant) => {
      const xid = String(participant?.xid || '').trim();
      const metadata = metadataByXid[xid];
      const rawVote = participant?.votes?.[questionId];
      if (rawVote === undefined || rawVote === null) return;

      const normalizedVoteKey = String(rawVote);
      const responseLabel = VOTE_LABEL_BY_VALUE[normalizedVoteKey];
      if (!responseLabel) return;

      const segments = getParticipantSegments(participant, metadata);
      segments.forEach(({ segmentKey }) => {
        incrementMapCount(denominatorsBySegment, segmentKey);
        if (!responseCountsBySegment.has(segmentKey)) {
          responseCountsBySegment.set(segmentKey, new Map());
        }
        incrementMapCount(responseCountsBySegment.get(segmentKey), responseLabel);
      });
    });

    question.participationCount = Number(denominatorsBySegment.get('All') || 0);
    segmentCounts[questionId] = {};
    questionTagsData[questionId] = buildQuestionTags(comments[question.index]);

    Array.from(denominatorsBySegment.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .forEach(([segmentKey, denominator]) => {
        segmentCounts[questionId][segmentKey] = denominator;
        const responseCounts = responseCountsBySegment.get(segmentKey) || new Map();
        DEMO_ANALYSIS_RESPONSE_OPTIONS.forEach((responseText) => {
          const count = Number(responseCounts.get(responseText) || 0);
          flatResponses.push({
            questionId,
            responseText,
            segmentKey,
            count,
            totalVotes: denominator,
            rate: denominator > 0 ? count / denominator : 0,
          });
        });
      });
  });

  return {
    questions,
    flatResponses,
    demographics: buildDemographicSummary(participantsVotes, metadataByXid),
    segmentCounts,
    questionTagsData,
  };
};

export const getHighestParticipationQuestion = (questions = []) => {
  if (!Array.isArray(questions) || questions.length === 0) return null;
  return [...questions]
    .sort((left, right) => {
      if (right.participationCount !== left.participationCount) {
        return right.participationCount - left.participationCount;
      }
      return left.index - right.index;
    })[0] || null;
};

export default buildDemoAnalysisData;
