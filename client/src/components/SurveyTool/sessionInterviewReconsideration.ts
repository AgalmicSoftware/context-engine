import { buildSessionContextPrompt } from '@ce-shared/sessionContextText.mjs';
import {
  loadContextSourcesForAi,
  type ContextSource,
  type ContextSourceOptions,
} from '../../utilities/docLibrary/contextSources';
import type { InterviewDraftResponse, InterviewQuestion, InterviewReconsideration } from './sessionInterview';
import {
  hasDraftValue,
  responseCommentValue,
  responseFieldValue,
  type SessionInterviewModalRecord,
} from './sessionInterviewModalState';

const OWN_CONTEXT_CHARS = 12_000;

/** The person's saved answers. A locked ("*") answer can't be read, so it stands and isn't offered. */
export const readAnswersToReconsider = (
  questions: InterviewQuestion[],
  slice: SessionInterviewModalRecord | null | undefined,
): InterviewReconsideration['savedAnswers'] =>
  questions.flatMap(({ id }) => {
    const answer = responseFieldValue(slice, 'answers', id);
    if (!hasDraftValue(answer) || answer === '*') return [];
    const additionalComments = responseCommentValue(slice, id);
    return [{ questionId: id, answer, ...(additionalComments ? { additionalComments } : {}) }];
  });

/** A draft that keeps a saved answer but says something its comment doesn't. A locked answer stands. */
export const addsToSavedAnswer = (
  draft: InterviewDraftResponse | undefined,
  slice: SessionInterviewModalRecord | null | undefined,
): boolean => {
  const comment = String(draft?.additionalComments || '').trim();
  return (
    !!draft &&
    !!comment &&
    responseFieldValue(slice, 'answers', draft.questionId) !== '*' &&
    comment !== responseCommentValue(slice, draft.questionId).trim()
  );
};

/** The files this person added themselves, as the shared prompt block; '' when none can be read. */
export const loadOwnContextForMapping = async (
  sources: ContextSource[],
  options: ContextSourceOptions,
): Promise<string> => {
  const account = String((options.context as { account?: unknown } | undefined)?.account || '').toLowerCase();
  const own = account ? sources.filter(({ addedBy }) => addedBy === account) : [];
  if (!own.length) return '';
  return buildSessionContextPrompt({
    sessionContext: null,
    sources: await loadContextSourcesForAi(own, options),
    totalChars: OWN_CONTEXT_CHARS,
  }).text;
};
