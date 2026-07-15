import { postSignedAdminWorkerRequest } from './adminPageSignedWorkerRequest';

describe('postSignedAdminWorkerRequest', () => {
  it('normalizes the worker URL and retries a nonce race with a fresh signature', async () => {
    const signAdminAction = jest
      .fn()
      .mockResolvedValueOnce({ nonce: 'nonce-1', signature: 'signature-1' })
      .mockResolvedValueOnce({ nonce: 'nonce-2', signature: 'signature-2' });
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Nonce mismatch or expired.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    const sleepImpl = jest.fn(async () => undefined);

    const result = await postSignedAdminWorkerRequest({
      action: 'set-config',
      body: { sessionSlug: 'edge' },
      path: '/admin/set-config',
      workerUrl: 'https://worker.example.test///',
      retryAttempts: 2,
      signAdminAction,
      fetchImpl,
      sleepImpl,
    });

    expect(result.baseUrl).toBe('https://worker.example.test');
    expect(signAdminAction).toHaveBeenCalledTimes(2);
    expect(sleepImpl).toHaveBeenCalledWith(250);
    expect(fetchImpl).toHaveBeenLastCalledWith(
      'https://worker.example.test/admin/set-config',
      expect.objectContaining({
        body: JSON.stringify({ sessionSlug: 'edge', nonce: 'nonce-2', signature: 'signature-2' }),
      }),
    );
  });
});
