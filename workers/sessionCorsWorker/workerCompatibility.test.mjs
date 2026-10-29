import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildIndexKey, buildPayloadKey, storageRoute } from './storageRouteExecution.js';
import { loadWorkerCanonicalResultsAnalysisSource } from './resultsAnalysisGeneration.js';
import { loadPublicInterviewQuestions } from './interviewQuestionCatalog.js';

const fixture = JSON.parse(await readFile(new URL('../../tests/fixtures/worker-compat/previous-minor.json', import.meta.url), 'utf8'));
for (const upgraded of [false, true]) {
  test(`results and interview readers agree on previous-format history (upgraded=${upgraded})`, async () => {
    const values = new Map();
    const index = {
      get: async (key) => values.get(key) ?? null,
      list: async ({ prefix }) => ({ keys: [...values.keys()].filter((key) => key.startsWith(prefix)).sort().map((name) => ({ name })), list_complete: true }),
    };
    const { config } = fixture;
    const records = [...fixture.records, ...(upgraded ? fixture.upgradedRecords : [])];
    for (const { metadata, payload } of records) {
      values.set(buildIndexKey({ slug: config.slug, resource: metadata.resource, id: metadata.id }), JSON.stringify(metadata));
      values.set(buildPayloadKey({ slug: config.slug, id: metadata.id }), JSON.stringify({
        metadata, payloadBase64url: Buffer.from(JSON.stringify(payload)).toString('base64url'),
      }));
    }
    const env = { CE_STORAGE_INDEX_KV: index };
    const expected = upgraded ? fixture.expectedUpgradedQuestions : fixture.expectedQuestions;
    const pairs = (questions) => questions.map(({ id, prompt }) => [id, prompt]).sort(([a], [b]) => a.localeCompare(b));
    const results = await loadWorkerCanonicalResultsAnalysisSource({ env, config, slug: config.slug });
    assert.equal(results.ok, true);
    assert.deepEqual(pairs(results.snapshot.questions), expected);
    assert.equal(results.snapshot.responses.length, 1, 'Legacy uploads without receipts still deduplicate by responder and question');
    const catalog = await loadPublicInterviewQuestions({ env, config, slug: config.slug, storageRoute,
      fetch: async () => { throw new Error('Unexpected network fallback'); } });
    assert.deepEqual(pairs(catalog.questions), expected);
  });
}
