import { arweaveClient, arweaveScripts } from './arweaveClient.js';
import { arweaveClient as legacyClient, arweaveScripts as legacyScripts } from './arweaveScripts.js';

describe('arweaveScripts naming alias', () => {
  it('re-exports the canonical arweave client object identity', () => {
    expect(arweaveScripts).toBe(arweaveClient);
    expect(legacyClient).toBe(arweaveClient);
    expect(legacyScripts).toBe(arweaveClient);
  });
});
