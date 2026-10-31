import test from 'node:test';
import assert from 'node:assert/strict';
import { loadWorkerCloudflareQuestions } from './sessionQuestionLoading.mjs';

const envListing = (body) => ({
  AGENT_CONTEXT: { origin: 'https://worker.example' },
  AGENT_SERVICES: {
    current: async () => ({}),
    storage: async () => Response.json(body),
  },
});

test('a question page without listComplete fails closed instead of reading as the whole list', async () => {
  const item = { storageRef: { backend: 'cloudflare', id: 'q-1', resource: 'questions' }, metadata: {} };
  const loaded = await loadWorkerCloudflareQuestions({
    env: envListing({ items: [item] }),
    session: { sessionSlug: 'fixture-session' },
  });

  assert.equal(loaded.ok, false);
  assert.equal(loaded.reason, 'telegram_only_cloudflare_questions_list_failed');
  assert.equal(loaded.error, 'Worker question list cursor is missing or repeated.');
  assert.deepEqual(loaded.questions, []);
});
