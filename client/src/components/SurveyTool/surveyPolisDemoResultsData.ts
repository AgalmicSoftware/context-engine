import demoPolisData from '../../variables/demo/demo_polis_data.json';
import { hasSimulatedDemoResponses, resolveDemoPolisDataset } from '../../utilities/demo/demoPolisDatasets.js';
import { getDemoFixtureQuestionIdsByIndex } from '../../utilities/session/demoSessionQuestionFixtures.js';
import { normalizeSessionSlug } from '../../utilities/session/sessionNaming.js';
import {
  type SurveyResultsQuestionRecord,
  type SurveyResultsQuestionResponsesByQuestion,
  type SurveyResultsScopedQuestionNetworkData,
} from './surveyResultsQuestionNetworkReadController';
import { buildPolisDemoQuestionPool } from './surveyPolisDemoQuestionPool.js';

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const readString = (value: unknown = ''): string => String(value || '').trim();

const readNumber = (value: unknown, fallback = 0): number => {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
};

const normalizeQuestionId = (value: unknown = ''): string => readString(value).toLowerCase();

const normalizeResponderId = (value: unknown = ''): string => readString(value).toLowerCase();

const BINARY_RESPONSE_OPTIONS = ['Agree', 'Unsure', 'Disagree'];

const resolvePolisVoteAnswer = (vote: unknown): string | null => {
  if (vote === 1 || vote === '1') return 'Agree';
  if (vote === -1 || vote === '-1') return 'Disagree';
  if (vote === 0 || vote === '0') return 'Unsure';
  return null;
};

const resolveTypedAnswer = (
  questionType: string,
  value: unknown,
  question: SurveyResultsQuestionRecord,
): string | null => {
  if (questionType === 'multichoice') {
    const answer = readString(value);
    const options = Array.isArray(question.options) ? question.options.map((option) => readString(option)) : [];
    return answer && options.includes(answer) ? answer : null;
  }
  if (questionType === 'rating') {
    if (typeof value !== 'number' && typeof value !== 'string') return null;
    if (typeof value === 'string' && value.trim() === '') return null;
    const answer = Number(value);
    const scale = isRecord(question.scale) ? question.scale : {};
    const min = Number(scale.min);
    const max = Number(scale.max);
    if (!Number.isFinite(answer) || !Number.isFinite(min) || !Number.isFinite(max)) return null;
    return answer >= min && answer <= max ? String(answer) : null;
  }
  if (questionType === 'freeform') {
    const answer = typeof value === 'string' ? value.trim() : '';
    return answer || null;
  }
  return null;
};

export const buildPolisDemoSurveyResultsNetworkData = (
  source: unknown = undefined,
  { sessionSlug = 'demo', questionIdsByIndex = [] }: { sessionSlug?: unknown; questionIdsByIndex?: string[] } = {},
): SurveyResultsScopedQuestionNetworkData => {
  const normalizedSessionSlug = normalizeSessionSlug(sessionSlug || 'demo') || 'demo';
  const resolvedSource = source === undefined ? resolveDemoPolisDataset(normalizedSessionSlug, demoPolisData) : source;
  const comments =
    isRecord(resolvedSource) && Array.isArray(resolvedSource.comments) ? resolvedSource.comments.filter(isRecord) : [];
  const participantsVotes =
    isRecord(resolvedSource) && Array.isArray(resolvedSource.participantsVotes)
      ? resolvedSource.participantsVotes.filter(isRecord)
      : [];
  const questionPool = buildPolisDemoQuestionPool(resolvedSource, {
    sessionSlug: normalizedSessionSlug,
  });

  const questions: Record<string, SurveyResultsQuestionRecord> = {};
  const questionIdsByVoteIndex: Record<number, string> = {};
  const binaryVoteIndexes = new Set<number>();

  questionPool.forEach((question, index) => {
    const questionId = normalizeQuestionId(
      (Array.isArray(questionIdsByIndex) && questionIdsByIndex[index]) || question.id,
    );
    if (!questionId) return;
    const sourceComment = comments[index] || {};
    const questionType = question.type || 'binary';
    questionIdsByVoteIndex[index] = questionId;
    if (questionType === 'binary') binaryVoteIndexes.add(index);
    const pollOptions = Array.isArray(question.options)
      ? question.options.map((option) => readString(option)).filter(Boolean)
      : [];
    questions[questionId] = {
      ...question,
      id: questionId,
      prompt: question.prompt,
      type: questionType,
      questionType,
      ...(questionType === 'binary' ? { options: [...BINARY_RESPONSE_OPTIONS] } : {}),
      ...(questionType === 'multichoice' && pollOptions.length ? { options: pollOptions } : {}),
      ...(isRecord(sourceComment.scale) ? { scale: sourceComment.scale } : {}),
      sessionSlug: normalizedSessionSlug,
      sessionSlugExplicit: true,
      source: 'demo-polis-data',
      timestamp: sourceComment.timestamp,
      authorId: sourceComment.authorId,
      agrees: sourceComment.agrees,
      disagrees: sourceComment.disagrees,
    };
  });

  const questionResponses: SurveyResultsQuestionResponsesByQuestion = {};

  participantsVotes.forEach((participant, participantIndex) => {
    const responder = normalizeResponderId(
      participant.participant || participant.address || participant.xid || `demo-participant-${participantIndex + 1}`,
    );
    if (!responder) return;
    const votes = isRecord(participant.votes) ? participant.votes : {};
    const typedResponses = isRecord(participant.responses) ? participant.responses : {};
    const answerIndexKeys = new Set([...Object.keys(votes), ...Object.keys(typedResponses)]);
    answerIndexKeys.forEach((voteIndexKey) => {
      const voteIndex = Number(voteIndexKey);
      if (!Number.isInteger(voteIndex)) return;
      const questionId = questionIdsByVoteIndex[voteIndex];
      if (!questionId) return;
      const question = questions[questionId] || {};
      const questionType = readString(question.questionType) || 'binary';
      const typed = typedResponses[voteIndexKey];
      const answerValue =
        questionType === 'binary' && binaryVoteIndexes.has(voteIndex)
          ? resolvePolisVoteAnswer(votes[voteIndexKey])
          : resolveTypedAnswer(questionType, isRecord(typed) ? typed.value : undefined, question);
      if (!answerValue) return;
      const comment = comments[voteIndex] || {};
      const timestamp = readNumber(comment.timestamp, 0);
      if (!questionResponses[questionId]) questionResponses[questionId] = {};
      questionResponses[questionId][responder] = {
        type: questionType,
        questionType,
        questionId,
        questionID: questionId,
        prompt: question.prompt || '',
        answer: {
          value: answerValue,
          encrypted: false,
        },
        additional: {
          value: '',
          encrypted: false,
        },
        timestamp,
        timeStamp: timestamp,
        source: 'demo-polis-data',
        participantGroupId: participant.groupId,
        participantXid: participant.xid,
      };
    });
  });

  return {
    questions,
    questionResponses,
    questionsLatestBlock: 0,
    questionResponsesLatestBlock: 0,
  };
};

const simulatedDemoNetworkDataMemo: Record<string, SurveyResultsScopedQuestionNetworkData> = {};

export const buildSimulatedDemoResultsNetworkData = (
  slugIn: unknown,
): SurveyResultsScopedQuestionNetworkData | null => {
  const slug = normalizeSessionSlug(slugIn);
  if (!hasSimulatedDemoResponses(slug)) return null;
  if (!simulatedDemoNetworkDataMemo[slug]) {
    simulatedDemoNetworkDataMemo[slug] = buildPolisDemoSurveyResultsNetworkData(resolveDemoPolisDataset(slug), {
      sessionSlug: slug,
      questionIdsByIndex: getDemoFixtureQuestionIdsByIndex(slug),
    });
  }
  return simulatedDemoNetworkDataMemo[slug];
};

export const buildPolisDemoSurveyResultsAggregatorData = (
  source: unknown = undefined,
  { sessionSlug = 'demo', questionIdsByIndex = [] }: { sessionSlug?: unknown; questionIdsByIndex?: string[] } = {},
): Record<string, Array<{ responder: string; questionId: string; response: string }>> => {
  const networkData = buildPolisDemoSurveyResultsNetworkData(source, { sessionSlug, questionIdsByIndex });
  const out: Record<string, Array<{ responder: string; questionId: string; response: string }>> = {};

  Object.entries(networkData.questionResponses || {}).forEach(([questionId, responderMap]) => {
    if (!responderMap || typeof responderMap !== 'object') return;
    out[questionId] = [];
    Object.entries(responderMap).forEach(([responder, response]) => {
      if (!response || typeof response !== 'object') return;
      out[questionId].push({
        responder,
        questionId,
        response: JSON.stringify(response),
      });
    });
  });

  return out;
};
