import { createContractEventListenerMethods as canonical } from './chainEventStreams.js';
import { createContractEventListenerMethods as legacy } from './contractEventListeners.js';

describe('contractEventListeners naming alias', () => {
  it('re-exports the canonical chain event streams factory', () => {
    expect(legacy).toBe(canonical);
  });
});
