import type { InterviewDraftResponse } from './sessionInterview';

export function mergeInterviewReview(
  previous: InterviewDraftResponse[],
  edited: Record<string, InterviewDraftResponse>,
  selected: Record<string, boolean>,
  incoming: InterviewDraftResponse[],
  isInitiallySelected: (id: string) => boolean,
) {
  const drafts = new Map(previous.map((draft) => [draft.questionId, draft]));
  const nextEdited = { ...edited };
  const nextSelected = { ...selected };
  for (const draft of incoming) {
    const prior = drafts.get(draft.questionId);
    let reviewed = { ...draft };
    if (prior && edited[draft.questionId]) {
      // Refresh AI-owned fields, but keep every field the responder changed during review.
      for (const field of ['answer', 'additionalComments', 'importance', 'conviction'] as const) {
        if (JSON.stringify(edited[draft.questionId][field]) !== JSON.stringify(prior[field])) {
          reviewed = { ...reviewed, [field]: edited[draft.questionId][field] };
        }
      }
    }
    drafts.set(draft.questionId, draft);
    nextEdited[draft.questionId] = reviewed;
    if (!(draft.questionId in nextSelected)) nextSelected[draft.questionId] = isInitiallySelected(draft.questionId);
  }
  return { drafts: [...drafts.values()], edited: nextEdited, selected: nextSelected };
}

export const appendInterviewTranscript = (previous: string, current: string) =>
  [previous, current].filter((part) => part.trim()).join('\n\n');
