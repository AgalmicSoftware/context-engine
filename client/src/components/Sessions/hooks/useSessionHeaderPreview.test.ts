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

  it('keeps the chosen picture when a later file is refused', () => {
    const { result } = renderHook(() =>
      useSessionHeaderPreview({ draftSessionHeader: '', updateDraftSessionHeader: jest.fn() }),
    );
    const picture = new File(['header'], 'header.png', { type: 'image/png' });

    act(() => {
      result.current.setSessionHeaderFile(picture);
    });
    let accepted = true;
    act(() => {
      accepted = result.current.setSessionHeaderFile(new File(['notes'], 'notes.txt', { type: 'text/plain' }));
    });

    expect(accepted).toBe(false);
    expect(result.current.sessionHeaderFile).toBe(picture);
    expect(result.current.sessionHeaderUploadStatusTone).toBe('error');
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

  it('refuses a picked or pasted header image that publishing cannot upload', async () => {
    const webp = new File(['x'], 'header.webp', { type: 'image/webp' });
    const { result } = renderHook(() =>
      useSessionHeaderPreview({
        draftSessionHeader: '',
        updateDraftSessionHeader: jest.fn(),
        readClipboard: jest.fn(async () => ({ kind: 'file', file: webp })),
      }),
    );

    let accepted = true;
    act(() => {
      accepted = result.current.setSessionHeaderFile(webp);
    });
    expect(accepted).toBe(false);
    expect(result.current.sessionHeaderFile).toBeNull();
    expect(result.current.sessionHeaderUploadStatus).toBe(
      'Unsupported header image format. Use png, jpg, jpeg, or gif.',
    );
    expect(result.current.sessionHeaderUploadStatusTone).toBe('error');

    await act(async () => {
      await result.current.handlePasteSessionHeaderFromClipboard();
    });
    expect(result.current.sessionHeaderFile).toBeNull();
    expect(result.current.sessionHeaderMode).toBe('url');
    expect(result.current.sessionHeaderUploadStatusTone).toBe('error');

    const png = new File(['x'], 'header.png', { type: 'image/png' });
    act(() => {
      accepted = result.current.setSessionHeaderFile(png);
    });
    expect(accepted).toBe(true);
    expect(result.current.sessionHeaderFile).toBe(png);
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
      result.current.setSessionHeaderStatus('Uploading header image...', 'loading');
    });

    act(() => {
      result.current.handleClearSessionHeaderPreview();
    });

    expect(result.current.sessionHeaderMode).toBe('url');
    expect(result.current.compactSessionHeaderMode).toBe('idle');
    expect(result.current.sessionHeaderFile).toBeNull();
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
      result.current.setSessionHeaderStatus('Uploading header image...', 'loading');
    });
    expect(result.current.sessionHeaderPreviewSrc).toBe('blob:session-header-1');

    rerender({ allowFileUpload: false });

    expect(result.current.sessionHeaderMode).toBe('url');
    expect(result.current.sessionHeaderFile).toBeNull();
    expect(result.current.sessionHeaderPreviewSrc).toBe('https://example.test/persisted.png');
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

  describe('for a Centralized session', () => {
    const png = (name: string) => new File([name], `${name}.png`, { type: 'image/png' });
    const deferred = () => {
      let resolve: (value: string) => void = () => {};
      const promise = new Promise<string>((done) => {
        resolve = done;
      });
      return { promise, resolve };
    };

    it('keeps only the shrunk picture of the file still chosen, and says when it is ready', async () => {
      const first = deferred();
      const second = deferred();
      const shrinkToDataUrl = jest.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
      const { result } = renderHook(() =>
        useSessionHeaderPreview({ inlineUpload: true, updateDraftSessionHeader: jest.fn(), shrinkToDataUrl }),
      );
      act(() => {
        result.current.setSessionHeaderMode('upload');
        result.current.setSessionHeaderFile(png('first'));
      });
      expect(result.current.sessionHeaderInlinePending).toBe(true);
      expect(result.current.sessionHeaderUploadStatusTone).toBe('loading');
      act(() => {
        result.current.setSessionHeaderFile(png('second'));
      });
      await act(async () => {
        first.resolve('data:image/webp;base64,Zmlyc3Q=');
        await first.promise;
      });
      expect(result.current.sessionHeaderInline).toBe('');
      expect(result.current.sessionHeaderInlinePending).toBe(true);
      await act(async () => {
        second.resolve('data:image/webp;base64,c2Vjb25k');
        await second.promise;
      });
      expect(result.current.sessionHeaderInline).toBe('data:image/webp;base64,c2Vjb25k');
      expect(result.current.sessionHeaderPreviewSrc).toBe('data:image/webp;base64,c2Vjb25k');
      expect(result.current.sessionHeaderInlinePending).toBe(false);
      expect(result.current.sessionHeaderUploadStatus).toBe('');
      act(() => result.current.setSessionHeaderMode('url'));
      expect(result.current.sessionHeaderInline).toBe('');
    });

    it('drops a picture that cannot be shrunk and shows why', async () => {
      const shrinkToDataUrl = jest.fn().mockRejectedValue(new Error('Too big to keep.'));
      const { result } = renderHook(() =>
        useSessionHeaderPreview({ inlineUpload: true, updateDraftSessionHeader: jest.fn(), shrinkToDataUrl }),
      );
      await act(async () => {
        result.current.setSessionHeaderMode('upload');
        result.current.setSessionHeaderFile(png('huge'));
      });
      expect(result.current.sessionHeaderFile).toBeNull();
      expect(result.current.sessionHeaderInlinePending).toBe(false);
      expect(result.current.sessionHeaderUploadStatus).toBe('Too big to keep.');
      expect(result.current.sessionHeaderUploadStatusTone).toBe('error');
    });

    it('clears its message when switched to Decentralized mid-way, and does not shrink a file twice', async () => {
      const pending = deferred();
      const shrinkToDataUrl = jest
        .fn()
        .mockReturnValueOnce(pending.promise)
        .mockResolvedValueOnce('data:image/webp;base64,cGhvdG8=');
      const { result, rerender } = renderHook(
        ({ inlineUpload }) =>
          useSessionHeaderPreview({ inlineUpload, updateDraftSessionHeader: jest.fn(), shrinkToDataUrl }),
        { initialProps: { inlineUpload: true } },
      );
      act(() => {
        result.current.setSessionHeaderMode('upload');
        result.current.setSessionHeaderFile(png('photo'));
      });
      expect(result.current.sessionHeaderUploadStatusTone).toBe('loading');
      rerender({ inlineUpload: false });
      expect(result.current.sessionHeaderUploadStatus).toBe('');
      await act(async () => {
        rerender({ inlineUpload: true });
      });
      expect(result.current.sessionHeaderInline).toBe('data:image/webp;base64,cGhvdG8=');
      rerender({ inlineUpload: false });
      rerender({ inlineUpload: true });
      expect(shrinkToDataUrl).toHaveBeenCalledTimes(2);
      expect(result.current.sessionHeaderInline).toBe('data:image/webp;base64,cGhvdG8=');
    });

    it('leaves a Decentralized file alone for Arweave', () => {
      const shrinkToDataUrl = jest.fn();
      const { result } = renderHook(() =>
        useSessionHeaderPreview({ updateDraftSessionHeader: jest.fn(), shrinkToDataUrl }),
      );
      act(() => {
        result.current.setSessionHeaderMode('upload');
        result.current.setSessionHeaderFile(png('arweave'));
      });
      expect(shrinkToDataUrl).not.toHaveBeenCalled();
      expect(result.current.sessionHeaderInline).toBe('');
      expect(result.current.sessionHeaderInlinePending).toBe(false);
    });
  });
});
