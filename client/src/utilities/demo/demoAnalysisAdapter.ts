import historicalFigureDemographics from '../../variables/demo/historical_figure_demographics.js';

type UnknownRecord = Record<string, unknown>;

export type DemoAnalysisComment = {
  commentId?: unknown;
  commentBody?: unknown;
  type?: unknown;
  category?: unknown;
  key_tension?: unknown;
  keyTension?: unknown;
  sources?: unknown;
};

export type DemoAnalysisParticipant = {
  xid?: unknown;
  participant?: unknown;
  votes?: Record<string, unknown>;
  profileId?: unknown;
  profileLabel?: unknown;
  profileConfidence?: unknown;
  profileRationale?: unknown;
  profileSourceType?: unknown;
};

export type DemoAnalysisSource = {
  comments?: unknown;
  participantsVotes?: unknown;
};

type DemoAnalysisMetadata = UnknownRecord & {
  eraBucket?: unknown;
  region?: unknown;
  country?: unknown;
  gender?: unknown;
  affiliation?: unknown;
  atlasCategory?: unknown;
};

export type DemoAnalysisMetadataByXid = Record<string, DemoAnalysisMetadata>;

export type QuestionTag = {
  tagID: string;
  tagName: string;
  tagType: string;
  rawValue: string;
  isPrimary: boolean;
};

type DemoAnalysisQuestion = {
  id: string;
  commentId: string;
  index: number;
  text: string;
  type: string;
  sourcePromptType: string;
  options: string[];
  semanticOrder: string[];
  participationCount: number;
  category: string;
  keyTension: string;
  sources: string[];
};

export type DemoFlatResponse = {
  questionId: string;
  responseText: string;
  segmentKey: string;
  count: number;
  participantCount: number;
  totalVotes: number;
  rate: number;
};

type ParticipantSegment = {
  segmentKey: string;
  category: string;
  value: string;
};

type ProfileDescriptor = {
  profileId: string;
  label: string;
  confidence: string;
  rationale: string;
  sourceType: string;
};

type ProfileCount = ProfileDescriptor & {
  participantKeys: Set<string>;
};

export type QuestionProfileSummary = ProfileDescriptor & {
  count: number;
};

type DemographicSummaryRow = {
  value: string;
  count: number;
};

export type DemoAnalysisData = {
  questions: DemoAnalysisQuestion[];
  flatResponses: DemoFlatResponse[];
  demographics: Record<string, DemographicSummaryRow[]>;
  segmentCounts: Record<string, Record<string, number>>;
  questionTagsData: Record<string, QuestionTag[]>;
  questionProfileSummaries: Record<string, QuestionProfileSummary[]>;
};

export const DEMO_ANALYSIS_RESPONSE_OPTIONS = Object.freeze(['Agree', 'Unsure', 'Disagree']);
const EMPTY_DEMO_ANALYSIS_SOURCE: DemoAnalysisSource = Object.freeze({
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
const DEFAULT_PROFILE_ID = 'historical_baseline';
const DEFAULT_PROFILE_LABEL = 'Historical persona baseline';
const DEFAULT_PROFILE_CONFIDENCE = 'High';
const DEFAULT_PROFILE_RATIONALE =
  'Original historical-figure vote row anchored to the canonical demo persona fixtures.';

const VOTE_LABEL_BY_VALUE: Record<string, string> = Object.freeze({
  '-1': 'Disagree',
  0: 'Unsure',
  1: 'Agree',
});

const PRIMARY_TAG_TYPE = 'category';
const SECONDARY_TAG_TYPE = 'source';

const toTitleCase = (value = ''): string =>
  String(value || '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const slugify = (value = ''): string =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const normalizeSourceId = (value = ''): string => {
  const trimmed = String(value || '')
    .trim()
    .toLowerCase();
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

export const buildQuestionTags = (comment: DemoAnalysisComment = {}): QuestionTag[] => {
  const tags: QuestionTag[] = [];
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

  const seenSources = new Set<string>();
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

const buildQuestionSources = (comment: DemoAnalysisComment = {}): string[] =>
  String(comment?.sources || '')
    .split(',')
    .map((part) => String(part || '').trim())
    .filter(Boolean);

const buildQuestions = (comments: DemoAnalysisComment[] = []): DemoAnalysisQuestion[] =>
  comments.map((comment, index) => ({
    id: String(index),
    commentId: String(comment?.commentId || index),
    index,
    text: String(comment?.commentBody || '').trim(),
    type: 'poll',
    sourcePromptType:
      String(comment?.type || '')
        .trim()
        .toLowerCase() || 'binary',
    options: DEMO_ANALYSIS_RESPONSE_OPTIONS.slice(),
    semanticOrder: DEMO_ANALYSIS_RESPONSE_OPTIONS.slice(),
    participationCount: 0,
    category: String(comment?.category || '').trim(),
    keyTension: String(comment?.key_tension || comment?.keyTension || '').trim(),
    sources: buildQuestionSources(comment),
  }));

const incrementMapCount = (map: Map<string, number>, key: string): void => {
  map.set(key, Number(map.get(key) || 0) + 1);
};

const getParticipantIdentityKey = (participant: DemoAnalysisParticipant = {}, fallbackKey = ''): string => {
  const xid = String(participant?.xid || '').trim();
  if (xid) return xid;

  const participantId = String(participant?.participant || '').trim();
  if (participantId) return participantId;

  return String(fallbackKey || '').trim();
};

const getParticipantSegments = (
  participant: DemoAnalysisParticipant = {},
  metadata: DemoAnalysisMetadata = {},
): ParticipantSegment[] => {
  const segments: ParticipantSegment[] = [{ segmentKey: 'All', category: 'All', value: 'All' }];
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

const buildParticipantProfileDescriptor = (participant: DemoAnalysisParticipant = {}): ProfileDescriptor => {
  const profileId = String(participant?.profileId || '').trim() || DEFAULT_PROFILE_ID;
  return {
    profileId,
    label: String(participant?.profileLabel || '').trim() || DEFAULT_PROFILE_LABEL,
    confidence: String(participant?.profileConfidence || '').trim() || DEFAULT_PROFILE_CONFIDENCE,
    rationale: String(participant?.profileRationale || '').trim() || DEFAULT_PROFILE_RATIONALE,
    sourceType: String(participant?.profileSourceType || '').trim() || 'historical_baseline',
  };
};

const buildDemographicSummary = (
  participantsVotes: DemoAnalysisParticipant[] = [],
  metadataByXid: DemoAnalysisMetadataByXid = {},
): Record<string, DemographicSummaryRow[]> => {
  const countsByCategory = new Map<string, Map<string, number>>(
    DEMO_ANALYSIS_DEMOGRAPHIC_DIMENSIONS.map(({ label }) => [label, new Map<string, number>()]),
  );
  const participantKeysByCategoryValue = new Map<string, Map<string, Set<string>>>(
    DEMO_ANALYSIS_DEMOGRAPHIC_DIMENSIONS.map(({ label }) => [label, new Map<string, Set<string>>()]),
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
      let seenParticipantKeys = categoryParticipantKeys.get(value);
      if (!seenParticipantKeys) {
        seenParticipantKeys = new Set<string>();
        categoryParticipantKeys.set(value, seenParticipantKeys);
      }
      if (seenParticipantKeys.has(participantKey)) return;

      seenParticipantKeys.add(participantKey);
      incrementMapCount(categoryCounts, value);
    });
  });

  return DEMO_ANALYSIS_DEMOGRAPHIC_DIMENSIONS.reduce<Record<string, DemographicSummaryRow[]>>((acc, { label }) => {
    const counts = countsByCategory.get(label) || new Map<string, number>();
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
  sourceData: DemoAnalysisSource = EMPTY_DEMO_ANALYSIS_SOURCE,
  metadataByXid: DemoAnalysisMetadataByXid = historicalFigureDemographics as DemoAnalysisMetadataByXid,
): DemoAnalysisData => {
  const comments: DemoAnalysisComment[] = Array.isArray(sourceData?.comments) ? sourceData.comments : [];
  const participantsVotes = Array.isArray(sourceData?.participantsVotes)
    ? (sourceData.participantsVotes as DemoAnalysisParticipant[])
    : [];

  const questions = buildQuestions(comments);
  const flatResponses: DemoFlatResponse[] = [];
  const segmentCounts: Record<string, Record<string, number>> = {};
  const questionTagsData: Record<string, QuestionTag[]> = {};
  const questionProfileSummaries: Record<string, QuestionProfileSummary[]> = {};

  const unresolvedXids = participantsVotes
    .map((participant) => String(participant?.xid || '').trim())
    .filter((xid) => xid && !metadataByXid?.[xid]);
  if (unresolvedXids.length > 0) {
    throw new Error(`Missing demo analysis demographics for: ${unresolvedXids.join(', ')}`);
  }

  questions.forEach((question) => {
    const questionId = question.id;
    const responseCountsBySegment = new Map<string, Map<string, number>>();
    const denominatorsBySegment = new Map<string, number>();
    const uniqueParticipantKeysBySegment = new Map<string, Set<string>>();
    const profileCountsByQuestion = new Map<string, ProfileCount>();

    participantsVotes.forEach((participant, participantIndex) => {
      const xid = String(participant?.xid || '').trim();
      const metadata = metadataByXid[xid];
      const rawVote = participant?.votes?.[questionId];
      if (rawVote === undefined || rawVote === null) return;

      const normalizedVoteKey = String(rawVote);
      const responseLabel = VOTE_LABEL_BY_VALUE[normalizedVoteKey];
      if (!responseLabel) return;

      const participantKey = getParticipantIdentityKey(participant, `row:${participantIndex}`);
      const profileDescriptor = buildParticipantProfileDescriptor(participant);
      const segments = getParticipantSegments(participant, metadata);
      segments.forEach(({ segmentKey }) => {
        incrementMapCount(denominatorsBySegment, segmentKey);
        if (!responseCountsBySegment.has(segmentKey)) {
          responseCountsBySegment.set(segmentKey, new Map<string, number>());
        }
        if (!uniqueParticipantKeysBySegment.has(segmentKey)) {
          uniqueParticipantKeysBySegment.set(segmentKey, new Set<string>());
        }
        uniqueParticipantKeysBySegment.get(segmentKey)?.add(participantKey);
        const responseCounts = responseCountsBySegment.get(segmentKey);
        if (responseCounts) {
          incrementMapCount(responseCounts, responseLabel);
        }
      });

      if (!profileCountsByQuestion.has(profileDescriptor.profileId)) {
        profileCountsByQuestion.set(profileDescriptor.profileId, {
          ...profileDescriptor,
          participantKeys: new Set<string>(),
        });
      }
      profileCountsByQuestion.get(profileDescriptor.profileId)?.participantKeys.add(participantKey);
    });

    question.participationCount = Number(uniqueParticipantKeysBySegment.get('All')?.size || 0);
    segmentCounts[questionId] = {};
    questionTagsData[questionId] = buildQuestionTags(comments[question.index]);
    questionProfileSummaries[questionId] = Array.from(profileCountsByQuestion.values())
      .map((profileSummary) => ({
        profileId: profileSummary.profileId,
        label: profileSummary.label,
        confidence: profileSummary.confidence,
        rationale: profileSummary.rationale,
        sourceType: profileSummary.sourceType,
        count: Number(profileSummary.participantKeys?.size || 0),
      }))
      .sort((left, right) => {
        if (right.count !== left.count) return right.count - left.count;
        return left.label.localeCompare(right.label);
      });

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
    questionProfileSummaries,
  };
};

export default buildDemoAnalysisData;
