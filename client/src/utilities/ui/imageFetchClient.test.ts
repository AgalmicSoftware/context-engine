import { fetchImageFromURL } from './imageFetchClient.js';
import { getCorsProxyUrlOrThrow } from '../worker/corsProxy.js';
import { fetchWorkerWithAuth } from '../worker/workerAuth.js';
import { defaultStrictAllowDemoFallback } from '../worker/workerSessionResolution.js';

jest.mock('../worker/corsProxy.js', () => ({
  getCorsProxyUrlOrThrow: jest.fn(),
}));

jest.mock('../worker/workerAuth.js', () => ({
  fetchWorkerWithAuth: jest.fn(),
}));

jest.mock('../logging.js', () => ({
  createLogger: () => ({
    error: jest.fn(),
    warn: jest.fn(),
    log: jest.fn(),
  }),
}));

describe('imageFetchClient worker auth options', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('cancels the image transport with its caller signal', async () => {
    jest.mocked(getCorsProxyUrlOrThrow).mockResolvedValue('https://worker.example.test');
    jest.mocked(fetchWorkerWithAuth).mockResolvedValue({
      ok: true,
      blob: async () => new Blob(['image'], { type: 'image/png' }),
    } as Response);
    const controller = new AbortController();
    await fetchImageFromURL('https://image.example.test/image', { signal: controller.signal });
    expect(fetchWorkerWithAuth).toHaveBeenCalledWith(
      'https://worker.example.test',
      expect.objectContaining({ signal: controller.signal }),
      expect.any(Object),
    );
  });

  it('never starts transport for an already cancelled selection', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      fetchImageFromURL('https://image.example.test/image', { signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetchWorkerWithAuth).not.toHaveBeenCalled();
  });

  it('uses the strict demo-fallback policy for worker-backed image fetches', async () => {
    (getCorsProxyUrlOrThrow as jest.Mock).mockResolvedValue('https://worker.example.test/base/');
    (fetchWorkerWithAuth as jest.Mock).mockResolvedValue({
      ok: true,
      blob: async () => new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' }),
    });

    const result = await fetchImageFromURL('https://image.example.test/some-image');

    expect(result).toBeInstanceOf(File);
    expect(result.type).toBe('image/png');
    expect(getCorsProxyUrlOrThrow).toHaveBeenCalledWith({
      allowDemoFallback: defaultStrictAllowDemoFallback(),
    });
    expect(fetchWorkerWithAuth).toHaveBeenCalledWith(
      'https://worker.example.test/base/',
      expect.objectContaining({
        method: 'POST',
      }),
      expect.objectContaining({
        workerUrl: 'https://worker.example.test/base',
        allowDemoFallback: defaultStrictAllowDemoFallback(),
      }),
    );
  });
});
