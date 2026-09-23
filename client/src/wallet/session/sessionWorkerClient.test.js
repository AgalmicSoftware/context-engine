import { createWorkerSoftSessionClient } from './sessionWorkerClient';
import { createSessionWorker } from './sessionWorkerFactory';
jest.mock('./sessionWorkerFactory', () => ({ createSessionWorker: jest.fn() }));
let originalWorker;
let worker;
beforeEach(() => {
  originalWorker = globalThis.Worker;
  globalThis.Worker = jest.fn();
  worker = {
    terminate: jest.fn(),
    postMessage: jest.fn((message) => {
      if (message.type === 'init' || message.type === 'lock')
        queueMicrotask(() =>
          worker.onmessage({
            data: { id: message.id, ok: true, result: { address: '0x123' } },
          }),
        );
    }),
  };
  createSessionWorker.mockReset().mockReturnValue(worker);
});
afterEach(() => {
  globalThis.Worker = originalWorker;
});

it('rejects in-flight signatures when locked', async () => {
  const client = createWorkerSoftSessionClient();
  await client.init({});
  const pending = client.request({ method: 'personal_sign', params: ['hello'] });
  const result = pending.then(
    () => 'resolved',
    (error) => error.message,
  );
  await client.lock();
  expect(await Promise.race([result, Promise.resolve('still pending')])).toMatch(/locked/i);
  expect(worker.terminate).toHaveBeenCalledTimes(1);
});

it('rejects requests awaiting lazy worker creation and does not resurrect the worker', async () => {
  const client = createWorkerSoftSessionClient();
  const result = client.request({ method: 'personal_sign' }).then(
    () => 'resolved',
    (error) => error.message,
  );
  await client.lock();
  await Promise.resolve();
  expect(await Promise.race([result, Promise.resolve('still pending')])).toMatch(/locked/i);
  expect(createSessionWorker).not.toHaveBeenCalled();
});
