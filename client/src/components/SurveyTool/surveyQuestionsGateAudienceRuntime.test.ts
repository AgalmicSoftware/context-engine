import { createSurveyQuestionsGateAudienceRuntime } from './surveyQuestionsGateAudienceRuntime';

const address = '0x1111111111111111111111111111111111111111';

const normalizeQuestionIdKey = (value: unknown) =>
  String(value || '')
    .trim()
    .toLowerCase();

const normalizeSessionSlugValue = (value: unknown) =>
  String(value || '')
    .trim()
    .toLowerCase();

const createRuntime = (overrides = {}) =>
  createSurveyQuestionsGateAudienceRuntime({
    buildGateAudienceSbtItemsController: jest.fn((addresses, sessionSlug, deps) =>
      addresses.map((nextAddress: string) => ({
        address: nextAddress,
        href: deps.buildSbtDetailPath(nextAddress, sessionSlug),
        label: deps.resolveSbtGateLabel(nextAddress),
      })),
    ),
    buildRecipientsFromGatesController: jest.fn(() => [{ chain: 'optimismSepolia' }]),
    buildResponseGatePolicy: jest.fn(() => ({
      primaryResource: 'questionResponses',
      gates: [
        {
          gateId: 'questionResponses',
          resourceKey: 'questionResponses',
          sbtAddresses: [address],
        },
      ],
      recipients: [{ accessControlConditions: [{ contractAddress: address }], chain: 'optimismSepolia' }],
    })),
    buildSbtDetailPath: jest.fn((nextAddress, sessionSlug) => `/u/${nextAddress}?session=${sessionSlug}`),
    getQuestionEncryptionGatesCore: jest.fn((question) => question?.encryptionGates || []),
    getResponseGateOptionsController: jest.fn(() => []),
    getShortenedAddress: jest.fn(() => '0x1111...1111'),
    inst: {
      _questionByIdLookupCache: null,
    },
    isResponseGateQuestionFlow: jest.fn(() => true),
    normalizeGateLabelTextCore: jest.fn((value) => String(value || '').trim()),
    normalizeQuestionIdKey,
    normalizeSessionSlugValue,
    propsRef: {
      current: {
        questionPool: [{ id: 'props-only', prompt: 'Props question' }],
      },
    },
    resolveConfiguredGateLabel: jest.fn(() => 'Registry questionResponses gate'),
    resolveEffectiveResponseGateConfig: jest.fn(() => ({ sessionName: 'Edge Session' })),
    resolveFieldEncryptionAudienceCore: jest.fn(() => 'gate'),
    resolveGateDisplayLabel: jest.fn(() => 'Fallback gate label'),
    resolveResponseGateSessionSlug: jest.fn(() => 'Edge'),
    resolveSbtGateLabel: jest.fn(() => 'AI Gate Test SBT'),
    resolveSessionChainId: jest.fn(() => 11155420),
    stateRef: {
      current: {
        pileQuestions: [],
        questionPool: [{ id: 'Q1', prompt: 'State question' }],
      },
    },
    t: jest.fn((key) => key),
    ...overrides,
  });

describe('surveyQuestionsGateAudienceRuntime', () => {
  it('normalizes question lookup across state and prop pools', () => {
    const runtime = createRuntime();

    expect(runtime.getQuestionById(' q1 ')).toEqual({ id: 'Q1', prompt: 'State question' });
    expect(runtime.getQuestionById('PROPS-ONLY')).toEqual({ id: 'props-only', prompt: 'Props question' });
    expect(runtime.getQuestionById('missing')).toBeNull();
  });

  it('falls back to policy gates with configured labels and SBT details', () => {
    const runtime = createRuntime();

    expect(runtime.getResponseGateOptions('q1')).toEqual([
      expect.objectContaining({
        gateId: 'questionResponses',
        label: 'Registry questionResponses gate',
        recipients: [{ accessControlConditions: [{ contractAddress: address }], chain: 'optimismSepolia' }],
        sbtAddresses: [address],
        sbtItems: [
          {
            address,
            href: `/u/${address}?session=edge`,
            label: 'AI Gate Test SBT',
          },
        ],
        sbtSummary: 'AI Gate Test SBT',
      }),
    ]);
  });
});
