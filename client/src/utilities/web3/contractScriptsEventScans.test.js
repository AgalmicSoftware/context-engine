import { createChainEventScanMethods } from './chainEventScans.js';
import { createContractScriptsEventScanMethods } from './contractScriptsEventScans.js';

describe('contractScriptsEventScans naming alias', () => {
  it('re-exports the canonical chain event scan factory', () => {
    expect(createContractScriptsEventScanMethods).toBe(createChainEventScanMethods);
  });
});
