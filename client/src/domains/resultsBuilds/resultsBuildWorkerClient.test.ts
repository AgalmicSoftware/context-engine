import { readResultsBuild, requestResultsBuild } from './resultsBuildWorkerClient';
import { getCachedWorkerAuthHeaders } from '../sessionResults/sessionResultsAnalysisWorkerClient';

jest.mock('../sessionResults/sessionResultsAnalysisWorkerClient', () => ({
  getCachedWorkerAuthHeaders: jest.fn(() => ({ Authorization: 'Bearer cached' })),
}));

const respond = (body: unknown, status = 200) =>
  jest.fn(async () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));

it('reads one build by id with the cached sign-in, and only on this Worker', async () => {
  const fetchImpl = respond({ ok: true, builds: [], build: null, canBuild: true });
  const result = await readResultsBuild({
    kind: 'debate-atlas',
    account: '0xabc',
    fetchImpl: fetchImpl as unknown as typeof fetch,
    id: 'atlas_k1_00000001',
    sessionId: '0x1',
    sessionSlug: 'salon',
    workerUrl: 'https://worker.example/',
  });
  expect(result).toMatchObject({ ok: true, status: 200, canBuild: true });
  const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toBe('https://worker.example/debate-atlas?sessionSlug=salon&id=atlas_k1_00000001');
  expect(init.headers).toEqual({ Authorization: 'Bearer cached' });
  expect(getCachedWorkerAuthHeaders).toHaveBeenCalledWith(
    expect.objectContaining({ account: '0xabc', sessionSlug: 'salon', workerUrl: 'https://worker.example' }),
  );
  expect(await readResultsBuild({ kind: 'debate-atlas', sessionSlug: 'salon', workerUrl: '' })).toMatchObject({
    ok: false,
    status: 0,
  });
});

it('turns refusals into a status and a reason', async () => {
  const refused = await readResultsBuild({
    kind: 'debate-atlas',
    fetchImpl: respond({ ok: false, error: 'Not visible.' }, 403) as unknown as typeof fetch,
    sessionSlug: 'salon',
    workerUrl: 'https://worker.example',
  });
  expect(refused).toEqual({ ok: false, status: 403, error: 'Not visible.' });
});

it('posts a signed build of the stored responses and returns the new atlas', async () => {
  const fetchImpl = respond({ ok: true, build: { id: 'atlas_k2_00000002', branches: [] } });
  const signAdminAction = jest.fn(async (_request: Record<string, unknown>) => ({
    address: '0xabc',
    message: 'signed',
    signature: '0xsig',
  }));
  const result = await requestResultsBuild({
    kind: 'debate-atlas',
    chainId: 84532,
    fetchImpl: fetchImpl as unknown as typeof fetch,
    sessionSlug: 'salon',
    signAdminAction,
    workerUrl: 'https://worker.example',
  });
  expect(result).toEqual({ ok: true, status: 200, build: { id: 'atlas_k2_00000002', branches: [] } });
  expect(signAdminAction).toHaveBeenCalledWith(
    expect.objectContaining({
      action: 'debate-atlas/build',
      body: { sessionSlug: 'salon', source: { kind: 'worker-canonical' } },
    }),
  );
  const [url] = fetchImpl.mock.calls[0] as unknown as [string];
  expect(url).toBe('https://worker.example/admin/debate-atlas/build');
});

it.each([
  [
    { ok: false, error: 'Already building.', reason: 'debate_atlas_build_running', active: { startedAtMs: 4 } },
    409,
    { active: { startedAtMs: 4 } },
  ],
  // An older Worker that does not say when its build started: timed from the refusal.
  [
    { ok: false, error: 'Already building.', reason: 'debate_atlas_build_running' },
    409,
    { active: { startedAtMs: 9 } },
  ],
  [{ ok: false, error: 'Needs at least 2 participants.' }, 422, {}],
])('passes on the status of a refused build, and when another build started', async (body, status, extra) => {
  const result = await requestResultsBuild({
    kind: 'debate-atlas',
    chainId: 1,
    fetchImpl: respond(body, status) as unknown as typeof fetch,
    now: () => 9,
    sessionSlug: 'salon',
    signAdminAction: async () => ({ address: '0xabc', message: 'signed', signature: '0xsig' }),
    workerUrl: 'https://worker.example',
  });
  expect(result).toEqual({ ok: false, status, error: body.error, ...extra });
});
