import {
  buildAiConfigRequest,
  buildArweaveKeyRequest,
  buildTranscriptionConfigRequest,
  inferAiTaskType,
  pickAiRequestOpts,
  resolveAiSessionOptions,
  resolveAiSessionSelection,
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
});
