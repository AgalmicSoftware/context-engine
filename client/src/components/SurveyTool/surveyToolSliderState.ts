import { getConvictionFromSliceStrict, getImportanceFromSlice } from './surveyToolResponseState.js';

type UnknownRecord = Record<string, unknown>;

type SliderModeByQuestion = Record<string, unknown> | null | undefined;
type SliderToggleExpandedByQuestion = Record<string, unknown> | null | undefined;

type SurveyResponseSlice = {
  conviction?: Record<string, unknown> | null;
  importance?: Record<string, unknown> | null;
};

type SurveyResponseSlices = Record<number, SurveyResponseSlice | undefined> | null | undefined;

type SliderModeResolutionArgs = {
  explicitMode?: unknown;
  isStandalone?: boolean;
  singleQuestionMode?: boolean;
  surveyIndex?: unknown;
  surveysResponseState?: SurveyResponseSlices;
  questionId?: unknown;
};

type SliderToggleExpansionArgs = {
  sliderToggleExpandedByQuestion?: SliderToggleExpandedByQuestion;
  questionId?: unknown;
  sliderMode?: unknown;
};

type SliderStateContainer = {
  sliderModeByQuestion?: SliderModeByQuestion;
  sliderToggleExpandedByQuestion?: SliderToggleExpandedByQuestion;
};

type SliderEventLike =
  | {
      type?: unknown;
    }
  | null
  | undefined;

export type SliderMode = 'importance' | 'conviction';

const isRecord = (value: unknown): value is UnknownRecord =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const asRecord = (value: unknown): UnknownRecord => (isRecord(value) ? value : {});

export const normalizeSliderMode = (mode: unknown): SliderMode => (mode === 'importance' ? 'importance' : 'conviction');

export const buildSliderModeStatePatch = (
  prevState: SliderStateContainer = {},
  questionId: unknown = '',
  mode: unknown = 'conviction',
): {
  sliderModeByQuestion: Record<string, unknown>;
  sliderToggleExpandedByQuestion: Record<string, unknown>;
} => {
  const key = String(questionId ?? '');
  const nextMode = normalizeSliderMode(mode);
  return {
    sliderModeByQuestion: {
      ...asRecord(prevState.sliderModeByQuestion),
      [key]: nextMode,
    },
    sliderToggleExpandedByQuestion: {
      ...asRecord(prevState.sliderToggleExpandedByQuestion),
      [key]: true,
    },
  };
};

export const getQuestionSliderMode = ({
  explicitMode,
  isStandalone = false,
  singleQuestionMode = false,
  surveyIndex = 0,
  surveysResponseState,
  questionId = '',
}: SliderModeResolutionArgs = {}): SliderMode => {
  const normalizedExplicitMode = normalizeSliderMode(explicitMode);
  if (explicitMode === 'importance' || explicitMode === 'conviction') {
    return normalizedExplicitMode;
  }

  const index = isStandalone || singleQuestionMode ? 0 : Number(surveyIndex || 0);
  const slices = asRecord(surveysResponseState);
  const slice = slices[index] as SurveyResponseSlice | undefined;
  const importanceMap = asRecord(slice?.importance);
  const key = String(questionId ?? '');
  if (key && Object.prototype.hasOwnProperty.call(importanceMap, key)) {
    return 'importance';
  }

  return 'conviction';
};

export const shouldExpandSliderToggle = ({
  sliderToggleExpandedByQuestion,
  questionId = '',
  sliderMode = 'conviction',
}: SliderToggleExpansionArgs = {}): boolean => {
  const expandedMap = asRecord(sliderToggleExpandedByQuestion);
  const key = String(questionId ?? '');
  return !!expandedMap[key] || normalizeSliderMode(sliderMode) !== 'conviction';
};

export const getQuestionConvictionSliderValue = (
  slice: SurveyResponseSlice | null | undefined,
  questionId: unknown = '',
): number => {
  const value = getConvictionFromSliceStrict(slice, String(questionId ?? ''));
  return typeof value === 'number' ? value : 0;
};

export const getQuestionImportanceSliderValue = (
  slice: SurveyResponseSlice | null | undefined,
  questionId: unknown = '',
): number => {
  const value = getImportanceFromSlice(slice, String(questionId ?? ''));
  return typeof value === 'number' ? value : 0;
};

export const buildSliderPersistOptions = (event?: SliderEventLike): { persistDraft: boolean } => ({
  persistDraft: event?.type === 'keydown',
});
