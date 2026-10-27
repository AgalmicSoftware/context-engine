'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  TARGET_DEBATE_IDS,
  buildRecordIndex,
  collectFreshness,
  collectSummary,
  collectValidation,
  entryDate,
  extractRecord,
  loadCorpusFiles,
  normalizeCorpusKey,
} = require('./ai-discourse-corpus-tools');

test('summarizes corpus files without dumping full JSON records', () => {
  const summary = collectSummary();
  const crossCorpus = summary.corpuses.find((entry) => entry.corpus === 'cross-corpus');
  const tweets = summary.corpuses.find((entry) => entry.corpus === 'tweets');

  assert.equal(crossCorpus.count, 16);
  assert.ok(tweets.count >= 4140);
  assert.ok(tweets.sizeBytes > 10_000_000);
});

test('normalizes common corpus aliases used inside debate references', () => {
  assert.equal(normalizeCorpusKey('metr'), 'metr-evals-metrics');
  assert.equal(normalizeCorpusKey('ai_laws_policy'), 'ai-laws-policy');
  assert.equal(normalizeCorpusKey('dwarkesh_lab_insiders'), 'dwarkesh-lab-insiders');
});

test('validates corpus references and the client sample mirror', () => {
  const validation = collectValidation();

  assert.deepEqual(validation.clientSampleMirror.countDrift, []);
  assert.deepEqual(validation.clientSampleMirror.missingEntries, []);
  assert.deepEqual(validation.debateReferences.missing, []);
  assert.deepEqual(validation.debateReferences.duplicatePositions, []);
  assert.deepEqual(validation.debateReferences.ambiguousReferences, []);
  assert.deepEqual(validation.targetDebateReferences.missing, []);
  assert.deepEqual(validation.targetDebateReferences.duplicatePositions, []);
  assert.deepEqual(validation.targetDebateReferences.ambiguousReferences, []);
  assert.deepEqual(validation.metaCountDrift, []);
  assert.deepEqual(validation.malformedYears, []);
  assert.deepEqual(validation.rangeDateFields, []);
  assert.deepEqual(validation.invalidPrimaryUrls, []);
  assert.deepEqual(validation.duplicateTitles, []);
});

test('taxonomy fields stay within their canonical vocabularies', () => {
  const validation = collectValidation();

  assert.deepEqual(validation.taxonomyDrift, []);
  assert.deepEqual(validation.unknownCorpusKeys, []);
});

test('tweet cross-links resolve to existing entries by id', () => {
  const validation = collectValidation();

  assert.deepEqual(validation.tweetCrossrefs.dangling, []);
  assert.deepEqual(validation.tweetCrossrefs.missingEntryId, []);
  assert.deepEqual(validation.tweetCrossrefs.unknownCorpus, []);
  assert.deepEqual(validation.tweetDebateNodeDrift, []);
});

test('provenance fields stay well formed', () => {
  const validation = collectValidation();

  assert.deepEqual(validation.verificationStatusDrift, []);
  assert.deepEqual(validation.malformedArxivIds, []);
  assert.deepEqual(validation.crossCorpusDuplicates, []);
});

test('entry dates prefer the publication date over legislative dates and years', () => {
  assert.deepEqual(entryDate({ date: '2026-09', year: 2027 }), { iso: '2026-09-01', precision: 'month' });
  assert.deepEqual(entryDate({ created_at: '2026-07-11T08:00:00.000Z' }), { iso: '2026-07-11', precision: 'day' });
  assert.deepEqual(entryDate({ date_proposed: '2024-02-01', date_enacted: '2025-06-30' }), { iso: '2025-06-30', precision: 'day' });
  assert.deepEqual(entryDate({ year: 1968 }), { iso: '1968-01-01', precision: 'year' });
  assert.equal(entryDate({}), null);
});

test('freshness reports newest dated entry and staleness per sub-corpus', () => {
  const later = collectFreshness(undefined, '2099-01-01');
  const tweets = later.corpuses.find((entry) => entry.corpus === 'tweets');

  assert.equal(later.corpuses.some((entry) => entry.corpus === 'cross-corpus'), false);
  assert.match(tweets.newest, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(tweets.stale, true);
  assert.equal(tweets.last30Days, 0);
  later.corpuses.forEach((entry) => {
    assert.equal(entry.count >= entry.verified + entry.partiallyVerified, true);
  });
});

test('entry ids are globally unique across corpuses', () => {
  const validation = collectValidation();

  assert.deepEqual(validation.duplicateIds, []);
});

test('extracts a compact record by ID for context-safe inspection', () => {
  const result = extractRecord('debate_ai_water_usage');

  assert.equal(result.corpus, 'cross-corpus');
  assert.equal(result.record.id, 'debate_ai_water_usage');
  assert.ok(result.record.positions.length >= 3);
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

test('normalizes URL variants into a shared lookup key', () => {
  const index = buildRecordIndex([
    {
      corpusKey: 'synthetic',
      entries: [{ id: 'entry_a', url: 'http://www.Example.com/Case/' }],
    },
  ]);

  assert.ok(index.byCorpusAndId.has('synthetic:https://example.com/Case'));
  assert.equal(index.lookupKeyEntryCounts.get('synthetic:https://example.com/Case'), 1);
});

test('extracts records by url as well as by id', () => {
  const byUrl = extractRecord('https://www.dwarkesh.com/p/dario-amodei-2');

  assert.equal(byUrl.corpus, 'dwarkesh-lab-insiders');
  assert.equal(byUrl.record.id, 'amodei_dario_dwarkesh_2026_end_of_exponential');
  assert.deepEqual(extractRecord(byUrl.record.id).record.id, byUrl.record.id);
});

test('the corpus quality gate covers every debate in the cross-corpus file', () => {
  const crossCorpus = loadCorpusFiles().find((file) => file.corpusKey === 'cross-corpus');
  const actualDebateIds = crossCorpus.entries.map((debate) => debate.id);

  assert.deepEqual([...TARGET_DEBATE_IDS].sort(), [...actualDebateIds].sort());
});
