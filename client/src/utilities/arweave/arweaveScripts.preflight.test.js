/** @file arweaveScripts.preflight.test.js */
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

const TEST_ARWEAVE_GATEWAY = 'https://arweave.example.test';
const PERMAGATE_GRAPHQL_URL = 'https://permagate.io/graphql'; // intentional: real URL - verifies production GraphQL precheck routing
const G8WAY_GRAPHQL_URL = 'https://g8way.io/graphql'; // intentional: real URL - verifies production GraphQL fallback routing

describe('arweaveScripts.downloadDataFromArweave preflight routing', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
    globalThis.CE_ARWEAVE_DIRECT_TO_AR_IO = false;
    getCorsProxyUrlOrThrow.mockResolvedValue('https://selected.worker.example.test');
    resolveCorsProxyUrl.mockImplementation(async ({ sessionSlug }) => {
      const slug = typeof sessionSlug === 'string' ? sessionSlug.trim() : '';
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
    global.fetch.mockResolvedValueOnce(
      jsonResp(200, {
        data: { transactions: { edges: [] } },
      }),
    );

    await expect(
      arweaveScripts.downloadDataFromArweave('session-meta-with-preflight', {
        gateways: [TEST_ARWEAVE_GATEWAY],
        retries: 0,
        bypassCache: true,
        debugContext: { category: 'session_registry_metadata' },
      }),
    ).rejects.toMatchObject({
      name: 'ArweaveFetchError',
      status: 404,
      kind: 'not_found',
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(String(global.fetch.mock.calls[0]?.[0] || '')).toBe(PERMAGATE_GRAPHQL_URL);
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

  it('prefers healthy GraphQL endpoints before legacy gateway prechecks', async () => {
    globalThis.CE_ARWEAVE_PREFLIGHT_SBT_METADATA = true;
    global.fetch.mockResolvedValueOnce(
      jsonResp(200, {
        data: { transactions: { edges: [] } },
      }),
    );

    await expect(
      arweaveScripts.downloadDataFromArweave('graphql-primary-health-check', {
        gateways: [TEST_ARWEAVE_GATEWAY],
        retries: 0,
        bypassCache: true,
        debugContext: { category: 'sbt_metadata' },
      }),
    ).rejects.toMatchObject({
      name: 'ArweaveFetchError',
      status: 404,
      kind: 'not_found',
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(String(global.fetch.mock.calls[0]?.[0] || '')).toBe(PERMAGATE_GRAPHQL_URL);
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
      .mockResolvedValueOnce(
        jsonResp(200, {
          data: { transactions: { edges: [] } },
        }),
      );

    await expect(
      arweaveScripts.downloadDataFromArweave('graphql-secondary-fallback', {
        gateways: [TEST_ARWEAVE_GATEWAY],
        retries: 0,
        bypassCache: true,
        debugContext: { category: 'sbt_metadata' },
      }),
    ).rejects.toMatchObject({
      name: 'ArweaveFetchError',
      status: 404,
      kind: 'not_found',
    });

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(String(global.fetch.mock.calls[0]?.[0] || '')).toBe(PERMAGATE_GRAPHQL_URL);
    expect(String(global.fetch.mock.calls[1]?.[0] || '')).toBe(G8WAY_GRAPHQL_URL);
  });
});
