import type { SurveyQuestionsLegacyRecord, SurveyQuestionsLegacyValue } from './surveyQuestionsTypes.js';

export type SurveyQuestionsResponseGatePolicyRuntime = SurveyQuestionsLegacyRecord;

export const createSurveyQuestionsResponseGatePolicyRuntime = (
  context: SurveyQuestionsLegacyRecord,
): SurveyQuestionsResponseGatePolicyRuntime => {
  const {
    buildResponseGatePolicy,
    buildResponseGatePolicyCacheKeyFromInputs,
    buildResponseGateConfigSignature: buildResponseGateConfigSignatureForConfig,
    getSessionSlugHintFromProps,
    inst,
    normalizeSessionSlugValue,
    parseQuestionSessionSlugFromSearch,
    propsRef,
    resolveEffectiveResponseGateConfig,
    resolveEffectiveSlug,
    resolveSessionChainId,
    resolveSlugForIds,
  } = context;

  const buildResponseGatePolicyCacheKey = () =>
    buildResponseGatePolicyCacheKeyFromInputs({
      singleQuestionMode: isResponseGateQuestionFlow(),
      isStandalone: propsRef.current.isStandalone,
      questionID: propsRef.current.questionID,
      surveyId: propsRef.current.surveyId,
      hintedSessionSlug: getExplicitResponseGateSessionSlug(),
      effectiveSessionSlug: resolveResponseGateSessionSlug(),
      networkId: String(propsRef.current.network?.id ?? propsRef.current.networkChainId ?? ''),
    });

  const getQuestionRouteSessionSlug = () => {
    try {
      if (typeof window === 'undefined') return '';
      return normalizeSessionSlugValue(parseQuestionSessionSlugFromSearch(window.location?.search || '') || '');
    } catch (_: unknown) {
      return '';
    }
  };

  const getExplicitResponseGateSessionSlug = () =>
    getQuestionRouteSessionSlug() || normalizeSessionSlugValue(getSessionSlugHintFromProps(propsRef.current));

  const isResponseGateQuestionFlow = (questionId: SurveyQuestionsLegacyValue = propsRef.current.questionID) =>
    !!(propsRef.current.singleQuestionMode || propsRef.current.isStandalone || questionId);

  const resolveResponseGateSessionSlug = (questionId: SurveyQuestionsLegacyValue = propsRef.current.questionID) => {
    const explicitSlug: SurveyQuestionsLegacyValue = getExplicitResponseGateSessionSlug();
    if (explicitSlug) return explicitSlug;
    if (isResponseGateQuestionFlow(questionId)) {
      return questionId
        ? resolveSlugForIds({
            questionId,
            props: propsRef.current,
            network: propsRef.current.network,
          })
        : resolveEffectiveSlug(propsRef.current);
    }
    return resolveSlugForIds({
      surveyId: propsRef.current.surveyId || null,
      props: propsRef.current,
      network: propsRef.current.network,
    });
  };

  const buildResponseGateConfigSignature = (cfg: SurveyQuestionsLegacyValue = {}) =>
    buildResponseGateConfigSignatureForConfig(cfg);

  const getResponseGatePolicy = () => {
    const cacheKey: SurveyQuestionsLegacyValue = buildResponseGatePolicyCacheKey();
    const isQuestionResponseFlow: SurveyQuestionsLegacyValue = isResponseGateQuestionFlow();
    const cached: SurveyQuestionsLegacyValue = inst._responseGatePolicyCache;
    const now: SurveyQuestionsLegacyValue = Date.now();

    let slug: SurveyQuestionsLegacyValue = '';
    let cfg: SurveyQuestionsLegacyValue = {};
    let cfgSignature: SurveyQuestionsLegacyValue = '';

    try {
      slug = resolveResponseGateSessionSlug();
      cfg = resolveEffectiveResponseGateConfig(slug);
      cfgSignature = buildResponseGateConfigSignature(cfg);
    } catch (_: unknown) {
      cfg = {};
      cfgSignature = '';
    }

    if (cached && cached.key === cacheKey && cached.cfgSignature === cfgSignature && cached.value) {
      if (now - Number(cached.ts || 0) < 1500) return cached.value;
      inst._responseGatePolicyCache = { ...cached, cfg, ts: now };
      return cached.value;
    }

    let policy: SurveyQuestionsLegacyValue = null;
    try {
      const fallbackChainId: SurveyQuestionsLegacyValue = resolveSessionChainId(slug, cfg);
      policy = buildResponseGatePolicy({
        cfg,
        isQuestionResponseFlow,
        fallbackChainId,
      });
    } catch (_: unknown) {
      policy = {
        recipients: [],
        allowFallbackConditions: true,
      };
    }

    inst._responseGatePolicyCache = { key: cacheKey, cfgSignature, cfg, value: policy, ts: now };
    return policy;
  };

  return {
    buildResponseGateConfigSignature,
    buildResponseGatePolicyCacheKey,
    getExplicitResponseGateSessionSlug,
    getQuestionRouteSessionSlug,
    getResponseGatePolicy,
    isResponseGateQuestionFlow,
    resolveResponseGateSessionSlug,
  };
};
