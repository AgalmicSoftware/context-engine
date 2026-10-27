import { sha256 } from './provenance.mjs';

const seededRandom = (seed) => {
  let state = Number.parseInt(sha256(seed).slice(0, 8), 16) || 1;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
};

const quantile = (sortedValues, probability) => {
  if (sortedValues.length === 1) return sortedValues[0];
  const position = (sortedValues.length - 1) * probability;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sortedValues[lower];
  return sortedValues[lower] + (sortedValues[upper] - sortedValues[lower]) * (position - lower);
};

const round = (value, digits = 4) => Number(value.toFixed(digits));

export const bootstrapMeanInterval = (inputValues, {
  seed = 'ai-discourse-bench-bootstrap-v1',
  iterations = 1000,
  confidenceLevel = 0.95,
} = {}) => {
  const values = inputValues.filter(Number.isFinite);
  if (values.length === 0) return null;
  if (values.length === 1) {
    return {
      low: round(values[0]),
      high: round(values[0]),
      confidenceLevel,
      iterations: 0,
      method: 'single-observation',
    };
  }
  const random = seededRandom(seed);
  const bootstrapMeans = Array.from({ length: iterations }, () => {
    let sum = 0;
    for (let index = 0; index < values.length; index += 1) {
      sum += values[Math.floor(random() * values.length)];
    }
    return sum / values.length;
  }).sort((left, right) => left - right);
  const tail = (1 - confidenceLevel) / 2;
  return {
    low: round(quantile(bootstrapMeans, tail)),
    high: round(quantile(bootstrapMeans, 1 - tail)),
    confidenceLevel,
    iterations,
    method: 'deterministic-percentile-bootstrap',
  };
};

/**
 * A 95% percentile-bootstrap interval for statistic(a) − statistic(b), with a
 * and b resampled independently (for example models and a group of people).
 */
export const bootstrapDifferenceInterval = (a, b, statistic, {
  seed = 'ai-discourse-bench-bootstrap-v1',
  iterations = 1000,
  confidenceLevel = 0.95,
} = {}) => {
  if (!a.length || !b.length || iterations < 1) return null;
  const random = seededRandom(seed);
  const draw = (values) => values.map(() => values[Math.floor(random() * values.length)]);
  const differences = [];
  for (let index = 0; index < iterations; index += 1) {
    const difference = statistic(draw(a)) - statistic(draw(b));
    if (Number.isFinite(difference)) differences.push(difference);
  }
  if (!differences.length) return null;
  differences.sort((left, right) => left - right);
  const tail = (1 - confidenceLevel) / 2;
  return [round(quantile(differences, tail)), round(quantile(differences, 1 - tail))];
};

// Wilson score interval for a proportion of n.
const wilson = (share, n, z) => {
  const center = (share + (z * z) / (2 * n)) / (1 + (z * z) / n);
  const half = (z * Math.sqrt((share * (1 - share)) / n + (z * z) / (4 * n * n))) / (1 + (z * z) / n);
  return [center - half, center + half];
};

/** Newcombe's hybrid score 95% interval for the difference of two independent proportions. */
export const newcombeDifferenceInterval = (hitsA, nA, hitsB, nB, z = 1.959964) => {
  if (!nA || !nB) return null;
  const [shareA, shareB] = [hitsA / nA, hitsB / nB];
  const [lowA, highA] = wilson(shareA, nA, z);
  const [lowB, highB] = wilson(shareB, nB, z);
  const difference = shareA - shareB;
  return [
    round(difference - Math.sqrt((shareA - lowA) ** 2 + (highB - shareB) ** 2)),
    round(difference + Math.sqrt((highA - shareA) ** 2 + (shareB - lowB) ** 2)),
  ];
};
