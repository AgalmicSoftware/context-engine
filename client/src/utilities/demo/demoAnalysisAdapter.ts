import historicalFigureDemographics from '../../variables/demo/historical_figure_demographics.js';

type LooseRecord = Record<string, any>;

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

const VOTE_LABEL_BY_VALUE: Record<string, string> = Object.freeze({
  '-1': 'Disagree',
  0: 'Unsure',
  1: 'Agree',
});

const PRIMARY_TAG_TYPE = 'category';
const SECONDARY_TAG_TYPE = 'source';

const toTitleCase = (value = ''): string => String(value || '')
  .toLowerCase()
  .split(/\s+/)
  .filter(Boolean)
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
  .join(' ');

const slugify = (value = ''): string => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

const normalizeSourceId = (value = ''): string => {
  const trimmed = String(value || '').trim().toLowerCase();
  if (!trimmed) return '';
  if (trimmed === 'sci-fi' || trimmed === 'scifi') return 'scifi';
  if (trimmed === 'metr') return 'metr';
  return slugify(trimmed);
};

const normalizeSourceName = (value = ''): string => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  const normalized = trimmed.toLowerCase();
  if (normalized === 'arxiv') return 'arXiv';
  if (normalized === 'lesswrong') return 'LessWrong';
  if (normalized === 'metr') return 'METR';
  if (normalized === 'sci-fi' || normalized === 'scifi') return 'Sci-Fi';
  return toTitleCase(trimmed);
};

export const buildQuestionTags = (comment: LooseRecord = {}) => {
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
    const normalizedId = normalizeSourceId(source);
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

const buildQuestions = (comments: LooseRecord[] = []) => comments.map((comment, index) => ({
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

const incrementMapCount = (map: Map<string, number>, key: string): void => {
  map.set(key, Number(map.get(key) || 0) + 1);
};

const getParticipantIdentityKey = (participant: LooseRecord = {}, fallbackKey = ''): string => {
  const xid = String(participant?.xid || '').trim();
  if (xid) return xid;

  const participantId = String(participant?.participant || '').trim();
  if (participantId) return participantId;

  return String(fallbackKey || '').trim();
};

const getParticipantSegments = (participant: LooseRecord = {}, metadata: LooseRecord = {}) => {
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

const buildDemographicSummary = (participantsVotes: LooseRecord[] = [], metadataByXid: Record<string, LooseRecord> = {}) => {
  const countsByCategory = new Map(
    DEMO_ANALYSIS_DEMOGRAPHIC_DIMENSIONS.map(({ label }) => [label, new Map()])
  );
  const participantKeysByCategoryValue = new Map(
    DEMO_ANALYSIS_DEMOGRAPHIC_DIMENSIONS.map(({ label }) => [label, new Map()])
  );

  participantsVotes.forEach((participant, participantIndex) => {
    const xid = String(participant?.xid || '').trim();
    const metadata = metadataByXid[xid];
    if (!metadata) return;

    const participantKey = getParticipantIdentityKey(participant, `row:${participantIndex}`);
    DEMO_ANALYSIS_DEMOGRAPHIC_DIMENSIONS.forEach(({ label, field }) => {
      const value = String(metadata?.[field] || '').trim();
      if (!value) return;

      const categoryParticipantKeys = participantKeysByCategoryValue.get(label);
      const categoryCounts = countsByCategory.get(label);
      if (!categoryParticipantKeys || !categoryCounts) return;
      if (!categoryParticipantKeys.has(value)) {
        categoryParticipantKeys.set(value, new Set());
      }
      const seenParticipantKeys = categoryParticipantKeys.get(value);
      if (seenParticipantKeys.has(participantKey)) return;

      seenParticipantKeys.add(participantKey);
      incrementMapCount(categoryCounts, value);
    });
  });

  return DEMO_ANALYSIS_DEMOGRAPHIC_DIMENSIONS.reduce<Record<string, any[]>>((acc, { label }) => {
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
  sourceData: LooseRecord = EMPTY_DEMO_ANALYSIS_SOURCE,
  metadataByXid: Record<string, LooseRecord> = historicalFigureDemographics as Record<string, LooseRecord>
) => {
  const comments = Array.isArray(sourceData?.comments) ? sourceData.comments : [];
  const participantsVotes = Array.isArray(sourceData?.participantsVotes)
    ? sourceData.participantsVotes
    : [];

  const questions = buildQuestions(comments);
  const flatResponses: LooseRecord[] = [];
  const segmentCounts: Record<string, Record<string, number>> = {};
  const questionTagsData: Record<string, any[]> = {};

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
    const uniqueParticipantKeysBySegment = new Map();

    participantsVotes.forEach((participant, participantIndex) => {
      const xid = String(participant?.xid || '').trim();
      const metadata = metadataByXid[xid];
      const rawVote = participant?.votes?.[questionId];
      if (rawVote === undefined || rawVote === null) return;

      const normalizedVoteKey = String(rawVote);
      const responseLabel = VOTE_LABEL_BY_VALUE[normalizedVoteKey];
      if (!responseLabel) return;

      const participantKey = getParticipantIdentityKey(participant, `row:${participantIndex}`);
      const segments = getParticipantSegments(participant, metadata);
      segments.forEach(({ segmentKey }) => {
        incrementMapCount(denominatorsBySegment, segmentKey);
        if (!responseCountsBySegment.has(segmentKey)) {
          responseCountsBySegment.set(segmentKey, new Map());
        }
        if (!uniqueParticipantKeysBySegment.has(segmentKey)) {
          uniqueParticipantKeysBySegment.set(segmentKey, new Set());
        }
        uniqueParticipantKeysBySegment.get(segmentKey).add(participantKey);
        incrementMapCount(responseCountsBySegment.get(segmentKey), responseLabel);
      });
    });

    question.participationCount = Number(uniqueParticipantKeysBySegment.get('All')?.size || 0);
    segmentCounts[questionId] = {};
    questionTagsData[questionId] = buildQuestionTags(comments[question.index]);

    Array.from(denominatorsBySegment.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .forEach(([segmentKey, denominator]) => {
        segmentCounts[questionId][segmentKey] = denominator;
        const responseCounts = responseCountsBySegment.get(segmentKey) || new Map();
        const participantCount = Number(uniqueParticipantKeysBySegment.get(segmentKey)?.size || 0);
        DEMO_ANALYSIS_RESPONSE_OPTIONS.forEach((responseText) => {
          const count = Number(responseCounts.get(responseText) || 0);
          flatResponses.push({
            questionId,
            responseText,
            segmentKey,
            count,
            participantCount,
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

export const getHighestParticipationQuestion = (questions: LooseRecord[] = []) => {
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
