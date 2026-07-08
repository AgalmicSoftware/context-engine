import { isChatReasoningModel, usesOpenAiResponsesApi } from './aiClientPhotoSupport';

type UnknownRecord = Record<string, unknown>;

export type AiWorkerRequestPlan = {
  endpointLabel: 'responses' | 'chat_completions';
  maxTokens: unknown;
  messages: unknown[];
  requestBody: UnknownRecord;
  shouldUseAnonymousFirst: boolean;
  tokenBudgetKey: 'max_output_tokens' | 'max_completion_tokens' | 'max_tokens';
};

export type AiWorkerEndpointPlan = {
  baseUrl: string;
  endpoint: string;
};

const asRecord = (value: unknown): UnknownRecord =>
  value && typeof value === 'object' ? (value as UnknownRecord) : {};

const asString = (value: unknown): string => String(value || '');

const maybeNumberProp = (key: string, value: unknown): UnknownRecord =>
  typeof value === 'number' ? { [key]: value } : {};

const taskReasoningEffort = (ai: UnknownRecord, taskType: unknown): unknown => {
  if (!taskType) return null;
  const effortByTask = asRecord(ai.taskReasoningEffort);
  return effortByTask[String(taskType)] || null;
};

export const buildAiWorkerRequestPlan = ({
  ai: aiInput = {},
  prompt = '',
  opts: optsInput = {},
  taskType = null,
}: {
  ai?: unknown;
  prompt?: unknown;
  opts?: unknown;
  taskType?: unknown;
} = {}): AiWorkerRequestPlan => {
  const ai = asRecord(aiInput);
  const opts = asRecord(optsInput);
  const provider = ai.provider;
  const model = ai.model;
  const usesResponsesApi = usesOpenAiResponsesApi(provider, model);
  const usesCompletionTokens = !usesResponsesApi && isChatReasoningModel(model);
  const messages = Array.isArray(opts.messages) ? opts.messages : [{ role: 'user', content: prompt }];
  const maxTokens = opts.max_tokens ?? opts.maxTokens ?? (provider === 'anthropic' ? 32568 : 16384);
  const maxOutputTokens = opts.max_output_tokens ?? (usesResponsesApi ? maxTokens : undefined);
  const maxCompletionTokens = opts.max_completion_tokens ?? (usesCompletionTokens ? maxTokens : undefined);

  const requestBody: UnknownRecord = {
    action: 'ai',
    provider,
    model,
    ...(usesResponsesApi ? { endpoint: 'responses' } : {}),
    ...maybeNumberProp('max_output_tokens', maxOutputTokens),
    ...maybeNumberProp('max_completion_tokens', maxCompletionTokens),
    ...(!usesResponsesApi && !usesCompletionTokens && typeof maxTokens === 'number' ? { max_tokens: maxTokens } : {}),
    ...(opts.response_format ? { response_format: opts.response_format } : {}),
    ...(!usesResponsesApi && !usesCompletionTokens
      ? typeof opts.temperature === 'number'
        ? { temperature: opts.temperature }
        : { temperature: 0.7 }
      : {}),
    messages,
    ...(opts.thinking && provider === 'anthropic' ? { thinking: true } : {}),
  };

  const reasoningEffort =
    opts.reasoning_effort ||
    opts.reasoningEffort ||
    taskReasoningEffort(ai, taskType) ||
    ai.reasoning_effort ||
    ai.reasoningEffort ||
    'medium';
  const modelLeaf = asString(model).toLowerCase().split('/').pop();
  if (modelLeaf && /^(gpt-5|o[13])/.test(modelLeaf)) {
    requestBody.reasoning_effort = reasoningEffort;
  }

  const useLocalOverride = ai.apiKeySource === 'local';
  if (useLocalOverride && ai.apiKey) {
    requestBody.apiKey = ai.apiKey;
  }
  if (provider === 'custom') {
    if (ai.customFunctionsParsed) requestBody.functions = ai.customFunctionsParsed;
    else if (ai.customFunctions) requestBody.functions = ai.customFunctions;
    if (useLocalOverride && ai.customRpcUrl) requestBody.rpcUrl = ai.customRpcUrl;
  }

  const shouldUseAnonymousFirst = !(
    provider === 'custom' &&
    useLocalOverride &&
    !!asString(ai.apiKey).trim() &&
    !asString(ai.customRpcUrl).trim()
  );

  return {
    endpointLabel: usesResponsesApi ? 'responses' : 'chat_completions',
    maxTokens,
    messages,
    requestBody,
    shouldUseAnonymousFirst,
    tokenBudgetKey: usesResponsesApi
      ? 'max_output_tokens'
      : usesCompletionTokens
        ? 'max_completion_tokens'
        : 'max_tokens',
  };
};

export const resolveAiWorkerEndpoint = (corsWorkerUrl: unknown): AiWorkerEndpointPlan => {
  const workerUrl = asString(corsWorkerUrl);
  return {
    endpoint: workerUrl.endsWith('/ai') ? workerUrl : `${workerUrl.replace(/\/+$/, '')}/ai`,
    baseUrl: workerUrl.replace(/\/+$/, '').replace(/\/ai$/i, ''),
  };
};

export const parseAiWorkerCompletion = (data: unknown): string => {
  const record = asRecord(data);
  if (record.completion) return record.completion as string;
  const content = Array.isArray(record.content) ? record.content : [];
  const first = asRecord(content[0]);
  if (first.text) return first.text as string;
  throw new Error('Unexpected AI response format');
};
