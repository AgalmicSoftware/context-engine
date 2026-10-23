import { hashJson } from './provenance.mjs';
import { aggregateResponseDistributions } from './response-distributions.mjs';

const answers = ['Agree', 'Unsure', 'Disagree'];
const round = (value) => Number.isFinite(value) ? Number(value.toFixed(4)) : null;

const assertHistogram = (cell, label) => {
  if (!cell || !answers.every((answer) => Number.isInteger(cell.counts?.[answer]) && cell.counts[answer] >= 0)
    || !Number.isInteger(cell.invalid) || cell.invalid < 0
    || cell.valid !== answers.reduce((sum, answer) => sum + cell.counts[answer], 0)
    || cell.total !== cell.valid + cell.invalid) {
    throw new Error(`saved report has incomplete answer counts: ${label}`);
  }
  const mean = cell.valid ? round((cell.counts.Agree - cell.counts.Disagree) / cell.valid) : null;
  if (cell.meanScore !== mean) throw new Error(`saved report answer counts disagree with its mean: ${label}`);
};

const correctSummary = (summary, cells, label) => {
  const observed = aggregateResponseDistributions(cells);
  // Keep the historical four-decimal mean and its interval. Summing normalized
  // counts in a different order can cross an exact half-decimal rounding tie.
  // Legacy reports averaged the already-rounded cell means. Reproduce that
  // exact path from the validated histograms rather than widening the tolerance
  // for arbitrary summaries, which could conceal inconsistent evidence.
  const cellMeans = cells.map((cell) => cell.meanScore).filter(Number.isFinite);
  const historicalMean = cellMeans.length ? round(cellMeans.reduce((sum, value) => sum + value, 0) / cellMeans.length) : null;
  const meanMatches = observed.meanScore === null
    ? summary?.meanScore === null
    : Number.isFinite(summary?.meanScore) && (summary.meanScore === historicalMean
      || Math.abs(summary.meanScore - observed.meanScore) <= 0.0000500001);
  if (!summary || !meanMatches
    || summary.valid !== observed.valid || summary.total !== observed.total) {
    throw new Error(`saved report summary cannot be corrected without changing its existing statistics: ${label}`);
  }
  return {
    ...summary,
    countsUnit: 'discretized-mean-stances',
    observedDistribution: observed.observedDistribution,
    meanStance: {
      counts: summary.counts,
      mixedOrUnsureRate: summary.valid ? round(summary.counts.Unsure / summary.valid) : null,
    },
    uncertaintyRate: round(observed.uncertaintyRate),
  };
};

const correctAggregate = (summary, cells, label) => ({
  ...correctSummary(summary, cells, label),
  polarity: {
    ...summary.polarity,
    ...Object.fromEntries(['canonical', 'reversedNormalized'].map((form) => [
      form,
      correctSummary(summary.polarity?.[form], cells.map((cell) => cell.polarity[form]), `${label}:${form}`),
    ])),
  },
});

// This narrowly updates derived distributions from sufficient saved statistics;
// it neither reconstructs individual responses nor validates their provenance.
export const correctSavedReportDistributions = (source, { correctedAt = new Date().toISOString() } = {}) => {
  if (source?.kind !== 'ai_discourse_bench_report' || source.schemaVersion !== 2
    || source.status !== 'preview' || source.integrity?.releaseReady !== false) {
    throw new Error('saved distribution correction requires a schema-v2 preview report');
  }
  if (source.analysisOverlay || source.aiAnalysis || source.releaseValidationReceipt) {
    throw new Error('saved distribution correction cannot retain an analysis overlay or release receipt');
  }
  if (source.polisReport?.responseDistributionVersion === 1) {
    throw new Error('saved report already declares corrected response distributions');
  }
  const report = structuredClone(source);
  const { participants, questions, polisReport } = report;
  if (!participants?.length || !questions?.length || !polisReport?.byModelQuestion) {
    throw new Error('saved distribution correction requires the model/question count table');
  }
  let totalRuns = 0;
  for (const participant of participants) {
    for (const question of questions) {
      const cell = polisReport.byModelQuestion[participant.id]?.[question.id];
      const label = `${participant.id}:${question.id}`;
      assertHistogram(cell, label);
      for (const form of ['canonical', 'reversedNormalized']) assertHistogram(cell.polarity?.[form], `${label}:${form}`);
      for (const key of [...answers, 'invalid', 'total']) {
        const count = (row) => answers.includes(key) ? row.counts[key] : row[key];
        if (count(cell) !== count(cell.polarity.canonical) + count(cell.polarity.reversedNormalized)) {
          throw new Error(`saved report polarity counts do not sum to combined counts: ${label}`);
        }
      }
      totalRuns += cell.total;
    }
  }
  if (totalRuns !== report.counts?.runs) throw new Error('saved report cell counts disagree with its run count');
  for (const participant of participants) {
    const cells = questions.map((question) => polisReport.byModelQuestion[participant.id][question.id]);
    polisReport.byModel[participant.id] = correctAggregate(polisReport.byModel[participant.id], cells, participant.id);
    participant.summary = polisReport.byModel[participant.id];
  }
  for (const question of questions) {
    const cells = participants.map((participant) => polisReport.byModelQuestion[participant.id][question.id]);
    polisReport.byQuestion[question.id] = correctAggregate(polisReport.byQuestion[question.id], cells, question.id);
  }
  polisReport.responseDistributionVersion = 1;
  polisReport.uncertaintyRateSemantics = 'equal-weight-observed-unsure-among-valid-cells';
  report.summaryCorrection = {
    method: 'recomputed-from-saved-model-question-counts-v1',
    sourceReportContentHash: hashJson(source),
    sourceCellContentHash: hashJson(source.polisReport.byModelQuestion),
    correctedAt,
    rawRunsRevalidated: false,
  };
  return report;
};
