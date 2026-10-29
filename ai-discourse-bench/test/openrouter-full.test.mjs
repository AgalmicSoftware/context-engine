import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { hashJson } from '../src/provenance.mjs';

const script = fileURLToPath(new URL('../scripts/run-openrouter-full.mjs', import.meta.url));
const bank = fileURLToPath(new URL('../data/question-bank.sample.json', import.meta.url));
for (const available of [false, true]) test(`the full OpenRouter runner audits every effective model before completions (available=${available})`, async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'aidb-router-preflight-'));
  try {
    const model = { id: 'fixture-model', label: 'Fixture model', model: 'fixture/model', provider: 'local', traits: {},
      structuredOutput: 'json_schema', pricing: { inputPerMillion: 1, outputPerMillion: 2 },
      provenance: { modelRevision: 'fixture/model-20261029' } };
    const roster = { models: [model] };
    const rosterPath = path.join(root, 'roster.json');
    await fs.writeFile(rosterPath, JSON.stringify(roster));
    const catalog = available ? [{ id: model.model, canonical_slug: model.provenance.modelRevision,
      pricing: { prompt: '0.000001', completion: '0.000002' }, supported_parameters: ['structured_outputs'] }] : [];
    const preload = path.join(root, 'network-fixture.mjs');
    await fs.writeFile(preload, `import fs from 'node:fs';
      globalThis.fetch = async (url, options = {}) => {
        if (String(url).endsWith('/models')) return Response.json({ data: ${JSON.stringify(catalog)} });
        if (String(url).endsWith('/chat/completions')) {
          const body = JSON.parse(options.body);
          fs.appendFileSync('completion-calls.jsonl', JSON.stringify(body) + '\\n');
          return Response.json({ id: 'fixture-request', model: body.model, provider: 'fixture-serving',
            choices: [{ message: { content: JSON.stringify({ answer: 'Agree', confidence: 0.8, rationale: 'Fixture answer' }) } }], usage: { total_tokens: 10 } });
        }
        throw new Error('Unexpected network request: ' + url);
      };`);
    const result = spawnSync(process.execPath, ['--import', preload, script], { cwd: root, encoding: 'utf8',
      env: { PATH: process.env.PATH, OPENROUTER_API_KEY: 'synthetic-fixture-key', OPENROUTER_BASE_URL: 'https://router.example/v1',
        AIDB_QUESTION_BANK: bank, AIDB_MODEL_ROSTER: rosterPath, AIDB_REPEATS: '1', AIDB_CONCURRENCY: '1',
        AIDB_MAX_ATTEMPTS: '1', AIDB_LIMIT_QUESTIONS: '1', AIDB_OUTPUT_PREFIX: 'fixture' } });
    const calls = await fs.readFile(path.join(root, 'completion-calls.jsonl'), 'utf8').catch(() => '');
    if (!available) {
      assert.notEqual(result.status, 0, 'missing catalog models must fail preflight');
      assert.match(result.stderr, /OpenRouter roster preflight failed[\s\S]*fixture-model/);
      assert.equal(calls, '', 'preflight failure must send zero completions');
      return;
    }
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(calls.trim().split('\n').length, 2);
    const plan = JSON.parse(await fs.readFile(path.join(root, 'runs/fixture-plan.json'), 'utf8'));
    const runs = JSON.parse(await fs.readFile(path.join(root, 'runs/fixture-runs.json'), 'utf8'));
    assert.equal(plan.models[0].provider, 'openrouter');
    assert.deepEqual(plan.openRouterCatalogAudit.models.map(row => row.id), ['fixture-model']);
    assert.ok(runs.runs.every(run => run.provider === 'openrouter'));
    assert.equal(plan.modelRosterHash, hashJson({ models: [{ ...model, provider: 'openrouter' }] }));
    assert.equal(runs.manifest.modelRosterHash, plan.modelRosterHash);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
