jest.mock('../arweave/arweaveClient.js', () => ({
  arweaveClient: {
    buildArweaveGatewayUrl: jest.fn<string, [string]>((txId) => `https://arweave.net/${txId}`),
    uploadDataToArweave: jest.fn<Promise<string>, [string, string, unknown]>(),
  },
}));

import { uploadMarkdownSummaryToArweave } from './aiClient.js';

const { arweaveClient: mockArweaveClient } = jest.requireMock('../arweave/arweaveClient.js') as {
  arweaveClient: {
    buildArweaveGatewayUrl: jest.Mock<string, [string]>;
    uploadDataToArweave: jest.Mock<Promise<string>, [string, string, unknown]>;
  };
};

describe('uploadMarkdownSummaryToArweave', () => {
  it('uses the canonical Arweave client contract and preserves its result shape', async () => {
    mockArweaveClient.uploadDataToArweave.mockResolvedValueOnce('summary-tx');

    await expect(
      uploadMarkdownSummaryToArweave('# Summary', {
        arweaveJwk: { kty: 'RSA' },
        sessionSlug: 'edge',
      }),
    ).resolves.toEqual({
      txId: 'summary-tx',
      url: 'https://arweave.net/summary-tx',
      mdUrl: '[https://arweave.net/summary-tx](https://arweave.net/summary-tx)',
    });

    expect(mockArweaveClient.uploadDataToArweave).toHaveBeenCalledWith(
      '# Summary',
      'md',
      expect.objectContaining({
        arweaveJwk: { kty: 'RSA' },
        sessionSlug: 'edge',
      }),
    );
    expect(mockArweaveClient.buildArweaveGatewayUrl).toHaveBeenCalledWith('summary-tx');
  });
});
