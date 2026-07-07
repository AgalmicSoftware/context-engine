/** @file arweaveScripts.resilience.test.js */
import Arweave from 'arweave';
import { fetchWorkerWithAuth } from '../worker/workerAuth.js';
import { getCorsProxyUrlOrThrow, resolveCorsProxyUrl } from '../worker/corsProxy.js';
import { readSessionScanSlugs } from '../session/sessionScanScope.js';
import { readSponsoredBootstrapFundingContext } from '../session/sponsoredBootstrapFunding.js';
import { getSharedFallbackWorkerUrl } from '../session/sessionWorkerAvailability.js';
import { __mockLogger as mockLogger } from '../logging';
import { ARWEAVE_CHUNK_UPLOAD_TIMEOUT_MS, arweaveScripts } from './arweaveScripts.js';

jest.mock('arweave', () => ({
  __esModule: true,
  default: {
    init: jest.fn(),
  },
}));

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

jest.mock('../session/sponsoredBootstrapFunding.js', () => ({
  readSponsoredBootstrapFundingContext: jest.fn(() => null),
}));

jest.mock('../session/sessionWorkerAvailability.js', () => ({
  getSharedFallbackWorkerUrl: jest.fn(() => ''),
}));

jest.mock('../logging', () => {
  const logger = {
    log: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
  return {
    __mockLogger: logger,
    createLogger: jest.fn(() => logger),
  };
});

const TEST_ARWEAVE_GATEWAY = 'https://arweave.example.test';

const flushMicrotasks = async (count = 5) => {
  for (let index = 0; index < count; index += 1) {
    // eslint-disable-next-line no-await-in-loop
    await Promise.resolve();
  }
};

const textResp = (status, textBody = '', contentType = 'text/plain') => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => textBody,
  headers: {
    get: (name) => (String(name || '').toLowerCase() === 'content-type' ? contentType : null),
  },
});

const malformedJsonResp = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => {
    throw new SyntaxError('Unexpected token < in JSON');
  },
  text: async () => body,
  clone: () => ({
    text: async () => body,
  }),
});

describe('arweaveScripts upload/download resilience', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
    globalThis.CE_ARWEAVE_DIRECT_TO_AR_IO = false;
    Arweave.init.mockReset();
    fetchWorkerWithAuth.mockReset();
    getCorsProxyUrlOrThrow.mockResolvedValue('https://selected.worker.example');
    resolveCorsProxyUrl.mockImplementation(async ({ sessionSlug }) => ({
      url: 'https://selected.worker.example',
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
    readSponsoredBootstrapFundingContext.mockReturnValue(null);
    getSharedFallbackWorkerUrl.mockReturnValue('');
    Object.values(mockLogger).forEach((fn) => {
      if (typeof fn?.mockClear === 'function') fn.mockClear();
    });
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
    jest.useRealTimers();
    jest.clearAllMocks();
    try {
      delete globalThis.CE_ARWEAVE_DIRECT_TO_AR_IO;
    } catch (_) {}
  });

  it('rejects hung direct chunk uploads with a retryable timeout error', async () => {
    jest.useFakeTimers();
    const tx = {
      id: 'tx-timeout',
      addTag: jest.fn(),
    };
    const uploadChunk = jest.fn(() => new Promise(() => {}));
    const post = jest.fn().mockResolvedValue({ status: 200 });
    Arweave.init.mockReturnValue({
      createTransaction: jest.fn().mockResolvedValue(tx),
      transactions: {
        sign: jest.fn().mockResolvedValue(undefined),
        getUploader: jest.fn().mockResolvedValue({
          isComplete: false,
          uploadChunk,
        }),
        post,
      },
    });

    const uploadPromise = arweaveScripts.uploadDataToArweave({ ok: true }, 'json', {
      arweaveJwk: '{"kty":"RSA"}',
      forceDirectArweaveUpload: true,
    });
    await flushMicrotasks(20);
    expect(uploadChunk).toHaveBeenCalledTimes(1);

    const assertion = expect(uploadPromise).rejects.toMatchObject({
      code: 'ETIMEDOUT',
      retryable: true,
      kind: 'network',
      timeoutMs: ARWEAVE_CHUNK_UPLOAD_TIMEOUT_MS,
    });
    jest.advanceTimersByTime(ARWEAVE_CHUNK_UPLOAD_TIMEOUT_MS);
    await assertion;
    await expect(uploadPromise).rejects.toThrow('Arweave chunk upload timed out');
    expect(post).not.toHaveBeenCalled();
  });

  it('rejects empty 200 gateway bodies without caching them', async () => {
    const txId = 'empty-body-cache-tx';
    const readOpts = {
      gateways: [TEST_ARWEAVE_GATEWAY],
      retries: 0,
      bypassFailureCache: true,
      disableExistencePrecheck: true,
      includeRawRoute: false,
      includeTxDataRoute: false,
      useWayfinder: false,
    };
    global.fetch
      .mockResolvedValueOnce(textResp(200, '   ', 'application/json'))
      .mockResolvedValueOnce(textResp(200, '{"ok":true}', 'application/json'));

    await expect(arweaveScripts.downloadDataFromArweave(txId, readOpts)).rejects.toMatchObject({
      name: 'ArweaveFetchError',
      kind: 'network',
      retryable: true,
      message: 'Arweave gateway returned empty response body.',
    });

    const retryText = await arweaveScripts.downloadDataFromArweave(txId, readOpts);
    expect(retryText).toBe('{"ok":true}');
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('logs and rejects malformed worker upload JSON responses', async () => {
    const htmlBody = `<html>${'malformed upload response '.repeat(20)}</html>`;
    fetchWorkerWithAuth.mockResolvedValueOnce(malformedJsonResp(200, htmlBody));

    await expect(
      arweaveScripts.uploadDataToArweave({ ok: true }, 'json', {
        sessionSlug: 'selected',
      }),
    ).rejects.toThrow('arweave upload response malformed');

    const parseLog = mockLogger.error.mock.calls.find(
      ([message]) => message === 'arweave upload response parse failed',
    );
    expect(parseLog?.[1]).toEqual(
      expect.objectContaining({
        status: 200,
        bodyPreview: htmlBody.slice(0, 200),
      }),
    );
    expect(parseLog[1].bodyPreview.length).toBeLessThanOrEqual(200);
  });

  it('uses status-aware failure for non-ok malformed worker upload JSON responses', async () => {
    jest.useFakeTimers();
    const htmlBody = `<html>${'transient worker error '.repeat(20)}</html>`;
    fetchWorkerWithAuth.mockResolvedValue(malformedJsonResp(502, htmlBody));

    const uploadPromise = arweaveScripts.uploadDataToArweave({ ok: true }, 'json', {
      sessionSlug: 'selected',
    });
    const assertion = expect(uploadPromise).rejects.toMatchObject({
      message: 'Arweave upload failed (502)',
      status: 502,
    });

    await flushMicrotasks(20);
    jest.advanceTimersByTime(750);
    await flushMicrotasks(20);
    jest.advanceTimersByTime(1500);
    await flushMicrotasks(20);
    await assertion;

    expect(fetchWorkerWithAuth).toHaveBeenCalledTimes(3);
    const parseLog = mockLogger.warn.mock.calls.find(([message]) => message === 'arweave upload response parse failed');
    expect(parseLog?.[1]).toEqual(
      expect.objectContaining({
        status: 502,
        bodyPreview: htmlBody.slice(0, 200),
      }),
    );
    expect(mockLogger.error.mock.calls.some(([message]) => message === 'arweave upload response parse failed')).toBe(
      false,
    );
  });
});
