import {
  buildCanDecryptOtherResponsesSnapshot,
  buildResponseGateConfigSignature,
  resolveCanDecryptOtherResponsesVerdict,
} from './surveyToolResponseAccess';

describe('surveyToolResponseAccess', () => {
  it('builds stable keys and signatures for response decrypt checks', () => {
    expect(
      buildCanDecryptOtherResponsesSnapshot({
        account: '0xAbC',
        loginComplete: true,
        singleQuestionMode: false,
        isStandalone: true,
        policy: {
          primaryResource: 'surveyResponses',
          recipients: [{ id: 'gate-1' }],
        },
        slug: 'edge',
        sbtCacheRevision: 7,
        cfg: {
          __registry: {
            updatedAt: '2026-04-25T00:00:00Z',
            gateAuthority: 'registry',
          },
        },
      }),
    ).toEqual({
      loggedIn: true,
      account: '0xAbC',
      recipients: [{ id: 'gate-1' }],
      resourceKeysToCheck: ['surveyResponses', 'default'],
      key: '0xabc|edge|surveyResponses,default|7|2026-04-25T00:00:00Z|registry|1',
      signature: '0xabc|edge|surveyResponses,default|7|2026-04-25T00:00:00Z|registry|1',
    });
  });

  it('uses an anonymous signature when the wallet is not ready', () => {
    expect(
      buildCanDecryptOtherResponsesSnapshot({
        account: '',
        loginComplete: false,
        singleQuestionMode: true,
        isStandalone: false,
        policy: null,
        slug: 'edge',
      }).signature,
    ).toBe('<anon>|edge|questionResponses,default|0|||0');
  });

  it('treats mixed error verdicts as unknown instead of denied', () => {
    expect(resolveCanDecryptOtherResponsesVerdict([{ status: 'error' }, { status: 'denied' }])).toEqual({
      canDecrypt: false,
      status: 'unknown',
    });
  });

  it('grants decrypt access when any checked resource is granted', () => {
    expect(resolveCanDecryptOtherResponsesVerdict([{ status: 'denied' }, { status: 'granted' }])).toEqual({
      canDecrypt: true,
      status: 'granted',
    });
  });

  it('builds a stable config signature from sponsored and registry gate metadata', () => {
    const first = buildResponseGateConfigSignature({
      networkChainId: 84532,
      sponsored: {
        defaultGateId: 'vip_gate',
        gates: {
          vip_gate: {
            gateId: 'vip_gate',
            label: 'VIP Gate',
            chainId: 84532,
            litChain: 'baseSepolia',
            sbtAddresses: ['0xB', '0xA'],
          },
        },
        resources: {
          surveyResponses: {
            gateId: 'vip_gate',
            mode: 'any',
          },
        },
      },
      __registry: {
        updatedAt: '2026-04-25T00:00:00Z',
        gateAuthority: 'registry',
        gatesByResource: {
          surveyResponses: {
            gateId: 'vip_gate',
            label: 'VIP Gate',
            chainId: 84532,
          },
        },
      },
    });
    const second = buildResponseGateConfigSignature({
      networkChainId: '84532',
      sponsored: {
        defaultGateId: 'vip_gate',
        gates: {
          vip_gate: {
            gateId: 'VIP_GATE',
            label: 'vip gate',
            chainId: '84532',
            litChain: 'BaseSepolia',
            sbtAddresses: ['0xa', '0xb'],
          },
        },
        resources: {
          surveyResponses: {
            gateId: 'vip_gate',
            mode: 'any',
          },
        },
      },
      __registry: {
        updatedAt: '2026-04-25T00:00:00Z',
        gateAuthority: 'registry',
        gatesByResource: {
          surveyResponses: {
            gateId: 'vip_gate',
            label: 'VIP Gate',
            chainId: 84532,
          },
        },
      },
    });

    expect(first).toBe(second);
    expect(first).toContain('84532|vip_gate|2026-04-25T00:00:00Z|registry|');
    expect(first).toContain('0xa,0xb');
  });
});
