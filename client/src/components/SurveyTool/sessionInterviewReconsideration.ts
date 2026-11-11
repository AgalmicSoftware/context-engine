import { buildSessionContextPrompt } from '@ce-shared/sessionContextText.mjs';
import {
  loadContextSourcesForAi,
  type ContextSource,
  type ContextSourceOptions,
} from '../../utilities/docLibrary/contextSources';
import type { InterviewDraftResponse, InterviewQuestion, InterviewReconsideration } from './sessionInterview';
import { addsToInterviewComment } from './sessionInterviewComments';
import { resolveFieldProtection } from './sessionInterviewResearch';
import { sameInterviewAnswer } from './sessionInterviewReviewState';
import {
  hasDraftValue,
  isResponseFieldUnsubmitted,
  responseCommentValue,
  responseFieldValue,
  type SessionInterviewModalRecord,
} from './sessionInterviewModalState';

const OWN_CONTEXT_CHARS = 12_000;

/**
 * The person's answers as the page holds them. One they changed without submitting, or an unsent draft restored on
 * load, replaces their submitted one there, so the fields not yet submitted are listed. A locked answer stands and
 * isn't offered, whether it still shows as "*" or they unlocked it on this page: what they encrypted doesn't go to the
 * session's AI, as research sharing redacts it too.
 */
export const readAnswersToReconsider = (
  questions: InterviewQuestion[],
  slice: SessionInterviewModalRecord | null | undefined,
): InterviewReconsideration['earlierAnswers'] =>
  questions.flatMap(({ id }) => {
    const answer = responseFieldValue(slice, 'answers', id);
    const { encryptedAnswer, encryptedComments } = resolveFieldProtection(id, slice || {});
    if (!hasDraftValue(answer) || answer === '*' || encryptedAnswer) return [];
    const additionalComments = encryptedComments ? '' : responseCommentValue(slice, id);
    const unsubmitted = [
      ...(isResponseFieldUnsubmitted(slice, 'answers', id) ? (['answer'] as const) : []),
      ...(additionalComments && isResponseFieldUnsubmitted(slice, 'additionalComments', id)
        ? (['additionalComments'] as const)
        : []),
    ];
    return [
      {
        questionId: id,
        answer,
        ...(additionalComments ? { additionalComments } : {}),
        ...(unsubmitted.length ? { unsubmitted } : {}),
      },
    ];
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

/**
 * Left-out drafts that repeat an answer the AI was given to reconsider: those answers still fit. A locked or
 * encrypted answer never reaches the AI, so a draft left out beside one says nothing about it.
 */
export const readAnswersThatStillFit = (
  leftOut: string[],
  drafts: InterviewDraftResponse[],
  reconsidered: InterviewReconsideration['earlierAnswers'],
  questions: InterviewQuestion[],
): string[] =>
  leftOut.filter((id) => {
    const earlier = reconsidered.find(({ questionId }) => questionId === id);
    const draft = drafts.find(({ questionId }) => questionId === id);
    const kind = questions.find((question) => question.id === id)?.type;
    return !!earlier && !!draft && sameInterviewAnswer(draft.answer, earlier.answer, kind);
  });

/** What review says about the drafts it left out: answers that still fit, then questions already answered. */
export const describeLeftOutDrafts = (leftOut: string[], stillFit: string[], hasDrafts: boolean): string => {
  const fits = leftOut.filter((id) => stillFit.includes(id)).length;
  const others = leftOut.length - fits;
  return [
    fits === 1
      ? 'One of your answers still fits, so it stays as it is.'
      : fits
        ? `${fits} of your answers still fit, so they stay as they are.`
        : '',
    !others
      ? ''
      : hasDrafts || fits
        ? `Left out ${others} ${others === 1 ? 'draft for a question' : 'drafts for questions'} you’ve already answered.`
        : others === 1
          ? 'You’ve already answered the question this draft covers.'
          : 'You’ve already answered every question these drafts cover.',
  ]
    .filter(Boolean)
    .join(' ');
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
