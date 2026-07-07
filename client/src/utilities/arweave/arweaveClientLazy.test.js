const mockArweaveClient = {
  marker: 'lazy-export-shape',
};

jest.mock('./arweaveClient.js', () => ({
  arweaveClient: mockArweaveClient,
}));

describe('arweaveClientLazy', () => {
  it('re-exports the arweaveClient object from the canonical module', () => {
    const { arweaveClient } = require('./arweaveClientLazy.js');

    expect(arweaveClient).toBe(mockArweaveClient);
  });
});
