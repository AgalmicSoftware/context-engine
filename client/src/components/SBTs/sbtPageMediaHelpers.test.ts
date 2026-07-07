import {
  getDisplayImageFallbackCandidateCount,
  getDisplayImageRenderState,
  getDisplayImageUrlCandidates,
  getNextDisplayImageFallbackState,
  isSbtPageImageLikeUri,
  normalizeSbtPageCanonicalMetadataHref,
  resolveDisplayImageHref,
  resolveSbtPageTokenMetadataHref,
  resolveSbtPageTokenMetadataLinkDisplayState,
} from './sbtPageMediaHelpers';

type ArweaveRuntimeGlobals = typeof globalThis & {
  CE_ARWEAVE_AR_IO_URL?: unknown;
  CE_ARWEAVE_DIRECT_TO_AR_IO?: unknown;
  CE_ARWEAVE_GATEWAY_URL?: unknown;
  CE_ARWEAVE_GATEWAYS?: unknown;
};

describe('sbtPageMediaHelpers', () => {
  const arweaveGlobals = globalThis as ArweaveRuntimeGlobals;
  const originalArweaveGlobals = {
    CE_ARWEAVE_AR_IO_URL: arweaveGlobals.CE_ARWEAVE_AR_IO_URL,
    CE_ARWEAVE_DIRECT_TO_AR_IO: arweaveGlobals.CE_ARWEAVE_DIRECT_TO_AR_IO,
    CE_ARWEAVE_GATEWAY_URL: arweaveGlobals.CE_ARWEAVE_GATEWAY_URL,
    CE_ARWEAVE_GATEWAYS: arweaveGlobals.CE_ARWEAVE_GATEWAYS,
  };

  afterEach(() => {
    arweaveGlobals.CE_ARWEAVE_AR_IO_URL = originalArweaveGlobals.CE_ARWEAVE_AR_IO_URL;
    arweaveGlobals.CE_ARWEAVE_DIRECT_TO_AR_IO = originalArweaveGlobals.CE_ARWEAVE_DIRECT_TO_AR_IO;
    arweaveGlobals.CE_ARWEAVE_GATEWAY_URL = originalArweaveGlobals.CE_ARWEAVE_GATEWAY_URL;
    arweaveGlobals.CE_ARWEAVE_GATEWAYS = originalArweaveGlobals.CE_ARWEAVE_GATEWAYS;
  });

  it('detects image-like URIs and rejects metadata/image confusion', () => {
    expect(isSbtPageImageLikeUri('data:image/png;base64,abc')).toBe(true);
    expect(isSbtPageImageLikeUri('https://example.test/image.PNG')).toBe(true);
    expect(isSbtPageImageLikeUri('https://example.test/render?format=webp')).toBe(true);
    expect(isSbtPageImageLikeUri('https://example.test/metadata.json')).toBe(false);
    expect(isSbtPageImageLikeUri('not a url')).toBe(false);
  });

  it('normalizes token metadata links while rejecting images and data URIs', () => {
    const txId = 'Sng0VG2vetgNPITw5mtvt6om-fBCNu3KI5GZAYeEttY';
    arweaveGlobals.CE_ARWEAVE_DIRECT_TO_AR_IO = true;
    arweaveGlobals.CE_ARWEAVE_AR_IO_URL = 'https://ar-io.dev';

    expect(normalizeSbtPageCanonicalMetadataHref(`ar://${txId}`)).toBe(`https://ar-io.dev/${txId}`);
    expect(normalizeSbtPageCanonicalMetadataHref('data:application/json,%7B%7D')).toBe('');
    expect(normalizeSbtPageCanonicalMetadataHref('https://cdn.example.test/preview.png')).toBe('');
    expect(normalizeSbtPageCanonicalMetadataHref('https://example.test/metadata.json')).toBe(
      'https://example.test/metadata.json',
    );
  });

  it('resolves embedded token metadata links by SBT-specific field precedence', () => {
    const sbtTxId = 'GfaX7MhJndTePSYdECj8VJmFQ5m2KDtDMU8fHgUTw24';
    const sessionTxId = 'ue3Ek_Mh1ypNvvCaGlfrntt_8HxJ9CDiwDlG06uoTpY';
    arweaveGlobals.CE_ARWEAVE_DIRECT_TO_AR_IO = true;
    arweaveGlobals.CE_ARWEAVE_AR_IO_URL = 'https://ar-io.dev';
    const dataUriPayload = Buffer.from(
      JSON.stringify({
        tokenURI: `ar://${sbtTxId}`,
        metadataUri: `ar://${sessionTxId}`,
        uri: 'https://cdn.example.test/banner.webp',
      }),
      'utf8',
    ).toString('base64');

    const href = resolveSbtPageTokenMetadataHref(`data:application/json;base64,${dataUriPayload}`);

    expect(href).toBe(`https://ar-io.dev/${sbtTxId}`);
    expect(href).not.toContain(sessionTxId);
  });

  it('uses later embedded metadata fields when earlier token fields are image-like', () => {
    const txId = '4kpvO6qf-tN4l0R9vQh-Sz6ekU2xq9j5qM4R1X3vZkA';
    const dataUriPayload = Buffer.from(
      JSON.stringify({
        tokenURI: 'https://cdn.example.test/also-image.jpg',
        uri: 'https://cdn.example.test/banner.webp',
        metadataUri: `ar://${txId}`,
      }),
      'utf8',
    ).toString('base64');

    const href = resolveSbtPageTokenMetadataHref(`data:application/json;base64,${dataUriPayload}`);

    expect(href).toContain(txId);
    expect(href).not.toContain('also-image.jpg');
    expect(
      resolveSbtPageTokenMetadataHref(
        `data:application/json,${encodeURIComponent(
          JSON.stringify({
            tokenURI: 'https://cdn.example.test/also-image.jpg',
            uri: 'https://cdn.example.test/banner.webp',
          }),
        )}`,
      ),
    ).toBe('');
  });

  it('describes token metadata link display state without mutating inputs', () => {
    const txId = 'Sng0VG2vetgNPITw5mtvt6om-fBCNu3KI5GZAYeEttY';
    arweaveGlobals.CE_ARWEAVE_DIRECT_TO_AR_IO = true;
    arweaveGlobals.CE_ARWEAVE_AR_IO_URL = 'https://ar-io.dev';
    const args = { tokenUriRaw: `ar://${txId}` };

    expect(resolveSbtPageTokenMetadataLinkDisplayState(args)).toEqual({
      href: `https://ar-io.dev/${txId}`,
      shouldRenderLink: true,
    });
    expect(args).toEqual({ tokenUriRaw: `ar://${txId}` });
    expect(
      resolveSbtPageTokenMetadataLinkDisplayState({
        tokenUriRaw: 'https://cdn.example.test/preview.png',
      }),
    ).toEqual({
      href: '',
      shouldRenderLink: false,
    });
    expect(resolveSbtPageTokenMetadataLinkDisplayState()).toEqual({
      href: '',
      shouldRenderLink: false,
    });
  });

  it('builds display image candidates and falls back to the default image', () => {
    const defaultImage = '/static/default-sbt.png';
    const imageUrl = 'https://example.test/badge.png';

    expect(getDisplayImageUrlCandidates({ image: imageUrl })).toEqual([imageUrl]);
    expect(resolveDisplayImageHref({ image: imageUrl }, defaultImage)).toBe(imageUrl);
    expect(resolveDisplayImageHref({ image: '' }, defaultImage)).toBe(defaultImage);
    expect(getDisplayImageRenderState({ image: '' }, {}, defaultImage)).toEqual({
      sourceKey: '',
      candidates: [],
      activeIndex: 0,
      src: defaultImage,
      canRetry: false,
    });
  });

  it('falls back to the default image after the preferred Arweave image candidate fails', () => {
    const txId = 'DqYBh1qm9GvaTOGkF5R7abnLoB3OPiXNNBcTsYPtlRc';
    arweaveGlobals.CE_ARWEAVE_DIRECT_TO_AR_IO = true;
    arweaveGlobals.CE_ARWEAVE_AR_IO_URL = 'https://ar-io.dev';

    const image = `ar://${txId}`;
    const firstState = getDisplayImageRenderState({ image }, {}, '/default.png');
    expect(firstState.sourceKey).toBe(image);
    expect(firstState.activeIndex).toBe(0);
    expect(firstState.src).toBe(`https://arweave.net/${txId}`);
    expect(firstState.canRetry).toBe(true);
    expect(firstState.candidates).toEqual([`https://arweave.net/${txId}`, `https://gateway.irys.xyz/${txId}`]);

    const fallbackState = getDisplayImageRenderState(
      { image },
      {
        displayImageFallbackKey: image,
        displayImageFallbackIndex: 1,
      },
      '/default.png',
    );
    expect(fallbackState.activeIndex).toBe(1);
    expect(fallbackState.src).toBe(`https://gateway.irys.xyz/${txId}`);

    const defaultFallbackState = getDisplayImageRenderState(
      { image },
      {
        displayImageFallbackKey: image,
        displayImageFallbackIndex: 2,
      },
      '/default.png',
    );
    expect(defaultFallbackState.activeIndex).toBe(2);
    expect(defaultFallbackState.src).toBe('/default.png');
    expect(defaultFallbackState.canRetry).toBe(false);
  });

  it('builds the next display image fallback state only from the active failed candidate', () => {
    expect(getDisplayImageFallbackCandidateCount(['a', 'b'])).toBe(2);
    expect(getDisplayImageFallbackCandidateCount('bad')).toBe(0);
    expect(getNextDisplayImageFallbackState({ sourceKey: 'image-a', activeIndex: 0, maxIndex: 2 }, {})).toEqual({
      displayImageFallbackKey: 'image-a',
      displayImageFallbackIndex: 1,
    });
    expect(
      getNextDisplayImageFallbackState(
        { sourceKey: 'image-a', activeIndex: 1, maxIndex: 2 },
        { displayImageFallbackKey: 'image-a', displayImageFallbackIndex: 1 },
      ),
    ).toEqual({
      displayImageFallbackKey: 'image-a',
      displayImageFallbackIndex: 2,
    });
    expect(
      getNextDisplayImageFallbackState(
        { sourceKey: 'image-a', activeIndex: 1, maxIndex: 2 },
        { displayImageFallbackKey: 'image-a', displayImageFallbackIndex: 0 },
      ),
    ).toBeNull();
  });
});
