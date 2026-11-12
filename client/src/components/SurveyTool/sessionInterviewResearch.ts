import { responseValuesEqual as valuesEqual } from './responseValueEquality';
import { interviewDraftFieldValue } from './sessionInterviewReviewState';
import { hasDraftValue } from './sessionInterviewModalState';
import type { InterviewDraftResponse } from './sessionInterview';
type RecordValue = Record<string, unknown>;
const record = (value: unknown): RecordValue =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as RecordValue) : {};
const redacted = () => ({ redacted: true, reason: 'encrypted_field' });
const hasOwn = (value: RecordValue, key: string) => Object.prototype.hasOwnProperty.call(value, key);
const FIELD_KEYS = ['answer', 'additionalComments', 'importance', 'conviction'] as const;
type ResearchField = (typeof FIELD_KEYS)[number];
// How much a shared draft comparison keeps (interviewMode.researchDetail). Minimal keeps
// predicted choices, ratings and confidence but no AI notes or drafted text.
export type InterviewResearchTier = 'minimal' | 'full';
export type InterviewDraftOrigin = 'external_prefill' | 'voice_interview' | 'typed_context';
type ResearchOptions = { tier?: InterviewResearchTier | null; textAnswer?: boolean; changedFields?: string[] };

// Drops drafted text: comments always, and the answer itself on freeform questions.
const withoutText = (snapshot: RecordValue, textAnswer: boolean): RecordValue => {
  const { additionalComments: _comments, evidence: _evidence, ...rest } = snapshot;
  return textAnswer && !record(rest.answer).redacted ? { ...rest, answer: null } : rest;
};

const STRUCTURED_QUESTION_TYPES = new Set(['binary', 'multichoice', 'rating', 'quadratic']);
/** Whether a question takes free text: the interview treats every other type that way. */
export const isTextInterviewQuestion = (question: unknown): boolean => {
  const value = record(question);
  return !STRUCTURED_QUESTION_TYPES.has(
    String(value.type || value.questionType || 'freeform')
      .trim()
      .toLowerCase(),
  );
};

/** Where a draft's first prediction came from. */
export const resolveInterviewDraftOrigin = (
  draft: unknown,
  packet: { source?: { modelId?: unknown } } | null,
  source: { modelId?: unknown } | null,
): InterviewDraftOrigin => {
  if (String(source?.modelId || '') === 'direct-user-context') return 'typed_context';
  const value = record(draft);
  const first = Array.isArray(value.revisions) && value.revisions.length ? record(value.revisions[0]) : value;
  const modelId = String(first.modelId || '');
  return packet && (!modelId || modelId === String(packet.source?.modelId || ''))
    ? 'external_prefill'
    : 'voice_interview';
};

export const resolveFieldProtection = (
  questionId: string,
  fields: { answers?: unknown; additionalComments?: unknown } = {},
  draft: RecordValue = {},
) => {
  const answer = record(record(fields.answers)[questionId]);
  const comments = record(record(fields.additionalComments)[questionId]);
  const encryptedAnswer = draft.answerEncrypted === true || answer.encrypted === true;
  const encryptedComments =
    draft.commentsEncrypted === true ||
    comments.encrypted === true ||
    (comments.audienceMode !== 'explicit' && encryptedAnswer);
  return { encryptedAnswer, encryptedComments };
};

/**
 * Response fields as interview review reads them. What someone encrypted doesn't go to the session's AI, even once
 * unlocked on this page, so their encrypted answers and comments count as locked ("*"): review never shows, quotes,
 * joins or sends their text, an encrypted answer stands as a locked one does, and submitting leaves an encrypted
 * comment as it was unless they choose the AI's.
 */
export const lockEncryptedFields = (fields: RecordValue | null | undefined): RecordValue | null | undefined => {
  const source = record(fields);
  const lockIn = (field: 'answers' | 'additionalComments', protectedField: 'encryptedAnswer' | 'encryptedComments') => {
    const entries = record(source[field]);
    const locked = Object.keys(entries).filter((questionId) => {
      const { value } = record(entries[questionId]);
      return hasDraftValue(value) && value !== '*' && resolveFieldProtection(questionId, source)[protectedField];
    });
    const masked = locked.map((questionId) => [questionId, { ...record(entries[questionId]), value: '*' }]);
    return locked.length ? { [field]: { ...entries, ...Object.fromEntries(masked) } } : null;
  };
  const answers = lockIn('answers', 'encryptedAnswer');
  const comments = lockIn('additionalComments', 'encryptedComments');
  return answers || comments ? { ...source, ...answers, ...comments } : fields;
};

/**
 * Reviewed values an AI may hear: an answer or comment someone encrypted stays out, even once unlocked on this page,
 * and so do the ratings beside it, as research sharing redacts them.
 */
export const withoutEncryptedFields = (
  questionId: string,
  fields: RecordValue | null | undefined,
  values: InterviewDraftResponse | undefined,
): InterviewDraftResponse | undefined => {
  if (!values) return values;
  const { encryptedAnswer, encryptedComments } = resolveFieldProtection(questionId, record(fields));
  if (!encryptedAnswer && !encryptedComments) return values;
  const kept = (field: string) =>
    !(field === 'answer' && encryptedAnswer) &&
    !(field === 'additionalComments' && encryptedComments) &&
    field !== 'importance' &&
    field !== 'conviction';
  const {
    answer,
    additionalComments,
    importance: _importance,
    conviction: _conviction,
    userEditedFields,
    ...rest
  } = values;
  return {
    ...rest,
    answer: kept('answer') ? answer : undefined,
    ...(kept('additionalComments') ? { additionalComments } : {}),
    ...(userEditedFields ? { userEditedFields: userEditedFields.filter(kept) } : {}),
  };
};

const protectSnapshot = (values: unknown, encryptedAnswer: boolean, encryptedComments: boolean): RecordValue => {
  const source = record(values);
  return {
    answer: encryptedAnswer ? redacted() : (source.answer ?? null),
    additionalComments: encryptedComments ? redacted() : (source.additionalComments ?? ''),
    importance: encryptedAnswer || encryptedComments ? redacted() : (source.importance ?? null),
    conviction: encryptedAnswer || encryptedComments ? redacted() : (source.conviction ?? null),
  };
};

export const buildInterviewUserEditedFields = (value: unknown): ResearchField[] => {
  const source = record(value);
  const edited = Array.isArray(source.userEditedFields) ? source.userEditedFields : [];
  return [
    ...new Set(
      edited
        .map((field) => String(field || ''))
        .filter((field): field is ResearchField => (FIELD_KEYS as readonly string[]).includes(field)),
    ),
  ];
};

export const buildInterviewChangedFields = (originalValue: unknown, finalValue: unknown): ResearchField[] => {
  const original = record(originalValue);
  const final = record(finalValue);
  return FIELD_KEYS.filter((field) => {
    if (!hasOwn(original, field) && !hasOwn(final, field)) return false;
    return !valuesEqual(
      interviewDraftFieldValue(field, original[field]),
      interviewDraftFieldValue(field, final[field]),
    );
  });
};

export const buildInterviewRevisionResearch = (
  value: unknown,
  answerEncrypted: boolean,
  commentsEncrypted: boolean,
  options: ResearchOptions = {},
): RecordValue[] =>
  (Array.isArray(value) ? value : []).slice(0, 100).map((entry) => {
    const revision = record(entry);
    const full = {
      revision: Number(revision.revision) || 1,
      modelId: String(revision.modelId || 'unknown').slice(0, 256),
      answer: answerEncrypted ? redacted() : (revision.answer ?? null),
      additionalComments: commentsEncrypted ? redacted() : (revision.additionalComments ?? ''),
      importance: answerEncrypted || commentsEncrypted ? redacted() : (revision.importance ?? null),
      conviction: answerEncrypted || commentsEncrypted ? redacted() : (revision.conviction ?? null),
      confidence: revision.confidence ?? null,
      evidence: answerEncrypted || commentsEncrypted ? '' : String(revision.evidence || ''),
    };
    return options.tier === 'minimal' ? withoutText(full, options.textAnswer === true) : full;
  });

export const buildSelectedInterviewResearch = (
  value: unknown,
  fields: { answers?: unknown; additionalComments?: unknown } = {},
  options: ResearchOptions = {},
): RecordValue | null => {
  const draft = record(value);
  const questionId = String(draft.questionId || '');
  if (!questionId) return null;
  const original =
    draft.original && typeof draft.original === 'object' && !Array.isArray(draft.original)
      ? record(draft.original)
      : draft;
  const { encryptedAnswer, encryptedComments } = resolveFieldProtection(questionId, fields, draft);
  const minimal = options.tier === 'minimal';
  const textAnswer = options.textAnswer === true;
  const originalPrediction = {
    ...protectSnapshot(original, encryptedAnswer, encryptedComments),
    confidence: original.confidence ?? null,
    evidence: encryptedAnswer || encryptedComments ? '' : String(original.evidence || ''),
  };
  const finalSubmitted = protectSnapshot(draft, encryptedAnswer, encryptedComments);
  // A hidden draft's answer from before the AI's guess was shown, protected like the final one.
  const blindAnswer = encryptedAnswer ? redacted() : minimal && textAnswer ? null : (draft.blindAnswer ?? null);
  return {
    questionId,
    selection: 'selected',
    ...(hasOwn(draft, 'blindAnswer') ? { blindAnswer } : {}),
    originalPrediction: minimal ? withoutText(originalPrediction, textAnswer) : originalPrediction,
    predictionRevisions: buildInterviewRevisionResearch(
      original.revisions || draft.revisions,
      encryptedAnswer,
      encryptedComments,
      options,
    ),
    finalSubmitted: minimal ? withoutText(finalSubmitted, textAnswer) : finalSubmitted,
    changedFields:
      (options.changedFields as ResearchField[] | undefined) ?? buildInterviewChangedFields(original, draft),
    userEditedFields: buildInterviewUserEditedFields(draft),
    redactedFields: [
      ...(encryptedAnswer ? ['answer'] : []),
      ...(encryptedComments ? ['additionalComments'] : []),
      ...(encryptedAnswer || encryptedComments ? ['importance', 'conviction'] : []),
    ],
  };
};

// Rejected drafts travel only as consented metadata on a submitted response.
// They must never enter the answer list or leak text protected by either field lock.
export const buildUnselectedInterviewResearch = (
  value: unknown,
  fields: { answers?: unknown; additionalComments?: unknown } = {},
): RecordValue[] =>
  (Array.isArray(value) ? value : [])
    .slice(0, 100)
    .map((raw) => {
      const draft = record(raw);
      const questionId = String(draft.questionId || '');
      const { encryptedAnswer, encryptedComments } = resolveFieldProtection(questionId, fields, draft);
      const originalContainer = record(draft.original);
      const revisions = Array.isArray(originalContainer.revisions) ? originalContainer.revisions : [];
      const original = revisions.length ? record(revisions[0]) : originalContainer;
      return {
        questionId,
        selection: 'not_selected',
        revisions: buildInterviewRevisionResearch(revisions, encryptedAnswer, encryptedComments),
        original: {
          ...protectSnapshot(original, encryptedAnswer, encryptedComments),
          confidence: original.confidence ?? null,
          evidence: encryptedAnswer || encryptedComments ? '' : String(original.evidence || ''),
        },
        reviewed: protectSnapshot(draft, encryptedAnswer, encryptedComments),
        submitted: draft.submissionValueSnapshot
          ? protectSnapshot(draft.submissionValueSnapshot, encryptedAnswer, encryptedComments)
          : null,
        changedFields: buildInterviewChangedFields(original, draft),
        userEditedFields: buildInterviewUserEditedFields(draft),
        redactedFields: [
          ...(encryptedAnswer ? ['answer'] : []),
          ...(encryptedComments ? ['additionalComments'] : []),
          ...(encryptedAnswer || encryptedComments ? ['importance', 'conviction'] : []),
        ],
      };
    })
    .filter((draft) => draft.questionId);

// Rating envelopes are resolved after research snapshots are built. Apply their
// final protection to every snapshot for this question before serialization.
export const redactInterviewEncryptedRatings = (
  value: unknown,
  questionId: string,
  protectedFields: Array<'importance' | 'conviction'>,
): unknown => {
  if (Array.isArray(value))
    return value.map((entry) => redactInterviewEncryptedRatings(entry, questionId, protectedFields));
  if (!value || typeof value !== 'object') return value;
  const source = record(value);
  if (source.questionId && String(source.questionId).toLowerCase() !== questionId.toLowerCase()) return value;
  return Object.fromEntries(
    Object.entries(source).map(([key, entry]) => [
      key,
      protectedFields.includes(key as 'importance' | 'conviction')
        ? redacted()
        : key === 'redactedFields' && Array.isArray(entry)
          ? [...new Set([...entry, ...protectedFields])]
          : redactInterviewEncryptedRatings(entry, questionId, protectedFields),
    ]),
  );
};
