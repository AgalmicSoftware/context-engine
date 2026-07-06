const mockArweaveScripts = {
  marker: 'lazy-export-shape',
};

jest.mock('./arweaveClient.js', () => ({
  arweaveClient: mockArweaveScripts,
  arweaveScripts: mockArweaveScripts,
}));

describe('arweaveScriptsLazy', () => {
  it('re-exports the arweaveScripts object from the canonical module', () => {
    const { arweaveScripts } = require('./arweaveScriptsLazy.js');

    expect(arweaveScripts).toBe(mockArweaveScripts);
  });
});
