'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  TARGET_DEBATE_IDS,
  collectSummary,
  collectValidation,
  extractRecord,
  normalizeCorpusKey,
} = require('./ai-discourse-corpus-tools');

test('summarizes corpus files without dumping full JSON records', () => {
  const summary = collectSummary();
  const crossCorpus = summary.corpuses.find((entry) => entry.corpus === 'cross-corpus');
  const tweets = summary.corpuses.find((entry) => entry.corpus === 'tweets');

  assert.equal(crossCorpus.count, 16);
  assert.equal(summary.clientDebates.count, 16);
  assert.equal(tweets.count, 4036);
  assert.ok(tweets.sizeBytes > 10_000_000);
});

test('normalizes common corpus aliases used inside debate references', () => {
  assert.equal(normalizeCorpusKey('metr'), 'metr-evals-metrics');
  assert.equal(normalizeCorpusKey('ai_laws_policy'), 'ai-laws-policy');
  assert.equal(normalizeCorpusKey('dwarkesh_lab_insiders'), 'dwarkesh-lab-insiders');
});

test('validates target debates and client mirror coverage', () => {
  const validation = collectValidation();

  assert.deepEqual(validation.clientDebateMirror.missingFromClient, []);
  assert.deepEqual(validation.clientDebateMirror.extraInClient, []);
  assert.deepEqual(validation.targetDebateReferences.missing, []);
  assert.deepEqual(validation.targetDebateReferences.duplicatePositions, []);
  assert.deepEqual(validation.malformedYears, []);
});

test('extracts a compact record by ID for context-safe inspection', () => {
  const result = extractRecord('debate_ai_water_usage');

  assert.equal(result.corpus, 'cross-corpus');
  assert.equal(result.record.id, 'debate_ai_water_usage');
  assert.equal(result.record.positions.length, 10);
});

test('tracks the debate IDs targeted by the corpus quality pass', () => {
  assert.deepEqual(TARGET_DEBATE_IDS, [
    'debate_ai_water_usage',
    'debate_ai_labor_automation',
    'debate_ai_education_integrity',
    'debate_ai_copyright_training',
    'debate_multimodal_deepfake_governance',
  ]);
});
