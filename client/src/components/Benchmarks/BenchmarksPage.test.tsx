import React from 'react';
import { createHash } from 'node:crypto';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import BenchmarksPage from './BenchmarksPage';
import { decodeBenchmarkReport } from './benchmarkArtifact';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');
const previewHtml = '<!doctype html><title>Benchmark preview</title>';
const reportEntry = (html: string, overrides = {}) => ({
  id: 'preview',
  title: 'AI Futures & Policy',
  topic: 'AI Futures & Policy',
  publicationStatus: 'development-preview',
  generatedAt: '2026-07-15T07:20:37.000Z',
  questionCount: 200,
  participantCount: 5,
  artifact: 'preview.html',
  compression: 'none',
  bytes: Buffer.byteLength(html),
  sha256: sha256(html),
  contentBytes: Buffer.byteLength(html),
  contentSha256: sha256(html),
  ...overrides,
});

const manifest = {
  schemaVersion: 1,
  defaultReportId: 'preview',
  reports: [reportEntry(previewHtml)],
};

describe('BenchmarksPage', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    jest.restoreAllMocks();
  });

  it('loads the manifest and embeds the selected interactive report', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(manifest), { status: 200 }))
      .mockResolvedValueOnce(new Response(previewHtml, { status: 200 }));

    render(<BenchmarksPage />);

    expect(screen.getByTestId(E2E_TESTIDS.PAGE_BENCHMARKS_ROOT)).toBeInTheDocument();
    expect(screen.queryByText('Context Engine benchmarks')).not.toBeInTheDocument();
    expect(screen.queryByText('200 questions')).not.toBeInTheDocument();
    expect(screen.queryByText('5 model participants')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Benchmark report')).not.toBeInTheDocument();

    const frame = await screen.findByTestId('ce-benchmark-report-frame');
    expect(frame).toHaveAttribute('srcdoc', expect.stringContaining('Benchmark preview'));
    expect(global.fetch).toHaveBeenNthCalledWith(1, '/benchmark-artifacts/manifest.json', expect.any(Object));
    expect(global.fetch).toHaveBeenNthCalledWith(2, '/benchmark-artifacts/preview.html', expect.any(Object));
  });

  it('shows an actionable error when the report artifact is missing', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(manifest), { status: 200 }))
      .mockResolvedValueOnce(new Response('', { status: 404 }));

    render(<BenchmarksPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Benchmark report request failed (404).');
    expect(screen.queryByTestId('ce-benchmark-report-frame')).not.toBeInTheDocument();
  });

  it('rejects unsafe artifact names without crashing the page', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ...manifest,
          reports: [{ ...manifest.reports[0], artifact: '../preview.html' }],
        }),
        { status: 200 },
      ),
    );

    render(<BenchmarksPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('invalid report entry');
    expect(screen.queryByTitle('Download compressed benchmark artifact')).not.toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('rejects a stale default report id', async () => {
    const html = '<p>fallback report</p>';
    global.fetch = jest.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ...manifest,
          defaultReportId: 'missing',
          reports: [reportEntry(html)],
        }),
        { status: 200 },
      ),
    );

    render(<BenchmarksPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('default report is invalid');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('reports an empty manifest instead of loading forever', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ...manifest,
          defaultReportId: '',
          reports: [],
        }),
        { status: 200 },
      ),
    );

    render(<BenchmarksPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('does not contain any reports');
    expect(screen.queryByText('Loading benchmark report...')).not.toBeInTheDocument();
  });

  it('decodes uncompressed report responses without browser stream support', async () => {
    const html = '<p>report</p>';
    await expect(decodeBenchmarkReport(new Response(html), reportEntry(html))).resolves.toBe(html);
  });

  it('does not decompress a gzip artifact twice when the HTTP server already decoded it', async () => {
    const html = '<p>report</p>';
    const response = new Response(html, {
      headers: { 'content-encoding': 'gzip' },
    });
    await expect(
      decodeBenchmarkReport(response, reportEntry(html, { compression: 'gzip', artifact: 'preview.html.gz' })),
    ).resolves.toBe(html);
  });

  it('rejects gzip responses without a readable response body', async () => {
    const response = { body: null } as Response;
    await expect(
      decodeBenchmarkReport(
        response,
        reportEntry('<p>report</p>', { compression: 'gzip', artifact: 'preview.html.gz' }),
      ),
    ).rejects.toThrow('readable body');
  });

  it('rejects report bytes that do not match the signed manifest entry', async () => {
    await expect(
      decodeBenchmarkReport(new Response('<p>tampered</p>'), reportEntry('<p>expected</p>')),
    ).rejects.toThrow('report content hash does not match');
  });

  it('rejects manifest entries without integrity metadata', async () => {
    const { sha256: _artifactHash, contentSha256: _contentHash, ...unsigned } = reportEntry(previewHtml);
    global.fetch = jest.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ...manifest,
          reports: [unsigned],
        }),
        { status: 200 },
      ),
    );

    render(<BenchmarksPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('invalid report entry');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('rejects released entries without a bound release report hash', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ...manifest,
          reports: [
            reportEntry(previewHtml, {
              publicationStatus: 'released',
              releaseReportContentHash: null,
            }),
          ],
        }),
        { status: 200 },
      ),
    );

    render(<BenchmarksPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('invalid report entry');
  });

  it('rejects non-numeric question and participant counts', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ...manifest,
          reports: [reportEntry(previewHtml, { questionCount: { value: 200 } })],
        }),
        { status: 200 },
      ),
    );

    render(<BenchmarksPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('invalid report entry');
  });

  it('keeps the loading state while the manifest is unresolved', async () => {
    global.fetch = jest.fn(() => new Promise(() => {})) as jest.Mock;
    render(<BenchmarksPage />);
    expect(screen.getByText('Loading benchmark report...')).toBeInTheDocument();
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
  });

  it('synchronizes safe report hashes across the sandboxed iframe boundary', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(manifest), { status: 200 }))
      .mockResolvedValueOnce(new Response(previewHtml, { status: 200 }));
    window.history.replaceState(null, '', `${window.location.pathname}#breakdown`);

    render(<BenchmarksPage />);

    const frame = (await screen.findByTestId('ce-benchmark-report-frame')) as HTMLIFrameElement;
    expect(frame).toHaveAttribute('sandbox', expect.stringContaining('allow-modals'));
    expect(frame.contentWindow).not.toBeNull();
    const postMessage = jest.spyOn(frame.contentWindow as Window, 'postMessage').mockImplementation(() => {});
    fireEvent.load(frame);
    expect(postMessage).toHaveBeenCalledWith(
      {
        type: 'ce-benchmark-set-hash',
        hash: '#breakdown',
      },
      '*',
    );
    expect(postMessage).toHaveBeenCalledWith(
      {
        type: 'ce-benchmark-config',
        downloadUrl: '/benchmark-artifacts/preview.html',
        downloadFilename: 'preview.html',
      },
      '*',
    );

    window.history.replaceState(null, '', `${window.location.pathname}#risk-matrix`);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect(postMessage).toHaveBeenCalledWith(
      {
        type: 'ce-benchmark-set-hash',
        hash: '#risk-matrix',
      },
      '*',
    );

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'ce-benchmark-hash-change', hash: '#question-aidb_0001' },
        source: frame.contentWindow,
      }),
    );
    expect(window.location.hash).toBe('#question-aidb_0001');

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'ce-benchmark-hash-change', hash: '#bad hash<script>' },
        source: frame.contentWindow,
      }),
    );
    expect(window.location.hash).toBe('#question-aidb_0001');
  });

  it('downloads the selected verified artifact when the report header requests it', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(manifest), { status: 200 }))
      .mockResolvedValueOnce(new Response(previewHtml, { status: 200 }));

    render(<BenchmarksPage />);

    const frame = (await screen.findByTestId('ce-benchmark-report-frame')) as HTMLIFrameElement;
    const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const createElement = document.createElement.bind(document);
    let downloadAnchor: HTMLAnchorElement | null = null;
    jest.spyOn(document, 'createElement').mockImplementation((tagName, options) => {
      const element = createElement(tagName, options);
      if (tagName.toLowerCase() === 'a') downloadAnchor = element as HTMLAnchorElement;
      return element;
    });

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'ce-benchmark-download' },
        source: frame.contentWindow,
      }),
    );

    expect(click).toHaveBeenCalledTimes(1);
    expect(downloadAnchor).not.toBeNull();
    expect(downloadAnchor?.getAttribute('href')).toBe('/benchmark-artifacts/preview.html');
    expect(downloadAnchor?.download).toBe('preview.html');
  });
});
