import { buildResponseGatePolicy, buildUploadGatePolicy } from './litGatePolicy.js';

const ADDR_ONE = '0x00000000000000000000000000000000000000a1';
const ADDR_TWO = '0x00000000000000000000000000000000000000a2';
const ADDR_THREE = '0x00000000000000000000000000000000000000a3';

const buildOnChainCfg = (gatesByResource = {}) => ({
  __registry: {
    gateAuthority: 'onchain',
    gatesByResource,
  },
});

describe('litGatePolicy', () => {
  it('preserves gate label/id metadata for response audience UI', () => {
    const cfg = buildOnChainCfg({
      questionResponses: {
        lookupStatus: 'ok',
        gateId: 'gate-a',
        label: 'Gate A',
        sbtAddresses: [ADDR_ONE],
        chainId: 84532,
        mode: 'any',
      },
    });

    const policy = buildResponseGatePolicy({
      cfg,
      isQuestionResponseFlow: true,
      fallbackChainId: 84532,
    });

    expect(policy.gates).toHaveLength(1);
    expect(policy.gates[0]).toMatchObject({
      gateId: 'gate-a',
      label: 'Gate A',
      chainId: 84532,
    });
    expect(policy.recipients).toHaveLength(1);
    expect(policy.recipients[0]?.chain).toBe('baseSepolia');
  });

  it('treats numeric on-chain mode=1 as an all-of gate', () => {
    const cfg = buildOnChainCfg({
      questionResponses: {
        lookupStatus: 'ok',
        sbtAddresses: [ADDR_ONE, ADDR_TWO],
        chainId: 84532,
        mode: 1,
      },
    });

    const policy = buildResponseGatePolicy({
      cfg,
      isQuestionResponseFlow: true,
      fallbackChainId: 84532,
    });

    expect(policy.recipients).toHaveLength(1);
    expect(policy.gates[0]?.mode).toBe('all');
    expect(policy.recipients[0]?.accessControlConditions?.[1]).toEqual({ operator: 'and' });
  });

  it('ignores non-string gate label/id payloads instead of emitting [object Object]', () => {
    const cfg = buildOnChainCfg({
      questionResponses: {
        lookupStatus: 'ok',
        gateId: { nested: 'id' },
        label: { text: 'Gate A' },
        sbtAddresses: [ADDR_ONE],
        chainId: 84532,
        mode: 'any',
      },
    });

    const policy = buildResponseGatePolicy({
      cfg,
      isQuestionResponseFlow: true,
      fallbackChainId: 84532,
    });

    expect(policy.gates).toHaveLength(1);
    expect(policy.gates[0]?.label).toBeNull();
    expect(policy.gates[0]?.gateId).toBeNull();
  });

  it('includes both primary and default response gates when both are restricted', () => {
    const cfg = buildOnChainCfg({
      questionResponses: {
        lookupStatus: 'ok',
        sbtAddresses: [ADDR_ONE],
        chainId: 84532,
        mode: 'any',
      },
      default: {
        lookupStatus: 'ok',
        sbtAddresses: [ADDR_TWO],
        chainId: 84532,
        mode: 'any',
      },
    });

    const policy = buildResponseGatePolicy({
      cfg,
      isQuestionResponseFlow: true,
      fallbackChainId: 84532,
    });

    expect(policy.allowFallbackConditions).toBe(true);
    expect(policy.recipients).toHaveLength(2);
    const flattened = JSON.stringify(policy.recipients);
    expect(flattened).toContain(ADDR_ONE);
    expect(flattened).toContain(ADDR_TWO);
  });

  it('treats explicit open primary response gate as no-recipient and disables fallback', () => {
    const cfg = buildOnChainCfg({
      questionResponses: {
        lookupStatus: 'ok',
        sbtAddresses: [],
        chainId: 84532,
        mode: 'any',
      },
      default: {
        lookupStatus: 'ok',
        sbtAddresses: [ADDR_ONE],
        chainId: 84532,
        mode: 'any',
      },
    });

    const policy = buildResponseGatePolicy({
      cfg,
      isQuestionResponseFlow: true,
      fallbackChainId: 84532,
    });

    expect(policy.allowFallbackConditions).toBe(false);
    expect(policy.recipients).toEqual([]);
  });

  it('builds upload recipients for all relevant resources and deduplicates overlaps', () => {
    const cfg = buildOnChainCfg({
      surveyResponses: {
        lookupStatus: 'ok',
        sbtAddresses: [ADDR_ONE],
        chainId: 84532,
        mode: 'any',
      },
      docUrls: {
        lookupStatus: 'ok',
        sbtAddresses: [ADDR_TWO],
        chainId: 84532,
        mode: 'all',
      },
      default: {
        lookupStatus: 'ok',
        sbtAddresses: [ADDR_THREE],
        chainId: 84532,
        mode: 'any',
      },
    });

    const policy = buildUploadGatePolicy({
      cfg,
      targets: { survey: true, questions: true, docUrls: true },
      isStandaloneQuestion: false,
      fallbackChainId: 84532,
      manualGate: {
        sbtAddresses: [ADDR_TWO],
        chainId: 84532,
        mode: 'all',
      },
    });

    expect(policy.resourceKeys).toEqual(['surveyResponses', 'docUrls']);
    expect(policy.recipients).toHaveLength(3);
    const flattened = JSON.stringify(policy.recipients);
    expect(flattened).toContain(ADDR_ONE);
    expect(flattened).toContain(ADDR_TWO);
    expect(flattened).toContain(ADDR_THREE);
  });

  it('does not auto-add default upload gate when selected resource is explicit open', () => {
    const cfg = buildOnChainCfg({
      questionResponses: {
        lookupStatus: 'ok',
        sbtAddresses: [],
        chainId: 84532,
        mode: 'any',
      },
      default: {
        lookupStatus: 'ok',
        sbtAddresses: [ADDR_ONE],
        chainId: 84532,
        mode: 'any',
      },
    });

    const policy = buildUploadGatePolicy({
      cfg,
      targets: { questions: true },
      isStandaloneQuestion: true,
      fallbackChainId: 84532,
    });

    expect(policy.hasExplicitOpenResource).toBe(true);
    expect(policy.recipients).toEqual([]);
  });

  it('routes standalone question tag encryption to questionResponses gates', () => {
    const cfg = buildOnChainCfg({
      questionResponses: {
        lookupStatus: 'ok',
        sbtAddresses: [ADDR_ONE],
        chainId: 84532,
        mode: 'any',
      },
    });

    const policy = buildUploadGatePolicy({
      cfg,
      targets: { questionTags: true },
      isStandaloneQuestion: true,
      fallbackChainId: 84532,
    });

    expect(policy.resourceKeys).toEqual(['questionResponses']);
    expect(policy.recipients).toHaveLength(1);
    expect(JSON.stringify(policy.recipients)).toContain(ADDR_ONE);
  });

  it('routes survey question tag encryption to surveyResponses gates', () => {
    const cfg = buildOnChainCfg({
      surveyResponses: {
        lookupStatus: 'ok',
        sbtAddresses: [ADDR_TWO],
        chainId: 84532,
        mode: 'all',
      },
    });

    const policy = buildUploadGatePolicy({
      cfg,
      targets: { questionTags: true },
      isStandaloneQuestion: false,
      fallbackChainId: 84532,
    });

    expect(policy.resourceKeys).toEqual(['surveyResponses']);
    expect(policy.recipients).toHaveLength(1);
    expect(JSON.stringify(policy.recipients)).toContain(ADDR_TWO);
  });
});
