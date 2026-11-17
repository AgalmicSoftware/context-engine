import React from 'react';

import { normalizeQuestionIdKey } from './surveyToolSignatures';

type SurveyQuestionCardProps = {
  deps: readonly unknown[];
  render: () => React.ReactNode;
};

const sameDeps = (prev: SurveyQuestionCardProps, next: SurveyQuestionCardProps): boolean =>
  prev.deps.length === next.deps.length && prev.deps.every((dep, index) => Object.is(dep, next.deps[index]));

/**
 * One card in the all-questions list. Typing changes only the answers, so a card renders again
 * when its own answer fields change, or on any other change to the page (the epoch). Rendering
 * every card on each key made typing lag on a phone with 40 questions open.
 */
export const SurveyQuestionCard = React.memo(({ render }: SurveyQuestionCardProps) => <>{render()}</>, sameDeps);

/** The card's own fields in the answer slice (answers, comments, ratings, consent…), keyed as edits key them. */
export const surveyQuestionCardDeps = (
  epoch: number,
  question: unknown,
  qIndex: number,
  slice: Record<string, unknown>,
  questionId: string,
): unknown[] => {
  const deps: unknown[] = [epoch, question, qIndex];
  Object.keys(slice)
    .sort()
    .forEach((key) => {
      const value = slice[key];
      const byQuestion = value && typeof value === 'object' && !Array.isArray(value);
      deps.push(key, byQuestion ? (value as Record<string, unknown>)[normalizeQuestionIdKey(questionId)] : value);
    });
  return deps;
};

export type SurveyQuestionCardEpoch = { props: object | null; state: object | null; epoch: number };

const ANSWER_STATE_KEY = 'surveysResponseState';

/**
 * Advances unless the only change since the last render is the answer state. Anything else (a
 * prop, any other state, or a render with nothing changed) re-renders every card.
 */
export const advanceSurveyQuestionCardEpoch = (
  tracker: SurveyQuestionCardEpoch,
  props: object,
  state: object,
): number => {
  const lastProps = tracker.props as Record<string, unknown> | null;
  const lastState = tracker.state as Record<string, unknown> | null;
  const nextProps = props as Record<string, unknown>;
  const nextState = state as Record<string, unknown>;
  const sameOtherwise = (last: Record<string, unknown>, next: Record<string, unknown>, except = ''): boolean =>
    Object.keys({ ...last, ...next }).every((key) => key === except || Object.is(last[key], next[key]));
  const onlyAnswersChanged =
    !!lastProps &&
    !!lastState &&
    lastState !== nextState &&
    !Object.is(lastState[ANSWER_STATE_KEY], nextState[ANSWER_STATE_KEY]) &&
    sameOtherwise(lastProps, nextProps) &&
    sameOtherwise(lastState, nextState, ANSWER_STATE_KEY);
  if (!onlyAnswersChanged) tracker.epoch += 1;
  tracker.props = props;
  tracker.state = state;
  return tracker.epoch;
};
