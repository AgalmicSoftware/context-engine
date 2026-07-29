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

  it('preserves a structured failure reason for allowlisted domain handling without rendering it', async () => {
    const request = postSignedAdminWorkerRequest({
      action: 'groups/list',
      body: { sessionId: '0x11111111111111111111111111111111' },
      path: '/admin/groups/list',
      workerUrl: 'https://worker.example.test',
      retryAttempts: 1,
      signAdminAction: async () => ({ nonce: 'nonce-1', signature: 'signature-1' }),
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            error: 'Worker group request failed.',
            reason: 'worker_group_capacity_reconciliation_required',
          }),
          {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
    });

    await expect(request).rejects.toMatchObject({
      message: 'Worker group request failed.',
      reason: 'worker_group_capacity_reconciliation_required',
      status: 503,
    });
  });
});
