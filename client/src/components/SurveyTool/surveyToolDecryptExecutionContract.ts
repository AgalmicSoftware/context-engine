import type { DecryptResponseSlice, QuestionRatingEnvelopeMap } from './surveyToolDecryptSourceContract';
import type { UnknownRecord } from './surveyToolTypes';

export type LitDecryptOptions = UnknownRecord & {
  account?: unknown;
  chainId?: unknown;
  providerLike?: unknown;
  litOpts?: unknown;
};

export type DecryptEnvelopeValuePort = (
  encryptedValue: unknown,
  options: LitDecryptOptions,
) => Promise<unknown> | unknown;

export type DecryptSingleFieldPort = (
  baselineForDecrypt: unknown,
  questionId: string,
  fieldToDecrypt: string,
  options: unknown,
) => Promise<DecryptResponseSlice> | DecryptResponseSlice;

export type DecryptMultipleAnswersPort = (
  sourceSlice: DecryptResponseSlice,
  poolForDecrypt: unknown[],
  options: unknown,
) => Promise<unknown> | unknown;

export type RatingEnvelopeDecryptPorts = {
  decryptEnvelopeValue?: DecryptEnvelopeValuePort;
  logWarn?: (error: unknown) => void;
};

export type RatingEnvelopeDecryptContext = UnknownRecord & {
  account?: unknown;
  chainId?: unknown;
  lit?: unknown;
  providerLike?: unknown;
};

export type QuestionRatingEnvelopeDecryptResult = {
  decryptedImportance: number | null;
  decryptedConviction: number | null;
};

export type QuestionRatingEnvelopeMapDecryptResult = {
  decryptedImportanceFromEnv: Record<string, number>;
  decryptedConvictionFromEnv: Record<string, number>;
};

export type FinalizeSurveyDecryptPorts = {
  decryptMultipleAnswers: DecryptMultipleAnswersPort;
  decryptQuestionRatingEnvelopeMap: (
    ratingEnvelopesByQid: QuestionRatingEnvelopeMap,
    context: RatingEnvelopeDecryptContext,
  ) => Promise<QuestionRatingEnvelopeMapDecryptResult> | QuestionRatingEnvelopeMapDecryptResult;
  normalizeBulkDecryptedSliceForSurveyState: (
    decryptedSlice: unknown,
    options: { previousStateSlice?: unknown; baselineSlice?: DecryptResponseSlice },
  ) => unknown;
};
