/** @file arweaveClient.failurePolicy.test.js */
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

const TEST_ARWEAVE_GATEWAY = 'https://arweave.example.test';

describe('arweaveClient failure policy', () => {
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

  it('uses short not-found cooldowns for response payload categories', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => '',
    });

    const txId = 'missing-response-cooldown';
    await expect(
      arweaveClient.downloadDataFromArweave(txId, {
        gateways: [TEST_ARWEAVE_GATEWAY],
        retries: 0,
        disableExistencePrecheck: true,
        debugContext: { category: 'question_response_payload' },
      }),
    ).rejects.toMatchObject({
      name: 'ArweaveFetchError',
      status: 404,
      kind: 'not_found',
    });

    let cooldownErr = null;
    try {
      await arweaveClient.downloadDataFromArweave(txId, {
        gateways: [TEST_ARWEAVE_GATEWAY],
        retries: 0,
        disableExistencePrecheck: true,
        debugContext: { category: 'question_response_payload' },
      });
    } catch (err) {
      cooldownErr = err;
    }

    expect(cooldownErr).toBeTruthy();
    const remainingMs = Number(cooldownErr?.nextRetryAtMs || 0) - Date.now();
    expect(remainingMs).toBeGreaterThan(1000);
    expect(remainingMs).toBeLessThan(60 * 1000);
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('uses short not-found cooldowns for gateway-first session metadata categories', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => '',
    });

    const txId = 'missing-session-metadata-cooldown';
    await expect(
      arweaveClient.downloadDataFromArweave(txId, {
        gateways: [TEST_ARWEAVE_GATEWAY],
        retries: 0,
        debugContext: { category: 'session_registry_metadata' },
      }),
    ).rejects.toMatchObject({
      name: 'ArweaveFetchError',
      status: 404,
      kind: 'not_found',
    });

    let cooldownErr = null;
    try {
      await arweaveClient.downloadDataFromArweave(txId, {
        gateways: [TEST_ARWEAVE_GATEWAY],
        retries: 0,
        debugContext: { category: 'session_registry_metadata' },
      });
    } catch (err) {
      cooldownErr = err;
    }

    expect(cooldownErr).toBeTruthy();
    const remainingMs = Number(cooldownErr?.nextRetryAtMs || 0) - Date.now();
    expect(remainingMs).toBeGreaterThan(1000);
    expect(remainingMs).toBeLessThan(60 * 1000);
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('skips GraphQL existence checks when SBT metadata preflight is disabled', async () => {
    globalThis.CE_ARWEAVE_PREFLIGHT_SBT_METADATA = false;

    const exists = await arweaveClient.checkTxExists('sbt-image-no-preflight', {
      debugContext: { category: 'sbt_metadata' },
    });

    expect(exists).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('throws typed invalid errors for non-retryable 4xx', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => '',
    });

    await expect(
      arweaveClient.downloadDataFromArweave('badtx', {
        gateways: [TEST_ARWEAVE_GATEWAY],
        retries: 1,
        bypassCache: true,
      }),
    ).rejects.toMatchObject({
      name: 'ArweaveFetchError',
      status: 400,
      kind: 'invalid',
      retryable: false,
      txId: 'badtx',
    });
  });
});
