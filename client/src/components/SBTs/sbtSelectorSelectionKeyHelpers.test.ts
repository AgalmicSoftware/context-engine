import {
  getSelectableSbtKey,
  getSelectOptionValue,
  normalizeSelectableSbtAddress,
} from './sbtSelectorSelectionKeyHelpers';

describe('sbtSelectorSelectionKeyHelpers', () => {
  it('normalizes selectable SBT addresses and keys without changing chain scoping', () => {
    expect(normalizeSelectableSbtAddress(' 0x000000000000000000000000000000000000000A ')).toBe(
      '0x000000000000000000000000000000000000000a',
    );
    expect(normalizeSelectableSbtAddress('not-an-address')).toBe('');
    expect(
      getSelectableSbtKey({
        address: '0x000000000000000000000000000000000000000A',
        chainId: '84532',
      }),
    ).toBe('84532:0x000000000000000000000000000000000000000a');
    expect(
      getSelectableSbtKey({
        sbtAddress: '0x000000000000000000000000000000000000000B',
        sbtInfo: { chainID: '11155420' },
      }),
    ).toBe('11155420:0x000000000000000000000000000000000000000b');
    expect(
      getSelectableSbtKey({
        selectionKey: 'custom-key',
        address: '0x000000000000000000000000000000000000000A',
      }),
    ).toBe('custom-key');
    expect(getSelectableSbtKey('84532:0x000000000000000000000000000000000000000A')).toBe(
      '84532:0x000000000000000000000000000000000000000a',
    );
    expect(getSelectableSbtKey('0x000000000000000000000000000000000000000A')).toBe(
      '0x000000000000000000000000000000000000000a',
    );
    expect(getSelectableSbtKey('bad')).toBe('');
    expect(getSelectOptionValue({ value: 'fallback-value' })).toBe('fallback-value');
  });
});
