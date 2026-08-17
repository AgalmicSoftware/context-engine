import {
  buildQuestionCountScopeContextKey,
  buildQuestionDashboardLoadContextSignature,
  buildQuestionFilterStorageKeyPrefix,
  dedupeQuestionReadSlugs,
  getBlockedQuestionIdsSet,
  getExtraQuestionReadSlugs,
  getHighlightedQuestionIdsSet,
  resolveCurrentTagSessionSlug,
  resolveQuestionCountContext,
  resolveResponseHydrationContext,
  resolveSurveyReadContext,
  shouldInheritResolvedTagSessionScope,
} from './surveyToolScope.js';
import { getAllSessionSlugs, getSessionConfigBySlug } from '../../utilities/web3/chainGateway.js';
import { readSessionScanScope, readSessionScanSlugs } from '../../utilities/session/sessionScanScope.js';
import { cloneSessionModePreset, SESSION_MODE_PRESET_IDS } from '../../utilities/session/sessionModeProfile.js';

jest.mock('../../utilities/web3/chainGateway.js', () => ({
  getAllSessionSlugs: jest.fn(() => []),
  getSessionConfigBySlug: jest.fn(() => null),
}));

jest.mock('../../utilities/session/sessionScanScope.js', () => ({
  readSessionScanScope: jest.fn(() => 'active'),
  readSessionScanSlugs: jest.fn(() => []),
}));

const mockedGetAllSessionSlugs = getAllSessionSlugs as jest.MockedFunction<typeof getAllSessionSlugs>;
const mockedGetSessionConfigBySlug = getSessionConfigBySlug as jest.MockedFunction<typeof getSessionConfigBySlug>;
const mockedReadSessionScanScope = readSessionScanScope as jest.MockedFunction<typeof readSessionScanScope>;
const mockedReadSessionScanSlugs = readSessionScanSlugs as jest.MockedFunction<typeof readSessionScanSlugs>;

describe('surveyToolScope', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/questions');
    mockedGetAllSessionSlugs.mockReset();
    mockedGetSessionConfigBySlug.mockReset();
    mockedReadSessionScanScope.mockReset();
    mockedReadSessionScanSlugs.mockReset();

    mockedGetAllSessionSlugs.mockReturnValue([]);
    mockedReadSessionScanScope.mockReturnValue('active');
    mockedReadSessionScanSlugs.mockReturnValue([]);
    mockedGetSessionConfigBySlug.mockImplementation((slug) => {
      if (slug === 'edge') {
        return {
          slug: 'edge',
          networkChainId: 84532,
          __registry: {
            registryChainId: 84532,
            sessionIdHex: '0x00112233445566778899aabbccddeeff',
          },
          sessionName: 'Edge Session',
          BLOCKED_QUESTION_IDS: ['q-blocked'],
          HIGHLIGHTED_QUESTION_IDS: ['q-highlighted'],
        };
      }
      if (slug === 'other') {
        return {
          slug: 'other',
          networkChainId: 84532,
          __registry: {
            registryChainId: 84532,
            sessionIdHex: '0xffeeddccbbaa99887766554433221100',
          },
        };
      }
      if (slug === '') {
        return {
          slug: '',
          networkChainId: 84532,
          sessionName: 'General Session',
        };
      }
      return null;
    });
  });

  it('dedupes normalized read slugs while preserving first-seen order', () => {
    expect(dedupeQuestionReadSlugs(['Edge', 'general', '', 'edge', 'OTHER'])).toEqual(['Edge', '', 'edge', 'OTHER']);
  });

  it('inherits tag session scope only for pinned, session-routed, or survey-scoped views', () => {
    expect(shouldInheritResolvedTagSessionScope({ singleQuestionMode: true })).toBe(false);
    expect(shouldInheritResolvedTagSessionScope({ surveyID: '123' })).toBe(true);

    window.history.pushState({}, '', '/session/edge/questions');
    expect(shouldInheritResolvedTagSessionScope({ singleQuestionMode: true })).toBe(true);
  });

  it('resolves current tag session slug with local overrides before query and inherited scope', () => {
    window.history.pushState({}, '', '/questions?session=edge');

    expect(
      resolveCurrentTagSessionSlug({
        props: { surveyID: '123', activeSessionSlug: 'other' },
        state: {
          localSessionOverrideTouched: true,
          localSessionOverrideSlug: 'override-session',
        },
        getEffectiveDraftSlug: () => 'draft-session',
      }),
    ).toBe('override-session');

    expect(
      resolveCurrentTagSessionSlug({
        props: { surveyID: '123', activeSessionSlug: 'other' },
        state: {},
        getEffectiveDraftSlug: () => 'draft-session',
      }),
    ).toBe('edge');
  });

  it('returns extra read slugs from list and all-scope modes unless the view is explicitly pinned', () => {
    mockedReadSessionScanScope.mockReturnValue('list');
    mockedReadSessionScanSlugs.mockReturnValue(['other', 'general', 'edge', 'other']);

    expect(getExtraQuestionReadSlugs({}, 'edge')).toEqual(['other', '']);
    expect(getExtraQuestionReadSlugs({ sessionSlugPinned: true }, 'edge')).toEqual([]);

    mockedReadSessionScanScope.mockReturnValue('all');
    mockedGetAllSessionSlugs.mockReturnValue(['general', 'edge', 'other', 'general']);

    expect(getExtraQuestionReadSlugs({}, 'edge')).toEqual(['', 'other']);

    window.history.pushState({}, '', '/question/q1?session=edge');
    expect(getExtraQuestionReadSlugs({}, 'edge')).toEqual([]);
  });

  it('builds stable storage and dashboard signatures for multi-session question scopes', () => {
    mockedReadSessionScanScope.mockReturnValue('list');
    mockedReadSessionScanSlugs.mockReturnValue(['other', 'general', 'edge']);

    expect(buildQuestionFilterStorageKeyPrefix({}, 'edge')).toBe('dg:filters:__scope__:__general__|edge|other');

    expect(buildQuestionCountScopeContextKey(['other', 'general', 'other'], 84532)).toBe('__general__|other|84532');

    expect(
      buildQuestionDashboardLoadContextSignature({
        effectiveSlug: 'EDGE',
        scopedSessionSlugs: ['other', 'general', 'other'],
        networkID: 84532,
      }),
    ).toBe('EDGE|__general__|other|84532');
  });

  it('threads fallback scan-scope slugs into question count context resolution', () => {
    mockedReadSessionScanScope.mockReturnValue('list');
    mockedReadSessionScanSlugs.mockReturnValue(['other']);

    const resolved = resolveQuestionCountContext(
      {
        networkChainId: 11155420,
      },
      'edge',
    );

    expect(resolved.scopedSessionSlugs).toEqual(['edge', 'other']);
    expect(resolved.networkId).toBe(84532);
    expect(resolved.networkIdStr).toBe('84532');
  });

  it('uses an exact passed Worker config when the direct route is not registry-backed', () => {
    const sessionConfig = {
      slug: 'demo-sh',
      sessionId: '0x00112233445566778899aabbccddeeff',
      corsWorkerUrl: 'https://worker.example.com',
      sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
    };

    expect(
      resolveResponseHydrationContext(
        {
          sessionSlug: 'demo-sh',
          sessionConfig,
          network: { id: 84532 },
        },
        'demo-sh',
      ),
    ).toMatchObject({
      sessionSlug: 'demo-sh',
      sessionConfig,
      networkId: null,
      networkIdStr: 'worker',
      networkSourceSlug: 'demo-sh',
    });
    expect(resolveSurveyReadContext({ sessionConfig }, 'other')).toMatchObject({
      sessionSlug: 'other',
      sessionConfig: expect.objectContaining({ slug: 'other' }),
      networkIdStr: '84532',
    });
  });

  it('does not borrow a mismatched passed Worker config for an unknown slug', () => {
    const sessionConfig = {
      slug: 'demo-sh',
      sessionId: '0x00112233445566778899aabbccddeeff',
      corsWorkerUrl: 'https://worker.example.com',
      sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
    };

    expect(resolveSurveyReadContext({ sessionConfig }, 'missing')).toMatchObject({
      sessionSlug: 'missing',
      sessionConfig: null,
      networkId: null,
      networkIdStr: '',
    });
  });

  it('derives blocked and highlighted question ids from strict session config context', () => {
    expect(Array.from(getBlockedQuestionIdsSet('edge'))).toEqual(['q-blocked']);
    expect(Array.from(getHighlightedQuestionIdsSet('edge'))).toEqual(['q-highlighted']);
  });
});
