import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import type { InterviewDraftResponse } from './sessionInterview';
import {
  includesWholePhrase,
  responseFieldValue,
  type SessionInterviewModalRecord,
} from './sessionInterviewModalState';

// Comments compared as people read them: case and spacing don't count.
const comparable = (text: unknown) =>
  String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

// Whether one comment already says another, as whole words: "I disagree" doesn't say "Agree".
const alreadySays = (text: unknown, part: unknown) => includesWholePhrase(comparable(text), comparable(part));

/** Whether a proposed comment says something the person's own comment doesn't already. */
export const addsToInterviewComment = (own: unknown, proposed: unknown): boolean =>
  !!comparable(proposed) && !alreadySays(own, proposed);

// Their comment, then what the proposal adds. A proposal that already holds theirs stands alone.
const joinInterviewComments = (own: string, proposed: string): string => {
  if (!addsToInterviewComment(own, proposed)) return own;
  if (!comparable(own) || alreadySays(proposed, own)) return proposed;
  return `${own.trimEnd()}\n\n${proposed.trim()}`;
};

/**
 * The comment a draft's review starts from: the person's own (`earlier`, the form's comment, saved or typed)
 * followed by what the AI proposes. A locked ("*") comment can't be read or joined, so it stands until they
 * choose the proposal.
 */
export const startingInterviewComment = (proposed: unknown, earlier: unknown): string =>
  earlier === '*' ? '' : joinInterviewComments(String(earlier ?? ''), String(proposed ?? ''));

export type InterviewCommentChoice = { label: 'Both' | 'Mine' | 'AI’s'; value: string };

/** Quick choices when the person has a comment and the AI proposes something else, each a different text. */
export const interviewCommentChoices = (proposed: unknown, earlier: unknown): InterviewCommentChoice[] => {
  const locked = earlier === '*';
  const own = locked ? '' : String(earlier ?? '');
  const suggestion = String(proposed ?? '');
  if (!addsToInterviewComment(own, suggestion) || (!locked && !own.trim())) return [];
  const choices: InterviewCommentChoice[] = [
    ...(locked ? [] : [{ label: 'Both' as const, value: joinInterviewComments(own, suggestion) }]),
    // A locked comment is kept by leaving the comment as it is.
    { label: 'Mine', value: own },
    { label: 'AI’s', value: suggestion },
  ];
  return choices.filter(({ value }, index) => choices.findIndex((choice) => choice.value === value) === index);
};

/**
 * Keeps each untouched draft comment at its starting value while the person's own comments (`responses`, as
 * review reads them) load or change, so a comment that arrives after the drafts is joined too, never replaced unseen.
 */
export const useStartingInterviewComments = (
  drafts: InterviewDraftResponse[],
  responses: SessionInterviewModalRecord | null | undefined,
  setEditedDrafts: Dispatch<SetStateAction<Record<string, InterviewDraftResponse>>>,
) => {
  const starting = drafts.map(
    ({ questionId, additionalComments }) =>
      [
        questionId,
        startingInterviewComment(additionalComments, responseFieldValue(responses, 'additionalComments', questionId)),
      ] as const,
  );
  const startingRef = useRef(starting);
  startingRef.current = starting;
  const key = JSON.stringify(starting);
  useEffect(() => {
    setEditedDrafts((current) => {
      let next = current;
      for (const [questionId, comment] of startingRef.current) {
        const edited = current[questionId];
        if (!edited || edited.userEditedFields?.includes('additionalComments')) continue;
        if (String(edited.additionalComments ?? '') === comment) continue;
        if (next === current) next = { ...current };
        next[questionId] = { ...edited, additionalComments: comment };
      }
      return next;
    });
  }, [key, setEditedDrafts]);
};
