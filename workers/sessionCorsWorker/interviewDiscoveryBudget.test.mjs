import test from 'node:test';
import assert from 'node:assert/strict';
import { loadPublicInterviewQuestions } from './interviewQuestionCatalog.js';
import { dispatchInterviewBriefRequest } from './interviewBriefDispatch.js';
const id = value => `0x${BigInt(value).toString(16).padStart(64, '0')}`;
const event = ids => ({ data: `0x${id(32).slice(2)}${id(ids.length).slice(2)}${ids.map(value => id(value).slice(2)).join('')}` });
const baseConfig = { contracts: { surveys: `0x${'11'.repeat(20)}` }, rpcUrl: 'https://rpc.example', blockLimits: { start: 1, end: 1 } };
const discover = async (ids, payload, config = baseConfig) => {
  const reads = [];
  const result = await loadPublicInterviewQuestions({ slug: 'target', config, fetch: async (url, init) => {
    if (url === 'https://rpc.example') {
      const request = JSON.parse(init.body);
      reads.push(request.method);
      const result = request.method === 'eth_blockNumber' ? id(config.blockLimits.end)
        : request.method === 'eth_getLogs' ? [event(ids)] : `0x${request.params[0].data.slice(-64)}`;
      return Response.json({ result });
    }
    const value = Number(BigInt(`0x${Buffer.from(url.split('/').at(-1), 'base64url').toString('hex')}`));
    const question = payload(value);
    return question ? Response.json({ id: id(value), sessionSlug: 'target', type: 'freeform', prompt: 'Public question', ...question }) : new Response('unreadable', { status: 503 });
  } });
  return { result, reads };
};
for (const excluded of ['foreign', 'restricted']) for (const unreadable of [true, false]) {
  test(`100 ${excluded} candidates keep eligible questions visible; unreadable rows=${unreadable}`, async () => {
    const ids = Array.from({ length: 100 }, (_, index) => index + 1);
    const { result, reads } = await discover([...ids, ...ids, 101, 101, 102], value => value < 101
      ? excluded === 'foreign' ? { sessionSlug: 'elsewhere' } : { visibility: 'sbt_gated' }
      : value === 101 ? (unreadable ? null : { sessionSlug: 'elsewhere' }) : {});
    assert.deepEqual(result.questions.map(question => question.id), [id(102)]);
    assert.equal(result.incomplete, unreadable);
    assert.equal(reads.filter(method => method === 'eth_call').length, 102);
  });
}
test('eligible output is capped independently of the scan budget', async () => {
  const { result } = await discover(Array.from({ length: 150 }, (_, index) => index + 1), () => ({}));
  assert.equal(result.questions.length, 100);
});
test('a spent pointer budget is incomplete and bounds remote work', async () => {
  const { result, reads } = await discover(Array.from({ length: 1000 }, (_, index) => index + 1), () => ({ visibility: 'sbt_gated' }));
  assert.deepEqual(result.questions, []);
  assert.equal(result.incomplete, true);
  assert.ok(reads.filter(method => method === 'eth_call').length <= 200);
});
test('an overlong block window is incomplete', async () => {
  const { result, reads } = await discover([], () => ({}), { ...baseConfig, blockLimits: { start: 1, end: 3000000 } });
  assert.deepEqual(result.questions, []);
  assert.equal(result.incomplete, true);
  assert.ok(reads.filter(method => method === 'eth_getLogs').length <= 20);
});
test('unfinished Worker storage discovery is incomplete', async () => {
  let lists = 0;
  const result = await loadPublicInterviewQuestions({ storageRoute: async () => Response.json({ items: [], listComplete: false, cursor: String(++lists) }) });
  assert.deepEqual(result.questions, []);
  assert.equal(result.incomplete, true);
  assert.ok(lists <= 5);
});
test('empty incomplete discovery is retryable while exhausted complete discovery is a 404', async () => {
  for (const incomplete of [true, false]) {
    const response = await dispatchInterviewBriefRequest({
      request: new Request('https://worker.example/agent/interview-catalog?slug=target'), env: {},
      deps: {
        resolveRequestSlugWithoutToken: () => ({ ok: true, explicitSlugProvided: true, slug: 'target' }),
        readCurrentSessionConfig: async () => ({ config: { interviewMode: { enabled: true } } }),
        getCorsContext: async () => ({ ok: true, headers: {} }),
        loadPublicInterviewQuestions: async () => ({ questions: [], incomplete }),
        json: (body, status, headers) => Response.json(body, { status, headers }),
      },
    });
    assert.equal(response.status, incomplete ? 503 : 404);
    if (incomplete) assert.match((await response.json()).error, /discovery.*incomplete/i);
  }
});

test('Worker storage counts only public questions and reports a spent payload budget', async () => {
  for (const total of [101, 201]) {
    const result = await loadPublicInterviewQuestions({ storageRoute: async ({ path, request }) => {
      if (path === '/storage/list') return Response.json({ items: Array.from({ length: total }, (_, index) => ({
        storageRef: { id: String(index).padStart(4, '0') }, metadata: { resourceId: `q${String(index).padStart(4, '0')}` },
      })), listComplete: true });
      const index = Number(new URL(request.url).searchParams.get('id'));
      return Response.json({ id: `q${String(index).padStart(4, '0')}`, prompt: 'Question', type: 'freeform', ...(index < total - 1 ? { visibility: 'sbt_gated' } : {}) });
    } });
    assert.equal(result.questions.length, total === 101 ? 1 : 0);
    assert.equal(result.incomplete, total === 201);
  }
});
