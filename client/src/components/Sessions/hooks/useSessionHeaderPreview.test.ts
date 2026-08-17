import { act, renderHook } from '@testing-library/react';
import useSessionHeaderPreview from './useSessionHeaderPreview.js';

describe('useSessionHeaderPreview', () => {
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;

  beforeEach(() => {
    let blobId = 0;
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: jest.fn(() => {
        blobId += 1;
        return `blob:session-header-${blobId}`;
      }),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: jest.fn(),
    });
  });

  afterEach(() => {
    if (originalCreateObjectURL) {
      Object.defineProperty(URL, 'createObjectURL', {
        configurable: true,
        value: originalCreateObjectURL,
      });
    } else {
      delete (URL as unknown as { createObjectURL?: unknown }).createObjectURL;
    }
    if (originalRevokeObjectURL) {
      Object.defineProperty(URL, 'revokeObjectURL', {
        configurable: true,
        value: originalRevokeObjectURL,
      });
    } else {
      delete (URL as unknown as { revokeObjectURL?: unknown }).revokeObjectURL;
    }
    jest.restoreAllMocks();
  });

  it('uses the draft header URL while in URL mode', () => {
    const { result } = renderHook(() =>
      useSessionHeaderPreview({
        draftSessionHeader: 'https://example.test/header.png',
        updateDraftSessionHeader: jest.fn(),
      }),
    );

    expect(result.current.sessionHeaderMode).toBe('url');
    expect(result.current.sessionHeaderPreviewSrc).toBe('https://example.test/header.png');
  });

  it('creates and revokes upload preview object URLs', () => {
    const { result, unmount } = renderHook(() =>
      useSessionHeaderPreview({
        draftSessionHeader: '',
        updateDraftSessionHeader: jest.fn(),
      }),
    );
    const firstFile = new File(['first'], 'first.png', { type: 'image/png' });
    const secondFile = new File(['second'], 'second.png', { type: 'image/png' });

    act(() => {
      result.current.setSessionHeaderMode('upload');
      result.current.setSessionHeaderFile(firstFile);
    });

    expect(URL.createObjectURL).toHaveBeenCalledWith(firstFile);
    expect(result.current.sessionHeaderPreviewSrc).toBe('blob:session-header-1');

    act(() => {
      result.current.setSessionHeaderFile(secondFile);
    });

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:session-header-1');
    expect(URL.createObjectURL).toHaveBeenCalledWith(secondFile);
    expect(result.current.sessionHeaderPreviewSrc).toBe('blob:session-header-2');

    unmount();

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:session-header-2');
  });

  it('handles pasted image files as uploads', async () => {
    const file = new File(['image'], 'paste.png', { type: 'image/png' });
    const readClipboard = jest.fn().mockResolvedValue({ kind: 'file', file });
    const updateDraftSessionHeader = jest.fn();
    const { result } = renderHook(() =>
      useSessionHeaderPreview({
        draftSessionHeader: '',
        updateDraftSessionHeader,
        readClipboard,
      }),
    );

    await act(async () => {
      await result.current.handlePasteSessionHeaderFromClipboard();
    });

    expect(readClipboard).toHaveBeenCalledWith({ fileNamePrefix: 'clipboard-session-header' });
    expect(result.current.sessionHeaderMode).toBe('upload');
    expect(result.current.compactSessionHeaderMode).toBe('idle');
    expect(result.current.sessionHeaderFile).toBe(file);
    expect(result.current.sessionHeaderUploadStatus).toBe('');
    expect(updateDraftSessionHeader).not.toHaveBeenCalled();
  });

  it('handles pasted text as URL mode draft updates', async () => {
    const readClipboard = jest.fn().mockResolvedValue({
      kind: 'text',
      text: 'https://example.test/from-clipboard.png',
    });
    const updateDraftSessionHeader = jest.fn();
    const { result } = renderHook(() =>
      useSessionHeaderPreview({
        draftSessionHeader: '',
        updateDraftSessionHeader,
        readClipboard,
      }),
    );

    act(() => {
      result.current.setSessionHeaderMode('upload');
      result.current.setSessionHeaderFile(new File(['image'], 'old.png', { type: 'image/png' }));
    });

    await act(async () => {
      await result.current.handlePasteSessionHeaderFromClipboard();
    });

    expect(result.current.sessionHeaderMode).toBe('url');
    expect(result.current.compactSessionHeaderMode).toBe('url');
    expect(result.current.sessionHeaderFile).toBeNull();
    expect(updateDraftSessionHeader).toHaveBeenCalledWith('https://example.test/from-clipboard.png');
    expect(result.current.sessionHeaderUploadStatus).toBe('');
  });

  it('reports clipboard errors with error tone', async () => {
    const readClipboard = jest.fn().mockResolvedValue({
      kind: 'error',
      error: 'No image available.',
    });
    const { result } = renderHook(() =>
      useSessionHeaderPreview({
        draftSessionHeader: '',
        updateDraftSessionHeader: jest.fn(),
        readClipboard,
      }),
    );

    await act(async () => {
      await result.current.handlePasteSessionHeaderFromClipboard();
    });

    expect(result.current.sessionHeaderUploadStatus).toBe('No image available.');
    expect(result.current.sessionHeaderUploadStatusTone).toBe('error');
  });

  it('clears preview state and draft header value', () => {
    const updateDraftSessionHeader = jest.fn();
    const { result } = renderHook(() =>
      useSessionHeaderPreview({
        draftSessionHeader: 'https://example.test/header.png',
        updateDraftSessionHeader,
      }),
    );

    act(() => {
      result.current.setSessionHeaderMode('upload');
      result.current.setCompactSessionHeaderMode('url');
      result.current.setSessionHeaderFile(new File(['image'], 'header.png', { type: 'image/png' }));
      result.current.setSessionHeaderPreviewModalOpen(true);
      result.current.setSessionHeaderStatus('Uploading header image...', 'loading');
    });

    act(() => {
      result.current.handleClearSessionHeaderPreview();
    });

    expect(result.current.sessionHeaderMode).toBe('url');
    expect(result.current.compactSessionHeaderMode).toBe('idle');
    expect(result.current.sessionHeaderFile).toBeNull();
    expect(result.current.sessionHeaderPreviewModalOpen).toBe(false);
    expect(result.current.sessionHeaderUploadStatus).toBe('');
    expect(result.current.sessionHeaderUploadStatusTone).toBe('default');
    expect(updateDraftSessionHeader).toHaveBeenCalledWith('');
  });

  it('discards a local file when the selected profile becomes URL-only', () => {
    const updateDraftSessionHeader = jest.fn();
    const { result, rerender } = renderHook(
      ({ allowFileUpload }) =>
        useSessionHeaderPreview({
          allowFileUpload,
          draftSessionHeader: 'https://example.test/persisted.png',
          updateDraftSessionHeader,
        }),
      { initialProps: { allowFileUpload: true } },
    );
    const file = new File(['image'], 'transient.png', { type: 'image/png' });

    act(() => {
      result.current.setSessionHeaderMode('upload');
      result.current.setSessionHeaderFile(file);
      result.current.setSessionHeaderPreviewModalOpen(true);
      result.current.setSessionHeaderStatus('Uploading header image...', 'loading');
    });
    expect(result.current.sessionHeaderPreviewSrc).toBe('blob:session-header-1');

    rerender({ allowFileUpload: false });

    expect(result.current.sessionHeaderMode).toBe('url');
    expect(result.current.sessionHeaderFile).toBeNull();
    expect(result.current.sessionHeaderPreviewSrc).toBe('https://example.test/persisted.png');
    expect(result.current.sessionHeaderPreviewModalOpen).toBe(false);
    expect(result.current.sessionHeaderUploadStatus).toBe('');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:session-header-1');
    expect(updateDraftSessionHeader).not.toHaveBeenCalled();

    rerender({ allowFileUpload: true });
    expect(result.current.sessionHeaderMode).toBe('url');
    expect(result.current.sessionHeaderFile).toBeNull();
  });

  it('rejects pasted image files for URL-only profiles', async () => {
    const file = new File(['image'], 'paste.png', { type: 'image/png' });
    const updateDraftSessionHeader = jest.fn();
    const { result } = renderHook(() =>
      useSessionHeaderPreview({
        allowFileUpload: false,
        draftSessionHeader: '',
        updateDraftSessionHeader,
        readClipboard: jest.fn().mockResolvedValue({ kind: 'file', file }),
      }),
    );

    await act(async () => {
      await result.current.handlePasteSessionHeaderFromClipboard();
    });

    expect(result.current.sessionHeaderMode).toBe('url');
    expect(result.current.sessionHeaderFile).toBeNull();
    expect(result.current.sessionHeaderUploadStatus).toBe(
      'This hosting profile accepts a header image URL, not a local file.',
    );
    expect(result.current.sessionHeaderUploadStatusTone).toBe('error');
    expect(updateDraftSessionHeader).not.toHaveBeenCalled();
  });
});
