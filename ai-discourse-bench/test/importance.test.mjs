import assert from 'node:assert/strict';
import test from 'node:test';

import {
  parseImportanceAllocation,
  runImportanceBenchmark,
  summarizeImportanceRuns,
  validateImportanceRuns,
} from '../src/importance.mjs';

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
  const options = { questionIds: new Set(['q1', 'q2']), budget: 10 };
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
});

test('importance runner retries invalid allocations and resumes compatible successful runs', async () => {
  const calls = new Map();
  const first = await runImportanceBenchmark({
    questionBank,
    modelRoster,
    budget: 10,
    repeats: 1,
    concurrency: 2,
    maxAttempts: 2,
    retryBaseDelayMs: 0,
    sleepImpl: async () => {},
    callModelImpl: async ({ modelEntry }) => {
      const count = (calls.get(modelEntry.id) || 0) + 1;
      calls.set(modelEntry.id, count);
      return {
        content: count === 1
          ? '{"allocations":[{"questionId":"q1","votes":4}],"rationale":"overspent"}'
          : '{"allocations":[{"questionId":"q1","votes":3},{"questionId":"q2","votes":1}],"rationale":"valid"}',
        metadata: { resolvedModel: modelEntry.model },
      };
    },
  });

  assert.equal(first.runs.length, 2);
  assert.deepEqual([...calls.values()].sort(), [2, 2]);
  assert.ok(first.runs.every((run) => run.spentCredits === 10));
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

test('importance summaries average repeats within each model before comparing models', () => {
  const importance = summarizeImportanceRuns({
    questionBank,
    modelRoster,
    importanceFile: {
      budget: 25,
      repeats: 2,
      runs: [
        { modelId: 'model-a', allocations: [{ questionId: 'q1', votes: 5 }], spentCredits: 25 },
        { modelId: 'model-a', allocations: [{ questionId: 'q1', votes: 1 }], spentCredits: 1 },
        { modelId: 'model-b', allocations: [{ questionId: 'q1', votes: 1 }, { questionId: 'q2', votes: 3 }], spentCredits: 10 },
      ],
    },
  });

  assert.equal(importance.available, true);
  assert.equal(importance.byModel['model-a'].byQuestion.q1.meanVotes, 3);
  assert.equal(importance.byQuestion.q1.meanVotes, 2);
  assert.equal(importance.byQuestion.q2.meanVotes, 1.5);
  assert.equal(importance.byTopic.governance.meanVotes, 2);
  assert.equal(importance.byTopic.labor.meanVotes, 1.5);
  assert.equal(importance.byTopic.governance.share, 0.5714);
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
