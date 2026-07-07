import type { Mock } from 'jest-mock';

import { listArweaveTransactionsByTags } from './arweaveGraphql.js';

describe('docLibrary arweaveGraphql', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch as typeof fetch;
    jest.resetAllMocks();
  });

  it('falls back to the next GraphQL endpoint when the first one fails', async () => {
    const fetchMock = jest
      .fn()
      .mockRejectedValueOnce(new TypeError('network down'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            transactions: {
              edges: [
                {
                  cursor: 'cursor-1',
                  node: {
                    id: 'A'.repeat(43),
                    owner: { address: 'owner-1' },
                    tags: [{ name: 'CE-DocLibrary', value: '1' }],
                    data: { size: '42', type: 'text/plain' },
                    block: { height: 10, timestamp: 1700000000 },
                  },
                },
              ],
            },
          },
        }),
      });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await listArweaveTransactionsByTags({
      graphqlUrl: 'https://primary.example/graphql',
      graphqlUrls: ['https://primary.example/graphql', 'https://secondary.example/graphql'],
      tags: [{ name: 'CE-DocLibrary', values: ['1'] }],
      first: 5,
    });

    const typedFetchMock = fetchMock as Mock;
    expect(typedFetchMock).toHaveBeenCalledTimes(2);
    expect(typedFetchMock.mock.calls[0]?.[0]).toBe('https://primary.example/graphql');
    expect(typedFetchMock.mock.calls[1]?.[0]).toBe('https://secondary.example/graphql');
    expect(result).toEqual([
      expect.objectContaining({
        txId: 'A'.repeat(43),
        cursor: 'cursor-1',
        owner: 'owner-1',
        tagMap: { 'CE-DocLibrary': '1' },
        data: { size: 42, type: 'text/plain' },
        block: { height: 10, timestamp: 1700000000 },
      }),
    ]);
  });
});
