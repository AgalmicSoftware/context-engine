import type { ResponseSlice, UnknownRecord } from './surveyToolTypes';

export type DecryptResponseSlice = ResponseSlice & {
  answers: UnknownRecord;
  importance: UnknownRecord;
  conviction: UnknownRecord;
  additionalComments: UnknownRecord;
};

export type QuestionRatingEnvelope = {
  importanceEncrypted: string;
  convictionEncrypted: string;
};

export type QuestionRatingEnvelopeMap = Record<string, QuestionRatingEnvelope>;

export type SurveyDecryptSourceState = {
  sourceSlice: DecryptResponseSlice;
  ratingEnvelopesByQid: QuestionRatingEnvelopeMap;
};

export type SurveyDecryptAttemptSourceInputs = {
  surveyIndex: number;
  slug: unknown;
  fallbackUserAnswers: unknown;
  fallbackSourceSlice: unknown;
  previousStateSlice: unknown;
};
