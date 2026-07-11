import { resolveCorsProxyUrl } from './corsProxy.js';
import { readWorkerResourcePresence } from './workerResourcePresence';

jest.mock('./corsProxy.js', () => ({
  resolveCorsProxyUrl: jest.fn(),
}));

const mockedResolveCorsProxyUrl = jest.mocked(resolveCorsProxyUrl);
let workerSequence = 0;
let workerUrl = '';

describe('workerResourcePresence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    workerSequence += 1;
    workerUrl = `https://worker-${workerSequence}.example.test`;
    mockedResolveCorsProxyUrl.mockResolvedValue({ url: workerUrl });
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
      `${workerUrl}/resource-presence`,
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
      `${workerUrl}/resource-presence`,
      expect.objectContaining({ headers: { 'X-Session-Slug': 'general' } }),
    );
  });
});
