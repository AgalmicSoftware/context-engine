import { buildExplorerAddressUrl } from './chains.js';

describe('chains explorer link helpers', () => {
  const address = '0x00000000000000000000000000000000000000aa';

  it('builds explorer address URLs for Base mainnet, Base Sepolia, and OP Sepolia', () => {
    expect(buildExplorerAddressUrl(8453, address)).toBe(`https://basescan.org/address/${address}`);
    expect(buildExplorerAddressUrl(84532, address)).toBe(`https://sepolia.basescan.org/address/${address}`);
    expect(buildExplorerAddressUrl(11155420, address)).toBe(
      `https://optimism-sepolia.blockscout.com/address/${address}`,
    );
  });

  it('returns null for unknown explorer address chains', () => {
    expect(buildExplorerAddressUrl(777777, address)).toBeNull();
  });
});
