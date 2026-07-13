import { buildQuestionPrompt } from './normalize.mjs';
import { hashJson } from './provenance.mjs';

const round = (value, digits = 4) => Number(value.toFixed(digits));
const estimateTokens = (text) => Math.ceil(String(text || '').length / 4);

const providerReadiness = (provider, env) => {
  if (provider === 'mock') return { configured: true, requirement: 'none' };
  if (provider === 'local') {
    return {
      configured: true,
      requirement: 'OpenAI-compatible local server must be running',
      endpoint: env.AIDB_LOCAL_BASE_URL || env.OPENAI_BASE_URL || 'http://127.0.0.1:8000/v1',
    };
  }
  return {
    configured: Boolean(env.OPENROUTER_API_KEY),
    requirement: 'OPENROUTER_API_KEY',
    endpoint: env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
  };
};

export const buildExperimentPlan = ({
  questionBank,
  modelRoster,
  mode = 'self',
  persona = null,
  providerOverride = '',
  repeats = 10,
  env = process.env,
}) => {
  const prompts = (questionBank.questions || []).flatMap((question) => (
    ['canonical', 'reversed'].map((polarity) => buildQuestionPrompt({ question, mode, persona, polarity }))
  ));
  const inputTokensPerRepeat = prompts.reduce((sum, prompt) => sum + estimateTokens(prompt), 0);
  const models = (modelRoster.models || []).map((model) => {
    const provider = providerOverride || model.provider;
    const calls = prompts.length * repeats;
    const estimatedInputTokens = inputTokensPerRepeat * repeats;
    const estimatedOutputTokens = calls * Number(model.maxTokens ?? 220);
    const inputRate = Number(model.pricing?.inputPerMillion);
    const outputRate = Number(model.pricing?.outputPerMillion);
    const estimatedCostUsd = Number.isFinite(inputRate) && Number.isFinite(outputRate)
      ? round((estimatedInputTokens * inputRate + estimatedOutputTokens * outputRate) / 1_000_000, 6)
      : null;
    return {
      id: model.id,
      model: model.model,
      provider,
      calls,
      estimatedInputTokens,
      estimatedOutputTokens,
      estimatedCostUsd,
      structuredOutput: model.structuredOutput || 'auto',
      readiness: providerReadiness(provider, env),
      provenance: model.provenance || {},
    };
  });
  return {
    schemaVersion: 1,
    kind: 'ai_discourse_bench_experiment_plan',
    benchmarkId: questionBank.benchmarkId,
    questionBankHash: hashJson(questionBank),
    modelRosterHash: hashJson(modelRoster),
    mode,
    personaId: persona?.id || null,
    questions: questionBank.questions?.length || 0,
    repeatsPerPolarity: repeats,
    polarities: 2,
    totalCalls: models.reduce((sum, model) => sum + model.calls, 0),
    estimatedInputTokens: models.reduce((sum, model) => sum + model.estimatedInputTokens, 0),
    estimatedOutputTokens: models.reduce((sum, model) => sum + model.estimatedOutputTokens, 0),
    estimatedCostUsd: models.every((model) => model.estimatedCostUsd !== null)
      ? round(models.reduce((sum, model) => sum + model.estimatedCostUsd, 0), 6)
      : null,
    models,
    artifacts: ['run JSON', 'checkpoint JSONL', 'model roster', 'report JSON', 'report HTML'],
    caveat: 'Token counts use a deterministic four-characters-per-token planning estimate; provider billing is authoritative.',
  };
};
