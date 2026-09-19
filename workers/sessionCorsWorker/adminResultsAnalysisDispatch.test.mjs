import test from 'node:test';
import assert from 'node:assert/strict';

import { dispatchAdminResultsAnalysisStatusRequest } from './adminResultsAnalysisDispatch.js';

const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers });
const readJson = async (response) => JSON.parse(await response.text());

test('admin results-analysis status uses existing admin auth, accepts sessionSlug query, and disables cache', async () => {
  let authHeaderSlug = '';
  let validateAdminCalled = false;
  const response = await dispatchAdminResultsAnalysisStatusRequest({
    request: new Request('https://worker.example/admin/results-analysis/status?sessionSlug=session-a&includeDraft=false', {
      headers: { authorization: 'Bearer token' },
    }),
    env: {},
    baseHeaders: { 'Access-Control-Allow-Origin': 'https://admin.example' },
    slug: '',
    deps: {
      json,
      requireAuth: async ({ request }) => {
        authHeaderSlug = request.headers.get('x-session-slug') || '';
        return { ok: true, slug: authHeaderSlug, payload: { sub: '0xabc' } };
      },
      getSessionConfig: async () => ({
        slug: 'session-a',
        adminAddress: '0xabc',
        resultsAnalysis: { version: 1, generationMode: 'manual' },
      }),
      getCorsContext: async ({ baseHeaders }) => ({ ok: true, headers: baseHeaders }),
      validateAdmin: async () => {
        validateAdminCalled = true;
        return true;
      },
      readResultsAnalysisAdminStatus: async ({ includeDraft }) => ({ ok: true, includeDraft }),
    },
  });
  assert.equal(response.status, 200);
  assert.equal(authHeaderSlug, 'session-a');
  assert.equal(validateAdminCalled, true);
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  assert.deepEqual(await readJson(response), { ok: true, includeDraft: false });
});
