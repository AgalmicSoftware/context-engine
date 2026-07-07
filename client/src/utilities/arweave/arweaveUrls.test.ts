import {
  buildArweaveGatewayUrlCandidates,
  getDefaultArweaveGateways,
  getPreferredArweaveGateway,
  isArweaveTxId,
  normalizeArweaveUrl,
  parseArweaveTxId,
} from './arweaveUrls';

jest.mock('./arweaveScripts.js', () => ({
  arweaveScripts: {
    registerTxContext: jest.fn(),
  },
}));

describe('arweaveUrls helpers', () => {
  const txId = '8_2VRRP5Ka0b5F9yiq_nm2hJto8qnQazZ2EtfLJ0viE';
  const testArIoGateway = 'https://ar-io.example.test';
  const testArweaveGateway = 'https://arweave.example.test';
  const defaultArIoGateway = 'https://ar-io.dev'; // intentional: real URL - verifies production AR.IO gateway routing
  const canonicalArweaveGateway = 'https://arweave.net'; // intentional: real URL — tests allowlist enforcement
  const subdomainArweaveGateway = 'https://nknrqljpprb2ncdidz57t6g5o346sreaimrxm7qp3ybzitf7bvya.arweave.net'; // intentional: real URL — tests allowlist enforcement
  const irysGateway = 'https://gateway.irys.xyz'; // intentional: real URL — tests allowlist enforcement
  const arIoSubdomainGateway = 'https://b2tadb22u32gxwsm4gsbpfd3ng44xia5zy7cltjuc4j3da7nsulq.ar-io.dev'; // intentional: real URL - verifies AR.IO subdomain parsing
  const gatewayFanoutPrimary = 'https://permagate.io'; // intentional: real URL - verifies production gateway fanout
  const gatewayFanoutSecondary = 'https://g8way.io'; // intentional: real URL - verifies production gateway fanout

  afterEach(() => {
    try {
      delete (globalThis as Record<string, unknown>).CE_ARWEAVE_GATEWAY_URL;
    } catch (_) {}
    try {
      delete (globalThis as Record<string, unknown>).CE_ARWEAVE_AR_IO_URL;
    } catch (_) {}
    try {
      delete (globalThis as Record<string, unknown>).CE_ARWEAVE_DIRECT_TO_AR_IO;
    } catch (_) {}
    try {
      delete (globalThis as Record<string, unknown>).CE_ARWEAVE_GATEWAYS;
    } catch (_) {}
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
    expect(parseArweaveTxId(`${canonicalArweaveGateway}/${txId}`)).toBe(txId);
    expect(parseArweaveTxId(`${canonicalArweaveGateway}/${txId}/`)).toBe(txId);
    expect(parseArweaveTxId(`${canonicalArweaveGateway}/tx/${txId}/data`)).toBe(txId);
    expect(parseArweaveTxId(`${subdomainArweaveGateway}/${txId}`)).toBe(txId);
  });

  it('normalizes arweave txIds to gateway URLs and leaves other values unchanged', () => {
    (globalThis as Record<string, unknown>).CE_ARWEAVE_DIRECT_TO_AR_IO = false;
    expect(normalizeArweaveUrl(txId)).toBe(`${defaultArIoGateway}/${txId}`);
    expect(normalizeArweaveUrl(`ar://${txId}`)).toBe(`${defaultArIoGateway}/${txId}`);
    expect(normalizeArweaveUrl(`${canonicalArweaveGateway}/tx/${txId}/data`)).toBe(`${defaultArIoGateway}/${txId}`);
    expect(normalizeArweaveUrl(`${subdomainArweaveGateway}/${txId}`)).toBe(`${defaultArIoGateway}/${txId}`);
    expect(normalizeArweaveUrl('assets/img/ce_header.webp')).toBe('assets/img/ce_header.webp');
    expect(normalizeArweaveUrl('https://example.example.test/foo.png')).toBe('https://example.example.test/foo.png');
  });

  it('defaults to direct AR.IO-only gateway routing', () => {
    expect(getDefaultArweaveGateways()).toEqual([defaultArIoGateway]);
  });

  it('keeps legacy gateway fanout available when direct-to-AR.IO mode is disabled', () => {
    (globalThis as Record<string, unknown>).CE_ARWEAVE_DIRECT_TO_AR_IO = false;

    expect(getDefaultArweaveGateways()).toEqual([
      defaultArIoGateway,
      canonicalArweaveGateway,
      irysGateway,
      gatewayFanoutPrimary,
      gatewayFanoutSecondary,
    ]);
  });

  it('uses AR.IO when direct-to-AR.IO mode is enabled for user-facing links', () => {
    (globalThis as Record<string, unknown>).CE_ARWEAVE_DIRECT_TO_AR_IO = true;
    (globalThis as Record<string, unknown>).CE_ARWEAVE_AR_IO_URL = testArIoGateway;

    expect(getPreferredArweaveGateway()).toBe(testArIoGateway);
    expect(normalizeArweaveUrl(txId)).toBe(`${testArIoGateway}/${txId}`);
  });

  it('uses runtime gateway override when CE_ARWEAVE_GATEWAY_URL is set', () => {
    (globalThis as Record<string, unknown>).CE_ARWEAVE_GATEWAY_URL = testArweaveGateway;
    expect(getPreferredArweaveGateway()).toBe(testArweaveGateway);
    expect(normalizeArweaveUrl(txId)).toBe(`${testArweaveGateway}/${txId}`);
  });

  it('builds gateway fallback candidates for tx ids and known gateway URLs', () => {
    (globalThis as Record<string, unknown>).CE_ARWEAVE_DIRECT_TO_AR_IO = true;
    (globalThis as Record<string, unknown>).CE_ARWEAVE_AR_IO_URL = testArIoGateway;
    (globalThis as Record<string, unknown>).CE_ARWEAVE_GATEWAYS = [
      'https://backup.example.test',
      canonicalArweaveGateway,
    ];

    const candidates = buildArweaveGatewayUrlCandidates(`${arIoSubdomainGateway}/${txId}?`);

    expect(candidates).toEqual([
      `${testArIoGateway}/${txId}`,
      'https://backup.example.test/8_2VRRP5Ka0b5F9yiq_nm2hJto8qnQazZ2EtfLJ0viE',
      `${canonicalArweaveGateway}/${txId}`,
      `${defaultArIoGateway}/${txId}`,
      `${irysGateway}/${txId}`,
      `${gatewayFanoutPrimary}/${txId}`,
      `${gatewayFanoutSecondary}/${txId}`,
    ]);
  });
});
