import { createChainMetadataResolutionHelpers } from './chainMetadataResolution.js';
import { createContractScriptsMetadataResolutionHelpers } from './contractScriptsMetadataResolution.js';

describe('contractScriptsMetadataResolution naming alias', () => {
  it('re-exports the canonical chain metadata resolution factory', () => {
    expect(createContractScriptsMetadataResolutionHelpers).toBe(createChainMetadataResolutionHelpers);
  });
});
