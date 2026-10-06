import { arweaveClient } from './arweaveClient';

let mockAttempts = 0;
jest.mock('arweave', () => {
  mockAttempts += 1;
  if (mockAttempts < 3) throw new TypeError('Failed to fetch dynamically imported module');
  return { __esModule: true, default: { init: () => ({ wallets: { jwkToAddress: async () => 'fixture-address' } }) } };
});

afterEach(() => jest.restoreAllMocks());

it('retries a failed SDK chunk before reading the wallet balance', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, text: async () => '42' });
  const result = await arweaveClient.readArweaveWalletBalance({}, { gateway: 'https://arweave.example.test' });
  expect(result).toMatchObject({ address: 'fixture-address', winston: '42' });
  expect(mockAttempts).toBe(3);
  expect(fetch).toHaveBeenCalledTimes(1);
});
