import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { runBenchmark } from '../src/runner.mjs';
import { renderHtmlReport } from '../src/render-html.mjs';

const cli = fileURLToPath(new URL('../bin/ai-discourse-bench.mjs', import.meta.url));
for (const [trait, value, topic] of [['cohort', 'constructor', 'constructor'], ['constructor', 'first', '__proto__'], ['__proto__', 'constructor', 'ordinary'], ['cohort', 'first', 'ordinary']]) {
  test(`build-report keeps own groups for ${trait}=${value}`, async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'aidb-trait-keys-'));
    try {
      const sample = JSON.parse(await fs.readFile(new URL('../data/question-bank.sample.json', import.meta.url), 'utf8'));
      const questionBank = { ...sample, runPlan: { ...sample.runPlan, repeatsPerPolarity: 1 },
        questions: [{ ...sample.questions[0], id: 'constructor', topic }] };
      const modelRoster = { models: ['constructor', 'second'].map((id, index) => ({ id, label: id, model: id, provider: 'mock',
        traits: Object.fromEntries([[trait, index ? 'second' : value]]) })) };
      const runsFile = await runBenchmark({ questionBank, modelRoster, repeats: 1, concurrency: 1 });
      for (const [name, data] of [['bank', questionBank], ['roster', modelRoster], ['runs', runsFile]]) {
        await fs.writeFile(path.join(root, name + '.json'), JSON.stringify(data));
      }
      execFileSync(process.execPath, [cli, 'build-report', '--questions', 'bank.json', '--models', 'roster.json',
        '--runs', 'runs.json', '--out', 'report.json'], { cwd: root, stdio: 'pipe' });
      const report = JSON.parse(await fs.readFile(path.join(root, 'report.json'), 'utf8'));
      assert.ok(Object.hasOwn(report.breakdown, trait));
      assert.ok(Object.hasOwn(report.breakdown[trait], value));
      assert.deepEqual(report.breakdown[trait][value], ['constructor']);
      assert.deepEqual(report.breakdown[trait].second, ['second']);
      assert.equal(report.importance.byTopic[topic].questionCount, 1);
      assert.ok(report.participants.every(row => row.opinionGroup === null || Number.isInteger(row.opinionGroup)));
      assert.ok(Object.hasOwn(report.polisReport.byModelQuestion.constructor, 'constructor'));
      const html = renderHtmlReport(report);
      const filter = html.match(/function breakdownFilteredParticipantIds\(groups\) \{[\s\S]*?\n      \}/)?.[0];
      assert.ok(filter);
      const context = vm.createContext({ reportSnapshot: report, groups: [{ trait, ids: ['constructor'] }] });
      assert.equal(vm.runInContext(`${filter}; JSON.stringify(breakdownFilteredParticipantIds(groups))`, context), '["constructor"]');
      execFileSync(process.execPath, [cli, 'export-ce', '--report', 'report.json', '--out', 'export.json'], { cwd: root, stdio: 'pipe' });
      const exported = JSON.parse(await fs.readFile(path.join(root, 'export.json'), 'utf8'));
      assert.equal(exported.displayNamesMap.constructor, 'constructor');
      assert.ok(Object.hasOwn(exported.questionPrompts, 'constructor'));
    } finally { await fs.rm(root, { recursive: true, force: true }); }
  });
}
