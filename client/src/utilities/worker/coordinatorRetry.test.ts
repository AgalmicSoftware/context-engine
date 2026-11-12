import { SESSION_COORDINATOR_UNAVAILABLE, withCoordinatorRetry } from './coordinatorRetry';

const busy = () => new Response(JSON.stringify({ error: SESSION_COORDINATOR_UNAVAILABLE }), { status: 503 });
const ok = () => new Response('{"ok":true}', { status: 200 });
const worker = 'https://worker.example.test';

const run = async (replies: Array<() => Response>, url: string, init: RequestInit = {}) => {
  const fetchImpl = jest.fn(async () => (replies.shift() || ok)());
  const pending = withCoordinatorRetry(fetchImpl as unknown as typeof fetch)(url, init);
  await jest.runAllTimersAsync();
  return { response: await pending, calls: fetchImpl.mock.calls.length };
};

describe('withCoordinatorRetry', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('retries a busy coordinator for reads, voice starts and answers with a request id', async () => {
    const answer = JSON.stringify({ resource: 'responses', requestId: 'answer:v1:op:q1:0', data: {} });
    for (const [url, init] of [
      [`${worker}/storage/list?resource=responses`, {}],
      [`${worker}/storage/read-batch`, { method: 'POST', body: '{"ids":["a"]}' }],
      [`${worker}/realtime/call?slug=s`, { method: 'POST', body: '{"sdp":"v=0"}' }],
      [`${worker}/storage/upload`, { method: 'POST', body: answer }],
    ] as Array<[string, RequestInit]>) {
      const { response, calls } = await run([busy, busy], url, init);
      expect(response.status).toBe(200);
      expect(calls).toBe(3);
    }
  });

  it('sends a write without a request id, or any other 503, only once', async () => {
    const question = JSON.stringify({ resource: 'questions', data: {} });
    expect((await run([busy], `${worker}/storage/upload`, { method: 'POST', body: question })).calls).toBe(1);
    expect((await run([busy], `${worker}/admin/action`, { method: 'POST', body: '{}' })).calls).toBe(1);
    const other = () =>
      new Response(JSON.stringify({ error: 'Upload settlement is unavailable; retry.' }), { status: 503 });
    expect((await run([other], `${worker}/storage/list`)).calls).toBe(1);
  });

  it('gives up after three retries and returns the last answer', async () => {
    const { response, calls } = await run([busy, busy, busy, busy, busy], `${worker}/storage/list`);
    expect(response.status).toBe(503);
    expect(calls).toBe(4);
  });
});
