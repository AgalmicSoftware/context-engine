import { readFileContent } from './aiClientSourceReaders';
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

    const sessionConfig = {
      slug: 'session-one',
      sessionId: '0x11111111111111111111111111111111',
    };
    const content = await fetchContentFromURL('https://source.example/page', {
      context: { requestId: 'req-1' },
      sessionConfig,
      sessionSlug: 'session-one',
    });

    expect(String(content)).toContain('Worker content');
    expect(mockedGetCorsProxyUrlOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({
        allowDemoFallback: false,
        sessionConfig,
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
        sessionConfig,
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

    expect(result.text).toContain('--- Source: Article ---');
    expect(result.text).toContain('Fetched URL content');
    expect(result.text).toContain('--- Source: Notes ---');
    expect(result.text).toContain('Local notes');
    expect(result.text).not.toContain('Photo');
    expect(result.skipped).toEqual([
      { name: 'Photo', status: 'unsupported', reason: 'Photo sources must be analyzed before text extraction.' },
    ]);
  });
  it('separates unsupported files and read failures from extracted text', async () => {
    await expect(
      readFileContent(new File(['not PDF text'], 'memo.pdf', { type: 'application/pdf' })),
    ).resolves.toMatchObject({ status: 'unsupported' });
    await expect(readFileContent(new File(['Local notes'], 'memo.txt', { type: 'text/plain' }))).resolves.toEqual({
      status: 'text',
      text: 'Local notes',
    });
    await expect(readFileContent(new File(['{}'], 'data.bin', { type: 'application/json' }))).resolves.toEqual({
      status: 'text',
      text: '{}',
    });
    const read = jest.spyOn(FileReader.prototype, 'readAsText').mockImplementation(function (this: FileReader) {
      this.dispatchEvent(new Event('error'));
    });
    try {
      await expect(readFileContent(new File(['data'], 'broken.txt'))).resolves.toMatchObject({
        status: 'failed',
        reason: expect.stringContaining('broken.txt'),
      });
    } finally {
      read.mockRestore();
    }
  });

  it('counts only extracted text and names skipped binary sources', async () => {
    const result = await processAdditionalSources([
      { type: 'file', name: 'memo.pdf', value: new File(['BINARY_MARKER'], 'memo.pdf') },
      { type: 'file', name: 'notes.txt', value: new File(['Useful text'], 'notes.txt') },
    ]);
    expect(result.text).toContain('Useful text');
    expect(result.text).not.toMatch(/BINARY_MARKER|memo.pdf|not currently supported/);
    expect(result.extractedCharacters).toBe('Useful text'.length);
    expect(result.skipped).toEqual([{ name: 'memo.pdf', status: 'unsupported', reason: expect.any(String) }]);
  });
});
