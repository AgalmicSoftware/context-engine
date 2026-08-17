import {
  DEFAULT_LOCAL_BASE_URL,
  DEFAULT_OPENROUTER_BASE_URL,
  DEFAULT_REQUEST_TIMEOUT_MS,
} from '../config.mjs';

const trimTrailingSlash = (value) => String(value || '').replace(/\/+$/, '');
const autoCapabilityCache = new Map();

export const ANSWER_JSON_SCHEMA = Object.freeze({
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

export const DEFAULT_ANSWER_SYSTEM_PROMPT = 'You answer benchmark survey questions with strict JSON only.';
export const ANSWER_REQUEST_CONTRACT_VERSION = 'openai-compatible-answer-v2';

export const getProviderConfig = (provider, env = process.env) => {
  if (provider === 'local') {
    return {
      baseUrl: trimTrailingSlash(env.AIDB_LOCAL_BASE_URL || env.OPENAI_BASE_URL || DEFAULT_LOCAL_BASE_URL),
      apiKey: env.AIDB_LOCAL_API_KEY || 'local',
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

const responseFormatFor = (mode, responseSchema) => {
  if (mode === 'json_schema' || mode === 'auto') {
    return { type: 'json_schema', json_schema: responseSchema };
  }
  if (mode === 'json_object') return { type: 'json_object' };
  return null;
};

const capabilityErrorStatuses = new Set([400, 404, 415, 422]);
const isStructuredOutputCapabilityError = (status, body) => (
  capabilityErrorStatuses.has(status)
  && /(response[_ -]?format|json[_ -]?schema|structured output).{0,120}(unsupported|not supported|unknown|invalid|unavailable)|(?:unsupported|not supported|unknown).{0,120}(response[_ -]?format|json[_ -]?schema|structured output)/i.test(body)
);

export const callOpenAiCompatibleChat = async ({
  provider,
  model,
  prompt,
  temperature = 0.2,
  maxTokens = 220,
  timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
  structuredOutput = 'auto',
  providerRouting = null,
  responseSchema = ANSWER_JSON_SCHEMA,
  systemPrompt = 'You answer benchmark survey questions with strict JSON only.',
  env = process.env,
  fetchImpl = fetch,
}) => {
  if (!['auto', 'none', 'json_object', 'json_schema'].includes(structuredOutput)) {
    throw new Error('structuredOutput must be auto, none, json_object, or json_schema');
  }
  const config = getProviderConfig(provider, env);
  if (!config.apiKey) {
    throw new Error(`${provider} requires an API key. Set OPENROUTER_API_KEY for OpenRouter or AIDB_LOCAL_API_KEY for local servers that require one.`);
  }
  const startedAtMs = Date.now();
  const effectiveProviderRouting = provider === 'openrouter' && providerRouting
    ? providerRouting
    : null;
  const cacheKey = `${provider}:${config.baseUrl}:${model}:${JSON.stringify(effectiveProviderRouting || {})}`;
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
          ...(responseFormatFor(mode, responseSchema) ? { response_format: responseFormatFor(mode, responseSchema) } : {}),
          ...(effectiveProviderRouting ? { provider: effectiveProviderRouting } : {}),
          messages: [
            {
              role: 'system',
              content: systemPrompt,
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
  let responseErrorBody = '';
  if (!response.ok && structuredOutput === 'auto' && ['auto', 'json_schema'].includes(usedMode)
    && capabilityErrorStatuses.has(response.status)) {
    responseErrorBody = await response.text().catch(() => '');
    if (isStructuredOutputCapabilityError(response.status, responseErrorBody)) {
      fallback = { from: 'json_schema', to: 'none', status: response.status, reason: responseErrorBody.slice(0, 500) };
      usedMode = 'none';
      response = await request(usedMode);
      responseErrorBody = '';
      if (response.ok) autoCapabilityCache.set(cacheKey, 'none');
    }
  } else if (response.ok && structuredOutput === 'auto' && usedMode === 'auto') {
    autoCapabilityCache.set(cacheKey, 'json_schema');
    usedMode = 'json_schema';
  }

  if (!response.ok) {
    const body = responseErrorBody || await response.text().catch(() => '');
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
      providerRouting: effectiveProviderRouting,
      structuredOutput: {
        requested: requestedMode,
        used: usedMode === 'auto' ? 'json_schema' : usedMode,
        fallback,
      },
    },
  };
};
