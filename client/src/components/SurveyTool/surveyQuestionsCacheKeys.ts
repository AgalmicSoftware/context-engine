// Pure cache-key builders extracted from SurveyQuestions. Key strings MUST
// match the originals exactly (these are cache identities).

export interface DecryptContextKeyFields {
  account?: unknown;
  providerKind?: unknown;
  sessionSlug?: unknown;
  networkID?: unknown;
  responder?: unknown;
  singleQuestionMode?: unknown;
  isStandalone?: unknown;
  surveyIndex?: unknown;
  surveyId?: unknown;
  questionID?: unknown;
}

export function buildDecryptContextKeyFromContext(context: DecryptContextKeyFields): string {
  return [
    (context.account as string) || '',
    (context.providerKind as string) || '',
    (context.sessionSlug as string) || '',
    (context.networkID as string) || '',
    (context.responder as string) || '',
    context.singleQuestionMode ? 'single' : context.isStandalone ? 'standalone' : 'survey',
    String(context.surveyIndex ?? '').trim(),
    String(context.surveyId || '')
      .trim()
      .toLowerCase(),
    String(context.questionID || '')
      .trim()
      .toLowerCase(),
  ].join('|');
}

export interface ResponseGatePolicyCacheKeyInputs {
  singleQuestionMode?: unknown;
  isStandalone?: unknown;
  questionID?: unknown;
  surveyId?: unknown;
  hintedSessionSlug: string;
  effectiveSessionSlug: string;
  networkId: string;
}

export function buildResponseGatePolicyCacheKeyFromInputs(i: ResponseGatePolicyCacheKeyInputs): string {
  const isQuestionResponseFlow = !!(i.singleQuestionMode || i.isStandalone);
  const questionId = isQuestionResponseFlow ? String(i.questionID || '').toLowerCase() : '';
  const surveyId = isQuestionResponseFlow ? '' : String(i.surveyId || '').toLowerCase();
  return [
    isQuestionResponseFlow ? 'question' : 'survey',
    questionId,
    surveyId,
    i.hintedSessionSlug,
    i.effectiveSessionSlug,
    i.networkId,
  ].join('|');
}
