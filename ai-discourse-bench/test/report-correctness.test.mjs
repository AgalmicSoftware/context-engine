import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { buildResultsReport } from '../src/scoring.mjs';
import { renderHtmlReport } from '../src/render-html.mjs';
import { buildContextEngineBenchmarkDataset } from '../src/ce-native-export.mjs';
import { buildContextEnginePolisExport } from '../src/ce-export.mjs';
import { buildSecondPassAnalysisInput, attachAnalysisOverlay } from '../src/analysis-export.mjs';
import { buildReportFingerprint, hashJson } from '../src/provenance.mjs';
import { buildReportSnapshot } from '../src/longitudinal.mjs';

const reportFor = (answersByModel, coverage = null) => {
  const ids = coverage ? [...new Set(Object.values(coverage).flat())] : ['q'];
  return buildResultsReport({
    questionBank: { benchmarkId: 'report-correctness', questions: ids.map((id) => ({ id, canonicalPrompt: `Statement ${id}.`, reversedPrompt: `Opposite ${id}.`, topic: 'test' })) },
    modelRoster: { models: Object.keys(answersByModel).map((id) => ({ id, label: id, model: id, provider: 'local', traits: { cohort: 'all' } })) },
    runsFile: { manifest: { mode: 'self', personaId: null, promptTemplateVersion: 'fixture-v1', promptTemplateHash: 'a'.repeat(64) }, repeats: 10, runs: Object.entries(answersByModel).flatMap(([modelId, answers]) => (
      (coverage?.[modelId] || ids).flatMap((questionId) => answers.flatMap((normalizedAnswer) => ['canonical', 'reversed'].map((polarity) => ({ modelId, questionId, polarity, normalizedAnswer }))))
    )) },
  });
};

const legacyReport = (report) => {
  const legacy = structuredClone(report);
  const strip = (summary) => {
    delete summary.observedDistribution;
    delete summary.meanStance;
    delete summary.countsUnit;
    summary.uncertaintyRate = summary.counts.Unsure / summary.total;
    if (summary.polarity) ['canonical', 'reversedNormalized'].forEach((form) => strip(summary.polarity[form]));
  };
  Object.values(legacy.polisReport.byQuestion).forEach(strip);
  Object.values(legacy.polisReport.byModel).forEach(strip);
  legacy.participants.forEach((participant) => strip(participant.summary));
  delete legacy.polisReport.responseDistributionVersion;
  delete legacy.polisReport.uncertaintyRateSemantics;
  return legacy;
};

const embeddedReport = (html) => JSON.parse(html.match(/id="ce-ai-discourse-bench-report">([\s\S]*?)<\/script>/)[1]);
const questionRow = (html, id = 'q') => html.split(`id="question-${id}"`)[1]?.split('id="participants-list"')[0].split('class="questionListItem"')[0] || '';
const browserFunction = (html, name) => html.match(new RegExp(`function ${name}\\([^]*?\\n      \\}`))?.[0];

test('mean markers have a separate stance axis and coincident means remain individually focusable', () => {
  const report = reportFor({ a: ['Agree', 'Disagree'], b: ['Agree', 'Disagree'], c: ['Agree', 'Disagree'] });
  const html = renderHtmlReport(report);
  const row = questionRow(html);
  const histogram = row.match(/data-ce-atlas-question-vote-bar>([\s\S]*?)<\/div>/)?.[1];
  assert.ok(histogram);
  assert.doesNotMatch(histogram, /data-ce-atlas-model-marker/);
  assert.match(row, /data-ce-model-stance-axis/);
  assert.match(row, /Model mean stance/);
  const markers = [...row.matchAll(/data-ce-atlas-model-marker="([^"]+)"([\s\S]*?)<\/span>/g)];
  assert.equal(markers.length, 3);
  const lanes = new Set();
  for (const [, , attributes] of markers) {
    assert.match(attributes, /data-ce-atlas-model-mean="0"/);
    assert.match(attributes, /left:50\.00%/);
    assert.match(attributes, /tabindex="0"/);
    assert.match(attributes, /Agree 50%, Unsure 0%, Disagree 50%/);
    lanes.add(attributes.match(/--stance-lane:(\d+)/)?.[1]);
  }
  assert.equal(lanes.size, 3);
  assert.match(html, /data-ce-model-stance-tooltip/);
});

test('dominant observed uncertainty is distinct from a central mixed mean', () => {
  const html = renderHtmlReport(reportFor({
    mostly: [...Array(19).fill('Unsure'), 'Disagree'],
    entirely: ['Unsure'],
    mixed: ['Agree', 'Disagree'],
  }));
  const row = questionRow(html);
  assert.match(row, /data-ce-atlas-model-marker="mostly"[\s\S]*?data-ce-atlas-model-answer="Mostly Unsure"/);
  assert.match(row, /data-ce-atlas-model-marker="mostly"[\s\S]*?Unsure 95%/);
  assert.match(row, /data-ce-atlas-model-marker="entirely"[\s\S]*?data-ce-atlas-model-answer="Unsure"/);
  assert.match(row, /data-ce-atlas-model-marker="mixed"[\s\S]*?data-ce-atlas-model-answer="Mixed \(mean stance\)"/);
});

test('visible weighted counts and hover data never expose binary floating-point residue', () => {
  const report = reportFor({ a: [...Array(17).fill('Agree'), 'Unsure', 'Disagree', 'Disagree'], b: ['Agree'], c: ['Agree'], d: ['Agree'], e: ['Agree'] });
  const originalCounts = structuredClone(report.polisReport.byQuestion.q.observedDistribution.counts);
  const html = renderHtmlReport(report);
  const visible = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '');
  assert.doesNotMatch(visible, /(?:Responses:|Agree:|Unsure:|Disagree:)[^<>]*\d\.\d{8,}/);
  assert.doesNotMatch(visible, /data-question-(?:agree|unsure|disagree|votes)="\d\.\d{8,}/);
  assert.match(questionRow(html), /<strong>Responses:<\/strong> 5/);
  assert.deepEqual(report.polisReport.byQuestion.q.observedDistribution.counts, originalCounts);
});

test('legacy rendering derives observed counts consistently without rewriting source evidence', () => {
  const legacy = legacyReport(reportFor({ a: ['Agree', 'Disagree'], b: ['Unsure'] }));
  const before = structuredClone(legacy);
  const html = renderHtmlReport(legacy);
  assert.match(questionRow(html), /<strong>Agree:<\/strong> 0\.5 \/\s*<strong>Unsure:<\/strong> 1 \/\s*<strong>Disagree:<\/strong> 0\.5/);
  assert.match(html, /data-ce-legacy-distribution-notice/);
  const shared = html.match(/var aggregateResponseDistributions = ([\s\S]*?);\n      function aggregateBreakdownQuestion/)[1];
  const formatter = html.match(/var formatCount = ([\s\S]*?);\n      var aggregateResponseDistributions/)[1];
  const context = { reportSnapshot: legacy, escapeText: String, percent: (part, total) => part / total * 100 };
  const code = `var formatCount = ${formatter}; var aggregateResponseDistributions = ${shared}; ${browserFunction(html, 'aggregateBreakdownQuestion')} ${browserFunction(html, 'tagQuestionCounts')} ${browserFunction(html, 'renderTagQuestionCard')} renderTagQuestionCard(reportSnapshot.questions[0]);`;
  const tagCard = vm.runInNewContext(code, context);
  assert.match(tagCard, /Agree 0\.5/);
  assert.match(tagCard, /Unsure 1/);
  assert.deepEqual(legacy, before);
  assert.deepEqual(embeddedReport(html).polisReport.byModelQuestion, before.polisReport.byModelQuestion);
});

test('insufficient retained cell counts withhold observed distributions instead of reusing legacy buckets', () => {
  const legacy = legacyReport(reportFor({ a: ['Agree', 'Disagree'], b: ['Unsure'] }));
  delete legacy.polisReport.byModelQuestion.a.q.counts;
  const html = renderHtmlReport(legacy);
  assert.match(questionRow(html), /Observed answer distribution unavailable/);
  assert.doesNotMatch(questionRow(html), /<strong>Unsure:<\/strong> 2/);
  assert.match(html, /data-ce-observed-distribution-unavailable/);
  const tooltip = { innerHTML: '', hidden: true };
  vm.runInNewContext(`${browserFunction(html, 'renderBeeswarmTooltip')} renderBeeswarmTooltip(point);`, {
    beeswarmTooltip: tooltip, escapeText: String, percent: () => 0,
    point: { dataset: { questionId: 'q', questionPrompt: 'Statement', questionDistributionUnavailable: 'true' } },
  });
  assert.match(tooltip.innerHTML, /Observed answer distribution unavailable/);
  assert.doesNotMatch(tooltip.innerHTML, /<strong>Agree:/);
  const comparison = vm.runInNewContext(`${browserFunction(html, 'breakdownComparisonRows')} breakdownComparisonRows(groups);`, {
    reportSnapshot: legacy,
    groups: [{ ids: ['a'] }, { ids: ['b'] }, { ids: ['c'] }],
    aggregateBreakdownQuestion: (_id, ids) => ids.includes('a') ? { valid: 0, distributionUnavailable: true } : { valid: 1, meanScore: 1 },
    breakdownConsistency: () => ({}),
  });
  assert.equal(comparison.length, 0, 'do not compare only the available subset of selected cohorts');
});

test('incomplete pairwise overlap withholds automatic groups in report, native export and HTML', () => {
  for (const coverage of [
    { a: ['q1', 'q2'], b: ['q1', 'q2'], c: ['q3', 'q4'], d: ['q3', 'q4'] },
    { a: ['q1'], b: ['q1', 'q2'], c: ['q2'] },
  ]) {
    const report = reportFor(Object.fromEntries(Object.keys(coverage).map((id) => [id, ['Agree']])), coverage);
    assert.ok(report.participants.every((participant) => participant.opinionGroup === null));
    assert.equal(report.participantGraph.opinionGroupAvailability.status, 'unavailable');
    assert.equal(report.participantGraph.opinionGroupAvailability.reason, 'incomplete-pairwise-similarity');
    const historical = structuredClone(report);
    historical.participants.forEach((participant, index) => { participant.opinionGroup = index; });
    historical.participantGraph.nodes.forEach((participant, index) => { participant.opinionGroup = index; });
    delete historical.participantGraph.opinionGroupAvailability;
    const native = buildContextEngineBenchmarkDataset(historical);
    assert.ok(native.participants.every((participant) => participant.opinionGroup === null));
    assert.ok(native.participantGraph.nodes.every((participant) => participant.opinionGroup === null));
    assert.deepEqual(native.polisReport.similarityMatrix, historical.polisReport.similarityMatrix);
    const html = renderHtmlReport(historical);
    assert.match(html, /data-ce-participant-embedding-unavailable/);
    assert.ok(embeddedReport(html).participants.every((participant) => participant.opinionGroup === null));
    assert.doesNotMatch(JSON.stringify(buildContextEnginePolisExport(historical)), /"opinionGroup"/);
  }
  const complete = reportFor({ a: ['Agree'], b: ['Agree'] });
  assert.equal(complete.participantGraph.opinionGroupAvailability.status, 'available');
  assert.equal(complete.participantGraph.opinionGroupAvailability.interpretation, 'exploratory');
  assert.equal(complete.participants[0].opinionGroup, complete.participants[1].opinionGroup);
  assert.match(renderHtmlReport(complete), /Exploratory opinion groups/);
});

test('correction provenance survives every derived export and binds analysis without changing legacy fingerprints', () => {
  const report = reportFor({ a: ['Agree'] });
  const legacyHash = buildReportFingerprint(report);
  const correction = { method: 'recomputed-from-saved-model-question-counts-v1', sourceReportContentHash: hashJson({ original: true }), sourceCellContentHash: hashJson(report.polisReport.byModelQuestion), correctedAt: '2026-10-17T00:00:00.000Z', rawRunsRevalidated: false };
  const corrected = { ...report, summaryCorrection: correction };
  assert.notEqual(buildReportFingerprint(corrected), legacyHash);
  const changed = structuredClone(corrected);
  changed.summaryCorrection.rawRunsRevalidated = true;
  assert.notEqual(buildReportFingerprint(changed), buildReportFingerprint(corrected));
  for (const exporter of [buildContextEngineBenchmarkDataset, buildContextEnginePolisExport, buildSecondPassAnalysisInput, buildReportSnapshot]) {
    assert.deepEqual(exporter(corrected).summaryCorrection, correction);
  }
  const input = buildSecondPassAnalysisInput(corrected);
  const overlay = { schemaVersion: 1, kind: 'ai_discourse_bench_analysis_overlay', provenance: { generatedBy: 'test', model: 'fixture', promptVersion: 'test', inputReportHash: legacyHash, generatedAt: '2026-10-17T00:01:00.000Z' } };
  assert.throws(() => attachAnalysisOverlay(corrected, overlay), /regenerate.*analysis/i);
  assert.throws(() => renderHtmlReport({ ...corrected, analysisOverlay: overlay }), /regenerate.*analysis/i);
  assert.equal(attachAnalysisOverlay(corrected, { ...overlay, provenance: { ...overlay.provenance, inputReportHash: input.inputReportHash } }).analysisOverlay.provenance.inputReportHash, input.inputReportHash);
  const fields = ['benchmarkId', 'generatedAt', 'mode', 'personaId', 'counts', 'questions', 'participants', 'polisReport', 'participantGraph', 'statistics', 'importance', 'debateAtlas', 'riskMatrix', 'rawMaterial', 'integrity'];
  const oldPayload = Object.fromEntries(fields.map((key) => [key, report[key] ?? (key === 'personaId' ? null : {})]));
  assert.equal(buildReportFingerprint(report), hashJson(oldPayload));
});

test('legacy HTML analysis inputs and corrected overlays stay bound to the saved report', () => {
  for (const corrected of [false, true]) {
    const legacy = reportFor({ a: ['Agree'] });
    delete legacy.participantGraph.opinionGroupAvailability;
    legacy.participants.forEach((participant, index) => { participant.opinionGroup = index; });
    legacy.participantGraph.nodes.forEach((participant, index) => { participant.opinionGroup = index; });
    if (corrected) legacy.summaryCorrection = { method: 'recomputed-from-saved-model-question-counts-v1', rawRunsRevalidated: false };
    const before = structuredClone(legacy);
    const html = renderHtmlReport(legacy);
    const input = JSON.parse(html.match(/<script[^>]+id="ce-ai-discourse-bench-analysis-input"[^>]*>([\s\S]*?)<\/script>/)[1]);
    assert.equal(input.inputReportHash, buildReportFingerprint(legacy));
    assert.ok(embeddedReport(html).participants.every((participant) => participant.opinionGroup === null));
    const overlay = {
      schemaVersion: 1, kind: 'ai_discourse_bench_analysis_overlay',
      provenance: { generatedBy: 'test', model: 'fixture', promptVersion: 'test', inputReportHash: input.inputReportHash, generatedAt: '2026-10-17T00:01:00.000Z' },
    };
    const attached = attachAnalysisOverlay(legacy, overlay);
    assert.doesNotThrow(() => renderHtmlReport(attached));
    assert.deepEqual(legacy, before);
  }
});
