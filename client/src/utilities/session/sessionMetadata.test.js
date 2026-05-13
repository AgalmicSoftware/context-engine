import {
  normalizeLitMetadataNetwork,
  normalizeSessionNaming,
  stripAuthoritativeSessionGateFields,
} from './sessionMetadata.js';

describe('sessionMetadata gate handling', () => {
  it('removes authoritative gate fields from new metadata payloads', () => {
    const metadata = {
      slug: 'demo',
      sessionName: 'Demo',
      gates: [{ id: 'g1' }],
      sponsoredSbtAddress: '0x0000000000000000000000000000000000000001',
      sponsored: {
        defaultGateId: 'gate-1',
        gates: {
          'gate-1': {
            sbtAddresses: ['0x0000000000000000000000000000000000000001'],
          },
        },
      },
    };

    const stripped = stripAuthoritativeSessionGateFields(metadata);

    expect(stripped.slug).toBe('demo');
    expect(stripped.sessionName).toBe('Demo');
    expect(stripped.gates).toBeUndefined();
    expect(stripped.sponsored).toBeUndefined();
    expect(stripped.sponsoredSbtAddress).toBeUndefined();
    expect(metadata.sessionName).toBe('Demo');
    expect(metadata.gates).toEqual([{ id: 'g1' }]);
    expect(metadata.sponsored).toBeDefined();
    expect(metadata.sponsoredSbtAddress).toBe('0x0000000000000000000000000000000000000001');
  });

  it('rewrites legacy Lit network aliases onto the Chipotle runtime label', () => {
    const metadata = {
      lit: {
        network: 'NAGA_DEV',
        defaultGateId: 'gate-1',
      },
    };

    const normalized = normalizeLitMetadataNetwork(metadata);

    expect(normalized.lit.network).toBe('chipotle');
    expect(normalized.lit.defaultGateId).toBe('gate-1');
    expect(metadata.lit.network).toBe('NAGA_DEV');
  });

  it('migrates legacy root litNetwork into lit.network', () => {
    const metadata = {
      litNetwork: 'naga_test',
      lit: {
        defaultGateId: 'gate-2',
      },
    };

    const normalized = normalizeLitMetadataNetwork(metadata);

    expect(normalized.litNetwork).toBeUndefined();
    expect(normalized.lit.network).toBe('chipotle');
    expect(normalized.lit.defaultGateId).toBe('gate-2');
    expect(metadata.litNetwork).toBe('naga_test');
  });

  it('keeps canonical session fields and drops legacy org fields', () => {
    const metadata = {
      sessionName: 'Modern Session',
      orgName: 'Legacy Org',
      sessionInfo: 'Modern session info',
      orgInfoEncrypted: '{"v":1}',
    };

    const normalized = normalizeSessionNaming(metadata);

    expect(normalized.sessionName).toBe('Modern Session');
    expect(normalized.orgName).toBeUndefined();
    expect(normalized.sessionInfo).toBe('Modern session info');
    expect(normalized.orgInfo).toBeUndefined();
    expect(normalized.sessionInfoEncrypted).toBeUndefined();
    expect(normalized.orgInfoEncrypted).toBeUndefined();
    expect(metadata.orgName).toBe('Legacy Org');
  });

  it('does not coerce invalid metadata types into garbage strings', () => {
    const metadata = {
      sessionName: { bad: true },
      sessionInfo: ['bad'],
      litNetwork: { also: 'bad' },
    };

    const naming = normalizeSessionNaming(metadata);
    const lit = normalizeLitMetadataNetwork(metadata);

    expect(naming.sessionName).toBeUndefined();
    expect(naming.sessionInfo).toBeUndefined();
    expect(lit.lit).toBeUndefined();
  });
});
