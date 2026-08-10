import {
  ARWEAVE_DEFAULT_GATEWAY_CANDIDATES,
  DOC_LIBRARY_ARWEAVE_GATEWAYS,
} from './arweaveGateways.js';

describe('Arweave gateway ownership', () => {
  it('aliases the Document Library defaults to the canonical ordered candidates', () => {
    expect(DOC_LIBRARY_ARWEAVE_GATEWAYS).toBe(ARWEAVE_DEFAULT_GATEWAY_CANDIDATES);
    expect(DOC_LIBRARY_ARWEAVE_GATEWAYS).toEqual([
      'https://ar-io.dev',
      'https://arweave.net',
      'https://gateway.irys.xyz',
      'https://permagate.io',
      'https://g8way.io',
    ]);
  });
});
