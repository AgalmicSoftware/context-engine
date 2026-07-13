import assert from 'node:assert/strict';
import test from 'node:test';

import { buildExperimentPlan } from '../src/experiment-plan.mjs';

const questionBank = {
  benchmarkId: 'plan-test',
  questions: [{
    id: 'q1',
    canonicalPrompt: 'A should happen.',
    reversedPrompt: 'A should not happen.',
  }],
};

test('experiment plan exposes exact calls, bounded token estimates, cost, and readiness', () => {
  const plan = buildExperimentPlan({
    questionBank,
    modelRoster: {
      models: [{
        id: 'model-a', model: 'provider/model-a', provider: 'openrouter', maxTokens: 100,
        structuredOutput: 'json_schema',
        pricing: { inputPerMillion: 1, outputPerMillion: 2 },
      }],
    },
    repeats: 10,
    env: { OPENROUTER_API_KEY: 'configured' },
  });

  assert.equal(plan.totalCalls, 20);
  assert.equal(plan.models[0].calls, 20);
  assert.equal(plan.models[0].estimatedOutputTokens, 2000);
  assert.equal(plan.models[0].readiness.configured, true);
  assert.equal(plan.models[0].structuredOutput, 'json_schema');
  assert.ok(plan.estimatedInputTokens > 0);
  assert.ok(plan.estimatedCostUsd > 0);
  assert.equal(plan.questionBankHash.length, 64);
});

test('experiment plan keeps unknown provider pricing explicit', () => {
  const plan = buildExperimentPlan({
    questionBank,
    modelRoster: { models: [{ id: 'model-a', model: 'model-a', provider: 'openrouter' }] },
    repeats: 1,
    env: {},
  });
  assert.equal(plan.estimatedCostUsd, null);
  assert.equal(plan.models[0].estimatedCostUsd, null);
  assert.equal(plan.models[0].readiness.configured, false);
});
