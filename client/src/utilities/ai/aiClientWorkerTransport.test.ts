import {
  buildAiWorkerRequestPlan,
  parseAiWorkerCompletion,
  readAiWorkerFirstMessageContentLength,
  resolveAiWorkerEndpoint,
} from './aiClientWorkerTransport';

describe('aiClientWorkerTransport', () => {
  it('builds responses-api token budgets for gpt-5 worker requests', () => {
    const plan = buildAiWorkerRequestPlan({
      ai: {
        provider: 'openai',
        model: 'gpt-5',
        apiKeySource: 'worker',
        taskReasoningEffort: { summarize: 'low' },
      },
      prompt: 'Summarize this.',
      opts: { maxTokens: 321 },
      taskType: 'summarize',
    });

    expect(plan).toEqual(
      expect.objectContaining({
        endpointLabel: 'responses',
        maxTokens: 321,
        shouldUseAnonymousFirst: true,
        tokenBudgetKey: 'max_output_tokens',
      }),
    );
    expect(plan.requestBody).toEqual(
      expect.objectContaining({
        action: 'ai',
        endpoint: 'responses',
        max_output_tokens: 321,
        messages: [{ role: 'user', content: 'Summarize this.' }],
        model: 'gpt-5',
        provider: 'openai',
        reasoning_effort: 'low',
      }),
    );
    expect(plan.requestBody).not.toHaveProperty('max_completion_tokens');
    expect(plan.requestBody).not.toHaveProperty('max_tokens');
  });

  it('keeps custom local-api-key requests off anonymous-first fallback', () => {
    const plan = buildAiWorkerRequestPlan({
      ai: {
        provider: 'custom',
        model: 'local-model',
        apiKeySource: 'local',
        apiKey: 'sk-local',
        customRpcUrl: '',
        customFunctionsParsed: [{ name: 'lookup' }],
      },
      prompt: 'Call tool.',
      opts: { temperature: 0.2 },
    });

    expect(plan.shouldUseAnonymousFirst).toBe(false);
    expect(plan.requestBody).toEqual(
      expect.objectContaining({
        apiKey: 'sk-local',
        functions: [{ name: 'lookup' }],
        max_tokens: 16384,
        temperature: 0.2,
      }),
    );
    expect(plan.requestBody).not.toHaveProperty('rpcUrl');
  });

  it('normalizes worker endpoints without losing the base worker URL', () => {
    expect(resolveAiWorkerEndpoint('https://worker.example')).toEqual({
      endpoint: 'https://worker.example/ai',
      baseUrl: 'https://worker.example',
    });
    expect(resolveAiWorkerEndpoint('https://worker.example/ai')).toEqual({
      endpoint: 'https://worker.example/ai',
      baseUrl: 'https://worker.example',
    });
  });

  it('parses worker completion response shapes and rejects unknown shapes', () => {
    const completionObject = { text: 'raw worker value' };
    expect(parseAiWorkerCompletion({ completion: 'ok' })).toBe('ok');
    expect(parseAiWorkerCompletion({ completion: completionObject })).toBe(completionObject);
    expect(parseAiWorkerCompletion({ content: [{ text: 'content text' }] })).toBe('content text');
    expect(() => parseAiWorkerCompletion({ content: [] })).toThrow('Unexpected AI response format');
  });

  it('reads the first message content length for logging without assuming shape', () => {
    expect(readAiWorkerFirstMessageContentLength([{ content: 'hello' }])).toBe(5);
    expect(readAiWorkerFirstMessageContentLength([{ content: ['hello', 'there'] }])).toBe(2);
    expect(readAiWorkerFirstMessageContentLength([{ content: { length: 7 } }])).toBe(7);
    expect(readAiWorkerFirstMessageContentLength([{ content: { length: '7' } }])).toBe(0);
    expect(readAiWorkerFirstMessageContentLength('not-messages')).toBe(0);
  });
});

it('routes fast Astra mapping through Responses with low effort and no sampling parameters', () => {
  const plan = buildAiWorkerRequestPlan({
    ai: { provider: 'openai', model: 'gpt-6-astra' },
    opts: { reasoningEffort: 'low', service_tier: 'fast', temperature: 0.1, maxTokens: 8000 },
  });
  expect(plan.requestBody).toMatchObject({
    endpoint: 'responses',
    model: 'gpt-6-astra',
    reasoning_effort: 'low',
    service_tier: 'fast',
    max_output_tokens: 8000,
  });
  expect(plan.requestBody).not.toHaveProperty('temperature');
  expect(plan.requestBody).not.toHaveProperty('max_tokens');
});

it('requests standard processing for Terra unless explicitly overridden', () => {
  const plan = buildAiWorkerRequestPlan({ ai: { model: 'gpt-5.6-terra', provider: 'openai', reasoningEffort: 'low' } });
  expect(plan.requestBody).toMatchObject({
    endpoint: 'responses',
    model: 'gpt-5.6-terra',
    service_tier: 'default',
    reasoning_effort: 'low',
  });
  expect(plan.requestBody).not.toHaveProperty('temperature');
});

it('sends the higher interview mapping effort even when the session default is low', () => {
  const plan = buildAiWorkerRequestPlan({
    ai: { model: 'gpt-5.6-terra', provider: 'openai', reasoningEffort: 'low' },
    taskType: 'interview-map',
    opts: { reasoningEffort: 'medium', service_tier: 'default' },
  });
  expect(plan.requestBody).toMatchObject({
    model: 'gpt-5.6-terra',
    endpoint: 'responses',
    reasoning_effort: 'medium',
    service_tier: 'default',
  });
});
