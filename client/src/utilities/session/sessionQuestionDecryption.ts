import { isMaskedQuestionPayload } from '../survey/questionRouting.js';

export interface QuestionDecryptLitHooks extends Record<string, unknown> {
  getKey?: (...args: unknown[]) => unknown;
}

export interface QuestionDecryptContext {
  account: string;
  providerLike: unknown;
  chainId: number | null;
  litHooks: QuestionDecryptLitHooks | null;
  litOpts: { getKey: (...args: unknown[]) => unknown } | null;
}

export const buildQuestionDecryptContextForSession = ({
  cfg = null,
  account = '',
  providerLike = '',
  litHooks = null,
  fallbackChainId = null,
}: {
  cfg?: { networkChainId?: unknown; [key: string]: unknown } | null;
  account?: string;
  providerLike?: unknown;
  litHooks?: unknown;
  fallbackChainId?: unknown;
} = {}): QuestionDecryptContext => {
  const chainId = Number(cfg?.networkChainId || fallbackChainId || 0) || null;
  const normalizedLitHooks = litHooks && typeof litHooks === 'object' ? (litHooks as QuestionDecryptLitHooks) : null;
  return {
    account,
    providerLike,
    chainId,
    litHooks: normalizedLitHooks,
    litOpts:
      normalizedLitHooks && typeof normalizedLitHooks.getKey === 'function'
        ? { getKey: normalizedLitHooks.getKey }
        : null,
  };
};

export const hasMaskedQuestionPayloadImproved = (
  prevQuestion?: Record<string, unknown> | null,
  nextQuestion?: Record<string, unknown> | null,
): boolean => {
  if (!prevQuestion || !nextQuestion) return false;
  if (isMaskedQuestionPayload(prevQuestion) && !isMaskedQuestionPayload(nextQuestion)) return true;

  if (!prevQuestion.promptDecrypted && !!nextQuestion.promptDecrypted) return true;
  if (!prevQuestion.optionsDecrypted && !!nextQuestion.optionsDecrypted) return true;
  if (!prevQuestion.tagsDecrypted && !!nextQuestion.tagsDecrypted) return true;

  const prevPromptMasked = String(prevQuestion.prompt || '') === '[encrypted]';
  const nextPromptMasked = String(nextQuestion.prompt || '') === '[encrypted]';
  if (prevPromptMasked && !nextPromptMasked) return true;

  const prevOptionCount = Array.isArray(prevQuestion.options) ? prevQuestion.options.length : 0;
  const nextOptionCount = Array.isArray(nextQuestion.options) ? nextQuestion.options.length : 0;
  if (prevOptionCount === 0 && nextOptionCount > 0) return true;

  const prevTagCount = Array.isArray(prevQuestion.tags) ? prevQuestion.tags.length : 0;
  const nextTagCount = Array.isArray(nextQuestion.tags) ? nextQuestion.tags.length : 0;
  if (prevTagCount === 0 && nextTagCount > 0) return true;

  return false;
};
