import { ethers } from 'ethers';
import {
  dedupeSbtSelections,
  normalizeGateMode,
  normalizeSbtSelection,
  resolveDefaultGateFromConfig,
} from './adminPageSbtGateSelectionHelpers';

describe('adminPageSbtGateSelectionHelpers', () => {
  const first = '0x00000000000000000000000000000000000000aa';
  const second = '0x00000000000000000000000000000000000000bb';

  it('normalizes raw SBT selections from strings and option objects', () => {
    expect(normalizeSbtSelection(`${first},\n${second}`)).toEqual([
      { address: first, name: first },
      { address: second, name: second },
    ]);
    expect(normalizeSbtSelection([{ value: first, label: 'Alpha' }, '', null])).toEqual([
      expect.objectContaining({ address: first, name: 'Alpha' }),
    ]);
  });

  it('dedupes selections by checksum address and drops invalid entries', () => {
    expect(
      dedupeSbtSelections([first, ethers.utils.getAddress(first), 'not-an-address', { address: second, name: 'Beta' }]),
    ).toEqual([
      { address: ethers.utils.getAddress(first), name: first },
      { address: ethers.utils.getAddress(second), name: 'Beta' },
    ]);
  });

  it('normalizes gate modes', () => {
    expect(normalizeGateMode('all')).toBe('all');
    expect(normalizeGateMode('AND')).toBe('all');
    expect(normalizeGateMode('any')).toBe('any');
    expect(normalizeGateMode('unknown')).toBe('any');
  });

  it('resolves default gate config with gate-level precedence and sponsored fallback', () => {
    expect(
      resolveDefaultGateFromConfig({
        networkChainId: 11155420,
        sponsored: {
          defaultGateId: 'gate-a',
          mode: 'any',
          sbtAddress: second,
          gates: {
            'gate-a': {
              mode: 'all',
              chainId: 84532,
              sbtAddresses: [first, first],
            },
          },
        },
      }),
    ).toEqual({
      gateId: 'gate-a',
      sbtAddresses: [ethers.utils.getAddress(first)],
      mode: 'all',
      chainId: 84532,
    });

    expect(
      resolveDefaultGateFromConfig({
        __registry: { chainId: 84532 },
        sponsored: {
          sbtAddresses: [second],
        },
      }),
    ).toEqual({
      gateId: '',
      sbtAddresses: [ethers.utils.getAddress(second)],
      mode: 'any',
      chainId: 84532,
    });
  });
});
