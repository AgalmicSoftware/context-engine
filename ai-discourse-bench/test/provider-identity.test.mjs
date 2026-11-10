import assert from 'node:assert/strict';
import test from 'node:test';
import { callOpenAiCompatibleChat } from '../src/adapters/openai-compatible.mjs';
import { runBenchmark } from '../src/runner.mjs';
import { runImportanceBenchmark, validateReleaseImportanceFile } from '../src/importance.mjs';
import { validateModelRoster, validateReleaseRunFile } from '../src/schema.mjs';
import { hashJson } from '../src/provenance.mjs';

const questionBank = {
  benchmarkId: 'provider-identity',
  runPlan: { repeatsPerPolarity: 1, polarities: ['canonical', 'reversed'] },
  questions: [{ id: 'q1', canonicalPrompt: 'Independent evaluation should be required.',
    reversedPrompt: 'Independent evaluation should not be required.' }],
};

const fixtures = async (providerRouting, upstream = 'Anthropic') => {
  const modelRoster = { models: [{ id: 'model-a', label: 'Model A', model: 'test/model-a', provider: 'openrouter',
    traits: {}, ...(providerRouting ? { providerRouting } : {}) }] };
  const call = (content) => ({ modelEntry }) => callOpenAiCompatibleChat({
    provider: 'openrouter', model: modelEntry.model, providerRouting: modelEntry.providerRouting,
    prompt: 'Local fixture', env: { OPENROUTER_API_KEY: 'test-key' },
    fetchImpl: async () => ({ ok: true, json: async () => ({
      provider: upstream, model: modelEntry.model, choices: [{ message: { content } }],
    }) }),
  });
  const stance = await runBenchmark({ questionBank, modelRoster, repeats: 1,
    callModelImpl: call('{"answer":"Agree"}'),
  });
  const importance = await runImportanceBenchmark({ questionBank, modelRoster, budget: 10, maxAllocations: 1, repeats: 2,
    callModelImpl: call('{"allocations":[{"questionId":"q1","votes":2}]}'),
  });
  for (const file of [stance, importance]) file.manifest.harnessCommit = 'a'.repeat(40);
  return { modelRoster, cases: [
    [stance, (file) => validateReleaseRunFile(file, { questionBank, questionBankHash: hashJson(questionBank),
      questionCount: 1, requiredRepeats: 1, selectedModelsById: new Map(modelRoster.models.map((model) => [model.id, model])) })],
    [importance, (file) => validateReleaseImportanceFile(file, { questionBank, modelRoster, requiredRepeats: 2 })],
  ] };
};

for (const [label, policy, upstream] of [
  ['ordered pin', { order: ['anthropic'], allow_fallbacks: false }, 'Anthropic'],
  ['only pin', { only: ['anthropic'] }, 'Anthropic'],
  ['normalized pin', { only: ['cloud-ai-provider'] }, 'Cloud AI_Provider'],
  ['unrestricted upstream', null, 'Any Provider'],
  ['ordered preference with fallbacks', { order: ['anthropic'], allow_fallbacks: true }, 'Another Provider'],
]) {
  test(`${label} passes both release validators without rewriting the reported upstream`, async () => {
    const { modelRoster, cases } = await fixtures(policy, upstream);
    assert.deepEqual(validateModelRoster(modelRoster), []);
    for (const [file, validate] of cases) {
      const original = JSON.stringify(file);
      assert.equal(file.runs[0].responseMetadata.provider, 'openrouter');
      assert.equal(file.runs[0].responseMetadata.resolvedProvider, upstream);
      assert.deepEqual(validate(file), []);
      assert.equal(JSON.stringify(file), original);
    }
  });
}

test('an upstream outside the routing pin fails both release validators', async () => {
  const { cases } = await fixtures({ order: ['anthropic'], allow_fallbacks: false }, 'Outside');
  for (const [file, validate] of cases) assert.ok(validate(file).some((error) => /outside.*providerRouting/.test(error)));
});

test('two permitted upstreams still cannot share one model deployment identity', async () => {
  const { cases } = await fixtures({ only: ['anthropic', 'other'] });
  for (const [file, validate] of cases) {
    file.runs[1].responseMetadata.resolvedProvider = 'Other';
    assert.ok(validate(file).some((error) => /multiple deployment identities/.test(error)));
  }
});

test('provider spelling differences alone do not create a second deployment identity', async () => {
  const { cases } = await fixtures({ only: ['anthropic'] });
  for (const [file, validate] of cases) {
    file.runs[1].responseMetadata.resolvedProvider = 'anthropic';
    assert.deepEqual(validate(file), []);
  }
});

test('run and response transports must each match the manifest', async () => {
  const { cases } = await fixtures({ only: ['anthropic'] });
  for (const [file, validate] of cases) {
    const wrongRun = structuredClone(file);
    wrongRun.runs[0].provider = 'local';
    assert.ok(validate(wrongRun).some((error) => /provider does not match manifest|model\/provider does not match manifest/.test(error)));
    const wrongMetadata = structuredClone(file);
    wrongMetadata.runs[0].responseMetadata.provider = 'local';
    assert.ok(validate(wrongMetadata).some((error) => /responseMetadata.provider does not match manifest/.test(error)));
  }
});

test('malformed stance rows report validation errors without reaching deployment comparison', async () => {
  const { cases: [[file, validate]] } = await fixtures(null);
  file.runs[0] = null;
  assert.ok(validate(file).some((error) => /modelId is absent from manifest/.test(error)));
});
