/** @file arweaveScripts.test.js */
import { fetchWorkerWithAuth } from '../worker/workerAuth.js';
import { getCorsProxyUrlOrThrow, resolveCorsProxyUrl } from '../worker/corsProxy.js';
import { readSessionScanSlugs } from '../session/sessionScanScope.js';
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
const TEST_ARWEAVE_BACKUP_GATEWAY = 'https://arweave-backup.example.test';
const TEST_AR_IO_GATEWAY = 'https://unit.ar-io.dev'; // intentional: real URL - verifies AR.IO gateway override handling

describe('arweaveScripts.downloadDataFromArweave', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
    globalThis.CE_ARWEAVE_DIRECT_TO_AR_IO = false;
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

  it('returns text and reuses in-memory cache', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '{"ok":true}',
    });

    const txId = 'abc123';
    const first = await arweaveScripts.downloadDataFromArweave(txId, {
      gateways: [TEST_ARWEAVE_GATEWAY],
      retries: 0,
    });
    const second = await arweaveScripts.downloadDataFromArweave(txId, {
      gateways: [TEST_ARWEAVE_GATEWAY],
      retries: 0,
    });

    expect(first).toBe('{"ok":true}');
    expect(second).toBe('{"ok":true}');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('throws typed not_found errors for 404', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => '',
    });

    await expect(
      arweaveScripts.downloadDataFromArweave('missingtx', {
        gateways: [TEST_ARWEAVE_GATEWAY],
        retries: 0,
        bypassCache: true,
      }),
    ).rejects.toMatchObject({
      name: 'ArweaveFetchError',
      status: 404,
      kind: 'not_found',
      retryable: true,
      txId: 'missingtx',
    });
  });

  it('memoizes missing tx failures and avoids immediate refetch loops', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => '',
    });

    const txId = 'missingtx-cooldown';
    await expect(
      arweaveScripts.downloadDataFromArweave(txId, {
        gateways: [TEST_ARWEAVE_GATEWAY],
        retries: 0,
      }),
    ).rejects.toMatchObject({
      name: 'ArweaveFetchError',
      status: 404,
      kind: 'not_found',
    });

    await expect(
      arweaveScripts.downloadDataFromArweave(txId, {
        gateways: [TEST_ARWEAVE_GATEWAY],
        retries: 0,
      }),
    ).rejects.toMatchObject({
      name: 'ArweaveFetchError',
      status: 404,
      kind: 'not_found',
    });

    // First miss probes /tx/.../data + direct + raw for the same gateway; second call is cooldown-hit.
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('ignores corrupted far-future failure cooldown entries', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => '',
    });

    const txId = 'missingtx-corrupted-cooldown';
    const realNow = Date.now();
    const nowSpy = jest.spyOn(Date, 'now');

    try {
      nowSpy.mockReturnValue(realNow + 3 * 24 * 60 * 60 * 1000);
      await expect(
        arweaveScripts.downloadDataFromArweave(txId, {
          gateways: [TEST_ARWEAVE_GATEWAY],
          retries: 0,
        }),
      ).rejects.toMatchObject({
        name: 'ArweaveFetchError',
        status: 404,
        kind: 'not_found',
      });
    } finally {
      nowSpy.mockRestore();
    }

    let err = null;
    try {
      await arweaveScripts.downloadDataFromArweave(txId, {
        gateways: [TEST_ARWEAVE_GATEWAY],
        retries: 0,
      });
    } catch (caught) {
      err = caught;
    }

    expect(err).toMatchObject({
      name: 'ArweaveFetchError',
      status: 404,
      kind: 'not_found',
    });
    expect(Number(err?.nextRetryAtMs || 0) - Date.now()).toBeLessThan(24 * 60 * 60 * 1000);
    // A poisoned far-future cooldown should be cleared, forcing a real refetch.
    expect(global.fetch).toHaveBeenCalledTimes(6);
  });

  it('allows explicit failure-cache bypass for manual rechecks', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => '',
    });

    const txId = 'missingtx-bypass';
    await expect(
      arweaveScripts.downloadDataFromArweave(txId, {
        gateways: [TEST_ARWEAVE_GATEWAY],
        retries: 0,
      }),
    ).rejects.toMatchObject({
      name: 'ArweaveFetchError',
      status: 404,
      kind: 'not_found',
    });

    await expect(
      arweaveScripts.downloadDataFromArweave(txId, {
        gateways: [TEST_ARWEAVE_GATEWAY],
        retries: 0,
        bypassFailureCache: true,
      }),
    ).rejects.toMatchObject({
      name: 'ArweaveFetchError',
      status: 404,
      kind: 'not_found',
    });

    // Each explicit recheck probes /tx/.../data + direct + raw.
    expect(global.fetch).toHaveBeenCalledTimes(6);
  });

  it('does not repeat full retry loops when all gateways return 404', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => '',
    });

    await expect(
      arweaveScripts.downloadDataFromArweave('missingtx2', {
        gateways: [TEST_ARWEAVE_GATEWAY, TEST_ARWEAVE_BACKUP_GATEWAY],
        retries: 3,
        bypassCache: true,
      }),
    ).rejects.toMatchObject({
      name: 'ArweaveFetchError',
      status: 404,
      kind: 'not_found',
    });

    // One pass across gateways (including /tx/.../data + direct + raw route variants), then stop.
    expect(global.fetch).toHaveBeenCalledTimes(6);
  });

  it('fans out metadata 404s across gateways before classifying not_found', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => '',
    });

    await expect(
      arweaveScripts.downloadDataFromArweave('missingtx-question-metadata', {
        gateways: [TEST_ARWEAVE_GATEWAY, TEST_ARWEAVE_BACKUP_GATEWAY, TEST_AR_IO_GATEWAY],
        retries: 3,
        bypassCache: true,
        disableExistencePrecheck: true,
        debugContext: { category: 'question_metadata' },
      }),
    ).rejects.toMatchObject({
      name: 'ArweaveFetchError',
      status: 404,
      kind: 'not_found',
    });

    // AR.IO-family gateways now skip the slow /raw and /tx-data legacy probes.
    expect(global.fetch).toHaveBeenCalledTimes(7);
  });

  it('does not downgrade mixed 5xx+404 gateway failures into not_found', async () => {
    global.fetch
      .mockResolvedValueOnce({
        ok: false,
        status: 502,
        text: async () => '',
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => '',
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => '',
      });

    await expect(
      arweaveScripts.downloadDataFromArweave('mixed-gateway-error', {
        gateways: [TEST_ARWEAVE_GATEWAY],
        retries: 0,
        bypassCache: true,
        disableExistencePrecheck: true,
        debugContext: { category: 'question_metadata' },
      }),
    ).rejects.toMatchObject({
      name: 'ArweaveFetchError',
      status: 502,
      kind: 'server',
      retryable: true,
    });

    expect(global.fetch).toHaveBeenCalledTimes(3);
    const firstUrl = String(global.fetch.mock.calls[0]?.[0] || '');
    expect(firstUrl).toContain('/mixed-gateway-error');
    expect(firstUrl).not.toContain('/raw/mixed-gateway-error');
    expect(firstUrl).not.toContain('/tx/mixed-gateway-error/data');
  });

  it('uses runtime fallback gateways when default routing is active', async () => {
    globalThis.CE_ARWEAVE_GATEWAY_URL = 'https://transition-primary.example.test';
    globalThis.CE_ARWEAVE_GATEWAYS = 'https://ario-transition.example.test';
    global.fetch
      .mockResolvedValueOnce({
        ok: false,
        status: 502,
        text: async () => '',
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 502,
        text: async () => '',
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 502,
        text: async () => '',
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => '{"ok":"runtime-fallback-hit"}',
      });

    const text = await arweaveScripts.downloadDataFromArweave('runtime-fallback-tx', {
      retries: 0,
      bypassCache: true,
      disableExistencePrecheck: true,
      debugContext: { category: 'question_metadata' },
    });

    expect(text).toBe('{"ok":"runtime-fallback-hit"}');
    expect(global.fetch).toHaveBeenCalledTimes(4);
    const firstUrl = String(global.fetch.mock.calls[0]?.[0] || '');
    const secondUrl = String(global.fetch.mock.calls[1]?.[0] || '');
    const thirdUrl = String(global.fetch.mock.calls[2]?.[0] || '');
    const fourthUrl = String(global.fetch.mock.calls[3]?.[0] || '');
    expect(firstUrl).toContain('transition-primary.example.test');
    expect(secondUrl).toContain('transition-primary.example.test');
    expect(thirdUrl).toContain('transition-primary.example.test');
    expect(fourthUrl).toContain('ario-transition.example.test');
  });

  it('canonicalizes tx ids from non-gateway URLs when downloading', async () => {
    const txId = 'A'.repeat(43);
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => '{"ok":"canonicalized"}',
    });

    const text = await arweaveScripts.downloadDataFromArweave(`https://example.example.test/ar/${txId}?view=1`, {
      gateways: [TEST_ARWEAVE_GATEWAY],
      retries: 0,
      bypassCache: true,
      disableExistencePrecheck: true,
    });

    expect(text).toBe('{"ok":"canonicalized"}');
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const firstUrl = String(global.fetch.mock.calls[0]?.[0] || '');
    expect(firstUrl).toContain(`/${txId}`);
    expect(firstUrl).not.toContain(`/tx/${txId}/data`);
  });

  it('retries transient gateway failures on later retry rounds', async () => {
    global.fetch
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: async () => '',
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: async () => '',
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: async () => '',
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => '{"ok":"retry-hit"}',
      });

    const txId = 'retryable-roundtrip';
    const text = await arweaveScripts.downloadDataFromArweave(txId, {
      gateways: [TEST_ARWEAVE_GATEWAY],
      retries: 1,
      retryDelayMs: 0,
      bypassCache: true,
      disableExistencePrecheck: true,
      debugContext: { category: 'question_metadata' },
    });

    expect(text).toBe('{"ok":"retry-hit"}');
    expect(global.fetch).toHaveBeenCalledTimes(4);
    const fourthUrl = String(global.fetch.mock.calls[3]?.[0] || '');
    expect(fourthUrl).toContain('/retryable-roundtrip');
    expect(fourthUrl).not.toContain('/raw/retryable-roundtrip');
    expect(fourthUrl).not.toContain('/tx/retryable-roundtrip/data');
  });

  it('tries direct then /raw on the same gateway before cross-gateway fanout', async () => {
    global.fetch
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => '',
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => '{"ok":"fallback-hit"}',
      });

    const txId = 'response-fallback-404';
    const text = await arweaveScripts.downloadDataFromArweave(txId, {
      gateways: [TEST_ARWEAVE_GATEWAY, TEST_ARWEAVE_BACKUP_GATEWAY],
      retries: 0,
      bypassCache: true,
      disableExistencePrecheck: true,
      debugContext: { category: 'question_response_payload' },
    });

    expect(text).toBe('{"ok":"fallback-hit"}');
    expect(global.fetch).toHaveBeenCalledTimes(2);
    const firstUrl = String(global.fetch.mock.calls[0]?.[0] || '');
    const secondUrl = String(global.fetch.mock.calls[1]?.[0] || '');
    expect(firstUrl).toContain('/response-fallback-404');
    expect(firstUrl).not.toContain('/raw/response-fallback-404');
    expect(firstUrl).not.toContain('/tx/response-fallback-404/data');
    expect(secondUrl).toContain('/raw/response-fallback-404');
    expect(firstUrl).toContain(TEST_ARWEAVE_GATEWAY);
    expect(secondUrl).toContain(TEST_ARWEAVE_GATEWAY);
  });

  it('falls back to /raw/<txid> when direct route fails on the same gateway', async () => {
    global.fetch
      .mockResolvedValueOnce({
        ok: false,
        status: 502,
        text: async () => '',
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => '{"ok":"raw-hit"}',
      });

    const txId = 'raw-route-fallback';
    const text = await arweaveScripts.downloadDataFromArweave(txId, {
      gateways: [TEST_ARWEAVE_GATEWAY, TEST_ARWEAVE_BACKUP_GATEWAY],
      retries: 0,
      bypassCache: true,
      disableExistencePrecheck: true,
      debugContext: { category: 'question_response_payload' },
    });

    expect(text).toBe('{"ok":"raw-hit"}');
    expect(global.fetch).toHaveBeenCalledTimes(2);
    const firstUrl = String(global.fetch.mock.calls[0]?.[0] || '');
    const secondUrl = String(global.fetch.mock.calls[1]?.[0] || '');
    expect(firstUrl).toContain('/raw-route-fallback');
    expect(firstUrl).not.toContain('/raw/raw-route-fallback');
    expect(firstUrl).not.toContain('/tx/raw-route-fallback/data');
    expect(secondUrl).toContain('/raw/raw-route-fallback');
    expect(firstUrl).toContain(TEST_ARWEAVE_GATEWAY);
    expect(secondUrl).toContain(TEST_ARWEAVE_GATEWAY);
  });

  it('treats html error pages from 200 responses as retryable gateway failures', async () => {
    global.fetch
      .mockResolvedValueOnce(textResp(200, '<html><title>404 - Page not found.</title></html>', 'text/html'))
      .mockResolvedValueOnce(textResp(200, '{"ok":"html-fallback-hit"}', 'application/json'));

    const txId = 'html-payload-fallback';
    const text = await arweaveScripts.downloadDataFromArweave(txId, {
      gateways: [TEST_ARWEAVE_GATEWAY],
      retries: 0,
      bypassCache: true,
      disableExistencePrecheck: true,
      debugContext: { category: 'survey_metadata' },
    });

    expect(text).toBe('{"ok":"html-fallback-hit"}');
    expect(global.fetch).toHaveBeenCalledTimes(2);
    const firstUrl = String(global.fetch.mock.calls[0]?.[0] || '');
    const secondUrl = String(global.fetch.mock.calls[1]?.[0] || '');
    expect(firstUrl).toContain('/html-payload-fallback');
    expect(firstUrl).not.toContain('/raw/html-payload-fallback');
    expect(secondUrl).toContain('/raw/html-payload-fallback');
  });

  it('returns valid html payloads without treating them as gateway failures', async () => {
    global.fetch.mockResolvedValueOnce(
      textResp(200, '<!doctype html><html><body><h1>Valid document</h1></body></html>', 'text/html'),
    );

    const txId = 'html-document-hit';
    const text = await arweaveScripts.downloadDataFromArweave(txId, {
      gateways: [TEST_ARWEAVE_GATEWAY],
      retries: 0,
      bypassCache: true,
      disableExistencePrecheck: true,
      debugContext: { category: 'doc_library' },
    });

    expect(text).toContain('<h1>Valid document</h1>');
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(String(global.fetch.mock.calls[0]?.[0] || '')).toContain('/html-document-hit');
  });

  it('falls back across routes and gateways when the first gateway keeps returning 502', async () => {
    global.fetch
      .mockResolvedValueOnce({
        ok: false,
        status: 502,
        text: async () => '',
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 502,
        text: async () => '',
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 502,
        text: async () => '',
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => '{"ok":"gateway-fallback-hit"}',
      });

    const text = await arweaveScripts.downloadDataFromArweave('gateway-route-fallback', {
      gateways: [TEST_ARWEAVE_GATEWAY, TEST_ARWEAVE_BACKUP_GATEWAY],
      retries: 0,
      bypassCache: true,
      disableExistencePrecheck: true,
      debugContext: { category: 'question_metadata' },
    });

    expect(text).toBe('{"ok":"gateway-fallback-hit"}');
    expect(global.fetch).toHaveBeenCalledTimes(4);
    const firstUrl = String(global.fetch.mock.calls[0]?.[0] || '');
    const secondUrl = String(global.fetch.mock.calls[1]?.[0] || '');
    const thirdUrl = String(global.fetch.mock.calls[2]?.[0] || '');
    const fourthUrl = String(global.fetch.mock.calls[3]?.[0] || '');
    expect(firstUrl).toContain(TEST_ARWEAVE_GATEWAY);
    expect(secondUrl).toContain(TEST_ARWEAVE_GATEWAY);
    expect(thirdUrl).toContain(TEST_ARWEAVE_GATEWAY);
    expect(fourthUrl).toContain(TEST_ARWEAVE_BACKUP_GATEWAY);
    expect(firstUrl).toContain('/gateway-route-fallback');
    expect(secondUrl).toContain('/raw/gateway-route-fallback');
    expect(thirdUrl).toContain('/tx/gateway-route-fallback/data');
    expect(global.fetch.mock.calls[0]?.[1]).toEqual(expect.objectContaining({ redirect: 'follow' }));
  });

  it('uses wayfinder fallback when all configured gateways fail', async () => {
    const wayfinderResolver = jest.fn(async () => 'https://wf-gateway.example.test/wayfinder-fallback-hit');
    global.fetch
      .mockResolvedValueOnce({
        ok: false,
        status: 502,
        text: async () => '',
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 502,
        text: async () => '',
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 502,
        text: async () => '',
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => '{"ok":"wayfinder-hit"}',
      });

    const text = await arweaveScripts.downloadDataFromArweave('wayfinder-fallback-hit', {
      gateways: [TEST_ARWEAVE_GATEWAY],
      retries: 0,
      bypassCache: true,
      disableExistencePrecheck: true,
      wayfinderResolver,
      debugContext: { category: 'question_metadata' },
    });

    expect(text).toBe('{"ok":"wayfinder-hit"}');
    expect(wayfinderResolver).toHaveBeenCalledWith(
      expect.objectContaining({
        txId: 'wayfinder-fallback-hit',
      }),
    );
    expect(global.fetch).toHaveBeenCalledTimes(4);
    const fallbackUrl = String(global.fetch.mock.calls[3]?.[0] || '');
    expect(fallbackUrl).toContain('wf-gateway.example.test');
  });
});
