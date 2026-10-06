import { DEFAULT_AI_MODEL } from '../../../../shared/aiDefaults.mjs';
import type { InterviewDraftResponse } from './sessionInterview';

// Review seeds '' for drafts that arrive without a comment, so an empty
// comment counts as no comment when comparing a draft with its prediction.
export const interviewDraftFieldValue = (field: string, value: unknown) =>
  field === 'additionalComments' ? String(value ?? '') : value;

export function mergeInterviewReview(
  previous: InterviewDraftResponse[],
  edited: Record<string, InterviewDraftResponse>,
  selected: Record<string, boolean>,
  incoming: InterviewDraftResponse[],
  isInitiallySelected: (id: string) => boolean,
  modelId: string = DEFAULT_AI_MODEL,
  savedComment: (id: string) => string = () => '',
) {
  const drafts = new Map(previous.map((draft) => [draft.questionId, draft]));
  const nextEdited = { ...edited };
  const nextSelected = { ...selected };
  for (const incomingDraft of incoming) {
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
    if (!(draft.questionId in nextSelected)) nextSelected[draft.questionId] = isInitiallySelected(draft.questionId);
  }
  return { drafts: [...drafts.values()], edited: nextEdited, selected: nextSelected };
}

export const appendInterviewTranscript = (previous: string, current: string) =>
  [previous, current].filter((part) => part.trim()).join('\n\n');
