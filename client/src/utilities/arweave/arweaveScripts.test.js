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
const TEST_IRYS_GATEWAY = 'https://gateway-irys.example.test';
const PERMAGATE_GRAPHQL_URL = 'https://permagate.io/graphql'; // intentional: real URL - verifies production GraphQL precheck routing
const G8WAY_GRAPHQL_URL = 'https://g8way.io/graphql'; // intentional: real URL - verifies production GraphQL fallback routing

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
    try { delete globalThis.__CE_ARWEAVE_UPLOAD_FALLBACK__; } catch (_) {}
    try { delete globalThis.CE_ARWEAVE_GATEWAYS; } catch (_) {}
    try { delete globalThis.CE_ARWEAVE_GATEWAY_URL; } catch (_) {}
    try { delete globalThis.CE_ARWEAVE_AR_IO_URL; } catch (_) {}
  });

  afterEach(() => {
    jest.clearAllMocks();
    try { delete globalThis.CE_ARWEAVE_GATEWAYS; } catch (_) {}
    try { delete globalThis.CE_ARWEAVE_GATEWAY_URL; } catch (_) {}
    try { delete globalThis.CE_ARWEAVE_AR_IO_URL; } catch (_) {}
    try { delete globalThis.CE_ARWEAVE_DIRECT_TO_AR_IO; } catch (_) {}
    try { delete globalThis.CE_ARWEAVE_PREFLIGHT_SESSION_METADATA; } catch (_) {}
    try { delete globalThis.CE_ARWEAVE_PREFLIGHT_SBT_METADATA; } catch (_) {}
    try { delete globalThis.CE_ARWEAVE_PREFLIGHT_RESPONSE_PAYLOADS; } catch (_) {}
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
      })
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
      })
    ).rejects.toMatchObject({
      name: 'ArweaveFetchError',
      status: 404,
      kind: 'not_found',
    });

    await expect(
      arweaveScripts.downloadDataFromArweave(txId, {
        gateways: [TEST_ARWEAVE_GATEWAY],
        retries: 0,
      })
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
      nowSpy.mockReturnValue(realNow + (3 * 24 * 60 * 60 * 1000));
      await expect(
        arweaveScripts.downloadDataFromArweave(txId, {
          gateways: [TEST_ARWEAVE_GATEWAY],
          retries: 0,
        })
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
      })
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
      })
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
      })
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
      })
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
      })
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

  it('honors preflightTxExistence=false and skips graphql precheck even for response payload categories', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '{"ok":true}',
    });

    const text = await arweaveScripts.downloadDataFromArweave('skip-preflight-explicit', {
      gateways: [TEST_ARWEAVE_GATEWAY],
      retries: 0,
      bypassCache: true,
      preflightTxExistence: false,
      debugContext: { category: 'question_response_payload' },
    });

    expect(text).toBe('{"ok":true}');
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const calledUrl = String(global.fetch.mock.calls[0]?.[0] || '');
    expect(calledUrl).not.toContain('/graphql');
  });

  it('skips graphql precheck by default for session metadata reads and goes straight to the gateway', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '{"session":"ok"}',
    });

    const text = await arweaveScripts.downloadDataFromArweave('session-meta-no-preflight', {
      gateways: [TEST_ARWEAVE_GATEWAY],
      retries: 0,
      bypassCache: true,
      debugContext: { category: 'session_registry_metadata' },
    });

    expect(text).toBe('{"session":"ok"}');
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(String(global.fetch.mock.calls[0]?.[0] || '')).not.toContain('/graphql');
  });

  it('honors runtime overrides that enable session-metadata GraphQL precheck', async () => {
    globalThis.CE_ARWEAVE_PREFLIGHT_SESSION_METADATA = true;
    global.fetch.mockResolvedValueOnce(jsonResp(200, {
      data: { transactions: { edges: [] } },
    }));

    await expect(
      arweaveScripts.downloadDataFromArweave('session-meta-with-preflight', {
        gateways: [TEST_ARWEAVE_GATEWAY],
        retries: 0,
        bypassCache: true,
        debugContext: { category: 'session_registry_metadata' },
      })
    ).rejects.toMatchObject({
      name: 'ArweaveFetchError',
      status: 404,
      kind: 'not_found',
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(String(global.fetch.mock.calls[0]?.[0] || '')).toBe('https://permagate.io/graphql');
  });

  it('skips graphql precheck by default for sbt metadata reads and goes straight to the gateway', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '{"name":"badge"}',
    });

    const text = await arweaveScripts.downloadDataFromArweave('sbt-meta-no-preflight', {
      gateways: [TEST_ARWEAVE_GATEWAY],
      retries: 0,
      bypassCache: true,
      debugContext: { category: 'sbt_metadata' },
    });

    expect(text).toBe('{"name":"badge"}');
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(String(global.fetch.mock.calls[0]?.[0] || '')).not.toContain('/graphql');
  });

  it('honors runtime overrides that disable response-payload GraphQL precheck', async () => {
    globalThis.CE_ARWEAVE_PREFLIGHT_RESPONSE_PAYLOADS = false;
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '{"response":"ok"}',
    });

    const text = await arweaveScripts.downloadDataFromArweave('response-meta-no-preflight', {
      gateways: [TEST_ARWEAVE_GATEWAY],
      retries: 0,
      bypassCache: true,
      debugContext: { category: 'survey_response_payload' },
    });

    expect(text).toBe('{"response":"ok"}');
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(String(global.fetch.mock.calls[0]?.[0] || '')).not.toContain('/graphql');
  });

  it('prefers healthy GraphQL endpoints before legacy arweave.net prechecks', async () => {
    globalThis.CE_ARWEAVE_PREFLIGHT_SBT_METADATA = true;
    global.fetch.mockResolvedValueOnce(jsonResp(200, {
      data: { transactions: { edges: [] } },
    }));

    await expect(
      arweaveScripts.downloadDataFromArweave('graphql-primary-health-check', {
        gateways: [TEST_ARWEAVE_GATEWAY],
        retries: 0,
        bypassCache: true,
        debugContext: { category: 'sbt_metadata' },
      })
    ).rejects.toMatchObject({
      name: 'ArweaveFetchError',
      status: 404,
      kind: 'not_found',
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(String(global.fetch.mock.calls[0]?.[0] || '')).toBe('https://permagate.io/graphql');
  });

  it('falls back to secondary GraphQL endpoints when the primary precheck is unhealthy', async () => {
    globalThis.CE_ARWEAVE_PREFLIGHT_SBT_METADATA = true;
    global.fetch
      .mockResolvedValueOnce({
        ok: false,
        status: 502,
        json: async () => null,
        text: async () => '',
      })
      .mockResolvedValueOnce(jsonResp(200, {
        data: { transactions: { edges: [] } },
      }));

    await expect(
      arweaveScripts.downloadDataFromArweave('graphql-secondary-fallback', {
        gateways: [TEST_ARWEAVE_GATEWAY],
        retries: 0,
        bypassCache: true,
        debugContext: { category: 'sbt_metadata' },
      })
    ).rejects.toMatchObject({
      name: 'ArweaveFetchError',
      status: 404,
      kind: 'not_found',
    });

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(String(global.fetch.mock.calls[0]?.[0] || '')).toBe('https://permagate.io/graphql');
    expect(String(global.fetch.mock.calls[1]?.[0] || '')).toBe('https://g8way.io/graphql');
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

    const text = await arweaveScripts.downloadDataFromArweave(
      `https://example.example.test/ar/${txId}?view=1`,
      {
        gateways: [TEST_ARWEAVE_GATEWAY],
        retries: 0,
        bypassCache: true,
        disableExistencePrecheck: true,
      }
    );

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
      textResp(200, '<!doctype html><html><body><h1>Valid document</h1></body></html>', 'text/html')
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
    expect(wayfinderResolver).toHaveBeenCalledWith(expect.objectContaining({
      txId: 'wayfinder-fallback-hit',
    }));
    expect(global.fetch).toHaveBeenCalledTimes(4);
    const fallbackUrl = String(global.fetch.mock.calls[3]?.[0] || '');
    expect(fallbackUrl).toContain('wf-gateway.example.test');
  });

  it('prefers ar.io direct hits without probing legacy gateways when direct-to-ar.io mode is enabled', async () => {
    globalThis.CE_ARWEAVE_DIRECT_TO_AR_IO = true;
    globalThis.CE_ARWEAVE_AR_IO_URL = TEST_AR_IO_GATEWAY;
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => '{"ok":"ar-io-primary-hit"}',
    });

    const txId = 'ar-io-first-mode';
    const text = await arweaveScripts.downloadDataFromArweave(txId, {
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

  it('does not fall back to legacy gateways after an ar.io html miss', async () => {
    globalThis.CE_ARWEAVE_DIRECT_TO_AR_IO = true;
    globalThis.CE_ARWEAVE_AR_IO_URL = TEST_AR_IO_GATEWAY;
    global.fetch.mockResolvedValueOnce(
      textResp(200, '<html><title>404 - Page not found.</title></html>', 'text/html')
    );

    await expect(
      arweaveScripts.downloadDataFromArweave('ar-io-html-fallback', {
        gateways: [TEST_ARWEAVE_GATEWAY],
        retries: 0,
        bypassCache: true,
        disableExistencePrecheck: true,
        debugContext: { category: 'question_response_payload' },
      })
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

  it('retries only against ar.io when direct-to-ar.io mode is enabled', async () => {
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

    const text = await arweaveScripts.downloadDataFromArweave('ar-io-retry-fallback', {
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

  it('uses short not-found cooldowns for response payload categories', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => '',
    });

    const txId = 'missing-response-cooldown';
    await expect(
      arweaveScripts.downloadDataFromArweave(txId, {
        gateways: [TEST_ARWEAVE_GATEWAY],
        retries: 0,
        disableExistencePrecheck: true,
        debugContext: { category: 'question_response_payload' },
      })
    ).rejects.toMatchObject({
      name: 'ArweaveFetchError',
      status: 404,
      kind: 'not_found',
    });

    let cooldownErr = null;
    try {
      await arweaveScripts.downloadDataFromArweave(txId, {
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
      arweaveScripts.downloadDataFromArweave(txId, {
        gateways: [TEST_ARWEAVE_GATEWAY],
        retries: 0,
        debugContext: { category: 'session_registry_metadata' },
      })
    ).rejects.toMatchObject({
      name: 'ArweaveFetchError',
      status: 404,
      kind: 'not_found',
    });

    let cooldownErr = null;
    try {
      await arweaveScripts.downloadDataFromArweave(txId, {
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

    const exists = await arweaveScripts.checkTxExists('sbt-image-no-preflight', {
      debugContext: { category: 'sbt_metadata' },
    });

    expect(exists).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('default routing stays on ar.io only when direct-to-ar.io mode is enabled', async () => {
    globalThis.CE_ARWEAVE_DIRECT_TO_AR_IO = true;
    globalThis.CE_ARWEAVE_AR_IO_URL = TEST_AR_IO_GATEWAY;
    globalThis.CE_ARWEAVE_GATEWAY_URL = TEST_ARWEAVE_GATEWAY;
    global.fetch.mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => '',
    });

    await expect(
      arweaveScripts.downloadDataFromArweave('default-gateway-fanout', {
        retries: 0,
        bypassCache: true,
        disableExistencePrecheck: true,
      })
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

  it('skips /raw and /tx-data probes while staying on ar.io in direct-to-ar.io mode', async () => {
    globalThis.CE_ARWEAVE_DIRECT_TO_AR_IO = true;
    globalThis.CE_ARWEAVE_AR_IO_URL = TEST_AR_IO_GATEWAY;
    global.fetch.mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => '',
    });

    await expect(
      arweaveScripts.downloadDataFromArweave('ar-io-no-tx-data', {
        gateways: [TEST_ARWEAVE_GATEWAY],
        retries: 0,
        bypassCache: true,
        disableExistencePrecheck: true,
        debugContext: { category: 'question_response_payload' },
      })
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

  it('throws typed invalid errors for non-retryable 4xx', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => '',
    });

    await expect(
      arweaveScripts.downloadDataFromArweave('badtx', {
        gateways: [TEST_ARWEAVE_GATEWAY],
        retries: 1,
        bypassCache: true,
      })
    ).rejects.toMatchObject({
      name: 'ArweaveFetchError',
      status: 400,
      kind: 'invalid',
      retryable: false,
      txId: 'badtx',
    });
  });
});

describe('arweaveScripts.uploadDataToArweave fallback routing', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
    readSponsoredBootstrapFundingContext.mockReturnValue(null);
    getSharedFallbackWorkerUrl.mockReturnValue('');
    getCorsProxyUrlOrThrow.mockResolvedValue('https://selected.worker.example');
    resolveCorsProxyUrl.mockImplementation(async ({ sessionSlug }) => {
      const slug = typeof sessionSlug === 'string' ? sessionSlug.trim() : '';
      if (slug === 'open') {
        return {
          url: 'https://open.worker.example',
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
          url: 'https://closed.worker.example',
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
        url: 'https://selected.worker.example',
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
    try { delete globalThis.__CE_ARWEAVE_UPLOAD_FALLBACK__; } catch (_) {}
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('normalizes explicit worker endpoint URLs before upload', async () => {
    fetchWorkerWithAuth.mockResolvedValueOnce(jsonResp(200, { id: 'tx-explicit' }));

    const txId = await arweaveScripts.uploadDataToArweave({ ok: true }, 'json', {
      sessionSlug: 'selected',
      workerUrl: 'https://selected.worker.example/arweave/upload',
    });

    expect(txId).toBe('tx-explicit');
    expect(fetchWorkerWithAuth).toHaveBeenCalledTimes(1);
    expect(String(fetchWorkerWithAuth.mock.calls[0][0])).toBe('https://selected.worker.example/arweave/upload');
  });

  it('normalizes arweave gateway URLs in worker upload responses to canonical tx ids', async () => {
    const txId = 'A'.repeat(43);
    fetchWorkerWithAuth.mockResolvedValueOnce(jsonResp(200, {
      arweaveUrl: `https://6u77seaxyzspwemhcmx6djbkshkhjdp5npbrwsvvzgqqyjwycuqq.arweave.net/${txId}`,
    }));

    const result = await arweaveScripts.uploadDataToArweave({ ok: true }, 'json', {
      sessionSlug: 'selected',
      workerUrl: 'https://selected.worker.example/arweave/upload',
    });

    expect(result).toBe(txId);
    expect(fetchWorkerWithAuth).toHaveBeenCalledTimes(1);
    expect(String(fetchWorkerWithAuth.mock.calls[0][0])).toBe('https://selected.worker.example/arweave/upload');
  });

  it('normalizes /tx/<id>/data upload responses to canonical tx ids', async () => {
    const txId = 'B'.repeat(43);
    fetchWorkerWithAuth.mockResolvedValueOnce(jsonResp(200, {
      arweaveUrl: `https://arweave.net/tx/${txId}/data`,
    }));

    const result = await arweaveScripts.uploadDataToArweave({ ok: true }, 'json', {
      sessionSlug: 'selected',
      workerUrl: 'https://selected.worker.example/arweave/upload',
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
    expect(String(fetchWorkerWithAuth.mock.calls[0][0])).toBe('https://selected.worker.example/arweave/upload');
    expect(String(fetchWorkerWithAuth.mock.calls[1][0])).toBe('https://open.worker.example/arweave/upload');
    expect(fetchWorkerWithAuth.mock.calls[1][2]).toEqual(
      expect.objectContaining({ sessionSlug: 'open', workerUrl: 'https://open.worker.example' })
    );

    const telemetry = Array.isArray(globalThis.__CE_ARWEAVE_UPLOAD_FALLBACK__)
      ? globalThis.__CE_ARWEAVE_UPLOAD_FALLBACK__
      : [];
    expect(telemetry).toHaveLength(2);
    expect(telemetry[0]).toEqual(expect.objectContaining({
      sessionSlug: 'selected',
      workerUrl: 'https://selected.worker.example',
      reason: 'selected-session',
      responseStatus: 403,
    }));
    expect(telemetry[1]).toEqual(expect.objectContaining({
      sessionSlug: 'open',
      workerUrl: 'https://open.worker.example',
      reason: 'scope-list',
      responseStatus: 200,
    }));
  });

  it('prefers the sponsored referring session as the first upload fallback before generic scope-list sessions', async () => {
    readSponsoredBootstrapFundingContext.mockReturnValue({
      sessionSlug: 'source-session',
      workerUrl: 'https://source.worker.example',
      targetSessionSlug: 'selected',
    });
    readSessionScanSlugs.mockReturnValue(['open']);
    resolveCorsProxyUrl.mockImplementation(async ({ sessionSlug }) => {
      const slug = typeof sessionSlug === 'string' ? sessionSlug.trim() : '';
      if (slug === 'open') {
        return {
          url: 'https://open.worker.example',
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
        url: 'https://selected.worker.example',
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
    expect(String(fetchWorkerWithAuth.mock.calls[1][0])).toBe('https://source.worker.example/arweave/upload');
    const telemetry = Array.isArray(globalThis.__CE_ARWEAVE_UPLOAD_FALLBACK__)
      ? globalThis.__CE_ARWEAVE_UPLOAD_FALLBACK__
      : [];
    expect(telemetry[1]).toEqual(expect.objectContaining({
      sessionSlug: 'source-session',
      workerUrl: 'https://source.worker.example',
      reason: 'sponsored-referrer',
      responseStatus: 200,
    }));
  });

  it('tries the shared fallback worker before generic scope-list sessions', async () => {
    getSharedFallbackWorkerUrl.mockReturnValue('https://shared.worker.example');
    readSessionScanSlugs.mockReturnValue(['open']);
    resolveCorsProxyUrl.mockImplementation(async ({ sessionSlug }) => {
      const slug = typeof sessionSlug === 'string' ? sessionSlug.trim() : '';
      if (slug === '') {
        return {
          url: 'https://shared.worker.example',
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
          url: 'https://open.worker.example',
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
        url: 'https://selected.worker.example',
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
    expect(String(fetchWorkerWithAuth.mock.calls[1][0])).toBe('https://shared.worker.example/arweave/upload');
  });

  it('falls back to scoped worker candidates when the selected worker does not support auth routes', async () => {
    readSessionScanSlugs.mockReturnValue(['supported', 'open']);
    resolveCorsProxyUrl.mockImplementation(async ({ sessionSlug }) => {
      const slug = typeof sessionSlug === 'string' ? sessionSlug.trim() : '';
      if (slug === 'supported') {
        return {
          url: 'https://supported.worker.example',
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
          url: 'https://open.worker.example',
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
        url: 'https://selected.worker.example',
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
      .mockRejectedValueOnce(new Error('Worker auth login route not supported (404).'))
      .mockResolvedValueOnce(jsonResp(200, { id: 'tx-supported' }));

    const txId = await arweaveScripts.uploadDataToArweave({ ok: true }, 'json', {
      sessionSlug: 'selected',
    });

    expect(txId).toBe('tx-supported');
    expect(fetchWorkerWithAuth).toHaveBeenCalledTimes(2);
    expect(String(fetchWorkerWithAuth.mock.calls[0][0])).toBe('https://selected.worker.example/arweave/upload');
    expect(String(fetchWorkerWithAuth.mock.calls[1][0])).toBe('https://supported.worker.example/arweave/upload');
    expect(fetchWorkerWithAuth.mock.calls[1][2]).toEqual(
      expect.objectContaining({ sessionSlug: 'supported', workerUrl: 'https://supported.worker.example' })
    );
  });

  it('prefers scoped sessions that advertise sponsored Arweave keys after missing-key upload failures', async () => {
    readSessionScanSlugs.mockReturnValue(['open', 'supported']);
    resolveCorsProxyUrl.mockImplementation(async ({ sessionSlug }) => {
      const slug = typeof sessionSlug === 'string' ? sessionSlug.trim() : '';
      if (slug === 'open') {
        return {
          url: 'https://open.worker.example',
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
          url: 'https://supported.worker.example',
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
        url: 'https://selected.worker.example',
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
    expect(String(fetchWorkerWithAuth.mock.calls[1][0])).toBe('https://supported.worker.example/arweave/upload');
    expect(
      fetchWorkerWithAuth.mock.calls.some((call) => String(call?.[0] || '').includes('https://open.worker.example/arweave/upload'))
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
    expect(String(fetchWorkerWithAuth.mock.calls[1]?.[0] || '')).toBe('https://selected.worker.example/arweave/upload');
    expect(fetchWorkerWithAuth.mock.calls[1]?.[1]).toEqual(expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }));
    const requestBody = JSON.parse(String(fetchWorkerWithAuth.mock.calls[1]?.[1]?.body || '{}'));
    expect(requestBody).toEqual(expect.objectContaining({
      arweaveJwk: '{"kty":"RSA"}',
      sessionSlug: 'selected',
    }));
    expect(requestBody).not.toHaveProperty(['group', 'Slug'].join(''));
    expect(fetchWorkerWithAuth.mock.calls[1]?.[2]).toEqual(
      expect.objectContaining({ sessionSlug: 'selected', workerUrl: 'https://selected.worker.example' })
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
      expect(Arweave.init).toHaveBeenCalledWith(expect.objectContaining({
        host: 'arweave.net',
        port: 443,
        protocol: 'https',
        logging: false,
      }));
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
        workerUrl: 'https://selected.worker.example',
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
      })
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
      })
    ).rejects.toThrow('worker fallback exhausted');

    expect(fetchWorkerWithAuth).toHaveBeenCalledTimes(2);
  });

  it('does not invoke scoped fallback candidates when initial upload fails for non-gate errors', async () => {
    readSessionScanSlugs.mockReturnValue(['open']);
    fetchWorkerWithAuth.mockResolvedValueOnce(jsonResp(500, { error: 'Internal worker error.' }));

    await expect(
      arweaveScripts.uploadDataToArweave({ ok: true }, 'json', {
        sessionSlug: 'selected',
      })
    ).rejects.toThrow('Internal worker error.');

    expect(fetchWorkerWithAuth).toHaveBeenCalledTimes(1);
    expect(String(fetchWorkerWithAuth.mock.calls[0][0])).toBe('https://selected.worker.example/arweave/upload');
  });

  it('retries transient worker pricing failures on the same candidate before failing the upload', async () => {
    fetchWorkerWithAuth
      .mockResolvedValueOnce(jsonResp(500, { error: 'Could not getPrice. Received: error code: 502. Status: 502, Bad Gateway' }))
      .mockResolvedValueOnce(jsonResp(200, { id: 'tx-after-retry' }));

    const txId = await arweaveScripts.uploadDataToArweave({ ok: true }, 'json', {
      sessionSlug: 'selected',
    });

    expect(txId).toBe('tx-after-retry');
    expect(fetchWorkerWithAuth).toHaveBeenCalledTimes(2);
    expect(String(fetchWorkerWithAuth.mock.calls[0][0])).toBe('https://selected.worker.example/arweave/upload');
    expect(String(fetchWorkerWithAuth.mock.calls[1][0])).toBe('https://selected.worker.example/arweave/upload');
  });
});
