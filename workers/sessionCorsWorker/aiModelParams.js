import { isOpenAiReasoningModel } from '../../shared/aiModelFamily.mjs';

export { usesOpenAiResponsesApi } from '../../shared/aiModelFamily.mjs';

export const isChatReasoningModel = ({ model = '', thinking = false } = {}) => (
  thinking === true || isOpenAiReasoningModel(model)
);

export const applyChatCompletionBudget = ({
  body,
  model = '',
  thinking = false,
  max_tokens,
  max_completion_tokens,
  temperature,
  defaultMaxCompletionTokens = 16000,
  defaultMaxTokens = 2048,
  defaultTemperature = 0.7,
} = {}) => {
  const target = body && typeof body === 'object' ? body : {};
  if (isChatReasoningModel({ model, thinking })) {
    target.max_completion_tokens = max_completion_tokens ?? max_tokens ?? defaultMaxCompletionTokens;
    delete target.max_tokens;
    delete target.temperature;
    return target;
  }
  target.max_tokens = max_tokens ?? defaultMaxTokens;
  target.temperature = temperature !== undefined ? temperature : defaultTemperature;
  delete target.max_completion_tokens;
  return target;
};

export const resolveResponsesOutputTokens = ({
  max_output_tokens,
  max_completion_tokens,
  max_tokens,
  fallback = 16000,
} = {}) => (
  max_output_tokens ?? max_completion_tokens ?? max_tokens ?? fallback
);
