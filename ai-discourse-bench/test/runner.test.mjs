import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { openCheckpoint } from '../src/checkpoint.mjs';
import { runBenchmark } from '../src/runner.mjs';
import { buildResultsReport } from '../src/scoring.mjs';

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
        metadata: {
          provider: 'local', resolvedProvider: 'local', resolvedModel: modelEntry.model,
          requestId: `request-${calls}`, usage: { total_tokens: 9 },
        },
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
  assert.equal(result.manifest.models[0].structuredOutput, 'auto');
  assert.deepEqual(result.manifest.models[0].provenance, {});
  assert.ok(result.runs.some((run) => run.attempts.length === 2));
  assert.ok(result.runs.every((run) => run.promptHash.length === 64));
  assert.ok(result.runs.every((run) => run.requestContractHash.length === 64));
  assert.ok(result.runs.every((run) => run.generation.structuredOutput === 'auto'));
  const report = buildResultsReport({ questionBank, modelRoster, runsFile: result });
  assert.deepEqual(report.participants[0].runtimeProvenance.resolvedModels, ['model-a']);
  assert.deepEqual(report.participants[0].runtimeProvenance.resolvedProviders, ['local']);
});

test('runner retries unparseable completions within the attempt budget', async () => {
  const callsByPrompt = new Map();
  const result = await runBenchmark({
    questionBank,
    modelRoster,
    repeats: 1,
    concurrency: 2,
    maxAttempts: 2,
    retryBaseDelayMs: 1,
    sleepImpl: async () => {},
    callModelImpl: async ({ prompt }) => {
      const calls = (callsByPrompt.get(prompt) || 0) + 1;
      callsByPrompt.set(prompt, calls);
      return {
        content: calls === 1
          ? ''
          : '{"answer":"Agree","confidence":0.7,"rationale":"bounded"}',
        metadata: { finishReason: calls === 1 ? 'length' : 'stop' },
      };
    },
  });

  assert.equal([...callsByPrompt.values()].reduce((sum, calls) => sum + calls, 0), 4);
  assert.ok(result.runs.every((run) => run.normalizedAnswer));
  assert.ok(result.runs.every((run) => run.attempts.length === 2));
  assert.ok(result.runs.every((run) => run.attempts[0].parseError === 'empty response'));
  assert.ok(result.runs.every((run) => run.attempts[1].parseError === ''));
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

test('runner does not reuse rows across schedule or local endpoint contracts', async () => {
  const originalEndpoint = process.env.AIDB_LOCAL_BASE_URL;
  try {
    process.env.AIDB_LOCAL_BASE_URL = 'http://127.0.0.1:8000/v1';
    const first = await runBenchmark({
      questionBank,
      modelRoster,
      repeats: 1,
      maxAttempts: 1,
      scheduleSeed: 'seed-a',
      callModelImpl: async () => ({ content: '{"answer":"Agree"}', metadata: {} }),
    });
    process.env.AIDB_LOCAL_BASE_URL = 'http://127.0.0.1:8011/v1';
    let calls = 0;
    const resumed = await runBenchmark({
      questionBank,
      modelRoster,
      repeats: 1,
      maxAttempts: 1,
      scheduleSeed: 'seed-b',
      existingRuns: first.runs,
      callModelImpl: async () => {
        calls += 1;
        return { content: '{"answer":"Agree"}', metadata: {} };
      },
    });
    assert.equal(calls, 2);
    assert.equal(resumed.resumedRuns, 0);
    assert.notEqual(first.runs[0].requestContractHash, resumed.runs[0].requestContractHash);
  } finally {
    if (originalEndpoint === undefined) delete process.env.AIDB_LOCAL_BASE_URL;
    else process.env.AIDB_LOCAL_BASE_URL = originalEndpoint;
  }
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

test('runner does not reuse runs after declared model provenance changes', async () => {
  const rosterWithRevision = (modelRevision) => ({
    models: [{
      ...modelRoster.models[0],
      provenance: { modelRevision },
    }],
  });
  const first = await runBenchmark({
    questionBank,
    modelRoster: rosterWithRevision('revision-a'),
    providerOverride: 'mock',
    repeats: 1,
    maxAttempts: 1,
  });
  let calls = 0;
  const rerun = await runBenchmark({
    questionBank,
    modelRoster: rosterWithRevision('revision-b'),
    providerOverride: 'mock',
    repeats: 1,
    maxAttempts: 1,
    existingRuns: first.runs,
    callModelImpl: async () => {
      calls += 1;
      return { content: '{"answer":"Agree","confidence":0.5,"rationale":"test"}', metadata: {} };
    },
  });

  assert.equal(calls, 2);
  assert.equal(rerun.resumedRuns, 0);
  assert.ok(rerun.runs.every((run) => run.modelProvenance.modelRevision === 'revision-b'));
});

test('runner records provider routing and does not reuse runs after routing changes', async () => {
  const rosterWithRouting = (allowFallbacks) => ({
    models: [{
      id: 'model-a',
      label: 'Model A',
      model: 'provider/model-a',
      provider: 'openrouter',
      traits: {},
      providerRouting: {
        allow_fallbacks: allowFallbacks,
        require_parameters: true,
      },
    }],
  });
  const first = await runBenchmark({
    questionBank,
    modelRoster: rosterWithRouting(false),
    providerOverride: 'mock',
    repeats: 1,
    maxAttempts: 1,
  });
  assert.equal(first.manifest.models[0].providerRouting.allow_fallbacks, false);
  assert.equal(first.runs[0].generation.providerRouting.allow_fallbacks, false);

  let calls = 0;
  const rerun = await runBenchmark({
    questionBank,
    modelRoster: rosterWithRouting(true),
    providerOverride: 'mock',
    repeats: 1,
    maxAttempts: 1,
    existingRuns: first.runs,
    callModelImpl: async () => {
      calls += 1;
      return { content: '{"answer":"Agree","confidence":0.5,"rationale":"test"}', metadata: {} };
    },
  });

  assert.equal(calls, 2);
  assert.equal(rerun.resumedRuns, 0);
});

test('checkpoint writer appends durable JSONL records that can be resumed', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'aidb-checkpoint-'));
  const checkpoint = path.join(directory, 'runs.jsonl');
  const { write } = await openCheckpoint(checkpoint);
  await Promise.all([write({ runId: 'a' }), write({ runId: 'b' })]);
  assert.deepEqual((await openCheckpoint(checkpoint, { resume: true })).runs, [{ runId: 'a' }, { runId: 'b' }]);
});

test('checkpoint resume repairs only a truncated final append', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'aidb-checkpoint-truncated-'));
  const checkpoint = path.join(directory, 'runs.jsonl');
  await fs.writeFile(checkpoint, '{"runId":"a"}\n{"runId":"partial"');
  assert.deepEqual((await openCheckpoint(checkpoint, { resume: true })).runs, [{ runId: 'a' }]);

  await fs.writeFile(checkpoint, '{broken}\n{"runId":"b"}\n');
  await assert.rejects(() => openCheckpoint(checkpoint, { resume: true }), /line 1 is invalid JSON/);
});

for (const tail of ['{"runId":"partial"', '{"runId":"complete"}']) {
  test(`checkpoint resume repairs its tail before repeated appends: ${tail}`, async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'aidb-checkpoint-repair-'));
    const checkpoint = path.join(directory, 'runs.jsonl');
    const open = () => openCheckpoint(checkpoint, { resume: true });
    try {
      await fs.writeFile(checkpoint, '{"runId":"first","text":"☀"}\n' + tail);
      const first = await open();
      const expected = tail.endsWith('}') ? ['first', 'complete'] : ['first'];
      assert.deepEqual(first.runs.map((run) => run.runId), expected);
      await first.write({ runId: 'resumed' });
      const second = await open();
      assert.deepEqual(second.runs.map((run) => run.runId), [...expected, 'resumed']);
      await second.write({ runId: 'again' });
      assert.deepEqual((await open()).runs.map((run) => run.runId), [...expected, 'resumed', 'again']);
      const corrupt = '{bad}\n{"runId":"last"}';
      await fs.writeFile(checkpoint, corrupt);
      await assert.rejects(open, /line 1 is invalid JSON/);
      assert.equal(await fs.readFile(checkpoint, 'utf8'), corrupt);
    } finally { await fs.rm(directory, { recursive: true, force: true }); }
  });
}


test('run and build-report use the final answer and retry conflicting answers', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'aidb-final-answer-'));
  try {
    const sample = JSON.parse(await fs.readFile(new URL('../data/question-bank.sample.json', import.meta.url), 'utf8'));
    const bank = { ...sample, runPlan: { ...sample.runPlan, repeatsPerPolarity: 1 }, questions: sample.questions.slice(0, 1) };
    const calls = new Map();
    const runs = await runBenchmark({
      questionBank: bank, modelRoster, repeats: 1, concurrency: 1, maxAttempts: 2,
      sleepImpl: async () => {},
      callModelImpl: async ({ prompt }) => {
        const count = (calls.get(prompt) || 0) + 1;
        calls.set(prompt, count);
        const final = prompt.includes(bank.questions[0].reversedPrompt) ? 'Disagree' : 'Agree';
        const opposite = final === 'Agree' ? 'Disagree' : 'Agree';
        return { content: count === 1
          ? `{"answer":"${opposite}"}\n{"answer":"${final}"}`
          : `<think>{"answer":"${opposite}"}</think>\n{"answer":"${final}"}`, metadata: {} };
      },
    });
    for (const [name, data] of [['bank', bank], ['models', modelRoster], ['runs', runs]]) {
      await fs.writeFile(path.join(root, name + '.json'), JSON.stringify(data));
    }
    execFileSync(process.execPath, [fileURLToPath(new URL('../bin/ai-discourse-bench.mjs', import.meta.url)),
      'build-report', '--questions', 'bank.json', '--models', 'models.json', '--runs', 'runs.json', '--out', 'report.json'],
    { cwd: root, stdio: 'pipe' });
    const report = JSON.parse(await fs.readFile(path.join(root, 'report.json'), 'utf8'));
    assert.equal(report.polisReport.byModelQuestion['model-a'][bank.questions[0].id].meanScore, 1);
    assert.ok(runs.runs.every(row => row.attempts.length === 2 && row.attempts[0].parseError && !row.parseError));
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
