import {
  listSessionStorageRefsPage,
  readSessionStorageBlob,
  uploadDataToSessionStorage,
} from './storageClient.js';

jest.mock('../arweave/arweaveClient.js', () => ({
  arweaveClient: {
    uploadDataToArweave: jest.fn(),
    buildArweaveGatewayUrl: jest.fn((id) => `https://arweave.net/${id}`),
  },
}));

jest.mock('../worker/corsProxy.js', () => ({
  getCorsProxyUrlOrThrow: jest.fn(),
}));

jest.mock('../worker/workerAuth.js', () => ({
  fetchWorkerWithAuth: jest.fn(),
}));

const { arweaveClient } = require('../arweave/arweaveClient.js');
const { getCorsProxyUrlOrThrow } = require('../worker/corsProxy.js');
const { fetchWorkerWithAuth } = require('../worker/workerAuth.js');

const TX_ID = 'abc123abc123abc123abc123abc123abc123abc1230';

describe('storageClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    arweaveClient.uploadDataToArweave.mockResolvedValue(TX_ID);
    getCorsProxyUrlOrThrow.mockResolvedValue('https://worker.example');
    fetchWorkerWithAuth.mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'cf_01j7safeopaqueid',
          storageRef: {
            backend: 'cloudflare',
            id: 'cf_01j7safeopaqueid',
            uri: '/storage/read?id=cf_01j7safeopaqueid',
            contentType: 'application/json',
            resource: 'docsContext',
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
  });

  test('keeps default Arweave upload path unchanged', async () => {
    const result = await uploadDataToSessionStorage({ ok: true }, 'json', {
      sessionSlug: 'alpha',
      sessionConfig: {},
      tags: [{ name: 'CE-DocStorage', value: 'arweave' }],
    });

    expect(arweaveClient.uploadDataToArweave).toHaveBeenCalledWith(
      { ok: true },
      'json',
      expect.objectContaining({ sessionSlug: 'alpha' }),
    );
    expect(fetchWorkerWithAuth).not.toHaveBeenCalled();
    expect(result.storageRef).toEqual({ backend: 'arweave', id: TX_ID, uri: `ar://${TX_ID}`, resource: 'docsContext' });
  });

  test('keeps lit-arweave available for encrypted payload storage refs', async () => {
    const result = await uploadDataToSessionStorage({ envelope: true }, 'json', {
      sessionSlug: 'alpha',
      sessionConfig: { storageProfile: { backend: 'lit-arweave' } },
      encrypted: true,
    });

    expect(arweaveClient.uploadDataToArweave).toHaveBeenCalledTimes(1);
    expect(result.storageRef).toEqual({
      backend: 'lit-arweave',
      id: TX_ID,
      uri: `lit-arweave://${TX_ID}`,
      encrypted: true,
      resource: 'docsContext',
    });
  });

  test('routes Cloudflare uploads through storage endpoint without exposing raw identifiers', async () => {
    const result = await uploadDataToSessionStorage({ ok: true }, 'json', {
      sessionSlug: 'alpha',
      sessionConfig: { storageProfile: { backend: 'cloudflare' } },
      context: { account: '0xabc' },
      tags: [{ name: 'CE-DocStorage', value: 'cloudflare' }],
    });

    expect(arweaveClient.uploadDataToArweave).not.toHaveBeenCalled();
    expect(fetchWorkerWithAuth).toHaveBeenCalledTimes(1);
    expect(String(fetchWorkerWithAuth.mock.calls[0][0])).toBe('https://worker.example/storage/upload');
    expect(JSON.parse(fetchWorkerWithAuth.mock.calls[0][1].body)).toEqual(
      expect.objectContaining({
        backend: 'cloudflare',
        resource: 'docsContext',
      }),
    );
    expect(JSON.stringify(result)).not.toMatch(/account|bucket|token|secret|r2:\/\//i);
    expect(result.storageRef.backend).toBe('cloudflare');
  });

  test('rejects plaintext uploads when Cloudflare lit_encrypted mode is selected', async () => {
    await expect(
      uploadDataToSessionStorage({ ok: true }, 'json', {
        sessionSlug: 'alpha',
        sessionConfig: {
          storageProfile: {
            backend: 'cloudflare',
            payloadAccessControl: { mode: 'lit_encrypted' },
          },
        },
      }),
    ).rejects.toThrow(/pre-encrypted payload/i);

    expect(fetchWorkerWithAuth).not.toHaveBeenCalled();
  });

  test('tries anonymous-first Cloudflare reads so public sessions do not prompt for wallet auth', async () => {
    fetchWorkerWithAuth.mockResolvedValueOnce(
      new Response('payload', {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      }),
    );

    const response = await readSessionStorageBlob({
      storageRef: { backend: 'cloudflare', id: 'cf_01j7safeopaqueid' },
      sessionSlug: 'alpha',
      sessionConfig: { storageProfile: { backend: 'cloudflare', payloadAccessControl: { mode: 'public_read' } } },
    });

    expect(await response.text()).toBe('payload');
    expect(fetchWorkerWithAuth).toHaveBeenCalledWith(
      'https://worker.example/storage/read?id=cf_01j7safeopaqueid',
      { method: 'GET' },
      expect.objectContaining({ preferAnonymous: true }),
    );
  });

  test('tries anonymous-first Cloudflare lists and leaves gated fallback to worker auth', async () => {
    fetchWorkerWithAuth.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          items: [{ storageRef: { backend: 'cloudflare', id: 'cf_ref' } }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const page = await listSessionStorageRefsPage({
      sessionSlug: 'alpha',
      sessionConfig: { storageProfile: { backend: 'cloudflare' } },
      resource: 'questions',
    });

    expect(page.items).toHaveLength(1);
    expect(page.listComplete).toBe(true);
    expect(fetchWorkerWithAuth).toHaveBeenCalledWith(
      'https://worker.example/storage/list?resource=questions',
      { method: 'GET' },
      expect.objectContaining({ preferAnonymous: true }),
    );
  });

  test('propagates Cloudflare list cursors through the typed page helper', async () => {
    fetchWorkerWithAuth
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ items: [], cursor: 'page-two', listComplete: false }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [{ storageRef: { backend: 'cloudflare', id: 'cf_page_two' } }],
            cursor: null,
            listComplete: true,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

    const firstPage = await listSessionStorageRefsPage({
      sessionSlug: 'alpha',
      sessionConfig: { storageProfile: { backend: 'cloudflare' } },
      resource: 'questions',
      limit: 25,
    });
    const secondPage = await listSessionStorageRefsPage({
      sessionSlug: 'alpha',
      sessionConfig: { storageProfile: { backend: 'cloudflare' } },
      resource: 'questions',
      cursor: firstPage.cursor,
      limit: 25,
    });

    expect(firstPage).toEqual({ items: [], cursor: 'page-two', listComplete: false });
    expect(secondPage).toEqual({
      items: [{ storageRef: { backend: 'cloudflare', id: 'cf_page_two' } }],
      cursor: null,
      listComplete: true,
    });
    expect(fetchWorkerWithAuth.mock.calls.map(([url]) => url)).toEqual([
      'https://worker.example/storage/list?resource=questions&limit=25',
      'https://worker.example/storage/list?resource=questions&cursor=page-two&limit=25',
    ]);
  });
});
