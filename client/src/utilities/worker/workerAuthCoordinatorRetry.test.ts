import { fetchWorkerWithAuth } from './workerAuth';
import { SESSION_COORDINATOR_UNAVAILABLE } from './coordinatorRetry';

describe('fetchWorkerWithAuth and a busy session coordinator', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
    jest.useRealTimers();
  });

  it('retries a signed-out read the Worker refused while its coordinator was busy', async () => {
    jest.useFakeTimers();
    const replies = [
      new Response(JSON.stringify({ error: SESSION_COORDINATOR_UNAVAILABLE }), { status: 503 }),
      new Response('{"items":[]}', { status: 200 }),
    ];
    const fetchMock = jest.fn(async () => replies.shift() as Response);
    global.fetch = fetchMock as unknown as typeof fetch;
    const pending = fetchWorkerWithAuth(
      'https://worker.example.test/storage/list?resource=questions',
      {},
      { sessionSlug: 'demo-sh', workerUrl: 'https://worker.example.test', anonymousOnly: true },
    );
    await jest.runAllTimersAsync();
    expect((await pending).status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
