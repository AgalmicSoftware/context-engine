import { DEFAULT_AI_MODEL } from '../../../../shared/aiDefaults.mjs';
import { responseValuesEqual, answerValueType } from './responseValueEquality';
import { hasDraftValue } from './sessionInterviewModalState';
import type { InterviewDraftResponse } from './sessionInterview';

// Review seeds '' for drafts that arrive without a comment, so an empty
// comment counts as no comment when comparing a draft with its prediction.
export const interviewDraftFieldValue = (field: string, value: unknown) =>
  field === 'additionalComments' ? String(value ?? '') : value;

// Chosen options in another order are the same answer; quadratic votes stay in option order.
const comparable = (value: unknown) =>
  Array.isArray(value) && value.every((item) => typeof item === 'string') ? [...value].sort() : value;

/** Whether two answers to one question say the same thing, compared as the form compares answers. */
export const sameInterviewAnswer = (left: unknown, right: unknown, questionKind?: unknown) =>
  responseValuesEqual(comparable(left), comparable(right), answerValueType(questionKind));

// New evidence overrules an answer only when it gives a different one. A locked ("*")
// answer can't be compared, so it stands.
export const overrulesSavedAnswer = (draftAnswer: unknown, answer: unknown, questionKind?: unknown) =>
  answer !== '*' && !sameInterviewAnswer(draftAnswer, answer, questionKind);

/** Whether submitting this answer would change an earlier one; a locked earlier answer might. */
export const changesEarlierAnswer = (answer: unknown, earlier: unknown, questionKind?: unknown) =>
  hasDraftValue(earlier) && (earlier === '*' || !sameInterviewAnswer(answer, earlier, questionKind));

// Which drafts join review. A question the person has already answered gets no new draft,
// unless the person's own words in this interview (`ownEvidence`; an AI prefill's prediction
// never counts) give a different answer: that draft joins like any other, and its card says
// which answer it changes. A draft already under review keeps updating, including after the
// person submits it. `leftOut` lists the drafts not added, so review can say why.
export function mergeInterviewReview(
  previous: InterviewDraftResponse[],
  edited: Record<string, InterviewDraftResponse>,
  selected: Record<string, boolean>,
  incoming: InterviewDraftResponse[],
  currentAnswer: (id: string) => unknown,
  modelId: string = DEFAULT_AI_MODEL,
  savedComment: (id: string) => string = () => '',
  ownEvidence: (draft: InterviewDraftResponse) => boolean = () => false,
  questionKind: (id: string) => unknown = () => 'freeform',
) {
  const drafts = new Map(previous.map((draft) => [draft.questionId, draft]));
  const nextEdited = { ...edited };
  const nextSelected = { ...selected };
  const leftOut: string[] = [];
  for (const incomingDraft of incoming) {
    const answer = drafts.has(incomingDraft.questionId) ? undefined : currentAnswer(incomingDraft.questionId);
    const answered = hasDraftValue(answer);
    if (
      answered &&
      !(
        ownEvidence(incomingDraft) &&
        overrulesSavedAnswer(incomingDraft.answer, answer, questionKind(incomingDraft.questionId))
      )
    ) {
      leftOut.push(incomingDraft.questionId);
      continue;
    }
    const draft = { ...incomingDraft };
    const prior = drafts.get(draft.questionId);
    const snapshot = (value: InterviewDraftResponse) => ({
      answer: value.answer,
      additionalComments: value.additionalComments,
      importance: value.importance,
      conviction: value.conviction,
      confidence: value.confidence,
      evidence: value.evidence,
    });
    const revisions = [...(prior?.revisions || [])];
    if (prior && !revisions.length) revisions.push({ ...snapshot(prior), revision: 1, modelId });
    if (!prior || JSON.stringify(snapshot(prior)) !== JSON.stringify(snapshot(draft))) {
      revisions.push({ ...snapshot(draft), revision: revisions.length + 1, modelId });
    }
    draft.revisions = revisions;
    let reviewed = { ...draft };
    const userEditedFields = new Set(edited[draft.questionId]?.userEditedFields || []);
    if (prior && edited[draft.questionId]) {
      // Refresh AI-owned fields, but keep every field the responder changed during review.
      for (const field of ['answer', 'additionalComments', 'importance', 'conviction'] as const) {
        const value = edited[draft.questionId][field];
        if (
          userEditedFields.has(field) ||
          JSON.stringify(interviewDraftFieldValue(field, value)) !==
            JSON.stringify(interviewDraftFieldValue(field, prior[field]))
        ) {
          // Review seeds the saved comment when the AI proposed none; keep it without calling it an edit.
          const seededSavedComment =
            field === 'additionalComments' &&
            !userEditedFields.has(field) &&
            interviewDraftFieldValue(field, value) === savedComment(draft.questionId);
          if (!seededSavedComment) userEditedFields.add(field);
          reviewed = { ...reviewed, [field]: value };
        }
      }
    }
    // An AI prediction agreeing with an edit must not give later predictions ownership of that field.
    if (userEditedFields.size) reviewed.userEditedFields = [...userEditedFields];
    drafts.set(draft.questionId, draft);
    nextEdited[draft.questionId] = reviewed;
    if (!(draft.questionId in nextSelected)) nextSelected[draft.questionId] = true;
  }
  return { drafts: [...drafts.values()], edited: nextEdited, selected: nextSelected, leftOut };
}

export const appendInterviewTranscript = (previous: string, current: string) =>
  [previous, current].filter((part) => part.trim()).join('\n\n');
