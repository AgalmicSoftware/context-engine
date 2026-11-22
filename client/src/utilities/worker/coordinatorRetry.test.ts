import { coordinatorBusyBody } from '@ce-shared/sessionCoordinatorBusy.mjs';
import {
  SESSION_COORDINATOR_UNAVAILABLE,
  asSignInRequestFailure,
  isSignInRequestFailure,
  withCoordinatorRetry,
} from './coordinatorRetry';

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
    jest.restoreAllMocks();
  });

  it('retries a busy coordinator for reads, voice starts, group joins, draft text, nonces and answers with a request id', async () => {
    const answer = JSON.stringify({ resource: 'responses', requestId: 'answer:v1:op:q1:0', data: {} });
    for (const [url, init] of [
      [`${worker}/storage/list?resource=responses`, {}],
      [`${worker}/storage/read-batch`, { method: 'POST', body: '{"ids":["a"]}' }],
      [`${worker}/realtime/call?slug=s`, { method: 'POST', body: '{"sdp":"v=0"}' }],
      [`${worker}/storage/upload`, { method: 'POST', body: answer }],
      [`${worker}/groups/join`, { method: 'POST', body: '{"groupId":"salon"}' }],
      [`${worker}/storage/draft-text/put`, { method: 'POST', body: '{"items":[]}' }],
      [`${worker}/storage/draft-text/delete`, { method: 'POST', body: '{"questionIds":["q1"]}' }],
      [`${worker}/auth/nonce`, { method: 'POST', body: '{"address":"0x1"}' }],
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
    expect((await run([busy], `${worker}/groups/leave`, { method: 'POST', body: '{"groupId":"salon"}' })).calls).toBe(
      1,
    );
    const other = () =>
      new Response(JSON.stringify({ error: 'Upload settlement is unavailable; retry.' }), { status: 503 });
    expect((await run([other], `${worker}/storage/list`)).calls).toBe(1);
  });

  it('retries what the Worker marks safe to send again, and nothing it marks unsafe', async () => {
    const marked = (body: object) => () => new Response(JSON.stringify(body), { status: 503 });
    const countUnavailable = marked(coordinatorBusyBody({ reason: 'rate_limit_unavailable' }));
    expect((await run([countUnavailable], `${worker}/storage/list`)).calls).toBe(2);
    const unsafe = marked({ error: SESSION_COORDINATOR_UNAVAILABLE, retryable: false });
    expect((await run([unsafe], `${worker}/storage/list`)).calls).toBe(1);
    // A busy sign-in may have spent its nonce, so it is never sent again as it was.
    expect((await run([busy], `${worker}/auth/login`, { method: 'POST', body: '{"signature":"0x2"}' })).calls).toBe(1);
  });

  it('gives up after three retries and returns the last answer', async () => {
    const { response, calls } = await run([busy, busy, busy, busy, busy], `${worker}/storage/list`);
    expect(response.status).toBe(503);
    expect(calls).toBe(4);
  });

  // The Worker stored the answer and its reply was lost: the page said it failed though the answer was saved.
  describe('an answer upload whose reply was lost', () => {
    const answer = { method: 'POST', body: JSON.stringify({ resource: 'responses', requestId: 'answer:v1:op:q1:0' }) };
    const lost = () => {
      throw new TypeError('Load failed');
    };
    const status =
      (code: number, body: object = {}) =>
      () =>
        new Response(JSON.stringify(body), { status: code });
    // Settled whether it resolves or rejects, so a rejection is never left unhandled while the timers run.
    const settle = async (replies: Array<() => Response>, url: string, init: RequestInit) => {
      const fetchImpl = jest.fn(async () => (replies.shift() || ok)());
      const pending = withCoordinatorRetry(fetchImpl as unknown as typeof fetch)(url, init).then(
        (response) => ({ response, error: null }),
        (error: unknown) => ({ response: null, error }),
      );
      await jest.runAllTimersAsync();
      return { ...(await pending), calls: fetchImpl.mock.calls.length };
    };

    it('is sent again, as the Worker answers a repeat with the copy it stored', async () => {
      for (const reply of [lost, status(502), status(504), status(503, { reason: 'upload_in_progress' })]) {
        const { response, calls } = await settle([reply], `${worker}/storage/upload`, answer);
        expect(response?.status).toBe(200);
        expect(calls).toBe(2);
      }
    });

    it('waits about half a minute for an answer the Worker is still storing, then passes on its answer', async () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.5);
      const inProgress = status(503, { reason: 'upload_in_progress' });
      const started = Date.now();
      const stored = await settle([lost, inProgress, inProgress, inProgress], `${worker}/storage/upload`, answer);
      expect(stored.response?.status).toBe(200);
      expect(stored.calls).toBe(5);

      const waited = Date.now();
      const still = await settle(
        Array.from({ length: 8 }, () => inProgress),
        `${worker}/storage/upload`,
        answer,
      );
      expect(Date.now() - waited).toBe(29000);
      expect(still.calls).toBe(7);
      expect(still.response?.status).toBe(503);
      expect(await still.response?.json()).toEqual({ reason: 'upload_in_progress' });
      expect(waited - started).toBe(400 + 1000 + 2000 + 4000);
    });

    it('gives up after three retries with what the last try got', async () => {
      const failed = await settle([lost, lost, lost, lost], `${worker}/storage/upload`, answer);
      expect(failed.error).toBeInstanceOf(TypeError);
      expect(failed.calls).toBe(4);
      const gateway = await settle(
        [status(502), status(502), status(502), status(502)],
        `${worker}/storage/upload`,
        answer,
      );
      expect(gateway.response?.status).toBe(502);
      expect(gateway.calls).toBe(4);
    });

    it('is not sent again when the page cancelled it, or it is no answer with a request id', async () => {
      const controller = new AbortController();
      controller.abort();
      const cancelled = await settle([lost], `${worker}/storage/upload`, { ...answer, signal: controller.signal });
      expect(cancelled.error).toBeInstanceOf(TypeError);
      expect(cancelled.calls).toBe(1);
      const question = { method: 'POST', body: JSON.stringify({ resource: 'questions', data: {} }) };
      for (const reply of [lost, status(502), status(503, { reason: 'upload_in_progress' })]) {
        expect((await settle([reply], `${worker}/storage/upload`, question)).calls).toBe(1);
      }
      // Reads keep their own rule: only a busy coordinator is retried.
      expect((await settle([lost], `${worker}/storage/list`, {})).calls).toBe(1);
      expect((await settle([status(502)], `${worker}/storage/list`, {})).calls).toBe(1);
    });
  });
});

describe('a sign-in request that got no reply', () => {
  it('is passed on unchanged, and known afterwards as a sign-in request', async () => {
    const lost = new TypeError('Load failed');
    await expect(Promise.reject(lost).catch(asSignInRequestFailure)).rejects.toBe(lost);
    expect(isSignInRequestFailure(lost)).toBe(true);
    expect(isSignInRequestFailure(new TypeError('Load failed'))).toBe(false);
    expect(isSignInRequestFailure('Load failed')).toBe(false);
    expect(() => asSignInRequestFailure('not an object')).toThrow('not an object');
  });
});
