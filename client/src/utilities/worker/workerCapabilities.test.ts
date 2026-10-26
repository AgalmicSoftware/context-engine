import { readWorkerCapabilities } from './workerCapabilities';

const body = {
  type: 'ce_worker_capabilities',
  version: 1,
  apiVersion: 1,
  bundle: 'test-bundle',
  features: ['upload_authority_stamps'],
  session: { readiness: {}, unavailable: [{ operation: 'submit', reason: 'storage_missing' }] },
};
test('caches per origin and slug for five minutes, including concurrent reads', async () => {
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
  time = 300_000;
  await readWorkerCapabilities('https://cache-worker.test', 'a', options);
  expect(fetchImpl).toHaveBeenCalledTimes(4);
  expect(fetchImpl.mock.calls[0][1]).toMatchObject({ credentials: 'omit' });
});

test.each(['404', 'network', 'invalid'])('treats %s as legacy without inventing a submit refusal', async (kind) => {
  const fetchImpl = jest.fn(async () => {
    if (kind === 'network') throw new Error('offline');
    return new Response(JSON.stringify({}), { status: kind === '404' ? 404 : 200 });
  });
  expect(await readWorkerCapabilities(`https://${kind}-worker.test`, 'sample', { fetchImpl })).toEqual({
    legacy: true,
    features: [],
  });
});
