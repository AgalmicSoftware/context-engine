import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { buildResultsReport } from '../src/scoring.mjs';
import { renderHtmlReport } from '../src/render-html.mjs';
import { buildSecondPassAnalysisInput } from '../src/analysis-export.mjs';
import { buildContextEngineBenchmarkDataset } from '../src/ce-native-export.mjs';
import { buildContextEnginePolisExport } from '../src/ce-export.mjs';

const makeReport = (answersByModel) => buildResultsReport({
  questionBank: { benchmarkId: 'test', questions: [{ id: 'q', canonicalPrompt: 'Test statement.', topic: 'test' }] },
  modelRoster: { models: Object.keys(answersByModel).map((id) => ({ id, label: id, model: id, provider: 'local', traits: { cohort: 'all' } })) },
  runsFile: { repeats: 1, runs: Object.entries(answersByModel).flatMap(([modelId, answers]) => answers.flatMap((normalizedAnswer) => ['canonical', 'reversed'].map((polarity) => ({ modelId, questionId: 'q', polarity, normalizedAnswer })))) },
});

// Execute the emitted browser aggregation itself, so changing an interactive filter cannot
// silently restore run weighting after the initial server-rendered report is correct.
const browserAggregate = (report, ids) => {
  const html = renderHtmlReport(report);
  const source = html.match(/function aggregateBreakdownQuestion\(questionId, participantIds\) \{[\s\S]*?\n      \}/)?.[0];
  const shared = html.match(/var aggregateResponseDistributions = ([\s\S]*?);\n      function aggregateBreakdownQuestion/)?.[1] || 'undefined';
  const context = { reportSnapshot: report, ids };
  return JSON.parse(JSON.stringify(vm.runInNewContext(`var aggregateResponseDistributions = ${shared}; ${source}; aggregateBreakdownQuestion('q', ids)`, context)));
};

test('overall, cohort, and browser summaries give each valid model one distribution weight', () => {
  const balanced = makeReport({ a: ['Agree', 'Disagree'], b: ['Disagree', 'Disagree', 'Disagree'] });
  const uneven = makeReport({ a: Array(10).fill(['Agree', 'Disagree']).flat(), b: ['Disagree', null, null] });
  for (const report of [balanced, uneven]) {
    const overall = report.polisReport.byQuestion.q;
    assert.deepEqual(overall.observedDistribution.probabilities, { Agree: 0.25, Unsure: 0, Disagree: 0.75 });
    const browser = browserAggregate(report, ['a', 'b']);
    assert.equal(browser.meanScore, -0.5);
    assert.deepEqual(browser.observedDistribution, overall.observedDistribution);
    assert.equal(browser.valid, 2);
    assert.equal(browser.runSummary.total, report.counts.runs);
    assert.deepEqual(browserAggregate(report, []).counts, { Agree: 0, Unsure: 0, Disagree: 0 });
    assert.equal(buildSecondPassAnalysisInput(report).questions[0].aggregate.meanScore, -0.5);
    assert.match(renderHtmlReport(report), /data-question-agree="0.5"[\s\S]*?data-question-disagree="1.5"/);
  }
});

test('mixed repeated answers and observed Unsure remain distinct in reports and exports', () => {
  const mixed = makeReport({ a: ['Agree', 'Disagree'] });
  const unsure = makeReport({ a: ['Unsure', 'Unsure'] });
  for (const [report, expected] of [[mixed, 0], [unsure, 1]]) {
    for (const summary of [report.polisReport.byQuestion.q, report.polisReport.byModel.a, report.polisReport.byQuestion.q.polarity.canonical]) {
      assert.equal(summary.meanScore, 0);
      assert.equal(summary.uncertaintyRate, expected);
      assert.equal(summary.observedDistribution.probabilities.Unsure, expected);
      assert.equal(summary.meanStance.mixedOrUnsureRate, 1);
    }
    const analysis = buildSecondPassAnalysisInput(report).questions[0].aggregate;
    assert.equal(analysis.observedDistribution.probabilities.Unsure, expected);
    assert.equal(analysis.uncertaintyRate, expected);
    assert.deepEqual(analysis.counts, { Agree: 0, Unsure: 1, Disagree: 0 });
    assert.equal(analysis.countsUnit, 'discretized-mean-stances');
    assert.equal(buildContextEngineBenchmarkDataset(report).polisReport.byQuestion.q.observedDistribution.probabilities.Unsure, expected);
    const compatibility = JSON.parse(buildContextEnginePolisExport(report).questionResponses.q[0].response);
    assert.equal(compatibility.answer.value, 'Unsure');
    assert.equal(compatibility.benchmark.averagedFrom.observedDistribution.probabilities.Unsure, expected);
    assert.equal(compatibility.benchmark.answerSemantics, 'discretized-mean-stance');
    const html = renderHtmlReport(report);
    assert.match(html, expected ? /data-ce-atlas-model-answer="Unsure"/ : /data-ce-atlas-model-answer="Mixed \(mean stance\)"/);
    assert.match(html, expected ? /data-ce-atlas-question-distribution aria-label="Model vote distribution: Agree 0, Unsure 1, Disagree 0/ : /data-ce-atlas-question-distribution aria-label="Model vote distribution: Agree 0.5, Unsure 0, Disagree 0.5/);
  }
});

test('disjoint identical responders and connected partial overlap never get a joint spatial position', () => {
  for (const coverage of [
    { a: ['q1', 'q2'], b: ['q1', 'q2'], c: ['q3', 'q4'], d: ['q3', 'q4'] },
    { a: ['q1'], b: ['q1', 'q2'], c: ['q2'] },
  ]) {
    const questionIds = [...new Set(Object.values(coverage).flat())];
    const report = buildResultsReport({
      questionBank: { benchmarkId: 'overlap', questions: questionIds.map((id) => ({ id, canonicalPrompt: id })) },
      modelRoster: { models: Object.keys(coverage).map((id) => ({ id, label: id, model: id, provider: 'local' })) },
      runsFile: { runs: Object.entries(coverage).flatMap(([modelId, ids]) => ids.map((questionId) => ({ modelId, questionId, normalizedAnswer: 'Agree', polarity: 'canonical' }))) },
    });
    assert.ok(report.participants.every((participant) => participant.coverage.eligibleForSimilarity));
    const html = renderHtmlReport(report);
    assert.match(html, /data-ce-participant-embedding-unavailable/);
    assert.match(html, /Missing overlap is not disagreement/);
    assert.doesNotMatch(html, /<g class="graph-participant/);
    assert.doesNotMatch(html, /id="cluster-count-input"/);
  }
});

test('interactive cohort repeat stability keeps wording sensitivity separate', () => {
  const report = buildResultsReport({
    questionBank: { benchmarkId: 'polarity', questions: [{ id: 'q', canonicalPrompt: 'Test statement.', reversedPrompt: 'Opposite statement.' }] },
    modelRoster: { models: [{ id: 'a', label: 'A', model: 'a', provider: 'local' }] },
    runsFile: { runs: ['canonical', 'reversed'].flatMap((polarity) => Array.from({ length: 2 }, () => ({ modelId: 'a', questionId: 'q', polarity, normalizedAnswer: polarity === 'canonical' ? 'Agree' : 'Disagree' }))) },
  });
  const html = renderHtmlReport(report);
  const source = html.match(/function breakdownConsistency\(questionId, participantIds\) \{[\s\S]*?\n      \}/)?.[0];
  const shared = html.match(/var summarizeWinningResponseConsistency = ([\s\S]*?);\n      function breakdownConsistency/)?.[1] || 'undefined';
  const run = (ids) => JSON.parse(JSON.stringify(vm.runInNewContext(`var summarizeWinningResponseConsistency = ${shared}; ${source}; breakdownConsistency('q', ids)`, { reportSnapshot: report, ids })));
  assert.equal(run(['a']).rate, 1);
  assert.equal(report.polisReport.byQuestion.q.wordingSensitivity.meanAbsoluteShift, 2);
  assert.deepEqual(run(['a']), report.polisReport.byQuestion.q.winningResponseConsistency);
  assert.equal(run([]).rate, null);
});
