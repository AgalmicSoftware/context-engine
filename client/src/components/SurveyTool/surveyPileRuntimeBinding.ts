import type { PileResponseSlice } from './surveyPileResponseWindow';
import type { SurveyQuestionsRuntimeEngine } from './surveyQuestionsTypes.js';

export type PileViewModeEngine = SurveyQuestionsRuntimeEngine;

export type PileQuestionRecord = {
  id?: string;
  creator?: unknown;
  tags?: unknown;
  type?: unknown;
  prompt?: unknown;
  promptDecrypted?: boolean;
  arweaveTxId?: unknown;
  singleSelect?: unknown;
  singleChoice?: unknown;
  options?: unknown;
  [key: string]: unknown;
};

export type PileQuestionResponsesMap = Record<string, Record<string, unknown>>;

export type PileControllerStateLike = Record<string, unknown> & {
  pileQuestions?: unknown;
  activePileIndex?: unknown;
  surveysResponseState?: Array<Partial<PileResponseSlice> | null | undefined>;
  editBaseline?: Partial<PileResponseSlice> | null;
};

export const createPileViewInstanceFields = () => ({
  _pileQuestionsGeneration: 0,
  _currentRenderedQuestionIdsCacheKey: '',
  _questionObjectSignatureCache: new WeakMap(),
  _questionListSignatureCache: new WeakMap(),
  _currentPileQuestionsSignature: '0:0',
  _currentPileQuestionsSignatureListRef: null,
  _responseCountsCacheKey: '',
  _responseCountsCacheValue: null,
  _emptyReadyProbeStartedAtMs: 0,
  _pileScanDisplayBaselineKey: '',
  _pileScanDisplayBaselineRemaining: 0,
  _lastGatedEmptyRecoveryKey: '',
});

export const bindPileEngineMethod =
  <Engine, Args extends unknown[], Result>(engine: Engine, method: (engine: Engine, ...args: Args) => Result) =>
  (...args: Args): Result =>
    method(engine, ...args);

export const bindPileMethod =
  <Args extends unknown[], Result>(method: (...args: Args) => Result) =>
  (...args: Args): Result =>
    method(...args);
