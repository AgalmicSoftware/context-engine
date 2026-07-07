import { buildExplorerAddressUrl, buildExplorerTxUrl } from './chains.js';

describe('chains explorer link helpers', () => {
  const address = '0x00000000000000000000000000000000000000aa';
  const txHash = '0x1234567890abcdef';

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

  it('builds explorer transaction URLs for Base mainnet, Base Sepolia, and OP Sepolia', () => {
    expect(buildExplorerTxUrl(8453, txHash)).toBe(`https://basescan.org/tx/${txHash}`);
    expect(buildExplorerTxUrl(84532, txHash)).toBe(`https://sepolia.basescan.org/tx/${txHash}`);
    expect(buildExplorerTxUrl(11155420, txHash)).toBe(`https://optimism-sepolia.blockscout.com/tx/${txHash}`);
  });

  it('returns null for unknown explorer transaction chains', () => {
    expect(buildExplorerTxUrl(777777, txHash)).toBeNull();
  });
});
