import {
  fitReasoningEffort,
  interviewMapOutputTokens,
  isOpenAiReasoningModel,
  takesReasoningEffort,
  usesOpenAiResponsesApi,
} from '../../../../shared/aiModelFamily.mjs';

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
  const usesResponsesApi = usesOpenAiResponsesApi({ provider, model });
  const usesCompletionTokens = !usesResponsesApi && isOpenAiReasoningModel(model);
  const messages = Array.isArray(opts.messages) ? opts.messages : [{ role: 'user', content: prompt }];
  // Interview mapping asks for what its model takes. Otherwise Claude, which
  // counts its thinking toward max_tokens, gets the larger default.
  const maxTokens =
    opts.max_tokens ??
    opts.maxTokens ??
    (taskType === 'interview-map' ? interviewMapOutputTokens(model) : provider === 'anthropic' ? 32768 : 16384);
  const maxOutputTokens = opts.max_output_tokens ?? (usesResponsesApi ? maxTokens : undefined);
  const maxCompletionTokens = opts.max_completion_tokens ?? (usesCompletionTokens ? maxTokens : undefined);
  // A JSON schema goes only to OpenAI and Claude; other providers rely on the prompt's description.
  // The Responses API takes the schema's fields at the top of the format, and released
  // Workers pass the format to it unchanged, so the client sends that flat form itself.
  const format = asRecord(opts.response_format);
  const jsonSchema = asRecord(format.json_schema);
  const responseFormat =
    format.type !== 'json_schema'
      ? opts.response_format
      : provider !== 'openai' && provider !== 'anthropic'
        ? null
        : usesResponsesApi && Object.keys(jsonSchema).length
          ? { type: 'json_schema', ...jsonSchema }
          : opts.response_format;

  const requestBody: UnknownRecord = {
    action: 'ai',
    ...(taskType ? { taskType } : {}),
    provider,
    // A session that names no model lets its Worker pick its own fallback.
    ...(ai.requestModel === '' ? {} : { model }),
    ...(usesResponsesApi ? { endpoint: 'responses' } : {}),
    ...maybeNumberProp('max_output_tokens', maxOutputTokens),
    ...maybeNumberProp('max_completion_tokens', maxCompletionTokens),
    ...(!usesResponsesApi && !usesCompletionTokens && typeof maxTokens === 'number' ? { max_tokens: maxTokens } : {}),
    ...(responseFormat ? { response_format: responseFormat } : {}),
    // Current Claude models refuse temperature, and the Worker sends them none.
    ...(!usesResponsesApi && !usesCompletionTokens && provider !== 'anthropic'
      ? typeof opts.temperature === 'number'
        ? { temperature: opts.temperature }
        : { temperature: 0.7 }
      : {}),
    ...(provider === 'openai' && ['fast', 'priority', 'default', 'auto'].includes(String(opts.service_tier))
      ? { service_tier: opts.service_tier }
      : provider === 'openai'
        ? { service_tier: 'default' }
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
  if (takesReasoningEffort(model)) {
    requestBody.reasoning_effort = fitReasoningEffort(model, reasoningEffort);
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

export const readAiWorkerFirstMessageContentLength = (messages: unknown): number => {
  const list = Array.isArray(messages) ? messages : [];
  const content = asRecord(list[0]).content;
  if (typeof content === 'string' || Array.isArray(content)) return content.length;
  const length = asRecord(content).length;
  return typeof length === 'number' ? length : 0;
};
