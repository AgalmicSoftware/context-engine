/** @file arweaveClient.directRouting.test.js */
import { fetchWorkerWithAuth } from '../worker/workerAuth.js';
import { getCorsProxyUrlOrThrow, resolveCorsProxyUrl } from '../worker/corsProxy.js';
import { readSessionScanSlugs } from '../session/sessionScanScope.js';
import { arweaveClient } from './arweaveClient.js';

jest.mock('../worker/workerAuth.js', () => ({
  fetchWorkerWithAuth: jest.fn(),
}));

jest.mock('../worker/corsProxy.js', () => ({
  getCorsProxyUrlOrThrow: jest.fn(),
  resolveCorsProxyUrl: jest.fn(),
}));

jest.mock('../session/sessionScanScope.js', () => ({
  readSessionScanSlugs: jest.fn(() => []),
}));

jest.setTimeout(20000);

const jsonResp = (status, payload = {}) => {
  const textBody = JSON.stringify(payload);
  const buildResponse = () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
    text: async () => textBody,
    clone: () => buildResponse(),
  });
  return buildResponse();
};

const textResp = (status, textBody = '', contentType = 'text/plain') => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => textBody,
  headers: {
    get: (name) => (String(name || '').toLowerCase() === 'content-type' ? contentType : null),
  },
});

const TEST_ARWEAVE_GATEWAY = 'https://arweave.example.test';
const TEST_AR_IO_GATEWAY = 'https://unit.ar-io.dev'; // intentional: real URL - verifies AR.IO gateway override handling
const TEST_IRYS_GATEWAY = 'https://gateway-irys.example.test';

describe('arweaveClient.downloadDataFromArweave direct routing', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
    globalThis.CE_ARWEAVE_DIRECT_TO_AR_IO = false;
    getCorsProxyUrlOrThrow.mockResolvedValue('https://selected.worker.example.test');
    resolveCorsProxyUrl.mockResolvedValue({
      url: 'https://selected.worker.example.test',
      session: {
        slug: '',
        __registry: {
          gateAuthority: 'onchain',
          gatesByResource: {
            arweave: { lookupStatus: 'ok', sbtAddresses: ['0xabc'] },
          },
        },
      },
    });
    readSessionScanSlugs.mockReturnValue([]);
    fetchWorkerWithAuth.mockResolvedValue(jsonResp(200, { id: 'tx-default' }));
    try {
      delete globalThis.__CE_ARWEAVE_UPLOAD_FALLBACK__;
    } catch (_) {}
    try {
      delete globalThis.CE_ARWEAVE_GATEWAYS;
    } catch (_) {}
    try {
      delete globalThis.CE_ARWEAVE_GATEWAY_URL;
    } catch (_) {}
    try {
      delete globalThis.CE_ARWEAVE_AR_IO_URL;
    } catch (_) {}
  });

  afterEach(() => {
    jest.clearAllMocks();
    try {
      delete globalThis.CE_ARWEAVE_GATEWAYS;
    } catch (_) {}
    try {
      delete globalThis.CE_ARWEAVE_GATEWAY_URL;
    } catch (_) {}
    try {
      delete globalThis.CE_ARWEAVE_AR_IO_URL;
    } catch (_) {}
    try {
      delete globalThis.CE_ARWEAVE_DIRECT_TO_AR_IO;
    } catch (_) {}
    try {
      delete globalThis.CE_ARWEAVE_PREFLIGHT_SESSION_METADATA;
    } catch (_) {}
    try {
      delete globalThis.CE_ARWEAVE_PREFLIGHT_SBT_METADATA;
    } catch (_) {}
    try {
      delete globalThis.CE_ARWEAVE_PREFLIGHT_RESPONSE_PAYLOADS;
    } catch (_) {}
  });

  it('prefers AR.IO direct hits without probing legacy gateways when direct-to-AR.IO mode is enabled', async () => {
    globalThis.CE_ARWEAVE_DIRECT_TO_AR_IO = true;
    globalThis.CE_ARWEAVE_AR_IO_URL = TEST_AR_IO_GATEWAY;
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => '{"ok":"ar-io-primary-hit"}',
    });

    const txId = 'ar-io-first-mode';
    const text = await arweaveClient.downloadDataFromArweave(txId, {
      gateways: [TEST_ARWEAVE_GATEWAY],
      retries: 0,
      bypassCache: true,
      disableExistencePrecheck: true,
      debugContext: { category: 'question_response_payload' },
    });

    expect(text).toBe('{"ok":"ar-io-primary-hit"}');
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const calledUrls = global.fetch.mock.calls.map((call) => String(call?.[0] || ''));
    expect(calledUrls.every((url) => url.includes(TEST_AR_IO_GATEWAY))).toBe(true);
    expect(calledUrls.some((url) => url.includes(TEST_ARWEAVE_GATEWAY))).toBe(false);
    expect(calledUrls.some((url) => url.includes(TEST_IRYS_GATEWAY))).toBe(false);
    expect(calledUrls[0]).toContain('/ar-io-first-mode');
    expect(calledUrls.some((url) => url.includes('/raw/ar-io-first-mode'))).toBe(false);
  });

  it('keeps display-critical metadata on AR.IO when direct-to-AR.IO mode is enabled', async () => {
    globalThis.CE_ARWEAVE_DIRECT_TO_AR_IO = true;
    globalThis.CE_ARWEAVE_AR_IO_URL = TEST_AR_IO_GATEWAY;
    global.fetch.mockResolvedValueOnce(textResp(200, '{"ok":"metadata-ar-io-hit"}', 'application/json'));

    const text = await arweaveClient.downloadDataFromArweave('session-meta-ar-io', {
      gateways: [TEST_ARWEAVE_GATEWAY],
      retries: 0,
      bypassCache: true,
      disableExistencePrecheck: true,
      debugContext: { category: 'session_registry_metadata' },
    });

    expect(text).toBe('{"ok":"metadata-ar-io-hit"}');
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const calledUrls = global.fetch.mock.calls.map((call) => String(call?.[0] || ''));
    expect(calledUrls[0]).toContain(`${TEST_AR_IO_GATEWAY}/session-meta-ar-io`);
    expect(calledUrls.some((url) => url.includes(TEST_ARWEAVE_GATEWAY))).toBe(false);
  });

  it('does not fall back to legacy gateways after an AR.IO html miss', async () => {
    globalThis.CE_ARWEAVE_DIRECT_TO_AR_IO = true;
    globalThis.CE_ARWEAVE_AR_IO_URL = TEST_AR_IO_GATEWAY;
    global.fetch.mockResolvedValueOnce(textResp(200, '<html><title>404 - Page not found.</title></html>', 'text/html'));

    await expect(
      arweaveClient.downloadDataFromArweave('ar-io-html-fallback', {
        gateways: [TEST_ARWEAVE_GATEWAY],
        retries: 0,
        bypassCache: true,
        disableExistencePrecheck: true,
        debugContext: { category: 'question_response_payload' },
      }),
    ).rejects.toMatchObject({
      name: 'ArweaveFetchError',
      status: 404,
      kind: 'not_found',
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const calledUrl = String(global.fetch.mock.calls[0]?.[0] || '');
    expect(calledUrl).toContain(TEST_AR_IO_GATEWAY);
    expect(calledUrl).toContain('/ar-io-html-fallback');
    expect(calledUrl).not.toContain(TEST_ARWEAVE_GATEWAY);
    expect(calledUrl).not.toContain(TEST_IRYS_GATEWAY);
    expect(calledUrl).not.toContain('/raw/ar-io-html-fallback');
    expect(calledUrl).not.toContain('/tx/ar-io-html-fallback/data');
  });

  it('retries only against AR.IO when direct-to-AR.IO mode is enabled', async () => {
    globalThis.CE_ARWEAVE_DIRECT_TO_AR_IO = true;
    globalThis.CE_ARWEAVE_AR_IO_URL = TEST_AR_IO_GATEWAY;
    global.fetch
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: async () => '',
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => '{"ok":"ar-io-retry-hit"}',
      });

    const text = await arweaveClient.downloadDataFromArweave('ar-io-retry-fallback', {
      gateways: [TEST_ARWEAVE_GATEWAY, TEST_IRYS_GATEWAY],
      retries: 1,
      retryDelayMs: 0,
      bypassCache: true,
      disableExistencePrecheck: true,
      debugContext: { category: 'question_response_payload' },
    });

    expect(text).toBe('{"ok":"ar-io-retry-hit"}');
    expect(global.fetch).toHaveBeenCalledTimes(2);
    const calledUrls = global.fetch.mock.calls.map((call) => String(call?.[0] || ''));
    expect(calledUrls[0]).toContain(TEST_AR_IO_GATEWAY);
    expect(calledUrls[1]).toContain(TEST_AR_IO_GATEWAY);
    expect(calledUrls.some((url) => url.includes(TEST_ARWEAVE_GATEWAY))).toBe(false);
    expect(calledUrls.some((url) => url.includes(TEST_IRYS_GATEWAY))).toBe(false);
    expect(calledUrls[1]).toContain('/ar-io-retry-fallback');
    expect(calledUrls[1]).not.toContain('/raw/ar-io-retry-fallback');
    expect(calledUrls.some((url) => url.includes('/raw/ar-io-retry-fallback'))).toBe(false);
    expect(calledUrls.some((url) => url.includes('/tx/ar-io-retry-fallback/data'))).toBe(false);
  });

  it('default routing stays on AR.IO only when direct-to-AR.IO mode is enabled', async () => {
    globalThis.CE_ARWEAVE_DIRECT_TO_AR_IO = true;
    globalThis.CE_ARWEAVE_AR_IO_URL = TEST_AR_IO_GATEWAY;
    globalThis.CE_ARWEAVE_GATEWAY_URL = TEST_ARWEAVE_GATEWAY;
    global.fetch.mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => '',
    });

    await expect(
      arweaveClient.downloadDataFromArweave('default-gateway-fanout', {
        retries: 0,
        bypassCache: true,
        disableExistencePrecheck: true,
      }),
    ).rejects.toMatchObject({
      name: 'ArweaveFetchError',
      status: 404,
      kind: 'not_found',
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const calledUrls = global.fetch.mock.calls.map((call) => String(call?.[0] || ''));
    expect(calledUrls.every((url) => url.includes(TEST_AR_IO_GATEWAY))).toBe(true);
    expect(calledUrls.some((url) => url.includes(TEST_ARWEAVE_GATEWAY))).toBe(false);
    expect(calledUrls.some((url) => url.includes(TEST_IRYS_GATEWAY))).toBe(false);
    expect(calledUrls.some((url) => url.includes('/tx/default-gateway-fanout/data'))).toBe(false);
    expect(calledUrls.some((url) => url.includes('/raw/default-gateway-fanout'))).toBe(false);
  });

  it('honors per-call gateway fanout when app-wide direct-to-AR.IO mode is enabled', async () => {
    globalThis.CE_ARWEAVE_DIRECT_TO_AR_IO = true;
    globalThis.CE_ARWEAVE_AR_IO_URL = TEST_AR_IO_GATEWAY;
    globalThis.CE_ARWEAVE_GATEWAYS = [TEST_ARWEAVE_GATEWAY, TEST_IRYS_GATEWAY];
    global.fetch
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => '',
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => '{"ok":"gateway-fanout-hit"}',
        headers: { get: () => 'application/json' },
      });

    const text = await arweaveClient.downloadDataFromArweave('response-gateway-fanout', {
      directToArIo: false,
      retries: 0,
      bypassCache: true,
      disableExistencePrecheck: true,
      debugContext: { category: 'question_response_payload' },
    });

    expect(text).toBe('{"ok":"gateway-fanout-hit"}');
    expect(global.fetch).toHaveBeenCalledTimes(2);
    const calledUrls = global.fetch.mock.calls.map((call) => String(call?.[0] || ''));
    expect(calledUrls[0]).toContain(TEST_AR_IO_GATEWAY);
    expect(calledUrls[0]).toContain('/response-gateway-fanout');
    expect(calledUrls[0]).not.toContain('/raw/response-gateway-fanout');
    expect(calledUrls[1]).toContain(TEST_ARWEAVE_GATEWAY);
    expect(calledUrls[1]).toContain('/response-gateway-fanout');
    expect(calledUrls[1]).not.toContain(TEST_IRYS_GATEWAY);
  });

  it('skips /raw and /tx-data probes while staying on AR.IO in direct-to-AR.IO mode', async () => {
    globalThis.CE_ARWEAVE_DIRECT_TO_AR_IO = true;
    globalThis.CE_ARWEAVE_AR_IO_URL = TEST_AR_IO_GATEWAY;
    global.fetch.mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => '',
    });

    await expect(
      arweaveClient.downloadDataFromArweave('ar-io-no-tx-data', {
        gateways: [TEST_ARWEAVE_GATEWAY],
        retries: 0,
        bypassCache: true,
        disableExistencePrecheck: true,
        debugContext: { category: 'question_response_payload' },
      }),
    ).rejects.toMatchObject({
      name: 'ArweaveFetchError',
      status: 404,
      kind: 'not_found',
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const calledUrls = global.fetch.mock.calls.map((call) => String(call?.[0] || ''));
    expect(calledUrls[0]).toContain('/ar-io-no-tx-data');
    expect(calledUrls[0]).toContain(TEST_AR_IO_GATEWAY);
    expect(calledUrls.some((url) => url.includes(TEST_ARWEAVE_GATEWAY))).toBe(false);
    expect(calledUrls.some((url) => url.includes('/raw/ar-io-no-tx-data'))).toBe(false);
    expect(calledUrls.some((url) => url.includes('/tx/ar-io-no-tx-data/data'))).toBe(false);
  });
});
