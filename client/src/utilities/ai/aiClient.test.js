import { callAI as canonicalCallAI, requestAiRewrite as canonicalRewrite } from './aiClient.js';
import { callAI as legacyCallAI, requestAiRewrite as legacyRewrite } from './aiScripts.js';

describe('aiScripts naming alias', () => {
  it('re-exports canonical AI client functions', () => {
    expect(legacyCallAI).toBe(canonicalCallAI);
    expect(legacyRewrite).toBe(canonicalRewrite);
  });
});
