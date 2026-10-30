import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { validateReleaseRunFile } from '../src/schema.mjs';

const cli = fileURLToPath(new URL('../bin/ai-discourse-bench.mjs', import.meta.url));
test('preview importance stays bound to the full bank before display limits', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'aidb-preview-importance-'));
  try {
    const sample = JSON.parse(await fs.readFile(new URL('../data/question-bank.sample.json', import.meta.url), 'utf8'));
    const bank = { ...sample, questions: structuredClone(sample.questions.slice(0, 2)) };
    const models = { models: [{ id: 'fixture', label: 'Fixture model', model: 'fixture', provider: 'mock', traits: {} }] };
    const write = (name, value) => fs.writeFile(path.join(root, name), JSON.stringify(value));
    const invoke = (...args) => execFileSync(process.execPath, [cli, ...args], { cwd: root, stdio: 'pipe' });
    await write('bank.json', bank);
    await write('models.json', models);
    invoke('run', '--questions', 'bank.json', '--models', 'models.json', '--provider', 'mock', '--repeats', '1', '--limit-questions', '1', '--out', 'runs.json');
    invoke('run-importance', '--questions', 'bank.json', '--models', 'models.json', '--provider', 'mock', '--repeats', '1', '--out', 'importance.json');
    const args = ['build-report', '--questions', 'bank.json', '--models', 'models.json', '--runs', 'runs.json', '--importance', 'importance.json', '--limit-questions', '1', '--out', 'report.json'];
    bank.questions[1].canonicalPrompt += ' Changed wording outside the displayed subset.';
    await write('bank.json', bank);
    const fullArgs = args.filter((arg, index) => arg !== '--limit-questions' && args[index - 1] !== '--limit-questions');
    const fullMismatch = spawnSync(process.execPath, [cli, ...fullArgs], { cwd: root, encoding: 'utf8' });
    assert.notEqual(fullMismatch.status, 0);
    assert.match(fullMismatch.stderr, /promptHash.*current prompt/);
    const mismatch = spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8' });
    assert.notEqual(mismatch.status, 0);
    assert.match(mismatch.stderr, /promptHash.*current prompt/);
    bank.questions[1].canonicalPrompt = sample.questions[1].canonicalPrompt;
    await write('bank.json', bank);
    invoke(...args);
    const importance = JSON.parse(await fs.readFile(path.join(root, 'importance.json'), 'utf8'));
    importance.runs[0].questionOrderHash = 'wrong-order';
    await write('importance.json', importance);
    const orderMismatch = spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8' });
    assert.notEqual(orderMismatch.status, 0);
    assert.match(orderMismatch.stderr, /questionOrderHash/);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('preview and export keep answers bound to the wording asked by run', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'aidb-preview-wording-'));
  try {
    const sample = JSON.parse(await fs.readFile(new URL('../data/question-bank.sample.json', import.meta.url), 'utf8'));
    const bank = { ...sample, runPlan: { ...sample.runPlan, repeatsPerPolarity: 1 }, questions: sample.questions.slice(0, 1) };
    const models = { models: [{ id: 'fixture', label: 'Fixture model', model: 'fixture', provider: 'mock', traits: {} }] };
    const write = (name, value) => fs.writeFile(path.join(root, name), JSON.stringify(value));
    const json = async name => JSON.parse(await fs.readFile(path.join(root, name), 'utf8'));
    const invoke = (...args) => execFileSync(process.execPath, [cli, ...args], { cwd: root, stdio: 'pipe' });
    await write('bank.json', bank);
    await write('models.json', models);
    invoke('run', '--questions', 'bank.json', '--models', 'models.json', '--provider', 'mock', '--repeats', '1', '--out', 'runs.json');
    const buildArgs = ['build-report', '--questions', 'bank.json', '--models', 'models.json', '--runs', 'runs.json', '--out', 'report.json'];
    invoke(...buildArgs);
    invoke('export-ce', '--report', 'report.json', '--out', 'export.json');
    assert.equal((await json('export.json')).questionPrompts[bank.questions[0].id], bank.questions[0].canonicalPrompt);
    const runs = await json('runs.json');
    const swapped = structuredClone(bank);
    [swapped.questions[0].canonicalPrompt, swapped.questions[0].reversedPrompt] = [swapped.questions[0].reversedPrompt, swapped.questions[0].canonicalPrompt];
    await write('bank.json', swapped);
    const mismatch = spawnSync(process.execPath, [cli, ...buildArgs], { cwd: root, encoding: 'utf8' });
    assert.notEqual(mismatch.status, 0);
    assert.ok(mismatch.stderr.includes(bank.questions[0].id));
    assert.match(mismatch.stderr, /promptHash.*(rerun|restore)/i);
    await write('bank.json', bank);
    const missing = structuredClone(runs);
    delete missing.runs[0].promptHash;
    await write('runs.json', missing);
    const noHash = spawnSync(process.execPath, [cli, ...buildArgs], { cwd: root, encoding: 'utf8' });
    assert.notEqual(noHash.status, 0);
    assert.match(noHash.stderr, /promptHash/);
    const unchangedErrors = validateReleaseRunFile(runs, { questionBank: bank });
    assert.ok(unchangedErrors.every(error => !error.includes('.promptHash')));
    const changedErrors = validateReleaseRunFile(runs, { questionBank: swapped });
    assert.ok(changedErrors.some(error => error.includes('.promptHash') && error.includes(bank.questions[0].id)));
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
