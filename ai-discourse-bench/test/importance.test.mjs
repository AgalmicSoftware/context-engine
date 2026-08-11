import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildImportanceJsonSchema,
  buildImportancePrompt,
  IMPORTANCE_QUESTION_ORDER_METHOD,
  maximumSafeImportanceVotes,
  orderImportanceQuestionBank,
  parseImportanceAllocation,
  runImportanceBenchmark,
  summarizeImportanceRuns,
  validateImportanceRuns,
  validateReleaseImportanceFile,
} from '../src/importance.mjs';
import { mergeImportanceRunFiles } from '../src/report-inputs.mjs';

test('quadratic importance prompt requires a sparse bounded allocation', () => {
  const prompt = buildImportancePrompt({ questionBank, budget: 100, maxAllocations: 10 });
  assert.match(prompt, /Select no more than 10 questions/);
  assert.match(prompt, /from 1 to 3 importance votes/);
  assert.match(prompt, /sparse priority set/);
  assert.match(prompt, /Question order is randomized/);
  assert.match(prompt, /at most 10 entries/);
  assert.equal(maximumSafeImportanceVotes({ budget: 100, maxAllocations: 10 }), 3);
});

test('quadratic importance schema constrains allocation ids to the supplied bank', () => {
  const schema = buildImportanceJsonSchema(10, 3, ['q1', 'q2']);
  assert.deepEqual(
    schema.schema.properties.allocations.items.properties.questionId,
    { type: 'string', enum: ['q1', 'q2'] },
  );
});

test('importance question order is deterministic per model and repeat without sharing bank order', () => {
  const orderedBank = {
    benchmarkId: 'importance-order-test',
    questions: Array.from({ length: 12 }, (_, index) => ({
      id: `q${index + 1}`,
      canonicalPrompt: `Question ${index + 1}.`,
    })),
  };
  const idsFor = (modelId, repeatIndex) => orderImportanceQuestionBank({
    questionBank: orderedBank,
    modelId,
    repeatIndex,
  }).questions.map((question) => question.id);

  assert.deepEqual(idsFor('model-a', 1), idsFor('model-a', 1));
  assert.notDeepEqual(idsFor('model-a', 1), idsFor('model-b', 1));
  assert.notDeepEqual(idsFor('model-a', 1), idsFor('model-a', 2));
  assert.deepEqual([...idsFor('model-a', 1)].sort(), orderedBank.questions.map((question) => question.id).sort());
});

const questionBank = {
  benchmarkId: 'importance-test',
  questions: [
    { id: 'q1', canonicalPrompt: 'Question one matters.', topic: 'governance' },
    { id: 'q2', canonicalPrompt: 'Question two matters.', topic: 'labor' },
  ],
};
const modelRoster = {
  models: [
    { id: 'model-a', label: 'Model A', model: 'model-a', provider: 'local', traits: {} },
    { id: 'model-b', label: 'Model B', model: 'model-b', provider: 'local', traits: {} },
  ],
};

test('quadratic importance parser enforces known ids, integer votes, and squared budget cost', () => {
  const options = {
    questionIds: new Set(['q1', 'q2']),
    budget: 10,
    maxAllocations: 2,
    maxVotesPerQuestion: 4,
  };
  const valid = parseImportanceAllocation(
    '{"allocations":[{"questionId":"q1","votes":3},{"questionId":"q2","votes":1}],"rationale":"priority"}',
    options,
  );
  assert.equal(valid.parseError, '');
  assert.equal(valid.spentCredits, 10);
  assert.deepEqual(valid.allocations, [
    { questionId: 'q1', votes: 3, cost: 9 },
    { questionId: 'q2', votes: 1, cost: 1 },
  ]);

  assert.match(
    parseImportanceAllocation('{"allocations":[{"questionId":"q1","votes":4}],"rationale":""}', options).parseError,
    /exceeds budget/,
  );
  assert.match(
    parseImportanceAllocation('{"allocations":[{"questionId":"missing","votes":1}],"rationale":""}', options).parseError,
    /unknown/,
  );
  assert.match(
    parseImportanceAllocation('{"allocations":[{"questionId":"q1","votes":1},{"questionId":"q1","votes":1}],"rationale":""}', options).parseError,
    /duplicates/,
  );
  assert.match(
    parseImportanceAllocation(
      '{"allocations":[{"questionId":"q1","votes":1},{"questionId":"q2","votes":1}],"rationale":""}',
      { ...options, maxAllocations: 1 },
    ).parseError,
    /exceeds maximum 1/,
  );
  assert.match(
    parseImportanceAllocation(
      '{"allocations":[{"questionId":"q1","votes":4}],"rationale":""}',
      { questionIds: new Set(['q1']), budget: 100, maxAllocations: 10 },
    ).parseError,
    /votes 4 exceeds maximum 3/,
  );
});

test('importance runner retries invalid allocations and resumes compatible successful runs', async () => {
  const calls = new Map();
  const first = await runImportanceBenchmark({
    questionBank,
    modelRoster,
    budget: 10,
    maxAllocations: 2,
    repeats: 1,
    concurrency: 2,
    maxAttempts: 2,
    retryBaseDelayMs: 0,
    sleepImpl: async () => {},
    callModelImpl: async ({ modelEntry, prompt }) => {
      const count = (calls.get(modelEntry.id) || 0) + 1;
      calls.set(modelEntry.id, count);
      if (count === 2) {
        assert.match(prompt, /previous response was invalid/i);
        assert.match(prompt, /votes 3 exceeds maximum 2/);
      }
      return {
        content: count === 1
          ? '{"allocations":[{"questionId":"q1","votes":3}],"rationale":"too many votes"}'
          : '{"allocations":[{"questionId":"q1","votes":2},{"questionId":"q2","votes":2}],"rationale":"valid"}',
        metadata: { resolvedModel: modelEntry.model },
      };
    },
  });

  assert.equal(first.runs.length, 2);
  assert.equal(first.questionOrderMethod, IMPORTANCE_QUESTION_ORDER_METHOD);
  assert.ok(first.runs.every((run) => run.questionOrderMethod === IMPORTANCE_QUESTION_ORDER_METHOD));
  assert.ok(first.runs.every((run) => /^[a-f0-9]{64}$/.test(run.questionOrderHash)));
  assert.deepEqual([...calls.values()].sort(), [2, 2]);
  assert.ok(first.runs.every((run) => run.spentCredits === 8));
  assert.ok(first.runs.every((run) => run.attempts.length === 2));
  assert.equal(validateImportanceRuns(first, {
    modelIds: new Set(['model-a', 'model-b']),
    questionIds: new Set(['q1', 'q2']),
    benchmarkId: 'importance-test',
  }).length, 0);

  let resumedCalls = 0;
  const resumed = await runImportanceBenchmark({
    questionBank,
    modelRoster,
    budget: 10,
    maxAllocations: 2,
    repeats: 1,
    existingRuns: first.runs,
    callModelImpl: async () => {
      resumedCalls += 1;
      return { content: '', metadata: {} };
    },
  });
  assert.equal(resumedCalls, 0);
  assert.equal(resumed.resumedRuns, 2);
});

test('mock importance runs obey the same allocation caps as provider runs', async () => {
  const result = await runImportanceBenchmark({
    questionBank,
    modelRoster: {
      models: [{ id: 'mock-model', label: 'Mock Model', model: 'mock-model', provider: 'mock', traits: {} }],
    },
    budget: 10,
    maxAllocations: 2,
    repeats: 1,
  });

  assert.equal(result.runs.length, 1);
  assert.equal(result.runs[0].parseError, '');
  assert.ok(result.runs[0].allocations.length <= 2);
  assert.ok(result.runs[0].allocations.every((allocation) => allocation.votes <= 2));
  assert.ok(result.runs[0].spentCredits <= 10);
});

test('importance summaries average repeats within each model before comparing models', () => {
  const importance = summarizeImportanceRuns({
    questionBank,
    modelRoster,
    importanceFile: {
      budget: 25,
      maxAllocations: 2,
      maxVotesPerQuestion: 3,
      repeats: 2,
      runs: [
        { modelId: 'model-a', allocations: [{ questionId: 'q1', votes: 3 }], spentCredits: 9 },
        { modelId: 'model-a', allocations: [{ questionId: 'q1', votes: 1 }], spentCredits: 1 },
        { modelId: 'model-b', allocations: [{ questionId: 'q1', votes: 1 }, { questionId: 'q2', votes: 3 }], spentCredits: 10 },
      ],
    },
  });

  assert.equal(importance.available, true);
  assert.equal(importance.byModel['model-a'].byQuestion.q1.meanVotes, 2);
  assert.equal(importance.byQuestion.q1.meanVotes, 1.5);
  assert.equal(importance.byQuestion.q2.meanVotes, 1.5);
  assert.equal(importance.byTopic.governance.meanVotes, 1.5);
  assert.equal(importance.byTopic.labor.meanVotes, 1.5);
  assert.equal(importance.byTopic.governance.share, 0.5);
});

test('importance summaries exclude direct-call artifacts that violate the quadratic budget', () => {
  const importance = summarizeImportanceRuns({
    questionBank,
    modelRoster,
    importanceFile: {
      budget: 10,
      repeats: 1,
      runs: [{ modelId: 'model-a', allocations: [{ questionId: 'q1', votes: 4 }], spentCredits: 16 }],
    },
  });
  assert.equal(importance.available, false);
  assert.equal(importance.validRuns, 0);
  assert.equal(importance.contributingModels, 0);
});

test('importance file merges preserve compatible allocation caps and reject mixed methods', () => {
  const file = (modelId, maxAllocations, maxVotesPerQuestion = 2) => ({
    benchmarkId: 'importance-test',
    budget: 100,
    maxAllocations,
    maxVotesPerQuestion,
    repeats: 1,
    manifest: {
      harnessVersion: '0.5.0',
      questionBankHash: 'question-bank-hash',
      promptTemplateVersion: 'importance-v1',
      promptTemplateHash: 'prompt-template-hash',
      promptHash: `prompt-hash-${modelId}`,
      questionOrderMethod: IMPORTANCE_QUESTION_ORDER_METHOD,
      budget: 100,
      maxAllocations,
      maxVotesPerQuestion,
      repeats: 1,
    },
    runs: [{ modelId }],
  });
  const merged = mergeImportanceRunFiles([file('model-a', 20), file('model-b', 20)]);
  assert.equal(merged.maxAllocations, 20);
  assert.equal(merged.maxVotesPerQuestion, 2);
  assert.equal(merged.runs.length, 2);
  assert.equal(merged.sourceImportanceContentHashes.length, 2);
  assert.notEqual(merged.sourceManifests[0].promptHash, merged.sourceManifests[1].promptHash);
  assert.throws(
    () => mergeImportanceRunFiles([file('model-a', 20), file('model-b', 10)]),
    /incompatible manifest\.maxAllocations|one positive max allocation count/,
  );
  assert.throws(
    () => mergeImportanceRunFiles([file('model-a', 20, 2), file('model-b', 20, 3)]),
    /incompatible manifest\.maxVotesPerQuestion|one positive per-question vote cap/,
  );
  assert.throws(
    () => mergeImportanceRunFiles([file('model-a', 20, 3)]),
    /budget-derived safe maximum 2/,
  );
  assert.throws(
    () => mergeImportanceRunFiles([
      { ...file('model-a', 20), questionOrderMethod: 'method-a' },
      { ...file('model-b', 20), questionOrderMethod: 'method-b' },
    ]),
    /one question-order method/,
  );
});

test('release importance validation enforces policy repeats and pinned model identity', async () => {
  const releaseRoster = { models: [modelRoster.models[0]] };
  const result = await runImportanceBenchmark({
    questionBank,
    modelRoster: releaseRoster,
    budget: 10,
    maxAllocations: 2,
    repeats: 1,
    callModelImpl: async ({ modelEntry }) => ({
      content: '{"allocations":[{"questionId":"q1","votes":2}],"rationale":"priority"}',
      metadata: {
        resolvedProvider: 'local',
        resolvedModel: modelEntry.model,
        systemFingerprint: 'deployment-a',
      },
    }),
  });
  result.manifest.harnessCommit = 'a'.repeat(40);

  assert.deepEqual(validateReleaseImportanceFile(result, {
    questionBank,
    modelRoster: releaseRoster,
    requiredRepeats: 1,
  }), []);
  assert.ok(validateReleaseImportanceFile(result, {
    questionBank,
    modelRoster: releaseRoster,
    requiredRepeats: 2,
  }).some((error) => error.includes('required 2')));

  const alteredGeneration = structuredClone(result);
  alteredGeneration.runs[0].generation.temperature = 0.9;
  assert.ok(validateReleaseImportanceFile(alteredGeneration, {
    questionBank,
    modelRoster: releaseRoster,
    requiredRepeats: 1,
  }).some((error) => error.includes('generation does not match')));

  const alteredDeployment = structuredClone(result);
  alteredDeployment.runs[0].responseMetadata.resolvedModel = 'different-deployment';
  assert.ok(validateReleaseImportanceFile(alteredDeployment, {
    questionBank,
    modelRoster: releaseRoster,
    requiredRepeats: 1,
  }).some((error) => error.includes('resolved model does not match')));
});
