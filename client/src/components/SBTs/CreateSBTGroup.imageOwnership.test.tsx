import { waitFor } from '@testing-library/react';
import {
  act,
  render,
  screen,
  makeInstance,
  mockFetchImageFromURL,
  setupCreateSBTGroupTestLifecycle,
} from './CreateSBTGroup.testUtils';
import { readCompactImageClipboard } from '../Shared/compactImageClipboard.js';

jest.mock('../Shared/compactImageClipboard.js', () => ({ readCompactImageClipboard: jest.fn() }));

const pendingImage = () => {
  let resolve!: (file: File) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<File>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};

const remoteFile = () => new File(['remote'], 'remote.png', { type: 'image/png' });
const localFile = () => new File(['local'], 'local.png', { type: 'image/png' });

const makeForm = () => {
  const form = makeInstance({
    account: '0x1111111111111111111111111111111111111111',
    network: { id: 11155420, name: 'OP Sepolia' },
    sessionSlug: 'image-test',
  });
  form.updateGroupHash = jest.fn();
  form.setState({ tokenInfoCollapsed: false, sbtName: 'Image test' });
  return form;
};

const startUrl = (form: ReturnType<typeof makeForm>, url = 'https://image.example.test/old.png') => {
  form.setImageUploadMethod(true);
  form.handleInputChange({ target: { name: 'sbtImageUrl', type: 'text', value: url } });
};

describe('the newest SBT image choice owns the preview and saved bytes', () => {
  setupCreateSBTGroupTestLifecycle();
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;

  beforeEach(() => {
    jest.mocked(readCompactImageClipboard).mockReset();
    URL.createObjectURL = jest.fn((file) => `blob:${file instanceof File ? file.name : 'restored'}`);
    URL.revokeObjectURL = jest.fn();
  });
  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  });

  it.each(['url', 'paste', 'mint'] as const)('ignores a late %s success after a local upload', async (source) => {
    const form = makeForm();
    const request = pendingImage();
    mockFetchImageFromURL.mockReturnValue(request.promise);
    let action: Promise<void> | undefined;
    await act(async () => {
      if (source === 'url') startUrl(form);
      if (source === 'paste') {
        jest
          .mocked(readCompactImageClipboard)
          .mockResolvedValue({ kind: 'text', text: 'https://image.example.test/old.png' });
        action = form.handlePasteImage();
      }
      if (source === 'mint') {
        form.setState({ useImageUrl: true, sbtImageUrl: 'https://image.example.test/old.png' });
        form.commitPendingDocumentUrl = jest.fn(async () => false);
        form.uploadImageToArweave = jest.fn(async () => null);
        form.uploadTokenUriToArweave = jest.fn(async () => '');
        form.mintSBT = jest.fn(async () => {});
        action = form.handleMintClick();
      }
    });
    expect(mockFetchImageFromURL).toHaveBeenCalledTimes(1);
    const local = localFile();
    form.setImageUploadMethod(false);
    form.applySelectedImageFile(local);
    const view = render(form.render());
    await waitFor(() =>
      expect(JSON.parse(sessionStorage.getItem(form.getScopedFormCacheKey()) || '{}')._imageDataUrl).toBe(
        'data:image/png;base64,bG9jYWw=',
      ),
    );
    await act(async () => {
      request.resolve(remoteFile());
      await action;
    });
    view.rerender(form.render());
    expect(form.state.sbtImageFile).toBe(local);
    expect(screen.getByAltText('SBT artwork preview')).toHaveAttribute('src', 'blob:local.png');
    expect(JSON.parse(sessionStorage.getItem(form.getScopedFormCacheKey()) || '{}')._imageDataUrl).toBe(
      'data:image/png;base64,bG9jYWw=',
    );
  });

  it.each(['url', 'paste'] as const)('ignores a late %s failure after a local upload', async (source) => {
    const form = makeForm();
    const request = pendingImage();
    mockFetchImageFromURL.mockReturnValue(request.promise);
    let action: Promise<void> | undefined;
    await act(async () => {
      if (source === 'url') startUrl(form);
      else {
        jest
          .mocked(readCompactImageClipboard)
          .mockResolvedValue({ kind: 'text', text: 'https://image.example.test/old.png' });
        action = form.handlePasteImage();
      }
    });
    const local = localFile();
    form.applySelectedImageFile(local);
    await waitFor(() =>
      expect(JSON.parse(sessionStorage.getItem(form.getScopedFormCacheKey()) || '{}')._imageDataUrl).toBe(
        'data:image/png;base64,bG9jYWw=',
      ),
    );
    await act(async () => {
      request.reject(new Error('Late network failure'));
      await action;
    });
    render(form.render());
    expect(form.state.sbtImageFile).toBe(local);
    expect(form.state.imageLoadError).toBe(false);
    expect(form.state.imageChooserStatusTone).not.toBe('error');
    expect(screen.getByAltText('SBT artwork preview')).toHaveAttribute('src', 'blob:local.png');
    expect(JSON.parse(sessionStorage.getItem(form.getScopedFormCacheKey()) || '{}')._imageDataUrl).toBe(
      'data:image/png;base64,bG9jYWw=',
    );
  });

  it('keeps a local upload selected after the earlier URL completed normally', async () => {
    const form = makeForm();
    const remote = remoteFile();
    mockFetchImageFromURL.mockResolvedValue(remote);
    await act(async () => {
      startUrl(form);
    });
    expect(form.state.sbtImageFile).toBe(remote);
    const local = localFile();
    form.applySelectedImageFile(local);
    await waitFor(() =>
      expect(JSON.parse(sessionStorage.getItem(form.getScopedFormCacheKey()) || '{}')._imageDataUrl).toBe(
        'data:image/png;base64,bG9jYWw=',
      ),
    );
    expect(form.state.sbtImageFile).toBe(local);
  });

  it.each(['empty', 'unsupported text', 'oversized file', 'failed URL'] as const)(
    'keeps an in-flight image when a paste supplies %s',
    async (kind) => {
      const form = makeForm();
      const request = pendingImage();
      mockFetchImageFromURL.mockReturnValueOnce(request.promise);
      startUrl(form);
      const signal = mockFetchImageFromURL.mock.calls[0]?.[1]?.signal;
      const oversized = localFile();
      Object.defineProperty(oversized, 'size', { value: 11 * 1024 * 1024 });
      jest.mocked(readCompactImageClipboard).mockResolvedValue(
        kind === 'oversized file'
          ? { kind: 'file', file: oversized }
          : kind === 'empty'
            ? { error: 'No image available.' }
            : {
                kind: 'text',
                text: kind === 'failed URL' ? 'https://image.example.test/missing.png' : 'ordinary text',
              },
      );
      if (kind === 'failed URL') mockFetchImageFromURL.mockRejectedValueOnce(new Error('Unavailable'));
      await form.handlePasteImage();
      expect(signal?.aborted).toBe(false);
      const remote = remoteFile();
      await act(async () => {
        request.resolve(remote);
      });
      expect(form.state.sbtImageFile).toBe(remote);
    },
  );

  it('still saves the current image when a paste does not supply a replacement', async () => {
    const form = makeForm();
    form.applySelectedImageFile(localFile());
    jest.mocked(readCompactImageClipboard).mockResolvedValue({ error: 'No image available.' });
    await form.handlePasteImage();
    await waitFor(() =>
      expect(JSON.parse(sessionStorage.getItem(form.getScopedFormCacheKey()) || '{}')._imageDataUrl).toBe(
        'data:image/png;base64,bG9jYWw=',
      ),
    );
  });

  it('preserves a restored draft when an earlier image request completes', async () => {
    const form = makeForm();
    const request = pendingImage();
    mockFetchImageFromURL.mockReturnValue(request.promise);
    startUrl(form);
    form.applyAuthoringPayload({
      sbtName: 'Restored',
      useImageUrl: false,
      _imageDataUrl: 'data:image/png;base64,bG9jYWw=',
    });
    const restored = form.state.sbtImageFile;
    form.persistFormCache();
    await act(async () => {
      request.resolve(remoteFile());
    });
    expect(form.state.sbtImageFile).toBe(restored);
    await waitFor(() =>
      expect(JSON.parse(sessionStorage.getItem(form.getScopedFormCacheKey()) || '{}')._imageDataUrl).toBe(
        'data:image/png;base64,bG9jYWw=',
      ),
    );
  });

  it.each(['clear', 'reset', 'mode'] as const)('does not restore an obsolete image after %s', async (change) => {
    const form = makeForm();
    const request = pendingImage();
    mockFetchImageFromURL.mockReturnValue(request.promise);
    startUrl(form);
    if (change === 'clear') form.resetImage();
    if (change === 'reset') form.resetForm();
    if (change === 'mode') form.setImageUploadMethod(false);
    await act(async () => {
      request.resolve(remoteFile());
    });
    expect(form.state.sbtImageFile).toBeNull();
    expect(JSON.parse(sessionStorage.getItem(form.getScopedFormCacheKey()) || '{}')._imageDataUrl).toBeUndefined();
  });

  it('aborts the obsolete URL request and keeps the newer URL result', async () => {
    const form = makeForm();
    const first = pendingImage();
    const second = pendingImage();
    mockFetchImageFromURL.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    startUrl(form);
    const firstSignal = mockFetchImageFromURL.mock.calls[0]?.[1]?.signal;
    startUrl(form, 'https://image.example.test/new.png');
    expect(firstSignal?.aborted).toBe(true);
    const newer = remoteFile();
    await act(async () => {
      second.resolve(newer);
      first.reject(new Error('Obsolete failure'));
    });
    expect(form.state.sbtImageFile).toBe(newer);
    expect(form.state.imageLoadError).toBe(false);
  });
});
