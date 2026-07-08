'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  TARGET_DEBATE_IDS,
  buildRecordIndex,
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

test('validates all debates and client mirror coverage', () => {
  const validation = collectValidation();

  assert.deepEqual(validation.clientDebateMirror.missingFromClient, []);
  assert.deepEqual(validation.clientDebateMirror.extraInClient, []);
  assert.deepEqual(validation.debateReferences.missing, []);
  assert.deepEqual(validation.debateReferences.duplicatePositions, []);
  assert.deepEqual(validation.targetDebateReferences.missing, []);
  assert.deepEqual(validation.targetDebateReferences.duplicatePositions, []);
  assert.deepEqual(validation.malformedYears, []);
});

test('taxonomy fields stay within their canonical vocabularies', () => {
  const validation = collectValidation();

  assert.deepEqual(validation.taxonomyDrift, []);
  assert.deepEqual(validation.unknownCorpusKeys, []);
});

test('extracts a compact record by ID for context-safe inspection', () => {
  const result = extractRecord('debate_ai_water_usage');

  assert.equal(result.corpus, 'cross-corpus');
  assert.equal(result.record.id, 'debate_ai_water_usage');
  assert.equal(result.record.positions.length, 10);
});

test('indexes records under both id and url so either reference form resolves', () => {
  const index = buildRecordIndex([
    {
      corpusKey: 'synthetic',
      entries: [
        { id: 'entry_a', url: 'https://example.com/a' },
        { id: 'entry_b' },
        { url: 'https://example.com/c' },
      ],
    },
  ]);

  assert.ok(index.byCorpusAndId.has('synthetic:entry_a'));
  assert.ok(index.byCorpusAndId.has('synthetic:https://example.com/a'));
  assert.ok(index.byCorpusAndId.has('synthetic:entry_b'));
  assert.ok(index.byCorpusAndId.has('synthetic:https://example.com/c'));
  assert.equal(index.duplicateIds.length, 0);
});

test('extracts records by url as well as by id', () => {
  const byUrl = extractRecord('https://www.dwarkesh.com/p/dario-amodei-2');

  assert.equal(byUrl.corpus, 'dwarkesh-lab-insiders');
  assert.equal(byUrl.record.id, 'amodei_dario_dwarkesh_2026_end_of_exponential');
  assert.deepEqual(extractRecord(byUrl.record.id).record.id, byUrl.record.id);
});

test('the corpus quality gate covers every debate in the cross-corpus file', () => {
  const summary = collectSummary();
  const crossCorpus = summary.corpuses.find((entry) => entry.corpus === 'cross-corpus');

  assert.equal(TARGET_DEBATE_IDS.length, crossCorpus.count);
  assert.equal(new Set(TARGET_DEBATE_IDS).size, TARGET_DEBATE_IDS.length);
});
