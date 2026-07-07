import {
  areSbtListArraysEqual,
  getSbtListItemSignature,
  getSbtListNetHolderCount,
  normalizeSbtListItems,
} from './sbtListItemNormalizationHelpers';

describe('sbtListItemNormalizationHelpers', () => {
  it('computes net holder counts from summaries before address lists', () => {
    expect(
      getSbtListNetHolderCount({
        historySummary: { currentHolderCount: '4.9' },
        mintedAddresses: ['0x1'],
        burnedAddresses: [],
      }),
    ).toBe(4);
    expect(
      getSbtListNetHolderCount({
        mintedAddresses: ['0x1', '0x2'],
        burnedAddresses: ['0x1'],
      }),
    ).toBe(1);
    expect(
      getSbtListNetHolderCount({
        mintedAddresses: ['0x1'],
        burnedAddresses: ['0x1', '0x2'],
      }),
    ).toBe(0);
  });

  it('normalizes SBT list items by valid shape, net holders, and address', () => {
    expect(
      normalizeSbtListItems([
        { sbtAddress: '0xB', sbtInfo: { name: 'Beta' }, mintedAddresses: ['0x1'] },
        { sbtAddress: '0xA', sbtInfo: { name: 'Alpha' }, mintedAddresses: ['0x1', '0x2'] },
        { sbtAddress: '0xC' },
        'bad',
      ]),
    ).toEqual([
      { sbtAddress: '0xA', sbtInfo: { name: 'Alpha' }, mintedAddresses: ['0x1', '0x2'] },
      { sbtAddress: '0xB', sbtInfo: { name: 'Beta' }, mintedAddresses: ['0x1'] },
    ]);
  });

  it('compares SBT list arrays by visible item signatures', () => {
    const first = [
      {
        sbtAddress: '0xA',
        blockNumber: 5,
        mintedAddresses: ['0x1'],
        burnedAddresses: [],
        sbtInfo: {
          name: 'Alpha',
          description: 'One',
          image: 'image-a',
        },
      },
    ];
    const same = [
      {
        sbtAddress: '0xa',
        blockNumber: 5,
        mintedAddresses: ['0x1'],
        burnedAddresses: [],
        sbtInfo: {
          name: 'Alpha',
          description: 'One',
          image: 'image-a',
        },
      },
    ];
    const changed = [
      {
        ...same[0],
        sbtInfo: {
          ...same[0].sbtInfo,
          image: 'image-b',
        },
      },
    ];

    expect(getSbtListItemSignature(first[0])).toBe(getSbtListItemSignature(same[0]));
    expect(areSbtListArraysEqual(first, same)).toBe(true);
    expect(areSbtListArraysEqual(first, changed)).toBe(false);
    expect(areSbtListArraysEqual(first, [])).toBe(false);
  });
});
