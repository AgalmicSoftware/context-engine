import test from 'node:test';
import assert from 'node:assert/strict';
import { loadWorkerCloudflareQuestions } from './sessionQuestionLoading.mjs';
import { loadWrappedQuestionSource } from './wrappedQuestionSource.mjs';

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

test('Wrapped reads a hosted catalog past 200 questions in full', async () => {
  const sessionId = `0x${'ab'.repeat(16)}`;
  const items = Array.from({ length: 201 }, (_, i) => ({
    storageRef: { backend: 'cloudflare', id: `ref-${i}`, resource: 'questions' },
    metadata: { resourceId: `q-${i}`, createdAt: new Date(1_700_000_000_000 + i).toISOString() },
  }));
  const env = {
    AGENT_CONTEXT: {
      origin: 'https://worker.example',
      slug: 'fixture',
      sessionId,
      now: () => Date.now(),
      config: { sessionModeProfile: { authority: { mode: 'worker_canonical' } } },
    },
    AGENT_SERVICES: {
      current: async () => ({}),
      storage: async (path) => {
        const url = new URL(path, 'https://worker.example');
        if (url.pathname === '/storage/list') {
          const start = Number(url.searchParams.get('cursor') || 0);
          const next = start + 100;
          return Response.json({
            items: items.slice(start, next),
            cursor: next < items.length ? String(next) : '',
            listComplete: next >= items.length,
          });
        }
        const i = Number(url.searchParams.get('id').slice('ref-'.length));
        return Response.json({ questionId: `q-${i}`, type: 'binary', prompt: `Statement ${i}?`, sessionSlug: 'fixture', sessionId });
      },
    },
  };

  const loaded = await loadWrappedQuestionSource({ env, sessionSlug: 'fixture', loadedConfig: { config: {} } });

  assert.equal(loaded.ok, true, loaded.reason);
  assert.equal(loaded.questions.length, 201);
});
