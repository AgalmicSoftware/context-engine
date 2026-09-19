type RecordValue = Record<string, unknown>;
const record = (value: unknown): RecordValue =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as RecordValue) : {};
const redacted = () => ({ redacted: true, reason: 'encrypted_field' });
const hasOwn = (value: RecordValue, key: string) => Object.prototype.hasOwnProperty.call(value, key);
const FIELD_KEYS = ['answer', 'additionalComments', 'importance', 'conviction'] as const;
type ResearchField = (typeof FIELD_KEYS)[number];

const valuesEqual = (left: unknown, right: unknown): boolean => {
  try {
    return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
  } catch (_) {
    return left === right;
  }
};

const resolveFieldProtection = (
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

const protectSnapshot = (values: unknown, encryptedAnswer: boolean, encryptedComments: boolean): RecordValue => {
  const source = record(values);
  return {
    answer: encryptedAnswer ? redacted() : (source.answer ?? null),
    additionalComments: encryptedComments ? redacted() : (source.additionalComments ?? ''),
    importance: source.importance ?? null,
    conviction: source.conviction ?? null,
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
    return !valuesEqual(original[field], final[field]);
  });
};

export const buildInterviewRevisionResearch = (
  value: unknown,
  answerEncrypted: boolean,
  commentsEncrypted: boolean,
): RecordValue[] =>
  (Array.isArray(value) ? value : []).slice(0, 100).map((entry) => {
    const revision = record(entry);
    return {
      revision: Number(revision.revision) || 1,
      modelId: String(revision.modelId || 'unknown').slice(0, 256),
      answer: answerEncrypted ? redacted() : (revision.answer ?? null),
      additionalComments: commentsEncrypted ? redacted() : (revision.additionalComments ?? ''),
      importance: revision.importance ?? null,
      conviction: revision.conviction ?? null,
      confidence: revision.confidence ?? null,
      evidence: answerEncrypted || commentsEncrypted ? '' : String(revision.evidence || ''),
    };
  });

export const buildSelectedInterviewResearch = (
  value: unknown,
  fields: { answers?: unknown; additionalComments?: unknown } = {},
): RecordValue | null => {
  const draft = record(value);
  const questionId = String(draft.questionId || '');
  if (!questionId) return null;
  const original =
    draft.original && typeof draft.original === 'object' && !Array.isArray(draft.original)
      ? record(draft.original)
      : draft;
  const { encryptedAnswer, encryptedComments } = resolveFieldProtection(questionId, fields, draft);
  return {
    questionId,
    selection: 'selected',
    originalPrediction: {
      ...protectSnapshot(original, encryptedAnswer, encryptedComments),
      confidence: original.confidence ?? null,
      evidence: encryptedAnswer || encryptedComments ? '' : String(original.evidence || ''),
    },
    predictionRevisions: buildInterviewRevisionResearch(
      original.revisions || draft.revisions,
      encryptedAnswer,
      encryptedComments,
    ),
    finalSubmitted: protectSnapshot(draft, encryptedAnswer, encryptedComments),
    changedFields: buildInterviewChangedFields(original, draft),
    userEditedFields: buildInterviewUserEditedFields(draft),
    redactedFields: [...(encryptedAnswer ? ['answer'] : []), ...(encryptedComments ? ['additionalComments'] : [])],
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
        redactedFields: [...(encryptedAnswer ? ['answer'] : []), ...(encryptedComments ? ['additionalComments'] : [])],
      };
    })
    .filter((draft) => draft.questionId);
