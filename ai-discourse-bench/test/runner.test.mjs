import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createCheckpointWriter, readCheckpointRuns } from '../src/checkpoint.mjs';
import { runBenchmark } from '../src/runner.mjs';

const questionBank = {
  benchmarkId: 'runner-test',
  runPlan: { repeatsPerPolarity: 1, polarities: ['canonical', 'reversed'] },
  questions: [{
    id: 'q1',
    canonicalPrompt: 'Independent evaluation should be required.',
    reversedPrompt: 'Independent evaluation should not be required.',
  }],
};
const modelRoster = {
  models: [{ id: 'model-a', label: 'Model A', model: 'model-a', provider: 'local', traits: {} }],
};

test('runner retries transport failures, records attempts, and emits a reproducible manifest', async () => {
  let calls = 0;
  const result = await runBenchmark({
    questionBank,
    modelRoster,
    repeats: 1,
    concurrency: 2,
    maxAttempts: 2,
    retryBaseDelayMs: 1,
    sleepImpl: async () => {},
    callModelImpl: async ({ modelEntry }) => {
      calls += 1;
      if (calls === 1) {
        const error = new Error('rate limited');
        error.status = 429;
        error.retryable = true;
        throw error;
      }
      return {
        content: '{"answer":"Agree","confidence":0.7,"rationale":"bounded"}',
        metadata: { resolvedModel: modelEntry.model, requestId: `request-${calls}`, usage: { total_tokens: 9 } },
      };
    },
  });

  assert.equal(result.runs.length, 2);
  assert.equal(calls, 3);
  assert.equal(result.manifest.kind, 'ai_discourse_bench_run_manifest');
  assert.equal(result.manifest.questionBankHash.length, 64);
  assert.equal(result.manifest.modelRosterHash.length, 64);
  assert.equal(result.manifest.promptTemplateHash.length, 64);
  assert.equal(result.manifest.completedRuns, 2);
  assert.ok(result.runs.some((run) => run.attempts.length === 2));
  assert.ok(result.runs.every((run) => run.promptHash.length === 64));
});

test('runner resumes deterministic compatible successful runs without calling them again', async () => {
  const first = await runBenchmark({ questionBank, modelRoster, providerOverride: 'mock', repeats: 1, maxAttempts: 1 });
  let calls = 0;
  const resumed = await runBenchmark({
    questionBank,
    modelRoster,
    providerOverride: 'mock',
    repeats: 1,
    maxAttempts: 1,
    existingRuns: first.runs,
    callModelImpl: async () => {
      calls += 1;
      return { content: '{"answer":"Agree"}', metadata: {} };
    },
  });

  assert.equal(calls, 0);
  assert.equal(resumed.resumedRuns, 2);
  assert.deepEqual(resumed.runs.map((run) => run.runId), first.runs.map((run) => run.runId));
});

test('runner reruns failed, invalid, and prompt or generation-mismatched checkpoint records', async () => {
  const first = await runBenchmark({ questionBank, modelRoster, providerOverride: 'mock', repeats: 1, maxAttempts: 1 });
  const staleRuns = first.runs.map((run, index) => {
    if (index === 0) return { ...run, normalizedAnswer: null, parseError: 'invalid answer' };
    return { ...run, promptHash: 'stale', generation: { ...run.generation, maxTokens: 999 } };
  });
  let calls = 0;
  const resumed = await runBenchmark({
    questionBank,
    modelRoster,
    providerOverride: 'mock',
    repeats: 1,
    maxAttempts: 1,
    existingRuns: staleRuns,
    callModelImpl: async () => {
      calls += 1;
      return { content: '{"answer":"Agree","confidence":0.5}', metadata: {} };
    },
  });

  assert.equal(calls, 2);
  assert.equal(resumed.resumedRuns, 0);
  assert.ok(resumed.runs.every((run) => run.normalizedAnswer));
});

test('checkpoint writer appends durable JSONL records that can be resumed', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'aidb-checkpoint-'));
  const checkpoint = path.join(directory, 'runs.jsonl');
  const write = await createCheckpointWriter(checkpoint, { reset: true });
  await Promise.all([write({ runId: 'a' }), write({ runId: 'b' })]);
  assert.deepEqual(await readCheckpointRuns(checkpoint), [{ runId: 'a' }, { runId: 'b' }]);
});

test('checkpoint reader ignores only a truncated final append', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'aidb-checkpoint-truncated-'));
  const checkpoint = path.join(directory, 'runs.jsonl');
  await fs.writeFile(checkpoint, '{"runId":"a"}\n{"runId":"partial"');
  assert.deepEqual(await readCheckpointRuns(checkpoint), [{ runId: 'a' }]);

  await fs.writeFile(checkpoint, '{broken}\n{"runId":"b"}\n');
  await assert.rejects(() => readCheckpointRuns(checkpoint), /line 1 is invalid JSON/);
});
