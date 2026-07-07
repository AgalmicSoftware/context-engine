import { createSurveyQuestionsLockedGateRuntime } from './surveyQuestionsLockedGateRuntime';
import type { SurveyQuestionsLegacyRecord } from './surveyQuestionsTypes';

const ADDRESS = '0x00000000000000000000000000000000000000aa';

const createContext = (overrides: SurveyQuestionsLegacyRecord = {}) => ({
  SurveyQuestionsLockedQuestionsPanel: () => null,
  buildGateSbtNameRevisionState: jest.fn(() => ({ gateSbtNameRevision: 1 })),
  buildLockedGateDetailsExpandedState: jest.fn(() => ({ lockedGateDetailsExpanded: true })),
  buildLockedGateRequirementSentenceCore: jest.fn(() => 'Requires gate'),
  buildLockedQuestionGateDetailsFromPool: jest.fn(() => []),
  buildSbtDetailPath: jest.fn((address, slug) => `/sbt/${slug}/${address}`),
  clearGateSbtHydrationRetry: jest.fn(),
  collectGateSbtAddressesForHydrationFromSources: jest.fn(() => [ADDRESS]),
  ethers: {
    utils: {
      getAddress: jest.fn((value) => String(value).toUpperCase()),
      isAddress: jest.fn(() => true),
    },
  },
  getQuestionEncryptionGates: jest.fn((question) => question?.gates || []),
  getResponseGateOptions: jest.fn(() => [
    {
      gateId: 'vip',
      label: 'VIP gate',
      sbtAddresses: [ADDRESS],
      sessionSlug: 'edge',
    },
  ]),
  getResponseGatePolicy: jest.fn(() => ({ primaryResource: 'questionResponses' })),
  getShortenedAddress: jest.fn((address) => `short:${address}`),
  inst: {
    _gateSbtHydrationSig: '',
    _getEffectiveDraftSlug: jest.fn(() => 'edge'),
    _isMounted: true,
    _lockedQuestionGateDetailsMemo: {},
    _responseGatePolicyCache: { cfg: { gates: [] } },
  },
  isTargetedSbtMetadataLookupEnabled: jest.fn(() => true),
  normalizeGateLabelText: jest.fn((value) => String(value || '').trim()),
  normalizeSessionSlugValue: jest.fn((value) => String(value || '').toLowerCase()),
  propsRef: {
    current: {
      questionPool: [{ id: 'prop-q', gates: [ADDRESS] }],
    },
  },
  reloadMaskedQuestionBatch: jest.fn(),
  resolveConfiguredGateLabelController: jest.fn(() => 'configured gate'),
  resolveEffectiveResponseGateConfig: jest.fn(() => ({ slug: 'edge' })),
  resolveEffectiveSlug: jest.fn(() => 'edge'),
  resolveGateDisplayLabelController: jest.fn(() => 'display gate'),
  resolveLockAudienceSessionNameContext: jest.fn(() => ({ label: 'session' })),
  resolveLockAudienceSessionNameController: jest.fn(() => 'Session name'),
  resolveSbtDisplayLabel: jest.fn(() => 'VIP SBT'),
  resolveSessionChainId: jest.fn(() => 11155420),
  resolveSlugForIds: jest.fn(() => 'edge'),
  scheduleGateSbtHydrationRetry: jest.fn(),
  setState: jest.fn(),
  stateRef: {
    current: {
      allQuestionsForFilter: [{ id: 'q1', gates: [ADDRESS, '0x2'] }],
      bulkPromptReloading: true,
      gateSbtNameRevision: 0,
      lockedGateDetailsExpanded: false,
      pileQuestions: [],
      questionPool: [{ id: 'q1', gates: [ADDRESS] }],
    },
  },
  t: jest.fn((key) => key),
  warmSbtDisplayNamesTargeted: jest.fn(() => Promise.resolve([{ address: ADDRESS }])),
  ...overrides,
});

describe('surveyQuestionsLockedGateRuntime', () => {
  it('chooses the source pool with the strongest matching gate details', () => {
    const context = createContext();
    const runtime = createSurveyQuestionsLockedGateRuntime(context);

    expect(runtime.getLockedQuestionGateSourcePool(['Q1'])).toBe(context.stateRef.current.allQuestionsForFilter);
  });

  it('builds session-level fallback gate details with resolved SBT metadata', () => {
    const context = createContext();
    const runtime = createSurveyQuestionsLockedGateRuntime(context);

    expect(runtime.buildSessionQuestionGateDetails(2)).toEqual([
      expect.objectContaining({
        id: `session:vip:${ADDRESS}`,
        label: 'VIP gate',
        questionCount: 2,
        sessionSlug: 'edge',
        sbts: [
          {
            address: ADDRESS,
            href: `/sbt/edge/${ADDRESS}`,
            label: 'VIP SBT',
          },
        ],
      }),
    ]);
  });

  it('hydrates SBT labels, clears retry on complete hits, and bumps revision', async () => {
    const context = createContext();
    const runtime = createSurveyQuestionsLockedGateRuntime(context);

    await runtime.hydrateGateSbtLabels({ force: true });

    expect(context.collectGateSbtAddressesForHydrationFromSources).toHaveBeenCalledWith(
      expect.objectContaining({
        policy: { primaryResource: 'questionResponses' },
      }),
    );
    expect(context.warmSbtDisplayNamesTargeted).toHaveBeenCalledWith(
      expect.objectContaining({
        addresses: [ADDRESS],
        chainId: 11155420,
        preferredSlug: 'edge',
        writeBack: true,
      }),
    );
    expect(context.clearGateSbtHydrationRetry).toHaveBeenCalled();
    expect(context.setState).toHaveBeenCalledWith(context.buildGateSbtNameRevisionState);
  });

  it('schedules hydration retry when targeted lookup returns no hits', async () => {
    const context = createContext({
      warmSbtDisplayNamesTargeted: jest.fn(() => Promise.resolve([])),
    });
    const runtime = createSurveyQuestionsLockedGateRuntime(context);

    await runtime.hydrateGateSbtLabels({ force: true });

    expect(context.inst._gateSbtHydrationSig).toBe('');
    expect(context.scheduleGateSbtHydrationRetry).toHaveBeenCalled();
  });

  it('renders locked question panels with decrypt and details callbacks', () => {
    const context = createContext();
    const runtime = createSurveyQuestionsLockedGateRuntime(context);

    const element = runtime.renderLockedQuestionsPanel({
      hiddenMaskedQuestionIds: ['q1'],
      lockedGateDetails: [{ id: 'gate' }],
      title: 'Locked',
    });

    expect(element.props).toEqual(
      expect.objectContaining({
        bulkPromptReloading: true,
        hiddenMaskedQuestionIds: ['q1'],
        lockedGateDetails: [{ id: 'gate' }],
        lockedGateDetailsExpanded: false,
        title: 'Locked',
      }),
    );
    element.props.onDecrypt(['q1']);
    expect(context.reloadMaskedQuestionBatch).toHaveBeenCalledWith(['q1']);
    element.props.onToggleDetails();
    expect(context.setState).toHaveBeenCalledWith(context.buildLockedGateDetailsExpandedState);
  });

  it('summarizes question gate options with unique names and SBT labels', () => {
    const context = createContext({
      getResponseGateOptions: jest.fn(() => [
        { label: 'VIP', sbtAddresses: [ADDRESS] },
        { label: 'VIP', sbtAddresses: [ADDRESS] },
      ]),
    });
    const runtime = createSurveyQuestionsLockedGateRuntime(context);

    expect(runtime.resolveQuestionGateOption('q1')).toEqual(
      expect.objectContaining({
        gateNames: ['VIP'],
        label: 'VIP',
        resourceKey: 'questionResponses',
        sbtSummary: 'VIP SBT',
      }),
    );
  });
});
