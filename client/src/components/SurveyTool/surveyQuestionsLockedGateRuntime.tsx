import type { SurveyQuestionsLegacyRecord, SurveyQuestionsLegacyValue } from './surveyQuestionsTypes.js';

export type SurveyQuestionsLockedGateRuntime = SurveyQuestionsLegacyRecord;

export const createSurveyQuestionsLockedGateRuntime = (
  context: SurveyQuestionsLegacyRecord,
): SurveyQuestionsLockedGateRuntime => {
  const {
    SurveyQuestionsLockedQuestionsPanel,
    buildGateSbtNameRevisionState,
    buildLockedGateDetailsExpandedState,
    buildLockedGateRequirementSentenceCore,
    buildLockedQuestionGateDetailsFromPool,
    buildSbtDetailPath,
    clearGateSbtHydrationRetry,
    collectGateSbtAddressesForHydrationFromSources,
    ethers,
    getQuestionEncryptionGates,
    getResponseGateOptions,
    getResponseGatePolicy,
    getShortenedAddress,
    inst,
    isTargetedSbtMetadataLookupEnabled,
    normalizeGateLabelText,
    normalizeSessionSlugValue,
    propsRef,
    reloadMaskedQuestionBatch,
    resolveConfiguredGateLabelController,
    resolveEffectiveResponseGateConfig,
    resolveEffectiveSlug,
    resolveGateDisplayLabelController,
    resolveLockAudienceSessionNameContext,
    resolveLockAudienceSessionNameController,
    resolveSbtDisplayLabel,
    resolveSessionChainId,
    resolveSlugForIds,
    scheduleGateSbtHydrationRetry,
    setState,
    stateRef,
    t,
    warmSbtDisplayNamesTargeted,
  } = context;

  const resolveSbtGateLabel = (address: SurveyQuestionsLegacyValue, preferredSlug: SurveyQuestionsLegacyValue = '') => {
    const normalizedAddress: SurveyQuestionsLegacyValue = String(address || '').trim();
    if (!normalizedAddress) return '';
    const slug: SurveyQuestionsLegacyValue = String(
      preferredSlug ||
        (inst._getEffectiveDraftSlug ? inst._getEffectiveDraftSlug() : '') ||
        resolveEffectiveSlug(propsRef.current) ||
        '',
    )
      .trim()
      .toLowerCase();
    return resolveSbtDisplayLabel({
      address: normalizedAddress,
      preferredSlug: slug,
      fallback: 'short',
    });
  };

  const collectGateSbtAddressesForHydration = () => {
    const policy: SurveyQuestionsLegacyValue = getResponseGatePolicy();
    const questionPools: SurveyQuestionsLegacyValue = [
      Array.isArray(stateRef.current.questionPool) ? stateRef.current.questionPool : [],
      Array.isArray(stateRef.current.pileQuestions) ? stateRef.current.pileQuestions : [],
      Array.isArray(propsRef.current.questionPool) ? propsRef.current.questionPool : [],
    ];

    return collectGateSbtAddressesForHydrationFromSources({
      policy,
      questionPools,
      getQuestionEncryptionGates: (question: SurveyQuestionsLegacyValue) => getQuestionEncryptionGates(question),
      isAddress: (value: SurveyQuestionsLegacyValue) => ethers.utils.isAddress(value),
      getAddress: (value: SurveyQuestionsLegacyValue) => ethers.utils.getAddress(value),
    });
  };

  const hydrateGateSbtLabels = async ({ force = false }: SurveyQuestionsLegacyValue = {}) => {
    const addresses: SurveyQuestionsLegacyValue = collectGateSbtAddressesForHydration();
    const slug: SurveyQuestionsLegacyValue = String(
      (inst._getEffectiveDraftSlug ? inst._getEffectiveDraftSlug() : '') ||
        resolveEffectiveSlug(propsRef.current) ||
        '',
    )
      .trim()
      .toLowerCase();
    const cfg: SurveyQuestionsLegacyValue = resolveEffectiveResponseGateConfig(slug);
    const chainId: SurveyQuestionsLegacyValue = resolveSessionChainId(slug, cfg);
    const signature: SurveyQuestionsLegacyValue = `${slug}|${Number(chainId || 0)}|${addresses.join(',')}`;
    if (!force && signature === inst._gateSbtHydrationSig) return;
    inst._gateSbtHydrationSig = signature;
    if (!addresses.length) {
      clearGateSbtHydrationRetry();
      return;
    }

    try {
      const hits: SurveyQuestionsLegacyValue = await warmSbtDisplayNamesTargeted({
        addresses,
        preferredSlug: slug,
        metadataLookupConfig: cfg,
        chainId,
        writeBack: true,
      });
      const targetedLookupEnabled: SurveyQuestionsLegacyValue = isTargetedSbtMetadataLookupEnabled();
      if (!inst._isMounted) return;
      const resolvedAddresses: SurveyQuestionsLegacyValue = new Set(
        (Array.isArray(hits) ? hits : [])
          .map((entry: SurveyQuestionsLegacyValue) =>
            String(entry?.address || '')
              .trim()
              .toLowerCase(),
          )
          .filter(Boolean),
      );
      const hasUnresolvedAddresses: SurveyQuestionsLegacyValue = addresses.some(
        (address: SurveyQuestionsLegacyValue) =>
          !resolvedAddresses.has(
            String(address || '')
              .trim()
              .toLowerCase(),
          ),
      );
      if (!Array.isArray(hits) || hits.length === 0) {
        if (!targetedLookupEnabled) {
          clearGateSbtHydrationRetry();
          return;
        }
        inst._gateSbtHydrationSig = '';
        scheduleGateSbtHydrationRetry();
        return;
      }
      if (hasUnresolvedAddresses) {
        if (targetedLookupEnabled) {
          inst._gateSbtHydrationSig = '';
          scheduleGateSbtHydrationRetry();
        } else {
          clearGateSbtHydrationRetry();
        }
      } else {
        clearGateSbtHydrationRetry();
      }
      setState(buildGateSbtNameRevisionState);
    } catch (_: unknown) {
      if (!isTargetedSbtMetadataLookupEnabled()) {
        clearGateSbtHydrationRetry();
        return;
      }
      inst._gateSbtHydrationSig = '';
      scheduleGateSbtHydrationRetry();
    }
  };

  const buildLockedQuestionGateDetails = (hiddenMaskedQuestionIds: SurveyQuestionsLegacyValue = []) => {
    const hiddenIds: SurveyQuestionsLegacyValue = new Set(
      (Array.isArray(hiddenMaskedQuestionIds) ? hiddenMaskedQuestionIds : [])
        .map((qid: SurveyQuestionsLegacyValue) =>
          String(qid || '')
            .trim()
            .toLowerCase(),
        )
        .filter(Boolean),
    );
    if (hiddenIds.size === 0) return [];

    const pool: SurveyQuestionsLegacyValue = getLockedQuestionGateSourcePool(hiddenMaskedQuestionIds);
    const slug: SurveyQuestionsLegacyValue = String(
      (inst._getEffectiveDraftSlug ? inst._getEffectiveDraftSlug() : '') ||
        resolveEffectiveSlug(propsRef.current) ||
        '',
    )
      .trim()
      .toLowerCase();
    const questionGateDetails: SurveyQuestionsLegacyValue = buildLockedQuestionGateDetailsFromPool({
      hiddenMaskedQuestionIds,
      pool,
      slug,
      getQuestionEncryptionGates: (question: SurveyQuestionsLegacyValue) => getQuestionEncryptionGates(question),
      normalizeGateLabelText: (value: SurveyQuestionsLegacyValue) => normalizeGateLabelText(value),
      resolveConfiguredGateLabel: (args: SurveyQuestionsLegacyValue) => resolveConfiguredGateLabel(args),
      resolveSbtGateLabel: (address: SurveyQuestionsLegacyValue, preferredSlug: SurveyQuestionsLegacyValue = '') =>
        resolveSbtGateLabel(address, preferredSlug),
      getShortenedAddress: getShortenedAddress as SurveyQuestionsLegacyValue,
      buildSbtDetailPath,
      normalizeSessionSlug: normalizeSessionSlugValue,
      getChecksumAddress: (address: SurveyQuestionsLegacyValue) =>
        ethers.utils.isAddress(address) ? ethers.utils.getAddress(address) : address,
      translate: t,
    });
    if (questionGateDetails.length > 0) return questionGateDetails;
    return buildSessionQuestionGateDetails(hiddenIds.size || 1);
  };

  const getLockedQuestionGateSourcePool = (hiddenMaskedQuestionIds: SurveyQuestionsLegacyValue = []) => {
    const hiddenIds: SurveyQuestionsLegacyValue = new Set(
      (Array.isArray(hiddenMaskedQuestionIds) ? hiddenMaskedQuestionIds : [])
        .map((qid: SurveyQuestionsLegacyValue) =>
          String(qid || '')
            .trim()
            .toLowerCase(),
        )
        .filter(Boolean),
    );
    const candidates: SurveyQuestionsLegacyValue = [
      Array.isArray(stateRef.current.allQuestionsForFilter) ? stateRef.current.allQuestionsForFilter : [],
      Array.isArray(stateRef.current.questionPool) ? stateRef.current.questionPool : [],
      Array.isArray(propsRef.current.questionPool) ? propsRef.current.questionPool : [],
    ].filter((pool: SurveyQuestionsLegacyValue) => Array.isArray(pool) && pool.length > 0);

    if (!candidates.length) return [];
    if (hiddenIds.size === 0) return candidates[0];

    const scored: SurveyQuestionsLegacyValue = candidates.map(
      (pool: SurveyQuestionsLegacyValue, index: SurveyQuestionsLegacyValue) => {
        let matchedCount: SurveyQuestionsLegacyValue = 0;
        let gateCount: SurveyQuestionsLegacyValue = 0;
        pool.forEach((question: SurveyQuestionsLegacyValue) => {
          const questionId: SurveyQuestionsLegacyValue = String(question?.id || '')
            .trim()
            .toLowerCase();
          if (!hiddenIds.has(questionId)) return;
          matchedCount += 1;
          gateCount += getQuestionEncryptionGates(question).length;
        });
        return { pool, index, matchedCount, gateCount };
      },
    );

    const matchingPools: SurveyQuestionsLegacyValue = scored.filter(
      (entry: SurveyQuestionsLegacyValue) => entry.matchedCount > 0,
    );
    if (!matchingPools.length) return candidates[0];

    matchingPools.sort(
      (a: SurveyQuestionsLegacyValue, b: SurveyQuestionsLegacyValue) =>
        b.gateCount - a.gateCount || b.matchedCount - a.matchedCount || a.index - b.index,
    );
    return matchingPools[0].pool;
  };

  const getMemoizedLockedQuestionGateDetails = (hiddenMaskedQuestionIds: SurveyQuestionsLegacyValue = []) => {
    const hiddenIds: SurveyQuestionsLegacyValue = (
      Array.isArray(hiddenMaskedQuestionIds) ? hiddenMaskedQuestionIds : []
    )
      .map((qid: SurveyQuestionsLegacyValue) =>
        String(qid || '')
          .trim()
          .toLowerCase(),
      )
      .filter(Boolean);
    const hiddenSignature: SurveyQuestionsLegacyValue = hiddenIds.join('|');
    const pool: SurveyQuestionsLegacyValue = getLockedQuestionGateSourcePool(hiddenIds);
    const memo: SurveyQuestionsLegacyValue = inst._lockedQuestionGateDetailsMemo || {};
    let poolVersion: SurveyQuestionsLegacyValue = Number(memo.poolVersion || 0);
    if (memo.poolRef !== pool) {
      poolVersion += 1;
      inst._lockedQuestionGateDetailsMemo = {
        ...memo,
        poolRef: pool,
        poolVersion,
      };
    }
    const memoKey: SurveyQuestionsLegacyValue = [
      hiddenSignature,
      `pool:${poolVersion}`,
      `gateRev:${Number(stateRef.current.gateSbtNameRevision || 0)}`,
    ].join('|');
    if (inst._lockedQuestionGateDetailsMemo?.key === memoKey) {
      return inst._lockedQuestionGateDetailsMemo.value;
    }
    const nextValue: SurveyQuestionsLegacyValue = buildLockedQuestionGateDetails(hiddenIds);
    inst._lockedQuestionGateDetailsMemo = {
      ...inst._lockedQuestionGateDetailsMemo,
      key: memoKey,
      value: nextValue,
    };
    return nextValue;
  };

  const buildSessionQuestionGateDetails = (questionCount: SurveyQuestionsLegacyValue = 0) => {
    const count: SurveyQuestionsLegacyValue = Math.max(1, Number(questionCount || 0) || 1);
    const slug: SurveyQuestionsLegacyValue = String(
      (inst._getEffectiveDraftSlug ? inst._getEffectiveDraftSlug() : '') ||
        resolveEffectiveSlug(propsRef.current) ||
        '',
    )
      .trim()
      .toLowerCase();
    const options: SurveyQuestionsLegacyValue = getResponseGateOptions(null);
    return (Array.isArray(options) ? options : [])
      .map((option: SurveyQuestionsLegacyValue, index: SurveyQuestionsLegacyValue) => {
        const sbtAddresses: SurveyQuestionsLegacyValue = Array.from(
          new Set(
            (Array.isArray(option?.sbtAddresses) ? option.sbtAddresses : [])
              .map((address: SurveyQuestionsLegacyValue) => String(address || '').trim())
              .filter(Boolean),
          ),
        );
        if (!sbtAddresses.length) return null;
        const id: SurveyQuestionsLegacyValue = `session:${option.gateId || index}:${sbtAddresses
          .map((address: SurveyQuestionsLegacyValue) => address.toLowerCase())
          .sort()
          .join('|')}`;
        const sessionSlug: SurveyQuestionsLegacyValue = slug || normalizeSessionSlugValue(option?.sessionSlug || '');
        return {
          id,
          label: option.label || t('gate'),
          sbtAddresses,
          questionIds: new Set(),
          questionCount: count,
          sessionSlug,
          sbts: sbtAddresses.map((address: SurveyQuestionsLegacyValue) => ({
            address,
            label: resolveSbtGateLabel(address, sessionSlug) || getShortenedAddress(address, false),
            href: buildSbtDetailPath(address, sessionSlug),
          })),
        };
      })
      .filter(Boolean);
  };

  const getLockedGateRequirementSentence = (lockedGateDetails: SurveyQuestionsLegacyValue = []) =>
    buildLockedGateRequirementSentenceCore(lockedGateDetails, { translate: t });

  const renderLockedQuestionsPanel = ({
    hiddenMaskedQuestionIds = [],
    lockedGateDetails = [],
    title = '',
    subtitle = '',
    forceExpanded = false,
    surface = 'light',
    showCaret = true,
  }: SurveyQuestionsLegacyValue = {}) => (
    <SurveyQuestionsLockedQuestionsPanel
      hiddenMaskedQuestionIds={hiddenMaskedQuestionIds}
      lockedGateDetails={lockedGateDetails}
      title={title}
      subtitle={subtitle}
      forceExpanded={forceExpanded}
      surface={surface}
      showCaret={showCaret}
      bulkPromptReloading={!!stateRef.current.bulkPromptReloading}
      lockedGateDetailsExpanded={!!stateRef.current.lockedGateDetailsExpanded}
      onDecrypt={(questionIds: SurveyQuestionsLegacyValue) => reloadMaskedQuestionBatch(questionIds)}
      onToggleDetails={() => setState(buildLockedGateDetailsExpandedState)}
    />
  );

  const resolveGateDisplayLabel = (
    gate: SurveyQuestionsLegacyValue = {},
    fallbackSbt: SurveyQuestionsLegacyValue = '',
  ) =>
    resolveGateDisplayLabelController(gate, fallbackSbt, {
      normalizeGateLabelText: (value: SurveyQuestionsLegacyValue) => normalizeGateLabelText(value),
      resolveSbtGateLabel: (address: SurveyQuestionsLegacyValue) => resolveSbtGateLabel(address),
      getShortenedAddress: getShortenedAddress as SurveyQuestionsLegacyValue,
      t,
    });

  const resolveConfiguredGateLabel = ({
    gate = {},
    resourceKey = '',
    sbtAddresses = [],
  }: SurveyQuestionsLegacyValue = {}) =>
    resolveConfiguredGateLabelController({ gate, resourceKey, sbtAddresses }, inst._responseGatePolicyCache?.cfg, {
      normalizeGateLabelText: (value: SurveyQuestionsLegacyValue) => normalizeGateLabelText(value),
      resolveGateDisplayLabel: (
        configuredGate: SurveyQuestionsLegacyValue = {},
        fallbackSbt: SurveyQuestionsLegacyValue = '',
      ) => resolveGateDisplayLabel(configuredGate, fallbackSbt),
    });

  const resolveLockAudienceSessionName = () =>
    resolveLockAudienceSessionNameController({
      normalizeGateLabelText: (value: SurveyQuestionsLegacyValue) => normalizeGateLabelText(value),
      props: propsRef.current,
      responseGatePolicyCacheCfg: inst._responseGatePolicyCache?.cfg as SurveyQuestionsLegacyValue,
      resolveSlugForIds,
      resolveLockAudienceSessionNameContext,
    });

  const resolveQuestionGateOption = (questionId: SurveyQuestionsLegacyValue = null) => {
    const gateDetails: SurveyQuestionsLegacyValue = getResponseGateOptions(questionId);
    if (!gateDetails.length) return null;

    const gateNames: SurveyQuestionsLegacyValue = Array.from(
      new Set(gateDetails.map((entry: SurveyQuestionsLegacyValue) => entry.label).filter(Boolean)),
    );
    const allSbtAddresses: SurveyQuestionsLegacyValue = Array.from(
      new Set(gateDetails.flatMap((entry: SurveyQuestionsLegacyValue) => entry.sbtAddresses || [])),
    );
    const sbtSummary: SurveyQuestionsLegacyValue =
      allSbtAddresses.length > 0
        ? allSbtAddresses
            .map((addr: SurveyQuestionsLegacyValue) => resolveSbtGateLabel(addr) || getShortenedAddress(addr, false))
            .join(', ')
        : 'none';

    return {
      label: gateNames.join(', ') || gateDetails[0]?.label || 'gate',
      gateNames,
      gateDetails,
      sbtSummary,
      resourceKey: getResponseGatePolicy()?.primaryResource || 'default',
    };
  };

  return {
    buildLockedQuestionGateDetails,
    buildSessionQuestionGateDetails,
    collectGateSbtAddressesForHydration,
    getLockedGateRequirementSentence,
    getLockedQuestionGateSourcePool,
    getMemoizedLockedQuestionGateDetails,
    hydrateGateSbtLabels,
    renderLockedQuestionsPanel,
    resolveConfiguredGateLabel,
    resolveGateDisplayLabel,
    resolveLockAudienceSessionName,
    resolveQuestionGateOption,
    resolveSbtGateLabel,
  };
};
