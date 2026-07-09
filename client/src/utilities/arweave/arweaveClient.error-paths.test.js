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

jest.mock('../logging', () => ({
  createLogger: () => ({
    log: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

const TX_ID_404 = 'C'.repeat(43);
const TX_ID_TIMEOUT = 'D'.repeat(43);
const TEST_ARWEAVE_GATEWAY = 'https://arweave.example.test';
const TEST_AR_IO_GATEWAY = 'https://unit.ar-io.dev';

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

describe('error paths', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
    globalThis.CE_ARWEAVE_DIRECT_TO_AR_IO = false;
    getCorsProxyUrlOrThrow.mockResolvedValue('https://selected.worker.example');
    resolveCorsProxyUrl.mockImplementation(async ({ sessionSlug }) => ({
      url: `https://${String(sessionSlug || 'selected')}.worker.example`,
      session: {
        slug: String(sessionSlug || 'selected'),
        __registry: {
          gateAuthority: 'onchain',
          gatesByResource: {
            arweave: { lookupStatus: 'ok', sbtAddresses: ['0xabc'] },
          },
        },
      },
    }));
    readSessionScanSlugs.mockReturnValue([]);
    fetchWorkerWithAuth.mockReset();
    try {
      delete globalThis.__CE_ARWEAVE_UPLOAD_FALLBACK__;
    } catch (_) {}
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    try {
      delete globalThis.CE_ARWEAVE_DIRECT_TO_AR_IO;
    } catch (_) {}
    try {
      delete globalThis.__CE_ARWEAVE_UPLOAD_FALLBACK__;
    } catch (_) {}
  });

  it('throws on upload network failures without returning a partial tx id', async () => {
    fetchWorkerWithAuth.mockRejectedValueOnce(new TypeError('network down'));

    await expect(
      arweaveClient.uploadDataToArweave({ ok: true }, 'json', {
        sessionSlug: 'selected',
      }),
    ).rejects.toThrow('Arweave upload network error');

    expect(fetchWorkerWithAuth).toHaveBeenCalledTimes(1);
    expect(globalThis.__CE_ARWEAVE_UPLOAD_FALLBACK__).toEqual([
      expect.objectContaining({
        sessionSlug: 'selected',
        workerUrl: 'https://selected.worker.example',
        responseStatus: null,
      }),
    ]);
  });

  it('throws typed not_found errors for missing Arweave content', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => '',
    });

    await expect(
      arweaveClient.downloadDataFromArweave(TX_ID_404, {
        gateways: [TEST_ARWEAVE_GATEWAY],
        retries: 0,
        bypassCache: true,
        disableExistencePrecheck: true,
      }),
    ).rejects.toMatchObject({
      name: 'ArweaveFetchError',
      status: 404,
      kind: 'not_found',
      retryable: true,
      txId: TX_ID_404,
    });
  });

  it('throws typed network errors for download timeouts instead of caching corrupt data', async () => {
    global.fetch.mockRejectedValue(new Error('gateway timeout'));

    await expect(
      arweaveClient.downloadDataFromArweave(TX_ID_TIMEOUT, {
        gateways: [TEST_ARWEAVE_GATEWAY],
        retries: 0,
        bypassCache: true,
        disableExistencePrecheck: true,
        gatewayTimeoutMs: 100,
      }),
    ).rejects.toMatchObject({
      name: 'ArweaveFetchError',
      kind: 'network',
      retryable: true,
      txId: TX_ID_TIMEOUT,
    });
  });

  it('forces hung gateway fetches to reject on timeout even if the fetch promise never settles', async () => {
    let capturedSignal = null;
    global.fetch.mockImplementation((_url, options = {}) => {
      capturedSignal = options?.signal || null;
      return new Promise(() => {});
    });

    const pending = arweaveClient.downloadDataFromArweave(TX_ID_TIMEOUT, {
      gateways: [TEST_AR_IO_GATEWAY],
      retries: 0,
      bypassCache: true,
      disableExistencePrecheck: true,
      gatewayTimeoutMs: 50,
    });

    await expect(pending).rejects.toMatchObject({
      name: 'ArweaveFetchError',
      kind: 'network',
      retryable: true,
      txId: TX_ID_TIMEOUT,
    });
    expect(capturedSignal?.aborted).toBe(true);
  });

  it('treats malformed upload responses as controlled failures', async () => {
    fetchWorkerWithAuth.mockResolvedValueOnce(jsonResp(200, { ok: true }));

    await expect(
      arweaveClient.uploadDataToArweave({ ok: true }, 'json', {
        sessionSlug: 'selected',
      }),
    ).rejects.toThrow('Arweave upload succeeded but no tx id was returned by worker.');

    expect(fetchWorkerWithAuth).toHaveBeenCalledTimes(1);
    expect(globalThis.__CE_ARWEAVE_UPLOAD_FALLBACK__).toEqual([
      expect.objectContaining({
        sessionSlug: 'selected',
        responseStatus: 200,
      }),
    ]);
  });
});
