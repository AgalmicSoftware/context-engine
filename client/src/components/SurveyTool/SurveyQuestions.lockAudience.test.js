import { fireEvent, screen } from '@testing-library/react';
import { renderSurveyQuestions } from './surveyQuestionsTestHarness';
import { buildLockAudienceButtonAction, buildLockAudienceDisplayState } from './surveyToolViewState';
import { getResponseGateOptions } from './surveyToolResponseGateController';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';

const question = {
  id: 'q1',
  type: 'freeform',
  question: 'How are you?',
};
const REGISTRY_CACHE_KEY = 'dg:sessionRegistryCache:v1';
const responseGateAddress = '0x00000000000000000000000000000000000000aa';

const renderStandaloneQuestion = () =>
  renderSurveyQuestions({
    singleQuestionMode: false,
    isStandalone: true,
    surveyIndex: 0,
    account: '0xabc',
    loginComplete: true,
    network: { id: 84532 },
    networkChainId: 84532,
    questionPool: [question],
    isQuestionCacheReady: true,
  });

const getAnswerLockIconName = () =>
  screen.getByTestId(E2E_TESTIDS.SURVEY_ANSWER_LOCK).querySelector('svg')?.getAttribute('data-icon');

const normalizeQuestionIdKey = (value) =>
  String(value || '')
    .trim()
    .toLowerCase();

const createResponseGateOptionDeps = () => ({
  normalizeQuestionIdKey,
  isQuestionLockedForResponse: () => false,
  getQuestionGateOptions: () => [],
  getResponseGatePolicy: () => ({
    gates: [
      {
        gateId: 'default_gate',
        label: 'Registry default gate',
        sbtAddresses: ['0x1111111111111111111111111111111111111111'],
      },
    ],
    recipients: [{ accessControlConditions: [{ contractAddress: '0x1' }], chain: 'baseSepolia' }],
  }),
  buildRecipientsFromGates: () => [],
  resolveLockAudienceSessionName: () => 'test-12',
  resolveConfiguredGateLabel: () => 'Registry default gate',
  resolveGateDisplayLabel: () => 'Registry default gate',
  buildGateAudienceSbtItems: () => [],
  resolveSbtGateLabel: () => '',
  getShortenedAddress: (address) => `${address.slice(0, 6)}...${address.slice(-4)}`,
  t: (key) => (key === 'gate' ? 'gate' : key),
  getEffectiveDraftSlug: () => '',
  resolveEffectiveSlug: () => '',
});

describe('SurveyQuestions lock audience controls', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.useRealTimers();
    window.localStorage.removeItem(REGISTRY_CACHE_KEY);
  });

  it('locks and opens the pile lock audience menu on first click when no default gate is configured', async () => {
    expect(
      buildLockAudienceButtonAction({
        effectiveFieldKey: 'answer',
        fieldEncrypted: false,
        hasAudienceMenu: true,
        menuOpen: false,
        hasGateOption: false,
      }),
    ).toEqual({
      kind: 'enable-answer-and-open-menu',
    });

    renderStandaloneQuestion();
    await screen.findByTestId(E2E_TESTIDS.SURVEY_ANSWER_LOCK);

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SURVEY_ANSWER_LOCK));

    expect(await screen.findByTestId(E2E_TESTIDS.SURVEY_LOCK_AUDIENCE_SELF)).toHaveTextContent('only me');
    expect(getAnswerLockIconName()).toBe('lock');
    expect(screen.queryByTestId(E2E_TESTIDS.SURVEY_LOCK_AUDIENCE_GATE)).not.toBeInTheDocument();
  });

  it('opens the pile lock audience menu without locking on first click when a gate option is available', () => {
    expect(
      buildLockAudienceButtonAction({
        effectiveFieldKey: 'answer',
        fieldEncrypted: false,
        hasAudienceMenu: true,
        menuOpen: false,
        hasGateOption: true,
      }),
    ).toEqual({
      kind: 'set-menu-open',
      nextOpen: true,
    });
  });

  it('shows only the self audience option in pile lock menu when no gate is configured', async () => {
    renderStandaloneQuestion();
    await screen.findByTestId(E2E_TESTIDS.SURVEY_ANSWER_LOCK);

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SURVEY_ANSWER_LOCK));

    expect(await screen.findByTestId(E2E_TESTIDS.SURVEY_LOCK_AUDIENCE_SELF)).toHaveTextContent('only me');
    expect(screen.queryByTestId(E2E_TESTIDS.SURVEY_LOCK_AUDIENCE_GATE)).not.toBeInTheDocument();
    expect(screen.queryByTestId(E2E_TESTIDS.SURVEY_LOCK_AUDIENCE_NONE)).not.toBeInTheDocument();
    expect(screen.queryByTestId(E2E_TESTIDS.SURVEY_LOCK_AUDIENCE_FOLLOW)).not.toBeInTheDocument();
  });

  it('derives lock-audience display state for additional fields with inherit mode', () => {
    const displayState = buildLockAudienceDisplayState({
      questionId: 'q1',
      fieldKey: 'additional',
      fieldState: { encrypted: true, encryptionAudience: 'self', audienceMode: 'inherit' },
      lockDisabled: false,
      lockTitle: 'Comments encryption audience',
      glowAnswer: false,
      forceAudienceMenu: true,
      selfAudienceLabel: 'only me',
      showPlaintextOption: true,
      visualContext: 'pile',
      forcedGate: false,
      gateOptions: [],
      hasGateOption: false,
      menuOpen: true,
      currentAudience: 'self',
      currentGateId: '',
      currentAudienceMode: 'inherit',
    });

    expect(displayState.effectiveFieldKey).toBe('additional');
    expect(displayState.menuOpen).toBe(true);
    expect(displayState.followActive).toBe(true);
    expect(displayState.allowPlaintextOption).toBe(false);
    expect(displayState.isPileVisualContext).toBe(true);
    expect(displayState.buttonTitle).toBe('Choose encryption audience');
  });

  it('uses a darker pressed state for the open pile lock menu without applying the bright active glow', () => {
    const displayState = buildLockAudienceDisplayState({
      questionId: 'q1',
      fieldKey: 'answer',
      fieldState: { encrypted: false, encryptionAudience: 'self' },
      lockDisabled: false,
      lockTitle: 'Not encrypted',
      glowAnswer: false,
      forceAudienceMenu: true,
      selfAudienceLabel: 'only me',
      visualContext: 'pile',
      forcedGate: false,
      gateOptions: [],
      hasGateOption: false,
      menuOpen: true,
      currentAudience: 'self',
      currentGateId: '',
      currentAudienceMode: 'explicit',
    });

    expect(displayState.isPileVisualContext).toBe(true);
    expect(displayState.pileMenuPressed).toBe(true);
    expect(displayState.showBrightLockState).toBe(false);
    expect(displayState.menuOpen).toBe(true);
  });

  it('labels response gate audience options with the session name', () => {
    const gateOptions = getResponseGateOptions('q1', createResponseGateOptionDeps());

    expect(gateOptions).toHaveLength(1);
    expect(gateOptions[0]).toEqual(
      expect.objectContaining({
        gateId: 'default_gate',
        label: 'test-12',
      }),
    );
  });

  it('resolves direct-question response gates from the session registry cache', async () => {
    window.localStorage.setItem(
      REGISTRY_CACHE_KEY,
      JSON.stringify({
        sessions: {
          edge: {
            slug: 'edge',
            sessionName: 'Edge Session',
            networkChainId: 11155420,
            __registry: {
              gateAuthority: 'onchain',
              gatesByResource: {
                questionResponses: {
                  lookupStatus: 'ok',
                  sbtAddresses: [responseGateAddress],
                  sbtAddress: responseGateAddress,
                  chainId: 11155420,
                  mode: 0,
                },
              },
            },
            encryption: {
              defaultGateId: 'questionResponses',
              primaryGateId: 'questionResponses',
              gates: {
                questionResponses: {
                  gateId: 'questionResponses',
                  resourceKey: 'questionResponses',
                  type: 'sbt',
                  label: 'questionResponses',
                  sbtAddresses: [responseGateAddress],
                  sbtAddress: responseGateAddress,
                  chainId: 11155420,
                  mode: 0,
                },
              },
            },
          },
        },
      }),
    );

    renderSurveyQuestions(
      {
        singleQuestionMode: false,
        isStandalone: true,
        account: '0xabc',
        loginComplete: true,
        network: { id: 11155420 },
        networkChainId: 11155420,
        questionPool: [question],
        isQuestionCacheReady: true,
      },
      {
        route: '/question/q1?session=edge',
      },
    );
    await screen.findByTestId(E2E_TESTIDS.SURVEY_ANSWER_LOCK);

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SURVEY_ANSWER_LOCK));

    expect(await screen.findByTestId(E2E_TESTIDS.SURVEY_LOCK_AUDIENCE_GATE)).toHaveTextContent(
      'Registry questionResponses gate',
    );
  });
});
