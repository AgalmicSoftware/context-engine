import { readSessionStorageBatch } from './storageClient';
import { fetchWorkerWithAuth } from '../worker/workerAuth.js';

jest.mock('../worker/workerAuth.js', () => ({ fetchWorkerWithAuth: jest.fn() }));

const fetchMock = fetchWorkerWithAuth as unknown as jest.Mock;
const options = { workerUrl: 'https://worker.example.test', sessionSlug: 'sample' };
const reply = (items: unknown[], status = 200) =>
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ items }), { status }));

describe('readSessionStorageBatch', () => {
  beforeEach(() => fetchMock.mockReset());

  it('posts the ids and returns each payload in the order asked', async () => {
    reply([
      { id: 'b', status: 200, text: '{"answer":"B"}' },
      { id: 'a', status: 200, text: '{"answer":"A"}' },
      { id: 'c', status: 200, text: 'not json' },
    ]);
    await expect(readSessionStorageBatch({ ...options, ids: ['a', 'b', 'c'] })).resolves.toEqual([
      { answer: 'A' },
      { answer: 'B' },
      null,
    ]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://worker.example.test/storage/read-batch');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ ids: ['a', 'b', 'c'] });
  });

  it('fails as a single read would when the Worker refuses or omits an item', async () => {
    reply([{ id: 'a', status: 403, error: 'Access denied.' }]);
    await expect(readSessionStorageBatch({ ...options, ids: ['a'] })).rejects.toThrow('Access denied.');
    reply([]);
    await expect(readSessionStorageBatch({ ...options, ids: ['a'] })).rejects.toThrow(/missing/);
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: 'Rate limit exceeded.' }), { status: 429 }));
    await expect(readSessionStorageBatch({ ...options, ids: ['a'] })).rejects.toThrow('Rate limit exceeded.');
  });

  it('reads an item the batch will not return as text on its own', async () => {
    reply([
      { id: 'cf_ans_a', status: 200, text: '{"answer":"A"}' },
      { id: 'cf_ans_b', status: 415, error: 'This item is not text; read it on its own.' },
    ]);
    fetchMock.mockResolvedValueOnce(
      new Response('{"answer":"B"}', { headers: { 'Content-Type': 'application/octet-stream' } }),
    );
    await expect(readSessionStorageBatch({ ...options, ids: ['cf_ans_a', 'cf_ans_b'] })).resolves.toEqual([
      { answer: 'A' },
      { answer: 'B' },
    ]);
    expect(fetchMock.mock.calls[1][0]).toBe('https://worker.example.test/storage/read?id=cf_ans_b');
  });

  it('takes 1 to 100 ids', async () => {
    await expect(readSessionStorageBatch({ ...options, ids: [] })).rejects.toThrow();
    await expect(
      readSessionStorageBatch({ ...options, ids: Array.from({ length: 101 }, (_, index) => `id-${index}`) }),
    ).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
