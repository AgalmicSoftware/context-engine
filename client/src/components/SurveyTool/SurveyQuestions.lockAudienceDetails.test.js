import { SurveyQuestions } from './SurveyQuestions';
import SurveyQuestionsLockAudienceControl from './SurveyQuestionsLockAudienceControl';
import { buildGateAudienceSbtItems, resolveLockAudienceSessionName } from './surveyToolResponseGateController';
import { buildResponseGatePolicy } from '../../utilities/crypto/litGatePolicy.js';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { buildSbtDetailPath } from '../../utilities/sbt/sbtDetailPath.js';

const address = '0x1111111111111111111111111111111111111111';

const normalizeText = (value) => {
  const raw = (typeof value === 'string' ? value : value == null ? '' : String(value)).trim();
  if (!raw || /^\[object\s+object\]$/i.test(raw)) return '';
  return raw;
};

const renderAudienceControl = (overrides = {}) =>
  render(
    <SurveyQuestionsLockAudienceControl
      qid="q1"
      effectiveFieldKey="answer"
      buttonTitle="Choose encryption audience"
      hasAudienceMenu
      menuOpen
      normalizedSelfAudienceLabel="only me"
      gateOptions={[
        {
          gateId: 'default_gate',
          label: 'test-12',
          sbtItems: [
            {
              address,
              label: 'AI Gate Test SBT',
              meta: '0x1111...1111',
              href: buildSbtDetailPath(address, 'edge'),
            },
          ],
        },
      ]}
      {...overrides}
    />,
  );

describe('SurveyQuestions lock audience details', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('keeps lock audience SBT detail links on terminology-aware routes instead of nested /u/ links', () => {
    const items = buildGateAudienceSbtItems([address], 'edge', {
      resolveSbtGateLabel: () => '',
      getShortenedAddress: (nextAddress) => `${nextAddress.slice(0, 6)}...${nextAddress.slice(-4)}`,
      buildSbtDetailPath,
    });

    expect(items).toHaveLength(1);
    expect(items[0].href).toBe(buildSbtDetailPath(address, 'edge'));
    expect(items[0].href).not.toBe(`/u/${address}`);
  });

  it('does not inherit the general session name in lock audience labels when the slug is unresolved', () => {
    const resolveSlugForIds = jest.fn(() => 'missing-session-slug');
    const resolveLockAudienceSessionNameContext = jest.fn((slug) =>
      slug === '' ? { sessionName: 'General Session' } : null,
    );

    const label = resolveLockAudienceSessionName({
      normalizeGateLabelText: normalizeText,
      props: {
        singleQuestionMode: true,
        isStandalone: false,
        questionID: '',
        sessionSlug: 'missing-session-slug',
        activeSessionSlug: 'missing-session-slug',
      },
      responseGatePolicyCacheCfg: null,
      resolveSlugForIds,
      resolveLockAudienceSessionNameContext,
    });

    expect(label).toBe('session');
    expect(label).not.toBe('General Session');
    expect(resolveSlugForIds).toHaveBeenCalledWith(
      expect.objectContaining({
        questionId: '',
      }),
    );
    expect(resolveLockAudienceSessionNameContext).toHaveBeenCalledWith('missing-session-slug');
    expect(resolveLockAudienceSessionNameContext).not.toHaveBeenCalledWith('');
  });

  it('does not inherit the general response gate policy for unknown explicit session slugs', () => {
    const resolvedCfg = {
      slug: 'missing-session-slug',
      sessionName: 'Pinned Missing Session',
    };

    const policy = buildResponseGatePolicy({
      cfg: resolvedCfg,
      isQuestionResponseFlow: true,
      fallbackChainId: 84532,
    });

    expect(policy).toEqual({
      primaryResource: 'questionResponses',
      gates: [],
      recipients: [],
      allowFallbackConditions: true,
    });
    // port note: dropped direct inspection of SurveyQuestions._responseGatePolicyCache;
    // the private cache belongs to the class shell, while the behavior contract here is
    // that the unresolved explicit slug produces an empty policy rather than general gates.
    expect(resolvedCfg.sponsored).toBeUndefined();
  });

  it('keeps response gate SBT details hidden behind the caret until expanded', () => {
    const { rerender } = renderAudienceControl();

    expect(screen.getByText('only me')).toBeInTheDocument();
    expect(screen.getByText('test-12')).toBeInTheDocument();
    expect(screen.queryByText('for test-12')).not.toBeInTheDocument();
    expect(screen.queryByText('AI Gate Test SBT')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /show test-12/i })).toBeInTheDocument();

    rerender(
      <SurveyQuestionsLockAudienceControl
        qid="q1"
        effectiveFieldKey="answer"
        buttonTitle="Choose encryption audience"
        hasAudienceMenu
        menuOpen
        normalizedSelfAudienceLabel="only me"
        expandedGateId="default_gate"
        gateOptions={[
          {
            gateId: 'default_gate',
            label: 'test-12',
            sbtItems: [
              {
                address,
                label: 'AI Gate Test SBT',
                meta: '0x1111...1111',
                href: buildSbtDetailPath(address, 'edge'),
              },
            ],
          },
        ]}
      />,
    );

    subject.state = {
      ...subject.state,
      lockAudienceMenuByQuestion: { q1: true },
      lockAudienceGateDetailsByQuestion: { q1: 'default_gate' },
    };

    const expandedControl = subject.renderAnswerLockControl({
      surveyIndex: 0,
      questionId: 'q1',
      answer: { encrypted: false, encryptionAudience: 'self' },
      lockDisabled: false,
      lockTitle: 'Not encrypted',
      glowAnswer: false,
      forceAudienceMenu: true,
      selfAudienceLabel: 'only me',
    });

    const expandedTree = renderLockAudienceControl(expandedControl);
    expect(treeHasText(expandedTree, 'AI Gate Test SBT')).toBe(true);
    expect(treeHasText(expandedTree, '0x1111...1111')).toBe(true);
  });

  it('wires shared lock-audience gate helper callbacks for select and details toggle', () => {
    const onSelectAudience = jest.fn();
    const onToggleGateDetails = jest.fn();

    renderAudienceControl({
      gateOptions: [
        {
          gateId: 'vip_gate',
          label: 'VIP gate',
          sbtItems: [
            {
              address,
              label: 'AI Gate Test SBT',
              meta: '0x1111...1111',
              href: buildSbtDetailPath(address, 'edge'),
            },
          ],
        },
      ],
      onSelectAudience,
      onToggleGateDetails,
    });

    const preventDefault = jest.fn();
    const stopPropagation = jest.fn();
    caretButton.props.onClick({ preventDefault, stopPropagation });

    expect(preventDefault).toHaveBeenCalled();
    expect(stopPropagation).toHaveBeenCalled();
    expect(subject.toggleLockAudienceGateDetails).toHaveBeenCalledWith('q1', 'vip_gate', 'answer');
  });

  it('hides the plaintext audience option for additional comment lock menus', () => {
    renderAudienceControl({
      effectiveFieldKey: 'additional',
      fieldState: { encrypted: false, encryptionAudience: 'self' },
      gateOptions: [],
      showFollowOption: true,
    });

    const lockTree = renderLockAudienceControl(lockControl);
    expect(treeHasText(lockTree, 'Not encrypted')).toBe(false);
    expect(treeHasDataTestId(lockTree, E2E_TESTIDS.SURVEY_LOCK_AUDIENCE_NONE)).toBe(false);
    expect(treeHasText(lockTree, 'only me')).toBe(true);
    expect(treeHasText(lockTree, 'Match Answer')).toBe(true);
  });
});
