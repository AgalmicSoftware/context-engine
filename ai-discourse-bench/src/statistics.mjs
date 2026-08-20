import { sha256 } from './provenance.mjs';

const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;

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
