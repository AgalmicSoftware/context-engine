import { createSurveyQuestionsDraftPersistenceRuntime } from './surveyQuestionsDraftPersistenceRuntime';
import type { SurveyQuestionsLegacyRecord } from './surveyQuestionsTypes';
import * as draftState from './surveyToolDraftState';
import { resolveDraftStorageContext } from './surveyToolScope';
import { cloneSessionModePreset, SESSION_MODE_PRESET_IDS } from '../../utilities/session/sessionModeProfile';

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
  buildRatingEnvelopeQidSetFromUserAnswers: jest.fn(() => new Set<string>()),
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
  getChangedQidsAndFields: jest.fn(() => ({ changedMap: { q1: { answer: true } } })),
  setState: jest.fn(),
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

const makeWorkerConfig = (
  corsWorkerUrl = 'https://a.example.com',
  sessionId = '0x00112233445566778899aabbccddeeff',
) => ({
  slug: 'edge',
  corsWorkerUrl,
  sessionId,
  sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
  storageProfile: { backend: 'cloudflare', resources: { questions: 'active', surveys: 'active' } },
});

const createRealDraftContext = (sessionConfig: Record<string, unknown> = makeWorkerConfig()) => {
  const base = createContext({ ...draftState, resolveDraftStorageContext });
  const context = {
    ...base,
    propsRef: { current: { ...base.propsRef.current, sessionConfig } },
    stateRef: {
      current: {
        ...base.stateRef.current,
        draftPersistenceError: '',
        surveysResponseState: [
          {
            ...base.stateRef.current.surveysResponseState[0],
            answers: { q1: { value: 'draft A', encrypted: false } },
          },
        ],
      },
    },
  };
  context.inst._draftDirtyQids.add('q1');
  context.inst._applyDraftTrackingState.mockImplementation((tracking) => Object.assign(context.inst, tracking));
  context.setState.mockImplementation((patch) => Object.assign(context.stateRef.current, patch));
  return context;
};

describe('persisted drafts use the actual source authority', () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    makeWorkerConfig('https://b.example.com'),
    makeWorkerConfig('https://a.example.com', '0xffeeddccbbaa99887766554433221100'),
  ])('isolates the actual loader and scoped cleanup after a same-slug authority switch', (otherConfig) => {
    const context = createRealDraftContext();
    const runtime = createSurveyQuestionsDraftPersistenceRuntime(context);
    runtime.persistDraft();
    const keyA = runtime.getDraftKey();
    const rawA = sessionStorage.getItem(keyA);
    expect(runtime.loadDraft()?.answers.q1.value).toBe('draft A');

    context.propsRef.current.sessionConfig = otherConfig;
    expect(runtime.loadDraft()).toBeNull();
    expect(runtime.getDraftKey()).not.toBe(keyA);
    context.stateRef.current.surveysResponseState[0].answers.q1.value = 'draft B';
    runtime.persistDraft();
    expect(runtime.loadDraft()?.answers.q1.value).toBe('draft B');
    runtime.clearDraftFor('q1');
    runtime.clearDraft();
    expect(sessionStorage.getItem(keyA)).toBe(rawA);
    context.propsRef.current.sessionConfig = makeWorkerConfig();
    expect(runtime.loadDraft()?.answers.q1.value).toBe('draft A');
  });

  it('keeps anonymous adoption and config revision changes within the same authority', () => {
    const context = createRealDraftContext();
    const runtime = createSurveyQuestionsDraftPersistenceRuntime(context);
    context.propsRef.current.account = '';
    runtime.persistDraft();
    const anonKey = runtime.getDraftKey();
    context.propsRef.current.account = '0xabc';
    expect(runtime.loadDraft()?.answers.q1.value).toBe('draft A');
    expect(sessionStorage.getItem(anonKey)).toBeNull();
    const accountKey = runtime.getDraftKey();
    context.propsRef.current.sessionConfig = { ...makeWorkerConfig(), configRevision: 42 };
    expect(runtime.getDraftKey()).toBe(accountKey);
    expect(runtime.loadDraft()?.answers.q1.value).toBe('draft A');
  });

  it('retains unscoped legacy Worker drafts without adopting, mirroring, or deleting them', () => {
    const context = createRealDraftContext();
    const runtime = createSurveyQuestionsDraftPersistenceRuntime(context);
    const legacyKeys = draftState.buildSurveyDraftStorageVariantKeys({
      sessionSlug: 'edge',
      networkIdStr: 'worker',
      account: '0xabc',
      surveyScope: 'questions:q:q1',
      questionId: 'q1',
      includePerQuestionScope: true,
    }).purgeKeys;
    const legacyRaw = JSON.stringify({ answers: { q1: { value: 'unverified legacy draft' } } });
    legacyKeys.forEach((key) => sessionStorage.setItem(key, legacyRaw));
    expect(runtime.loadDraft()).toBeNull();
    runtime.persistDraft();
    runtime.clearDraftFor('q1');
    runtime.clearDraft();
    legacyKeys.forEach((key) => expect(sessionStorage.getItem(key)).toBe(legacyRaw));
  });

  it('fails closed when a Worker authority is incomplete and preserves registry keys', () => {
    const context = createRealDraftContext({ ...makeWorkerConfig(), sessionId: '' });
    const runtime = createSurveyQuestionsDraftPersistenceRuntime(context);
    expect(runtime.getDraftKey()).toBeNull();
    expect(runtime.loadDraft()).toBeNull();
    runtime.persistDraft();
    expect(sessionStorage.length).toBe(0);
    context.propsRef.current.sessionConfig = {
      slug: 'edge',
      networkChainId: 84532,
      __registry: { registryChainId: 84532, sessionIdHex: '0x00112233445566778899aabbccddeeff' },
    };
    expect(runtime.getDraftKey()).toBe('dg:surveyDraft:edge:84532:0xabc:questions:q:q1');
  });

  it('reports storage failure without losing the in-memory answer and clears it after a retry', () => {
    const context = createRealDraftContext();
    const runtime = createSurveyQuestionsDraftPersistenceRuntime(context);
    const setItem = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    runtime.persistDraft();
    expect(context.stateRef.current.draftPersistenceError).toMatch(/only in memory/i);
    expect(context.stateRef.current.surveysResponseState[0].answers.q1.value).toBe('draft A');
    expect(context.inst._draftDirtyQids.has('q1')).toBe(true);
    setItem.mockRestore();
    runtime.persistDraft();
    expect(runtime.loadDraft()?.answers.q1.value).toBe('draft A');
    expect(context.stateRef.current.draftPersistenceError).toBe('');
  });
});

it('does not run a debounced write after its source authority changes', () => {
  jest.useFakeTimers();
  try {
    sessionStorage.clear();
    const context = createRealDraftContext();
    const runtime = createSurveyQuestionsDraftPersistenceRuntime(context);
    runtime.persistDraftSafely();
    context.propsRef.current.sessionConfig = makeWorkerConfig('https://b.example.com');
    jest.advanceTimersByTime(200);
    expect(sessionStorage.length).toBe(0);
    expect(runtime.loadDraft()).toBeNull();
  } finally {
    jest.useRealTimers();
  }
});

it('retains source drafts when anonymous adoption cannot be persisted', () => {
  sessionStorage.clear();
  const context = createRealDraftContext();
  const runtime = createSurveyQuestionsDraftPersistenceRuntime(context);
  context.propsRef.current.account = '';
  runtime.persistDraft();
  const anonKey = runtime.getDraftKey();
  const raw = sessionStorage.getItem(anonKey);
  context.propsRef.current.account = '0xabc';
  const setItem = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('quota', 'QuotaExceededError');
  });
  try {
    expect(runtime.loadDraft()?.answers.q1.value).toBe('draft A');
    expect(sessionStorage.getItem(anonKey)).toBe(raw);
    expect(context.stateRef.current.draftPersistenceError).toMatch(/only in memory/i);
  } finally {
    setItem.mockRestore();
  }
});

it('clears a stale memory-only warning after the user empties the draft', () => {
  sessionStorage.clear();
  const context = createRealDraftContext();
  const runtime = createSurveyQuestionsDraftPersistenceRuntime(context);
  const setItem = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('quota', 'QuotaExceededError');
  });
  try {
    runtime.persistDraft();
    expect(context.stateRef.current.draftPersistenceError).toMatch(/only in memory/i);
  } finally {
    setItem.mockRestore();
  }
  context.stateRef.current.surveysResponseState[0].answers.q1.value = '';
  context.getChangedQidsAndFields.mockReturnValue({ changedMap: { q1: { answer: false } } });
  runtime.persistDraft();
  expect(context.stateRef.current.draftPersistenceError).toBe('');
  expect(runtime.loadDraft()).toBeNull();
});
