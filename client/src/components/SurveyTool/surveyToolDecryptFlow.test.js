import {
  applyQuestionDecryptCompletionStatus,
  applyQuestionDecryptFailureStatus,
  applySurveyDecryptStaleStatus,
  applyDecryptedQuestionResponseValues,
  applyDecryptedQuestionResponseValuesToContainer,
  applyDecryptedQuestionStateToSurveySlice,
  buildAutoDecryptMaskedFieldSignature,
  buildClearedQuestionDecryptBusyTokens,
  buildDecryptTaskKey,
  buildFieldDecryptState,
  buildQuestionDecryptBusyTokenRegistration,
  buildQuestionDecryptExecutionContext,
  buildQuestionDecryptFailureState,
  buildQuestionDecryptOwnedClearState,
  buildQuestionFieldDecryptControlDisplayState,
  buildQuestionFieldDisplayState,
  buildQuestionDecryptStartState,
  buildQuestionResponseDisplayState,
  buildQuestionRenderDisplayState,
  buildSurveyDecryptExecutionContext,
  buildSurveyDecryptAttemptSourceInputs,
  buildSurveyDecryptSourceState,
  buildSelfQuestionDecryptBaseline,
  buildSelfQuestionDecryptSuccessState,
  buildSurveyDecryptSuccessState,
  buildViewedResponseDecryptBaseline,
  buildViewedResponseDecryptSuccessState,
  carryForwardSurveyQuestionRatings,
  clearQuestionFieldBusyMap,
  collectQuestionRatingEnvelopesByQid,
  decryptQuestionRatingEnvelopeMap,
  decryptQuestionRatingEnvelopes,
  ensureQuestionDecryptSliceShape,
  finalizeSurveyDecryptAttempt,
  getViewedResponseOverrideForQuestion,
  getQuestionFieldDecryptSelection,
  getQuestionFieldTaskKey,
  getQuestionFieldTaskKeys,
  getQuestionRatingEnvelopes,
  hasQuestionDecryptBusy,
  hydrateLatestQuestionDecryptState,
  markQuestionFieldBusyMap,
  mergeLatestEncryptedQuestionFields,
  mergeQuestionRatingEnvelopeState,
  mergeQuestionResponseOverrideIntoDecryptSlice,
  normalizeBulkDecryptedSliceForSurveyState,
  normalizeSingleQuestionViewedResponse,
  ownsQuestionDecryptBusyTokens,
  parseEncryptedEnvelope,
  prepareQuestionDecryptAttempt,
  prepareSurveyDecryptAttempt,
  prepareSelfQuestionDecryptState,
  prepareViewedQuestionDecryptState,
  finalizeQuestionDecryptAttempt,
  resolveQuestionDecryptHandlingMode,
  resolveLatestSurveyDecryptResponse,
  resolveDecryptSurveyId,
  runDedupedDecryptTask,
  startQuestionDecryptAttemptStatus,
  syncDecryptedQuestionIntoBaseline,
} from './surveyToolDecryptFlow.js';

const deepClone = (value) => JSON.parse(JSON.stringify(value));

describe('surveyToolDecryptFlow', () => {
  it('parses encrypted envelopes and builds shared field/render display state', () => {
    expect(
      parseEncryptedEnvelope({
        encryptedPortion: '{"cipher":"abc"}',
      }),
    ).toEqual({ cipher: 'abc' });

    expect(
      parseEncryptedEnvelope({
        encryptedPortion: '{not-json',
      }),
    ).toBeNull();

    const answerDecryptState = buildFieldDecryptState(
      { value: '*', encrypted: true, encryptedPortion: '' },
      { loginComplete: false, account: '', busy: true },
    );
    const additionalDecryptState = buildFieldDecryptState(
      { value: 'notes', encrypted: true, encryptedPortion: '{"cipher":"sealed"}' },
      { loginComplete: true, account: '0xabc', busy: false },
    );

    expect(answerDecryptState).toEqual({
      envelope: null,
      masked: true,
      allowDecrypt: false,
      busy: true,
    });
    expect(additionalDecryptState).toEqual({
      envelope: { cipher: 'sealed' },
      masked: false,
      allowDecrypt: false,
      busy: false,
    });

    const fieldDisplayState = buildQuestionFieldDisplayState({
      answer: { value: '*', encrypted: true, encryptedPortion: '' },
      additional: { value: 'notes', encrypted: true },
      answerDecryptState,
      additionalDecryptState,
      hasAdditionalContent: true,
    });

    expect(fieldDisplayState).toEqual({
      answerDecryptState,
      additionalDecryptState,
      hasAdditionalContent: true,
      glowAnswer: true,
      glowAdditional: true,
      decryptTooltip: 'Login to decrypt this encrypted field.',
    });

    const responseDisplayState = buildQuestionResponseDisplayState({
      answer: { value: '*' },
      additional: { value: 'notes' },
      convictionValue: 3,
      importanceValue: 8,
      hasConvictionImportanceValue: true,
      sliderMode: 'importance',
    });

    expect(responseDisplayState).toEqual({
      answer: { value: '*' },
      additional: { value: 'notes' },
      convictionValue: 3,
      importanceValue: 8,
      hasConvictionImportanceValue: true,
      sliderMode: 'importance',
      activeSliderValue: 8,
    });

    expect(
      buildQuestionRenderDisplayState({
        responseDisplayState,
        fieldDisplayState,
      }),
    ).toEqual({
      answer: { value: '*' },
      additional: { value: 'notes' },
      convictionValue: 3,
      importanceValue: 8,
      hasConvictionImportanceValue: true,
      sliderMode: 'importance',
      activeSliderValue: 8,
      answerDecryptState,
      additionalDecryptState,
      hasAdditionalContent: true,
      glowAnswer: true,
      glowAdditional: true,
      decryptTooltip: 'Login to decrypt this encrypted field.',
      maskedAnswer: true,
      maskedAdditional: false,
      allowDecryptAnswer: false,
      allowDecryptAdditional: false,
      isAnswerDecrypting: true,
      isAdditionalDecrypting: false,
    });
  });

  it('builds question decrypt control display descriptors without invoking decrypt handlers', () => {
    const input = Object.freeze({
      actionLabel: 'Decrypt Comments',
      allowDecrypt: false,
      autoDecryptEnabled: false,
      busy: true,
      decryptTooltip: 'Connect wallet to decrypt',
      isDecrypting: false,
      showBusySpinnerWhenAutoDecryptEnabled: true,
      wrapperStyle: Object.freeze({ marginTop: '4px' }),
    });

    expect(buildQuestionFieldDecryptControlDisplayState(input)).toEqual({
      actionLabel: 'Decrypt Comments',
      autoDecryptEnabled: false,
      busy: true,
      disabled: true,
      showBusySpinnerWhenAutoDecryptEnabled: true,
      title: 'Connect wallet to decrypt',
      wrapperStyle: { marginTop: '4px' },
    });
    expect(
      buildQuestionFieldDecryptControlDisplayState({
        ...input,
        allowDecrypt: true,
        isDecrypting: true,
      }),
    ).toMatchObject({
      disabled: true,
      title: undefined,
    });
    expect(
      buildQuestionFieldDecryptControlDisplayState({
        ...input,
        allowDecrypt: true,
        autoDecryptEnabled: true,
        busy: false,
        isDecrypting: false,
      }),
    ).toMatchObject({
      autoDecryptEnabled: true,
      busy: false,
      disabled: false,
      title: undefined,
    });
    expect(input).toEqual({
      actionLabel: 'Decrypt Comments',
      allowDecrypt: false,
      autoDecryptEnabled: false,
      busy: true,
      decryptTooltip: 'Connect wallet to decrypt',
      isDecrypting: false,
      showBusySpinnerWhenAutoDecryptEnabled: true,
      wrapperStyle: { marginTop: '4px' },
    });
  });

  it('derives question field task keys, busy maps, selection, and state transitions', () => {
    expect(
      buildAutoDecryptMaskedFieldSignature({
        value: '*',
        encrypted: true,
        encryptedPortion: 'enc-1',
        hash: 'hash-1',
        encryptionAudience: 'gate',
      }),
    ).toBe('*|1|enc-1|hash-1|gate');

    expect(
      buildDecryptTaskKey(
        'viewed',
        'Q1',
        'additional',
        {
          responderAddress: '0xDEF',
          answer: { value: '*', encrypted: true, encryptedPortion: 'ans-env' },
          additional: { value: '*', encrypted: true, encryptedPortion: 'add-env' },
        },
        '0xabc',
      ),
    ).toBe('viewed|q1|additional|0xdef|*|1|ans-env|||*|1|add-env||');

    expect(getQuestionFieldTaskKey(' Q1 ', ' Prompt ')).toBe('q1:prompt');
    expect(getQuestionFieldTaskKey('', 'answer')).toBe('');

    expect(
      getQuestionFieldTaskKeys(' Q1 ', {
        includeAnswer: true,
        includeAdditional: true,
      }),
    ).toEqual(['q1:answer', 'q1:additional']);

    expect(
      markQuestionFieldBusyMap(
        {
          'q1:prompt': true,
        },
        ['q1:answer', '', 'q1:additional'],
      ),
    ).toEqual({
      'q1:prompt': true,
      'q1:answer': true,
      'q1:additional': true,
    });

    expect(
      clearQuestionFieldBusyMap(
        {
          'q1:answer': true,
          'q1:additional': true,
          'q1:prompt': true,
        },
        ' Q1 ',
        'additional',
      ),
    ).toEqual({
      'q1:answer': true,
      'q1:additional': false,
      'q1:prompt': true,
    });

    expect(
      getQuestionFieldDecryptSelection('q1', 'both', {
        answers: {
          q1: { value: '*', encrypted: true },
        },
        additionalComments: {
          q1: { value: '*', encryptedPortion: 'sealed' },
        },
      }),
    ).toEqual({
      maskedAnswer: true,
      maskedAdditional: true,
      hasMaskedField: true,
      clearMode: 'both',
      keysToMark: ['q1:answer', 'q1:additional'],
    });

    expect(
      buildQuestionDecryptStartState({ decryptingByKey: { 'q1:prompt': true } }, ['q1:answer', 'q1:additional']),
    ).toEqual({
      isDecrypting: true,
      submissionError: '',
      suppressPrefill: true,
      decryptingByKey: {
        'q1:prompt': true,
        'q1:answer': true,
        'q1:additional': true,
      },
    });

    expect(
      buildQuestionDecryptFailureState(
        { decryptingByKey: { 'q1:answer': true, 'q1:additional': true, 'q1:prompt': true } },
        'Q1',
        'additional',
        'boom',
      ),
    ).toEqual({
      isDecrypting: false,
      submissionError: 'boom',
      decryptingByKey: {
        'q1:answer': true,
        'q1:additional': false,
        'q1:prompt': true,
      },
    });
  });

  it('plans owned question decrypt busy-token cleanup without clearing newer attempts', () => {
    const registration = buildQuestionDecryptBusyTokenRegistration({
      tokenSeq: 2,
      busyTokens: { 'q1:prompt': 1 },
      keysToMark: ['q1:answer', '', 'q1:additional'],
    });

    expect(registration).toEqual({
      token: 3,
      busyTokens: {
        'q1:prompt': 1,
        'q1:answer': 3,
        'q1:additional': 3,
      },
    });
    expect(hasQuestionDecryptBusy({ 'q1:answer': false, 'q1:additional': true })).toBe(true);
    expect(hasQuestionDecryptBusy({ 'q1:answer': false })).toBe(false);
    expect(
      ownsQuestionDecryptBusyTokens({
        busyTokens: registration.busyTokens,
        keysToCheck: ['q1:answer', 'q1:additional'],
        token: 3,
      }),
    ).toBe(true);
    expect(
      ownsQuestionDecryptBusyTokens({
        busyTokens: { ...registration.busyTokens, 'q1:answer': 4 },
        keysToCheck: ['q1:answer', 'q1:additional'],
        token: 3,
      }),
    ).toBe(false);

    const staleCleanup = buildQuestionDecryptOwnedClearState({
      prevState: {
        decryptingByKey: {
          'q1:answer': true,
          'q1:additional': true,
          'q1:prompt': true,
        },
      },
      questionId: 'Q1',
      fieldToDecrypt: 'both',
      token: 3,
      busyTokens: { ...registration.busyTokens, 'q1:answer': 4 },
      extraPatch: { submissionError: 'old failure' },
    });

    expect(staleCleanup).toEqual({
      busyTokens: {
        'q1:prompt': 1,
        'q1:answer': 4,
      },
      statePatch: {
        submissionError: 'old failure',
        isDecrypting: true,
        decryptingByKey: {
          'q1:answer': true,
          'q1:additional': false,
          'q1:prompt': true,
        },
      },
    });

    expect(
      buildQuestionDecryptOwnedClearState({
        prevState: { decryptingByKey: { 'q1:answer': true } },
        questionId: 'Q1',
        fieldToDecrypt: 'answer',
        token: 3,
        busyTokens: { 'q1:answer': 4 },
        extraPatch: { submissionError: 'old failure' },
      }),
    ).toEqual({
      busyTokens: { 'q1:answer': 4 },
      statePatch: null,
    });

    expect(
      buildQuestionDecryptOwnedClearState({
        prevState: { decryptingByKey: { 'q1:answer': true } },
        questionId: 'Q1',
        fieldToDecrypt: 'answer',
        token: null,
        busyTokens: { 'q1:answer': 4 },
        activeSurveyDecryptAttemptSeq: 9,
        extraPatch: { submissionError: 'fallback failure' },
      }),
    ).toEqual({
      busyTokens: { 'q1:answer': 4 },
      statePatch: {
        submissionError: 'fallback failure',
        isDecrypting: true,
        decryptingByKey: { 'q1:answer': true },
      },
    });

    expect(
      buildClearedQuestionDecryptBusyTokens({
        busyTokens: { 'q1:answer': 4, 'q1:additional': 3 },
        keysToClear: ['q1:answer', 'q1:additional'],
        token: 3,
      }),
    ).toEqual({ 'q1:answer': 4 });
  });

  it('applies question decrypt completion status for stale, newer-token, and success paths', () => {
    const staleSetState = jest.fn((updater) => updater({ decryptingByKey: { 'q1:answer': true } }));
    const buildStaleState = jest.fn(() => ({ decryptingByKey: { 'q1:answer': false } }));

    expect(
      applyQuestionDecryptCompletionStatus({
        context: { account: '0xold' },
        questionId: 'q1',
        fieldToDecrypt: 'answer',
        decryptAttemptToken: 2,
        keysToMark: ['q1:answer'],
        setState: staleSetState,
        isDecryptContextCurrent: () => false,
        canUpdateStateForAsyncSnapshot: () => true,
        buildQuestionDecryptStaleState: buildStaleState,
      }),
    ).toEqual({
      shouldReturn: true,
      result: false,
      reason: 'stale-context',
    });
    expect(buildStaleState).toHaveBeenCalledWith({ decryptingByKey: { 'q1:answer': true } }, 'q1', 'answer', 2);

    const newerTokenEvents = [];
    expect(
      applyQuestionDecryptCompletionStatus({
        context: { account: '0xabc' },
        questionId: 'q1',
        fieldToDecrypt: 'answer',
        decryptAttemptToken: 2,
        keysToMark: ['q1:answer'],
        setState: (updater) => {
          newerTokenEvents.push(updater({ decryptingByKey: { 'q1:answer': true } }));
        },
        clearQuestionDecryptBusyTokens: () => newerTokenEvents.push('clear'),
        isDecryptContextCurrent: () => true,
        ownsQuestionDecryptBusyTokens: () => false,
        buildQuestionDecryptStaleState: () => ({ decryptingByKey: { 'q1:answer': true } }),
        buildSuccessState: () => ({ success: true }),
      }),
    ).toEqual({
      shouldReturn: true,
      result: false,
      reason: 'stale-busy-token',
    });
    expect(newerTokenEvents).toEqual([{ decryptingByKey: { 'q1:answer': true } }]);

    const successEvents = [];
    const successCallback = jest.fn(() => successEvents.push('callback'));
    expect(
      applyQuestionDecryptCompletionStatus({
        context: { account: '0xabc' },
        questionId: 'q1',
        fieldToDecrypt: 'answer',
        decryptAttemptToken: 3,
        keysToMark: ['q1:answer'],
        setState: (updater, callback) => {
          successEvents.push(updater({ decryptingByKey: { 'q1:answer': true } }));
          callback();
        },
        clearQuestionDecryptBusyTokens: (keys, token) => successEvents.push({ clear: keys, token }),
        isDecryptContextCurrent: () => true,
        ownsQuestionDecryptBusyTokens: () => true,
        buildSuccessState: () => ({ decryptingByKey: { 'q1:answer': false } }),
        onSuccessStateApplied: successCallback,
      }),
    ).toEqual({
      shouldReturn: false,
      result: null,
      reason: 'applied',
    });
    expect(successEvents).toEqual([
      { clear: ['q1:answer'], token: 3 },
      { decryptingByKey: { 'q1:answer': false } },
      'callback',
    ]);
    expect(successCallback).toHaveBeenCalledTimes(1);

    const hostSuccessEvents = [];
    const successStateOptions = { questionId: 'q1', clearMode: 'answer' };
    const host = {
      setState: (updater) => hostSuccessEvents.push(updater({ viewed: true })),
      clearQuestionDecryptBusyTokens: (keys, token) => hostSuccessEvents.push({ clear: keys, token }),
      isDecryptContextCurrent: () => true,
      ownsQuestionDecryptBusyTokens: () => true,
      buildViewedResponseDecryptSuccessState: jest.fn(() => ({ viewedSuccess: true })),
    };

    expect(
      applyQuestionDecryptCompletionStatus({
        host,
        context: { account: '0xabc' },
        questionId: 'q1',
        fieldToDecrypt: 'answer',
        decryptAttemptToken: 4,
        keysToMark: ['q1:answer'],
        successStateKind: 'viewed',
        successStateOptions,
      }),
    ).toEqual({
      shouldReturn: false,
      result: null,
      reason: 'applied',
    });
    expect(host.buildViewedResponseDecryptSuccessState).toHaveBeenCalledWith({ viewed: true }, successStateOptions);
    expect(hostSuccessEvents).toEqual([{ clear: ['q1:answer'], token: 4 }, { viewedSuccess: true }]);
  });

  it('starts question decrypt attempt status only when a masked field is planned', () => {
    const prepareQuestionDecryptAttempt = jest.fn(() => ({ shouldDecrypt: false }));

    expect(
      startQuestionDecryptAttemptStatus({
        questionId: 'q1',
        fieldToDecrypt: 'answer',
        baselineForDecrypt: { answers: {} },
        prepareQuestionDecryptAttempt,
      }),
    ).toEqual({
      shouldReturn: true,
      result: false,
      reason: 'no-masked-field',
    });
    expect(prepareQuestionDecryptAttempt).toHaveBeenCalledWith({
      questionId: 'q1',
      fieldToDecrypt: 'answer',
      baselineForDecrypt: { answers: {} },
    });

    const events = [];
    const host = {
      prepareQuestionDecryptAttempt: jest.fn(() => ({
        shouldDecrypt: true,
        decryptSelection: {
          keysToMark: ['q1:answer', 'q1:additional'],
          clearMode: 'both',
        },
        chainId: 84532,
        lit: { getKey: jest.fn() },
        opts: { providerKind: 'mock' },
      })),
      registerQuestionDecryptBusyTokens: jest.fn((keys) => {
        events.push({ register: keys });
        return 7;
      }),
      setState: jest.fn((updater) => {
        events.push(updater({ decryptingByKey: {} }));
      }),
      buildQuestionDecryptStartState: jest.fn(() => ({
        isDecrypting: true,
        decryptingByKey: {
          'q1:answer': true,
          'q1:additional': true,
        },
      })),
    };

    expect(
      startQuestionDecryptAttemptStatus({
        host,
        questionId: 'q1',
        fieldToDecrypt: 'both',
        baselineForDecrypt: { answers: { q1: { value: '*' } } },
      }),
    ).toEqual({
      shouldReturn: false,
      result: null,
      reason: 'started',
      decryptAttemptToken: 7,
      decryptSelection: {
        keysToMark: ['q1:answer', 'q1:additional'],
        clearMode: 'both',
      },
      keysToMark: ['q1:answer', 'q1:additional'],
      clearMode: 'both',
      chainId: 84532,
      lit: { getKey: expect.any(Function) },
      opts: { providerKind: 'mock' },
    });
    expect(events).toEqual([
      { register: ['q1:answer', 'q1:additional'] },
      {
        isDecrypting: true,
        decryptingByKey: {
          'q1:answer': true,
          'q1:additional': true,
        },
      },
    ]);
  });

  it('preserves decrypt keys fallback shape for busy-token registration', () => {
    const nonArrayKeysToMark = { answer: 'q1:answer' };
    const registerBusyTokens = jest.fn(() => 13);
    const buildStartState = jest.fn(() => ({ started: true }));
    const setState = jest.fn((updater) => updater({ decryptingByKey: {} }));

    const started = startQuestionDecryptAttemptStatus({
      prepareQuestionDecryptAttempt: jest.fn(() => ({
        shouldDecrypt: true,
        decryptSelection: {
          keysToMark: nonArrayKeysToMark,
          clearMode: 'answer',
        },
      })),
      registerQuestionDecryptBusyTokens: registerBusyTokens,
      buildQuestionDecryptStartState: buildStartState,
      setState,
    });

    expect(started.keysToMark).toBe(nonArrayKeysToMark);
    expect(registerBusyTokens).toHaveBeenCalledWith(nonArrayKeysToMark);
    expect(buildStartState).toHaveBeenCalledWith({ decryptingByKey: {} }, nonArrayKeysToMark);

    const registerEmptyKeys = jest.fn(() => 14);
    const buildEmptyStartState = jest.fn(() => ({ started: true }));

    const startedWithEmptyKeys = startQuestionDecryptAttemptStatus({
      prepareQuestionDecryptAttempt: jest.fn(() => ({
        shouldDecrypt: true,
        decryptSelection: {
          keysToMark: '',
          clearMode: 'answer',
        },
      })),
      registerQuestionDecryptBusyTokens: registerEmptyKeys,
      buildQuestionDecryptStartState: buildEmptyStartState,
      setState: (updater) => updater({ decryptingByKey: { stale: 1 } }),
    });

    expect(startedWithEmptyKeys.keysToMark).toEqual([]);
    expect(registerEmptyKeys).toHaveBeenCalledWith([]);
    expect(buildEmptyStartState).toHaveBeenCalledWith({ decryptingByKey: { stale: 1 } }, []);
  });

  it('applies question decrypt failure status through stale or owned failure patches', () => {
    const staleSetState = jest.fn((updater) => updater({ decryptingByKey: { 'q1:answer': true } }));
    const buildStaleState = jest.fn(() => ({ decryptingByKey: { 'q1:answer': false } }));

    expect(
      applyQuestionDecryptFailureStatus({
        context: { account: '0xold' },
        questionId: 'q1',
        fieldToDecrypt: 'answer',
        decryptAttemptToken: 2,
        error: new Error('old failure'),
        setState: staleSetState,
        isDecryptContextCurrent: () => false,
        canUpdateStateForAsyncSnapshot: () => true,
        buildQuestionDecryptStaleState: buildStaleState,
      }),
    ).toBe(false);
    expect(buildStaleState).toHaveBeenCalledWith({ decryptingByKey: { 'q1:answer': true } }, 'q1', 'answer', 2);

    const failureSetState = jest.fn((updater) => updater({ decryptingByKey: { 'q1:answer': true } }));
    const buildFailureState = jest.fn(() => ({
      decryptingByKey: { 'q1:answer': false },
      submissionError: 'current failure',
    }));

    expect(
      applyQuestionDecryptFailureStatus({
        context: { account: '0xabc' },
        questionId: 'q1',
        fieldToDecrypt: 'answer',
        decryptAttemptToken: 3,
        error: new Error('current failure'),
        setState: failureSetState,
        isDecryptContextCurrent: () => true,
        buildQuestionDecryptFailureStateForAttempt: buildFailureState,
      }),
    ).toBe(false);
    expect(buildFailureState).toHaveBeenCalledWith(
      { decryptingByKey: { 'q1:answer': true } },
      'q1',
      'answer',
      'current failure',
      3,
    );
  });

  it('decrypts rating envelopes and builds the shared execution context', async () => {
    const decryptEnvelopeValue = jest.fn(async (env) => {
      if (env === 'importance-env') return '7';
      if (env === 'conviction-env') return 'not-a-number';
      return null;
    });
    const logWarn = jest.fn();
    const litHooks = { getKey: jest.fn() };
    const provider = { provider: true };
    const resolveDecryptSurveyId = jest.fn(() => 'survey-1');
    const getProviderKind = jest.fn(() => 'browser');

    await expect(
      decryptQuestionRatingEnvelopes(
        {
          importanceEncrypted: 'importance-env',
          convictionEncrypted: 'conviction-env',
        },
        {
          account: '0xabc',
          chainId: 84532,
          lit: { getKey: jest.fn() },
          providerLike: provider,
        },
        {
          decryptEnvelopeValue,
          logWarn,
        },
      ),
    ).resolves.toEqual({
      decryptedImportance: 7,
      decryptedConviction: null,
    });

    expect(decryptEnvelopeValue).toHaveBeenCalledTimes(2);
    expect(logWarn).not.toHaveBeenCalled();

    expect(
      buildQuestionDecryptExecutionContext({
        baselineForDecrypt: { answers: {} },
        questionId: 'Q1',
        provider,
        account: '0xabc',
        network: { id: 84532 },
        questionPool: [{ id: 'pool-q' }],
        pileQuestions: [{ id: 'pile-q' }],
        litHooks,
        hasher: 'hash-worker',
        resolveDecryptSurveyId,
        getProviderKind,
      }),
    ).toEqual({
      providerKind: 'browser',
      chainId: 84532,
      surveyId: 'survey-1',
      questionPool: [{ id: 'pool-q' }],
      lit: { getKey: litHooks.getKey },
      target: {
        chainId: 84532,
        fieldToDecrypt: 'both',
        providerKind: 'browser',
        questionId: 'q1',
        surveyId: 'survey-1',
      },
      opts: {
        providerKind: 'browser',
        provider,
        account: '0xabc',
        chainId: 84532,
        surveyId: 'survey-1',
        questionPool: [{ id: 'pool-q' }],
        lit: { getKey: litHooks.getKey },
        hasher: 'hash-worker',
        throwOnError: true,
      },
    });
  });

  it('builds bulk survey decrypt source state and execution context', () => {
    const buildSliceFromUserAnswers = jest.fn(() => ({
      answers: { q1: { value: '*' } },
      importance: {},
      conviction: { q1: null },
      additionalComments: {},
    }));
    const litHooks = { getKey: jest.fn() };
    const provider = { provider: true };
    const resolveDecryptSurveyId = jest.fn(() => 'survey-bulk');
    const getProviderKind = jest.fn(() => 'browser');

    expect(
      collectQuestionRatingEnvelopesByQid({
        responses: [
          { questionID: 'q1', importanceEncrypted: 'imp-1' },
          { questionID: 'q2', convictionEncrypted: 'conv-2' },
        ],
      }),
    ).toEqual({
      q1: { importanceEncrypted: 'imp-1', convictionEncrypted: '' },
      q2: { importanceEncrypted: '', convictionEncrypted: 'conv-2' },
    });

    expect(
      carryForwardSurveyQuestionRatings(
        {
          answers: {},
          importance: { q1: null },
          conviction: {},
          additionalComments: {},
        },
        {
          importance: { q1: 5 },
          conviction: { q1: 9 },
        },
      ),
    ).toEqual({
      answers: {},
      importance: { q1: 5 },
      conviction: { q1: 9 },
      additionalComments: {},
    });

    const { sourceSlice, ratingEnvelopesByQid } = buildSurveyDecryptSourceState(
      {
        responses: [
          { questionID: 'q1', importanceEncrypted: 'imp-1' },
          { questionID: 'q2', convictionEncrypted: 'conv-2' },
        ],
      },
      {
        answers: {},
        importance: {},
        conviction: {},
        additionalComments: {},
      },
      {
        importance: { q1: 5 },
        conviction: { q1: 9 },
      },
      buildSliceFromUserAnswers,
    );

    expect(sourceSlice).toEqual({
      answers: { q1: { value: '*' } },
      importance: { q1: 5 },
      conviction: { q1: 9 },
      additionalComments: {},
    });
    expect(ratingEnvelopesByQid).toEqual({
      q1: { importanceEncrypted: 'imp-1', convictionEncrypted: '' },
      q2: { importanceEncrypted: '', convictionEncrypted: 'conv-2' },
    });

    expect(
      buildSurveyDecryptExecutionContext({
        sourceSlice,
        questionId: 'Q1',
        provider,
        account: '0xabc',
        network: { id: 84532 },
        questionPool: [{ id: 'pool-q' }],
        pileQuestions: [{ id: 'pile-q' }],
        litHooks,
        hasher: 'hash-worker',
        resolveDecryptSurveyId,
        getProviderKind,
      }),
    ).toEqual({
      providerKind: 'browser',
      chainId: 84532,
      surveyId: 'survey-bulk',
      poolForDecrypt: [{ id: 'pool-q' }],
      lit: { getKey: litHooks.getKey },
      opts: {
        providerKind: 'browser',
        provider,
        account: '0xabc',
        chainId: 84532,
        surveyId: 'survey-bulk',
        lit: { getKey: litHooks.getKey },
        hasher: 'hash-worker',
        throwOnError: true,
      },
    });
  });

  it('plans bulk survey decrypt source inputs and stale status through injected parent ports', () => {
    const state = {
      userAnswers: { answers: { q1: { value: 'cached' } } },
      surveysResponseState: [
        null,
        {
          answers: { q2: { value: '*' } },
          importance: { q2: 5 },
          conviction: {},
          additionalComments: {},
        },
      ],
    };

    expect(
      buildSurveyDecryptAttemptSourceInputs({
        decryptContext: {
          surveyIndex: 1,
          sessionSlug: '',
        },
        state,
        getEffectiveDraftSlug: () => 'fallback-slug',
      }),
    ).toEqual({
      surveyIndex: 1,
      slug: 'fallback-slug',
      fallbackUserAnswers: state.userAnswers,
      fallbackSourceSlice: state.surveysResponseState[1],
      previousStateSlice: state.surveysResponseState[1],
    });

    expect(
      buildSurveyDecryptAttemptSourceInputs({
        decryptContext: {
          surveyIndex: 3,
          sessionSlug: 'session-slug',
        },
        state,
        getEffectiveDraftSlug: () => 'fallback-slug',
      }),
    ).toEqual({
      surveyIndex: 3,
      slug: 'session-slug',
      fallbackUserAnswers: state.userAnswers,
      fallbackSourceSlice: {
        answers: {},
        importance: {},
        conviction: {},
        additionalComments: {},
      },
      previousStateSlice: {},
    });

    const staleEvents = [];
    expect(
      applySurveyDecryptStaleStatus({
        context: { account: '0xabc' },
        attemptId: 4,
        isDecryptContextCurrent: () => false,
        canUpdateSurveyDecryptAttempt: (context, attemptId) => {
          staleEvents.push({ canUpdate: context, attemptId });
          return true;
        },
        finishSurveyDecryptAttempt: (attemptId) => staleEvents.push({ finish: attemptId }),
        buildSurveyDecryptStaleState: () => ({ isDecrypting: false }),
        setSurveyDecryptStaleState: (patch) => staleEvents.push({ patch }),
      }),
    ).toEqual({
      shouldReturn: true,
      reason: 'stale-context-applied',
    });
    expect(staleEvents).toEqual([
      { canUpdate: { account: '0xabc' }, attemptId: 4 },
      { finish: 4 },
      { patch: { isDecrypting: false } },
    ]);

    const skippedEvents = [];
    expect(
      applySurveyDecryptStaleStatus({
        context: { account: '0xabc' },
        attemptId: 5,
        isDecryptContextCurrent: () => false,
        canUpdateSurveyDecryptAttempt: () => false,
        finishSurveyDecryptAttempt: (attemptId) => skippedEvents.push({ finish: attemptId }),
        setSurveyDecryptStaleState: (patch) => skippedEvents.push({ patch }),
      }),
    ).toEqual({
      shouldReturn: true,
      reason: 'stale-context-skipped',
    });
    expect(skippedEvents).toEqual([]);

    expect(
      applySurveyDecryptStaleStatus({
        context: { account: '0xabc' },
        attemptId: 6,
        isDecryptContextCurrent: () => true,
      }),
    ).toEqual({
      shouldReturn: false,
      reason: 'current-context',
    });
  });

  it('hydrates latest encrypted question fields and rating envelopes before decrypt', async () => {
    const getLatestQuestionResponse = jest.fn().mockResolvedValue({
      questionID: 'q1',
      answer: { encrypted: true, encryptedPortion: 'fresh-answer', hash: 'hash-a' },
      additional: { encrypted: true, encryptedPortion: 'fresh-additional', hash: 'hash-b' },
      importanceEncrypted: 'imp-latest',
      convictionEncrypted: 'conv-latest',
    });

    await expect(
      hydrateLatestQuestionDecryptState(
        {
          questionId: 'q1',
          fieldToDecrypt: 'both',
          baselineForDecrypt: {
            answers: { q1: { value: '*', encrypted: true } },
            additionalComments: { q1: { value: '*', encrypted: true } },
          },
          initialRatingEnvelopes: { importanceEncrypted: '', convictionEncrypted: '' },
          account: '0xabc',
          responderForLatest: '0xdef',
          sessionSlug: 'demo-slug',
          networkID: '84532',
        },
        {
          getQuestionFieldDecryptSelection,
          readQuestionsCache: jest.fn(() => ({ cached: true })),
          getLatestQuestionResponse,
          mergeLatestEncryptedQuestionFields,
          mergeQuestionRatingEnvelopeState,
          logWarn: jest.fn(),
        },
      ),
    ).resolves.toEqual({
      baselineForDecrypt: {
        answers: {
          q1: {
            value: '*',
            encrypted: true,
            hash: 'hash-a',
            encryptedPortion: 'fresh-answer',
          },
        },
        additionalComments: {
          q1: {
            value: '*',
            encrypted: true,
            hash: 'hash-b',
            encryptedPortion: 'fresh-additional',
          },
        },
      },
      ratingEnvelopes: {
        importanceEncrypted: 'imp-latest',
        convictionEncrypted: 'conv-latest',
      },
    });

    expect(getLatestQuestionResponse).toHaveBeenCalledWith('0xdef', 'q1', '84532', { cached: true });
  });

  it('prepares viewed decrypt state from the route payload and latest envelope hydration', async () => {
    const buildViewedResponseDecryptBaseline = jest.fn(() => ({
      answers: { q1: { value: '*', encrypted: true } },
      additionalComments: {},
    }));
    const hydrateLatestQuestionDecryptState = jest.fn().mockResolvedValue({
      baselineForDecrypt: {
        answers: { q1: { value: '*', encrypted: true, encryptedPortion: 'fresh-answer' } },
        additionalComments: {},
      },
      ratingEnvelopes: {
        importanceEncrypted: 'imp-env',
        convictionEncrypted: 'conv-env',
      },
    });

    await expect(
      prepareViewedQuestionDecryptState(
        {
          questionId: 'Q1',
          fieldToDecrypt: 'answer',
          responseOverride: {
            questionID: 'q1',
            importanceEncrypted: 'imp-stale',
          },
          account: '0xabc',
          responderForLatest: '0xdef',
          sessionSlug: 'demo-slug',
          networkID: '84532',
        },
        {
          buildViewedResponseDecryptBaseline,
          hydrateLatestQuestionDecryptState,
        },
      ),
    ).resolves.toEqual({
      questionId: 'q1',
      baselineForDecrypt: {
        answers: { q1: { value: '*', encrypted: true, encryptedPortion: 'fresh-answer' } },
        additionalComments: {},
      },
      ratingEnvelopes: {
        importanceEncrypted: 'imp-env',
        convictionEncrypted: 'conv-env',
      },
    });
  });

  it('prepares self decrypt state from baseline, override merge, rating merge, and hydration', async () => {
    const buildSelfQuestionDecryptBaseline = jest.fn(() => ({
      baselineSlice: { answers: {}, importance: {}, conviction: {}, additionalComments: {} },
      baselineForDecrypt: { answers: {}, importance: {}, conviction: {}, additionalComments: {} },
    }));
    const mergeQuestionResponseOverrideIntoDecryptSlice = jest.fn(() => ({
      answers: { q1: { value: '*', encrypted: true } },
      additionalComments: {},
      importance: {},
      conviction: {},
    }));
    const mergeQuestionRatingEnvelopeState = jest
      .fn()
      .mockReturnValueOnce({ importanceEncrypted: 'imp-override', convictionEncrypted: '' })
      .mockReturnValueOnce({ importanceEncrypted: 'imp-override', convictionEncrypted: 'conv-user' });
    const hydrateLatestQuestionDecryptState = jest.fn().mockResolvedValue({
      baselineForDecrypt: {
        answers: { q1: { value: '*', encrypted: true, encryptedPortion: 'fresh-answer' } },
        additionalComments: {},
        importance: {},
        conviction: {},
      },
      ratingEnvelopes: {
        importanceEncrypted: 'imp-latest',
        convictionEncrypted: 'conv-latest',
      },
    });

    await expect(
      prepareSelfQuestionDecryptState(
        {
          surveyIndex: 0,
          questionId: 'Q1',
          fieldToDecrypt: 'answer',
          responseOverride: { questionID: 'q1' },
          userAnswers: { responses: [] },
          account: '0xabc',
          sessionSlug: 'demo-slug',
          networkID: '84532',
        },
        {
          buildSelfQuestionDecryptBaseline,
          mergeQuestionResponseOverrideIntoDecryptSlice,
          mergeQuestionRatingEnvelopeState,
          hydrateLatestQuestionDecryptState,
          logWarn: jest.fn(),
        },
      ),
    ).resolves.toEqual({
      questionId: 'q1',
      baselineSlice: { answers: {}, importance: {}, conviction: {}, additionalComments: {} },
      baselineForDecrypt: {
        answers: { q1: { value: '*', encrypted: true, encryptedPortion: 'fresh-answer' } },
        additionalComments: {},
        importance: {},
        conviction: {},
      },
      ratingEnvelopes: {
        importanceEncrypted: 'imp-latest',
        convictionEncrypted: 'conv-latest',
      },
    });
  });

  it('prepares question decrypt attempts only when a masked field still needs decrypt', () => {
    const getQuestionFieldDecryptSelection = jest
      .fn()
      .mockReturnValueOnce({
        hasMaskedField: false,
        keysToMark: [],
        clearMode: '',
      })
      .mockReturnValueOnce({
        hasMaskedField: true,
        maskedAnswer: true,
        maskedAdditional: false,
        keysToMark: ['q1:answer'],
        clearMode: 'answer',
      });
    const buildQuestionDecryptExecutionContext = jest.fn(() => ({
      chainId: 84532,
      lit: { getKey: jest.fn() },
      opts: { providerKind: 'browser' },
    }));

    expect(
      prepareQuestionDecryptAttempt(
        {
          questionId: 'q1',
          fieldToDecrypt: 'answer',
          baselineForDecrypt: { answers: { q1: { value: 'clear' } } },
        },
        {
          getQuestionFieldDecryptSelection,
          buildQuestionDecryptExecutionContext,
        },
      ),
    ).toEqual({
      blockedReason: 'no-masked-field',
      shouldDecrypt: false,
      decryptSelection: {
        hasMaskedField: false,
        keysToMark: [],
        clearMode: '',
      },
    });

    expect(
      prepareQuestionDecryptAttempt(
        {
          questionId: 'q1',
          fieldToDecrypt: 'answer',
          baselineForDecrypt: { answers: { q1: { value: '*', encrypted: true } } },
        },
        {
          getQuestionFieldDecryptSelection,
          buildQuestionDecryptExecutionContext,
        },
      ),
    ).toEqual({
      blockedReason: '',
      shouldDecrypt: true,
      decryptSelection: {
        hasMaskedField: true,
        maskedAnswer: true,
        maskedAdditional: false,
        keysToMark: ['q1:answer'],
        clearMode: 'answer',
      },
      chainId: 84532,
      decryptRequest: {
        fieldToDecrypt: 'answer',
        options: { providerKind: 'browser' },
        questionId: 'q1',
        responseSlice: { answers: { q1: { value: '*', encrypted: true } } },
        target: {
          chainId: 84532,
          fieldToDecrypt: 'answer',
          providerKind: 'browser',
          questionId: 'q1',
          surveyId: '',
        },
      },
      lit: { getKey: expect.any(Function) },
      opts: { providerKind: 'browser' },
      target: {
        chainId: 84532,
        fieldToDecrypt: 'answer',
        providerKind: 'browser',
        questionId: 'q1',
        surveyId: '',
      },
    });

    expect(buildQuestionDecryptExecutionContext).toHaveBeenCalledTimes(1);
    expect(buildQuestionDecryptExecutionContext).toHaveBeenCalledWith(
      { answers: { q1: { value: '*', encrypted: true } } },
      'q1',
    );
  });

  it('finalizes question decrypt attempts with normalized field keys and rating envelope decrypts', async () => {
    const decryptSingleField = jest.fn().mockResolvedValue({
      answers: { q1: { value: 'clear answer' } },
      additionalComments: { q1: { value: 'clear notes' } },
    });
    const decryptQuestionRatingEnvelopes = jest.fn().mockResolvedValue({
      decryptedImportance: 4,
      decryptedConviction: 9,
    });

    await expect(
      finalizeQuestionDecryptAttempt(
        {
          questionId: 'Q1',
          fieldToDecrypt: 'both',
          baselineForDecrypt: { answers: { q1: { value: '*', encrypted: true } } },
          ratingEnvelopes: { importanceEncrypted: 'imp-env' },
          account: '0xabc',
          providerLike: { provider: true },
          chainId: 84532,
          lit: { getKey: jest.fn() },
          opts: { providerKind: 'browser' },
        },
        {
          decryptSingleField,
          decryptQuestionRatingEnvelopes,
        },
      ),
    ).resolves.toEqual({
      decryptedStateSlice: {
        answers: { q1: { value: 'clear answer' } },
        additionalComments: { q1: { value: 'clear notes' } },
      },
      didUpdate: true,
      decryptedImportance: 4,
      decryptedConviction: 9,
    });

    expect(decryptSingleField).toHaveBeenCalledWith(
      { answers: { q1: { value: '*', encrypted: true } } },
      'q1',
      'both',
      { providerKind: 'browser' },
    );
    expect(decryptQuestionRatingEnvelopes).toHaveBeenCalledWith(
      { importanceEncrypted: 'imp-env' },
      {
        account: '0xabc',
        chainId: 84532,
        lit: { getKey: expect.any(Function) },
        providerLike: { provider: true },
      },
    );
  });

  it('decrypts rating envelope maps into per-question numeric values', async () => {
    const decryptEnvelopeValue = jest.fn(async (env) => {
      if (env === 'importance-q1') return '7';
      if (env === 'conviction-q2') return '9';
      return null;
    });

    await expect(
      decryptQuestionRatingEnvelopeMap(
        {
          q1: { importanceEncrypted: 'importance-q1' },
          q2: { convictionEncrypted: 'conviction-q2' },
        },
        {
          account: '0xabc',
          chainId: 84532,
          lit: { getKey: jest.fn() },
          providerLike: { provider: true },
        },
        {
          decryptEnvelopeValue,
          logWarn: jest.fn(),
        },
      ),
    ).resolves.toEqual({
      decryptedImportanceFromEnv: { q1: 7 },
      decryptedConvictionFromEnv: { q2: 9 },
    });
  });

  it('finalizes bulk survey decrypt attempts by decrypting, rating-merging, and normalizing', async () => {
    const decryptMultipleAnswers = jest.fn().mockResolvedValue({
      answers: { q1: { value: 'clear answer' } },
      additionalComments: { q1: { value: 'clear notes' } },
    });
    const decryptQuestionRatingEnvelopeMap = jest.fn().mockResolvedValue({
      decryptedImportanceFromEnv: { q1: 7 },
      decryptedConvictionFromEnv: { q1: 9 },
    });
    const normalizeBulkDecryptedSliceForSurveyState = jest.fn(() => ({
      answers: { q1: { value: 'clear answer', encrypted: true } },
      additionalComments: { q1: { value: 'clear notes', encrypted: true } },
    }));

    await expect(
      finalizeSurveyDecryptAttempt(
        {
          sourceSlice: { answers: { q1: { value: '*', encrypted: true } } },
          ratingEnvelopesByQid: { q1: { importanceEncrypted: 'imp-env' } },
          account: '0xabc',
          providerLike: { provider: true },
          chainId: 84532,
          lit: { getKey: jest.fn() },
          poolForDecrypt: [{ id: 'q1' }],
          opts: { providerKind: 'browser' },
          previousStateSlice: { answers: { q1: { encrypted: true } } },
        },
        {
          decryptMultipleAnswers,
          decryptQuestionRatingEnvelopeMap,
          normalizeBulkDecryptedSliceForSurveyState,
        },
      ),
    ).resolves.toEqual({
      normalizedDecryptedSlice: {
        answers: { q1: { value: 'clear answer', encrypted: true } },
        additionalComments: { q1: { value: 'clear notes', encrypted: true } },
      },
      decryptedImportanceFromEnv: { q1: 7 },
      decryptedConvictionFromEnv: { q1: 9 },
    });

    expect(decryptMultipleAnswers).toHaveBeenCalledWith(
      { answers: { q1: { value: '*', encrypted: true } } },
      [{ id: 'q1' }],
      { providerKind: 'browser' },
    );
    expect(decryptQuestionRatingEnvelopeMap).toHaveBeenCalledWith(
      { q1: { importanceEncrypted: 'imp-env' } },
      {
        account: '0xabc',
        chainId: 84532,
        lit: { getKey: expect.any(Function) },
        providerLike: { provider: true },
      },
    );
    expect(normalizeBulkDecryptedSliceForSurveyState).toHaveBeenCalledWith(
      {
        answers: { q1: { value: 'clear answer' } },
        additionalComments: { q1: { value: 'clear notes' } },
      },
      {
        previousStateSlice: { answers: { q1: { encrypted: true } } },
        baselineSlice: { answers: { q1: { value: '*', encrypted: true } } },
      },
    );
  });

  it('resolves the latest survey decrypt response from single-question, survey, or fallback sources', async () => {
    const getLatestQuestionResponse = jest.fn().mockResolvedValue({ answer: { value: '*' } });
    const getLatestSurveyResponse = jest.fn().mockResolvedValue({ responses: [{ questionID: 'q1' }] });

    await expect(
      resolveLatestSurveyDecryptResponse(
        {
          singleQuestionMode: true,
          questionId: ' Q1 ',
          account: '0xabc',
          providerLike: { provider: true },
          slug: 'demo-slug',
          fallbackUserAnswers: { fallback: true },
        },
        {
          getLatestQuestionResponse,
          getLatestSurveyResponse,
        },
      ),
    ).resolves.toEqual({ answer: { value: '*' } });

    expect(getLatestQuestionResponse).toHaveBeenCalledWith({ provider: true }, '0xabc', 'q1', 'demo-slug');

    await expect(
      resolveLatestSurveyDecryptResponse(
        {
          singleQuestionMode: false,
          account: '0xabc',
          surveyId: 'survey-1',
          fallbackUserAnswers: { fallback: true },
        },
        {
          getLatestQuestionResponse,
          getLatestSurveyResponse,
        },
      ),
    ).resolves.toEqual({ responses: [{ questionID: 'q1' }] });

    expect(getLatestSurveyResponse).toHaveBeenCalledWith('0xabc', 'survey-1');

    getLatestQuestionResponse.mockResolvedValueOnce(null);

    await expect(
      resolveLatestSurveyDecryptResponse(
        {
          singleQuestionMode: true,
          questionId: 'q2',
          account: '0xabc',
          providerLike: { provider: true },
          slug: 'demo-slug',
          fallbackUserAnswers: { fallback: true },
        },
        {
          getLatestQuestionResponse,
          getLatestSurveyResponse,
        },
      ),
    ).resolves.toEqual({ fallback: true });
  });

  it('prepares bulk survey decrypt attempts from latest source, source slice, and execution context', async () => {
    const resolveLatestSurveyDecryptResponse = jest.fn().mockResolvedValue({
      responses: [{ questionID: 'q1' }],
    });
    const buildSurveyDecryptSourceState = jest.fn(() => ({
      sourceSlice: { answers: { q1: { value: '*' } } },
      ratingEnvelopesByQid: { q1: { importanceEncrypted: 'imp-env' } },
    }));
    const buildSurveyDecryptExecutionContext = jest.fn(() => ({
      chainId: 84532,
      lit: { getKey: jest.fn() },
      opts: { providerKind: 'browser' },
      poolForDecrypt: [{ id: 'q1' }],
    }));

    await expect(
      prepareSurveyDecryptAttempt(
        {
          singleQuestionMode: true,
          questionId: 'Q1',
          account: '0xabc',
          providerLike: { provider: true },
          slug: 'demo-slug',
          surveyId: 'survey-1',
          fallbackUserAnswers: { fallback: true },
          fallbackSourceSlice: { answers: {} },
          previousStateSlice: { answers: { q1: { encrypted: true } } },
        },
        {
          resolveLatestSurveyDecryptResponse,
          buildSurveyDecryptSourceState,
          buildSurveyDecryptExecutionContext,
        },
      ),
    ).resolves.toEqual({
      latest: { responses: [{ questionID: 'q1' }] },
      sourceSlice: { answers: { q1: { value: '*' } } },
      ratingEnvelopesByQid: { q1: { importanceEncrypted: 'imp-env' } },
      chainId: 84532,
      lit: { getKey: expect.any(Function) },
      opts: { providerKind: 'browser' },
      poolForDecrypt: [{ id: 'q1' }],
    });

    expect(resolveLatestSurveyDecryptResponse).toHaveBeenCalledWith({
      singleQuestionMode: true,
      questionId: 'Q1',
      account: '0xabc',
      providerLike: { provider: true },
      slug: 'demo-slug',
      surveyId: 'survey-1',
      fallbackUserAnswers: { fallback: true },
    });
    expect(buildSurveyDecryptSourceState).toHaveBeenCalledWith(
      { responses: [{ questionID: 'q1' }] },
      { answers: {} },
      { answers: { q1: { encrypted: true } } },
    );
    expect(buildSurveyDecryptExecutionContext).toHaveBeenCalledWith({ answers: { q1: { value: '*' } } }, 'Q1');
  });

  it('normalizes decrypt slice shape and builds viewed-response baselines', () => {
    const buildSliceFromUserAnswers = jest.fn(() => ({
      answers: { q1: { value: '*' } },
      additionalComments: null,
    }));

    expect(
      ensureQuestionDecryptSliceShape({
        answers: { q1: { value: '*' } },
        additionalComments: null,
      }),
    ).toEqual({
      answers: { q1: { value: '*' } },
      additionalComments: {},
      importance: {},
      conviction: {},
    });

    expect(
      buildViewedResponseDecryptBaseline({ questionId: 'Q1', answer: { value: '*' } }, 'q1', buildSliceFromUserAnswers),
    ).toEqual({
      answers: { q1: { value: '*' } },
      additionalComments: {},
      importance: {},
      conviction: {},
    });
  });

  it('normalizes viewed single-question responses and selects the matching override', () => {
    expect(normalizeSingleQuestionViewedResponse('plain answer')).toEqual({
      answer: { value: 'plain answer' },
      additional: { value: '' },
    });

    expect(
      normalizeSingleQuestionViewedResponse({
        questionID: 'Q1',
        response: {
          answerText: 'answer text',
          additionalComment: 'notes',
        },
        importance: 3,
      }),
    ).toEqual({
      questionID: 'Q1',
      response: {
        answerText: 'answer text',
        additionalComment: 'notes',
      },
      answerText: 'answer text',
      additionalComment: 'notes',
      importance: 3,
      answer: { value: 'answer text' },
      additional: { value: 'notes' },
    });

    expect(normalizeSingleQuestionViewedResponse({ random: 'shape' })).toBeNull();

    expect(
      getViewedResponseOverrideForQuestion(
        'q1',
        {
          responses: [{ questionID: 'q2', answer: { value: 'skip' } }, { answer: { value: 'keep' } }],
        },
        '0xABC',
      ),
    ).toEqual({
      questionID: 'q1',
      answer: { value: 'keep' },
      responder: '0xabc',
      responderAddress: '0xabc',
    });
  });

  it('resolves whether question decrypt should use viewed-response mode', () => {
    const getViewedResponseOverrideForQuestion = jest.fn(() => ({
      questionID: 'q1',
      answer: { value: '*' },
    }));

    expect(
      resolveQuestionDecryptHandlingMode(
        {
          questionId: 'q1',
          responseOverride: null,
          viewerAccount: '0xabc',
          viewedResponder: '0xdef',
        },
        {
          getViewedResponseOverrideForQuestion,
        },
      ),
    ).toEqual({
      viewerLower: '0xabc',
      viewedResponderLower: '0xdef',
      effectiveResponseOverride: {
        questionID: 'q1',
        answer: { value: '*' },
      },
      hasResponseOverride: true,
      isViewedResponseMode: true,
    });

    expect(
      resolveQuestionDecryptHandlingMode(
        {
          questionId: 'q1',
          responseOverride: { questionID: 'q1', answer: { value: '*' } },
          viewerAccount: '0xabc',
          viewedResponder: '0xabc',
        },
        {
          getViewedResponseOverrideForQuestion,
        },
      ),
    ).toEqual({
      viewerLower: '0xabc',
      viewedResponderLower: '0xabc',
      effectiveResponseOverride: {
        questionID: 'q1',
        answer: { value: '*' },
      },
      hasResponseOverride: true,
      isViewedResponseMode: false,
    });
  });

  it('deduplicates in-flight decrypt tasks by key on the provided map', async () => {
    const inFlightMap = new Map();
    let resolveTask;
    const runner = jest.fn(
      () =>
        new Promise((resolve) => {
          resolveTask = resolve;
        }),
    );

    const first = runDedupedDecryptTask(inFlightMap, 'task-key', runner);
    const second = runDedupedDecryptTask(inFlightMap, 'task-key', runner);
    await Promise.resolve();

    expect(second).toBe(first);
    expect(runner).toHaveBeenCalledTimes(1);
    expect(inFlightMap.get('task-key')).toBe(first);

    resolveTask(true);
    await first;
    expect(inFlightMap.has('task-key')).toBe(false);
  });

  it('resolves decrypt survey ids from props, scoped envelopes, or fallback defaults', () => {
    const scopedEnvelope = JSON.stringify({ aad: { surveyId: '0xscoped' } });
    const fallbackEnvelope = JSON.stringify({ aad: { surveyId: '0xfallback' } });

    expect(
      resolveDecryptSurveyId(
        {
          answers: {
            q1: { encryptedPortion: scopedEnvelope },
          },
        },
        {
          propSurveyId: '0xprop',
          questionId: 'q1',
          defaultSurveyId: '0x0000',
        },
      ),
    ).toBe('0xprop');

    expect(
      resolveDecryptSurveyId(
        {
          answers: {
            q1: { encryptedPortion: scopedEnvelope },
          },
        },
        {
          questionId: 'q1',
          defaultSurveyId: '0x0000',
        },
      ),
    ).toBe('0xscoped');

    expect(
      resolveDecryptSurveyId(
        {
          answers: {
            q2: { encryptedPortion: fallbackEnvelope },
          },
        },
        {
          questionId: 'q1',
          defaultSurveyId: '0x0000',
        },
      ),
    ).toBe('0xfallback');

    expect(
      resolveDecryptSurveyId(
        { answers: {} },
        {
          questionId: 'q1',
          defaultSurveyId: '0x0000',
        },
      ),
    ).toBe('0x0000');
  });

  it('builds viewed-response decrypt success state without mutating unrelated records', () => {
    const nextViewed = applyDecryptedQuestionResponseValuesToContainer(
      {
        responses: [
          { questionID: 'q2', answer: { value: 'skip' } },
          { questionID: 'q1', answer: { value: '*' }, additional: { value: '*' } },
        ],
      },
      {
        questionId: 'q1',
        decryptedStateSlice: {
          answers: { q1: { value: 'clear answer' } },
          additionalComments: { q1: { value: 'clear notes' } },
        },
        decryptedImportance: 7,
        decryptedConviction: 9,
      },
    );

    expect(nextViewed).toEqual({
      responses: [
        { questionID: 'q2', answer: { value: 'skip' } },
        {
          questionID: 'q1',
          answer: { value: 'clear answer' },
          additional: { value: 'clear notes' },
          importance: 7,
          conviction: 9,
        },
      ],
    });

    expect(
      buildViewedResponseDecryptSuccessState(
        {
          parsedViewAddressAnswers: {
            answer: { value: '*' },
            additional: { value: '*' },
          },
          viewAddressAnswers: '{"stale":true}',
          decryptingByKey: { 'q1:answer': true, 'q1:additional': true },
        },
        {
          questionId: 'q1',
          clearMode: 'both',
          didUpdate: true,
          decryptedStateSlice: {
            answers: { q1: { value: 'clear answer' } },
            additionalComments: { q1: { value: 'clear notes' } },
          },
          decryptedImportance: 7,
          decryptedConviction: 9,
        },
      ),
    ).toEqual({
      parsedViewAddressAnswers: {
        answer: { value: 'clear answer' },
        additional: { value: 'clear notes' },
        importance: 7,
        conviction: 9,
      },
      viewAddressAnswers: JSON.stringify({
        answer: { value: 'clear answer' },
        additional: { value: 'clear notes' },
        importance: 7,
        conviction: 9,
      }),
      isDecrypting: false,
      decryptingByKey: { 'q1:answer': false, 'q1:additional': false },
    });
  });

  it('preserves viewed-response state identity and serialized text when decrypted values do not change', () => {
    const parsedViewAddressAnswers = {
      responses: [{ questionID: 'q1', answer: { value: 'clear answer' } }],
    };

    expect(
      applyDecryptedQuestionResponseValuesToContainer(parsedViewAddressAnswers, {
        questionId: 'q1',
        decryptedStateSlice: {
          answers: { q1: { value: 'clear answer' } },
        },
      }),
    ).toBe(parsedViewAddressAnswers);

    expect(
      buildViewedResponseDecryptSuccessState(
        {
          parsedViewAddressAnswers,
          viewAddressAnswers: '{"already":"serialized"}',
          decryptingByKey: { 'q1:answer': true },
        },
        {
          questionId: 'q1',
          clearMode: 'answer',
          didUpdate: true,
          decryptedStateSlice: {
            answers: { q1: { value: 'clear answer' } },
          },
        },
      ),
    ).toEqual({
      parsedViewAddressAnswers,
      viewAddressAnswers: '{"already":"serialized"}',
      isDecrypting: false,
      decryptingByKey: { 'q1:answer': false },
    });
  });

  it('builds self-response decrypt success state and syncs the edit baseline', () => {
    expect(
      buildSelfQuestionDecryptSuccessState(
        {
          surveysResponseState: [
            {
              answers: { q1: { value: '*', encrypted: true } },
              importance: { q1: 1 },
              conviction: { q1: 2 },
              additionalComments: { q1: { value: '*', encrypted: true } },
            },
          ],
          decryptingByKey: { 'q1:answer': true, 'q1:additional': true },
          editBaseline: null,
        },
        {
          surveyIndex: 0,
          questionId: 'q1',
          clearMode: 'both',
          didUpdate: true,
          baselineSlice: {
            answers: { q1: { value: '*', encryptedPortion: 'ans-env' } },
            additionalComments: { q1: { value: '*', encrypted: true } },
          },
          decryptedStateSlice: {
            answers: { q1: { value: 'clear answer', zkSalt: 'salt-a' } },
            additionalComments: { q1: { value: 'clear notes', zkSalt: 'salt-b' } },
          },
          decryptedImportance: 7,
          decryptedConviction: 9,
        },
        deepClone,
      ),
    ).toEqual({
      surveysResponseState: [
        {
          answers: { q1: { value: 'clear answer', encrypted: true, zkSalt: 'salt-a' } },
          importance: { q1: 7 },
          conviction: { q1: 9 },
          additionalComments: { q1: { value: 'clear notes', encrypted: true, zkSalt: 'salt-b' } },
        },
      ],
      isEditing: true,
      displayAnswerMode: false,
      isDecrypting: false,
      suppressPrefill: true,
      decryptingByKey: { 'q1:answer': false, 'q1:additional': false },
      editBaseline: {
        answers: { q1: { value: 'clear answer', encrypted: true, zkSalt: 'salt-a' } },
        additionalComments: { q1: { value: 'clear notes', encrypted: true, zkSalt: 'salt-b' } },
        importance: { q1: 7 },
        conviction: { q1: 9 },
      },
    });
  });

  it('builds bulk survey decrypt success state and resets edit diffs', () => {
    expect(
      buildSurveyDecryptSuccessState(
        {
          surveysResponseState: [
            {
              answers: { q1: { value: '*', encrypted: true } },
              importance: { q1: 1 },
              conviction: { q1: 2 },
              additionalComments: { q1: { value: '*', encrypted: true } },
            },
          ],
        },
        {
          surveyIndex: 0,
          decryptedSlice: {
            answers: { q1: { value: 'clear answer', encrypted: true, zkSalt: 'salt-a' } },
            importance: { q1: 4 },
            additionalComments: { q1: { value: 'clear notes', encrypted: true, zkSalt: 'salt-b' } },
          },
          decryptedImportanceFromEnv: { q1: 7 },
          decryptedConvictionFromEnv: { q1: 9 },
        },
        deepClone,
      ),
    ).toEqual({
      surveysResponseState: [
        {
          answers: { q1: { value: 'clear answer', encrypted: true, zkSalt: 'salt-a' } },
          importance: { q1: 7 },
          conviction: { q1: 9 },
          additionalComments: { q1: { value: 'clear notes', encrypted: true, zkSalt: 'salt-b' } },
        },
      ],
      startFresh: false,
      displayAnswerMode: false,
      isEditing: true,
      isDecrypting: false,
      suppressPrefill: true,
      editBaseline: {
        answers: { q1: { value: 'clear answer', encrypted: true, zkSalt: 'salt-a' } },
        importance: { q1: 7 },
        conviction: { q1: 9 },
        additionalComments: { q1: { value: 'clear notes', encrypted: true, zkSalt: 'salt-b' } },
      },
      isDirty: false,
      modifiedCount: 0,
    });
  });

  it('normalizes bulk decrypted slices to preserve encrypted intent before merge', () => {
    expect(
      normalizeBulkDecryptedSliceForSurveyState(
        {
          answers: {
            q1: { value: 'clear answer', zkSalt: 'salt-a' },
            q2: { value: 'plain answer' },
          },
          additionalComments: {
            q1: { value: 'clear notes', zkSalt: 'salt-b' },
          },
        },
        {
          previousStateSlice: {
            answers: { q1: { encrypted: true } },
            additionalComments: {},
          },
          baselineSlice: {
            answers: {
              q1: { value: '*', encryptedPortion: 'ans-env' },
              q2: { value: 'plain answer', encrypted: false },
            },
            additionalComments: {
              q1: { value: '*', encrypted: true },
            },
          },
        },
      ),
    ).toEqual({
      answers: {
        q1: { value: 'clear answer', zkSalt: 'salt-a', encrypted: true },
        q2: { value: 'plain answer', encrypted: false },
      },
      additionalComments: {
        q1: { value: 'clear notes', zkSalt: 'salt-b', encrypted: true },
      },
    });
  });

  it('merges response overrides and latest encrypted question fields', () => {
    expect(
      mergeQuestionResponseOverrideIntoDecryptSlice(
        {
          answers: { q1: { value: '*', encrypted: false } },
          additionalComments: { q1: { value: '', encrypted: false } },
        },
        'Q1',
        {
          answer: { value: '*', encryptedPortion: 'ans-env', hash: 'ans-hash' },
          additional: { value: 'notes', encrypted: true, hash: 'add-hash' },
        },
      ),
    ).toEqual({
      answers: { q1: { value: '*', encrypted: true, encryptedPortion: 'ans-env', hash: 'ans-hash' } },
      additionalComments: { q1: { value: 'notes', encrypted: true, hash: 'add-hash' } },
    });

    expect(
      mergeLatestEncryptedQuestionFields(
        {
          answers: { q1: { value: '*', encrypted: false, hash: 'old-a' } },
          additionalComments: { q1: { value: '*', encrypted: true, hash: 'old-b' } },
        },
        'Q1',
        {
          answer: { encrypted: true, hash: 'new-a', encryptedPortion: 'ans-env' },
          additional: { encrypted: false, hash: 'new-b', encryptedPortion: 'add-env' },
        },
        {
          includeAnswer: true,
          includeAdditional: true,
        },
      ),
    ).toEqual({
      answers: { q1: { value: '*', encrypted: true, hash: 'new-a', encryptedPortion: 'ans-env' } },
      additionalComments: { q1: { value: '*', encrypted: true, hash: 'new-b', encryptedPortion: 'add-env' } },
    });
  });

  it('extracts and merges rating envelope state across sources', () => {
    expect(
      getQuestionRatingEnvelopes(
        {
          responses: [
            { questionID: 'q2', importanceEncrypted: 'skip-me' },
            { questionID: 'Q1', convictionEncrypted: 'conv-1' },
          ],
        },
        'q1',
      ),
    ).toEqual({
      importanceEncrypted: '',
      convictionEncrypted: 'conv-1',
    });

    expect(
      mergeQuestionRatingEnvelopeState(
        { importanceEncrypted: 'imp-1', convictionEncrypted: '' },
        { importanceEncrypted: '', convictionEncrypted: 'conv-2' },
        'q1',
      ),
    ).toEqual({
      importanceEncrypted: 'imp-1',
      convictionEncrypted: 'conv-2',
    });
  });

  it('applies decrypted values into response state and baseline copies', () => {
    const decryptedStateSlice = {
      answers: { q1: { value: 'clear answer', zkSalt: 'salt-a' } },
      additionalComments: { q1: { value: 'clear notes', zkSalt: 'salt-b' } },
    };

    expect(
      applyDecryptedQuestionResponseValues(
        {
          answer: { value: '*' },
          additional: { value: '*' },
          importance: 1,
          conviction: 2,
        },
        {
          questionId: 'Q1',
          decryptedStateSlice,
          decryptedImportance: 7,
          decryptedConviction: 9,
        },
      ),
    ).toEqual({
      answer: { value: 'clear answer' },
      additional: { value: 'clear notes' },
      importance: 7,
      conviction: 9,
    });

    const nextTargetStateSlice = applyDecryptedQuestionStateToSurveySlice(
      {
        answers: { q1: { value: '*', encrypted: true } },
        additionalComments: { q1: { value: '*', encrypted: true } },
        importance: { q1: 1 },
        conviction: { q1: 2 },
      },
      {
        questionId: 'Q1',
        baselineSlice: {
          answers: { q1: { value: '*', encryptedPortion: 'ans-env' } },
          additionalComments: { q1: { value: '*', encrypted: true } },
        },
        decryptedStateSlice,
        decryptedImportance: 7,
        decryptedConviction: 9,
      },
    );

    expect(nextTargetStateSlice).toEqual({
      answers: { q1: { value: 'clear answer', encrypted: true, zkSalt: 'salt-a' } },
      additionalComments: { q1: { value: 'clear notes', encrypted: true, zkSalt: 'salt-b' } },
      importance: { q1: 7 },
      conviction: { q1: 9 },
    });

    expect(
      syncDecryptedQuestionIntoBaseline(
        null,
        { answers: {}, importance: {}, conviction: {}, additionalComments: {} },
        nextTargetStateSlice,
        {
          questionId: 'Q1',
          decryptedStateSlice,
          decryptedImportance: 7,
          decryptedConviction: 9,
        },
        deepClone,
      ),
    ).toEqual({
      answers: { q1: { value: 'clear answer', encrypted: true, zkSalt: 'salt-a' } },
      additionalComments: { q1: { value: 'clear notes', encrypted: true, zkSalt: 'salt-b' } },
      importance: { q1: 7 },
      conviction: { q1: 9 },
    });
  });

  it('builds self-response decrypt baselines from current slices or user answers', () => {
    const buildSliceFromUserAnswers = jest.fn(() => ({
      answers: { q1: { value: '*' } },
      additionalComments: { q1: { value: '' } },
    }));

    expect(
      buildSelfQuestionDecryptBaseline(0, [null], { responses: [] }, buildSliceFromUserAnswers, deepClone),
    ).toEqual({
      baselineSlice: {
        answers: { q1: { value: '*' } },
        additionalComments: { q1: { value: '' } },
      },
      baselineForDecrypt: {
        answers: { q1: { value: '*' } },
        additionalComments: { q1: { value: '' } },
        importance: {},
        conviction: {},
      },
    });
  });
});
