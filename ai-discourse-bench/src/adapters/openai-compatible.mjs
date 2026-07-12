import {
  DEFAULT_LOCAL_BASE_URL,
  DEFAULT_OPENROUTER_BASE_URL,
  DEFAULT_REQUEST_TIMEOUT_MS,
} from '../config.mjs';

const trimTrailingSlash = (value) => String(value || '').replace(/\/+$/, '');

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

export const callOpenAiCompatibleChat = async ({
  provider,
  model,
  prompt,
  temperature = 0.2,
  maxTokens = 220,
  timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
  env = process.env,
  fetchImpl = fetch,
}) => {
  const config = getProviderConfig(provider, env);
  if (!config.apiKey) {
    throw new Error(`${provider} requires an API key. Set OPENROUTER_API_KEY for OpenRouter or AIDB_LOCAL_API_KEY/OPENAI_API_KEY for local servers that require one.`);
  }
  const controller = new AbortController();
  const startedAtMs = Date.now();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetchImpl(`${config.baseUrl}/chat/completions`, {
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
      requestedModel: model,
      resolvedModel: data?.model || model,
      requestId: response.headers?.get?.('x-request-id') || response.headers?.get?.('cf-ray') || null,
      finishReason: choice?.finish_reason || null,
      usage: data?.usage || null,
      latencyMs: Date.now() - startedAtMs,
      endpoint: config.baseUrl,
    },
  };
};
