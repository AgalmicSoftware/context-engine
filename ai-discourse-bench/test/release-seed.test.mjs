import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const cli = fileURLToPath(new URL('../bin/ai-discourse-bench.mjs', import.meta.url));
for (const release of [false, true]) test(`${release ? 'release refuses' : 'preview warns about'} differing schedule seeds without rewriting source runs`, async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'aidb-schedule-policy-'));
  try {
    const sample = JSON.parse(await fs.readFile(new URL('../data/question-bank.sample.json', import.meta.url), 'utf8'));
    const bank = { ...sample, questions: sample.questions.slice(0, 1), runPlan: { ...sample.runPlan, repeatsPerPolarity: 1 } };
    await fs.writeFile(path.join(root, 'bank.json'), JSON.stringify(bank));
    for (const [model, seed] of [['model-a', 'salon-seed-a'], ['model-b', 'salon-seed-b']]) {
      await fs.writeFile(path.join(root, `${model}.json`), JSON.stringify({ models: [{ id: model, label: model, model, provider: 'mock', traits: {} }] }));
      execFileSync(process.execPath, [cli, 'run', '--questions', 'bank.json', '--models', `${model}.json`, '--provider', 'mock', '--repeats', '1', '--schedule-seed', seed, '--out', `${model}-runs.json`], { cwd: root, stdio: 'pipe', env: { ...process.env, AIDB_HARNESS_COMMIT: 'a'.repeat(40) } });
    }
    const paths = ['model-a-runs.json', 'model-b-runs.json'];
    const before = await Promise.all(paths.map(file => fs.readFile(path.join(root, file), 'utf8')));
    const args = ['build-report', '--questions', 'bank.json', '--models', 'model-a.json,model-b.json', '--runs', paths.join(','), '--out', 'report.json', ...(release ? ['--release'] : [])];
    const result = spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8' });
    assert.match(result.stderr, /scheduleSeed/);
    assert.match(result.stderr, /salon-seed-a/);
    assert.match(result.stderr, /salon-seed-b/);
    assert.deepEqual(await Promise.all(paths.map(file => fs.readFile(path.join(root, file), 'utf8'))), before);
    if (release) {
      assert.notEqual(result.status, 0);
      await assert.rejects(fs.stat(path.join(root, 'report.json')), { code: 'ENOENT' });
    } else {
      assert.equal(result.status, 0, result.stderr);
      const report = JSON.parse(await fs.readFile(path.join(root, 'report.json'), 'utf8'));
      assert(report.integrity.warnings.some(warning => /scheduleSeed/.test(warning) && warning.includes('salon-seed-a') && warning.includes('salon-seed-b')));
      assert.deepEqual(report.rawMaterial.sourceManifests.map(manifest => manifest.scheduleSeed), ['salon-seed-a', 'salon-seed-b']);
    }
    const second = JSON.parse(before[1]);
    second.manifest.scheduleSeed = 'salon-seed-a';
    await fs.writeFile(path.join(root, paths[1]), JSON.stringify(second));
    const sameSeed = spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8' });
    assert.doesNotMatch(sameSeed.stderr, /scheduleSeed/);
    if (!release) assert.equal(sameSeed.status, 0, sameSeed.stderr);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
