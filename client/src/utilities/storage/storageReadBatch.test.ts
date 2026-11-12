import { readSessionStorageBatch } from './storageClient';
import { fetchWorkerWithAuth } from '../worker/workerAuth.js';

jest.mock('../worker/workerAuth.js', () => ({ fetchWorkerWithAuth: jest.fn() }));

const fetchMock = fetchWorkerWithAuth as unknown as jest.Mock<
  Promise<Response>,
  [string, { method: string; body: string }, { anonymousRefused: (reply: Response) => Promise<boolean> }]
>;
const options = { workerUrl: 'https://worker.example.test', sessionSlug: 'sample' };
const reply = (items: unknown[], status = 200) =>
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ items }), { status }));

describe('readSessionStorageBatch', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

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

  it('asks for a signed-in retry only when the signed-out batch refused an item for want of a sign-in', async () => {
    reply([{ id: 'a', status: 200, text: '{}' }]);
    await readSessionStorageBatch({ ...options, ids: ['a'] });
    const { anonymousRefused } = fetchMock.mock.calls[0][2];
    const refused = (items: unknown[]) => anonymousRefused(new Response(JSON.stringify({ items })));
    const membersOnly = {
      id: 'a',
      status: 403,
      error: 'Access denied: answers are visible to signed-in session members.',
      reason: 'private_response_owner_required',
    };
    await expect(refused([{ id: 'b', status: 200, text: '{}' }, membersOnly])).resolves.toBe(true);
    await expect(
      refused([{ id: 'a', status: 403, error: 'Access denied.', reason: 'missing_principal' }]),
    ).resolves.toBe(true);
    // Refusals that signing in would not lift, and items that are fine, ask for nothing.
    await expect(
      refused([{ id: 'a', status: 403, error: 'Access denied: Cloudflare worker SBT gate failed.' }]),
    ).resolves.toBe(false);
    await expect(refused([{ id: 'a', status: 404, error: 'Not found.' }])).resolves.toBe(false);
    await expect(refused([{ id: 'a', status: 200, text: '{}' }])).resolves.toBe(false);
  });

  it('takes 1 to 100 ids', async () => {
    await expect(readSessionStorageBatch({ ...options, ids: [] })).rejects.toThrow();
    await expect(
      readSessionStorageBatch({ ...options, ids: Array.from({ length: 101 }, (_, index) => `id-${index}`) }),
    ).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
