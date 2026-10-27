import { DEFAULT_AI_MODEL } from '../../shared/aiDefaults.mjs';
import { isChatReasoningModel, usesOpenAiResponsesApi } from './aiModelParams.js';

const trim = (value) => typeof value === 'string' ? value.trim() : '';
const record = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const tasks = new Set(['generate', 'rewrite', 'summarize', 'rank', 'analysis', 'compare', 'categorize', 'interview-map', 'interview-opening']);
const taskName = (payload) => tasks.has(payload?.taskType) ? payload.taskType : '';
const modelEntry = (entry, provider, fallback = DEFAULT_AI_MODEL) => {
  const obj = record(entry);
  return {
    model: trim(obj.model || obj.name || obj.value || entry) || fallback,
    provider: (trim(obj.provider) || provider || 'openai').toLowerCase(),
  };
};

const configuredModels = (config, task) => {
  const ai = record(config?.ai);
  const models = record(ai.models);
  const providers = record(ai.modelProviders);
  const provider = trim(ai.mode || ai.provider).toLowerCase() || 'openai';
  const fallback = trim(ai.model) || DEFAULT_AI_MODEL;
  const fast = modelEntry(models.fast || models.default, trim(providers.fast || providers.default) || provider, fallback);
  const thinking = modelEntry(models.thinking || models.reasoning, trim(providers.thinking || providers.reasoning) || provider, fallback);
  const feature = task && models[task] ? modelEntry(models[task], trim(providers[task]) || provider, fallback) : null;
  return { fast, thinking, feature, ...(trim(ai.model) ? { default: modelEntry(ai.model, provider) } : {}) };
};

export const resolveSessionAiModel = (config, { taskType = '', modelType = 'fast' } = {}) => {
  const models = configuredModels(config, tasks.has(taskType) ? taskType : '');
  return models.feature || models[modelType === 'thinking' ? 'thinking' : 'fast'];
};

export const AI_MODEL_NOT_ALLOWED = Object.freeze({
  error: 'This model is not allowed on the session\'s AI key. Use the session model or your own key.',
  reason: 'ai_model_not_allowed',
});

export const isSessionTranscriptionModelAllowed = ({ config, provider, model }) => {
  const ai = record(config?.ai);
  const entry = record(ai.models?.transcription || ai.transcription);
  return provider === (trim(entry.provider).toLowerCase() || 'openai') && model === (trim(entry.model) || 'whisper-1');
};

// These are per-call ceilings, not allowances. Labels are caller-controlled but
// can select only these bounded operations, never a caller-supplied maximum.
// Built-ins using the common 16,384-token (Anthropic 32,568) transport
// default retain up to 16,000; reports and interview tasks keep smaller bounds.
const operationCeilings = Object.freeze({
  generate: 16000, rewrite: 16000, summarize: 16000, rank: 16000, compare: 16000, categorize: 16000,
  analysis: 7000, 'interview-map': 8000, 'interview-opening': 600,
});
const tokenFields = ['max_tokens', 'max_completion_tokens', 'max_output_tokens', 'max_tokens_to_sample', 'maxTokens'];
const effortOrder = ['none', 'minimal', 'low', 'medium', 'high'];
const configuredFunctions = (config) => {
  const value = config?.ai?.providers?.custom?.functions ?? config?.ai?.custom?.functions;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return value.trim() || undefined; }
};

export const boundSessionAiRequest = ({ payload = {}, provider, config, requestKey = '' }) => {
  // Determine the payer from the key the adapter actually uses. A rejected BYO
  // key must never be retried with session credentials or treated as funded.
  if (requestKey) return { ok: true, payload };
  const task = taskName(payload);
  const models = configuredModels(config, task);
  const allowed = Object.values(models).filter((entry) => entry?.provider === provider);
  const model = trim(payload.model) || (models.feature?.provider === provider ? models.feature.model : allowed[0]?.model);
  if (!model || !allowed.some((entry) => entry.model === model)) return { ok: false, ...AI_MODEL_NOT_ALLOWED };

  const reasoning = isChatReasoningModel({ model }) ||
    (models.thinking.provider === provider && models.thinking.model === model);
  const responses = usesOpenAiResponsesApi({ provider, model, endpoint: payload.endpoint });
  const ceiling = operationCeilings[task] || (reasoning || responses ? 16000 : 2048);
  const requested = tokenFields.filter((key) => Object.hasOwn(payload, key)).map((key) => {
    const value = payload[key];
    return typeof value === 'number' && Number.isFinite(value) && value >= 1 ? Math.floor(value) : ceiling;
  });
  const tokens = Math.min(ceiling, ...requested);
  const ai = record(config?.ai);
  const savedEffort = ai.taskReasoningEffort?.[task] || (task === 'analysis' && ai.taskReasoningEffort?.generate) || ai.reasoningEffort || ai.reasoning_effort || 'low';
  const maximumEffort = ['low', 'medium', 'high'].includes(savedEffort) ? savedEffort : 'low';
  const requestedEffort = trim(payload.reasoning_effort || payload.reasoningEffort || payload.reasoning?.effort);
  const effort = effortOrder.includes(requestedEffort) && effortOrder.indexOf(requestedEffort) < effortOrder.indexOf(maximumEffort)
    ? requestedEffort : maximumEffort;
  const bounded = { ...payload, model, service_tier: 'default', reasoning_effort: effort, thinking: reasoning };
  // Normalize every alias together, including aliases an individual adapter
  // ignores, so conflicting names cannot bypass a smaller requested bound.
  for (const key of tokenFields) bounded[key] = tokens;
  delete bounded.tools;
  delete bounded.functions;
  if (provider === 'custom') {
    const functions = configuredFunctions(config);
    if (functions) bounded.functions = functions;
  }
  return { ok: true, payload: bounded };
};
