import { createSurveyQuestionsDraftPersistenceRuntime } from './surveyQuestionsDraftPersistenceRuntime';
import type { SurveyQuestionsLegacyRecord } from './surveyQuestionsTypes';

const createContext = (overrides: SurveyQuestionsLegacyRecord = {}) => ({
  buildPersistDraftAllowedQuestionIds: jest.fn(() => []),
  buildPersistedDraftMapsForAllowedIds: jest.fn(() => ({
    answersObj: {},
    baselineObj: {},
  })),
  buildPersistedDraftPayload: jest.fn(() => ({
    answers: {},
  })),
  buildPersistedDraftQuestionRemovalPlan: jest.fn(() => ({ action: 'delete-storage' })),
  buildPersistedDraftTrackingAfterLoad: jest.fn((tracking) => tracking),
  buildPersistedDraftTrackingAfterScopedDelete: jest.fn((tracking) => tracking),
  buildPersistedDraftTrackingAfterWrite: jest.fn((tracking) => tracking),
  buildPersistedDraftTrackingClearedState: jest.fn(() => ({ cleared: true })),
  buildPersistedDraftTrackingOnKeyChange: jest.fn((tracking) => tracking),
  buildPersistedDraftWritePlan: jest.fn(() => ({
    compatWriteKey: '',
    staleAnonKeys: [],
  })),
  buildSurveyDraftLoadPlan: jest.fn(() => []),
  buildSurveyDraftSemanticSignature: jest.fn(() => 'sig'),
  buildSurveyDraftStorageKey: jest.fn(
    ({ sessionSlug, networkIdStr, account, surveyScope }) =>
      `draft:${sessionSlug}:${networkIdStr}:${account || 'anon'}:${surveyScope}`,
  ),
  buildSurveyDraftStorageVariantKeys: jest.fn(() => ({
    compatAccountKey: 'compat-acct',
    compatAnonKey: 'compat-anon',
    pendingAccountKey: 'pending-acct',
    perQuestionAccountKey: '',
    perQuestionAnonKey: '',
    primaryAccountKey: 'acct-key',
    primaryAnonKey: 'anon-key',
    purgeKeys: ['acct-key', 'anon-key', 'pending-acct'],
  })),
  getHydrationQuestionIds: jest.fn(() => []),
  inst: {
    _applyDraftTrackingState: jest.fn(),
    _draftDirtyQids: new Set<string>(),
    _draftParseCache: null,
    _getDraftScope: jest.fn(() => 'questions:q:q1'),
    _getEffectiveDraftSlug: jest.fn(() => 'edge'),
    _lastDraftJSON: '',
    _lastDraftKey: '',
    _lastDraftSemanticSignature: '',
  },
  loadPreviousPersistedDraftSnapshot: jest.fn(() => ({
    nextDraftParseCache: null,
    prevAnswers: {},
    prevBaseline: {},
    prevDraftRaw: '',
    prevSemanticSignature: '',
    shouldResetDraftTracking: false,
  })),
  measureSync: jest.fn((label, callback) => callback()),
  mergePersistedDraftPayloads: jest.fn(() => null),
  normalizeFieldAudienceMode: jest.fn((value) => value || 'self'),
  parsePersistedDraftStorageValue: jest.fn(({ raw }) => ({
    payload: JSON.parse(raw),
    raw,
    status: 'valid',
  })),
  propsRef: {
    current: {
      account: '0xabc',
      questionID: 'q1',
      singleQuestionMode: true,
    },
  },
  resolveDraftStorageContext: jest.fn(() => ({
    networkIdStr: '11155420',
    sessionSlug: 'edge',
  })),
  resolveFieldEncryptionAudience: jest.fn(() => 'self'),
  resolveFieldEncryptionGateId: jest.fn(() => ''),
  stateRef: {
    current: {
      editBaseline: {
        additionalComments: {},
        answers: {},
        conviction: {},
        importance: {},
      },
      surveysResponseState: [
        {
          additionalComments: {},
          answers: {},
          conviction: {},
          importance: {},
        },
      ],
    },
  },
  surveyLog: {
    warn: jest.fn(),
  },
  ...overrides,
});

describe('surveyQuestionsDraftPersistenceRuntime', () => {
  beforeEach(() => {
    sessionStorage.clear();
    jest.clearAllMocks();
  });

  it('builds draft keys from the active draft storage context', () => {
    const context = createContext();

    expect(createSurveyQuestionsDraftPersistenceRuntime(context).getDraftKey()).toBe(
      'draft:edge:11155420:0xabc:questions:q:q1',
    );
    expect(context.resolveDraftStorageContext).toHaveBeenCalledWith(context.propsRef.current, 'edge');
    expect(context.buildSurveyDraftStorageKey).toHaveBeenCalledWith({
      account: '0xabc',
      networkIdStr: '11155420',
      sessionSlug: 'edge',
      surveyScope: 'questions:q:q1',
    });
  });

  it('migrates pending drafts into the active account key on load', () => {
    const pendingPayload = {
      answers: {
        q1: {
          value: 'pending answer',
        },
      },
    };
    sessionStorage.setItem('pending-acct', JSON.stringify(pendingPayload));
    const mergedPayload = {
      answers: {
        q1: {
          value: 'merged answer',
        },
      },
    };
    const context = createContext({
      buildSurveyDraftLoadPlan: jest.fn(() => [
        {
          readKey: 'pending-acct',
          writeKey: true,
        },
      ]),
      mergePersistedDraftPayloads: jest.fn(() => mergedPayload),
    });

    expect(createSurveyQuestionsDraftPersistenceRuntime(context).loadDraft()).toEqual(mergedPayload);
    expect(sessionStorage.getItem('acct-key')).toBe(JSON.stringify(mergedPayload));
    expect(sessionStorage.getItem('pending-acct')).toBeNull();
    expect(context.mergePersistedDraftPayloads).toHaveBeenCalledWith({
      drafts: [pendingPayload],
    });
  });
});
