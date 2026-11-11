import { buildSessionContextPrompt } from '@ce-shared/sessionContextText.mjs';
import {
  loadContextSourcesForAi,
  type ContextSource,
  type ContextSourceOptions,
} from '../../utilities/docLibrary/contextSources';
import type { InterviewDraftResponse, InterviewQuestion, InterviewReconsideration } from './sessionInterview';
import { addsToInterviewComment } from './sessionInterviewComments';
import { resolveFieldProtection } from './sessionInterviewResearch';
import {
  hasDraftValue,
  responseCommentValue,
  responseFieldValue,
  type SessionInterviewModalRecord,
} from './sessionInterviewModalState';

const OWN_CONTEXT_CHARS = 12_000;

/**
 * The person's saved answers. A locked answer stands and isn't offered, whether it still shows as "*" or they
 * unlocked it on this page: what they encrypted doesn't go to the session's AI, as research sharing redacts it too.
 */
export const readAnswersToReconsider = (
  questions: InterviewQuestion[],
  slice: SessionInterviewModalRecord | null | undefined,
): InterviewReconsideration['savedAnswers'] =>
  questions.flatMap(({ id }) => {
    const answer = responseFieldValue(slice, 'answers', id);
    const { encryptedAnswer, encryptedComments } = resolveFieldProtection(id, slice || {});
    if (!hasDraftValue(answer) || answer === '*' || encryptedAnswer) return [];
    const additionalComments = encryptedComments ? '' : responseCommentValue(slice, id);
    return [{ questionId: id, answer, ...(additionalComments ? { additionalComments } : {}) }];
  });

/** A draft that keeps a saved answer but says something its comment doesn't. A locked answer or comment stands. */
export const addsToSavedAnswer = (
  draft: InterviewDraftResponse | undefined,
  slice: SessionInterviewModalRecord | null | undefined,
): boolean =>
  !!draft &&
  responseFieldValue(slice, 'answers', draft.questionId) !== '*' &&
  responseFieldValue(slice, 'additionalComments', draft.questionId) !== '*' &&
  addsToInterviewComment(responseCommentValue(slice, draft.questionId), draft.additionalComments);

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
