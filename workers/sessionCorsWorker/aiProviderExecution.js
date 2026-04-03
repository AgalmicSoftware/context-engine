import {
  applyChatCompletionBudget,
  isChatReasoningModel,
  resolveResponsesOutputTokens,
  usesOpenAiResponsesApi,
} from './aiModelParams.js';
import {
  json as jsonResponse,
} from './responseKvHelpers.js';
import { toStr } from './stringCoercion.js';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const OPENROUTER_CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions';

export const CUSTOM_RPC_URL_OVERRIDE_REQUIRES_REQUEST_KEY_ERROR =
  'Custom provider rpcUrl override requires a request apiKey/rpcKey.';

const extractOpenAiCompletion = (data, useResponses = false) => {
  if (!data || typeof data !== 'object') return '';
  if (useResponses) {
    if (typeof data.output_text === 'string') return data.output_text;
    if (Array.isArray(data.output)) {
      const parts = [];
      const push = (value) => {
        if (typeof value === 'string' && value.trim() !== '') parts.push(value);
      };
      data.output.forEach((item) => {
        if (!item || typeof item !== 'object') return;
        push(item.text);
        push(item.output_text);
        const content = item.content ?? item.message?.content;
        if (Array.isArray(content)) {
          content.forEach((part) => {
            if (part && typeof part === 'object') {
              push(part.text);
              push(part.output_text);
            } else {
              push(part);
            }
          });
        } else if (content && typeof content === 'object') {
          push(content.text);
          push(content.output_text);
        } else {
          push(content);
        }
      });
      return parts.join('');
    }
    return '';
  }
  return data?.choices?.[0]?.message?.content || '';
};

const normalizeComparableRpcUrl = (raw) => {
  const url = toStr(raw).trim();
  if (!url) return '';
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/\/+$/, '');
    return `${parsed.origin}${path}${parsed.search}`;
  } catch {
    return url.replace(/\/+$/, '');
  }
};

const resolveJson = (deps) => deps?.json || jsonResponse;

export const proxyAnthropic = async ({
  payload,
  secrets,
  baseHeaders,
  deps,
  constants,
} = {}) => {
  const json = resolveJson(deps);
  const fetchImpl = deps?.fetch || fetch;
  const payloadKey = toStr(payload?.apiKey).trim();
  const key = payloadKey || toStr(secrets?.anthropicKey).trim();
  if (!key) {
    return json({ error: 'Server misconfigured: anthropicKey is missing.' }, 401, baseHeaders);
  }

  const {
    model,
    temperature,
    max_tokens,
    messages,
    prompt,
    max_tokens_to_sample,
  } = payload || {};
  const body = messages
    ? {
        model: model || 'claude-3-5-sonnet-20240620',
        temperature: temperature ?? 0.7,
        max_tokens: max_tokens ?? 4096,
        messages,
      }
    : {
        model: model || 'claude-3-5-sonnet-20240620',
        temperature: temperature ?? 0.7,
        max_tokens: max_tokens ?? max_tokens_to_sample ?? 4096,
        messages: [{ role: 'user', content: String(prompt || '') }],
      };

  const response = await fetchImpl(constants?.anthropicUrl || ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'anthropic-version': '2023-06-01',
      'x-api-key': key,
    },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return json({ error: data?.error?.message || 'Anthropic error', details: data }, response.status, baseHeaders);
  }

  const completion = data?.content?.[0]?.text || '';
  return json({ completion, raw: data }, 200, baseHeaders);
};

export const proxyOpenAI = async ({
  payload,
  secrets,
  baseHeaders,
  deps,
  constants,
} = {}) => {
  const json = resolveJson(deps);
  const fetchImpl = deps?.fetch || fetch;
  const payloadKey = toStr(payload?.apiKey).trim();
  const key = payloadKey || toStr(secrets?.openaiKey).trim();
  if (!key) {
    return json({ error: 'Server misconfigured: openaiKey is missing.' }, 401, baseHeaders);
  }

  const {
    model,
    temperature,
    max_tokens,
    max_output_tokens,
    messages,
    prompt,
    response_format,
    max_completion_tokens,
    reasoning_effort,
  } = payload || {};
  const requestedEndpoint = toStr(payload?.endpoint).trim();
  const defaultModel = model || 'gpt-5';
  const useResponses = usesOpenAiResponsesApi({
    provider: 'openai',
    model: defaultModel,
    endpoint: requestedEndpoint,
  });
  const isReasoning = isChatReasoningModel({ model: defaultModel, thinking: payload?.thinking === true });

  const body = useResponses
    ? {
        model: defaultModel,
        input: messages || prompt || '',
      }
    : {
        model: model || (isReasoning ? 'o3-mini' : 'gpt-5'),
        messages: messages || [{ role: 'user', content: String(prompt || '') }],
      };

  if (useResponses) {
    if (response_format) body.text = { format: response_format };
    if (payload?.tools) body.tools = payload.tools;
    if (payload?.functions && !payload?.tools) body.functions = payload.functions;
    if (reasoning_effort) body.reasoning = { effort: reasoning_effort };
    body.max_output_tokens = resolveResponsesOutputTokens({
      max_output_tokens,
      max_completion_tokens,
      max_tokens,
      fallback: 16000,
    });
  } else {
    if (response_format) body.response_format = response_format;
    if (payload?.tools) body.tools = payload.tools;
    if (payload?.functions && !payload?.tools) body.functions = payload.functions;
    const effectiveLeaf = toStr(body.model).toLowerCase().split('/').pop();
    if (reasoning_effort && /^(gpt-5|o[13])/.test(effectiveLeaf)) {
      body.reasoning_effort = reasoning_effort;
    }
    applyChatCompletionBudget({
      body,
      model: body.model,
      thinking: isReasoning,
      max_tokens,
      max_completion_tokens,
      temperature,
    });
  }

  const response = await fetchImpl(
    useResponses
      ? (constants?.openAiResponsesUrl || OPENAI_RESPONSES_URL)
      : (constants?.openAiChatUrl || OPENAI_CHAT_URL),
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
    }
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return json({ error: data?.error?.message || 'OpenAI error', details: data }, response.status, baseHeaders);
  }
  const completion = extractOpenAiCompletion(data, useResponses);
  return json({ completion, raw: data }, 200, baseHeaders);
};

export const proxyOpenRouter = async ({
  payload,
  secrets,
  baseHeaders,
  deps,
  constants,
} = {}) => {
  const json = resolveJson(deps);
  const fetchImpl = deps?.fetch || fetch;
  const payloadKey = toStr(payload?.apiKey).trim();
  const key = payloadKey || toStr(secrets?.openrouterKey).trim();
  if (!key) {
    return json({ error: 'Server misconfigured: openrouterKey is missing.' }, 401, baseHeaders);
  }

  const {
    model,
    temperature,
    max_tokens,
    messages,
    prompt,
    response_format,
    max_completion_tokens,
    reasoning_effort,
  } = payload || {};
  const isReasoning = isChatReasoningModel({ model, thinking: payload?.thinking === true });

  const body = {
    model: model || 'openrouter/auto',
    messages: messages || [{ role: 'user', content: String(prompt || '') }],
  };
  if (response_format) body.response_format = response_format;
  if (payload?.tools) body.tools = payload.tools;
  if (payload?.functions && !payload?.tools) body.functions = payload.functions;
  if (reasoning_effort) body.reasoning_effort = reasoning_effort;

  applyChatCompletionBudget({
    body,
    model: body.model,
    thinking: isReasoning,
    max_tokens,
    max_completion_tokens,
    temperature,
  });

  const headers = {
    'content-type': 'application/json',
    authorization: `Bearer ${key}`,
  };
  const ref = payload?.referer || payload?.referrer || payload?.appUrl || payload?.origin;
  const title = payload?.appName || payload?.title;
  if (ref) headers['HTTP-Referer'] = ref;
  if (title) headers['X-Title'] = title;

  const response = await fetchImpl(constants?.openRouterChatUrl || OPENROUTER_CHAT_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return json({ error: data?.error?.message || 'OpenRouter error', details: data }, response.status, baseHeaders);
  }

  const completion = data?.choices?.[0]?.message?.content || '';
  return json({ completion, raw: data }, 200, baseHeaders);
};

export const proxyCustomRPC = async ({
  payload,
  secrets,
  baseHeaders,
  deps,
  auth,
} = {}) => {
  const json = resolveJson(deps);
  const safeFetch = deps?.safeFetch || fetch;
  const isBlockedOutboundUrl = deps?.isBlockedOutboundUrl || (() => false);
  const payloadRpcUrl = toStr(payload?.rpcUrl).trim();
  const secretRpcUrl = toStr(secrets?.customRpcUrl).trim();
  const payloadKey = toStr(payload?.apiKey || payload?.rpcKey).trim();
  const secretKey = toStr(secrets?.customRpcKey).trim();
  const requestOverridesRpcUrl = (
    !!payloadRpcUrl &&
    normalizeComparableRpcUrl(payloadRpcUrl) !== normalizeComparableRpcUrl(secretRpcUrl)
  );
  if (!payloadKey && requestOverridesRpcUrl && (secretRpcUrl || secretKey)) {
    return json({ error: CUSTOM_RPC_URL_OVERRIDE_REQUIRES_REQUEST_KEY_ERROR }, 400, baseHeaders);
  }

  const rpcUrl = payloadRpcUrl || secretRpcUrl;
  if (!rpcUrl) {
    return json({ error: 'Server misconfigured: customRpcUrl is missing.' }, 400, baseHeaders);
  }
  let parsedRpcUrl;
  try {
    parsedRpcUrl = new URL(rpcUrl);
  } catch {
    return json({ error: 'Custom RPC URL target is not allowed' }, 403, baseHeaders);
  }
  if (parsedRpcUrl.protocol !== 'https:') {
    return json({ error: 'Custom RPC must use HTTPS' }, 403, baseHeaders);
  }
  if (parsedRpcUrl.username || parsedRpcUrl.password) {
    return json({ error: 'Custom RPC URL must not contain credentials' }, 403, baseHeaders);
  }
  if (!auth || !auth?.scopes) {
    return json({ error: 'Custom RPC requires authentication' }, 403, baseHeaders);
  }
  const walletAddress = toStr(auth?.address || auth?.walletAddress || auth?.sub).trim().toLowerCase();
  (typeof deps?.log === 'function' ? deps.log : console.log)('[ai] custom rpc request', {
    walletAddress: walletAddress || null,
    rpcDomain: parsedRpcUrl.hostname,
  });
  if (isBlockedOutboundUrl(rpcUrl)) {
    return json({ error: 'Custom RPC URL target is not allowed' }, 403, baseHeaders);
  }

  const {
    model,
    temperature,
    max_tokens,
    messages,
    prompt,
    response_format,
    max_completion_tokens,
    reasoning_effort,
  } = payload || {};
  const isReasoning = isChatReasoningModel({ model, thinking: payload?.thinking === true });

  const body = {
    model: model || 'gpt-5',
    messages: messages || [{ role: 'user', content: String(prompt || '') }],
  };
  if (response_format) body.response_format = response_format;
  if (payload?.tools) body.tools = payload.tools;
  if (payload?.functions && !payload?.tools) body.functions = payload.functions;
  const effectiveLeaf = toStr(body.model).toLowerCase().split('/').pop();
  if (reasoning_effort && /^(gpt-5|o[13])/.test(effectiveLeaf)) {
    body.reasoning_effort = reasoning_effort;
  }

  applyChatCompletionBudget({
    body,
    model: body.model,
    thinking: isReasoning,
    max_tokens,
    max_completion_tokens,
    temperature,
  });

  const key = payloadKey || secretKey;
  const headers = { 'content-type': 'application/json' };
  if (key) headers.authorization = `Bearer ${key}`;

  const response = await safeFetch(rpcUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!(response instanceof Response)) {
    return json({ error: response?.error }, response?.status, baseHeaders);
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return json({ error: data?.error?.message || 'Custom RPC error', details: data }, response.status, baseHeaders);
  }

  const completion =
    data?.choices?.[0]?.message?.content ||
    data?.completion ||
    data?.content?.[0]?.text ||
    '';
  return json({ completion, raw: data }, 200, baseHeaders);
};
