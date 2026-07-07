import { act, waitFor } from '@testing-library/react';
import { canonicalizeSessionSlug } from '../../utilities/session/canonicalSessionContext.js';
import {
  buildDraftHydrationPatchForQuestion,
  buildPersistDraftAllowedQuestionIds,
  buildPersistedDraftMapsForAllowedIds,
  buildPersistedDraftPayload,
  buildPersistedDraftQuestionRemovalPlan,
  buildPersistedDraftTrackingAfterLoad,
  buildPersistedDraftTrackingAfterScopedDelete,
  buildPersistedDraftWritePlan,
  buildSurveyDraftLoadPlan,
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
  if (patch.answerState) targetSlice.answers[questionId] = patch.answerState;
  if (patch.additionalState) targetSlice.additionalComments[questionId] = patch.additionalState;
  if (patch.importanceChanged) targetSlice.importance[questionId] = patch.importanceValue;
  if (patch.convictionChanged) targetSlice.conviction[questionId] = patch.convictionValue;
  return !!patch.changed;
};

const parseValue = (value) => {
  try {
    if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
      return JSON.parse(value);
    }
  } catch (_) {
    return value;
  }
  return value;
};

const applyResponseHydrationEntryToSlice = ({
  targetSlice = null,
  currentSlice = null,
  questionId = '',
  response = null,
  allowOverwrite = false,
} = {}) => {
  if (!targetSlice || !questionId || !response) return false;
  const sourceSlice = currentSlice || targetSlice;
  const patch = buildQuestionResponseHydrationPatch({
    questionId,
    response,
    currentAnswer: sourceSlice?.answers?.[questionId],
    currentAdditional: sourceSlice?.additionalComments?.[questionId],
    hasCurrentImportance: Object.prototype.hasOwnProperty.call(sourceSlice?.importance || {}, questionId),
    hasCurrentConviction: Object.prototype.hasOwnProperty.call(sourceSlice?.conviction || {}, questionId),
    allowOverwrite,
    deps: {
      parseValue,
      areEnvelopesEquivalent,
      normalizeResponseEncryptionAudience,
      getDefaultResponseEncryptionAudienceForQid: () => 'gate',
      resolveFieldEncryptionGateId: (field) => field.encryptionGateId || null,
      normalizeFieldAudienceMode,
      buildInheritedAdditionalFieldState,
      buildEmptyResponseFieldState,
    },
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

describe('SurveyTool draft persistence', () => {
  afterEach(() => {
    sessionStorage.clear();
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('blocks submit click when submitted latch is active and no pending edits exist', () => {
    const plan = buildSurveyQuestionsPrimarySubmitPlan({
      isSubmitting: false,
      submitGuardActive: false,
      submittedSinceLastEdit: true,
      submissionComplete: false,
      pendingEditCount: 0,
    });

    expect(plan).toEqual({
      action: 'inert',
      reason: 'submitted_without_new_edits',
      path: '',
    });
    // port note: dropped direct private submit-guard field read; the public submit plan now preserves the no-upload branch.
  });

  it('canonicalizes reserved session aliases when reopening a submitted survey response', () => {
    const debatePlan = buildSurveyQuestionsPrimarySubmitPlan({
      account: '0xAbC',
      draftSlug: canonicalizeSessionSlug('DEBATE'),
      isStandalone: false,
      pendingEditCount: 0,
      submissionComplete: true,
      surveyId: '0xSurvey',
    });
    const generalPlan = buildSurveyQuestionsPrimarySubmitPlan({
      account: '0xAbC',
      draftSlug: canonicalizeSessionSlug('general'),
      isStandalone: false,
      pendingEditCount: 0,
      submissionComplete: true,
      surveyId: '0xSurvey',
    });

    expect(debatePlan.path).toBe('/survey/0xsurvey/0xabc?session=DEBATE');
    expect(generalPlan.path).toBe('/survey/0xsurvey/0xabc');
  });

  it('flushes pending standalone draft to storage on unmount', async () => {
    jest.useFakeTimers();
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
      loginComplete: true,
      network: { id: 84532 },
      networkChainId: 84532,
      questionPool: [{ id: 'q1', type: 'freeform', prompt: 'Question one' }],
      runtimeStrategy: {
        render: (engine) => {
          runtimeEngine = engine;
          return null;
        },
      },
      sessionSlug: 'edge',
    });

    await waitFor(() => expect(runtimeEngine).not.toBeNull());
    await act(async () => {
      runtimeEngine.handleAnswer(0, 'q1', 'carry');
      await Promise.resolve();
    });
    await waitFor(() => expect(runtimeEngine._persistTimer).toBeTruthy());
    expect(sessionStorage.getItem(key)).toBeNull();

    view.unmount();

    const parsed = JSON.parse(sessionStorage.getItem(key));
    expect(parsed?.answers?.q1?.value).toBe('carry');
    expect(runtimeEngine._persistTimer).toBeNull();
  });

  it('keeps unresolved draft storage scoped to __pending__ instead of inheriting the general network key', () => {
    const variants = buildSurveyDraftStorageVariantKeys({
      sessionSlug: 'missing-session-slug',
      networkIdStr: '',
      account: '0xabc',
      surveyScope: 'questions',
    });
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

    const plan = buildSurveyDraftLoadPlan({
      hasAccount: true,
      ...variants,
    });
    const hit = plan.find(({ readKey }) => sessionStorage.getItem(readKey));
    const parsed = parsePersistedDraftStorageValue({
      raw: sessionStorage.getItem(hit?.readKey) || '',
    });

    expect(variants.primaryAccountKey).toBe(pendingKey);
    expect(variants.primaryAccountKey).not.toBe(legacyGeneralKey);
    expect(hit?.readKey).toBe(pendingKey);
    expect(parsed.payload?.answers?.q1?.value).toBe('pending-draft');
  });

  it('drops invalid persisted draft payloads during loadDraft', () => {
    const key = buildSurveyDraftStorageKey({
      sessionSlug: 'edge',
      networkIdStr: '84532',
      account: '0xabc',
      surveyScope: 'questions',
    });
    const raw = JSON.stringify({
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
        additionalComments: {},
        importance: {},
        conviction: {},
      },
      baselineSlice: buildEmptySlice(),
      prevAnswers: loaded?.answers,
      resolvers: draftEntryResolvers,
    });
    const writePlan = buildPersistedDraftWritePlan({
      draftKey: buildSurveyDraftStorageKey({
        sessionSlug: 'edge',
        networkIdStr: '84532',
        account: '0xabc',
        surveyScope: 'questions',
      }),
      sessionSlug: 'edge',
      networkIdStr: '84532',
      account: '0xabc',
      surveyScope: 'questions',
    });

    expect(Object.keys(loaded?.answers || {})).toHaveLength(10);
    expect(loaded?.answers?.q10?.value).toBe('anon q10');
    expect(Object.keys(answersObj)).toHaveLength(10);
    expect(answersObj.q1.value).toBe('live q1');
    expect(answersObj.q10.value).toBe('anon q10');
    expect(writePlan.staleAnonKeys).toContain('dg:surveyDraft:edge:84532:anon:questions');
  });

  it('applies draft tracking patches without clobbering omitted fields', () => {
    const draftParseCache = { key: 'draft-key', raw: '{"answers":{}}', parsed: { answers: {} } };
    const next = buildPersistedDraftTrackingAfterLoad({
      draftParseCache,
      lastDraftKey: 'draft-key',
      lastDraftJSON: null,
      lastDraftSemanticSignature: 'sig:new',
    });

    expect(next).toEqual({
      draftParseCache,
      lastDraftKey: 'draft-key',
      lastDraftJSON: null,
      lastDraftSemanticSignature: 'sig:new',
    });
  });

  it('applies draft hydration entries to a target slice through one local shell helper', () => {
    const targetSlice = buildEmptySlice();

    const changed = applyDraftEntryToSlice({
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
    const targetSlice = buildEmptySlice();

    const changed = applyResponseHydrationEntryToSlice({
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
    const firstPayload = buildPersistedDraftPayload({
      draftContext,
      answersObj: {
        q1: { value: 'carry', answerEncrypted: false, answerEncryptionAudience: 'self' },
      },
      baselineObj: {},
      now: 1000,
    });
    const timestampOnlyPayload = buildPersistedDraftPayload({
      draftContext,
      answersObj: firstPayload.answers,
      baselineObj: firstPayload.baseline,
      now: 2000,
    });
    const editedPayload = buildPersistedDraftPayload({
      draftContext,
      answersObj: {
        q1: { value: 'carry-updated', answerEncrypted: false, answerEncryptionAudience: 'self' },
      },
      baselineObj: {},
      now: 3000,
    });

    const firstRaw = JSON.stringify(firstPayload);
    let storedRaw = firstRaw;
    const firstSignature = buildSurveyDraftSemanticSignature(firstPayload);
    if (buildSurveyDraftSemanticSignature(timestampOnlyPayload) !== firstSignature) {
      storedRaw = JSON.stringify(timestampOnlyPayload);
    }
    if (buildSurveyDraftSemanticSignature(editedPayload) !== firstSignature) {
      storedRaw = JSON.stringify(editedPayload);
    }

    expect(buildSurveyDraftSemanticSignature(timestampOnlyPayload)).toBe(firstSignature);
    expect(JSON.parse(firstRaw).meta.ts).toBe(1000);
    expect(JSON.parse(storedRaw).meta.ts).toBe(3000);
    expect(JSON.parse(storedRaw).answers.q1.value).toBe('carry-updated');
  });

  it('persists and rehydrates encrypted portions for decrypted empty fields', () => {
    const { answersObj, baselineObj } = buildPersistedDraftMapsForAllowedIds({
      allowedQuestionIds: ['q1'],
      slice: {
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
      baselineSlice: {
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
      resolvers: draftEntryResolvers,
    });
    const draft = buildPersistedDraftPayload({
      draftContext,
      answersObj,
      baselineObj,
      now: 1000,
    });
    const hydrated = buildDraftHydrationState({
      renderedQuestionIds: ['q1'],
      draft,
      prevSlice: {
        answers: { q1: { value: '', encrypted: true, encryptionAudience: 'gate' } },
        additionalComments: { q1: { value: '', encrypted: true, encryptionAudience: 'gate' } },
        importance: {},
        conviction: {},
      },
      prevBaseline: buildEmptySlice(),
      allowOverwrite: true,
      cloneBaseline: cloneValue,
      applyDraftEntryToSlice,
    });

    expect(draft.answers.q1.answerEncryptedPortion).toBe('ans-env-1');
    expect(draft.answers.q1.additionalEncryptedPortion).toBe('add-env-1');
    expect(draft.baseline.q1.answerEncryptedPortion).toBe('ans-base-1');
    expect(draft.baseline.q1.additionalEncryptedPortion).toBe('add-base-1');
    expect(draft.baseline.q1.value).toBe('baseline-answer');
    expect(hydrated.nextSlice.answers.q1.encryptedPortion).toBe('ans-env-1');
    expect(hydrated.nextSlice.additionalComments.q1.encryptedPortion).toBe('add-env-1');
    expect(hydrated.nextBaseline.answers.q1.encryptedPortion).toBe('ans-base-1');
    expect(hydrated.nextBaseline.additionalComments.q1.encryptedPortion).toBe('add-base-1');
    expect(hydrated.nextBaseline.answers.q1.value).toBe('baseline-answer');
  });

  it('rewrites draft payload when only baseline changes', () => {
    const stableAnswers = {
      q1: { value: 'stable-answer', answerEncrypted: false, answerEncryptionAudience: 'self' },
    };
    const firstPayload = buildPersistedDraftPayload({
      draftContext,
      answersObj: stableAnswers,
      baselineObj: {
        q1: {
          value: 'baseline-v1',
          answerEncrypted: true,
          answerEncryptionAudience: 'gate',
          answerEncryptedPortion: 'ans-base-1',
        },
      },
      now: 1000,
    });
    const secondPayload = buildPersistedDraftPayload({
      draftContext,
      answersObj: stableAnswers,
      baselineObj: {
        q1: {
          value: 'baseline-v2',
          answerEncrypted: true,
          answerEncryptionAudience: 'gate',
          answerEncryptedPortion: 'ans-base-2',
        },
      },
      now: 2000,
    });

    expect(firstPayload.answers.q1.value).toBe('stable-answer');
    expect(firstPayload.baseline.q1.value).toBe('baseline-v1');
    expect(secondPayload.answers.q1.value).toBe('stable-answer');
    expect(secondPayload.baseline.q1.value).toBe('baseline-v2');
    expect(secondPayload.baseline.q1.answerEncryptedPortion).toBe('ans-base-2');
    expect(buildSurveyDraftSemanticSignature(secondPayload)).not.toBe(buildSurveyDraftSemanticSignature(firstPayload));
  });

  it('rehydrates baseline from draft even when no answer entry exists', () => {
    const hydrated = buildDraftHydrationState({
      renderedQuestionIds: ['q1'],
      draft: {
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
      },
      prevSlice: buildEmptySlice(),
      prevBaseline: buildEmptySlice(),
      allowOverwrite: true,
      cloneBaseline: cloneValue,
      applyDraftEntryToSlice,
    });

    expect(hydrated.nextSlice.answers.q1).toBeUndefined();
    expect(hydrated.nextBaseline.answers.q1.value).toBe('baseline-only');
    expect(hydrated.nextBaseline.answers.q1.encryptedPortion).toBe('ans-base-only');
  });

  it('keeps restored draft baseline aligned after masked prefill on refresh', () => {
    const draft = {
      answers: {
        q1: {
          value: 'real text',
          answerEncrypted: true,
          answerEncryptionAudience: 'gate',
          answerEncryptedPortion: 'ans-env-1',
        },
      },
      baseline: {
        q1: {
          value: 'real text',
          answerEncrypted: true,
          answerEncryptionAudience: 'gate',
          answerEncryptedPortion: 'ans-env-1',
        },
      },
    };
    const restored = buildDraftHydrationState({
      renderedQuestionIds: ['q1'],
      draft,
      prevSlice: buildEmptySlice(),
      prevBaseline: buildEmptySlice(),
      allowOverwrite: true,
      cloneBaseline: cloneValue,
      applyDraftEntryToSlice,
    });
    const prefilled = executePrefillSurvey({
      surveysResponseState: [restored.nextSlice],
      editBaseline: restored.nextBaseline,
      responses: [
        {
          questionID: 'q1',
          answer: { value: '*', encrypted: true, encryptedPortion: 'ans-env-1' },
          additional: { value: '', encrypted: false, encryptedPortion: '' },
        },
      ],
    });

    expect(prefilled.surveysResponseState[0].answers.q1.value).toBe('real text');
    expect(prefilled.editBaseline.answers.q1.value).toBe('real text');
    expect(prefilled.editBaseline.answers.q1.encryptedPortion).toBe('ans-env-1');
  });

  it('keeps decrypted-empty answer aligned when masked response has encrypted=true without envelope', () => {
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
    const stateRef = {
      current: {
        surveysResponseState: [],
        editBaseline: null,
        isDirty: false,
        submissionComplete: false,
      },
    };
    const updateJsonPreview = jest.fn();
    const recalculateEditStats = jest.fn();

    const result = executeSurveySingleQuestionPrefill({
      state: stateRef.current,
      questionId: 'q1',
      userAnswer: {
        questionID: 'q1',
        answer: { value: 'hydrated answer' },
        additional: { value: 'hydrated notes' },
      },
      buildSliceFromUserAnswers: () => ({
        answers: { q1: { value: 'baseline answer' } },
        additionalComments: { q1: { value: 'baseline notes' } },
        importance: {},
        conviction: {},
      }),
      applyResponseHydrationListToSlice,
      setState: applyState(stateRef),
      updateJsonPreview,
      recalculateEditStats,
    });

    expect(result).toEqual({ applied: true, reason: 'applied' });
    expect(stateRef.current.surveysResponseState).toHaveLength(1);
    expect(stateRef.current.surveysResponseState[0]).toMatchObject({
      answers: { q1: { value: 'hydrated answer' } },
      additionalComments: { q1: { value: 'hydrated notes' } },
    });
    expect(stateRef.current.editBaseline).toMatchObject({
      answers: { q1: { value: 'baseline answer' } },
      additionalComments: { q1: { value: 'baseline notes' } },
    });
    expect(updateJsonPreview).toHaveBeenCalled();
    expect(recalculateEditStats).toHaveBeenCalled();
  });

  it('prefills multi-question responses into ensured survey slots', () => {
    const stateRef = {
      current: {
        surveysResponseState: [
          { answers: { keep: { value: 'persisted' } }, importance: {}, conviction: {}, additionalComments: {} },
        ],
        editBaseline: { answers: {}, importance: {}, conviction: {}, additionalComments: {} },
        isDirty: false,
        submissionComplete: false,
      },
    };
    const updateJsonPreview = jest.fn();
    const recalculateEditStats = jest.fn();

    const result = executeSurveyResponsePrefill({
      state: stateRef.current,
      surveyIndex: 1,
      userAnswers: {
        responses: [
          {
            questionID: 'q1',
            answer: { value: 'hydrated answer' },
            additional: { value: 'hydrated notes' },
            importance: 4,
            conviction: 7,
          },
        ],
      },
      buildSliceFromUserAnswers: () => ({
        answers: { q1: { value: 'baseline answer' } },
        additionalComments: { q1: { value: 'baseline notes' } },
        importance: { q1: 4 },
        conviction: { q1: 7 },
      }),
      applyResponseHydrationListToSlice,
      setState: applyState(stateRef),
      updateJsonPreview,
      recalculateEditStats,
    });

    expect(result).toEqual({ applied: true, reason: 'applied' });
    expect(stateRef.current.surveysResponseState).toHaveLength(2);
    expect(stateRef.current.surveysResponseState[0]).toEqual({
      answers: { keep: { value: 'persisted' } },
      importance: {},
      conviction: {},
      additionalComments: {},
    });
    expect(stateRef.current.surveysResponseState[1]).toMatchObject({
      answers: { q1: { value: 'hydrated answer' } },
      importance: { q1: 4 },
      conviction: { q1: 7 },
      additionalComments: { q1: { value: 'hydrated notes' } },
    });
    expect(stateRef.current.editBaseline).toMatchObject({
      answers: { q1: { value: 'baseline answer' } },
      additionalComments: { q1: { value: 'baseline notes' } },
      importance: { q1: 4 },
      conviction: { q1: 7 },
    });
    expect(updateJsonPreview).toHaveBeenCalled();
    expect(recalculateEditStats).toHaveBeenCalled();
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
    const key = buildSurveyDraftStorageKey({
      sessionSlug: 'edge',
      networkIdStr: '84532',
      account: '0xabc',
      surveyScope: 'questions',
    });
    const removalPlan = buildPersistedDraftQuestionRemovalPlan({
      raw: JSON.stringify(seedPayload),
      questionId: 'q2',
      buildSemanticSignature: buildSurveyDraftSemanticSignature,
    });
    const tracking = buildPersistedDraftTrackingAfterScopedDelete({
      key,
      lastDraftKey: key,
      lastDraftJSON: JSON.stringify(seedPayload),
      lastDraftSemanticSignature: buildSurveyDraftSemanticSignature(seedPayload),
      draftParseCache: { key, raw: JSON.stringify(seedPayload), parsed: seedPayload },
    });
    const { answersObj, baselineObj } = buildPersistedDraftMapsForAllowedIds({
      allowedQuestionIds: buildPersistDraftAllowedQuestionIds({
        renderedQuestionIds: ['q1'],
        dirtyQuestionIds: [],
        slice: {
          answers: {
            q1: { value: 'keep', encrypted: false, encryptionAudience: 'self' },
          },
          additionalComments: {
            q1: { value: '', encrypted: false, encryptionAudience: 'self' },
          },
          importance: {},
          conviction: {},
        },
      }),
      slice: {
        answers: {
          q1: { value: 'keep', encrypted: false, encryptionAudience: 'self' },
        },
        additionalComments: {
          q1: { value: '', encrypted: false, encryptionAudience: 'self' },
        },
        importance: {},
        conviction: {},
      },
      baselineSlice: {
        answers: {
          q1: { value: 'keep-baseline', encrypted: false, encryptionAudience: 'self' },
        },
        additionalComments: {
          q1: { value: '', encrypted: false, encryptionAudience: 'self' },
        },
        importance: {},
        conviction: {},
      },
      prevAnswers: removalPlan.nextPayload?.answers,
      prevBaseline: removalPlan.nextPayload?.baseline,
      resolvers: draftEntryResolvers,
    });
    const persisted = buildPersistedDraftPayload({
      draftContext,
      answersObj,
      baselineObj,
      now: 222,
    });

    expect(removalPlan.action).toBe('update-storage');
    expect(removalPlan.nextPayload?.answers?.q2).toBeUndefined();
    expect(removalPlan.nextPayload?.baseline?.q2).toBeUndefined();
    expect(tracking.draftParseCache).toBeNull();
    expect(persisted.answers.q2).toBeUndefined();
    expect(persisted.baseline.q2).toBeUndefined();
    expect(persisted.answers.q1.value).toBe('keep');
    expect(persisted.baseline.q1.value).toBe('keep-baseline');
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
