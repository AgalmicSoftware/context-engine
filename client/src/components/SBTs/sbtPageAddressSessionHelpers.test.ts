import {
  buildSessionRoutePath,
  getCurrentSbtAddressInfo,
  resolveSbtAddress,
  resolveSbtAddressString,
  resolveSbtPageAddressLinkState,
} from './sbtPageAddressSessionHelpers';

describe('sbtPageAddressSessionHelpers', () => {
  it('builds session paths without changing base-path or slug encoding behavior', () => {
    expect(buildSessionRoutePath(' Edge Session ', '/base/')).toBe('/base/session/Edge%20Session');
    expect(buildSessionRoutePath('General', '/base/')).toBe('/base/session');
  });

  it('resolves SBT addresses from props, arrays, and raw values', () => {
    expect(resolveSbtAddress('0xA')).toBe('0xA');
    expect(resolveSbtAddress({ sbtAddress: '0xB' })).toBe('0xB');
    expect(resolveSbtAddress([{ nope: 'x' }, { sbtAddress: '0xC' }])).toBe('0xC');
    expect(resolveSbtAddressString({ sbtAddress: '0xD' })).toBe('0xD');
    expect(getCurrentSbtAddressInfo({ SBTAddress: { sbtAddress: '0xABC' } })).toEqual({
      original: '0xABC',
      lower: '0xabc',
    });
  });

  it('resolves address link display state while preserving zero-address handling', () => {
    const zeroAddress = '0x0000000000000000000000000000000000000000';
    const validAddress = '0x1111111111111111111111111111111111111111';
    const isAddress = (value: string): boolean => value.startsWith('0x') && value.length === 42;

    expect(resolveSbtPageAddressLinkState({ address: validAddress, isAddress, zeroAddress })).toEqual({
      isRenderable: true,
      isZeroAddress: false,
      normalized: validAddress,
    });
    expect(resolveSbtPageAddressLinkState({ address: zeroAddress, isAddress, zeroAddress })).toEqual({
      isRenderable: false,
      isZeroAddress: true,
      normalized: zeroAddress,
    });
    expect(resolveSbtPageAddressLinkState({ address: '0x2222', isAddress, zeroAddress })).toMatchObject({
      isRenderable: false,
      isZeroAddress: false,
      normalized: '0x2222',
    });
  });
});
