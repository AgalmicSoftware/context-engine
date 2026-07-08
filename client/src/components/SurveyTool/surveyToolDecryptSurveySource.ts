import { buildEmptyQuestionDecryptSlice } from './surveyToolDecryptState';
import { ensureQuestionDecryptSliceShape } from './surveyToolDecryptSliceState';

type UnknownRecord = Record<string, unknown>;

const isObjectLike = (value: unknown): value is UnknownRecord => !!value && typeof value === 'object';

const asRecord = (value: unknown): UnknownRecord => (isObjectLike(value) ? value : {});

const normalizeQuestionKey = (questionId: unknown): string =>
  String(questionId || '')
    .trim()
    .toLowerCase();

const toNum = (value: unknown): number | null => {
  if (value === undefined || value === null) return null;
  const next = Number(value);
  return Number.isNaN(next) ? null : next;
};

type DecryptEnvelopeValuePort = (encryptedValue: unknown, options: UnknownRecord) => Promise<unknown> | unknown;

export const decryptQuestionRatingEnvelopes = async (
  ratingEnvelopes: unknown = null,
  { chainId, lit, account, providerLike }: UnknownRecord = {},
  {
    decryptEnvelopeValue,
    logWarn = () => {},
  }: { decryptEnvelopeValue?: unknown; logWarn?: (error: unknown) => void } = {},
) => {
  let decryptedImportance = null;
  let decryptedConviction = null;
  const ratingEnvelopeRecord = asRecord(ratingEnvelopes);
  const decryptPort = decryptEnvelopeValue as DecryptEnvelopeValuePort;
  try {
    const litOpts = lit ? lit : undefined;
    if (ratingEnvelopeRecord.importanceEncrypted) {
      try {
        const value = await decryptPort(ratingEnvelopeRecord.importanceEncrypted, {
          account,
          chainId,
          providerLike,
          ...(litOpts ? { litOpts } : {}),
        });
        decryptedImportance = toNum(value);
      } catch (error) {
        logWarn(error);
      }
    }
    if (ratingEnvelopeRecord.convictionEncrypted) {
      try {
        const value = await decryptPort(ratingEnvelopeRecord.convictionEncrypted, {
          account,
          chainId,
          providerLike,
          ...(litOpts ? { litOpts } : {}),
        });
        decryptedConviction = toNum(value);
      } catch (error) {
        logWarn(error);
      }
    }
  } catch (error) {
    logWarn(error);
  }

  return { decryptedImportance, decryptedConviction };
};

export const decryptQuestionRatingEnvelopeMap = async (
  ratingEnvelopesByQid: unknown = {},
  { chainId, lit, account, providerLike }: UnknownRecord = {},
  {
    decryptEnvelopeValue,
    logWarn = () => {},
  }: { decryptEnvelopeValue?: unknown; logWarn?: (error: unknown) => void } = {},
) => {
  const decryptedImportanceFromEnv: Record<string, number> = {};
  const decryptedConvictionFromEnv: Record<string, number> = {};
  const envelopeMap = Object(ratingEnvelopesByQid || {}) as UnknownRecord;
  const decryptPort = decryptEnvelopeValue as DecryptEnvelopeValuePort;
  try {
    const litOpts = lit ? lit : undefined;
    const qids = Object.keys(envelopeMap);
    for (const questionId of qids) {
      const envs = asRecord(envelopeMap[questionId]);
      if (envs.importanceEncrypted) {
        try {
          const value = await decryptPort(envs.importanceEncrypted, {
            account,
            chainId,
            providerLike,
            ...(litOpts ? { litOpts } : {}),
          });
          const next = toNum(value);
          if (next !== null) decryptedImportanceFromEnv[questionId] = next;
        } catch (error) {
          logWarn(error);
        }
      }
      if (envs.convictionEncrypted) {
        try {
          const value = await decryptPort(envs.convictionEncrypted, {
            account,
            chainId,
            providerLike,
            ...(litOpts ? { litOpts } : {}),
          });
          const next = toNum(value);
          if (next !== null) decryptedConvictionFromEnv[questionId] = next;
        } catch (error) {
          logWarn(error);
        }
      }
    }
  } catch (error) {
    logWarn(error);
  }

  return {
    decryptedImportanceFromEnv,
    decryptedConvictionFromEnv,
  };
};

export const collectQuestionRatingEnvelopesByQid = (source: unknown = null) => {
  const ratingEnvelopesByQid: Record<string, { importanceEncrypted: string; convictionEncrypted: string }> = {};
  try {
    const addFromResponseObject = (responseObject: unknown) => {
      if (!isObjectLike(responseObject)) return;
      const questionId = normalizeQuestionKey(
        responseObject.questionID || responseObject.questionId || responseObject.questionIDHash,
      );
      if (!questionId) return;
      const importanceEncrypted =
        typeof responseObject.importanceEncrypted === 'string' ? responseObject.importanceEncrypted : '';
      const convictionEncrypted =
        typeof responseObject.convictionEncrypted === 'string' ? responseObject.convictionEncrypted : '';
      if (!importanceEncrypted && !convictionEncrypted) return;
      ratingEnvelopesByQid[questionId] = {
        importanceEncrypted,
        convictionEncrypted,
      };
    };

    if (isObjectLike(source)) {
      if (Array.isArray(source.responses)) {
        source.responses.forEach(addFromResponseObject);
      } else {
        addFromResponseObject(source);
      }
    }
  } catch (_) {
    return {};
  }

  return ratingEnvelopesByQid;
};

export const carryForwardSurveyQuestionRatings = (sourceSlice: unknown = null, previousStateSlice: unknown = null) => {
  const nextSourceSlice = ensureQuestionDecryptSliceShape(sourceSlice);
  const previous = asRecord(previousStateSlice);
  const previousImportance = asRecord(previous.importance);
  const previousConviction = asRecord(previous.conviction);
  Object.keys(previousImportance).forEach((questionId) => {
    if (nextSourceSlice.importance[questionId] === undefined || nextSourceSlice.importance[questionId] === null) {
      nextSourceSlice.importance[questionId] = previousImportance[questionId];
    }
  });
  Object.keys(previousConviction).forEach((questionId) => {
    if (nextSourceSlice.conviction[questionId] === undefined || nextSourceSlice.conviction[questionId] === null) {
      nextSourceSlice.conviction[questionId] = previousConviction[questionId];
    }
  });
  return nextSourceSlice;
};

export const buildSurveyDecryptSourceState = (
  latestResponse: unknown = null,
  fallbackSourceSlice: unknown = null,
  previousStateSlice: unknown = null,
  buildSliceFromUserAnswers: (value: unknown) => unknown = (value) => value,
) => {
  const baseSourceSlice = latestResponse
    ? buildSliceFromUserAnswers(latestResponse)
    : ensureQuestionDecryptSliceShape(fallbackSourceSlice || buildEmptyQuestionDecryptSlice());

  return {
    sourceSlice: carryForwardSurveyQuestionRatings(baseSourceSlice, previousStateSlice),
    ratingEnvelopesByQid: collectQuestionRatingEnvelopesByQid(latestResponse),
  };
};

export const buildSurveyDecryptAttemptSourceInputs = ({
  decryptContext = null,
  state = null,
  getEffectiveDraftSlug = null,
}: {
  decryptContext?: unknown;
  state?: unknown;
  getEffectiveDraftSlug?: unknown;
} = {}) => {
  const context = asRecord(decryptContext);
  const stateRecord = asRecord(state);
  const surveysResponseState = (stateRecord.surveysResponseState as unknown[]) || [];
  const surveyIndex = Number(context.surveyIndex || 0);
  const fallbackSourceSlice = surveysResponseState[surveyIndex] || buildEmptyQuestionDecryptSlice();

  return {
    surveyIndex,
    slug: context.sessionSlug || (typeof getEffectiveDraftSlug === 'function' ? getEffectiveDraftSlug() : ''),
    fallbackUserAnswers: stateRecord.userAnswers,
    fallbackSourceSlice,
    previousStateSlice: surveysResponseState[surveyIndex] || {},
  };
};
