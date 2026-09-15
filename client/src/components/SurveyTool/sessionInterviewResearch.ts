type RecordValue = Record<string, unknown>;
const record = (value: unknown): RecordValue =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as RecordValue) : {};
const redacted = () => ({ redacted: true, reason: 'encrypted_field' });

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
      const answer = record(record(fields.answers)[String(draft.questionId || '')]);
      const comments = record(record(fields.additionalComments)[String(draft.questionId || '')]);
      const encryptedAnswer = draft.answerEncrypted === true || answer.encrypted === true;
      const encryptedComments =
        draft.commentsEncrypted === true ||
        comments.encrypted === true ||
        (comments.audienceMode !== 'explicit' && encryptedAnswer);
      const protect = (values: unknown) => {
        const source = record(values);
        return {
          answer: encryptedAnswer ? redacted() : (source.answer ?? null),
          additionalComments: encryptedComments ? redacted() : (source.additionalComments ?? ''),
          importance: source.importance ?? null,
          conviction: source.conviction ?? null,
        };
      };
      const original = record(draft.original);
      return {
        questionId: String(draft.questionId || ''),
        selection: 'not_selected',
        revisions: buildInterviewRevisionResearch(original.revisions, encryptedAnswer, encryptedComments),
        original: {
          ...protect(original),
          confidence: original.confidence ?? null,
          evidence: encryptedAnswer || encryptedComments ? '' : String(original.evidence || ''),
        },
        reviewed: protect(draft),
        submitted: draft.submissionValueSnapshot ? protect(draft.submissionValueSnapshot) : null,
        redactedFields: [...(encryptedAnswer ? ['answer'] : []), ...(encryptedComments ? ['additionalComments'] : [])],
      };
    })
    .filter((draft) => draft.questionId);

export const buildInterviewRevisionResearch = (
  value: unknown,
  answerEncrypted: boolean,
  commentsEncrypted: boolean,
): RecordValue[] =>
  (Array.isArray(value) ? value : []).map((entry) => {
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
