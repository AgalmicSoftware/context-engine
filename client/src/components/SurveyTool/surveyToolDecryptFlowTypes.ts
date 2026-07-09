import type {
  SurveyQuestionDecryptExecutionPlan,
  SurveyQuestionDecryptOptions,
  SurveyQuestionFieldDecryptSelection,
} from './surveyQuestionDecryptRequestPlan';
import type {
  FinalizeSurveyDecryptPorts,
  QuestionRatingEnvelopeDecryptResult,
  RatingEnvelopeDecryptContext,
} from './surveyToolDecryptExecutionContract';
import type {
  DecryptResponseSlice,
  QuestionRatingEnvelopeMap,
  SurveyDecryptSourceState,
} from './surveyToolDecryptSourceContract';
import type { ResponseSlice, UnknownRecord } from './surveyToolTypes';

export type SetStatePort = (patch: unknown, callback?: unknown) => unknown;

type QuestionDecryptStatusHost = {
  prepareQuestionDecryptAttempt?: (options: StartQuestionDecryptAttemptRequest) => PreparedQuestionDecryptAttempt;
  registerQuestionDecryptBusyTokens?: (keys: unknown) => unknown;
  setState?: SetStatePort;
  buildQuestionDecryptStartState?: (prevState: unknown, keysToMark: unknown) => unknown;
  clearQuestionDecryptBusyTokens?: (keys: unknown, token: unknown) => unknown;
  isDecryptContextCurrent?: (snapshot: unknown) => boolean;
  canUpdateStateForAsyncSnapshot?: (snapshot: unknown) => boolean;
  ownsQuestionDecryptBusyTokens?: (keys: unknown, token: unknown) => boolean;
  buildQuestionDecryptStaleState?: (
    prevState: unknown,
    questionId: unknown,
    fieldToDecrypt: unknown,
    token: unknown,
  ) => unknown;
  buildViewedResponseDecryptSuccessState?: (prevState: unknown, options: unknown) => unknown;
  buildSelfQuestionDecryptSuccessState?: (prevState: unknown, options: unknown) => unknown;
  buildQuestionDecryptFailureStateForAttempt?: (
    prevState: unknown,
    questionId: unknown,
    fieldToDecrypt: unknown,
    errorMessage: unknown,
    token: unknown,
  ) => unknown;
  canUpdateSurveyDecryptAttempt?: (snapshot: unknown, attemptId: unknown) => boolean;
  finishSurveyDecryptAttempt?: (attemptId: unknown) => unknown;
  buildSurveyDecryptStaleState?: () => unknown;
};

export type StartQuestionDecryptAttemptRequest = {
  questionId?: unknown;
  fieldToDecrypt?: unknown;
  baselineForDecrypt?: unknown;
};

type PreparedQuestionDecryptAttempt = UnknownRecord & {
  shouldDecrypt?: boolean;
  decryptSelection?: SurveyQuestionFieldDecryptSelection | null;
  chainId?: unknown;
  lit?: unknown;
  opts?: unknown;
};

export type StartQuestionDecryptAttemptStatusOptions = StartQuestionDecryptAttemptRequest & {
  host?: QuestionDecryptStatusHost | null;
  prepareQuestionDecryptAttempt?:
    ((options: StartQuestionDecryptAttemptRequest) => PreparedQuestionDecryptAttempt) | null;
  registerQuestionDecryptBusyTokens?: ((keys: unknown) => unknown) | null;
  setState?: SetStatePort | null;
  buildQuestionDecryptStartState?: ((prevState: unknown, keysToMark: unknown) => unknown) | null;
};

export type ApplyQuestionDecryptCompletionStatusOptions = {
  host?: QuestionDecryptStatusHost | null;
  context?: unknown;
  questionId?: unknown;
  fieldToDecrypt?: unknown;
  decryptAttemptToken?: unknown;
  keysToMark?: unknown;
  setState?: SetStatePort | null;
  clearQuestionDecryptBusyTokens?: ((keys: unknown, token: unknown) => unknown) | null;
  isDecryptContextCurrent?: ((snapshot: unknown) => boolean) | null;
  canUpdateStateForAsyncSnapshot?: ((snapshot: unknown) => boolean) | null;
  ownsQuestionDecryptBusyTokens?: ((keys: unknown, token: unknown) => boolean) | null;
  buildQuestionDecryptStaleState?:
    ((prevState: unknown, questionId: unknown, fieldToDecrypt: unknown, token: unknown) => unknown) | null;
  buildSuccessState?: ((prevState: unknown) => unknown) | null;
  successStateKind?: unknown;
  successStateOptions?: unknown;
  onSuccessStateApplied?: unknown;
};

export type ApplyQuestionDecryptFailureStatusOptions = {
  host?: QuestionDecryptStatusHost | null;
  context?: unknown;
  questionId?: unknown;
  fieldToDecrypt?: unknown;
  decryptAttemptToken?: unknown;
  error?: { message?: unknown } | null;
  setState?: SetStatePort | null;
  isDecryptContextCurrent?: ((snapshot: unknown) => boolean) | null;
  canUpdateStateForAsyncSnapshot?: ((snapshot: unknown) => boolean) | null;
  buildQuestionDecryptStaleState?:
    ((prevState: unknown, questionId: unknown, fieldToDecrypt: unknown, token: unknown) => unknown) | null;
  buildQuestionDecryptFailureStateForAttempt?:
    | ((
        prevState: unknown,
        questionId: unknown,
        fieldToDecrypt: unknown,
        errorMessage: unknown,
        token: unknown,
      ) => unknown)
    | null;
};

export type ApplySurveyDecryptStaleStatusOptions = {
  host?: QuestionDecryptStatusHost | null;
  context?: unknown;
  attemptId?: unknown;
  isDecryptContextCurrent?: ((snapshot: unknown) => boolean) | null;
  canUpdateSurveyDecryptAttempt?: ((snapshot: unknown, attemptId: unknown) => boolean) | null;
  finishSurveyDecryptAttempt?: ((attemptId: unknown) => unknown) | null;
  setSurveyDecryptStaleState?: SetStatePort | null;
  buildSurveyDecryptStaleState?: (() => unknown) | null;
};

export type HydrateLatestQuestionDecryptStateOptions = {
  questionId?: unknown;
  fieldToDecrypt?: unknown;
  baselineForDecrypt?: unknown;
  initialRatingEnvelopes?: unknown;
  account?: string;
  responderForLatest?: string;
  sessionSlug?: string;
  networkID?: string;
};

export type HydrateLatestQuestionDecryptStatePorts = {
  getQuestionFieldDecryptSelection?: (
    questionId: unknown,
    fieldToDecrypt: unknown,
    responseSlice: unknown,
  ) => SurveyQuestionFieldDecryptSelection;
  readQuestionsCache?: (sessionSlug: string) => unknown;
  getLatestQuestionResponse?: (...args: unknown[]) => Promise<unknown> | unknown;
  mergeLatestEncryptedQuestionFields?: (...args: unknown[]) => unknown;
  mergeQuestionRatingEnvelopeState?: (...args: unknown[]) => unknown;
  logWarn?: (error: unknown) => void;
};

export type PrepareViewedQuestionDecryptStateOptions = {
  questionId?: unknown;
  fieldToDecrypt?: unknown;
  responseOverride?: UnknownRecord | null;
  account?: string;
  responderForLatest?: string;
  sessionSlug?: string;
  networkID?: string;
};

export type PrepareViewedQuestionDecryptStatePorts = {
  buildViewedResponseDecryptBaseline?: (responseOverride: unknown, questionId: string) => unknown;
  hydrateLatestQuestionDecryptState?: (
    options: HydrateLatestQuestionDecryptStateOptions,
  ) => Promise<{ baselineForDecrypt: unknown; ratingEnvelopes: unknown }>;
};

export type PrepareSelfQuestionDecryptStateOptions = {
  surveyIndex?: number;
  questionId?: unknown;
  fieldToDecrypt?: unknown;
  responseOverride?: unknown;
  userAnswers?: unknown;
  account?: string;
  sessionSlug?: string;
  networkID?: string;
};

export type PrepareSelfQuestionDecryptStatePorts = {
  buildSelfQuestionDecryptBaseline?: (surveyIndex: number) => {
    baselineSlice: unknown;
    baselineForDecrypt: unknown;
  };
  mergeQuestionResponseOverrideIntoDecryptSlice?: (...args: unknown[]) => unknown;
  mergeQuestionRatingEnvelopeState?: (...args: unknown[]) => unknown;
  hydrateLatestQuestionDecryptState?: (
    options: HydrateLatestQuestionDecryptStateOptions,
  ) => Promise<{ baselineForDecrypt: unknown; ratingEnvelopes: unknown }>;
  logWarn?: (error: unknown) => void;
};

export type ResolveLatestSurveyDecryptResponseOptions = {
  singleQuestionMode?: boolean;
  questionId?: unknown;
  account?: string;
  providerLike?: unknown;
  slug?: string;
  surveyId?: unknown;
  fallbackUserAnswers?: unknown;
};

export type ResolveLatestSurveyDecryptResponsePorts = {
  getLatestQuestionResponse?: (...args: unknown[]) => Promise<unknown> | unknown;
  getLatestSurveyResponse?: (...args: unknown[]) => Promise<unknown> | unknown;
};

export type PrepareSurveyDecryptAttemptOptions = ResolveLatestSurveyDecryptResponseOptions & {
  fallbackSourceSlice?: unknown;
  previousStateSlice?: unknown;
};

type SurveyDecryptExecutionContext = {
  chainId: unknown;
  lit: { getKey: unknown } | undefined;
  opts: SurveyQuestionDecryptOptions;
  poolForDecrypt: unknown[];
  providerKind: unknown;
  surveyId: string;
};

export type PrepareSurveyDecryptAttemptPorts = {
  resolveLatestSurveyDecryptResponse?: (options: ResolveLatestSurveyDecryptResponseOptions) => Promise<unknown>;
  buildSurveyDecryptSourceState?: (
    latestResponse: unknown,
    fallbackSourceSlice: unknown,
    previousStateSlice: unknown,
  ) => SurveyDecryptSourceState;
  buildSurveyDecryptExecutionContext?: (sourceSlice: unknown, questionId?: unknown) => SurveyDecryptExecutionContext;
};

export type FinalizeSurveyDecryptAttemptOptions = RatingEnvelopeDecryptContext & {
  sourceSlice?: DecryptResponseSlice;
  ratingEnvelopesByQid?: QuestionRatingEnvelopeMap;
  poolForDecrypt?: unknown[];
  opts?: unknown;
  previousStateSlice?: unknown;
};

export type BuildQuestionDecryptExecutionContextOptions = {
  baselineForDecrypt?: ResponseSlice | null;
  questionId?: unknown;
  provider?: unknown;
  account?: unknown;
  network?: { id?: unknown };
  questionPool?: unknown;
  pileQuestions?: unknown;
  litHooks?: unknown;
  hasher?: unknown;
  resolveDecryptSurveyId?: (source: unknown, questionId?: unknown) => string;
  getProviderKind?: (provider: unknown) => unknown;
};

export type BuildSurveyDecryptExecutionContextOptions = Omit<
  BuildQuestionDecryptExecutionContextOptions,
  'baselineForDecrypt'
> & {
  sourceSlice?: DecryptResponseSlice;
};

export type PrepareQuestionDecryptAttemptPorts = {
  getQuestionFieldDecryptSelection?: (
    questionId: unknown,
    fieldToDecrypt: unknown,
    responseSlice: unknown,
  ) => SurveyQuestionFieldDecryptSelection;
  buildQuestionDecryptExecutionContext?: (
    baselineForDecrypt: ResponseSlice | null,
    questionId: unknown,
  ) => SurveyQuestionDecryptExecutionPlan;
};

export type PrepareQuestionDecryptAttemptOptions = StartQuestionDecryptAttemptRequest;

export type FinalizeQuestionDecryptAttemptOptions = RatingEnvelopeDecryptContext & {
  questionId?: unknown;
  fieldToDecrypt?: unknown;
  baselineForDecrypt?: ResponseSlice | null;
  ratingEnvelopes?: unknown;
  opts?: unknown;
};

export type FinalizeQuestionDecryptAttemptPorts = {
  decryptSingleField?: (...args: unknown[]) => Promise<DecryptResponseSlice> | DecryptResponseSlice;
  decryptQuestionRatingEnvelopes?: (
    ratingEnvelopes: unknown,
    context: RatingEnvelopeDecryptContext,
  ) => Promise<QuestionRatingEnvelopeDecryptResult> | QuestionRatingEnvelopeDecryptResult;
};

export type { DecryptResponseSlice, FinalizeSurveyDecryptPorts, ResponseSlice };
