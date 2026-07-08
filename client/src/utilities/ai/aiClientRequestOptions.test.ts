import {
  buildAiConfigRequest,
  buildArweaveKeyRequest,
  buildTranscriptionConfigRequest,
  inferAiTaskType,
  pickAiRequestOpts,
  readAiErrorMessage,
  readAiOptionTaskType,
  readAiOptionThinking,
  readAiOptionThrowOnError,
  readArweaveJwkOption,
  readNumericOption,
  resolveAudioSummaryOptions,
  resolveAiSessionOptions,
  resolveAiSessionSelection,
  resolveTranscriptionUploadOptions,
  withAiTaskTypeFallback,
} from './aiClientRequestOptions.js';

describe('aiClientRequestOptions', () => {
  it('copies only worker-safe AI request options', () => {
    expect(
      pickAiRequestOpts({
        context: { requestId: 'req-1' },
        ignored: 'drop-me',
        messages: [{ role: 'user', content: 'hello' }],
        provider: 'openai',
        sessionSlug: 'alpha-session',
        taskType: 'rank',
      }),
    ).toEqual({
      context: { requestId: 'req-1' },
      messages: [{ role: 'user', content: 'hello' }],
      provider: 'openai',
      sessionSlug: 'alpha-session',
      taskType: 'rank',
    });
  });

  it('infers the seed generation task only when no explicit task type exists', () => {
    expect(inferAiTaskType('numberOfSeedStatementsOrPrompts: 3\n{"surveyTitle":"Alpha"}')).toBe('generate');
    expect(inferAiTaskType('anything', { taskType: ' Summarize ' })).toBe('summarize');
  });

  it('resolves session options without losing object-valued context', () => {
    const context = { requestId: 'req-2' };
    const sessionConfig = { sessionName: 'Alpha', slug: 'alpha-session' };

    expect(
      resolveAiSessionOptions({
        context,
        sessionConfig,
        sessionSlug: 'alpha-session',
      }),
    ).toEqual({
      context,
      sessionConfig,
      sessionSlug: 'alpha-session',
    });
  });

  it('normalizes invalid option bags to an empty session envelope', () => {
    const resolved = resolveAiSessionOptions('not-options');

    expect(resolved.context).toBeUndefined();
    expect(resolved.sessionConfig).toBeNull();
    expect(resolved.sessionSlug).toBe('');
  });

  it('preserves session-selection objects for gate fallback decisions', () => {
    const sessionSelection = { gateStatus: 'no-gate', reason: 'open-session' };

    expect(resolveAiSessionSelection({ sessionSelection })).toBe(sessionSelection);
    expect(resolveAiSessionSelection({ sessionSelection: [] })).toBeNull();
    expect(resolveAiSessionSelection({ sessionSelection: 'no-gate' })).toBeNull();
  });

  it('builds AI config requests from the typed option contract', () => {
    const context = { wallet: 'test-context' };

    expect(
      buildAiConfigRequest(
        {
          context,
          model: 'gpt-5',
          preferLocal: true,
          provider: 'openai',
          sessionSlug: 'alpha-session',
        },
        { thinking: 1 },
      ),
    ).toEqual({
      context,
      model: 'gpt-5',
      preferLocal: true,
      provider: 'openai',
      sessionSlug: 'alpha-session',
      thinking: true,
    });
  });

  it('builds transcription config requests without dropping credential fields', () => {
    expect(
      buildTranscriptionConfigRequest({
        apiKey: 'test-key',
        model: 'whisper-1',
        provider: 'openai',
        rpcUrl: 'https://rpc.example',
        sessionSlug: 'alpha-session',
      }),
    ).toEqual({
      apiKey: 'test-key',
      context: undefined,
      model: 'whisper-1',
      preferLocal: undefined,
      provider: 'openai',
      rpcUrl: 'https://rpc.example',
      sessionSlug: 'alpha-session',
    });
  });

  it('normalizes primitive context and preferLocal values before downstream API calls', () => {
    expect(
      buildAiConfigRequest({
        context: 'not-a-wallet-context',
        preferLocal: 'yes',
        sessionSlug: 'alpha-session',
      }),
    ).toEqual({
      context: undefined,
      model: undefined,
      preferLocal: undefined,
      provider: undefined,
      sessionSlug: 'alpha-session',
      thinking: false,
    });
  });

  it('builds Arweave key requests with session config and context intact', () => {
    const context = { requestId: 'req-3' };
    const sessionConfig = { sessionName: 'Alpha', slug: 'alpha-session' };

    expect(
      buildArweaveKeyRequest({
        context,
        preferLocal: false,
        sessionConfig,
        sessionSlug: 'alpha-session',
      }),
    ).toEqual({
      context,
      preferLocal: false,
      sessionConfig,
      sessionSlug: 'alpha-session',
    });
  });

  it('preserves legacy truthy option-control semantics', () => {
    expect(readAiOptionThinking({ thinking: 1 })).toBe(true);
    expect(readAiOptionThrowOnError({ throwOnError: 'yes' })).toBe(true);
    expect(readAiOptionTaskType({ taskType: 'rank' }, 'summarize')).toBe('rank');
    expect(readAiOptionTaskType({ taskType: 0 }, 'summarize')).toBe('summarize');
    expect(withAiTaskTypeFallback({ taskType: '', provider: 'openai' }, 'rewrite')).toEqual({
      provider: 'openai',
      taskType: 'rewrite',
    });
  });

  it('resolves transcription upload controls without accepting numeric strings', () => {
    const signal = new AbortController().signal;

    expect(
      resolveTranscriptionUploadOptions(
        {
          maxUploadBytes: 512,
          signal,
        },
        { defaultMaxUploadBytes: 25 },
      ),
    ).toEqual({
      maxUploadBytes: 1024,
      signal,
    });
    expect(resolveTranscriptionUploadOptions({ maxUploadBytes: '4096' }, { defaultMaxUploadBytes: 25 })).toEqual({
      maxUploadBytes: 25,
      signal: undefined,
    });
  });

  it('reads numeric and summary option contracts without mutating AI call options', () => {
    expect(readNumericOption({ sizeThresholdBytes: 2048 }, 'sizeThresholdBytes')).toBe(2048);
    expect(readNumericOption({ sizeThresholdBytes: '2048' }, 'sizeThresholdBytes')).toBeNull();

    expect(
      resolveAudioSummaryOptions({
        model: 'gpt-5',
        sessionTitle: '  Test Session  ',
        style: '  seminar  ',
        taskType: 'summarize',
      }),
    ).toEqual({
      aiCallOptions: {
        model: 'gpt-5',
        taskType: 'summarize',
      },
      sessionTitle: 'Test Session',
      style: 'seminar',
    });
    expect(resolveAudioSummaryOptions(null)).toEqual({
      aiCallOptions: {},
      sessionTitle: '',
      style: 'reading-group',
    });
  });

  it('preserves Arweave JWK truthiness and error-message fallback semantics', () => {
    expect(readArweaveJwkOption({ arweaveJwk: { kty: 'RSA' } })).toEqual({
      arweaveJwk: { kty: 'RSA' },
      hasArweaveJwk: true,
    });
    expect(readArweaveJwkOption({ arweaveJwk: '' })).toEqual({
      arweaveJwk: '',
      hasArweaveJwk: false,
    });
    expect(readAiErrorMessage({ message: 'specific failure' }, 'fallback')).toBe('specific failure');
    expect(readAiErrorMessage({ message: '' }, 'fallback')).toBe('fallback');
    expect(readAiErrorMessage('not-an-error', 'fallback')).toBe('fallback');
  });
});
