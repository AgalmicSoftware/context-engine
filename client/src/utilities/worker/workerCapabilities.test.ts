import { readWorkerCapabilities } from './workerCapabilities';

const body = {
  type: 'ce_worker_capabilities',
  version: 1,
  apiVersion: 1,
  bundle: 'test-bundle',
  features: ['upload_authority_stamps'],
  session: { readiness: {}, unavailable: [{ operation: 'submit', reason: 'storage_missing' }] },
};
test('caches unavailable readiness per origin and slug for at most 30 seconds', async () => {
  let time = 0;
  const fetchImpl = jest.fn().mockImplementation(async () => new Response(JSON.stringify(body)));
  const options = { fetchImpl, now: () => time };
  const [a, b] = await Promise.all([
    readWorkerCapabilities('https://cache-worker.test/path', 'a', options),
    readWorkerCapabilities('https://cache-worker.test/', 'a', options),
  ]);
  expect(a).toEqual(b);
  expect(a.session?.unavailable[0].reason).toBe('storage_missing');
  expect(fetchImpl).toHaveBeenCalledTimes(1);
  await readWorkerCapabilities('https://cache-worker.test', 'b', options);
  await readWorkerCapabilities('https://other-worker.test', 'a', options);
  expect(fetchImpl).toHaveBeenCalledTimes(3);
  time = 30_000;
  await readWorkerCapabilities('https://cache-worker.test', 'a', options);
  expect(fetchImpl).toHaveBeenCalledTimes(4);
  expect(fetchImpl.mock.calls[0][1]).toMatchObject({ credentials: 'omit' });
});

test.each(['404', 'html'])('treats a definitive %s reply as legacy', async (kind) => {
  const fetchImpl = jest.fn(
    async () =>
      new Response(kind === 'html' ? '<html>Old Worker</html>' : '{}', { status: kind === '404' ? 404 : 200 }),
  );
  expect(await readWorkerCapabilities(`https://${kind}-worker.test`, 'sample', { fetchImpl })).toEqual({
    legacy: true,
    features: [],
  });
  await readWorkerCapabilities(`https://${kind}-worker.test`, 'sample', { fetchImpl });
  expect(fetchImpl).toHaveBeenCalledTimes(1);
});

test.each(['network', 'invalid', '503'])('does not cache %s failures or classify them as legacy', async (kind) => {
  let failed = true;
  const fetchImpl = jest.fn(async () => {
    if (!failed) return new Response(JSON.stringify(body));
    if (kind === 'network') throw new Error('offline');
    return new Response('{}', { status: kind === '503' ? 503 : 200 });
  });
  const url = `https://transient-${kind}.test`;
  expect(await readWorkerCapabilities(url, 'sample', { fetchImpl })).toMatchObject({
    legacy: false,
    unavailable: true,
  });
  failed = false;
  expect((await readWorkerCapabilities(url, 'sample', { fetchImpl })).features).toContain('upload_authority_stamps');
  expect(fetchImpl).toHaveBeenCalledTimes(2);
});

test('an explicit submit refresh bypasses unavailable readiness but keeps healthy cached answers', async () => {
  const fetchImpl = jest
    .fn()
    .mockResolvedValueOnce(new Response(JSON.stringify(body)))
    .mockResolvedValueOnce(new Response(JSON.stringify({ ...body, session: { readiness: {}, unavailable: [] } })));
  const url = 'https://submit-refresh.test';
  await readWorkerCapabilities(url, 'sample', { fetchImpl });
  const options = { fetchImpl, refreshUnavailable: true };
  expect((await readWorkerCapabilities(url, 'sample', options)).session?.unavailable).toEqual([]);
  await readWorkerCapabilities(url, 'sample', options);
  expect(fetchImpl).toHaveBeenCalledTimes(2);
});

test('backup-only unavailability keeps the normal cache lifetime during submissions', async () => {
  let time = 0;
  const fetchImpl = jest.fn(
    async () =>
      new Response(
        JSON.stringify({
          ...body,
          session: { readiness: { kek: 'missing' }, unavailable: [{ operation: 'backup', reason: 'kek_missing' }] },
        }),
      ),
  );
  const url = 'https://plaintext-no-kek.test';
  const options = { fetchImpl, now: () => time, refreshUnavailable: true };
  for (let i = 0; i < 5; i += 1) await readWorkerCapabilities(url, 'sample', options);
  expect(fetchImpl).toHaveBeenCalledTimes(1);
  time = 30_001;
  await readWorkerCapabilities(url, 'sample', options);
  expect(fetchImpl).toHaveBeenCalledTimes(1);
  time = 300_000;
  await readWorkerCapabilities(url, 'sample', options);
  expect(fetchImpl).toHaveBeenCalledTimes(2);
});
