import demoPolisData from '../../variables/demo/demo_polis_data.json';
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

const resolvePolisVoteAnswer = (vote: unknown): string | null => {
  if (vote === 1 || vote === '1') return 'Agree';
  if (vote === -1 || vote === '-1') return 'Disagree';
  if (vote === 0 || vote === '0') return 'Unsure';
  return null;
};

export const buildPolisDemoSurveyResultsNetworkData = (
  source: unknown = demoPolisData,
  { sessionSlug = 'demo' }: { sessionSlug?: unknown } = {},
): SurveyResultsScopedQuestionNetworkData => {
  const normalizedSessionSlug = normalizeSessionSlug(sessionSlug || 'demo') || 'demo';
  const comments = isRecord(source) && Array.isArray(source.comments) ? source.comments.filter(isRecord) : [];
  const participantsVotes =
    isRecord(source) && Array.isArray(source.participantsVotes) ? source.participantsVotes.filter(isRecord) : [];
  const questionPool = buildPolisDemoQuestionPool(source, {
    sessionSlug: normalizedSessionSlug,
  });

  const questions: Record<string, SurveyResultsQuestionRecord> = {};
  const questionIdsByVoteIndex: Record<number, string> = {};

  questionPool.forEach((question, index) => {
    const questionId = normalizeQuestionId(question.id);
    if (!questionId) return;
    const sourceComment = comments[index] || {};
    questionIdsByVoteIndex[index] = questionId;
    questions[questionId] = {
      ...question,
      id: questionId,
      prompt: question.prompt,
      type: question.type || 'binary',
      questionType: question.type || 'binary',
      options: ['Agree', 'Unsure', 'Disagree'],
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
    Object.keys(votes).forEach((voteIndexKey) => {
      const voteIndex = Number(voteIndexKey);
      if (!Number.isInteger(voteIndex)) return;
      const questionId = questionIdsByVoteIndex[voteIndex];
      if (!questionId) return;
      const answerValue = resolvePolisVoteAnswer(votes[voteIndexKey]);
      if (!answerValue) return;
      const comment = comments[voteIndex] || {};
      const timestamp = readNumber(comment.timestamp, 0);
      const question = questions[questionId] || {};
      if (!questionResponses[questionId]) questionResponses[questionId] = {};
      questionResponses[questionId][responder] = {
        type: 'binary',
        questionType: 'binary',
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

export const buildPolisDemoSurveyResultsAggregatorData = (
  source: unknown = demoPolisData,
  { sessionSlug = 'demo' }: { sessionSlug?: unknown } = {},
): Record<string, Array<{ responder: string; questionId: string; response: string }>> => {
  const networkData = buildPolisDemoSurveyResultsNetworkData(source, { sessionSlug });
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
