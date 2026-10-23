import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { buildStaticReportPublication } from '../scripts/publish-static-report.mjs';
import { buildSecondPassAnalysisInput } from '../src/analysis-export.mjs';
import { buildContextEngineBenchmarkDataset } from '../src/ce-native-export.mjs';
import { hashJson } from '../src/provenance.mjs';
import { renderHtmlReport } from '../src/render-html.mjs';
import { correctSavedReportDistributions } from '../src/saved-report-correction.mjs';
import { buildResultsReport } from '../src/scoring.mjs';

const fixture = () => {
  const current = buildResultsReport({
    questionBank: {
      benchmarkId: 'saved-preview',
      questions: [{ id: 'q', canonicalPrompt: 'A test statement.', reversedPrompt: 'An opposite test statement.', topic: 'test' }],
    },
    modelRoster: { models: ['mixed', 'unsure'].map((id) => ({ id, label: id, model: id, provider: 'local', provenance: { modelRevision: 'fixture' } })) },
    runsFile: {
      mode: 'self', repeats: 10,
      sourceRunContentHashes: ['original-run-content-hash'],
      runs: Object.entries({ mixed: ['Agree', 'Disagree'], unsure: Array(10).fill('Unsure') }).flatMap(([modelId, values]) => (
        values.flatMap((normalizedAnswer) => ['canonical', 'reversed'].map((polarity) => ({ modelId, questionId: 'q', polarity, normalizedAnswer })))
      )),
    },
  });
  const legacy = JSON.parse(JSON.stringify(current));
  const strip = (summary) => {
    delete summary.observedDistribution;
    delete summary.countsUnit;
    delete summary.meanStance;
    summary.uncertaintyRate = summary.counts.Unsure / summary.total;
    if (summary.polarity) {
      strip(summary.polarity.canonical);
      strip(summary.polarity.reversedNormalized);
    }
  };
  Object.values(legacy.polisReport.byModel).forEach(strip);
  Object.values(legacy.polisReport.byQuestion).forEach(strip);
  legacy.participants.forEach((participant) => strip(participant.summary));
  delete legacy.polisReport.responseDistributionVersion;
  delete legacy.polisReport.uncertaintyRateSemantics;
  return { current, legacy };
};

test('saved sufficient statistics recover current distributions while preserving original evidence', () => {
  const { current, legacy } = fixture();
  const before = structuredClone(legacy);
  const corrected = correctSavedReportDistributions(legacy, { correctedAt: '2026-10-16T00:00:00.000Z' });
  assert.deepEqual(legacy, before);
  assert.deepEqual(corrected.polisReport, current.polisReport);
  assert.deepEqual(corrected.participants, current.participants);
  assert.equal(corrected.polisReport.byQuestion.q.uncertaintyRate, 0.5);
  assert.equal(corrected.polisReport.byModel.mixed.uncertaintyRate, 0);
  assert.equal(legacy.polisReport.byModel.mixed.uncertaintyRate, 1);
  assert.deepEqual(corrected.polisReport.byQuestion.q.observedDistribution.probabilities, { Agree: 0.25, Unsure: 0.5, Disagree: 0.25 });
  for (const key of ['generatedAt', 'status', 'integrity', 'rawMaterial', 'counts', 'importance', 'participantGraph', 'debateAtlas', 'riskMatrix', 'statistics']) {
    assert.deepEqual(corrected[key], before[key], key);
  }
  assert.deepEqual(corrected.summaryCorrection, {
    method: 'recomputed-from-saved-model-question-counts-v1',
    sourceReportContentHash: hashJson(before),
    sourceCellContentHash: hashJson(before.polisReport.byModelQuestion),
    correctedAt: '2026-10-16T00:00:00.000Z',
    rawRunsRevalidated: false,
  });
});

test('saved correction retains original intervals and raw summaries without resampling', () => {
  const { legacy } = fixture();
  legacy.polisReport.byQuestion.q.meanScoreInterval = { low: -0.1234, high: 0.5678, method: 'original-interval' };
  legacy.polisReport.byQuestion.q.runSummary.originalRecord = 'preserved';
  const corrected = correctSavedReportDistributions(legacy);
  assert.deepEqual(corrected.polisReport.byModelQuestion, legacy.polisReport.byModelQuestion);
  for (const group of ['byModel', 'byQuestion']) {
    for (const [id, original] of Object.entries(legacy.polisReport[group])) {
      const updated = corrected.polisReport[group][id];
      for (const key of ['meanScoreInterval', 'runSummary', 'winningResponseConsistency', 'wordingSensitivity']) {
        assert.deepEqual(updated[key], original[key]);
      }
      for (const form of ['canonical', 'reversedNormalized']) {
        assert.deepEqual(updated.polarity[form].meanScoreInterval, original.polarity[form].meanScoreInterval);
      }
    }
  }
});

test('corrected saved preview reaches report consumers and deterministic static publication', () => {
  const corrected = correctSavedReportDistributions(fixture().legacy);
  assert.equal(buildSecondPassAnalysisInput(corrected).questions[0].aggregate.uncertaintyRate, 0.5);
  assert.equal(buildContextEngineBenchmarkDataset(corrected).polisReport.byQuestion.q.observedDistribution.probabilities.Unsure, 0.5);
  const html = renderHtmlReport(corrected);
  assert.match(html, /data-ce-benchmark-saved-correction/);
  assert.match(html, /original model runs were not rerun or revalidated/);
  assert.match(html, /data-ce-atlas-model-answer="Mixed \(mean stance\)"/);
  assert.ok(/data-question-agree="0.5"[\s\S]*?data-question-disagree="0.5"[\s\S]*?data-question-unsure="1"/.test(html));
  const publication = buildStaticReportPublication({ report: corrected, html, reportId: 'saved-preview' });
  assert.equal(publication.entry.publicationStatus, 'development-preview');
  assert.equal(publication.entry.generatedAt, corrected.generatedAt);
  assert.equal(publication.entry.releaseReportContentHash, null);
  assert.equal(gunzipSync(publication.artifactBytes).toString(), html);
});

test('saved correction refuses missing or inconsistent statistics and bound downstream artifacts', () => {
  const cases = [
    [(report) => { delete report.polisReport.byModelQuestion.mixed.q; }, /incomplete answer counts/],
    [(report) => { report.polisReport.byModelQuestion.mixed.q.counts.Agree += 1; }, /incomplete answer counts/],
    [(report) => { report.polisReport.byQuestion.q.meanScore = 0.5; }, /cannot be corrected/],
    [(report) => { report.analysisOverlay = {}; }, /analysis overlay/],
    [(report) => { report.aiAnalysis = {}; }, /analysis overlay/],
    [(report) => { report.releaseValidationReceipt = {}; }, /release receipt/],
    [(report) => { report.status = 'release-ready'; }, /preview report/],
    [(report) => { report.polisReport.responseDistributionVersion = 1; }, /already declares/],
  ];
  for (const [change, message] of cases) {
    const { legacy } = fixture();
    change(legacy);
    assert.throws(() => correctSavedReportDistributions(legacy), message);
  }
});

test('checked-in corrected preview preserves its historical cells, intervals, and run evidence', async () => {
  const artifact = await readFile(new URL('../../client/public/benchmark-artifacts/model-opinions-bench-development-preview.html.gz', import.meta.url));
  const html = gunzipSync(artifact).toString('utf8');
  const embedded = html.match(/<script[^>]+id="ce-ai-discourse-bench-report"[^>]*>([\s\S]*?)<\/script>/);
  assert.ok(embedded, 'published preview embeds its source report');
  const report = JSON.parse(embedded[1]);
  assert.equal(report.summaryCorrection.sourceReportContentHash, '83d983a2b4be68ef05f098b75a0197156a43008ee7da889127a4bae04ee83acd');
  assert.equal(report.summaryCorrection.rawRunsRevalidated, false);
  assert.equal(hashJson(report.polisReport.byModelQuestion), '0597a4bc1a52cd001dc332c12bf2d4a14c3a9e4d64fb3d8c0ea7d3c39a842773');
  assert.equal(hashJson(report.rawMaterial), '5bc9d2c80134af1121ff413d848b540dfd176f867f2e34c34708bd1e25a00d71');
  const summaries = [report.polisReport.byModel, report.polisReport.byQuestion].flatMap((group) => Object.values(group));
  assert.equal(hashJson(summaries.map((summary) => summary.runSummary)), '56b889dc366ead91da810b6cc8481f65e7605b9e84cd152c45f037ac23db90fc');
  assert.equal(hashJson(summaries.map((summary) => [summary.meanScoreInterval, summary.polarity.canonical.meanScoreInterval, summary.polarity.reversedNormalized.meanScoreInterval])), 'b48b7d4594066c3dfc1db06ff3cd60b98162a77fa668e0c596fd02b54a9ca569');
  assert.equal(report.generatedAt, '2026-08-11T02:56:58.620Z');
  assert.equal(report.status, 'preview');
  assert.equal(report.integrity.releaseReady, false);
  assert.equal(report.counts.runs, 20000);
  // This historical mean is exactly at a floating-point rounding tie; retain it.
  assert.equal(report.polisReport.byModel['qwen3-coder-next'].meanScore, 0.6143);
  assert.equal(report.polisReport.byModel['gpt-oss-120b'].uncertaintyRate, 0.0992);
  assert.ok(Math.abs(report.polisReport.byModel['gpt-oss-120b'].observedDistribution.probabilities.Unsure - 0.09925) < 1e-12);
  assert.equal(report.polisReport.byModel['gpt-oss-120b'].meanStance.mixedOrUnsureRate, 0.235);
  assert.equal(report.polisReport.responseDistributionVersion, 1);
  assert.ok(html.includes('data-ce-benchmark-saved-correction'));
});

test('legacy means rounded from validated cell means remain correctable with invalid attempts', () => {
  const legacy = buildResultsReport({
    questionBank: { benchmarkId: 'rounded-preview', questions: [{ id: 'q', canonicalPrompt: 'A test statement.', reversedPrompt: 'An opposite statement.', topic: 'test' }] },
    modelRoster: { models: ['thirds', 'half'].map(id => ({ id, label: id, model: id, provider: 'local', provenance: { modelRevision: 'fixture' } })) },
    runsFile: { mode: 'self', repeats: 4, runs: Object.entries({ thirds: ['Agree', 'Agree', 'Unsure', null], half: ['Agree', 'Unsure'] })
      .flatMap(([modelId, values]) => values.flatMap(normalizedAnswer => ['canonical', 'reversed'].map(polarity => ({ modelId, questionId: 'q', polarity, normalizedAnswer })))) },
  });
  delete legacy.polisReport.responseDistributionVersion;
  delete legacy.polisReport.uncertaintyRateSemantics;
  const historical = (summary, cells) => {
    const values = cells.map(cell => cell.meanScore).filter(Number.isFinite);
    summary.meanScore = values.length ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(4)) : null;
    delete summary.observedDistribution;
    delete summary.countsUnit;
    delete summary.meanStance;
    if (summary.polarity) for (const form of ['canonical', 'reversedNormalized']) historical(summary.polarity[form], cells.map(cell => cell.polarity[form]));
  };
  for (const participant of legacy.participants) historical(legacy.polisReport.byModel[participant.id], [legacy.polisReport.byModelQuestion[participant.id].q]);
  historical(legacy.polisReport.byQuestion.q, legacy.participants.map(p => legacy.polisReport.byModelQuestion[p.id].q));
  assert.equal(legacy.polisReport.byQuestion.q.meanScore, 0.5834);
  const corrected = correctSavedReportDistributions(legacy);
  assert.equal(corrected.polisReport.byQuestion.q.meanScore, 0.5834);
  assert.deepEqual(corrected.polisReport.byModelQuestion, legacy.polisReport.byModelQuestion);
  legacy.polisReport.byQuestion.q.meanScore = 0.5835;
  assert.throws(() => correctSavedReportDistributions(legacy), /cannot be corrected/);
});
