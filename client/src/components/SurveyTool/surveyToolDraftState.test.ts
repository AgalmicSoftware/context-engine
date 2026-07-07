import {
  buildDraftAnswersByQuestionId,
  buildDraftHydrationPatchForQuestion,
  buildPersistedDraftQuestionRemovalPlan,
  buildPersistedDraftTrackingAfterLoad,
  buildPersistedDraftTrackingAfterScopedDelete,
  buildPersistedDraftTrackingAfterWrite,
  buildPersistedDraftTrackingClearedState,
  buildPersistedDraftTrackingOnKeyChange,
  buildPersistedDraftWritePlan,
  buildPersistDraftAllowedQuestionIds,
  loadPreviousPersistedDraftSnapshot,
  parsePersistedDraftStorageValue,
  buildSurveyDraftLoadPlan,
  buildPersistedDraftPayload,
  buildPersistedDraftMapsForAllowedIds,
  buildPersistedDraftQuestionEntry,
  removeQuestionFromPersistedDraftPayload,
  buildSurveyDraftCompatScope,
  buildSurveyDraftStorageKey,
  buildSurveyDraftStorageVariantKeys,
  buildSurveyDraftSemanticSignature,
  computeSubmitLabel,
  getPendingStatsSnapshotFromState,
  hasConvictionOrImportanceValueForQuestion,
  hasMeaningfulFieldValue,
  mergePersistedDraftPayloads,
  shouldAutoEncryptAdditionalOnAudienceChange,
  shouldEncryptResponseFieldForSubmit,
  shouldForceOverwriteDraftValues,
  shouldRenderInlineSubmitButton,
  shouldRenderSubmittedIndicator,
  shouldShowSingleQuestionResponseLookupSpinner,
  updateSubmittedSinceLastEdit,
} from './surveyToolDraftState.js';

describe('surveyToolDraftState', () => {
  it('recognizes meaningful field values across scalar and structured payloads', () => {
    expect(hasMeaningfulFieldValue({ value: '' })).toBe(false);
    expect(hasMeaningfulFieldValue({ value: '   ' })).toBe(false);
    expect(hasMeaningfulFieldValue({ value: [] })).toBe(false);
    expect(hasMeaningfulFieldValue({ value: {} })).toBe(false);
    expect(hasMeaningfulFieldValue({ value: '*' })).toBe(true);
    expect(hasMeaningfulFieldValue({ value: false })).toBe(true);
    expect(hasMeaningfulFieldValue({ value: 0 })).toBe(true);
    expect(hasMeaningfulFieldValue({ value: ['x'] })).toBe(true);
    expect(hasMeaningfulFieldValue({ value: { nested: true } })).toBe(true);
  });

  it('snapshots pending edit stats from component state', () => {
    expect(
      getPendingStatsSnapshotFromState({
        modifiedCount: '3',
        encryptedModifiedCount: '2',
      }),
    ).toEqual({
      total: 3,
      encrypted: 2,
    });
  });

  it('builds submit labels from provided stats, callback stats, and state fallbacks', () => {
    expect(
      computeSubmitLabel(
        {},
        {
          suffix: 'Responses',
          pendingStats: { total: 2, encrypted: 1 },
        },
      ),
    ).toBe('Submit Responses (2)');

    expect(
      computeSubmitLabel(
        {
          getPendingEditStats: () => ({ total: 1, encrypted: 0 }),
        },
        {
          suffix: 'Response',
        },
      ),
    ).toBe('Submit Response (1)');

    expect(
      computeSubmitLabel({
        state: { modifiedCount: 0, encryptedModifiedCount: 0 },
      }),
    ).toBe('Submit');
  });

  it('does not auto-encrypt empty additional comments when answer audience changes', () => {
    expect(shouldAutoEncryptAdditionalOnAudienceChange({ value: '', encrypted: false })).toBe(false);
    expect(shouldAutoEncryptAdditionalOnAudienceChange({ value: '   ', encrypted: false })).toBe(false);
    expect(shouldAutoEncryptAdditionalOnAudienceChange({ value: 'context', encrypted: false })).toBe(true);
  });

  it('builds persisted draft entries only when answer/additional/slider content is meaningful', () => {
    const resolvers = {
      resolveFieldEncryptionAudience: jest.fn((field, qid, fieldKey) =>
        fieldKey === 'additional' ? `${qid}:additional` : `${qid}:answer`,
      ),
      resolveFieldEncryptionGateId: jest.fn((_field, qid, fieldKey) =>
        fieldKey === 'additional' ? `${qid}:gate:add` : `${qid}:gate:answer`,
      ),
      normalizeFieldAudienceMode: jest.fn(
        (mode, fieldKey) => mode || (fieldKey === 'additional' ? 'inherit' : 'explicit'),
      ),
    };

    expect(
      buildPersistedDraftQuestionEntry({
        questionId: 'q1',
        answer: { value: '' },
        additional: { value: '' },
        importance: null,
        conviction: null,
        resolvers,
      }),
    ).toBeNull();

    expect(
      buildPersistedDraftQuestionEntry({
        questionId: 'Q1',
        answer: { value: 'hello', encrypted: true, encryptedPortion: 'ans-env', audienceMode: 'explicit' },
        additional: { value: 'notes', encrypted: true, encryptedPortion: 'add-env', audienceMode: 'inherit' },
        importance: 4,
        conviction: 7,
        resolvers,
      }),
    ).toEqual({
      value: 'hello',
      answerEncrypted: true,
      answerEncryptionAudience: 'q1:answer',
      answerEncryptionGateId: 'q1:gate:answer',
      answerAudienceMode: 'explicit',
      answerEncryptedPortion: 'ans-env',
      additional: 'notes',
      additionalEncrypted: true,
      additionalEncryptionAudience: 'q1:additional',
      additionalEncryptionGateId: 'q1:gate:add',
      additionalAudienceMode: 'inherit',
      additionalEncryptedPortion: 'add-env',
      importance: 4,
      conviction: 7,
    });
  });

  it('builds persisted draft maps by preserving previous non-rendered entries and replacing allowed ids', () => {
    const resolvers = {
      resolveFieldEncryptionAudience: jest.fn((_field, qid, fieldKey) =>
        fieldKey === 'additional' ? `${qid}:additional` : `${qid}:answer`,
      ),
      resolveFieldEncryptionGateId: jest.fn((_field, qid, fieldKey) =>
        fieldKey === 'additional' ? `${qid}:gate:add` : `${qid}:gate:answer`,
      ),
      normalizeFieldAudienceMode: jest.fn(
        (mode, fieldKey) => mode || (fieldKey === 'additional' ? 'inherit' : 'explicit'),
      ),
    };

    expect(
      buildPersistedDraftMapsForAllowedIds({
        allowedQuestionIds: ['q1'],
        slice: {
          answers: { q1: { value: '' } },
          additionalComments: { q1: { value: '' } },
          importance: {},
          conviction: {},
        },
        baselineSlice: {
          answers: { q1: { value: 'baseline answer' } },
          additionalComments: {},
          importance: {},
          conviction: {},
        },
        prevAnswers: {
          q1: { value: 'stale rendered answer' },
          q2: { value: 'keep me' },
        },
        prevBaseline: {
          q1: { value: 'stale baseline' },
          q2: { value: 'keep baseline' },
        },
        resolvers,
      }),
    ).toEqual({
      answersObj: {
        q2: { value: 'keep me' },
      },
      baselineObj: {
        q1: {
          value: 'baseline answer',
          answerEncrypted: undefined,
          answerEncryptionAudience: 'q1:answer',
          answerEncryptionGateId: 'q1:gate:answer',
          answerAudienceMode: 'explicit',
          additional: undefined,
          additionalEncrypted: undefined,
          additionalEncryptionAudience: 'q1:additional',
          additionalEncryptionGateId: 'q1:gate:add',
          additionalAudienceMode: 'inherit',
          importance: null,
          conviction: null,
        },
        q2: { value: 'keep baseline' },
      },
    });
  });

  it('derives persistable draft question ids from rendered, dirty, or slice-backed questions', () => {
    expect(
      buildPersistDraftAllowedQuestionIds({
        renderedQuestionIds: ['Q1', 'q2'],
        dirtyQuestionIds: ['q2', 'q3'],
        slice: {
          answers: { q4: { value: 'unused because rendered ids exist' } },
        },
      }),
    ).toEqual(['q1', 'q2', 'q3']);

    expect(
      buildPersistDraftAllowedQuestionIds({
        renderedQuestionIds: [],
        dirtyQuestionIds: [],
        slice: {
          answers: { Q1: { value: 'hello' } },
          additionalComments: { q2: { value: 'notes' } },
          importance: { q3: 4 },
          conviction: { q4: 7 },
        },
      }),
    ).toEqual(['q1', 'q2', 'q3', 'q4']);
  });

  it('builds persisted draft payload metadata for survey and single-question modes', () => {
    expect(
      buildPersistedDraftPayload({
        draftContext: { networkId: 84532 },
        singleQuestionMode: false,
        surveyId: 'survey-1',
        answersObj: { q1: { value: 'hello' } },
        baselineObj: { q1: { value: 'baseline' } },
        now: 12345,
      }),
    ).toEqual({
      meta: {
        networkId: 84532,
        surveyId: 'survey-1',
        ts: 12345,
      },
      answers: { q1: { value: 'hello' } },
      baseline: { q1: { value: 'baseline' } },
    });

    expect(
      buildPersistedDraftPayload({
        draftContext: { networkId: 84532 },
        singleQuestionMode: true,
        questionId: 'question-1',
        answersObj: {},
        baselineObj: {},
        now: 67890,
      }),
    ).toEqual({
      meta: {
        networkId: 84532,
        surveyId: 'question-1',
        ts: 67890,
      },
      answers: {},
      baseline: {},
    });
  });

  it('builds draft storage keys and variant bundles for cleanup and migration flows', () => {
    expect(buildSurveyDraftCompatScope('questions:q:q1')).toBe('questions');
    expect(buildSurveyDraftCompatScope('survey:survey-1')).toBe('survey:survey-1');

    expect(
      buildSurveyDraftStorageKey({
        sessionSlug: 'demo-slug',
        networkIdStr: '__pending__',
        account: '0xAbC',
        surveyScope: 'questions:q:q1',
      }),
    ).toBe('dg:surveyDraft:demo-slug:__pending__:0xabc:questions:q:q1');

    expect(
      buildSurveyDraftStorageVariantKeys({
        sessionSlug: 'demo-slug',
        networkIdStr: '84532',
        account: '0xAbC',
        surveyScope: 'questions:q:q1',
        questionId: 'Q1',
        includePerQuestionScope: true,
      }),
    ).toEqual({
      accountOwner: '0xabc',
      baseNetworkIdStr: '84532',
      compatScope: 'questions',
      perQuestionScope: 'questions:q:q1',
      primaryAccountKey: 'dg:surveyDraft:demo-slug:84532:0xabc:questions:q:q1',
      primaryAnonKey: 'dg:surveyDraft:demo-slug:84532:anon:questions:q:q1',
      compatAccountKey: 'dg:surveyDraft:demo-slug:84532:0xabc:questions',
      compatAnonKey: 'dg:surveyDraft:demo-slug:84532:anon:questions',
      pendingAccountKey: 'dg:surveyDraft:demo-slug:__pending__:0xabc:questions:q:q1',
      perQuestionAccountKey: 'dg:surveyDraft:demo-slug:84532:0xabc:questions:q:q1',
      perQuestionAnonKey: 'dg:surveyDraft:demo-slug:84532:anon:questions:q:q1',
      purgeKeys: [
        'dg:surveyDraft:demo-slug:__pending__:0xabc:questions:q:q1',
        'dg:surveyDraft:demo-slug:__pending__:0xabc:questions',
        'dg:surveyDraft:demo-slug:__pending__:anon:questions:q:q1',
        'dg:surveyDraft:demo-slug:__pending__:anon:questions',
        'dg:surveyDraft:demo-slug:84532:0xabc:questions:q:q1',
        'dg:surveyDraft:demo-slug:84532:0xabc:questions',
        'dg:surveyDraft:demo-slug:84532:anon:questions:q:q1',
        'dg:surveyDraft:demo-slug:84532:anon:questions',
      ],
    });

    expect(
      buildSurveyDraftStorageVariantKeys({
        sessionSlug: 'demo-slug',
        surveyScope: 'questions',
        questionId: 'Q2',
        includePerQuestionScope: true,
      }),
    ).toEqual({
      accountOwner: 'anon',
      baseNetworkIdStr: '__pending__',
      compatScope: 'questions',
      perQuestionScope: 'questions:q:q2',
      primaryAccountKey: 'dg:surveyDraft:demo-slug:__pending__:anon:questions',
      primaryAnonKey: 'dg:surveyDraft:demo-slug:__pending__:anon:questions',
      compatAccountKey: 'dg:surveyDraft:demo-slug:__pending__:anon:questions',
      compatAnonKey: 'dg:surveyDraft:demo-slug:__pending__:anon:questions',
      pendingAccountKey: 'dg:surveyDraft:demo-slug:__pending__:anon:questions',
      perQuestionAccountKey: 'dg:surveyDraft:demo-slug:__pending__:anon:questions:q:q2',
      perQuestionAnonKey: 'dg:surveyDraft:demo-slug:__pending__:anon:questions:q:q2',
      purgeKeys: [
        'dg:surveyDraft:demo-slug:__pending__:anon:questions',
        'dg:surveyDraft:demo-slug:__pending__:anon:questions:q:q2',
      ],
    });
  });

  it('builds draft load plans that preserve account and anon migration precedence', () => {
    expect(
      buildSurveyDraftLoadPlan({
        hasAccount: true,
        primaryAccountKey: 'acct',
        primaryAnonKey: 'anon',
        compatAccountKey: 'acct-compat',
        compatAnonKey: 'anon-compat',
        pendingAccountKey: 'pending',
        perQuestionAccountKey: 'acct-q',
        perQuestionAnonKey: 'anon-q',
      }),
    ).toEqual([
      { readKey: 'acct', writeKey: null },
      { readKey: 'acct-compat', writeKey: 'acct' },
      { readKey: 'pending', writeKey: 'acct' },
      { readKey: 'acct-q', writeKey: 'acct' },
      { readKey: 'anon', writeKey: 'acct' },
      { readKey: 'anon-compat', writeKey: 'acct' },
      { readKey: 'anon-q', writeKey: 'acct' },
    ]);

    expect(
      buildSurveyDraftLoadPlan({
        hasAccount: false,
        primaryAnonKey: 'anon',
        compatAnonKey: 'anon-compat',
        pendingAccountKey: 'pending',
        perQuestionAnonKey: 'anon-q',
      }),
    ).toEqual([
      { readKey: 'anon', writeKey: null },
      { readKey: 'anon-compat', writeKey: 'anon' },
      { readKey: 'pending', writeKey: 'anon' },
      { readKey: 'anon-q', writeKey: 'anon' },
    ]);
  });

  it('builds per-question draft hydration patches with overwrite and inherit handling', () => {
    const deps = {
      normalizeResponseEncryptionAudience: jest.fn((audience) => audience || 'self'),
      normalizeFieldAudienceMode: jest.fn((mode) => mode || 'explicit'),
      buildInheritedAdditionalFieldState: jest.fn((additionalState, answerState) => ({
        ...additionalState,
        inheritedFromAnswer: answerState?.value || null,
      })),
      buildEmptyResponseFieldState: jest.fn(() => ({ value: '', encrypted: false })),
    };

    expect(
      buildDraftHydrationPatchForQuestion({
        questionId: 'Q1',
        draftEntry: {
          value: 'draft answer',
          answerEncrypted: true,
          answerEncryptionAudience: 'gate',
          answerEncryptedPortion: 'ans-env-1',
          additional: 'draft notes',
          additionalEncrypted: true,
          additionalEncryptionAudience: 'gate',
          additionalAudienceMode: 'inherit',
          additionalEncryptedPortion: 'add-env-1',
          importance: 4,
          conviction: 7,
        },
        currentAnswer: { value: '' },
        currentAdditional: { value: '' },
        hasCurrentImportance: false,
        hasCurrentConviction: false,
        allowOverwrite: false,
        deps,
      }),
    ).toEqual({
      changed: true,
      answerState: {
        value: 'draft answer',
        encrypted: true,
        encryptionAudience: 'gate',
        encryptionGateId: null,
        audienceMode: 'explicit',
        encryptedPortion: 'ans-env-1',
      },
      additionalState: {
        value: 'draft notes',
        encrypted: true,
        encryptionAudience: 'gate',
        encryptionGateId: null,
        audienceMode: 'inherit',
        encryptedPortion: 'add-env-1',
        inheritedFromAnswer: 'draft answer',
      },
      importanceChanged: true,
      importanceValue: 4,
      convictionChanged: true,
      convictionValue: 7,
    });

    expect(
      buildDraftHydrationPatchForQuestion({
        questionId: 'q1',
        draftEntry: {
          value: 'draft answer',
          additional: 'draft notes',
          importance: 4,
          conviction: 7,
        },
        currentAnswer: { value: 'keep me' },
        currentAdditional: { value: 'keep notes' },
        hasCurrentImportance: true,
        hasCurrentConviction: true,
        allowOverwrite: false,
        deps,
      }),
    ).toEqual({
      changed: false,
      answerState: undefined,
      additionalState: undefined,
      importanceChanged: false,
      importanceValue: undefined,
      convictionChanged: false,
      convictionValue: undefined,
    });
  });

  it('builds normalized draft-answer maps from persisted draft payloads', () => {
    expect(
      buildDraftAnswersByQuestionId({
        answers: {
          Q1: { value: 'first' },
          q1: { value: 'ignored duplicate' },
          q2: { value: 'second' },
          empty: null,
        },
      }),
    ).toEqual({
      q1: { value: 'first' },
      q2: { value: 'second' },
    });

    expect(buildDraftAnswersByQuestionId(null)).toEqual({});
  });

  it('merges account and anonymous drafts without dropping richer unanswered-window entries', () => {
    const merged = mergePersistedDraftPayloads({
      drafts: [
        {
          meta: { networkId: 84532, surveyId: '0xsurvey', ts: 100 },
          answers: {
            q1: { value: 'account newer old q1' },
            q2: { value: 'account q2' },
            q3: { value: 'account q3' },
          },
          baseline: {
            q1: { value: 'account baseline q1' },
          },
        },
        {
          meta: { networkId: 84532, surveyId: '0xsurvey', ts: 200 },
          answers: Object.fromEntries(
            Array.from({ length: 10 }, (_, index) => {
              const qid = `q${index + 1}`;
              return [qid, { value: `anon ${qid}` }];
            }),
          ),
          baseline: {
            q10: { value: 'anon baseline q10' },
          },
        },
      ],
    });

    expect(Object.keys(merged?.answers || {})).toHaveLength(10);
    expect(merged?.answers?.q1).toEqual({ value: 'anon q1' });
    expect(merged?.answers?.q3).toEqual({ value: 'anon q3' });
    expect(merged?.answers?.q10).toEqual({ value: 'anon q10' });
    expect(merged?.baseline?.q1).toEqual({ value: 'account baseline q1' });
    expect(merged?.baseline?.q10).toEqual({ value: 'anon baseline q10' });
    expect(merged?.meta?.ts).toBe(200);
  });

  it('builds persisted draft write plans for compat mirror writes and anon cleanup', () => {
    expect(
      buildPersistedDraftWritePlan({
        draftKey: 'dg:surveyDraft:demo:84532:0xabc:questions:q:q1',
        sessionSlug: 'demo',
        networkIdStr: '84532',
        account: '0xabc',
        surveyScope: 'questions:q:q1',
        singleQuestionMode: true,
      }),
    ).toEqual({
      compatWriteKey: 'dg:surveyDraft:demo:84532:0xabc:questions',
      staleAnonKeys: ['dg:surveyDraft:demo:84532:anon:questions:q:q1', 'dg:surveyDraft:demo:84532:anon:questions'],
    });

    expect(
      buildPersistedDraftWritePlan({
        draftKey: 'dg:surveyDraft:demo:84532:anon:questions',
        sessionSlug: 'demo',
        networkIdStr: '84532',
        account: '',
        surveyScope: 'questions',
        singleQuestionMode: false,
      }),
    ).toEqual({
      compatWriteKey: null,
      staleAnonKeys: [],
    });
  });

  it('loads previous persisted draft snapshots from cache, storage, and malformed inputs', () => {
    const buildSemanticSignature = jest.fn((payload) => JSON.stringify(payload));
    const removeDraftRaw = jest.fn();

    expect(
      loadPreviousPersistedDraftSnapshot(
        {
          key: 'draft-key',
          lastDraftKey: 'draft-key',
          lastDraftJSON: '{"answers":{"q1":{"value":"cached"}}}',
          lastDraftSemanticSignature: 'cached-signature',
          draftParseCache: {
            key: 'draft-key',
            raw: '{"answers":{"q1":{"value":"cached"}}}',
            parsed: {
              answers: { q1: { value: 'cached' } },
              baseline: { q1: { value: 'baseline-cached' } },
            },
          },
        },
        {
          readDraftRaw: jest.fn(),
          removeDraftRaw,
          buildSemanticSignature,
        },
      ),
    ).toEqual({
      prevAnswers: { q1: { value: 'cached' } },
      prevBaseline: { q1: { value: 'baseline-cached' } },
      prevDraftRaw: '{"answers":{"q1":{"value":"cached"}}}',
      prevSemanticSignature: 'cached-signature',
      nextDraftParseCache: {
        key: 'draft-key',
        raw: '{"answers":{"q1":{"value":"cached"}}}',
        parsed: {
          answers: { q1: { value: 'cached' } },
          baseline: { q1: { value: 'baseline-cached' } },
        },
      },
      shouldResetDraftTracking: false,
    });

    const readDraftRaw = jest.fn(
      () => '{"answers":{"q2":{"value":"stored"}},"baseline":{"q2":{"value":"baseline-stored"}}}',
    );
    expect(
      loadPreviousPersistedDraftSnapshot(
        {
          key: 'draft-key',
          lastDraftKey: 'other-key',
          lastDraftJSON: null,
          lastDraftSemanticSignature: null,
          draftParseCache: null,
        },
        {
          readDraftRaw,
          removeDraftRaw,
          buildSemanticSignature,
        },
      ),
    ).toEqual({
      prevAnswers: { q2: { value: 'stored' } },
      prevBaseline: { q2: { value: 'baseline-stored' } },
      prevDraftRaw: '{"answers":{"q2":{"value":"stored"}},"baseline":{"q2":{"value":"baseline-stored"}}}',
      prevSemanticSignature: '{"answers":{"q2":{"value":"stored"}},"baseline":{"q2":{"value":"baseline-stored"}}}',
      nextDraftParseCache: {
        key: 'draft-key',
        raw: '{"answers":{"q2":{"value":"stored"}},"baseline":{"q2":{"value":"baseline-stored"}}}',
        parsed: {
          answers: { q2: { value: 'stored' } },
          baseline: { q2: { value: 'baseline-stored' } },
        },
      },
      shouldResetDraftTracking: false,
    });

    expect(
      loadPreviousPersistedDraftSnapshot(
        {
          key: 'draft-key',
          draftParseCache: null,
        },
        {
          readDraftRaw: jest.fn(() => '{"baseline":{"q3":{"value":"baseline-only"}}}'),
          removeDraftRaw,
          buildSemanticSignature,
        },
      ),
    ).toEqual({
      prevAnswers: {},
      prevBaseline: { q3: { value: 'baseline-only' } },
      prevDraftRaw: '{"baseline":{"q3":{"value":"baseline-only"}}}',
      prevSemanticSignature: '{"baseline":{"q3":{"value":"baseline-only"}}}',
      nextDraftParseCache: {
        key: 'draft-key',
        raw: '{"baseline":{"q3":{"value":"baseline-only"}}}',
        parsed: {
          baseline: { q3: { value: 'baseline-only' } },
        },
      },
      shouldResetDraftTracking: false,
    });

    expect(
      loadPreviousPersistedDraftSnapshot(
        {
          key: 'draft-key',
          draftParseCache: null,
        },
        {
          readDraftRaw: jest.fn(() => '{broken-json'),
          removeDraftRaw,
          buildSemanticSignature,
        },
      ),
    ).toEqual({
      prevAnswers: {},
      prevBaseline: {},
      prevDraftRaw: '',
      prevSemanticSignature: null,
      nextDraftParseCache: null,
      shouldResetDraftTracking: true,
    });
    expect(removeDraftRaw).toHaveBeenCalledWith('draft-key');
  });

  it('parses persisted draft storage values and rejects invalid payloads', () => {
    expect(parsePersistedDraftStorageValue()).toEqual({
      status: 'empty',
      payload: null,
      raw: '',
    });

    expect(
      parsePersistedDraftStorageValue({
        raw: '{"answers":{"q1":{"value":"hello"}},"baseline":{"q1":{"value":"base"}}}',
      }),
    ).toEqual({
      status: 'valid',
      payload: {
        answers: { q1: { value: 'hello' } },
        baseline: { q1: { value: 'base' } },
      },
      raw: '{"answers":{"q1":{"value":"hello"}},"baseline":{"q1":{"value":"base"}}}',
    });

    expect(
      parsePersistedDraftStorageValue({
        raw: '{"baseline":{"q1":{"value":"base"}}}',
      }),
    ).toEqual({
      status: 'invalid',
      payload: null,
      raw: '{"baseline":{"q1":{"value":"base"}}}',
    });

    expect(
      parsePersistedDraftStorageValue({
        raw: '{"baseline":{"q1":{"value":"base"}}}',
        requireAnswers: false,
      }),
    ).toEqual({
      status: 'valid',
      payload: {
        baseline: { q1: { value: 'base' } },
      },
      raw: '{"baseline":{"q1":{"value":"base"}}}',
    });

    expect(
      parsePersistedDraftStorageValue({
        raw: '{broken-json',
      }),
    ).toEqual({
      status: 'invalid',
      payload: null,
      raw: '{broken-json',
    });
  });

  it('builds persisted draft tracking transitions for key changes, loads, writes, and deletes', () => {
    expect(
      buildPersistedDraftTrackingOnKeyChange({
        nextDraftKey: 'draft-key',
        lastDraftKey: 'draft-key',
        lastDraftJSON: '{"answers":{}}',
        lastDraftSemanticSignature: 'sig:same',
        draftParseCache: { key: 'draft-key', raw: '{"answers":{}}', parsed: { answers: {} } },
      }),
    ).toEqual({
      lastDraftKey: 'draft-key',
      lastDraftJSON: '{"answers":{}}',
      lastDraftSemanticSignature: 'sig:same',
      draftParseCache: { key: 'draft-key', raw: '{"answers":{}}', parsed: { answers: {} } },
      didSwitchKey: false,
    });

    expect(
      buildPersistedDraftTrackingOnKeyChange({
        nextDraftKey: 'next-key',
        lastDraftKey: 'prev-key',
        lastDraftJSON: '{"answers":{"q1":{"value":"stale"}}}',
        lastDraftSemanticSignature: 'sig:stale',
        draftParseCache: {
          key: 'prev-key',
          raw: '{"answers":{"q1":{"value":"stale"}}}',
          parsed: { answers: { q1: { value: 'stale' } } },
        },
      }),
    ).toEqual({
      lastDraftKey: 'next-key',
      lastDraftJSON: null,
      lastDraftSemanticSignature: null,
      draftParseCache: {
        key: 'prev-key',
        raw: '{"answers":{"q1":{"value":"stale"}}}',
        parsed: { answers: { q1: { value: 'stale' } } },
      },
      didSwitchKey: true,
    });

    expect(
      buildPersistedDraftTrackingAfterLoad({
        lastDraftKey: 'draft-key',
        lastDraftJSON: '{"answers":{}}',
        lastDraftSemanticSignature: 'sig:old',
        draftParseCache: null,
        nextDraftParseCache: {
          key: 'draft-key',
          raw: '{"answers":{"q1":{"value":"new"}}}',
          parsed: { answers: { q1: { value: 'new' } } },
        },
        shouldResetDraftTracking: true,
      }),
    ).toEqual({
      lastDraftKey: 'draft-key',
      lastDraftJSON: null,
      lastDraftSemanticSignature: null,
      draftParseCache: {
        key: 'draft-key',
        raw: '{"answers":{"q1":{"value":"new"}}}',
        parsed: { answers: { q1: { value: 'new' } } },
      },
    });

    expect(
      buildPersistedDraftTrackingAfterWrite({
        key: 'draft-key',
        raw: '{"answers":{"q1":{"value":"hello"}}}',
        payload: { answers: { q1: { value: 'hello' } } },
        semanticSignature: 'sig:new',
      }),
    ).toEqual({
      lastDraftKey: 'draft-key',
      lastDraftJSON: '{"answers":{"q1":{"value":"hello"}}}',
      lastDraftSemanticSignature: 'sig:new',
      draftParseCache: {
        key: 'draft-key',
        raw: '{"answers":{"q1":{"value":"hello"}}}',
        parsed: { answers: { q1: { value: 'hello' } } },
      },
    });

    expect(
      buildPersistedDraftTrackingAfterScopedDelete({
        key: 'draft-key',
        lastDraftKey: 'draft-key',
        lastDraftJSON: '{"answers":{"q1":{"value":"hello"}}}',
        lastDraftSemanticSignature: 'sig:new',
        draftParseCache: {
          key: 'draft-key',
          raw: '{"answers":{"q1":{"value":"hello"}}}',
          parsed: { answers: { q1: { value: 'hello' } } },
        },
      }),
    ).toEqual({
      lastDraftKey: 'draft-key',
      lastDraftJSON: null,
      lastDraftSemanticSignature: null,
      draftParseCache: null,
    });

    expect(buildPersistedDraftTrackingClearedState()).toEqual({
      lastDraftKey: '',
      lastDraftJSON: null,
      lastDraftSemanticSignature: null,
      draftParseCache: null,
    });
  });

  it('builds persisted draft question removal plans for invalid, delete, update, and keep cases', () => {
    expect(
      buildPersistedDraftQuestionRemovalPlan({
        raw: '{broken-json',
        questionId: 'q1',
      }),
    ).toEqual({
      action: 'delete-storage',
      removed: false,
      nextPayload: null,
      nextJson: null,
      nextSemanticSignature: null,
    });

    expect(
      buildPersistedDraftQuestionRemovalPlan({
        raw: JSON.stringify({
          answers: {
            q1: { value: 'hello' },
          },
          baseline: {
            q1: { value: 'baseline hello' },
          },
        }),
        questionId: 'q1',
      }),
    ).toEqual({
      action: 'delete-storage',
      removed: true,
      nextPayload: null,
      nextJson: null,
      nextSemanticSignature: null,
    });

    const buildSemanticSignature = jest.fn((payload) => `sig:${JSON.stringify(payload)}`);
    const updatedPayload = {
      answers: {
        q2: { value: 'keep' },
      },
      baseline: {
        q2: { value: 'baseline keep' },
      },
    };
    expect(
      buildPersistedDraftQuestionRemovalPlan({
        raw: JSON.stringify({
          answers: {
            q1: { value: 'hello' },
            q2: { value: 'keep' },
          },
          baseline: {
            q1: { value: 'baseline hello' },
            q2: { value: 'baseline keep' },
          },
        }),
        questionId: 'q1',
        buildSemanticSignature,
      }),
    ).toEqual({
      action: 'update-storage',
      removed: true,
      nextPayload: updatedPayload,
      nextJson: JSON.stringify(updatedPayload),
      nextSemanticSignature: `sig:${JSON.stringify(updatedPayload)}`,
    });

    expect(
      buildPersistedDraftQuestionRemovalPlan({
        raw: JSON.stringify({
          answers: {
            q2: { value: 'keep' },
          },
        }),
        questionId: 'q1',
      }),
    ).toEqual({
      action: 'keep',
      removed: false,
      nextPayload: {
        answers: {
          q2: { value: 'keep' },
        },
      },
      nextJson: null,
      nextSemanticSignature: null,
    });
  });

  it('removes a single question from persisted draft payloads and deletes empty drafts', () => {
    expect(
      removeQuestionFromPersistedDraftPayload({
        draftPayload: {
          answers: {
            q1: { value: 'hello' },
            q2: { value: 'keep' },
          },
          baseline: {
            q1: { value: 'baseline hello' },
            q2: { value: 'baseline keep' },
          },
        },
        questionId: 'Q1',
      }),
    ).toEqual({
      action: 'update',
      nextPayload: {
        answers: {
          q2: { value: 'keep' },
        },
        baseline: {
          q2: { value: 'baseline keep' },
        },
      },
      removed: true,
    });

    expect(
      removeQuestionFromPersistedDraftPayload({
        draftPayload: {
          answers: {
            q1: { value: 'hello' },
          },
          baseline: {
            q1: { value: 'baseline hello' },
          },
        },
        questionId: 'q1',
      }),
    ).toEqual({
      action: 'delete',
      nextPayload: null,
      removed: true,
    });

    expect(
      removeQuestionFromPersistedDraftPayload({
        draftPayload: {
          answers: {
            q2: { value: 'keep' },
          },
        },
        questionId: 'q1',
      }),
    ).toEqual({
      action: 'keep',
      nextPayload: {
        answers: {
          q2: { value: 'keep' },
        },
      },
      removed: false,
    });
  });

  it('does not include empty additional comments in submit-time encryption work', () => {
    expect(shouldEncryptResponseFieldForSubmit({ value: '', encrypted: true })).toBe(false);
    expect(shouldEncryptResponseFieldForSubmit({ value: '   ', encrypted: true })).toBe(false);
    expect(shouldEncryptResponseFieldForSubmit({ value: '*', encrypted: true })).toBe(false);
    expect(shouldEncryptResponseFieldForSubmit({ value: 'notes', encrypted: true })).toBe(true);
  });

  it('allows draft force-overwrite unless the submitted latch is active without edits', () => {
    expect(
      shouldForceOverwriteDraftValues({
        forceOverwrite: true,
        isDirty: false,
        pendingTotal: 0,
        submittedStateActive: false,
      }),
    ).toBe(true);
    expect(
      shouldForceOverwriteDraftValues({
        forceOverwrite: true,
        isDirty: false,
        pendingTotal: 0,
        submittedStateActive: true,
      }),
    ).toBe(false);
    expect(shouldForceOverwriteDraftValues({ forceOverwrite: true, isDirty: true, pendingTotal: 0 })).toBe(true);
    expect(shouldForceOverwriteDraftValues({ forceOverwrite: true, isDirty: false, pendingTotal: 1 })).toBe(true);
    expect(shouldForceOverwriteDraftValues({ forceOverwrite: false, isDirty: true, pendingTotal: 2 })).toBe(false);
  });

  it('updates submitted latch across submit/edit/reset transitions', () => {
    expect(updateSubmittedSinceLastEdit(false, 'submit_success')).toBe(true);
    expect(updateSubmittedSinceLastEdit(true, 'user_edit')).toBe(false);
    expect(updateSubmittedSinceLastEdit(true, 'reset')).toBe(false);
    expect(updateSubmittedSinceLastEdit(true, 'submit_error')).toBe(false);
    expect(updateSubmittedSinceLastEdit(true, 'unknown')).toBe(true);
  });

  it('detects conviction/importance active state from response-map presence', () => {
    expect(
      hasConvictionOrImportanceValueForQuestion(
        {
          conviction: { q1: 0 },
          importance: {},
        },
        'q1',
      ),
    ).toBe(true);
    expect(
      hasConvictionOrImportanceValueForQuestion(
        {
          conviction: {},
          importance: { q1: 5 },
        },
        'q1',
      ),
    ).toBe(true);
    expect(
      hasConvictionOrImportanceValueForQuestion(
        {
          conviction: { q1: null },
          importance: {},
        },
        'q1',
      ),
    ).toBe(false);
    expect(
      hasConvictionOrImportanceValueForQuestion(
        {
          conviction: {},
          importance: {},
        },
        'q1',
      ),
    ).toBe(false);
  });

  it('shows single-question response lookup spinner only while response probing is active', () => {
    expect(
      shouldShowSingleQuestionResponseLookupSpinner({
        singleQuestionMode: true,
        isLoadingResponse: true,
        account: '0xabc',
      }),
    ).toBe(true);

    expect(
      shouldShowSingleQuestionResponseLookupSpinner({
        singleQuestionMode: true,
        isLoadingResponse: true,
        responderAddress: '0xdef',
      }),
    ).toBe(true);

    expect(
      shouldShowSingleQuestionResponseLookupSpinner({
        singleQuestionMode: true,
        isLoadingResponse: false,
        account: '0xabc',
      }),
    ).toBe(false);

    expect(
      shouldShowSingleQuestionResponseLookupSpinner({
        singleQuestionMode: false,
        isLoadingResponse: true,
        account: '0xabc',
      }),
    ).toBe(false);
  });

  it('hides inline submit until at least one answer change is pending', () => {
    expect(
      shouldRenderInlineSubmitButton({
        useHeaderSubmit: false,
        canEditQuestions: true,
        hasPendingEdits: false,
        submittedStateActive: false,
        isLoadingResponse: false,
      }),
    ).toBe(false);

    expect(
      shouldRenderInlineSubmitButton({
        useHeaderSubmit: false,
        canEditQuestions: true,
        hasPendingEdits: true,
        submittedStateActive: false,
        isLoadingResponse: false,
      }),
    ).toBe(true);
  });

  it('does not render submitted indicator while response loading is in progress', () => {
    expect(
      shouldRenderSubmittedIndicator({
        submittedStateActive: true,
        isLoadingResponse: true,
      }),
    ).toBe(false);

    expect(
      shouldRenderSubmittedIndicator({
        submittedStateActive: true,
        isLoadingResponse: false,
      }),
    ).toBe(true);
  });

  it('keeps draft semantic signature stable when only meta timestamp changes', () => {
    const base = {
      meta: { networkId: 84532, surveyId: 'questions', ts: 100 },
      answers: {
        q1: {
          value: 'hello',
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
    const next = {
      ...base,
      meta: { ...base.meta, ts: 999999 },
    };

    expect(buildSurveyDraftSemanticSignature(next)).toBe(buildSurveyDraftSemanticSignature(base));
  });

  it('treats encrypted-portion changes as semantic draft changes', () => {
    const base = {
      meta: { networkId: 84532, surveyId: 'questions', ts: 100 },
      answers: {
        q1: {
          value: '',
          answerEncrypted: true,
          answerEncryptionAudience: 'gate',
          additional: '',
          additionalEncrypted: true,
          additionalEncryptionAudience: 'gate',
          importance: null,
          conviction: null,
        },
      },
    };
    const next = {
      ...base,
      answers: {
        q1: {
          ...base.answers.q1,
          answerEncryptedPortion: 'ans-env-1',
          additionalEncryptedPortion: 'add-env-1',
        },
      },
    };

    expect(buildSurveyDraftSemanticSignature(next)).not.toBe(buildSurveyDraftSemanticSignature(base));
  });

  it('treats baseline changes as semantic draft changes', () => {
    const base = {
      meta: { networkId: 84532, surveyId: 'questions', ts: 100 },
      answers: {
        q1: {
          value: 'hello',
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
    const next = {
      ...base,
      baseline: {
        q1: {
          value: 'hello',
          answerEncrypted: true,
          answerEncryptionAudience: 'gate',
          answerEncryptedPortion: 'ans-base-1',
          additional: '',
          additionalEncrypted: false,
          additionalEncryptionAudience: 'self',
          importance: null,
          conviction: null,
        },
      },
    };

    expect(buildSurveyDraftSemanticSignature(next)).not.toBe(buildSurveyDraftSemanticSignature(base));
  });
});
