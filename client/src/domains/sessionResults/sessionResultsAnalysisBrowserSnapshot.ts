import { isResponseAllowedForSessionSlug } from '../../utilities/session/responseSessionScope';

export type ResultsAnalysisBrowserSnapshotResult =
  | {
      ok: true;
      snapshot: { sessionSlug: string; questions: unknown[]; responses: unknown[] };
      counts: Record<string, number>;
    }
  | { ok: false; reason: string };

type RecordLike = Record<string, unknown>;

const toRecord = (value: unknown): RecordLike =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as RecordLike) : {};
const toArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const toText = (value: unknown): string => (value == null ? '' : String(value).replace(/\s+/g, ' ').trim());

const normalizeSlug = (value: unknown): string =>
  toText(value).toLowerCase() === 'general' ? '' : toText(value).toLowerCase();

const valueLooksLocked = (value: unknown): boolean => {
  const record = toRecord(value);
  return (
    record.encrypted === true ||
    record.payloadEncrypted === true ||
    record.locked === true ||
    !!toText(record.encryptedPortion) ||
    toText(record.value) === '*'
  );
};

const responseLooksLocked = (response: RecordLike): boolean =>
  response.encrypted === true ||
  response.payloadEncrypted === true ||
  response.locked === true ||
  valueLooksLocked(response.answer) ||
  valueLooksLocked(response.value) ||
  valueLooksLocked(response.response) ||
  valueLooksLocked(response.additional) ||
  valueLooksLocked(response.additionalComments) ||
  valueLooksLocked(response.comments) ||
  valueLooksLocked(response.comment);

const getAnswerValue = (value: unknown): unknown => {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value))
    return value
      .map(getAnswerValue)
      .filter((entry) => toText(entry))
      .join('; ');
  const record = toRecord(value);
  if (Object.prototype.hasOwnProperty.call(record, 'value')) return getAnswerValue(record.value);
  if (Object.prototype.hasOwnProperty.call(record, 'answer')) return getAnswerValue(record.answer);
  if (Object.prototype.hasOwnProperty.call(record, 'additional')) return getAnswerValue(record.additional);
  return '';
};

const questionIsHydratedForSession = (question: RecordLike, sessionSlug: string): boolean => {
  if (question.__ceQuestionMetadataPending === true) return false;
  const questionSlug = normalizeSlug(question.sessionSlug || '');
  if (
    Object.prototype.hasOwnProperty.call(question, 'sessionSlug') &&
    questionSlug &&
    question.sessionSlugExplicit !== false
  ) {
    return questionSlug === normalizeSlug(sessionSlug);
  }
  return true;
};

export const buildResultsAnalysisBrowserSnapshotFromCacheNode = ({
  networkNode,
  sessionSlug = '',
}: {
  networkNode?: unknown;
  sessionSlug?: unknown;
} = {}): ResultsAnalysisBrowserSnapshotResult => {
  const node = toRecord(networkNode);
  const questionsById = toRecord(node.questions);
  const responsesByQuestion = toRecord(node.questionResponses);
  const normalizedSlug = normalizeSlug(sessionSlug);
  const questions: RecordLike[] = [];
  const responses: RecordLike[] = [];
  const participants = new Set<string>();
  let lockedCount = 0;
  let skippedCount = 0;

  Object.entries(questionsById).forEach(([questionId, questionRaw]) => {
    const question = toRecord(questionRaw);
    if (!questionIsHydratedForSession(question, normalizedSlug)) return;
    questions.push({
      id: toText(question.id || questionId),
      prompt: toText(question.prompt || question.text || question.title || question.question),
      type: toText(question.type || question.questionType),
      options: toArray(question.options).map(toText).filter(Boolean),
      tags: toArray(question.tags).map(toText).filter(Boolean),
    });
  });
  const validQuestionIds = new Set(questions.map((question) => toText(question.id)).filter(Boolean));

  Object.entries(responsesByQuestion).forEach(([questionId, responderMapRaw]) => {
    if (!validQuestionIds.has(questionId)) return;
    const responderMap = toRecord(responderMapRaw);
    Object.entries(responderMap).forEach(([participantAddress, responseRaw]) => {
      let response = responseRaw;
      try {
        response = typeof responseRaw === 'string' ? JSON.parse(responseRaw) : responseRaw;
      } catch {
        skippedCount += 1;
        return;
      }
      const record = toRecord(response);
      if (record.source === 'demo-polis-data') return;
      if (!isResponseAllowedForSessionSlug(record, normalizedSlug)) return;
      if (responseLooksLocked(record)) {
        lockedCount += 1;
        skippedCount += 1;
        return;
      }
      const answer = getAnswerValue(record.answer ?? record.value ?? record.response);
      const additional = getAnswerValue(
        record.additional ?? record.additionalComments ?? record.comments ?? record.comment,
      );
      if (!toText(answer) && !toText(additional)) {
        skippedCount += 1;
        return;
      }
      participants.add(String(participantAddress || `anonymous:${participants.size}`).toLowerCase());
      responses.push({
        questionId,
        participantId: participantAddress,
        answer,
        ...(toText(additional) ? { additionalComments: additional } : {}),
        questionPrompt: toText(toRecord(questionsById[questionId]).prompt),
        questionType: toText(record.type || toRecord(questionsById[questionId]).type),
      });
    });
  });

  if (questions.length === 0) return { ok: false, reason: 'Question cache is not hydrated for this session.' };
  if (responses.length === 0)
    return { ok: false, reason: 'No unlocked submitted responses are available in the local cache.' };

  return {
    ok: true,
    snapshot: {
      sessionSlug: normalizedSlug,
      questions,
      responses,
    },
    counts: {
      questionCount: questions.length,
      responseCount: responses.length,
      participantCount: participants.size,
      lockedCount,
      skippedCount,
    },
  };
};
