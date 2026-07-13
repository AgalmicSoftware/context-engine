import {
  DEFAULT_LOCAL_BASE_URL,
  DEFAULT_OPENROUTER_BASE_URL,
  DEFAULT_REQUEST_TIMEOUT_MS,
} from '../config.mjs';

const trimTrailingSlash = (value) => String(value || '').replace(/\/+$/, '');
const autoCapabilityCache = new Map();

const ANSWER_JSON_SCHEMA = Object.freeze({
  name: 'ai_discourse_bench_answer',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['answer', 'confidence', 'rationale'],
    properties: {
      answer: { type: 'string', enum: ['Agree', 'Unsure', 'Disagree'] },
      confidence: { type: 'number', minimum: 0, maximum: 1 },
      rationale: { type: 'string' },
    },
  },
});

const getProviderConfig = (provider, env = process.env) => {
  if (provider === 'local') {
    return {
      baseUrl: trimTrailingSlash(env.AIDB_LOCAL_BASE_URL || env.OPENAI_BASE_URL || DEFAULT_LOCAL_BASE_URL),
      apiKey: env.AIDB_LOCAL_API_KEY || env.OPENAI_API_KEY || 'local',
      headers: {},
    };
  }
  if (provider === 'openrouter') {
    return {
      baseUrl: trimTrailingSlash(env.OPENROUTER_BASE_URL || DEFAULT_OPENROUTER_BASE_URL),
      apiKey: env.OPENROUTER_API_KEY,
      headers: {
        ...(env.OPENROUTER_SITE_URL ? { 'HTTP-Referer': env.OPENROUTER_SITE_URL } : {}),
        ...(env.OPENROUTER_APP_NAME ? { 'X-Title': env.OPENROUTER_APP_NAME } : { 'X-Title': 'ai-discourse-bench' }),
      },
    };
  }
  throw new Error(`Unsupported OpenAI-compatible provider: ${provider}`);
};

const responseFormatFor = (mode) => {
  if (mode === 'json_schema' || mode === 'auto') {
    return { type: 'json_schema', json_schema: ANSWER_JSON_SCHEMA };
  }
  if (mode === 'json_object') return { type: 'json_object' };
  return null;
};

const capabilityErrorStatuses = new Set([400, 404, 415, 422]);

export const callOpenAiCompatibleChat = async ({
  provider,
  model,
  prompt,
  temperature = 0.2,
  maxTokens = 220,
  timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
  structuredOutput = 'auto',
  env = process.env,
  fetchImpl = fetch,
}) => {
  if (!['auto', 'none', 'json_object', 'json_schema'].includes(structuredOutput)) {
    throw new Error('structuredOutput must be auto, none, json_object, or json_schema');
  }
  const config = getProviderConfig(provider, env);
  if (!config.apiKey) {
    throw new Error(`${provider} requires an API key. Set OPENROUTER_API_KEY for OpenRouter or AIDB_LOCAL_API_KEY/OPENAI_API_KEY for local servers that require one.`);
  }
  const startedAtMs = Date.now();
  const cacheKey = `${provider}:${config.baseUrl}:${model}`;
  const cachedAutoMode = structuredOutput === 'auto' ? autoCapabilityCache.get(cacheKey) : null;
  const requestedMode = structuredOutput;
  let usedMode = cachedAutoMode || structuredOutput;
  let fallback = null;

  const request = async (mode) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetchImpl(`${config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${config.apiKey}`,
          ...config.headers,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          temperature,
          max_tokens: maxTokens,
          ...(responseFormatFor(mode) ? { response_format: responseFormatFor(mode) } : {}),
          messages: [
            {
              role: 'system',
              content: 'You answer benchmark survey questions with strict JSON only.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
        }),
      });
    } catch (error) {
      if (controller.signal.aborted) {
        const timeoutError = new Error(`${provider} ${model} request timed out after ${timeoutMs}ms`);
        timeoutError.code = 'AIDB_REQUEST_TIMEOUT';
        throw timeoutError;
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  };

  let response = await request(usedMode);
  if (!response.ok && structuredOutput === 'auto' && ['auto', 'json_schema'].includes(usedMode)
    && capabilityErrorStatuses.has(response.status)) {
    const body = await response.text().catch(() => '');
    fallback = { from: 'json_schema', to: 'none', status: response.status, reason: body.slice(0, 500) };
    autoCapabilityCache.set(cacheKey, 'none');
    usedMode = 'none';
    response = await request(usedMode);
  } else if (response.ok && structuredOutput === 'auto' && usedMode === 'auto') {
    autoCapabilityCache.set(cacheKey, 'json_schema');
    usedMode = 'json_schema';
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    const requestError = new Error(`${provider} ${model} request failed with HTTP ${response.status}: ${body.slice(0, 500)}`);
    requestError.status = response.status;
    requestError.retryable = response.status === 408 || response.status === 409 || response.status === 429 || response.status >= 500;
    throw requestError;
  }
  const data = await response.json();
  const choice = data?.choices?.[0] || {};
  return {
    content: choice?.message?.content || '',
    metadata: {
      provider,
      resolvedProvider: data?.provider || provider,
      requestedModel: model,
      resolvedModel: data?.model || model,
      systemFingerprint: data?.system_fingerprint || null,
      requestId: response.headers?.get?.('x-request-id') || response.headers?.get?.('cf-ray') || null,
      finishReason: choice?.finish_reason || null,
      usage: data?.usage || null,
      latencyMs: Date.now() - startedAtMs,
      endpoint: config.baseUrl,
      structuredOutput: {
        requested: requestedMode,
        used: usedMode === 'auto' ? 'json_schema' : usedMode,
        fallback,
      },
    },
  };
};
