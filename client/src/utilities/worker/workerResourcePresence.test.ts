import { resolveCorsProxyUrl } from './corsProxy.js';
import {
  __test__clearWorkerResourcePresenceCache,
  readWorkerResourcePresence,
} from './workerResourcePresence';

jest.mock('./corsProxy.js', () => ({
  resolveCorsProxyUrl: jest.fn(),
}));

const mockedResolveCorsProxyUrl = jest.mocked(resolveCorsProxyUrl);

describe('workerResourcePresence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __test__clearWorkerResourcePresenceCache();
    mockedResolveCorsProxyUrl.mockResolvedValue({ url: 'https://worker.example.test' });
  });

  it('reads resource booleans from the selected session worker without wallet auth', async () => {
    const fetchImpl = jest.fn(async () =>
      new Response(
        JSON.stringify({
          ok: true,
          sessionSlug: 'demo-1',
          resources: { ai: true, arweave: true, rpc: true, txGas: true, secret: 'ignored' },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    ) as unknown as typeof fetch;

    await expect(
      readWorkerResourcePresence({
        sessionSlug: 'demo-1',
        sessionConfig: { slug: 'demo-1' },
        fetchImpl,
      }),
    ).resolves.toEqual({ ai: true, arweave: true, rpc: true, txGas: true });

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://worker.example.test/resource-presence',
      expect.objectContaining({
        method: 'GET',
        headers: { 'X-Session-Slug': 'demo-1' },
      }),
    );
  });

  it('falls back silently when an older worker does not support presence reads', async () => {
    const fetchImpl = jest.fn(async () => new Response('not found', { status: 404 })) as unknown as typeof fetch;

    await expect(readWorkerResourcePresence({ sessionSlug: 'demo-1', fetchImpl })).resolves.toBeNull();
  });

  it('uses the explicit general alias for the default session header', async () => {
    const fetchImpl = jest.fn(async () =>
      new Response(JSON.stringify({ resources: { ai: false, arweave: false, rpc: false, txGas: false } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ) as unknown as typeof fetch;

    await readWorkerResourcePresence({ sessionSlug: '', fetchImpl });

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://worker.example.test/resource-presence',
      expect.objectContaining({ headers: { 'X-Session-Slug': 'general' } }),
    );
  });
});
