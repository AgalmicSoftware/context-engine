import test from 'node:test';
import assert from 'node:assert/strict';

import {
  LEGACY_DEMO_POLL_OPTIONS,
  compareQuestionSets,
  fetchWorkerQuestions,
  loadExpectedDemoShQuestions,
} from './verify-demo-sh-question-parity.mjs';

const makeQuestion = (id, overrides = {}) => ({
  id,
  type: 'binary',
  prompt: `Prompt ${id}`,
  tags: ['binary', 'TEST'],
  creator: '0xcreator',
  associatedSurveyId: `0x${'0'.repeat(64)}`,
  sessionName: 'Demo Session',
  sessionSlug: 'demo-sh',
  corpus: 'Context',
  cloudflareDemoSeed: true,
  demoFixture: {
    sourceSessionSlug: 'demo-1',
    fixtureFile: 'client/src/variables/demo/demo_polis_data.json',
    fixturePath: 'comments',
    onchainQuestionIdsFile: 'client/src/variables/demo/demo_1_onchain_question_ids.json',
    sourceCommentIndex: Number(id.replace(/\D/g, '')) || 0,
    sourceCommentId: `0xcomment${id}`,
    fixtureType: 'binary',
    nodeId: `0xnode${id}`,
  },
  demoStats: {
    agrees: 2,
    disagrees: 1,
    moderated: 1,
    timestamp: 1700000000000,
    datetime: 'Wed Mar 06 16:00:00 UTC 2024',
    category: 'TEST',
    keyTension: 'Test tension',
    sources: 'test',
  },
  ...overrides,
});

const jsonResponse = (payload, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => payload,
});

test('tracked demo-sh seed reconstructs all 42 legacy Worker payload semantics', () => {
  const { questions, sessionConfig } = loadExpectedDemoShQuestions();
  const pollQuestions = questions.filter((question) => question.type === 'multichoice');

  assert.equal(questions.length, 42);
  assert.equal(sessionConfig.demoCompatibilitySeed.questionCount, 42);
  assert.equal(pollQuestions.length, 5);
  pollQuestions.forEach((question) => assert.deepEqual(question.options, LEGACY_DEMO_POLL_OPTIONS));
  assert.equal(questions[22].prompt, 'If an AI resists modification, should we respect that preference?');
  assert.equal(questions[40].scale, undefined);
  assert.equal(questions[0].demoFixture.sourceSessionSlug, 'demo-1');
});

test('comparison is order-independent and reports missing, extra, and duplicate IDs', () => {
  const first = makeQuestion('0x01');
  const second = makeQuestion('0x02');

  assert.deepEqual(compareQuestionSets([first, second], [second, first]), { ok: true, differences: [] });

  const result = compareQuestionSets([first, second], [first, first, makeQuestion('0x03')]);
  assert.equal(result.ok, false);
  assert.deepEqual(
    result.differences.map(({ kind, id, side }) => ({ kind, id, ...(side ? { side } : {}) })),
    [
      { kind: 'duplicate', id: '0x01', side: 'actual' },
      { kind: 'missing', id: '0x02' },
      { kind: 'extra', id: '0x03' },
    ],
  );
});

test('comparison detects typed and source-scoped semantic drift', () => {
  const baseline = makeQuestion('0x01', {
    type: 'multichoice',
    options: ['A', 'B'],
    singleSelect: true,
    scale: { min: 0, max: 10 },
  });
  const mutations = [
    ['prompt', { prompt: 'Changed prompt' }],
    ['type', { type: 'rating' }],
    ['options', { options: ['A', 'C'] }],
    ['scale.max', { scale: { min: 0, max: 9 } }],
    ['sessionSlug', { sessionSlug: 'demo-1' }],
    ['demoStats.agrees', { demoStats: { ...baseline.demoStats, agrees: 3 } }],
    [
      'demoFixture.sourceSessionSlug',
      { demoFixture: { ...baseline.demoFixture, sourceSessionSlug: 'demo' } },
    ],
  ];

  mutations.forEach(([expectedPath, override]) => {
    const result = compareQuestionSets([baseline], [{ ...baseline, ...override }]);
    assert.equal(result.ok, false, expectedPath);
    assert.ok(result.differences.some((difference) => difference.path === expectedPath), expectedPath);
  });
});

test('Worker reader follows bounded pagination and only performs same-origin GET reads', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    const parsed = new URL(url);
    calls.push({ url: parsed, options });
    if (parsed.pathname === '/storage/list' && !parsed.searchParams.has('cursor')) {
      return jsonResponse({
        items: [{ storageRef: { uri: '/storage/read?id=one' } }],
        cursor: 'next-page',
        listComplete: false,
      });
    }
    if (parsed.pathname === '/storage/list' && parsed.searchParams.get('cursor') === 'next-page') {
      return jsonResponse({
        items: [{ storageRef: { uri: '/storage/read?id=two' } }],
        cursor: '',
        listComplete: true,
      });
    }
    if (parsed.pathname === '/storage/read') {
      return jsonResponse(makeQuestion(parsed.searchParams.get('id') === 'one' ? '0x01' : '0x02'));
    }
    throw new Error(`Unexpected URL ${url}`);
  };

  const questions = await fetchWorkerQuestions({ fetchImpl, workerUrl: 'https://worker.example/base/' });

  assert.deepEqual(questions.map((question) => question.id), ['0x01', '0x02']);
  assert.equal(calls.length, 4);
  calls.forEach(({ url, options }) => {
    assert.equal(url.origin, 'https://worker.example');
    assert.equal(options.method, 'GET');
    assert.deepEqual(options.headers, { accept: 'application/json' });
  });
});

test('Worker reader fails closed on non-200, malformed pagination, and external read URIs', async (t) => {
  await t.test('non-200 list', async () => {
    await assert.rejects(
      fetchWorkerQuestions({
        workerUrl: 'https://worker.example',
        fetchImpl: async () => jsonResponse({ error: 'unavailable' }, 503),
      }),
      /failed \(503\)/,
    );
  });

  await t.test('pagination without a cursor', async () => {
    await assert.rejects(
      fetchWorkerQuestions({
        workerUrl: 'https://worker.example',
        fetchImpl: async () => jsonResponse({ items: [], listComplete: false, cursor: '' }),
      }),
      /pagination did not advance/,
    );
  });

  await t.test('cross-origin storage read', async () => {
    await assert.rejects(
      fetchWorkerQuestions({
        workerUrl: 'https://worker.example',
        fetchImpl: async () =>
          jsonResponse({
            items: [{ storageRef: { uri: 'https://outside.example/storage/read?id=one' } }],
            listComplete: true,
            cursor: '',
          }),
      }),
      /invalid storage read URI/,
    );
  });
});
