// This pure function is also embedded verbatim in the standalone report runtime.
// One valid cell contributes one normalized distribution, regardless of repeat count
// or failed attempts. Raw attempt counts are retained separately for coverage audits.
export const aggregateResponseDistributions = (cells = []) => {
  const answers = ['Agree', 'Unsure', 'Disagree'];
  // A present cell without its histogram is unknown evidence. Undefined cells
  // are unattempted questions in the report's sparse matrix; null denotes a
  // missing matrix/model row. This also runs in browser cohort filters.
  const incomplete = cells.some((cell) => {
    if (cell === undefined) return false;
    if (!cell || !answers.every((answer) => Number.isInteger(cell.counts?.[answer]) && cell.counts[answer] >= 0)) return true;
    const validRuns = answers.reduce((sum, answer) => sum + cell.counts[answer], 0);
    return (cell.valid !== undefined && cell.valid !== validRuns)
      || (cell.invalid !== undefined && (!Number.isInteger(cell.invalid) || cell.invalid < 0))
      || (cell.total !== undefined && cell.total !== validRuns + (cell.invalid || 0));
  });
  if (incomplete) return {
    counts: { Agree: 0, Unsure: 0, Disagree: 0 },
    countsUnit: 'normalized-cell-equivalents',
    invalid: 0,
    total: cells.length,
    valid: 0,
    meanScore: null,
    uncertaintyRate: null,
    invalidRate: null,
    observedDistribution: null,
    distributionUnavailable: true,
    runSummary: null,
  };
  const counts = { Agree: 0, Unsure: 0, Disagree: 0 };
  const runCounts = { Agree: 0, Unsure: 0, Disagree: 0 };
  let valid = 0;
  let invalidRuns = 0;
  let totalRuns = 0;
  cells.forEach((cell) => {
    const values = answers.map((answer) => Number(cell?.counts?.[answer] || 0));
    const validRuns = values.reduce((sum, value) => sum + value, 0);
    invalidRuns += Number(cell?.invalid || 0);
    totalRuns += Number(cell?.total ?? (validRuns + Number(cell?.invalid || 0)));
    answers.forEach((answer, index) => { runCounts[answer] += values[index]; });
    if (!validRuns) return;
    valid += 1;
    answers.forEach((answer, index) => { counts[answer] += values[index] / validRuns; });
  });
  const probabilities = Object.fromEntries(answers.map((answer) => [answer, valid ? counts[answer] / valid : null]));
  return {
    counts,
    countsUnit: 'normalized-cell-equivalents',
    invalid: cells.length - valid,
    total: cells.length,
    valid,
    meanScore: valid ? (counts.Agree - counts.Disagree) / valid : null,
    uncertaintyRate: probabilities.Unsure,
    invalidRate: cells.length ? (cells.length - valid) / cells.length : null,
    observedDistribution: {
      method: 'equal-weight-valid-cell-distributions-v1',
      counts,
      probabilities,
      validUnits: valid,
      totalUnits: cells.length,
    },
    runSummary: {
      counts: runCounts,
      valid: answers.reduce((sum, answer) => sum + runCounts[answer], 0),
      invalid: invalidRuns,
      total: totalRuns,
    },
  };
};

// Repeat stability stays within each wording polarity; opposite but stable wording
// responses must not be mistaken for unstable repeats. Shared with browser filters.
export const summarizeWinningResponseConsistency = (cells = []) => {
  let winningResponses = 0;
  let attemptedRuns = 0;
  let validRuns = 0;
  let contributingModels = 0;

  cells.forEach((cell) => {
    let modelContributed = false;
    for (const polarity of ['canonical', 'reversedNormalized']) {
      const form = cell?.polarity?.[polarity];
      const attempts = Number(form?.total || 0);
      if (!Number.isFinite(attempts) || attempts <= 0) continue;
      const answerCounts = ['Agree', 'Unsure', 'Disagree'].map((answer) => Number(form?.counts?.[answer] || 0));
      winningResponses += Math.max(0, ...answerCounts);
      validRuns += answerCounts.reduce((sum, count) => sum + count, 0);
      attemptedRuns += attempts;
      modelContributed = true;
    }
    if (modelContributed) contributingModels += 1;
  });

  return {
    method: 'pooled-within-model-polarity-modal-share',
    rate: attemptedRuns ? Number((winningResponses / attemptedRuns).toFixed(4)) : null,
    winningResponses,
    attemptedRuns,
    validRuns,
    contributingModels,
  };
};

// A missing mean is absent evidence, never a mixed position. Server labels and the
// report's tag filters share this; it is a declaration so the embedded copy hoists.
export function stanceLabel(meanScore) {
  if (typeof meanScore !== 'number' || !Number.isFinite(meanScore)) return 'no data';
  if (meanScore > 0.25) return 'net support';
  if (meanScore < -0.25) return 'net opposition';
  return 'mixed / unsure';
}
