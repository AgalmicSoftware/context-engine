const AI_REQUEST_OPTION_KEYS = [
  'sessionSlug',
  'sessionConfig',
  'context',
  'workerUrl',
  'preferLocal',
  'provider',
  'model',
  'apiKey',
  'rpcUrl',
  'max_tokens',
  'maxTokens',
  'max_completion_tokens',
  'max_output_tokens',
  'response_format',
  'temperature',
  'endpoint',
  'reasoning_effort',
  'reasoningEffort',
  'taskType',
  'messages',
] as const;

export const inferAiTaskType = (prompt: unknown = '', opts: Record<string, unknown> = {}): string | null => {
  const explicit = String(opts?.taskType || '')
    .trim()
    .toLowerCase();
  if (explicit) return explicit;

  const promptText = String(prompt || '');
  // Older question-generation flows still call `callAI` directly, so fall back
  // to the seed-generation prompt signature when no explicit task type is passed.
  if (/numberOfSeedStatementsOrPrompts:/i.test(promptText) && /"surveyTitle"\s*:/i.test(promptText)) {
    return 'generate';
  }
  return null;
};

export const pickAiRequestOpts = (input: unknown = {}): Record<string, unknown> => {
  const src = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const out: Record<string, unknown> = {};
  const copy = (key: (typeof AI_REQUEST_OPTION_KEYS)[number]) => {
    if (Object.prototype.hasOwnProperty.call(src, key) && src[key] !== undefined) {
      out[key] = src[key];
    }
  };
  AI_REQUEST_OPTION_KEYS.forEach(copy);
  return out;
};
