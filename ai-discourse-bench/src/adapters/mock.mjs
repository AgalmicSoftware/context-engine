const ANSWERS = ['Agree', 'Unsure', 'Disagree'];

const hashText = (value) => {
  let hash = 2166136261;
  for (const ch of String(value || '')) {
    hash ^= ch.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

export const callMockModel = async ({ model, prompt }) => {
  const hash = hashText(`${model}:${prompt}`);
  const answer = ANSWERS[hash % ANSWERS.length];
  const confidence = ((hash % 41) + 55) / 100;
  return {
    content: JSON.stringify({
      answer,
      confidence,
      rationale: `Deterministic mock ${model} selected ${answer}.`,
    }),
    metadata: {
      provider: 'mock',
      requestedModel: model,
      resolvedModel: model,
      requestId: `mock-${hash}`,
      finishReason: 'stop',
      usage: null,
      latencyMs: 0,
      endpoint: 'mock://deterministic',
    },
  };
};
