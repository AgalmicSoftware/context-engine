import { fetchImageFromURL as canonicalFetchImageFromURL } from './imageFetchClient.js';
import { fetchImageFromURL as legacyFetchImageFromURL } from './imageScripts.js';

describe('imageScripts naming alias', () => {
  it('re-exports the canonical image fetch client function', () => {
    expect(legacyFetchImageFromURL).toBe(canonicalFetchImageFromURL);
  });
});
