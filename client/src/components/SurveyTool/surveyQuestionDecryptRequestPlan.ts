import type { ResponseSlice, UnknownRecord } from './surveyToolTypes';

type SurveyQuestionDecryptLitHooks = {
  getKey?: unknown;
};

export type SurveyQuestionFieldDecryptSelection = UnknownRecord & {
  clearMode?: unknown;
  hasMaskedField?: unknown;
  keysToMark?: unknown;
  maskedAdditional?: unknown;
  maskedAnswer?: unknown;
};

export type SurveyQuestionDecryptOptions = {
  providerKind: unknown;
  provider: unknown;
  account: unknown;
  chainId: unknown;
  surveyId: string;
  questionPool: unknown[];
  lit?: { getKey: unknown };
  hasher: unknown;
  throwOnError: true;
};

export type SurveyQuestionDecryptTarget = {
  chainId: unknown;
  fieldToDecrypt: string;
  providerKind: unknown;
  questionId: string;
  surveyId: string;
};

export type SurveyQuestionDecryptExecutionPlan = {
  chainId: unknown;
  lit: { getKey: unknown } | undefined;
  opts: SurveyQuestionDecryptOptions;
  providerKind: unknown;
  questionPool: unknown[];
  surveyId: string;
  target: SurveyQuestionDecryptTarget;
};

export type SurveyQuestionDecryptRequest = {
  fieldToDecrypt: string;
  options: SurveyQuestionDecryptOptions;
  questionId: string;
  responseSlice: ResponseSlice | null;
  target: SurveyQuestionDecryptTarget;
};

export type SurveyQuestionDecryptRequestPlan = {
  blockedReason: '' | 'missing-question' | 'no-masked-field';
  chainId: unknown;
  decryptRequest: SurveyQuestionDecryptRequest | null;
  decryptSelection: SurveyQuestionFieldDecryptSelection;
  lit: { getKey: unknown } | undefined;
  opts: SurveyQuestionDecryptOptions | null;
  shouldDecrypt: boolean;
  status: 'blocked' | 'ready';
  target: SurveyQuestionDecryptTarget;
};

export type BuildSurveyQuestionDecryptExecutionPlanArgs = {
  account?: unknown;
  chainId?: unknown;
  fieldToDecrypt?: unknown;
  hasher?: unknown;
  litHooks?: unknown;
  provider?: unknown;
  providerKind?: unknown;
  questionId?: unknown;
  questionPool?: unknown;
  surveyId?: unknown;
};

export type BuildSurveyQuestionDecryptRequestPlanArgs = BuildSurveyQuestionDecryptExecutionPlanArgs & {
  baselineForDecrypt?: ResponseSlice | null;
  decryptSelection?: SurveyQuestionFieldDecryptSelection | null;
};

const normalizeQuestionId = (questionId: unknown): string =>
  String(questionId || '')
    .trim()
    .toLowerCase();

const normalizeFieldToDecrypt = (fieldToDecrypt: unknown): string =>
  String(fieldToDecrypt || 'both')
    .trim()
    .toLowerCase() || 'both';

const getLitOption = (litHooks: unknown): { getKey: unknown } | undefined => {
  const hooks = litHooks && typeof litHooks === 'object' ? (litHooks as SurveyQuestionDecryptLitHooks) : null;
  return hooks?.getKey ? { getKey: hooks.getKey } : undefined;
};

const normalizeQuestionPool = (questionPool: unknown): unknown[] => (Array.isArray(questionPool) ? questionPool : []);

const normalizeDecryptSelection = (
  decryptSelection: SurveyQuestionFieldDecryptSelection | null | undefined,
): SurveyQuestionFieldDecryptSelection => {
  const selection = decryptSelection && typeof decryptSelection === 'object' ? decryptSelection : {};
  return {
    ...selection,
    hasMaskedField: !!selection.hasMaskedField,
    keysToMark: Array.isArray(selection.keysToMark) ? selection.keysToMark : [],
  };
};

export const buildSurveyQuestionDecryptExecutionPlan = ({
  account = '',
  chainId = undefined,
  fieldToDecrypt = 'both',
  hasher = undefined,
  litHooks = null,
  provider = null,
  providerKind = '',
  questionId = '',
  questionPool = [],
  surveyId = '',
}: BuildSurveyQuestionDecryptExecutionPlanArgs = {}): SurveyQuestionDecryptExecutionPlan => {
  const normalizedQuestionId = normalizeQuestionId(questionId);
  const normalizedFieldToDecrypt = normalizeFieldToDecrypt(fieldToDecrypt);
  const normalizedSurveyId = String(surveyId || '');
  const normalizedQuestionPool = normalizeQuestionPool(questionPool);
  const lit = getLitOption(litHooks);
  const target = {
    chainId,
    fieldToDecrypt: normalizedFieldToDecrypt,
    providerKind,
    questionId: normalizedQuestionId,
    surveyId: normalizedSurveyId,
  };
  const opts: SurveyQuestionDecryptOptions = {
    providerKind,
    provider,
    account,
    chainId,
    surveyId: normalizedSurveyId,
    questionPool: normalizedQuestionPool,
    ...(lit ? { lit } : {}),
    hasher,
    throwOnError: true,
  };

  return {
    chainId,
    lit,
    opts,
    providerKind,
    questionPool: normalizedQuestionPool,
    surveyId: normalizedSurveyId,
    target,
  };
};

export const buildSurveyQuestionDecryptRequestPlan = ({
  baselineForDecrypt = null,
  decryptSelection = null,
  ...executionArgs
}: BuildSurveyQuestionDecryptRequestPlanArgs = {}): SurveyQuestionDecryptRequestPlan => {
  const executionPlan = buildSurveyQuestionDecryptExecutionPlan(executionArgs);
  const selection = normalizeDecryptSelection(decryptSelection);
  const blocked = (
    blockedReason: SurveyQuestionDecryptRequestPlan['blockedReason'],
  ): SurveyQuestionDecryptRequestPlan => ({
    blockedReason,
    chainId: executionPlan.chainId,
    decryptRequest: null,
    decryptSelection: selection,
    lit: executionPlan.lit,
    opts: null,
    shouldDecrypt: false,
    status: 'blocked',
    target: executionPlan.target,
  });

  if (!executionPlan.target.questionId) return blocked('missing-question');
  if (!selection.hasMaskedField) return blocked('no-masked-field');

  return {
    blockedReason: '',
    chainId: executionPlan.chainId,
    decryptRequest: {
      fieldToDecrypt: executionPlan.target.fieldToDecrypt,
      options: executionPlan.opts,
      questionId: executionPlan.target.questionId,
      responseSlice: baselineForDecrypt,
      target: executionPlan.target,
    },
    decryptSelection: selection,
    lit: executionPlan.lit,
    opts: executionPlan.opts,
    shouldDecrypt: true,
    status: 'ready',
    target: executionPlan.target,
  };
};
