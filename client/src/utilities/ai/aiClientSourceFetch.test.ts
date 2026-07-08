import { fetchContentFromURL, processAdditionalSources } from './aiClientSourceFetch';
import { getCorsProxyUrlOrThrow } from '../worker/corsProxy';
import { fetchWorkerWithAuth } from '../worker/workerAuth.js';

jest.mock('../worker/corsProxy', () => ({
  getCorsProxyUrlOrThrow: jest.fn(),
}));

jest.mock('../worker/workerAuth.js', () => ({
  fetchWorkerWithAuth: jest.fn(),
}));

jest.mock('../worker/workerSessionResolution.js', () => ({
  defaultStrictAllowDemoFallback: jest.fn(() => false),
}));

jest.mock('../logging', () => ({
  createLogger: () => ({
    error: jest.fn(),
    warn: jest.fn(),
  }),
}));

const mockedGetCorsProxyUrlOrThrow = jest.mocked(getCorsProxyUrlOrThrow);
const mockedFetchWorkerWithAuth = jest.mocked(fetchWorkerWithAuth);

const longText = 'Direct page content '.repeat(8);

describe('aiClientSourceFetch', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('extracts direct HTML content before using the worker fallback', async () => {
    jest.mocked(global.fetch).mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }),
      text: async () => `<html><body><main>${longText}</main></body></html>`,
    } as Response);

    await expect(fetchContentFromURL('https://source.example/page')).resolves.toBe(longText.trim());

    expect(mockedGetCorsProxyUrlOrThrow).not.toHaveBeenCalled();
    expect(mockedFetchWorkerWithAuth).not.toHaveBeenCalled();
  });

  it('falls back to the worker and preserves session auth options', async () => {
    jest.mocked(global.fetch).mockRejectedValue(new Error('cors blocked'));
    mockedGetCorsProxyUrlOrThrow.mockResolvedValue('https://worker.example');
    mockedFetchWorkerWithAuth.mockResolvedValue({
      ok: true,
      json: async () => ({ content: '<main>Worker content '.repeat(12) + '</main>' }),
    } as Response);

    const content = await fetchContentFromURL('https://source.example/page', {
      context: { requestId: 'req-1' },
      sessionConfig: { slug: 'session-one' },
      sessionSlug: 'session-one',
    });

    expect(String(content)).toContain('Worker content');
    expect(mockedGetCorsProxyUrlOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({
        allowDemoFallback: false,
        sessionConfig: { slug: 'session-one' },
        sessionSlug: 'session-one',
      }),
    );
    expect(mockedFetchWorkerWithAuth).toHaveBeenCalledWith(
      'https://worker.example',
      expect.objectContaining({
        body: JSON.stringify({ url: 'https://source.example/page', action: 'fetch_url' }),
        method: 'POST',
      }),
      expect.objectContaining({
        allowDemoFallback: false,
        sessionSlug: 'session-one',
        workerUrl: 'https://worker.example',
      }),
    );
  });

  it('aggregates URL and file sources while preserving per-source errors', async () => {
    jest.mocked(global.fetch).mockRejectedValue(new Error('cors blocked'));
    mockedGetCorsProxyUrlOrThrow.mockResolvedValue('https://worker.example');
    mockedFetchWorkerWithAuth.mockResolvedValue({
      ok: true,
      json: async () => ({ content: 'Fetched URL content' }),
    } as Response);

    const result = await processAdditionalSources([
      { type: 'url', value: 'https://source.example/page', name: 'Article' },
      { type: 'file', value: new File(['Local notes'], 'notes.txt', { type: 'text/plain' }), name: 'Notes' },
      { type: 'photo', value: new File(['image'], 'photo.png', { type: 'image/png' }), name: 'Photo' },
    ]);

    expect(result).toContain('--- Source: Article ---');
    expect(result).toContain('Fetched URL content');
    expect(result).toContain('--- Source: Notes ---');
    expect(result).toContain('Local notes');
    expect(result).toContain("[Error reading source 'Photo': Photo sources must be analyzed before text extraction.]");
  });
});
