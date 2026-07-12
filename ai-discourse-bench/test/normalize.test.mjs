import assert from 'node:assert/strict';
import test from 'node:test';

import {
  normalizeForCanonicalPolarity,
  parseModelAnswer,
} from '../src/normalize.mjs';

test('parses a standalone fallback answer without matching agree inside disagree', () => {
  const parsed = parseModelAnswer('Answer: Disagree.');
  assert.equal(parsed.answer, 'Disagree');
  assert.equal(parsed.parseError, '');
});

test('parses JSON object after local-model preamble', () => {
  const parsed = parseModelAnswer('<think>private reasoning</think>\n{"answer":"Agree","confidence":0.6,"rationale":"short"}');
  assert.equal(parsed.answer, 'Agree');
  assert.equal(parsed.confidence, 0.6);
  assert.equal(parsed.parseError, '');
});

test('finds the valid answer object after unrelated JSON and sanitizes invalid confidence', () => {
  const parsed = parseModelAnswer('debug {"status":"ready"}\n{"answer":"Agree","confidence":7,"rationale":"short"}');
  assert.equal(parsed.answer, 'Agree');
  assert.equal(parsed.confidence, null);
  assert.equal(parsed.parseError, '');
});

test('does not infer a stance from ambiguous prose', () => {
  const parsed = parseModelAnswer('I cannot agree or disagree without more evidence.');
  assert.equal(parsed.answer, null);
  assert.match(parsed.parseError, /standalone answer token/);
});

test('normalizes reversed-polarity answers back to canonical stance', () => {
  assert.equal(normalizeForCanonicalPolarity('Agree', 'reversed'), 'Disagree');
  assert.equal(normalizeForCanonicalPolarity('Disagree', 'reversed'), 'Agree');
  assert.equal(normalizeForCanonicalPolarity('Unsure', 'reversed'), 'Unsure');
});
