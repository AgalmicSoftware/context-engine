import {
  buildCreateSbtImageChooserStatusPatch,
  buildCreateSbtImageFileClearPatch,
  buildCreateSbtImageFilePatch,
  buildCreateSbtImageLoadErrorPatch,
  buildCreateSbtImageLoadReadyPatch,
  buildCreateSbtImagePreviewState,
  buildCreateSbtImageResetPatch,
  buildCreateSbtImageUploadMethodPatch,
  buildCreateSbtSelectedImageFilePatch,
  getCanonicalCreateSbtMetadataImageUrl,
  getFetchableCreateSbtImageUrl,
  resolveCreateSbtMemoizedImageDataUrl,
  resolveCreateSbtMetadataImageSource,
} from './createSbtGroupImageHelpers';

describe('createSbtGroupImageHelpers', () => {
  it('builds image upload and file patches', () => {
    expect(buildCreateSbtImageUploadMethodPatch({ useImageUrl: true })).toEqual({
      useImageUrl: true,
      sbtImageFile: null,
      sbtImageUrl: '',
      imageLoadError: false,
      imageChooserStatusText: '',
      imageChooserStatusTone: 'default',
      lockedImageAsset: null,
    });
    expect(buildCreateSbtImageResetPatch()).toEqual({
      useImageUrl: false,
      sbtImageFile: null,
      sbtImageUrl: '',
      imageLoadError: false,
      imageChooserStatusText: '',
      imageChooserStatusTone: 'default',
      lockedImageAsset: null,
    });

    const imageFile = { name: 'badge.png' };
    expect(
      buildCreateSbtImageFilePatch({
        clearLockedAsset: true,
        file: imageFile,
      }),
    ).toEqual({
      sbtImageFile: imageFile,
      imageLoadError: false,
      lockedImageAsset: null,
    });
    expect(buildCreateSbtImageLoadErrorPatch({ clearLockedAsset: true })).toEqual({
      imageLoadError: true,
      sbtImageFile: null,
      lockedImageAsset: null,
    });
    expect(buildCreateSbtImageLoadErrorPatch({ clearFile: false })).toEqual({
      imageLoadError: true,
    });
    expect(buildCreateSbtImageLoadReadyPatch()).toEqual({
      imageLoadError: false,
    });
    expect(buildCreateSbtImageFileClearPatch({ clearLockedAsset: true })).toEqual({
      sbtImageFile: null,
      lockedImageAsset: null,
    });
  });

  it('builds selected image and chooser status patches', () => {
    const imageFile = { name: 'badge.png' };

    expect(
      buildCreateSbtSelectedImageFilePatch({
        file: imageFile,
        statusText: 'Ready',
        statusTone: 'loading',
      }),
    ).toEqual({
      useImageUrl: false,
      sbtImageFile: imageFile,
      sbtImageUrl: '',
      imageLoadError: false,
      imageChooserStatusText: 'Ready',
      imageChooserStatusTone: 'loading',
      lockedImageAsset: null,
    });
    expect(
      buildCreateSbtSelectedImageFilePatch({
        file: imageFile,
        sbtImageUrl: 'https://example.test/badge.png',
        useImageUrl: true,
      }),
    ).toEqual({
      useImageUrl: true,
      sbtImageFile: imageFile,
      sbtImageUrl: 'https://example.test/badge.png',
      imageLoadError: false,
      imageChooserStatusText: '',
      imageChooserStatusTone: 'default',
      lockedImageAsset: null,
    });
    expect(
      buildCreateSbtImageChooserStatusPatch({
        statusText: 'Loading preview...',
        statusTone: 'loading',
      }),
    ).toEqual({
      imageChooserStatusText: 'Loading preview...',
      imageChooserStatusTone: 'loading',
    });
    expect(buildCreateSbtImageChooserStatusPatch()).toEqual({
      imageChooserStatusText: '',
      imageChooserStatusTone: 'default',
    });
  });

  it('resolves memoized image data URLs', () => {
    const imageFile = { name: 'badge.png' };

    expect(
      resolveCreateSbtMemoizedImageDataUrl({
        imageFile,
        memoizedImageDataUrl: 'data:image/png;base64,abc',
        memoizedImageFileRef: imageFile,
      }),
    ).toBe('data:image/png;base64,abc');
    expect(
      resolveCreateSbtMemoizedImageDataUrl({
        imageFile,
        memoizedImageDataUrl: 'data:image/png;base64,abc',
        memoizedImageFileRef: { name: 'other.png' },
      }),
    ).toBeNull();
    expect(
      resolveCreateSbtMemoizedImageDataUrl({
        imageFile,
        memoizedImageDataUrl: null,
        memoizedImageFileRef: imageFile,
      }),
    ).toBeNull();
  });

  it('normalizes image URLs for preview fetching and metadata', () => {
    const txId = 'a'.repeat(43);

    expect(getFetchableCreateSbtImageUrl(` ${txId} `)).toMatch(/^https?:\/\//);
    expect(getFetchableCreateSbtImageUrl('ftp://example.com/image.png')).toBe('');
    expect(getFetchableCreateSbtImageUrl('not a url')).toBe('');
    expect(getCanonicalCreateSbtMetadataImageUrl(` ${txId} `)).toBe(`ar://${txId}`);
    expect(getCanonicalCreateSbtMetadataImageUrl(`https://arweave.net/${txId}`)).toBe(`https://arweave.net/${txId}`);
    expect(getCanonicalCreateSbtMetadataImageUrl('')).toBe('');
    expect(
      resolveCreateSbtMetadataImageSource({
        defaultImageUrl: 'default',
        getCanonicalMetadataImageUrl: (value) =>
          String(value || '')
            .trim()
            .toUpperCase(),
        sbtImageUrl: ' explicit ',
        useImageUrl: false,
      }),
    ).toBe('EXPLICIT');
    expect(
      resolveCreateSbtMetadataImageSource({
        defaultImageUrl: 'default',
        getCanonicalMetadataImageUrl: (value) =>
          String(value || '')
            .trim()
            .toUpperCase(),
        sbtImageUrl: '',
        useImageUrl: true,
      }),
    ).toBe('DEFAULT');
    expect(
      resolveCreateSbtMetadataImageSource({
        defaultImageUrl: ' default ',
        getCanonicalMetadataImageUrl: (value) =>
          String(value || '')
            .trim()
            .toUpperCase(),
        sbtImageUrl: '',
      }),
    ).toBe('DEFAULT');
  });

  it('builds image preview status state', () => {
    const previewFile = { name: 'badge.png' };

    expect(
      buildCreateSbtImagePreviewState({
        sbtImageFile: previewFile,
      }),
    ).toMatchObject({
      effectiveImageStatusText: '',
      effectiveImageStatusTone: 'default',
      hasImagePreview: true,
      hasPendingImagePreview: false,
      previewFile,
      showImagePreviewError: false,
    });
    expect(
      buildCreateSbtImagePreviewState({
        sbtImageUrl: ' https://example.test/badge.png ',
        useImageUrl: true,
      }),
    ).toMatchObject({
      effectiveImageStatusText: 'Loading preview...',
      effectiveImageStatusTone: 'loading',
      hasImagePreview: false,
      hasPendingImagePreview: true,
      previewFile: null,
      showImagePreviewError: false,
    });
    expect(
      buildCreateSbtImagePreviewState({
        imageLoadError: true,
        sbtImageUrl: 'https://example.test/bad.png',
        useImageUrl: true,
      }),
    ).toMatchObject({
      effectiveImageStatusText: 'Image preview unavailable.',
      effectiveImageStatusTone: 'error',
      hasImagePreview: false,
      hasPendingImagePreview: false,
      showImagePreviewError: true,
    });
    expect(
      buildCreateSbtImagePreviewState({
        imageChooserStatusText: 'Custom status',
        imageChooserStatusTone: 'error',
        sbtImageUrl: 'https://example.test/badge.png',
        useImageUrl: true,
      }),
    ).toMatchObject({
      effectiveImageStatusText: 'Custom status',
      effectiveImageStatusTone: 'error',
      hasPendingImagePreview: true,
    });
  });
});
