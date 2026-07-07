/** @file arweaveScripts.uploadFallback.test.js */
import Arweave from 'arweave';
import { fetchWorkerWithAuth } from '../worker/workerAuth.js';
import { getCorsProxyUrlOrThrow, resolveCorsProxyUrl } from '../worker/corsProxy.js';
import { readSessionScanSlugs } from '../session/sessionScanScope.js';
import { readSponsoredBootstrapFundingContext } from '../session/sponsoredBootstrapFunding.js';
import { getSharedFallbackWorkerUrl } from '../session/sessionWorkerAvailability.js';
import { arweaveScripts } from './arweaveScripts.js';

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

describe('arweaveScripts.uploadDataToArweave fallback routing', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
    readSponsoredBootstrapFundingContext.mockReturnValue(null);
    getSharedFallbackWorkerUrl.mockReturnValue('');
    getCorsProxyUrlOrThrow.mockResolvedValue('https://selected.worker.example.test');
    resolveCorsProxyUrl.mockImplementation(async ({ sessionSlug }) => {
      const slug = typeof sessionSlug === 'string' ? sessionSlug.trim() : '';
      if (slug === 'open') {
        return {
          url: 'https://open.worker.example.test',
          session: {
            slug: 'open',
            __registry: {
              gateAuthority: 'onchain',
              gatesByResource: {
                arweave: { lookupStatus: 'ok', sbtAddresses: [] },
              },
            },
          },
        };
      }
      if (slug === 'closed') {
        return {
          url: 'https://closed.worker.example.test',
          session: {
            slug: 'closed',
            __registry: {
              gateAuthority: 'onchain',
              gatesByResource: {
                arweave: { lookupStatus: 'ok', sbtAddresses: ['0xabc'] },
                default: { lookupStatus: 'ok', sbtAddresses: ['0xabc'] },
              },
            },
          },
        };
      }
      return {
        url: 'https://selected.worker.example.test',
        session: {
          slug,
          __registry: {
            gateAuthority: 'onchain',
            gatesByResource: {
              arweave: { lookupStatus: 'ok', sbtAddresses: ['0xabc'] },
            },
          },
        },
      };
    });
    try {
      delete globalThis.__CE_ARWEAVE_UPLOAD_FALLBACK__;
    } catch (_) {}
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('normalizes explicit worker endpoint URLs before upload', async () => {
    fetchWorkerWithAuth.mockResolvedValueOnce(jsonResp(200, { id: 'tx-explicit' }));

    const txId = await arweaveScripts.uploadDataToArweave({ ok: true }, 'json', {
      sessionSlug: 'selected',
      workerUrl: 'https://selected.worker.example.test/arweave/upload',
    });

    expect(txId).toBe('tx-explicit');
    expect(fetchWorkerWithAuth).toHaveBeenCalledTimes(1);
    expect(String(fetchWorkerWithAuth.mock.calls[0][0])).toBe('https://selected.worker.example.test/arweave/upload');
    expect(resolveCorsProxyUrl).not.toHaveBeenCalled();
  });

  it('normalizes arweave gateway URLs in worker upload responses to canonical tx ids', async () => {
    const txId = 'A'.repeat(43);
    const subdomainGateway = 'https://6u77seaxyzspwemhcmx6djbkshkhjdp5npbrwsvvzgqqyjwycuqq.arweave.net'; // intentional: real URL — tests allowlist enforcement
    fetchWorkerWithAuth.mockResolvedValueOnce(
      jsonResp(200, {
        arweaveUrl: `${subdomainGateway}/${txId}`,
      }),
    );

    const result = await arweaveScripts.uploadDataToArweave({ ok: true }, 'json', {
      sessionSlug: 'selected',
      workerUrl: 'https://selected.worker.example.test/arweave/upload',
    });

    expect(result).toBe(txId);
    expect(fetchWorkerWithAuth).toHaveBeenCalledTimes(1);
    expect(String(fetchWorkerWithAuth.mock.calls[0][0])).toBe('https://selected.worker.example.test/arweave/upload');
  });

  it('normalizes /tx/<id>/data upload responses to canonical tx ids', async () => {
    const txId = 'B'.repeat(43);
    const canonicalGateway = 'https://arweave.net'; // intentional: real URL — tests allowlist enforcement
    fetchWorkerWithAuth.mockResolvedValueOnce(
      jsonResp(200, {
        arweaveUrl: `${canonicalGateway}/tx/${txId}/data`,
      }),
    );

    const result = await arweaveScripts.uploadDataToArweave({ ok: true }, 'json', {
      sessionSlug: 'selected',
      workerUrl: 'https://selected.worker.example.test/arweave/upload',
    });

    expect(result).toBe(txId);
    expect(fetchWorkerWithAuth).toHaveBeenCalledTimes(1);
  });

  it('falls back to scoped open-gate worker candidates after gate-unavailable upload errors', async () => {
    readSessionScanSlugs.mockReturnValue(['closed', 'open']);
    fetchWorkerWithAuth
      .mockResolvedValueOnce(jsonResp(403, { error: 'Access denied: on-chain gate data unavailable.' }))
      .mockResolvedValueOnce(jsonResp(200, { id: 'tx-open' }));

    const txId = await arweaveScripts.uploadDataToArweave({ ok: true }, 'json', {
      sessionSlug: 'selected',
    });

    expect(txId).toBe('tx-open');
    expect(fetchWorkerWithAuth).toHaveBeenCalledTimes(2);
    expect(String(fetchWorkerWithAuth.mock.calls[0][0])).toBe('https://selected.worker.example.test/arweave/upload');
    expect(String(fetchWorkerWithAuth.mock.calls[1][0])).toBe('https://open.worker.example.test/arweave/upload');
    expect(fetchWorkerWithAuth.mock.calls[1][2]).toEqual(
      expect.objectContaining({ sessionSlug: 'open', workerUrl: 'https://open.worker.example.test' }),
    );

    const telemetry = Array.isArray(globalThis.__CE_ARWEAVE_UPLOAD_FALLBACK__)
      ? globalThis.__CE_ARWEAVE_UPLOAD_FALLBACK__
      : [];
    expect(telemetry).toHaveLength(2);
    expect(telemetry[0]).toEqual(
      expect.objectContaining({
        sessionSlug: 'selected',
        workerUrl: 'https://selected.worker.example.test',
        reason: 'selected-session',
        responseStatus: 403,
      }),
    );
    expect(telemetry[1]).toEqual(
      expect.objectContaining({
        sessionSlug: 'open',
        workerUrl: 'https://open.worker.example.test',
        reason: 'scope-list',
        responseStatus: 200,
      }),
    );
  });

  it('prefers the sponsored referring session as the first upload fallback before generic scope-list sessions', async () => {
    readSponsoredBootstrapFundingContext.mockReturnValue({
      sessionSlug: 'source-session',
      workerUrl: 'https://source.worker.example.test',
      targetSessionSlug: 'selected',
    });
    readSessionScanSlugs.mockReturnValue(['open']);
    resolveCorsProxyUrl.mockImplementation(async ({ sessionSlug }) => {
      const slug = typeof sessionSlug === 'string' ? sessionSlug.trim() : '';
      if (slug === 'open') {
        return {
          url: 'https://open.worker.example.test',
          session: {
            slug: 'open',
            __registry: {
              gateAuthority: 'onchain',
              gatesByResource: {
                arweave: { lookupStatus: 'ok', sbtAddresses: [] },
              },
            },
          },
        };
      }
      return {
        url: 'https://selected.worker.example.test',
        session: {
          slug,
          __registry: {
            gateAuthority: 'onchain',
            gatesByResource: {
              arweave: { lookupStatus: 'ok', sbtAddresses: ['0xabc'] },
            },
          },
        },
      };
    });
    fetchWorkerWithAuth
      .mockResolvedValueOnce(jsonResp(403, { error: 'Access denied: on-chain gate data unavailable.' }))
      .mockResolvedValueOnce(jsonResp(200, { id: 'tx-source' }));

    const txId = await arweaveScripts.uploadDataToArweave({ ok: true }, 'json', {
      sessionSlug: 'selected',
    });

    expect(txId).toBe('tx-source');
    expect(fetchWorkerWithAuth).toHaveBeenCalledTimes(2);
    expect(String(fetchWorkerWithAuth.mock.calls[1][0])).toBe('https://source.worker.example.test/arweave/upload');
    const telemetry = Array.isArray(globalThis.__CE_ARWEAVE_UPLOAD_FALLBACK__)
      ? globalThis.__CE_ARWEAVE_UPLOAD_FALLBACK__
      : [];
    expect(telemetry[1]).toEqual(
      expect.objectContaining({
        sessionSlug: 'source-session',
        workerUrl: 'https://source.worker.example.test',
        reason: 'sponsored-referrer',
        responseStatus: 200,
      }),
    );
  });

  it('tries the shared fallback worker before generic scope-list sessions', async () => {
    getSharedFallbackWorkerUrl.mockReturnValue('https://shared.worker.example.test');
    readSessionScanSlugs.mockReturnValue(['open']);
    resolveCorsProxyUrl.mockImplementation(async ({ sessionSlug }) => {
      const slug = typeof sessionSlug === 'string' ? sessionSlug.trim() : '';
      if (slug === '') {
        return {
          url: 'https://shared.worker.example.test',
          session: {
            slug: '',
            __registry: {
              gateAuthority: 'onchain',
              gatesByResource: {
                arweave: { lookupStatus: 'ok', sbtAddresses: [] },
              },
            },
          },
        };
      }
      if (slug === 'open') {
        return {
          url: 'https://open.worker.example.test',
          session: {
            slug: 'open',
            __registry: {
              gateAuthority: 'onchain',
              gatesByResource: {
                arweave: { lookupStatus: 'ok', sbtAddresses: [] },
              },
            },
          },
        };
      }
      return {
        url: 'https://selected.worker.example.test',
        session: {
          slug,
          __registry: {
            gateAuthority: 'onchain',
            gatesByResource: {
              arweave: { lookupStatus: 'ok', sbtAddresses: ['0xabc'] },
            },
          },
        },
      };
    });
    fetchWorkerWithAuth
      .mockResolvedValueOnce(jsonResp(403, { error: 'Access denied: on-chain gate data unavailable.' }))
      .mockResolvedValueOnce(jsonResp(200, { id: 'tx-shared' }));

    const txId = await arweaveScripts.uploadDataToArweave({ ok: true }, 'json', {
      sessionSlug: 'selected',
    });

    expect(txId).toBe('tx-shared');
    expect(fetchWorkerWithAuth).toHaveBeenCalledTimes(2);
    expect(String(fetchWorkerWithAuth.mock.calls[1][0])).toBe('https://shared.worker.example.test/arweave/upload');
  });

  it('falls back to scoped worker candidates when the selected worker does not support auth routes', async () => {
    readSessionScanSlugs.mockReturnValue(['supported', 'open']);
    resolveCorsProxyUrl.mockImplementation(async ({ sessionSlug }) => {
      const slug = typeof sessionSlug === 'string' ? sessionSlug.trim() : '';
      if (slug === 'supported') {
        return {
          url: 'https://supported.worker.example.test',
          session: {
            slug: 'supported',
            sponsoredKeys: { arweave: true },
            __registry: {
              gateAuthority: 'onchain',
              gatesByResource: {
                arweave: { lookupStatus: 'ok', sbtAddresses: [] },
              },
            },
          },
        };
      }
      if (slug === 'open') {
        return {
          url: 'https://open.worker.example.test',
          session: {
            slug: 'open',
            __registry: {
              gateAuthority: 'onchain',
              gatesByResource: {
                arweave: { lookupStatus: 'ok', sbtAddresses: [] },
              },
            },
          },
        };
      }
      return {
        url: 'https://selected.worker.example.test',
        session: {
          slug,
          __registry: {
            gateAuthority: 'onchain',
            gatesByResource: {
              arweave: { lookupStatus: 'ok', sbtAddresses: ['0xabc'] },
            },
          },
        },
      };
    });
    const unsupportedAuthRouteError = new Error('Worker auth login route not supported (404).');
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    fetchWorkerWithAuth
      .mockRejectedValueOnce(unsupportedAuthRouteError)
      .mockResolvedValueOnce(jsonResp(200, { id: 'tx-supported' }));

    try {
      const txId = await arweaveScripts.uploadDataToArweave({ ok: true }, 'json', {
        sessionSlug: 'selected',
      });

      expect(txId).toBe('tx-supported');
      expect(fetchWorkerWithAuth).toHaveBeenCalledTimes(2);
      expect(String(fetchWorkerWithAuth.mock.calls[0][0])).toBe('https://selected.worker.example.test/arweave/upload');
      expect(String(fetchWorkerWithAuth.mock.calls[1][0])).toBe('https://supported.worker.example.test/arweave/upload');
      expect(fetchWorkerWithAuth.mock.calls[1][2]).toEqual(
        expect.objectContaining({ sessionSlug: 'supported', workerUrl: 'https://supported.worker.example.test' }),
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[general]',
        '[arweave][client] fetch error',
        expect.objectContaining({
          attemptIndex: 0,
          endpoint: 'https://selected.worker.example.test/arweave/upload',
          message: unsupportedAuthRouteError.message,
          name: 'Error',
          sessionSlug: 'selected',
          workerUrl: 'https://selected.worker.example.test',
        }),
      );
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it('prefers scoped sessions that advertise sponsored Arweave keys after missing-key upload failures', async () => {
    readSessionScanSlugs.mockReturnValue(['open', 'supported']);
    resolveCorsProxyUrl.mockImplementation(async ({ sessionSlug }) => {
      const slug = typeof sessionSlug === 'string' ? sessionSlug.trim() : '';
      if (slug === 'open') {
        return {
          url: 'https://open.worker.example.test',
          session: {
            slug: 'open',
            sponsoredKeys: { arweave: false },
            __registry: {
              gateAuthority: 'onchain',
              gatesByResource: {
                arweave: { lookupStatus: 'ok', sbtAddresses: [] },
              },
            },
          },
        };
      }
      if (slug === 'supported') {
        return {
          url: 'https://supported.worker.example.test',
          session: {
            slug: 'supported',
            sponsoredKeys: { arweave: true },
            __registry: {
              gateAuthority: 'onchain',
              gatesByResource: {
                arweave: { lookupStatus: 'ok', sbtAddresses: [] },
              },
            },
          },
        };
      }
      return {
        url: 'https://selected.worker.example.test',
        session: {
          slug,
          __registry: {
            gateAuthority: 'onchain',
            gatesByResource: {
              arweave: { lookupStatus: 'ok', sbtAddresses: ['0xabc'] },
            },
          },
        },
      };
    });
    fetchWorkerWithAuth
      .mockResolvedValueOnce(jsonResp(403, { error: 'Arweave key not configured in worker.' }))
      .mockResolvedValueOnce(jsonResp(200, { id: 'tx-supported' }));

    const txId = await arweaveScripts.uploadDataToArweave({ ok: true }, 'json', {
      sessionSlug: 'selected',
    });

    expect(txId).toBe('tx-supported');
    expect(fetchWorkerWithAuth).toHaveBeenCalledTimes(2);
    expect(String(fetchWorkerWithAuth.mock.calls[1][0])).toBe('https://supported.worker.example.test/arweave/upload');
    expect(
      fetchWorkerWithAuth.mock.calls.some((call) =>
        String(call?.[0] || '').includes('https://open.worker.example.test/arweave/upload'),
      ),
    ).toBe(false);
  });

  it('retries with an authenticated provided-jwk upload when session secrets are missing', async () => {
    fetchWorkerWithAuth
      .mockResolvedValueOnce(jsonResp(401, { error: 'Session secrets not configured.' }))
      .mockResolvedValueOnce(jsonResp(200, { id: 'tx-bootstrap' }));

    const txId = await arweaveScripts.uploadDataToArweave({ ok: true }, 'json', {
      sessionSlug: 'selected',
      arweaveJwk: '{"kty":"RSA"}',
    });

    expect(txId).toBe('tx-bootstrap');
    expect(fetchWorkerWithAuth).toHaveBeenCalledTimes(2);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(String(fetchWorkerWithAuth.mock.calls[1]?.[0] || '')).toBe(
      'https://selected.worker.example.test/arweave/upload',
    );
    expect(fetchWorkerWithAuth.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const requestBody = JSON.parse(String(fetchWorkerWithAuth.mock.calls[1]?.[1]?.body || '{}'));
    expect(requestBody).toEqual(
      expect.objectContaining({
        arweaveJwk: '{"kty":"RSA"}',
        sessionSlug: 'selected',
      }),
    );
    expect(requestBody).not.toHaveProperty(['group', 'Slug'].join(''));
    expect(fetchWorkerWithAuth.mock.calls[1]?.[2]).toEqual(
      expect.objectContaining({ sessionSlug: 'selected', workerUrl: 'https://selected.worker.example.test' }),
    );
  });

  it('falls back to a direct Arweave upload when authenticated provided-jwk retries still hit missing session secrets', async () => {
    const originalInit = Arweave.init;
    const tx = {
      id: 'tx-direct',
      addTag: jest.fn(),
    };
    const createTransaction = jest.fn().mockResolvedValue(tx);
    const sign = jest.fn().mockResolvedValue(undefined);
    const getUploader = jest.fn().mockRejectedValue(new Error('chunk upload unavailable'));
    const post = jest.fn().mockResolvedValue({ status: 200 });

    fetchWorkerWithAuth
      .mockResolvedValueOnce(jsonResp(401, { error: 'Session secrets not configured.' }))
      .mockResolvedValueOnce(jsonResp(401, { error: 'Session secrets not configured.' }));

    Arweave.init = jest.fn(() => ({
      createTransaction,
      transactions: {
        sign,
        getUploader,
        post,
      },
    }));

    try {
      const txId = await arweaveScripts.uploadDataToArweave({ ok: true }, 'json', {
        sessionSlug: 'selected',
        arweaveJwk: '{"kty":"RSA"}',
      });

      expect(txId).toBe('tx-direct');
      expect(fetchWorkerWithAuth).toHaveBeenCalledTimes(2);
      expect(global.fetch).not.toHaveBeenCalled();
      expect(Arweave.init).toHaveBeenCalledTimes(1);
      expect(Arweave.init).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'arweave.net',
          port: 443,
          protocol: 'https',
          logging: false,
        }),
      );
      expect(createTransaction).toHaveBeenCalledTimes(1);
      const createTxPayload = createTransaction.mock.calls[0]?.[0] || {};
      expect(new TextDecoder().decode(createTxPayload.data)).toBe('{"ok":true}');
      expect(sign).toHaveBeenCalledWith(tx, { kty: 'RSA' });
      expect(post).toHaveBeenCalledWith(tx);
      expect(tx.addTag).toHaveBeenCalledWith('Content-Type', 'application/json');
      expect(tx.addTag).toHaveBeenCalledWith('App-Name', 'ContextEngine');
    } finally {
      Arweave.init = originalInit;
    }
  });

  it('uploads directly when a provided JWK is available but no worker candidates can be resolved', async () => {
    const originalInit = Arweave.init;
    const tx = {
      id: 'tx-direct-no-worker',
      addTag: jest.fn(),
    };
    const createTransaction = jest.fn().mockResolvedValue(tx);
    const sign = jest.fn().mockResolvedValue(undefined);
    const getUploader = jest.fn().mockRejectedValue(new Error('chunk upload unavailable'));
    const post = jest.fn().mockResolvedValue({ status: 200 });

    getCorsProxyUrlOrThrow.mockRejectedValueOnce(new Error('Worker URL is missing for Arweave upload.'));
    resolveCorsProxyUrl.mockResolvedValue(null);

    Arweave.init = jest.fn(() => ({
      createTransaction,
      transactions: {
        sign,
        getUploader,
        post,
      },
    }));

    try {
      const txId = await arweaveScripts.uploadDataToArweave({ ok: true }, 'json', {
        sessionSlug: 'selected',
        arweaveJwk: '{"kty":"RSA"}',
      });

      expect(txId).toBe('tx-direct-no-worker');
      expect(fetchWorkerWithAuth).not.toHaveBeenCalled();
      expect(global.fetch).not.toHaveBeenCalled();
      expect(createTransaction).toHaveBeenCalledTimes(1);
      expect(sign).toHaveBeenCalledWith(tx, { kty: 'RSA' });
      expect(post).toHaveBeenCalledWith(tx);
    } finally {
      Arweave.init = originalInit;
    }
  });

  it('honors forceDirectArweaveUpload when a provided JWK is available even if a worker URL exists', async () => {
    const originalInit = Arweave.init;
    const tx = {
      id: 'tx-direct-forced',
      addTag: jest.fn(),
    };
    const createTransaction = jest.fn().mockResolvedValue(tx);
    const sign = jest.fn().mockResolvedValue(undefined);
    const getUploader = jest.fn().mockRejectedValue(new Error('chunk upload unavailable'));
    const post = jest.fn().mockResolvedValue({ status: 200 });

    Arweave.init = jest.fn(() => ({
      createTransaction,
      transactions: {
        sign,
        getUploader,
        post,
      },
    }));

    try {
      const txId = await arweaveScripts.uploadDataToArweave({ ok: true }, 'json', {
        sessionSlug: 'selected',
        workerUrl: 'https://selected.worker.example.test',
        arweaveJwk: '{"kty":"RSA"}',
        forceDirectArweaveUpload: true,
      });

      expect(txId).toBe('tx-direct-forced');
      expect(fetchWorkerWithAuth).not.toHaveBeenCalled();
      expect(global.fetch).not.toHaveBeenCalled();
      expect(createTransaction).toHaveBeenCalledTimes(1);
      expect(sign).toHaveBeenCalledWith(tx, { kty: 'RSA' });
      expect(post).toHaveBeenCalledWith(tx);
    } finally {
      Arweave.init = originalInit;
    }
  });

  it('fails cleanly when no worker candidates or provided JWK are available for upload', async () => {
    getCorsProxyUrlOrThrow.mockRejectedValueOnce(new Error('Worker URL is missing for Arweave upload.'));
    resolveCorsProxyUrl.mockResolvedValue(null);

    await expect(
      arweaveScripts.uploadDataToArweave({ ok: true }, 'json', {
        sessionSlug: 'selected',
      }),
    ).rejects.toThrow('Worker URL is missing for Arweave upload.');

    expect(fetchWorkerWithAuth).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('throws terminal fallback-exhausted errors after all worker candidates fail', async () => {
    readSessionScanSlugs.mockReturnValue(['open']);
    fetchWorkerWithAuth
      .mockResolvedValueOnce(jsonResp(403, { error: 'Access denied: on-chain gate data unavailable.' }))
      .mockResolvedValueOnce(jsonResp(403, { error: 'Access denied: on-chain gate data unavailable.' }));

    await expect(
      arweaveScripts.uploadDataToArweave({ ok: true }, 'json', {
        sessionSlug: 'selected',
      }),
    ).rejects.toThrow('worker fallback exhausted');

    expect(fetchWorkerWithAuth).toHaveBeenCalledTimes(2);
  });

  it('does not invoke scoped fallback candidates when initial upload fails for non-gate errors', async () => {
    readSessionScanSlugs.mockReturnValue(['open']);
    fetchWorkerWithAuth.mockResolvedValueOnce(jsonResp(500, { error: 'Internal worker error.' }));

    await expect(
      arweaveScripts.uploadDataToArweave({ ok: true }, 'json', {
        sessionSlug: 'selected',
      }),
    ).rejects.toThrow('Internal worker error.');

    expect(fetchWorkerWithAuth).toHaveBeenCalledTimes(1);
    expect(String(fetchWorkerWithAuth.mock.calls[0][0])).toBe('https://selected.worker.example.test/arweave/upload');
  });

  it('retries transient worker pricing failures on the same candidate before failing the upload', async () => {
    fetchWorkerWithAuth
      .mockResolvedValueOnce(
        jsonResp(500, { error: 'Could not getPrice. Received: error code: 502. Status: 502, Bad Gateway' }),
      )
      .mockResolvedValueOnce(jsonResp(200, { id: 'tx-after-retry' }));

    const txId = await arweaveScripts.uploadDataToArweave({ ok: true }, 'json', {
      sessionSlug: 'selected',
    });

    expect(txId).toBe('tx-after-retry');
    expect(fetchWorkerWithAuth).toHaveBeenCalledTimes(2);
    expect(String(fetchWorkerWithAuth.mock.calls[0][0])).toBe('https://selected.worker.example.test/arweave/upload');
    expect(String(fetchWorkerWithAuth.mock.calls[1][0])).toBe('https://selected.worker.example.test/arweave/upload');
  });
});
