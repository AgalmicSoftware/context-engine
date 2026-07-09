/** @file arweaveClient.gateway.test.js */
import Arweave from 'arweave';
import { arweaveClient } from './arweaveClient.js';

const textResp = (status, textBody = '', contentType = 'text/plain') => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => textBody,
  headers: {
    get: (name) => (String(name || '').toLowerCase() === 'content-type' ? contentType : null),
  },
});

const TEST_AR_IO_GATEWAY = 'https://unit.ar-io.dev'; // intentional: real URL - verifies AR.IO gateway override handling
const DEFAULT_AR_IO_GATEWAY = 'https://ar-io.dev'; // intentional: real URL - verifies production AR.IO gateway routing
const originalFetch = global.fetch;

describe('arweaveClient.buildArweaveGatewayUrl', () => {
  const txId = '8_2VRRP5Ka0b5F9yiq_nm2hJto8qnQazZ2EtfLJ0viE';

  afterEach(() => {
    try {
      delete globalThis.CE_ARWEAVE_GATEWAY_URL;
    } catch (_) {}
    try {
      delete globalThis.CE_ARWEAVE_AR_IO_URL;
    } catch (_) {}
    try {
      delete globalThis.CE_ARWEAVE_DIRECT_TO_AR_IO;
    } catch (_) {}
  });

  it('uses AR.IO gateway when direct-to-AR.IO mode is enabled', () => {
    globalThis.CE_ARWEAVE_DIRECT_TO_AR_IO = true;
    globalThis.CE_ARWEAVE_AR_IO_URL = TEST_AR_IO_GATEWAY;

    expect(arweaveClient.buildArweaveGatewayUrl(txId)).toBe(`${TEST_AR_IO_GATEWAY}/${txId}`);
  });
});

describe('arweaveClient.readArweaveWalletBalance', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
    globalThis.CE_ARWEAVE_DIRECT_TO_AR_IO = false;
    try {
      delete globalThis.CE_ARWEAVE_GATEWAY_URL;
    } catch (_) {}
    try {
      delete globalThis.CE_ARWEAVE_AR_IO_URL;
    } catch (_) {}
  });

  afterEach(() => {
    try {
      delete globalThis.CE_ARWEAVE_GATEWAY_URL;
    } catch (_) {}
    try {
      delete globalThis.CE_ARWEAVE_AR_IO_URL;
    } catch (_) {}
    try {
      delete globalThis.CE_ARWEAVE_DIRECT_TO_AR_IO;
    } catch (_) {}
    global.fetch = originalFetch;
  });

  it('derives the wallet address and reads the balance through the preferred gateway helper', async () => {
    const address = 'mocked-arweave-address';
    const jwk = { kty: 'RSA', e: 'AQAB', n: 'mocked' };
    const initSpy = jest.spyOn(Arweave, 'init').mockReturnValue({
      wallets: {
        jwkToAddress: jest.fn().mockResolvedValue(address),
      },
    });
    global.fetch.mockResolvedValue(textResp(200, '12345678000000'));

    try {
      const result = await arweaveClient.readArweaveWalletBalance(jwk);

      expect(global.fetch).toHaveBeenCalledWith(`${DEFAULT_AR_IO_GATEWAY}/wallet/${address}/balance`);
      expect(result).toEqual({
        address,
        balanceUrl: `${DEFAULT_AR_IO_GATEWAY}/wallet/${address}/balance`,
        gatewayBase: DEFAULT_AR_IO_GATEWAY,
        winston: '12345678000000',
      });
    } finally {
      initSpy.mockRestore();
    }
  });

  it('uses the configured gateway override and formats winston balances without floating point drift', async () => {
    globalThis.CE_ARWEAVE_GATEWAY_URL = 'https://arweave.example.test/custom';
    const address = 'mocked-arweave-address';
    const jwk = { kty: 'RSA', e: 'AQAB', n: 'mocked' };
    const initSpy = jest.spyOn(Arweave, 'init').mockReturnValue({
      wallets: {
        jwkToAddress: jest.fn().mockResolvedValue(address),
      },
    });
    global.fetch.mockResolvedValue(textResp(200, '5'));

    try {
      const result = await arweaveClient.readArweaveWalletBalance(jwk);

      expect(global.fetch).toHaveBeenCalledWith(`https://arweave.example.test/custom/wallet/${address}/balance`);
      expect(result.gatewayBase).toBe('https://arweave.example.test/custom');
      expect(arweaveClient.formatWinstonToAr('12345678000000', 6)).toBe('12.345678');
      expect(arweaveClient.formatWinstonToAr('5', 6)).toBe('0.000000');
    } finally {
      initSpy.mockRestore();
    }
  });
});
