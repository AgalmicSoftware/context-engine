jest.mock('./arweaveScripts.js', () => ({
  arweaveScripts: {
    registerTxContext: jest.fn(),
  },
}));

import {
  buildArweaveGatewayUrlCandidates,
  getPreferredArweaveGateway,
  isArweaveTxId,
  normalizeArweaveUrl,
  parseArweaveTxId,
} from './arweaveUrls';

describe('arweaveUrls helpers', () => {
  const txId = '8_2VRRP5Ka0b5F9yiq_nm2hJto8qnQazZ2EtfLJ0viE';
  const testArIoGateway = 'https://ar-io.example.test';
  const testArweaveGateway = 'https://arweave.example.test';

  afterEach(() => {
    try { delete globalThis.CE_ARWEAVE_GATEWAY_URL; } catch (_) {}
    try { delete globalThis.CE_ARWEAVE_AR_IO_URL; } catch (_) {}
    try { delete globalThis.CE_ARWEAVE_DIRECT_TO_AR_IO; } catch (_) {}
    try { delete globalThis.CE_ARWEAVE_GATEWAYS; } catch (_) {}
  });

  it('detects base64url txIds', () => {
    expect(isArweaveTxId(txId)).toBe(true);
    expect(isArweaveTxId(` ${txId} `)).toBe(true);
    expect(isArweaveTxId('not-a-txid')).toBe(false);
    expect(isArweaveTxId('')).toBe(false);
  });

  it('parses txIds from bare values, ar:// URIs, and gateway URLs', () => {
    expect(parseArweaveTxId(txId)).toBe(txId);
    expect(parseArweaveTxId(`ar://${txId}`)).toBe(txId);
    expect(parseArweaveTxId(`ar://${txId}?foo=bar`)).toBe(txId);
    expect(parseArweaveTxId(`https://arweave.net/${txId}`)).toBe(txId);
    expect(parseArweaveTxId(`https://arweave.net/${txId}/`)).toBe(txId);
    expect(parseArweaveTxId(`https://arweave.net/tx/${txId}/data`)).toBe(txId);
    expect(parseArweaveTxId(`https://nknrqljpprb2ncdidz57t6g5o346sreaimrxm7qp3ybzitf7bvya.arweave.net/${txId}`)).toBe(txId);
  });

  it('normalizes arweave txIds to gateway URLs and leaves other values unchanged', () => {
    globalThis.CE_ARWEAVE_DIRECT_TO_AR_IO = false;
    expect(normalizeArweaveUrl(txId)).toBe(`https://ar-io.dev/${txId}`);
    expect(normalizeArweaveUrl(`ar://${txId}`)).toBe(`https://ar-io.dev/${txId}`);
    expect(normalizeArweaveUrl(`https://arweave.net/tx/${txId}/data`)).toBe(`https://ar-io.dev/${txId}`);
    expect(normalizeArweaveUrl(`https://nknrqljpprb2ncdidz57t6g5o346sreaimrxm7qp3ybzitf7bvya.arweave.net/${txId}`)).toBe(`https://ar-io.dev/${txId}`);
    expect(normalizeArweaveUrl('assets/img/ce_header.webp')).toBe('assets/img/ce_header.webp');
    expect(normalizeArweaveUrl('https://example.com/foo.png')).toBe('https://example.com/foo.png');
  });

  it('uses ar.io when direct-to-ar.io mode is enabled for user-facing links', () => {
    globalThis.CE_ARWEAVE_DIRECT_TO_AR_IO = true;
    globalThis.CE_ARWEAVE_AR_IO_URL = testArIoGateway;

    expect(getPreferredArweaveGateway()).toBe(testArIoGateway);
    expect(normalizeArweaveUrl(txId)).toBe(`${testArIoGateway}/${txId}`);
  });

  it('uses runtime gateway override when CE_ARWEAVE_GATEWAY_URL is set', () => {
    globalThis.CE_ARWEAVE_GATEWAY_URL = testArweaveGateway;
    expect(getPreferredArweaveGateway()).toBe(testArweaveGateway);
    expect(normalizeArweaveUrl(txId)).toBe(`${testArweaveGateway}/${txId}`);
  });

  it('builds gateway fallback candidates for tx ids and known gateway URLs', () => {
    globalThis.CE_ARWEAVE_DIRECT_TO_AR_IO = true;
    globalThis.CE_ARWEAVE_AR_IO_URL = testArIoGateway;
    globalThis.CE_ARWEAVE_GATEWAYS = ['https://backup.example.test', 'https://arweave.net'];

    const candidates = buildArweaveGatewayUrlCandidates(
      `https://b2tadb22u32gxwsm4gsbpfd3ng44xia5zy7cltjuc4j3da7nsulq.ar-io.dev/${txId}?`
    );

    expect(candidates).toEqual([
      `${testArIoGateway}/${txId}`,
      'https://backup.example.test/8_2VRRP5Ka0b5F9yiq_nm2hJto8qnQazZ2EtfLJ0viE',
      `https://arweave.net/${txId}`,
      `https://ar-io.dev/${txId}`,
      `https://gateway.irys.xyz/${txId}`,
      `https://permagate.io/${txId}`,
      `https://g8way.io/${txId}`,
    ]);
  });
});
