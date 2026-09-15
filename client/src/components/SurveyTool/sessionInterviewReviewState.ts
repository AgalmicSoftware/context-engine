import { DEFAULT_AI_MODEL } from '../../../../shared/aiDefaults.mjs';
import type { InterviewDraftResponse } from './sessionInterview';

export function mergeInterviewReview(
  previous: InterviewDraftResponse[],
  edited: Record<string, InterviewDraftResponse>,
  selected: Record<string, boolean>,
  incoming: InterviewDraftResponse[],
  isInitiallySelected: (id: string) => boolean,
  modelId: string = DEFAULT_AI_MODEL,
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
