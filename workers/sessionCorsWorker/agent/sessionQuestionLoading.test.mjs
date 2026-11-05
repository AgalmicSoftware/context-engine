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

test('a hidden question is never read, so a lost object cannot make the list incomplete', async () => {
  const sessionId = `0x${'ab'.repeat(16)}`;
  const items = ['q-1', 'q-2'].map((id, i) => ({
    storageRef: { backend: 'cloudflare', id: `ref-${id}`, resource: 'questions' },
    metadata: { resourceId: id, createdAt: new Date(1_700_000_000_000 + i).toISOString() },
  }));
  const reads = [];
  const env = {
    AGENT_CONTEXT: {
      origin: 'https://worker.example',
      slug: 'fixture',
      sessionId,
      now: () => Date.now(),
      config: { sessionModeProfile: { authority: { mode: 'worker_canonical' } }, BLOCKED_QUESTION_IDS: [' Q-1 '] },
    },
    AGENT_SERVICES: {
      current: async () => ({}),
      storage: async (path) => {
        const url = new URL(path, 'https://worker.example');
        if (url.pathname === '/storage/list') return Response.json({ items, cursor: '', listComplete: true });
        const id = url.searchParams.get('id');
        reads.push(id);
        if (id === 'ref-q-1') return Response.json({ error: 'Stored object is gone.' }, { status: 404 });
        return Response.json({ questionId: 'q-2', type: 'binary', prompt: 'Statement two?', sessionSlug: 'fixture', sessionId });
      },
    },
  };
  const loaded = await loadWorkerCloudflareQuestions({ env, session: { sessionSlug: 'fixture' } });
  assert.equal(loaded.complete, true);
  assert.deepEqual(reads, ['ref-q-2']);
  assert.deepEqual(loaded.questions.map((question) => question.questionId), ['q-2']);
});

test('Wrapped leaves out the session hidden list, from canonical questions and agent proposals alike', async () => {
  const env = { AGENT_CONTEXT: { config: { BLOCKED_QUESTION_IDS: [' Q-1 '] } } };
  const questions = [{ questionId: 'q-1', prompt: 'Hidden?' }, { questionId: 'q-2', prompt: 'Kept?' }];
  const canonical = await loadWrappedQuestionSource({
    env,
    sessionSlug: 'fixture',
    loadedConfig: { config: {} },
    loadCanonicalQuestions: async () => ({ ok: true, questions }),
  });
  assert.deepEqual(canonical.questions.map(({ questionId }) => questionId), ['q-2']);
  const proposals = await loadWrappedQuestionSource({
    env,
    sessionSlug: 'fixture',
    loadedConfig: { config: { questionSourceMode: 'agent_only', enabledQuestionIds: ['q-1', 'q-2'] } },
    loadProposalQuestions: async () => questions,
  });
  assert.deepEqual(proposals.questions.map(({ questionId }) => questionId), ['q-2']);
  const allHidden = await loadWrappedQuestionSource({
    env: { AGENT_CONTEXT: { config: { BLOCKED_QUESTION_IDS: ['q-1', 'q-2'] } } },
    sessionSlug: 'fixture',
    loadedConfig: { config: {} },
    loadCanonicalQuestions: async () => ({ ok: true, questions }),
  });
  assert.equal(allHidden.reason, 'wrapped_canonical_questions_empty');
});
