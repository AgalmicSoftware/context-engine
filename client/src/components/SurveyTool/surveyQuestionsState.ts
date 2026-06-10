import {
  buildInitialSurveyQuestionsState,
  type SurveyQuestionsProps,
  type SurveyQuestionsRuntimeEngine,
  type SurveyQuestionsState,
} from './surveyQuestionsTypes.js';

/**
 * State updates accepted by the future SurveyQuestions reducer: a shallow patch
 * object, or a class-style updater returning one. This mirrors legacy
 * `this.setState` merge semantics while builder routing continues.
 */
export type SurveyQuestionsStatePatch =
  | Partial<SurveyQuestionsState>
  | Record<string, unknown>;

export type SurveyQuestionsStateUpdate =
  | SurveyQuestionsStatePatch
  | ((prevState: Readonly<SurveyQuestionsState>) => SurveyQuestionsStatePatch);

export const surveyQuestionsReducer = (
  prevState: SurveyQuestionsState,
  update: SurveyQuestionsStateUpdate
): SurveyQuestionsState => ({
  ...prevState,
  ...(typeof update === 'function' ? update(prevState) : update),
});

export const createInitialSurveyQuestionsState = (
  props: SurveyQuestionsProps = {}
): SurveyQuestionsState => buildInitialSurveyQuestionsState(props);

export const applySurveyQuestionsRuntimeInitialState = (
  initialState: SurveyQuestionsState,
  engine: SurveyQuestionsRuntimeEngine | null | undefined
): SurveyQuestionsState => {
  const strategy = engine?.props?.runtimeStrategy;
  if (!strategy || typeof strategy.buildInitialState !== 'function') {
    return initialState;
  }

  engine.state = initialState;
  const runtimeInitialState = strategy.buildInitialState(engine);
  if (runtimeInitialState && typeof runtimeInitialState === 'object') {
    return {
      ...initialState,
      ...runtimeInitialState,
    };
  }
  return initialState;
};
