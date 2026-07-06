import { createContractProfileMethods } from './contractProfile.js';
import { createProfileChainReadMethods } from './profileChainReads.js';

describe('contractProfile naming alias', () => {
  it('re-exports the canonical profile chain reads factory', () => {
    expect(createContractProfileMethods).toBe(createProfileChainReadMethods);
  });
});
