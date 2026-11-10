import { readSigningWallet } from './sessionSettingsWallet';

describe('readSigningWallet', () => {
  it('reads the account and network without prompting', async () => {
    const request = jest.fn(async ({ method }: { method: string }) =>
      method === 'eth_accounts' ? ['0x00000000000000000000000000000000000000Aa'] : '0xaa36a7',
    );
    await expect(readSigningWallet({ request })).resolves.toEqual({
      address: '0x00000000000000000000000000000000000000Aa',
      chainId: 11155111,
    });
    expect(request.mock.calls.map(([call]) => call.method).sort()).toEqual(['eth_accounts', 'eth_chainId']);
  });

  it('reports no wallet when none answers', async () => {
    const request = jest.fn(async () => {
      throw new Error('No EIP-1193 provider available.');
    });
    await expect(readSigningWallet({ request })).resolves.toEqual({ address: '', chainId: 0 });
  });
});
