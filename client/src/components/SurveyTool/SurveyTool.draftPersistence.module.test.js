import { act, waitFor } from '@testing-library/react';
import { canonicalizeSessionSlug } from '../../utilities/session/canonicalSessionContext.js';
import * as contractScriptsModule from '../../utilities/web3/chainGateway.js';
import {
  computeSubmitLabel,
  doesQuestionProgressMatchSlug,
  normalizeSurveyToolFilterState,
  shouldShowPileFullLoadingState,
  buildSurveyDraftSemanticSignature,
  buildSurveyDraftStorageKey,
  buildSurveyDraftStorageVariantKeys,
  mergePersistedDraftPayloads,
  parsePersistedDraftStorageValue,
} from './surveyToolDraftState';
import { executeSurveyResponsePrefill, executeSurveySingleQuestionPrefill } from './surveyToolHydrationController';
import {
  buildDraftHydrationState,
  buildHydratedResponseSlice,
  buildMergedSurveyResponseState,
} from './surveyToolHydrationFlow';
import { buildQuestionResponseHydrationPatch } from './surveyToolResponseState';
import { buildSurveyQuestionsPrimarySubmitPlan } from './surveyQuestionsTypes';
import { renderSurveyQuestions } from './surveyQuestionsTestHarness';

const buildEmptySlice = () => ({
  answers: {},
  importance: {},
  conviction: {},
  additionalComments: {},
});

const cloneValue = (value) => JSON.parse(JSON.stringify(value));

const normalizeResponseEncryptionAudience = (audience) => (audience === 'gate' ? 'self' : audience || 'self');

const normalizeFieldAudienceMode = (audienceMode) => audienceMode || 'explicit';

const buildEmptyResponseFieldState = (questionId = '', fieldKey = 'answer') => ({
  value: '',
  encrypted: false,
  encryptionAudience: 'self',
  questionId,
  fieldKey,
});

const buildInheritedAdditionalFieldState = (additionalState) => ({
  ...additionalState,
  audienceMode: 'inherit',
});

const areEnvelopesEquivalent = (incomingEnvelope, currentEnvelope, incomingEncrypted, currentEncrypted) =>
  String(incomingEnvelope || '') === String(currentEnvelope || '') && !!incomingEncrypted === !!currentEncrypted;

const draftEntryResolvers = {
  resolveFieldEncryptionAudience: (field) => field.encryptionAudience || 'self',
  resolveFieldEncryptionGateId: (field) => field.encryptionGateId || null,
  normalizeFieldAudienceMode,
};

const applyDraftEntryToSlice = ({
  targetSlice = null,
  questionId = '',
  draftEntry = null,
  allowOverwrite = false,
} = {}) => {
  if (!targetSlice || !questionId || !draftEntry) return false;
  const patch = buildDraftHydrationPatchForQuestion({
    questionId,
    draftEntry,
    currentAnswer: targetSlice.answers?.[questionId],
    currentAdditional: targetSlice.additionalComments?.[questionId],
    hasCurrentImportance: Object.prototype.hasOwnProperty.call(targetSlice.importance || {}, questionId),
    hasCurrentConviction: Object.prototype.hasOwnProperty.call(targetSlice.conviction || {}, questionId),
    allowOverwrite,
    deps: {
      normalizeResponseEncryptionAudience,
      normalizeFieldAudienceMode,
      buildInheritedAdditionalFieldState,
      buildEmptyResponseFieldState,
    },
  });
  return { promise, resolve, reject };
};

const flushAsyncCallbacks = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
};

const syncClassSetState = (subject) => {
  subject.setState = jest.fn((next, cb) => {
    const patch = typeof next === 'function' ? next(subject.state, subject.props) : next;
    if (patch && typeof patch === 'object') {
      subject.state = { ...subject.state, ...patch };
    }
    if (typeof cb === 'function') cb();
    return patch;
  });
  if (patch.answerState) targetSlice.answers[questionId] = patch.answerState;
  if (patch.additionalState) targetSlice.additionalComments[questionId] = patch.additionalState;
  if (patch.importanceChanged) targetSlice.importance[questionId] = patch.importanceValue;
  if (patch.convictionChanged) targetSlice.conviction[questionId] = patch.convictionValue;
  return !!patch.changed;
};

const applyResponseHydrationListToSlice = ({
  targetSlice = null,
  currentSlice = null,
  responses = [],
  allowOverwrite = false,
  questionIdResolver = (response) => response?.questionID || response?.questionId,
} = {}) => {
  if (!targetSlice) return false;
  const list = Array.isArray(responses) ? responses : [responses];
  let changed = false;
  list.forEach((response) => {
    const questionId = String(questionIdResolver(response) || '').toLowerCase();
    if (!questionId) return;
    if (
      applyResponseHydrationEntryToSlice({
        targetSlice,
        currentSlice,
        questionId,
        response,
        allowOverwrite,
      })
    ) {
      changed = true;
    }
  });
  return changed;
};

const buildSliceFromUserAnswers = (userAnswers, prevSlice = null) =>
  buildHydratedResponseSlice({
    userAnswers,
    prevSlice,
    applyResponseHydrationListToSlice,
    parseValue,
  });

const draftContext = {
  sessionSlug: 'edge',
  networkId: 84532,
};
const legacyEdgeSessionConfig = {
  slug: 'edge',
  networkChainId: 84532,
  __registry: {
    registryChainId: 84532,
    sessionIdHex: '0x00112233445566778899aabbccddeeff',
  },
};

describe('SurveyTool draft persistence', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });
  it('blocks submit click when submitted latch is active and no pending edits exist', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 1 },
    });
    const uploadSpy = jest.fn();
    subject.encryptAndUpload = uploadSpy;
    subject.getPendingEditStats = () => ({ total: 0, encrypted: 0 });
    subject.state = {
      isSubmitting: false,
      submittedSinceLastEdit: true,
      submissionComplete: false,
      modifiedCount: 0,
    };

    subject.handlePrimarySubmitClick();
    expect(uploadSpy).not.toHaveBeenCalled();
    expect(subject._submitGuard).toBe(false);
  });

  it('canonicalizes reserved session aliases when reopening a submitted survey response', () => {
    const priorUrl = window.location.href;
    const pushStateSpy = jest.spyOn(window.history, 'pushState');
    const buildSubject = (activeSessionSlug) => {
      const subject = new SurveyQuestions({
        singleQuestionMode: false,
        isStandalone: false,
        surveyIndex: 0,
        surveyId: '0xSurvey',
        account: '0xAbC',
        loginComplete: true,
        network: { id: 84532 },
        activeSessionSlug,
        sessionSlug: activeSessionSlug,
      });
      subject.getPendingEditStats = () => ({ total: 0, encrypted: 0 });
      subject.state = {
        ...subject.state,
        isSubmitting: false,
        submittedSinceLastEdit: false,
        submissionComplete: true,
        modifiedCount: 0,
      };
      return subject;
    };

    try {
      window.history.replaceState({}, '', '/survey/0xsurvey');

      const debateSubject = buildSubject('DEBATE');
      debateSubject.handlePrimarySubmitClick();
      expect(pushStateSpy).toHaveBeenLastCalledWith({}, '', '/survey/0xsurvey/0xabc?session=DEBATE');

      const generalSubject = buildSubject('general');
      generalSubject.handlePrimarySubmitClick();
      expect(pushStateSpy).toHaveBeenLastCalledWith({}, '', '/survey/0xsurvey/0xabc');
    } finally {
      window.history.replaceState({}, '', priorUrl);
    }
  });

  it('flushes pending standalone draft to storage on unmount', async () => {
    jest.useFakeTimers();
    jest
      .spyOn(contractScriptsModule, 'getSessionConfigBySlug')
      .mockImplementation((slug) => (slug === 'edge' ? legacyEdgeSessionConfig : null));
    const key = buildSurveyDraftStorageKey({
      sessionSlug: 'edge',
      networkIdStr: '84532',
      account: '0xabc',
      surveyScope: 'questions',
    });
    let runtimeEngine = null;
    const view = renderSurveyQuestions({
      account: '0xabc',
      activeSessionSlug: 'edge',
      isStandalone: true,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
      networkChainId: 84532,
      questionPool: [{ id: 'q1', type: 'freeform', prompt: 'Question one' }],
      sessionConfig: legacyEdgeSessionConfig,
      runtimeStrategy: {
        render: (engine) => {
          runtimeEngine = engine;
          return null;
        },
      },
      sessionSlug: 'edge',
      sessionSlug: 'edge',
      questionPool: [{ id: 'q1' }],
    });

    const key = subject.getDraftKey();
    expect(key).toBeTruthy();

    subject.state = {
      ...subject.state,
      questionPool: [{ id: 'q1' }],
      surveysResponseState: [
        {
          answers: {
            q1: { value: 'carry', encrypted: false, encryptionAudience: 'self' },
          },
          additionalComments: {
            q1: { value: '', encrypted: false, encryptionAudience: 'self' },
          },
          importance: {},
          conviction: {},
        },
      ],
      isDirty: true,
      modifiedCount: 1,
    };

    subject.persistDraftSafely(60);
    expect(subject._persistTimer).toBeTruthy();

    subject.componentWillUnmount();

    const raw = sessionStorage.getItem(key);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw);
    expect(parsed?.answers?.q1?.value).toBe('carry');

    sessionStorage.clear();
  });

  it('keeps unresolved draft storage scoped to __pending__ instead of inheriting the general network key', () => {
    sessionStorage.clear();

    const generalCfg = {
      slug: '',
      networkChainId: 84532,
    };
    const strictLookup = (slug) => (
      String(slug || '').trim().toLowerCase() === ''
        ? generalCfg
        : null
    );
    jest.spyOn(contractScriptsModule, 'getSessionConfigBySlug').mockImplementation(strictLookup);
    jest.spyOn(contractScriptsModule, 'getSessionConfigBySlugOrDefault').mockImplementation((slug) => (
      strictLookup(slug) || generalCfg
    ));

    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: true,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      sessionSlug: 'missing-session-slug',
      activeSessionSlug: '',
      questionPool: [{ id: 'q1' }],
    });
    subject._getEffectiveDraftSlug = jest.fn(() => 'missing-session-slug');

    const pendingKey = 'dg:surveyDraft:missing-session-slug:__pending__:0xabc:questions';
    const legacyGeneralKey = 'dg:surveyDraft:missing-session-slug:84532:0xabc:questions';

    sessionStorage.setItem(
      pendingKey,
      JSON.stringify({
        meta: { networkId: null, surveyId: 'questions', ts: 111 },
        answers: { q1: { value: 'pending-draft' } },
      }),
    );
    sessionStorage.setItem(
      legacyGeneralKey,
      JSON.stringify({
        meta: { networkId: 84532, surveyId: 'questions', ts: 222 },
        answers: { q1: { value: 'wrong-general-draft' } },
      }),
    );

    expect(subject.getDraftKey()).toBe(pendingKey);
    expect(subject.loadDraft()).toMatchObject({
      meta: { networkId: null, surveyId: 'questions', ts: 111 },
      answers: {
        q1: {
          value: 'pending-draft',
        },
      },
    });

    sessionStorage.clear();
  });

  it('drops invalid persisted draft payloads during loadDraft', () => {
    sessionStorage.clear();

    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: true,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
      activeSessionSlug: 'edge',
      sessionSlug: 'edge',
      questionPool: [{ id: 'q1' }],
    });

    const key = subject.getDraftKey();
    sessionStorage.setItem(key, JSON.stringify({
      meta: { networkId: 84532, surveyId: 'questions', ts: 111 },
      baseline: { q1: { value: 'invalid-without-answers' } },
    });

    sessionStorage.setItem(key, raw);
    const parsed = parsePersistedDraftStorageValue({ raw });
    if (parsed.status !== 'valid') sessionStorage.removeItem(key);

    expect(parsed.status).toBe('invalid');
    expect(sessionStorage.getItem(key)).toBeNull();
  });

  it('migrates richer anonymous drafts into the account draft on login', () => {
    const accountDraft = {
      meta: { networkId: 84532, surveyId: 'questions', ts: 100 },
      answers: {
        q1: { value: 'account q1' },
        q2: { value: 'account q2' },
        q3: { value: 'account q3' },
      },
    };
    const anonDraft = {
      meta: { networkId: 84532, surveyId: 'questions', ts: 200 },
      answers: Object.fromEntries(
        Array.from({ length: 10 }, (_, index) => {
          const qid = `q${index + 1}`;
          return [qid, { value: `anon ${qid}` }];
        }),
      ),
    };

    const loaded = mergePersistedDraftPayloads({ drafts: [accountDraft, anonDraft] });
    const { answersObj } = buildPersistedDraftMapsForAllowedIds({
      allowedQuestionIds: ['q1', 'q2', 'q3'],
      slice: {
        answers: {
          q1: { value: 'live q1', encrypted: false, encryptionAudience: 'self' },
          q2: { value: 'live q2', encrypted: false, encryptionAudience: 'self' },
          q3: { value: 'live q3', encrypted: false, encryptionAudience: 'self' },
        },
      },
    }));

    expect(subject.loadDraft()).toBeNull();
    expect(sessionStorage.getItem(key)).toBeNull();

    sessionStorage.clear();
  });

  it('applies draft tracking patches without clobbering omitted fields', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: true,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
      activeSessionSlug: 'edge',
      sessionSlug: 'edge',
      questionPool: [{ id: 'q1' }],
    });

    subject._draftParseCache = { key: 'draft-key', raw: '{"answers":{}}', parsed: { answers: {} } };
    subject._lastDraftKey = 'draft-key';
    subject._lastDraftJSON = '{"answers":{}}';
    subject._lastDraftSemanticSignature = 'sig:old';

    subject._applyDraftTrackingState({
      lastDraftJSON: null,
      lastDraftSemanticSignature: 'sig:new',
    });

    expect(subject._draftParseCache).toEqual({ key: 'draft-key', raw: '{"answers":{}}', parsed: { answers: {} } });
    expect(subject._lastDraftKey).toBe('draft-key');
    expect(subject._lastDraftJSON).toBeNull();
    expect(subject._lastDraftSemanticSignature).toBe('sig:new');
  });

  it('applies draft hydration entries to a target slice through one local shell helper', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: true,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
      activeSessionSlug: 'edge',
      sessionSlug: 'edge',
      questionPool: [{ id: 'q1' }],
    });

    const targetSlice = {
      answers: {},
      importance: {},
      conviction: {},
      additionalComments: {},
    };

    const changed = subject._applyDraftHydrationEntryToSlice({
      targetSlice,
      questionId: 'q1',
      draftEntry: {
        value: 'draft answer',
        answerEncrypted: true,
        answerEncryptionAudience: 'gate',
        additional: 'draft notes',
        additionalEncrypted: true,
        additionalAudienceMode: 'inherit',
        importance: 4,
        conviction: 7,
      },
      allowOverwrite: false,
    });

    expect(changed).toBe(true);
    expect(targetSlice.answers.q1).toMatchObject({
      value: 'draft answer',
      encrypted: true,
      encryptionAudience: 'self',
    });
    expect(targetSlice.additionalComments.q1).toMatchObject({
      value: 'draft notes',
      encrypted: true,
      audienceMode: 'inherit',
    });
    expect(targetSlice.importance.q1).toBe(4);
    expect(targetSlice.conviction.q1).toBe(7);
  });

  it('applies response hydration entries to a target slice through one local shell helper', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: true,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
      activeSessionSlug: 'edge',
      sessionSlug: 'edge',
      questionPool: [{ id: 'q1' }],
    });

    const targetSlice = {
      answers: {},
      importance: {},
      conviction: {},
      additionalComments: {},
    };

    const changed = subject._applyResponseHydrationEntryToSlice({
      targetSlice,
      questionId: 'q1',
      response: {
        answer: {
          value: 'hydrated answer',
          encrypted: true,
        },
        additional: {
          value: 'hydrated notes',
          encrypted: true,
          audienceMode: 'inherit',
        },
        importance: 4,
        conviction: 7,
      },
      allowOverwrite: true,
      parseValue: (value) => value,
    });

    expect(changed).toBe(true);
    expect(targetSlice.answers.q1).toMatchObject({
      value: 'hydrated answer',
      encrypted: true,
    });
    expect(targetSlice.additionalComments.q1).toMatchObject({
      value: 'hydrated notes',
      encrypted: true,
      audienceMode: 'inherit',
    });
    expect(targetSlice.importance.q1).toBe(4);
    expect(targetSlice.conviction.q1).toBe(7);
  });

  it('skips draft rewrites when only timestamp would change and writes again after semantic edits', () => {
    sessionStorage.clear();
    const nowSpy = jest.spyOn(Date, 'now')
      .mockReturnValueOnce(1000)
      .mockReturnValueOnce(2000)
      .mockReturnValueOnce(3000);

    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: true,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
      activeSessionSlug: 'edge',
      sessionSlug: 'edge',
      sessionSlug: 'edge',
      questionPool: [{ id: 'q1' }],
    });

    subject.state = {
      ...subject.state,
      questionPool: [{ id: 'q1' }],
      surveysResponseState: [
        {
          answers: {
            q1: { value: 'carry', encrypted: false, encryptionAudience: 'self' },
          },
          additionalComments: {
            q1: { value: '', encrypted: false, encryptionAudience: 'self' },
          },
          importance: {},
          conviction: {},
        },
      ],
    };

    const key = subject.getDraftKey();
    const setSpy = jest.spyOn(Storage.prototype, 'setItem');

    subject.persistDraft();
    const firstRaw = sessionStorage.getItem(key);
    const firstTs = JSON.parse(firstRaw)?.meta?.ts;

    subject.persistDraft();
    const secondRaw = sessionStorage.getItem(key);
    const secondTs = JSON.parse(secondRaw)?.meta?.ts;

    expect(secondRaw).toBe(firstRaw);
    expect(secondTs).toBe(firstTs);

    subject.state.surveysResponseState[0].answers.q1 = {
      ...subject.state.surveysResponseState[0].answers.q1,
      value: 'carry-updated',
    };
    subject._draftDirtyQids.add('q1');
    subject.persistDraft();
    const thirdRaw = sessionStorage.getItem(key);
    const thirdTs = JSON.parse(thirdRaw)?.meta?.ts;

    expect(thirdRaw).not.toBe(firstRaw);
    expect(thirdTs).toBe(3000);
    expect(setSpy.mock.calls.filter((call) => call[0] === key)).toHaveLength(2);

    nowSpy.mockRestore();
    setSpy.mockRestore();
    sessionStorage.clear();
  });

  it('persists and rehydrates encrypted portions for decrypted empty fields', () => {
    sessionStorage.clear();
    const sharedProps = {
      singleQuestionMode: false,
      isStandalone: true,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
      activeSessionSlug: 'edge',
      sessionSlug: 'edge',
      questionPool: [{ id: 'q1' }],
    };

    const subject = new SurveyQuestions(sharedProps);
    subject.state = {
      ...subject.state,
      questionPool: [{ id: 'q1' }],
      editBaseline: {
        answers: {
          q1: {
            value: 'baseline-answer',
            encrypted: true,
            encryptionAudience: 'gate',
            encryptedPortion: 'ans-base-1',
          },
        },
        additionalComments: {
          q1: {
            value: '',
            encrypted: true,
            encryptionAudience: 'gate',
            encryptedPortion: 'add-base-1',
          },
        },
        importance: {},
        conviction: {},
      },
      surveysResponseState: [
        {
          answers: {
            q1: {
              value: 'anchor-answer',
              encrypted: false,
              encryptionAudience: 'self',
              encryptedPortion: 'ans-env-1',
            },
          },
          additionalComments: {
            q1: {
              value: '',
              encrypted: true,
              encryptionAudience: 'gate',
              encryptedPortion: 'add-env-1',
            },
          },
          importance: {},
          conviction: {},
        },
      ],
    };

    subject.persistDraft();
    const key = subject.getDraftKey();
    const persisted = JSON.parse(sessionStorage.getItem(key) || '{}');

    expect(persisted?.answers?.q1?.answerEncryptedPortion).toBe('ans-env-1');
    expect(persisted?.answers?.q1?.additionalEncryptedPortion).toBe('add-env-1');
    expect(persisted?.baseline?.q1?.answerEncryptedPortion).toBe('ans-base-1');
    expect(persisted?.baseline?.q1?.additionalEncryptedPortion).toBe('add-base-1');
    expect(persisted?.baseline?.q1?.value).toBe('baseline-answer');

    const reloaded = new SurveyQuestions(sharedProps);
    reloaded.state = {
      ...reloaded.state,
      questionPool: [{ id: 'q1' }],
      editBaseline: { answers: {}, additionalComments: {}, importance: {}, conviction: {} },
      surveysResponseState: [
        {
          answers: {
            q1: { value: '', encrypted: true, encryptionAudience: 'gate' },
          },
          additionalComments: {
            q1: { value: '', encrypted: true, encryptionAudience: 'gate' },
          },
          importance: {},
          conviction: {},
        },
      ],
    };
    reloaded.getHydrationQuestionIds = jest.fn().mockReturnValue(['q1']);
    reloaded.setState = (update, cb) => {
      const patch = typeof update === 'function' ? update(reloaded.state, reloaded.props) : update;
      reloaded.state = { ...reloaded.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
    };

    reloaded.rehydrateDraftForRenderedIds(true);

    expect(reloaded.state.surveysResponseState?.[0]?.answers?.q1?.encryptedPortion).toBe('ans-env-1');
    expect(reloaded.state.surveysResponseState?.[0]?.additionalComments?.q1?.encryptedPortion).toBe('add-env-1');
    expect(reloaded.state.editBaseline?.answers?.q1?.encryptedPortion).toBe('ans-base-1');
    expect(reloaded.state.editBaseline?.additionalComments?.q1?.encryptedPortion).toBe('add-base-1');
    expect(reloaded.state.editBaseline?.answers?.q1?.value).toBe('baseline-answer');

    sessionStorage.clear();
  });

  it('rewrites draft payload when only baseline changes', () => {
    sessionStorage.clear();
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: true,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
      activeSessionSlug: 'edge',
      sessionSlug: 'edge',
      questionPool: [{ id: 'q1' }],
    });

    expect(firstPayload.answers.q1.value).toBe('stable-answer');
    expect(firstPayload.baseline.q1.value).toBe('baseline-v1');
    expect(secondPayload.answers.q1.value).toBe('stable-answer');
    expect(secondPayload.baseline.q1.value).toBe('baseline-v2');
    expect(secondPayload.baseline.q1.answerEncryptedPortion).toBe('ans-base-2');
    expect(buildSurveyDraftSemanticSignature(secondPayload)).not.toBe(buildSurveyDraftSemanticSignature(firstPayload));
  });

  it('rehydrates baseline from draft even when no answer entry exists', () => {
    sessionStorage.clear();
    const sharedProps = {
      singleQuestionMode: false,
      isStandalone: true,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
      activeSessionSlug: 'edge',
      sessionSlug: 'edge',
      questionPool: [{ id: 'q1' }],
    };

    const subject = new SurveyQuestions(sharedProps);
    const key = subject.getDraftKey();
    sessionStorage.setItem(key, JSON.stringify({
      meta: { networkId: 84532, surveyId: 'questions', ts: 111 },
      answers: {},
      baseline: {
        q1: {
          value: 'baseline-only',
          answerEncrypted: true,
          answerEncryptionAudience: 'gate',
          answerEncryptedPortion: 'ans-base-only',
          additional: '',
          additionalEncrypted: false,
          additionalEncryptionAudience: 'self',
          importance: null,
          conviction: null,
        },
      },
    }));

    subject.state = {
      ...subject.state,
      questionPool: [{ id: 'q1' }],
      surveysResponseState: [
        { answers: {}, additionalComments: {}, importance: {}, conviction: {} },
      ],
      editBaseline: { answers: {}, additionalComments: {}, importance: {}, conviction: {} },
    };
    subject.getHydrationQuestionIds = jest.fn().mockReturnValue(['q1']);
    subject.setState = (update, cb) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      subject.state = { ...subject.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
    };

    subject.rehydrateDraftForRenderedIds(true);

    expect(subject.state.surveysResponseState?.[0]?.answers?.q1).toBeUndefined();
    expect(subject.state.editBaseline?.answers?.q1?.value).toBe('baseline-only');
    expect(subject.state.editBaseline?.answers?.q1?.encryptedPortion).toBe('ans-base-only');

    sessionStorage.clear();
  });

  it('keeps restored draft baseline aligned after masked prefill on refresh', () => {
    sessionStorage.clear();
    const sharedProps = {
      singleQuestionMode: false,
      isStandalone: true,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
      activeSessionSlug: 'edge',
      sessionSlug: 'edge',
      questionPool: [{ id: 'q1' }],
    };

    const subject = new SurveyQuestions(sharedProps);
    subject.state = {
      ...subject.state,
      questionPool: [{ id: 'q1' }],
      editBaseline: {
        answers: {
          q1: {
            value: 'real text',
            encrypted: true,
            encryptionAudience: 'gate',
            encryptedPortion: 'ans-env-1',
          },
        },
        additionalComments: {},
        importance: {},
        conviction: {},
      },
      surveysResponseState: [
        {
          answers: {
            q1: {
              value: 'real text',
              encrypted: true,
              encryptionAudience: 'gate',
              encryptedPortion: 'ans-env-1',
            },
          },
          additionalComments: {},
          importance: {},
          conviction: {},
        },
      ],
    };

    subject.persistDraft();

    const reloaded = new SurveyQuestions(sharedProps);
    reloaded.state = {
      ...reloaded.state,
      questionPool: [{ id: 'q1' }],
      editBaseline: { answers: {}, additionalComments: {}, importance: {}, conviction: {} },
      surveysResponseState: [
        { answers: {}, additionalComments: {}, importance: {}, conviction: {} },
      ],
    };
    reloaded.getHydrationQuestionIds = jest.fn().mockReturnValue(['q1']);
    reloaded.setState = (update, cb) => {
      const patch = typeof update === 'function' ? update(reloaded.state, reloaded.props) : update;
      reloaded.state = { ...reloaded.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
    };
    reloaded.updateJsonPreview = jest.fn();
    reloaded.recalculateEditStats = jest.fn();

    reloaded.rehydrateDraftForRenderedIds(true);
    reloaded.prefillSurveyResponses({
      responses: [
        {
          questionID: 'q1',
          answer: { value: '*', encrypted: true, encryptedPortion: 'ans-env-1' },
          additional: { value: '', encrypted: false, encryptedPortion: '' },
        },
      ],
    });

    expect(reloaded.state.surveysResponseState?.[0]?.answers?.q1?.value).toBe('real text');
    expect(reloaded.state.editBaseline?.answers?.q1?.value).toBe('real text');
    expect(reloaded.state.editBaseline?.answers?.q1?.encryptedPortion).toBe('ans-env-1');

    sessionStorage.clear();
  });

  it('keeps decrypted-empty answer aligned when masked response has encrypted=true without envelope', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });

    const prevSlice = {
      answers: {
        q1: {
          value: '',
          encrypted: true,
          encryptedPortion: '',
          encryptionAudience: 'gate',
        },
      },
      additionalComments: {},
      importance: {},
      conviction: {},
    };
    const nextSlice = buildSliceFromUserAnswers(
      {
        responses: [
          {
            questionID: 'q1',
            answer: { value: '*', encrypted: true, encryptedPortion: '' },
            additional: { value: '*', encrypted: true, encryptedPortion: '' },
          },
        ],
      },
      prevSlice,
    );

    expect(nextSlice.answers.q1.value).toBe('');
    expect(nextSlice.additionalComments.q1.value).toBe('*');
  });

  it('prefills single-question responses into ensured survey slots', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: true,
      isStandalone: false,
      surveyIndex: 0,
      questionID: 'q1',
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });

    subject.state = {
      ...subject.state,
      surveysResponseState: [],
      editBaseline: null,
      isDirty: false,
      submissionComplete: false,
    };
    subject._applyResponseHydrationListToSlice = jest.fn(({ targetSlice, responses }) => {
      targetSlice.answers.q1 = { value: responses[0].answer.value };
      targetSlice.additionalComments.q1 = { value: responses[0].additional.value };
      return true;
    });
    subject.buildSliceFromUserAnswers = jest.fn(() => ({
      answers: { q1: { value: 'baseline answer' } },
      additionalComments: { q1: { value: 'baseline notes' } },
      importance: {},
      conviction: {},
    }));
    subject.updateJsonPreview = jest.fn();
    subject.recalculateEditStats = jest.fn();
    subject.setState = (update, cb) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      subject.state = { ...subject.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
    };

    subject.prefillSingleQuestionResponse({
      questionID: 'q1',
      answer: { value: 'hydrated answer' },
      additional: { value: 'hydrated notes' },
    });

    expect(subject.state.surveysResponseState).toHaveLength(1);
    expect(subject.state.surveysResponseState[0]).toEqual({
      answers: { q1: { value: 'hydrated answer' } },
      importance: {},
      conviction: {},
      additionalComments: { q1: { value: 'hydrated notes' } },
    });
    expect(subject.state.editBaseline).toEqual({
      answers: { q1: { value: 'baseline answer' } },
      additionalComments: { q1: { value: 'baseline notes' } },
      importance: {},
      conviction: {},
    });
    expect(subject.updateJsonPreview).toHaveBeenCalled();
    expect(subject.recalculateEditStats).toHaveBeenCalled();
  });

  it('prefills multi-question responses into ensured survey slots', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 1,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
    });

    subject.state = {
      ...subject.state,
      surveysResponseState: [
        { answers: { keep: { value: 'persisted' } }, importance: {}, conviction: {}, additionalComments: {} },
      ],
      editBaseline: { answers: {}, importance: {}, conviction: {}, additionalComments: {} },
      isDirty: false,
      submissionComplete: false,
    };
    subject._applyResponseHydrationListToSlice = jest.fn(({ targetSlice, responses }) => {
      targetSlice.answers.q1 = { value: responses[0].answer.value };
      targetSlice.additionalComments.q1 = { value: responses[0].additional.value };
      targetSlice.importance.q1 = responses[0].importance;
      targetSlice.conviction.q1 = responses[0].conviction;
      return true;
    });
    subject.buildSliceFromUserAnswers = jest.fn(() => ({
      answers: { q1: { value: 'baseline answer' } },
      additionalComments: { q1: { value: 'baseline notes' } },
      importance: { q1: 4 },
      conviction: { q1: 7 },
    }));
    subject.updateJsonPreview = jest.fn();
    subject.recalculateEditStats = jest.fn();
    subject.setState = (update, cb) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      subject.state = { ...subject.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
    };

    subject.prefillSurveyResponses({
      responses: [
        {
          questionID: 'q1',
          answer: { value: 'hydrated answer' },
          additional: { value: 'hydrated notes' },
          importance: 4,
          conviction: 7,
        },
      ],
    });

    expect(subject.state.surveysResponseState).toHaveLength(2);
    expect(subject.state.surveysResponseState[0]).toEqual({
      answers: { keep: { value: 'persisted' } },
      importance: {},
      conviction: {},
      additionalComments: {},
    });
    expect(subject.state.surveysResponseState[1]).toEqual({
      answers: { q1: { value: 'hydrated answer' } },
      importance: { q1: 4 },
      conviction: { q1: 7 },
      additionalComments: { q1: { value: 'hydrated notes' } },
    });
    expect(subject.state.editBaseline).toEqual({
      answers: { q1: { value: 'baseline answer' } },
      additionalComments: { q1: { value: 'baseline notes' } },
      importance: { q1: 4 },
      conviction: { q1: 7 },
    });
    expect(subject.updateJsonPreview).toHaveBeenCalled();
    expect(subject.recalculateEditStats).toHaveBeenCalled();
  });

  it('merges survey response state into ensured survey slots', () => {
    expect(
      buildMergedSurveyResponseState({
        currentState: [
          {
            answers: { keep: { value: 'persisted' } },
            importance: {},
            conviction: {},
            additionalComments: {},
          },
        ],
        newQuestionPool: [{ id: 'q1' }],
        surveyIndex: 2,
        buildEmptyResponseFieldState: (qid, fieldKey = 'answer') => ({
          value: '',
          qid,
          fieldKey,
        }),
      }),
    ).toEqual([
      {
        answers: { keep: { value: 'persisted' } },
        importance: {},
        conviction: {},
        additionalComments: {},
      },
      { answers: {}, importance: {}, conviction: {}, additionalComments: {} },
      {
        answers: { q1: { value: '', qid: 'q1', fieldKey: 'answer' } },
        importance: {},
        conviction: {},
        additionalComments: { q1: { value: '', qid: 'q1', fieldKey: 'additional' } },
      },
    ]);
  });

  it('does not resurrect cleared draft answers from stale cache', () => {
    sessionStorage.clear();

    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: true,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
      activeSessionSlug: 'edge',
      sessionSlug: 'edge',
      sessionSlug: 'edge',
      questionPool: [{ id: 'q1' }],
    });

    subject.state = {
      ...subject.state,
      questionPool: [{ id: 'q1' }],
      pileQuestions: [],
      editBaseline: {
        answers: {
          q1: { value: 'keep-baseline', encrypted: false, encryptionAudience: 'self' },
        },
        additionalComments: {
          q1: { value: '', encrypted: false, encryptionAudience: 'self' },
        },
        importance: {},
        conviction: {},
      },
      surveysResponseState: [
        {
          answers: {
            q1: { value: 'keep', encrypted: false, encryptionAudience: 'self' },
          },
          additionalComments: {
            q1: { value: '', encrypted: false, encryptionAudience: 'self' },
          },
          importance: {},
          conviction: {},
        },
      ],
    };

    const key = subject.getDraftKey();
    const seedPayload = {
      meta: { networkId: 84532, surveyId: 'questions', ts: 111 },
      answers: {
        q1: {
          value: 'keep',
          answerEncrypted: false,
          answerEncryptionAudience: 'self',
          additional: '',
          additionalEncrypted: false,
          additionalEncryptionAudience: 'self',
          importance: null,
          conviction: null,
        },
        q2: {
          value: 'remove-me',
          answerEncrypted: false,
          answerEncryptionAudience: 'self',
          additional: '',
          additionalEncrypted: false,
          additionalEncryptionAudience: 'self',
          importance: null,
          conviction: null,
        },
      },
      baseline: {
        q1: {
          value: 'keep-baseline',
          answerEncrypted: false,
          answerEncryptionAudience: 'self',
          additional: '',
          additionalEncrypted: false,
          additionalEncryptionAudience: 'self',
          importance: null,
          conviction: null,
        },
        q2: {
          value: 'remove-baseline',
          answerEncrypted: false,
          answerEncryptionAudience: 'self',
          additional: '',
          additionalEncrypted: false,
          additionalEncryptionAudience: 'self',
          importance: null,
          conviction: null,
        },
      },
    };
    const seedRaw = JSON.stringify(seedPayload);
    sessionStorage.setItem(key, seedRaw);
    subject._lastDraftKey = key;
    subject._lastDraftJSON = seedRaw;
    subject._lastDraftSemanticSignature = buildSurveyDraftSemanticSignature(seedPayload);
    subject._draftParseCache = { key, raw: seedRaw, parsed: seedPayload };

    subject.clearDraftFor('q2');
    const afterClear = JSON.parse(sessionStorage.getItem(key) || '{}');
    expect(afterClear?.answers?.q2).toBeUndefined();
    expect(afterClear?.baseline?.q2).toBeUndefined();

    subject.persistDraft();
    const afterPersist = JSON.parse(sessionStorage.getItem(key) || '{}');
    expect(afterPersist?.answers?.q2).toBeUndefined();
    expect(afterPersist?.baseline?.q2).toBeUndefined();
    expect(afterPersist?.answers?.q1?.value).toBe('keep');
    expect(afterPersist?.baseline?.q1?.value).toBe('keep-baseline');

    sessionStorage.clear();
  });
});

const applyState = (stateRef) => (update, callback) => {
  const patch = typeof update === 'function' ? update(stateRef.current) : update;
  stateRef.current = { ...stateRef.current, ...(patch || {}) };
  if (typeof callback === 'function') callback();
  return patch;
};

const executePrefillSurvey = ({ surveysResponseState = [], editBaseline = buildEmptySlice(), responses = [] } = {}) => {
  const stateRef = {
    current: {
      surveysResponseState,
      editBaseline,
      isDirty: false,
      submissionComplete: false,
    },
  };
  executeSurveyResponsePrefill({
    state: stateRef.current,
    surveyIndex: 0,
    userAnswers: { responses },
    buildSliceFromUserAnswers,
    applyResponseHydrationListToSlice,
    setState: applyState(stateRef),
    updateJsonPreview: jest.fn(),
    recalculateEditStats: jest.fn(),
  });
  return stateRef.current;
};
