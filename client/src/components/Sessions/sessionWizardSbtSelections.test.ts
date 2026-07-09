import {
  buildPendingSbtSelection,
  normalizeSbtSelection,
  promotePendingSbtSelectionsAfterDeploy,
  serializeDefaultFeaturedSbtSelections,
} from './sessionWizardSbtSelections';

describe('sessionWizardSbtSelections', () => {
  it('normalizes string, object, and delimited SBT selections', () => {
    expect(normalizeSbtSelection(['0xabc', { sbtAddress: '0xdef', label: 'Token DEF' }])).toEqual([
      { address: '0xabc', name: '0xabc' },
      { sbtAddress: '0xdef', label: 'Token DEF', address: '0xdef', name: 'Token DEF' },
    ]);

    expect(normalizeSbtSelection('0x111,\n0x222')).toEqual([
      { address: '0x111', name: '0x111' },
      { address: '0x222', name: '0x222' },
    ]);
  });

  it('serializes featured selections with dedupe and pending markers preserved', () => {
    expect(
      serializeDefaultFeaturedSbtSelections([
        { address: '0xAAA', name: 'Alpha', pending: true },
        { address: '0xaaa', name: 'Alpha duplicate' },
        { address: '0xBBB', name: 'Beta' },
      ]),
    ).toEqual([{ address: '0xAAA', name: 'Alpha', pending: true }, '0xBBB']);
  });

  it('builds pending labels and promotes pending selections to deployed entries', () => {
    expect(
      buildPendingSbtSelection({
        predictedAddress: '0x123',
        displayName: 'Launch Pass',
      }),
    ).toEqual({
      address: '0x123',
      name: 'Launch Pass (Pending)',
      pending: true,
      metadataPreview: null,
    });

    expect(
      promotePendingSbtSelectionsAfterDeploy({
        selections: [
          {
            address: '0x59c6995e998f97a5a0044976f1d8fa9f2b5f0d2c',
            name: 'Launch Pass (Pending)',
            pending: true,
            metadataPreview: { phase: 'pending' },
          },
        ],
        deployedDrafts: [
          {
            predictedAddress: '0x59c6995e998f97a5a0044976f1d8fa9f2b5f0d2c',
            deployedAddress: '0x59c6995e998f97a5a0044976f1d8fa9f2b5f0d2c',
            displayName: 'Launch Pass',
            metadataPreview: { phase: 'deployed' },
          },
        ],
      }),
    ).toEqual([
      {
        address: '0x59c6995e998f97a5a0044976f1d8fa9f2b5f0d2c',
        name: 'Launch Pass',
        metadataPreview: { phase: 'deployed' },
      },
    ]);
  });
});
