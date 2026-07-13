import assert from 'node:assert/strict';
import test from 'node:test';

import { auditOpenRouterRoster, fetchOpenRouterCatalog } from '../src/openrouter-catalog.mjs';

const modelRoster = {
  models: [{
    id: 'model-a',
    model: 'provider/model-a',
    provider: 'openrouter',
    structuredOutput: 'json_schema',
    pricing: { inputPerMillion: 1, outputPerMillion: 2 },
    provenance: { modelRevision: 'provider/model-a-20260713' },
  }],
};

const catalog = [{
  id: 'provider/model-a',
  canonical_slug: 'provider/model-a-20260713',
  pricing: { prompt: '0.000001', completion: '0.000002' },
  supported_parameters: ['max_tokens', 'structured_outputs'],
  expiration_date: null,
}];

test('OpenRouter catalog audit pins request ids to revision, price, and capabilities', () => {
  const audit = auditOpenRouterRoster({
    modelRoster,
    catalog,
    checkedAt: '2026-07-13T00:00:00.000Z',
  });
  assert.deepEqual(audit.errors, []);
  assert.equal(audit.models[0].canonicalSlug, 'provider/model-a-20260713');
  assert.equal(audit.models[0].inputPerMillion, 1);
  assert.equal(audit.models[0].outputPerMillion, 2);
});

test('OpenRouter catalog audit rejects revision, pricing, capability, and expiration drift', () => {
  const audit = auditOpenRouterRoster({
    modelRoster,
    catalog: [{
      ...catalog[0],
      canonical_slug: 'provider/model-a-20260714',
      pricing: { prompt: '0.000003', completion: '0.000004' },
      supported_parameters: ['max_tokens'],
      expiration_date: '2026-07-12',
    }],
    checkedAt: '2026-07-13T00:00:00.000Z',
  });
  assert.ok(audit.errors.some((error) => error.includes('does not match')));
  assert.ok(audit.errors.some((error) => error.includes('declared pricing')));
  assert.ok(audit.errors.some((error) => error.includes('does not advertise structured_outputs')));
  assert.ok(audit.errors.some((error) => error.includes('expired on')));
});

test('OpenRouter catalog fetch validates the response shape', async () => {
  const seen = {};
  const result = await fetchOpenRouterCatalog({
    env: { OPENROUTER_BASE_URL: 'https://router.test/v1', OPENROUTER_API_KEY: 'key' },
    fetchImpl: async (url, options) => {
      seen.url = url;
      seen.options = options;
      return { ok: true, json: async () => ({ data: catalog }) };
    },
  });
  assert.equal(seen.url, 'https://router.test/v1/models');
  assert.equal(seen.options.headers.authorization, 'Bearer key');
  assert.deepEqual(result, catalog);
});
