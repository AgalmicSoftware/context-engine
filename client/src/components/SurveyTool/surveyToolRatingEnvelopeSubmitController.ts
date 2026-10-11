import { redactInterviewEncryptedRatings } from './sessionInterviewResearch';
import { responseEnvelopeMatchesAudience } from '../../utilities/crypto/responseEnvelopeAudience';
import type { ResponseFieldState } from './surveyToolAudienceDerivationController';
import type { UnknownRecord } from './surveyToolTypes';

type RatingResponseObject = UnknownRecord & {
  additional?: ResponseFieldState;
  answer?: ResponseFieldState;
  conviction?: unknown;
  convictionEncrypted?: unknown;
  importance?: unknown;
  importanceEncrypted?: unknown;
  questionID?: unknown;
  questionId?: unknown;
};

type RatingSliceForSubmit = {
  answers?: Record<string, ResponseFieldState>;
  additionalComments?: Record<string, ResponseFieldState>;
  importance?: Record<string, unknown>;
  conviction?: Record<string, unknown>;
};

// A lock on a comment that has no text protects nothing new, so it does not encrypt fresh ratings.
const hasCommentText = (field: ResponseFieldState | undefined): boolean =>
  typeof field?.value === 'string' ? field.value.trim().length > 0 : field?.value != null;

type RatingEncryptionBaseOptions = {
  sessionSlug?: string;
  sessionConfig?: UnknownRecord;
  provider: unknown;
  account: string;
  chainId: number | string;
  surveyId: string;
  kind: string;
  hasher: unknown;
};

export interface RatingEnvelopeDeps {
  isQuestionLockedForResponse: (qid: string) => boolean;
  resolveFieldEncryptionAudience: (field: ResponseFieldState, qid: string, fieldKey: string) => string;
  getEffectiveRecipientsForQid: (qid: string) => string[];
  getEffectiveRecipientsForField: (opts: {
    questionId: string;
    fieldKey: string;
    field: ResponseFieldState;
  }) => string[];
  getDefaultResponseEncryptionAudienceForQid: (qid: string) => string;
  buildLitEncryptionOptionsForRecipients: (recipients: string[]) => UnknownRecord | null;
  encryptEnvelopeValue: (value: unknown, opts: RatingEncryptionBaseOptions & UnknownRecord) => Promise<string>;
  getImportanceFromResponse: (r: RatingResponseObject) => number | null;
  getConvictionFromResponse: (r: RatingResponseObject) => number | null;
  warn?: (msg: string, err?: unknown) => void;
}

export interface RatingEnvelopeContext {
  sliceForSubmit: RatingSliceForSubmit;
  userAnswersSource: unknown;
  questionResponses: RatingResponseObject[];
  changedMapForSubmit: Record<string, Record<string, boolean>>;
  encryptionBaseOpts: RatingEncryptionBaseOptions;
}

export interface RatingEnvelopeResult {
  processed: boolean;
  questionsProcessed: number;
  questionsEncrypted: number;
}

export const RATING_FIELD_SPECS = [
  { fieldKey: 'importance', envelopeKey: 'importanceEncrypted' },
  { fieldKey: 'conviction', envelopeKey: 'convictionEncrypted' },
] as const;

export function buildRatingBaseline(
  userAnswersSource: unknown,
  deps: RatingEnvelopeDeps,
): Map<
  string,
  {
    importanceEncrypted: string;
    convictionEncrypted: string;
    importance: number | null;
    conviction: number | null;
  }
> {
  const ratingBaselineByQid = new Map<
    string,
    {
      importanceEncrypted: string;
      convictionEncrypted: string;
      importance: number | null;
      conviction: number | null;
    }
  >();

  try {
    const list =
      userAnswersSource && typeof userAnswersSource === 'object'
        ? Array.isArray((userAnswersSource as RatingResponseObject).responses)
          ? (userAnswersSource as { responses: unknown[] }).responses
          : [userAnswersSource]
        : [];

    list.forEach((rawResponseObj) => {
      const responseObj =
        rawResponseObj && typeof rawResponseObj === 'object' ? (rawResponseObj as RatingResponseObject) : null;
      if (!responseObj) return;
      const qid = String(responseObj?.questionID || responseObj?.questionId || '')
        .trim()
        .toLowerCase();
      if (!qid) return;

      const importanceEncrypted =
        typeof responseObj?.importanceEncrypted === 'string' ? responseObj.importanceEncrypted : '';
      const convictionEncrypted =
        typeof responseObj?.convictionEncrypted === 'string' ? responseObj.convictionEncrypted : '';
      const importance = deps.getImportanceFromResponse(responseObj);
      const conviction = deps.getConvictionFromResponse(responseObj);

      if (!importanceEncrypted && !convictionEncrypted && importance === null && conviction === null) {
        return;
      }

      ratingBaselineByQid.set(qid, {
        importanceEncrypted,
        convictionEncrypted,
        importance,
        conviction,
      });
    });
  } catch (err) {
    if (typeof deps.warn === 'function') deps.warn('SurveyTool: fallback', err);
  }

  return ratingBaselineByQid;
}

// Research snapshots must not repeat a rating that is still sent encrypted.
function redactEnvelopedRatingResearch(respObj: RatingResponseObject, qid: string): void {
  if (!respObj.interviewProvenance) return;
  const protectedFields = RATING_FIELD_SPECS.filter(({ envelopeKey }) => !!respObj[envelopeKey]).map(
    ({ fieldKey }) => fieldKey,
  );
  respObj.interviewProvenance = redactInterviewEncryptedRatings(respObj.interviewProvenance, qid, protectedFields);
}

export function pickAudienceForRatingEncryption(
  qid: string,
  sliceForSubmit: RatingEnvelopeContext['sliceForSubmit'],
  deps: RatingEnvelopeDeps,
): {
  audience: string;
  recipients: string[];
} {
  const qLower = String(qid || '')
    .trim()
    .toLowerCase();
  if (!qLower) return { audience: 'self', recipients: [] };

  if (deps.isQuestionLockedForResponse(qLower)) {
    return {
      audience: 'gate',
      recipients: deps.getEffectiveRecipientsForQid(qLower),
    };
  }

  const answerField = sliceForSubmit?.answers?.[qLower] || {};
  const additionalField = sliceForSubmit?.additionalComments?.[qLower] || {};

  if (answerField?.encrypted) {
    const audience = deps.resolveFieldEncryptionAudience(answerField, qLower, 'answer');
    if (audience === 'gate') {
      return {
        audience: 'gate',
        recipients: deps.getEffectiveRecipientsForField({
          questionId: qLower,
          fieldKey: 'answer',
          field: answerField,
        }),
      };
    }
    if (['self', 'self_admin', 'session'].includes(audience)) return { audience, recipients: [] };
  }

  if (additionalField?.encrypted) {
    const audience = deps.resolveFieldEncryptionAudience(additionalField, qLower, 'additional');
    if (audience === 'gate') {
      return {
        audience: 'gate',
        recipients: deps.getEffectiveRecipientsForField({
          questionId: qLower,
          fieldKey: 'additional',
          field: additionalField,
        }),
      };
    }
    if (['self', 'self_admin', 'session'].includes(audience)) return { audience, recipients: [] };
  }

  const defaultAudience = deps.getDefaultResponseEncryptionAudienceForQid(qLower);
  return {
    audience: defaultAudience,
    recipients: defaultAudience === 'gate' ? deps.getEffectiveRecipientsForQid(qLower) : [],
  };
}

export function shouldEncryptRatingForQid(
  qid: string,
  respObj: RatingResponseObject,
  sliceForSubmit: RatingEnvelopeContext['sliceForSubmit'],
  deps: RatingEnvelopeDeps,
): boolean {
  const qLower = String(qid || '')
    .trim()
    .toLowerCase();
  const answerState = sliceForSubmit?.answers?.[qLower];
  const additionalState = sliceForSubmit?.additionalComments?.[qLower];
  if (deps.isQuestionLockedForResponse(qLower) || answerState?.encrypted || respObj?.answer?.encrypted) return true;
  if (!additionalState?.encrypted && !respObj?.additional?.encrypted) return false;
  // Ratings stored encrypted stay encrypted while a comment lock is on, even once its text is deleted.
  const storedEncrypted = RATING_FIELD_SPECS.some(({ envelopeKey }) => !!respObj?.[envelopeKey]);
  return storedEncrypted || hasCommentText(additionalState) || hasCommentText(respObj?.additional);
}

export async function processRatingEnvelopesForSubmit(
  ctx: RatingEnvelopeContext,
  deps: RatingEnvelopeDeps,
): Promise<RatingEnvelopeResult> {
  const { sliceForSubmit, userAnswersSource, questionResponses, changedMapForSubmit, encryptionBaseOpts } = ctx;
  const ratingBaselineByQid = buildRatingBaseline(userAnswersSource, deps);

  let questionsProcessed = 0;
  let questionsEncrypted = 0;

  for (const respObj of questionResponses || []) {
    const qidRaw = String(respObj?.questionID || respObj?.questionId || '').trim();
    const qid = qidRaw.toLowerCase();
    if (!qid) continue;

    questionsProcessed += 1;

    const changedFields = (changedMapForSubmit && (changedMapForSubmit[qidRaw] || changedMapForSubmit[qid])) || {};
    const baseline = ratingBaselineByQid.get(qid) || null;
    const changedByField: Record<string, boolean> = {};

    RATING_FIELD_SPECS.forEach(({ fieldKey, envelopeKey }) => {
      const fieldChanged = !!changedFields[fieldKey];
      changedByField[fieldKey] = fieldChanged;

      const baselineEnvelope = baseline?.[envelopeKey] || '';
      const baselinePlain = baseline?.[fieldKey];

      if (!respObj[envelopeKey] && baselineEnvelope) respObj[envelopeKey] = baselineEnvelope;

      if (
        !fieldChanged &&
        (respObj[fieldKey] === null || respObj[fieldKey] === undefined) &&
        baselinePlain !== null &&
        baselinePlain !== undefined
      ) {
        respObj[fieldKey] = baselinePlain;
      }
    });

    // Ratings follow the answer and comment locks; with every lock off, known ratings go public.
    if (!shouldEncryptRatingForQid(qid, respObj, sliceForSubmit, deps)) {
      RATING_FIELD_SPECS.forEach(({ fieldKey, envelopeKey }) => {
        if (!respObj[envelopeKey]) return;
        const known =
          changedByField[fieldKey] ||
          sliceForSubmit?.[fieldKey]?.[qidRaw] != null ||
          sliceForSubmit?.[fieldKey]?.[qid] != null;
        // A known rating becomes public; one this browser never decrypted keeps its envelope.
        if (known) respObj[envelopeKey] = '';
        else respObj[fieldKey] = null;
      });
      redactEnvelopedRatingResearch(respObj, qid);
      continue;
    }

    questionsEncrypted += 1;

    const audienceSelection = pickAudienceForRatingEncryption(qid, sliceForSubmit, deps);
    for (const { fieldKey, envelopeKey } of RATING_FIELD_SPECS) {
      if (
        respObj[envelopeKey] &&
        responseEnvelopeMatchesAudience(respObj[envelopeKey], audienceSelection.audience) === false
      ) {
        if (respObj[fieldKey] === undefined || respObj[fieldKey] === null) {
          throw new Error(`Decrypt the ratings for ${qid} before changing their encryption audience.`);
        }
        changedByField[fieldKey] = true;
      }
    }

    const fieldsNeedingEncryption = RATING_FIELD_SPECS.filter(({ fieldKey, envelopeKey }) => {
      const value = respObj?.[fieldKey];
      const existingEnvelope = typeof respObj[envelopeKey] === 'string' ? respObj[envelopeKey] : '';
      return value !== undefined && value !== null && (changedByField[fieldKey] || !existingEnvelope);
    });

    let lit = undefined;
    let encryptionAudience = 'self';
    if (fieldsNeedingEncryption.length > 0) {
      encryptionAudience = audienceSelection.audience;
      if (audienceSelection.audience === 'gate') {
        const recipients = audienceSelection.recipients;
        if (!Array.isArray(recipients) || recipients.length === 0) {
          throw new Error(`Missing Lit recipients for gated rating encryption (${qid}).`);
        }
        lit = deps.buildLitEncryptionOptionsForRecipients(recipients);
        if (!lit) {
          throw new Error('Lit hooks unavailable; cannot encrypt gated rating.');
        }
      }
    }

    for (const { fieldKey, envelopeKey } of RATING_FIELD_SPECS) {
      const value = respObj?.[fieldKey];
      const existingEnvelope = typeof respObj[envelopeKey] === 'string' ? respObj[envelopeKey] : '';
      const shouldEncryptField =
        value !== undefined && value !== null && (changedByField[fieldKey] || !existingEnvelope);

      if (shouldEncryptField) {
        // Keep wallet prompts serialized during submit.

        respObj[envelopeKey] = await deps.encryptEnvelopeValue(value, {
          ...encryptionBaseOpts,
          encryptionAudience,
          ...(lit ? { lit } : {}),
          qId: `${fieldKey}:${qid}`,
        });
      } else if (changedByField[fieldKey]) {
        respObj[envelopeKey] = '';
      }
    }

    RATING_FIELD_SPECS.forEach(({ fieldKey }) => {
      respObj[fieldKey] = null;
    });
    redactEnvelopedRatingResearch(respObj, qid);
  }

  return {
    processed: true,
    questionsProcessed,
    questionsEncrypted,
  };
}
