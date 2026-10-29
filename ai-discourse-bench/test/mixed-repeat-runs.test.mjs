import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const cli = fileURLToPath(new URL('../bin/ai-discourse-bench.mjs', import.meta.url));

test('completed runs with different repeat depths compose without rewriting provenance or weakening resume', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'aidb-mixed-repeats-'));
  try {
    const sample = JSON.parse(await fs.readFile(new URL('../data/question-bank.sample.json', import.meta.url), 'utf8'));
    const bank = { ...sample, questions: sample.questions.slice(0, 1) };
    const model = id => ({ id, label: id, model: id, provider: 'mock', traits: {} });
    const write = (name, value) => fs.writeFile(path.join(root, name), JSON.stringify(value));
    const read = name => fs.readFile(path.join(root, name), 'utf8');
    const json = async name => JSON.parse(await read(name));
    const invoke = (...args) => execFileSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8', stdio: 'pipe' });
    await write('bank.json', bank);
    for (const [id, repeats] of [['model-a', 1], ['model-b', 2]]) {
      await write(`${id}.json`, { models: [model(id)] });
      invoke('run', '--questions', 'bank.json', '--models', `${id}.json`, '--provider', 'mock', '--repeats', String(repeats), '--out', `${id}-runs.json`);
    }
    const before = await Promise.all(['model-a-runs.json', 'model-b-runs.json'].map(read));
    const runs = before.map(JSON.parse);
    assert.notEqual(runs[0].manifest.scheduleSeed, runs[1].manifest.scheduleSeed);
    const buildArgs = ['build-report', '--questions', 'bank.json', '--models', 'model-a.json,model-b.json', '--runs', 'model-a-runs.json,model-b-runs.json', '--out', 'report.json'];
    invoke(...buildArgs);
    const report = await json('report.json');
    assert.deepEqual(report.participants.map(row => row.id).sort(), ['model-a', 'model-b']);
    assert.deepEqual(report.rawMaterial.sourceManifests, runs.map(run => run.manifest));
    assert.deepEqual(report.rawMaterial.sourceManifests.map(manifest => manifest.repeats), [1, 2]);
    assert.deepEqual(await Promise.all(['model-a-runs.json', 'model-b-runs.json'].map(read)), before);

    for (const field of ['questionBankHash', 'promptTemplateHash', 'harnessVersion']) {
      const incompatible = structuredClone(runs[1]);
      incompatible.manifest[field] = 'incompatible';
      await write('model-b-runs.json', incompatible);
      const result = spawnSync(process.execPath, [cli, ...buildArgs], { cwd: root, encoding: 'utf8' });
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, new RegExp(`incompatible manifest.${field}`));
    }
    await fs.writeFile(path.join(root, 'model-b-runs.json'), before[1]);

    const unchanged = invoke('run', '--questions', 'bank.json', '--models', 'model-a.json', '--provider', 'mock', '--repeats', '1', '--out', 'model-a-runs.json', '--resume');
    assert.match(unchanged, /2 resumed/);
    const changed = invoke('run', '--questions', 'bank.json', '--models', 'model-a.json', '--provider', 'mock', '--repeats', '1', '--out', 'model-a-runs.json', '--resume', '--schedule-seed', 'different-schedule');
    assert.match(changed, /0 resumed/);
    const rerun = await json('model-a-runs.json');
    assert.equal(rerun.manifest.scheduleSeed, 'different-schedule');
    assert.notEqual(rerun.runs[0].requestContractHash, runs[0].runs[0].requestContractHash);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
