import { toTrimmedString } from './stringCoercion.js';

export const ANONYMOUS_CUSTOM_RPC_URL_REQUIRED_ERROR =
  'Anonymous custom provider requires request rpcUrl when using apiKey bypass.';

export const DEFAULT_MODEL_WHITELIST = {
  anthropic: ['claude-*'],
  openai: ['gpt-*', 'o1-*', 'o3-*', 'o4-*', 'chatgpt-*'],
  openrouter: null,
};

export const inferAiProviderFromModel = (modelRaw) => {
  const model = toTrimmedString(modelRaw).toLowerCase();
  if (!model) return '';
  if (model.startsWith('claude')) return 'anthropic';
  if (/^(gpt-|o[1-9]|chatgpt)/.test(model)) return 'openai';
  if (model.includes('/')) return 'openrouter';
  return '';
};

const matchesModelGlob = (model, pattern) => {
  const normalizedModel = toTrimmedString(model).toLowerCase();
  const normalizedPattern = toTrimmedString(pattern).toLowerCase();
  if (!normalizedModel || !normalizedPattern) return false;
  if (!normalizedPattern.includes('*')) return normalizedModel === normalizedPattern;
  const escapedPattern = normalizedPattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escapedPattern.replace(/\*/g, '.*')}$`).test(normalizedModel);
};

export const isModelAllowed = (model, provider, customWhitelist = null) => {
  const whitelist = customWhitelist && typeof customWhitelist === 'object'
    ? customWhitelist
    : DEFAULT_MODEL_WHITELIST;
  const providerKey = toTrimmedString(provider).toLowerCase();
  const patterns = whitelist?.[providerKey];
  if (patterns == null) return true;
  if (!Array.isArray(patterns)) return false;
  return patterns.some((pattern) => matchesModelGlob(model, pattern));
};

export const resolveAiProvider = (payload) => {
  const explicit = toTrimmedString(payload?.provider).toLowerCase();
  if (explicit && explicit !== 'default' && explicit !== 'auto') return explicit;
  return inferAiProviderFromModel(payload?.model) || 'openai';
};

export const normalizeAiRequestPayload = ({ payload } = {}) => ({
  ok: true,
  status: 200,
  error: '',
  payload,
  provider: resolveAiProvider(payload),
  requestApiKey: toTrimmedString(payload?.apiKey),
  requestRpcUrl: toTrimmedString(payload?.rpcUrl),
});

export const readAiRequestPayload = async ({ request } = {}) => {
  const contentType = request?.headers?.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return {
      ok: false,
      status: 400,
      error: 'Expected application/json.',
      payload: null,
      provider: '',
      requestApiKey: '',
      requestRpcUrl: '',
    };
  }

  let payload = null;
  try {
    payload = await request.json();
  } catch {
    return {
      ok: false,
      status: 400,
      error: 'Invalid JSON.',
      payload: null,
      provider: '',
      requestApiKey: '',
      requestRpcUrl: '',
    };
  }

  return normalizeAiRequestPayload({ payload });
};

export const validateAnonymousAiRequest = ({
  provider = '',
  requestRpcUrl = '',
  anonymousAccessReason = '',
} = {}) => {
  if (anonymousAccessReason === 'request-api-key' && provider === 'custom' && !toTrimmedString(requestRpcUrl)) {
    return {
      ok: false,
      status: 400,
      error: ANONYMOUS_CUSTOM_RPC_URL_REQUIRED_ERROR,
    };
  }

  return {
    ok: true,
    status: 200,
    error: '',
  };
};
