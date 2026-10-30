import { useCallback, useEffect, useRef, useState } from 'react';
import { hashSeed, mulberry32 } from '../../utilities/survey/seededPrng.js';
import {
  hasDraftValue,
  responseCommentValue,
  responseFieldValue,
  type SessionInterviewModalRecord,
} from './sessionInterviewModalState';
import { isTextInterviewQuestion, resolveInterviewDraftOrigin } from './sessionInterviewResearch';
import type { InterviewDraftResponse, InterviewPrefillPacket, InterviewQuestion } from './sessionInterview';

// Hidden drafts (interviewMode.hiddenDraftShare) measure anchoring. A stable random share
// of a person's AI prefill drafts starts blank, and the AI's guess appears only after
// they answer. That first answer, given without seeing the guess, is the one scored.

export const HIDDEN_DRAFT_NOTE = "Your AI's answer is hidden until you answer.";

/** A hidden draft's first answer, kept from the moment the AI's guess is revealed. */
export type HiddenInterviewDraft = { blindAnswer?: unknown; revealedAt?: number };
type HiddenDrafts = Record<string, HiddenInterviewDraft>;

/** Drafts that can be hidden: the person's own AI predicted a structured answer they haven't given yet. */
export const hideableInterviewDraftIds = (
  drafts: InterviewDraftResponse[],
  questions: InterviewQuestion[],
  packet: InterviewPrefillPacket | null,
  hasSavedAnswer: (questionId: string) => boolean,
): string[] =>
  drafts
    .filter((draft) => {
      const question = questions.find((entry) => entry.id === draft.questionId);
      return (
        !!question &&
        !isTextInterviewQuestion(question) &&
        hasDraftValue(draft.answer) &&
        !hasSavedAnswer(draft.questionId) &&
        resolveInterviewDraftOrigin(draft, packet, packet?.source || null) === 'external_prefill'
      );
    })
    .map((draft) => draft.questionId);

/** Picks the drafts to hide: the same ones for a person on every reload, and at least one of three or more. */
export const pickHiddenInterviewDrafts = (questionIds: string[], share: number, seed: string): string[] => {
  if (!(share > 0) || !questionIds.length) return [];
  const count = Math.max(Math.round(questionIds.length * share), questionIds.length >= 3 ? 1 : 0);
  return questionIds
    .map((id, index) => ({ id, index, rank: mulberry32(hashSeed(`${seed}|${id}`))() }))
    .sort((left, right) => left.rank - right.rank || left.index - right.index)
    .slice(0, count)
    .map(({ id }) => id);
};

/** One-click answers reveal the guess at once; sliders, multi-select and allocations once the person moves on. */
export const revealsOnAnswer = (question?: InterviewQuestion): boolean =>
  question?.type === 'binary' || (question?.type === 'multichoice' && question.singleSelect === true);

/** A hidden draft as the person sees and submits it: only the fields they set, over a blank draft. */
export const withoutAiDraft = (edited: InterviewDraftResponse, savedComment = ''): InterviewDraftResponse => {
  const own = new Set(edited.userEditedFields || []);
  return {
    questionId: edited.questionId,
    answer: own.has('answer') ? edited.answer : undefined,
    additionalComments: own.has('additionalComments') ? edited.additionalComments : savedComment,
    ...(own.has('importance') ? { importance: edited.importance } : {}),
    ...(own.has('conviction') ? { conviction: edited.conviction } : {}),
    ...(edited.userEditedFields ? { userEditedFields: edited.userEditedFields } : {}),
  };
};

/** An answer as people read it: "Agree", "Parks, Transit", "7 of 10". */
export const describeInterviewAnswer = (answer: unknown, question?: InterviewQuestion): string => {
  if (question?.type === 'quadratic' && Array.isArray(answer)) {
    const votes = question.options
      .map((option, index) => ({ option, votes: Number(answer[index]) || 0 }))
      .filter(({ votes }) => votes)
      .sort((left, right) => Math.abs(right.votes) - Math.abs(left.votes));
    return votes.map(({ option, votes }) => `${option} ${votes > 0 ? '+' : ''}${votes}`).join(', ') || 'no votes';
  }
  if (question?.type === 'rating' && question.scale) return `${answer} of ${question.scale.max}`;
  return Array.isArray(answer) ? answer.join(', ') : String(answer);
};

/** "Your AI guessed: Agree · 70% sure", from the prediction that was hidden. */
export const describeInterviewGuess = (draft: InterviewDraftResponse, question?: InterviewQuestion): string => {
  const first = draft.revisions?.[0] || draft;
  const confidence = Number(first.confidence);
  const sure =
    first.confidence === undefined || !Number.isFinite(confidence)
      ? ''
      : ` · ${Math.round(Math.max(0, Math.min(1, confidence)) * 100)}% sure`;
  return `Your AI guessed: ${describeInterviewAnswer(first.answer, question)}${sure}`;
};

type ReviewValues = {
  editedDrafts: Record<string, InterviewDraftResponse>;
  // The person's saved answers and comments for this session, as review reads them.
  savedResponses: SessionInterviewModalRecord | null | undefined;
};
const ownDraftIn = ({ editedDrafts, savedResponses }: ReviewValues, questionId: string) =>
  withoutAiDraft(
    editedDrafts[questionId] || { questionId, answer: undefined },
    responseCommentValue(savedResponses, questionId),
  );

// Answered but still hidden: their guesses wait until the person moves on.
const pendingAnswers = (current: HiddenDrafts, values: ReviewValues, except = '') =>
  Object.fromEntries(
    Object.keys(current)
      .filter((id) => id !== except && current[id].revealedAt === undefined)
      .map((id) => [id, ownDraftIn(values, id).answer])
      .filter(([, answer]) => hasDraftValue(answer)),
  );

const revealAnswers = (current: HiddenDrafts, answers: Record<string, unknown>, revealedAt = Date.now()) => {
  if (!Object.keys(answers).length) return current;
  const next = { ...current };
  for (const [id, blindAnswer] of Object.entries(answers)) next[id] = { blindAnswer, revealedAt };
  return next;
};

// Turns still-hidden drafts back into ordinary ones; a revealed draft keeps its blind answer.
const showUnrevealed = (current: HiddenDrafts, questionIds: string[]) => {
  const shown = questionIds.filter((id) => current[id] && current[id].revealedAt === undefined);
  return shown.length ? Object.fromEntries(Object.entries(current).filter(([id]) => !shown.includes(id))) : current;
};

type Options = ReviewValues & {
  questions: InterviewQuestion[];
  researchOn: boolean;
  // Told which still-hidden drafts' questions now have an answer, so review can drop them.
  onAnswered: (questionIds: string[]) => void;
};

/** Hidden-draft state for one review: which drafts are hidden, and each one's blind answer once revealed. */
export function useInterviewHiddenDrafts({ questions, editedDrafts, savedResponses, researchOn, onAnswered }: Options) {
  const [hidden, setHidden] = useState<HiddenDrafts>({});
  const assignedRef = useRef(false);
  // Read by the stable callbacks below, which the modal's memoized callbacks depend on.
  const latest = useRef<ReviewValues & { hidden: HiddenDrafts }>({ editedDrafts, savedResponses, hidden });
  latest.current = { editedDrafts, savedResponses, hidden };
  const onAnsweredRef = useRef(onAnswered);
  onAnsweredRef.current = onAnswered;
  const questionFor = (questionId: string) => questions.find((question) => question.id === questionId);

  // Unticking research sharing shows every draft: answered ones reveal their guess,
  // and unanswered ones become ordinary drafts that are never hidden again.
  useEffect(() => {
    if (researchOn) return;
    setHidden((current) => {
      const next = revealAnswers(current, pendingAnswers(current, latest.current));
      return showUnrevealed(next, Object.keys(next));
    });
  }, [researchOn]);

  // Saved answers can load after drafts were hidden. Those questions were answered before,
  // so their drafts stop being hidden and are never measured as blind. An answered question
  // gets no suggestion, so review drops each one the person hasn't answered here.
  useEffect(() => {
    const answered = Object.keys(latest.current.hidden).filter(
      (id) =>
        latest.current.hidden[id].revealedAt === undefined &&
        hasDraftValue(responseFieldValue(savedResponses, 'answers', id)),
    );
    if (!answered.length) return;
    setHidden((current) => showUnrevealed(current, answered));
    onAnsweredRef.current(answered);
  }, [savedResponses]);

  /** Hides these drafts and returns those it hid. Only the first call in a review counts, so nothing already shown is hidden. */
  const assign = useCallback((questionIds: string[]): string[] => {
    if (assignedRef.current) return [];
    assignedRef.current = true;
    if (questionIds.length) setHidden(Object.fromEntries(questionIds.map((id) => [id, {}])));
    return questionIds;
  }, []);

  /** Whether a draft's guess is still hidden: then nothing of it may reach the person, the interviewer included. */
  const isConcealed = useCallback((questionId: string) => {
    const state = latest.current.hidden[questionId];
    return !!state && state.revealedAt === undefined;
  }, []);

  /** What the person has reviewed for a draft: for a hidden one, only the values they set. */
  const reviewedValues = useCallback(
    (questionId: string): InterviewDraftResponse | undefined =>
      latest.current.hidden[questionId]
        ? ownDraftIn(latest.current, questionId)
        : latest.current.editedDrafts[questionId],
    [],
  );

  /** What a hidden card shows, or null for an ordinary draft. */
  const view = (draft: InterviewDraftResponse) => {
    const state = hidden[draft.questionId];
    if (!state) return null;
    return {
      concealed: state.revealedAt === undefined,
      draft: withoutAiDraft(
        { questionId: draft.questionId, answer: undefined },
        responseCommentValue(savedResponses, draft.questionId),
      ),
      edited: ownDraftIn(latest.current, draft.questionId),
      note:
        state.revealedAt === undefined
          ? HIDDEN_DRAFT_NOTE
          : describeInterviewGuess(draft, questionFor(draft.questionId)),
    };
  };

  /** An answer reveals a one-click hidden draft; any edit elsewhere reveals the other answered ones. */
  const noteEdit = (questionId: string, patch: Partial<InterviewDraftResponse>) => {
    const answersNow =
      'answer' in patch && hasDraftValue(patch.answer) && revealsOnAnswer(questionFor(questionId))
        ? { [questionId]: patch.answer }
        : {};
    setHidden((current) =>
      revealAnswers(current, {
        ...pendingAnswers(current, latest.current, questionId),
        ...(current[questionId] && current[questionId].revealedAt === undefined ? answersNow : {}),
      }),
    );
  };

  /** The selection that can be submitted: a hidden draft counts once it has an answer. */
  const submittable = useCallback(
    (selected: Record<string, boolean>) =>
      Object.fromEntries(
        Object.entries(selected).map(([id, value]) => [
          id,
          value && (!latest.current.hidden[id] || hasDraftValue(ownDraftIn(latest.current, id).answer)),
        ]),
      ),
    [],
  );

  /** Reveals every answered draft and returns what to submit, with each hidden draft's blind answer. */
  const prepareSubmit = useCallback(
    (selected: Record<string, boolean>) => {
      const revealedAt = Date.now();
      const edited = { ...latest.current.editedDrafts };
      for (const [id, state] of Object.entries(latest.current.hidden)) {
        const own = ownDraftIn(latest.current, id);
        edited[id] = hasDraftValue(own.answer)
          ? {
              ...own,
              predictionCondition: 'blind',
              blindAnswer: state.revealedAt === undefined ? own.answer : state.blindAnswer,
              revealedAt: state.revealedAt ?? revealedAt,
            }
          : { ...own, predictionCondition: 'blind' };
      }
      setHidden((current) => revealAnswers(current, pendingAnswers(current, latest.current), revealedAt));
      return { editedDrafts: edited, selected: submittable(selected) };
    },
    [submittable],
  );

  return { assign, isConcealed, reviewedValues, view, noteEdit, submittable, prepareSubmit };
}
