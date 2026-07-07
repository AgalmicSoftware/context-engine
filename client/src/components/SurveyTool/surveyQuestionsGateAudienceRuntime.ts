import type { SurveyQuestionsLegacyRecord, SurveyQuestionsLegacyValue } from './surveyQuestionsTypes.js';

export type SurveyQuestionsGateAudienceRuntime = SurveyQuestionsLegacyRecord;

export const createSurveyQuestionsGateAudienceRuntime = (
  context: SurveyQuestionsLegacyRecord,
): SurveyQuestionsGateAudienceRuntime => {
  const {
    buildEmptyResponseFieldStateCore,
    buildFallbackResponseGateOptionsPolicy,
    buildGateAudienceSbtItemsController,
    buildInheritedAdditionalFieldStateCore,
    buildRecipientsFromGatesController,
    buildResponseGatePolicy,
    buildSbtDetailPath,
    getEffectiveRecipientsForFieldController,
    getQuestionEncryptionGatesCore,
    getQuestionGateOptionsController,
    getResponseGatePolicy,
    getResponseGateOptionByIdController,
    getResponseGateOptionsController,
    getShortenedAddress,
    hasMeaningfulFieldValue,
    inst,
    isResponseGateQuestionFlow,
    normalizeFieldAudienceModeCore,
    normalizeGateLabelTextCore,
    normalizeQuestionIdKey,
    normalizeResponseEncryptionAudienceCore,
    normalizeSessionSlugValue,
    propsRef,
    resolveConfiguredGateLabel,
    resolveEffectiveResponseGateConfig,
    resolveEffectiveSlug,
    resolveFieldEncryptionAudienceCore,
    resolveFieldEncryptionGateIdController,
    resolveGateDisplayLabel,
    resolveGatedPromptGateNamesController,
    resolveLockAudienceSessionName,
    resolveResponseGateSessionSlug,
    resolveSessionChainId,
    resolveSbtGateLabel,
    stateRef,
    t,
  } = context;

  const responseGatePolicyBuilder = buildFallbackResponseGateOptionsPolicy || buildResponseGatePolicy;

  const getQuestionLookupMap = () => {
    const stateQuestionPool: SurveyQuestionsLegacyValue = Array.isArray(stateRef.current.questionPool)
      ? stateRef.current.questionPool
      : null;
    const statePileQuestions: SurveyQuestionsLegacyValue = Array.isArray(stateRef.current.pileQuestions)
      ? stateRef.current.pileQuestions
      : null;
    const propsQuestionPool: SurveyQuestionsLegacyValue = Array.isArray(propsRef.current.questionPool)
      ? propsRef.current.questionPool
      : null;
    const cache: SurveyQuestionsLegacyValue = inst._questionByIdLookupCache;

    if (
      cache &&
      cache.stateQuestionPool === stateQuestionPool &&
      cache.statePileQuestions === statePileQuestions &&
      cache.propsQuestionPool === propsQuestionPool &&
      cache.value
    ) {
      return cache.value;
    }

    const next: SurveyQuestionsLegacyValue = new Map();
    const addPool: SurveyQuestionsLegacyValue = (pool: SurveyQuestionsLegacyValue) => {
      if (!Array.isArray(pool)) return;
      pool.forEach((question: SurveyQuestionsLegacyValue) => {
        const qid: SurveyQuestionsLegacyValue = normalizeQuestionIdKey(question?.id);
        if (!qid || next.has(qid)) return;
        next.set(qid, question);
      });
    };
    addPool(stateQuestionPool);
    addPool(statePileQuestions);
    addPool(propsQuestionPool);

    inst._questionByIdLookupCache = {
      stateQuestionPool,
      statePileQuestions,
      propsQuestionPool,
      value: next,
    };
    return next;
  };

  const getQuestionById = (questionId: SurveyQuestionsLegacyValue) => {
    const qid: SurveyQuestionsLegacyValue = normalizeQuestionIdKey(questionId);
    if (!qid) return null;
    return getQuestionLookupMap().get(qid) || null;
  };

  const buildGateAudienceSbtItems = (
    sbtAddresses: SurveyQuestionsLegacyValue = [],
    sessionSlug: SurveyQuestionsLegacyValue = '',
  ) =>
    buildGateAudienceSbtItemsController(sbtAddresses, sessionSlug, {
      resolveSbtGateLabel: (address: SurveyQuestionsLegacyValue) => resolveSbtGateLabel(address),
      getShortenedAddress: getShortenedAddress as SurveyQuestionsLegacyValue,
      buildSbtDetailPath,
    });

  const getQuestionEncryptionGates = (question: SurveyQuestionsLegacyValue) => getQuestionEncryptionGatesCore(question);

  const normalizeFieldAudienceMode = (
    value: SurveyQuestionsLegacyValue,
    fieldKey: SurveyQuestionsLegacyValue = 'answer',
    field: SurveyQuestionsLegacyValue = {},
  ) => normalizeFieldAudienceModeCore(value, fieldKey, field, hasMeaningfulFieldValue as SurveyQuestionsLegacyValue);

  const normalizeGateLabelText = (value: SurveyQuestionsLegacyValue) => normalizeGateLabelTextCore(value);

  const buildRecipientsFromGates = (gates: SurveyQuestionsLegacyValue = []) =>
    buildRecipientsFromGatesController(gates, {
      resolveSessionChainId: () => resolveSessionChainId(),
    });

  const getQuestionGateOptions = (questionId: SurveyQuestionsLegacyValue) =>
    getQuestionGateOptionsController(questionId, {
      getQuestionById: (qid: SurveyQuestionsLegacyValue) => getQuestionById(qid),
      getQuestionEncryptionGates: (question: SurveyQuestionsLegacyValue) => getQuestionEncryptionGates(question),
      buildRecipientsFromGates: (gates: SurveyQuestionsLegacyValue) => buildRecipientsFromGates(gates),
      normalizeGateLabelText: (value: SurveyQuestionsLegacyValue) => normalizeGateLabelText(value),
      resolveConfiguredGateLabel: (opts: SurveyQuestionsLegacyValue = {}) => resolveConfiguredGateLabel(opts),
      resolveGateDisplayLabel: (gate: SurveyQuestionsLegacyValue = {}, fallbackSbt: SurveyQuestionsLegacyValue = '') =>
        resolveGateDisplayLabel(gate, fallbackSbt),
      buildGateAudienceSbtItems: (
        sbtAddresses: SurveyQuestionsLegacyValue = [],
        sessionSlug: SurveyQuestionsLegacyValue = '',
      ) => buildGateAudienceSbtItems(sbtAddresses, sessionSlug),
      resolveSbtGateLabel: (address: SurveyQuestionsLegacyValue) => resolveSbtGateLabel(address),
      getShortenedAddress: getShortenedAddress as SurveyQuestionsLegacyValue,
      normalizeQuestionIdKey,
    });

  const buildFallbackResponseGateOptions = (questionId: SurveyQuestionsLegacyValue = null) => {
    const slug: SurveyQuestionsLegacyValue = normalizeSessionSlugValue(resolveResponseGateSessionSlug(questionId));
    const cfg: SurveyQuestionsLegacyValue = resolveEffectiveResponseGateConfig(slug);
    const isQuestionResponseFlow: SurveyQuestionsLegacyValue = isResponseGateQuestionFlow(questionId);
    const policy: SurveyQuestionsLegacyValue = responseGatePolicyBuilder({
      cfg,
      isQuestionResponseFlow,
      fallbackChainId: resolveSessionChainId(slug, cfg),
    });
    const gates: SurveyQuestionsLegacyValue = Array.isArray(policy?.gates) ? policy.gates : [];
    const recipients: SurveyQuestionsLegacyValue = Array.isArray(policy?.recipients) ? policy.recipients : [];

    return gates
      .map((gate: SurveyQuestionsLegacyValue, gateIndex: SurveyQuestionsLegacyValue) => {
        const sbtAddresses: SurveyQuestionsLegacyValue = Array.from(
          new Set(
            (Array.isArray(gate?.sbtAddresses) ? gate.sbtAddresses : [])
              .map((address: SurveyQuestionsLegacyValue) => String(address || '').trim())
              .filter(Boolean),
          ),
        );
        if (!sbtAddresses.length) return null;
        const gateId: SurveyQuestionsLegacyValue =
          normalizeGateLabelText(gate?.gateId || gate?.id || gate?.resourceKey || '') || `gate-${gateIndex}`;
        const label: SurveyQuestionsLegacyValue =
          resolveConfiguredGateLabel({
            gate,
            resourceKey: policy?.primaryResource || '',
            sbtAddresses,
          }) ||
          resolveGateDisplayLabel(gate, sbtAddresses[0] || '') ||
          gate?.label ||
          `${t('gate')} ${gateIndex + 1}`;
        const gateRecipients: SurveyQuestionsLegacyValue = recipients[gateIndex]
          ? [recipients[gateIndex]]
          : buildRecipientsFromGates([gate]);
        return {
          gateId,
          label,
          sbtAddresses,
          sbtItems: buildGateAudienceSbtItems(sbtAddresses, slug),
          sbtSummary: sbtAddresses
            .map(
              (address: SurveyQuestionsLegacyValue) =>
                resolveSbtGateLabel(address) || getShortenedAddress(address, false),
            )
            .join(', '),
          recipients: gateRecipients,
        };
      })
      .filter(Boolean);
  };

  const isQuestionLockedForResponse = (questionId: SurveyQuestionsLegacyValue) => {
    const q: SurveyQuestionsLegacyValue = getQuestionById(questionId);
    return getQuestionEncryptionGates(q).length > 0;
  };

  const getResponseGateOptions = (questionId: SurveyQuestionsLegacyValue = null) => {
    const options: SurveyQuestionsLegacyValue = getResponseGateOptionsController(questionId, {
      normalizeQuestionIdKey,
      isQuestionLockedForResponse: (qid: SurveyQuestionsLegacyValue) => isQuestionLockedForResponse(qid),
      getQuestionGateOptions: (qid: SurveyQuestionsLegacyValue = null) => getQuestionGateOptions(qid),
      getResponseGatePolicy: () => getResponseGatePolicy(),
      buildRecipientsFromGates: (gates: SurveyQuestionsLegacyValue) => buildRecipientsFromGates(gates),
      resolveLockAudienceSessionName: () => resolveLockAudienceSessionName(),
      resolveConfiguredGateLabel: (opts: SurveyQuestionsLegacyValue = {}) => resolveConfiguredGateLabel(opts),
      resolveGateDisplayLabel: (gate: SurveyQuestionsLegacyValue = {}, fallbackSbt: SurveyQuestionsLegacyValue = '') =>
        resolveGateDisplayLabel(gate, fallbackSbt),
      buildGateAudienceSbtItems: (
        sbtAddresses: SurveyQuestionsLegacyValue = [],
        sessionSlug: SurveyQuestionsLegacyValue = '',
      ) => buildGateAudienceSbtItems(sbtAddresses, sessionSlug),
      resolveSbtGateLabel: (address: SurveyQuestionsLegacyValue) => resolveSbtGateLabel(address),
      getShortenedAddress: getShortenedAddress as SurveyQuestionsLegacyValue,
      t,
      getEffectiveDraftSlug:
        typeof inst._getEffectiveDraftSlug === 'function' ? () => inst._getEffectiveDraftSlug() : null,
      resolveEffectiveSlug: () => resolveEffectiveSlug(propsRef.current),
    });
    return Array.isArray(options) && options.length > 0 ? options : buildFallbackResponseGateOptions(questionId);
  };

  const getResponseGateOptionById = (
    questionId: SurveyQuestionsLegacyValue = null,
    gateId: SurveyQuestionsLegacyValue = '',
  ) =>
    getResponseGateOptionByIdController(questionId, gateId, {
      normalizeGateLabelText: (value: SurveyQuestionsLegacyValue) => normalizeGateLabelText(value),
      getResponseGateOptions: (qid: SurveyQuestionsLegacyValue = null) => getResponseGateOptions(qid),
    });

  const getEffectiveRecipientsForQid = (questionId: SurveyQuestionsLegacyValue) => {
    const q: SurveyQuestionsLegacyValue = getQuestionById(questionId);
    const gates: SurveyQuestionsLegacyValue = getQuestionEncryptionGates(q);
    if (gates.length) return buildRecipientsFromGates(gates);
    const policy: SurveyQuestionsLegacyValue = getResponseGatePolicy();
    return Array.isArray(policy?.recipients) ? policy.recipients : [];
  };

  const hasDefaultResponseGateRecipients = () => {
    const recipients: SurveyQuestionsLegacyValue = getResponseGatePolicy()?.recipients;
    return Array.isArray(recipients) && recipients.length > 0;
  };

  const getDefaultResponseEncryptionAudience = () => (hasDefaultResponseGateRecipients() ? 'gate' : 'self');

  const getDefaultResponseEncryptionAudienceForQid = (questionId: SurveyQuestionsLegacyValue) =>
    isQuestionLockedForResponse(questionId) || getEffectiveRecipientsForQid(questionId).length > 0 ? 'gate' : 'self';

  const normalizeResponseEncryptionAudience = (
    value: SurveyQuestionsLegacyValue,
    questionId: SurveyQuestionsLegacyValue = null,
  ) =>
    normalizeResponseEncryptionAudienceCore(value, questionId, {
      isQuestionLocked: (qid: SurveyQuestionsLegacyValue) => isQuestionLockedForResponse(qid),
      getEffectiveRecipientsForQid: (qid: SurveyQuestionsLegacyValue) => getEffectiveRecipientsForQid(qid),
      hasDefaultGateRecipients: () => hasDefaultResponseGateRecipients(),
    });

  const resolveFieldEncryptionGateId = (
    field: SurveyQuestionsLegacyValue = {},
    questionId: SurveyQuestionsLegacyValue = null,
    fieldKey: SurveyQuestionsLegacyValue = 'answer',
  ) =>
    resolveFieldEncryptionGateIdController(field, questionId, fieldKey, {
      resolveFieldEncryptionAudience: (
        nextField: SurveyQuestionsLegacyValue,
        qid: SurveyQuestionsLegacyValue,
        fk: SurveyQuestionsLegacyValue,
      ) => resolveFieldEncryptionAudience(nextField, qid, fk),
      normalizeGateLabelText: (value: SurveyQuestionsLegacyValue) => normalizeGateLabelText(value),
      getResponseGateOptionById: (qid: SurveyQuestionsLegacyValue = null, gateId: SurveyQuestionsLegacyValue = '') =>
        getResponseGateOptionById(qid, gateId),
    });

  const normalizeFieldAudienceModeForEmptyField = (
    value: SurveyQuestionsLegacyValue,
    fieldKey: SurveyQuestionsLegacyValue,
    field: SurveyQuestionsLegacyValue,
  ) => normalizeFieldAudienceMode(value, fieldKey, field);

  const buildEmptyResponseFieldState = (
    questionId: SurveyQuestionsLegacyValue = null,
    fieldKey: SurveyQuestionsLegacyValue = 'answer',
  ) =>
    buildEmptyResponseFieldStateCore(questionId, fieldKey, {
      getDefaultAudienceForQid: (qid: SurveyQuestionsLegacyValue) => getDefaultResponseEncryptionAudienceForQid(qid),
      getDefaultAudience: () => getDefaultResponseEncryptionAudience(),
      resolveFieldEncryptionGateId: (
        field: SurveyQuestionsLegacyValue,
        qid: SurveyQuestionsLegacyValue,
        fk: SurveyQuestionsLegacyValue,
      ) => resolveFieldEncryptionGateId(field, qid, fk),
      normalizeFieldAudienceMode: (
        val: SurveyQuestionsLegacyValue,
        fk: SurveyQuestionsLegacyValue,
        f: SurveyQuestionsLegacyValue,
      ) => normalizeFieldAudienceModeForEmptyField(val, fk, f),
    });

  const resolveFieldEncryptionAudience = (
    field: SurveyQuestionsLegacyValue = {},
    questionId: SurveyQuestionsLegacyValue = null,
    fieldKey: SurveyQuestionsLegacyValue = 'answer',
  ) =>
    resolveFieldEncryptionAudienceCore(field, questionId, fieldKey, {
      normalizeAudience: (val: SurveyQuestionsLegacyValue, qid: SurveyQuestionsLegacyValue) =>
        normalizeResponseEncryptionAudience(val, qid),
      getDefaultAudienceForQid: (qid: SurveyQuestionsLegacyValue) => getDefaultResponseEncryptionAudienceForQid(qid),
      getDefaultAudience: () => getDefaultResponseEncryptionAudience(),
    });

  const buildInheritedAdditionalFieldState = (
    additionalField: SurveyQuestionsLegacyValue = {},
    answerField: SurveyQuestionsLegacyValue = {},
    questionId: SurveyQuestionsLegacyValue = null,
  ) =>
    buildInheritedAdditionalFieldStateCore(additionalField, answerField, questionId, {
      resolveFieldEncryptionAudience: (
        field: SurveyQuestionsLegacyValue,
        qid: SurveyQuestionsLegacyValue,
        fk: SurveyQuestionsLegacyValue,
      ) => resolveFieldEncryptionAudience(field, qid, fk),
      resolveFieldEncryptionGateId: (
        field: SurveyQuestionsLegacyValue,
        qid: SurveyQuestionsLegacyValue,
        fk: SurveyQuestionsLegacyValue,
      ) => resolveFieldEncryptionGateId(field, qid, fk),
    });

  const getEffectiveRecipientsForField = ({
    questionId,
    fieldKey = 'answer',
    field = null,
  }: SurveyQuestionsLegacyValue = {}) =>
    getEffectiveRecipientsForFieldController(
      { questionId, fieldKey, field },
      {
        normalizeQuestionIdKey,
        isQuestionLockedForResponse: (qid: SurveyQuestionsLegacyValue) => isQuestionLockedForResponse(qid),
        getEffectiveRecipientsForQid: (qid: SurveyQuestionsLegacyValue) => getEffectiveRecipientsForQid(qid),
        resolveFieldEncryptionAudience: (
          nextField: SurveyQuestionsLegacyValue,
          qid: SurveyQuestionsLegacyValue,
          fk: SurveyQuestionsLegacyValue,
        ) => resolveFieldEncryptionAudience(nextField, qid, fk),
        resolveFieldEncryptionGateId: (
          nextField: SurveyQuestionsLegacyValue,
          qid: SurveyQuestionsLegacyValue,
          fk: SurveyQuestionsLegacyValue,
        ) => resolveFieldEncryptionGateId(nextField, qid, fk),
        getResponseGateOptionById: (qid: SurveyQuestionsLegacyValue = null, gateId: SurveyQuestionsLegacyValue = '') =>
          getResponseGateOptionById(qid, gateId),
      },
    );

  const resolveGatedPromptGateNames = (question: SurveyQuestionsLegacyValue) =>
    resolveGatedPromptGateNamesController(question, {
      normalizeGateLabelText: (value: SurveyQuestionsLegacyValue) => normalizeGateLabelText(value),
      resolveGateDisplayLabel: (gate: SurveyQuestionsLegacyValue = {}, fallbackSbt: SurveyQuestionsLegacyValue = '') =>
        resolveGateDisplayLabel(gate, fallbackSbt),
      getQuestionEncryptionGates: (nextQuestion: SurveyQuestionsLegacyValue) =>
        getQuestionEncryptionGates(nextQuestion),
      getEffectiveDraftSlug:
        typeof inst._getEffectiveDraftSlug === 'function' ? () => inst._getEffectiveDraftSlug() : null,
      resolveEffectiveSlug: () => resolveEffectiveSlug(propsRef.current),
      resolveEffectiveResponseGateConfig: (slug: SurveyQuestionsLegacyValue) =>
        resolveEffectiveResponseGateConfig(slug),
    });

  return {
    buildEmptyResponseFieldState,
    buildFallbackResponseGateOptions,
    buildGateAudienceSbtItems,
    buildInheritedAdditionalFieldState,
    buildRecipientsFromGates,
    getDefaultResponseEncryptionAudience,
    getDefaultResponseEncryptionAudienceForQid,
    getEffectiveRecipientsForField,
    getEffectiveRecipientsForQid,
    getQuestionById,
    getQuestionEncryptionGates,
    getQuestionGateOptions,
    getQuestionLookupMap,
    getResponseGateOptionById,
    getResponseGateOptions,
    hasDefaultResponseGateRecipients,
    isQuestionLockedForResponse,
    normalizeFieldAudienceMode,
    normalizeGateLabelText,
    normalizeResponseEncryptionAudience,
    resolveFieldEncryptionAudience,
    resolveFieldEncryptionGateId,
    resolveGatedPromptGateNames,
  };
};
