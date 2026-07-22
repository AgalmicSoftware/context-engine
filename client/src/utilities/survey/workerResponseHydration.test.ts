import { loadWorkerResponses } from './workerResponseHydration.js';

const workerConfig = {
  slug: 'demo-sh',
  sessionModeProfile: { authority: { mode: 'worker_canonical' } },
};

describe('workerCanonicalResponseHydration', () => {
  it('paginates response refs and trusts Worker-bound responder metadata over payload claims', async () => {
    const listSessionStorageRefsPage = jest
      .fn()
      .mockResolvedValueOnce({
        items: [
          {
            storageRef: { backend: 'cloudflare', id: 'question-ref' },
            metadata: {
              responder: '0x0000000000000000000000000000000000000ABC',
              createdAt: '2026-07-22T12:00:00.000Z',
            },
          },
          {
            storageRef: { backend: 'cloudflare', id: 'legacy-unbound-ref' },
            metadata: { createdAt: '2026-07-22T12:00:00.500Z' },
          },
        ],
        cursor: 'page-two',
        listComplete: false,
      })
      .mockResolvedValueOnce({
        items: [
          {
            storageRef: { backend: 'cloudflare', id: 'survey-container-ref' },
            metadata: {
              responder: '0x0000000000000000000000000000000000000ABC',
              createdAt: '2026-07-22T12:00:01.000Z',
            },
          },
        ],
        cursor: null,
        listComplete: true,
      });
    const readSessionStorageBlob = jest.fn(async ({ storageRef }: any) =>
      storageRef.id === 'question-ref'
        ? new Response(
            JSON.stringify({
              questionID: 'QUESTION-A',
              responder: '0x0000000000000000000000000000000000000bad',
              answer: { value: true },
            }),
            { headers: { 'Content-Type': 'application/json' } },
          )
        : storageRef.id === 'legacy-unbound-ref'
          ? new Response(
              JSON.stringify({
                questionID: 'QUESTION-A',
                responder: '0x0000000000000000000000000000000000000bad',
                answer: { value: false },
              }),
              { headers: { 'Content-Type': 'application/json' } },
            )
          : new Response(
              JSON.stringify({
                surveyID: 'survey-a',
                responses: [{ questionID: 'QUESTION-A' }],
              }),
              { headers: { 'Content-Type': 'application/json' } },
            ),
    );

    const rows = await loadWorkerResponses(
      { sessionSlug: 'demo-sh', sessionConfig: workerConfig },
      { listSessionStorageRefsPage, readSessionStorageBlob },
    );

    expect(listSessionStorageRefsPage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ cursor: 'page-two', limit: 100, resource: 'responses' }),
    );
    expect(rows).toEqual([
      expect.objectContaining({
        questionId: 'question-a',
        responder: '0x0000000000000000000000000000000000000abc',
        storageRefId: 'question-ref',
        timestamp: Math.floor(Date.parse('2026-07-22T12:00:00.000Z') / 1000),
      }),
    ]);
  });

  it('fails closed on a repeated incomplete-page cursor', async () => {
    const listSessionStorageRefsPage = jest.fn().mockResolvedValue({
      items: [],
      cursor: 'same-cursor',
      listComplete: false,
    });

    await expect(
      loadWorkerResponses({ sessionSlug: 'demo-sh', sessionConfig: workerConfig }, { listSessionStorageRefsPage }),
    ).rejects.toThrow('invalid cursor');
  });
});
