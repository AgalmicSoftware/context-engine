import {
  isInertRasterImageMime,
  isInertViewerMime,
  isTextLikeMime,
  readBaseMimeType,
  toViewerBlob,
} from './viewerMime';

describe('viewerMime', () => {
  it('reads the base type without parameters, case or padding', () => {
    expect(readBaseMimeType(' Image/SVG+XML ; charset=utf-8')).toBe('image/svg+xml');
    expect(readBaseMimeType('text/plain')).toBe('text/plain');
    expect(readBaseMimeType('')).toBe('');
    expect(readBaseMimeType(JSON.parse('{"toString":1}'))).toBe('');
  });

  it('treats markup and script types as text even with parameters', () => {
    for (const mime of [
      'image/svg+xml;charset=utf-8',
      'application/xhtml+xml; charset=utf-8',
      'application/xml;charset=utf-8',
      'TEXT/HTML;charset=utf-8',
      'application/javascript;charset=utf-8',
      'application/json;charset=utf-8',
    ]) {
      expect(isTextLikeMime(mime)).toBe(true);
    }
    expect(isTextLikeMime('image/png')).toBe(false);
    expect(isTextLikeMime('')).toBe(false);
  });

  it('lets only types that run nothing open as app-origin blobs', () => {
    for (const mime of ['image/png', 'image/jpeg;x=1', 'application/pdf', 'audio/mpeg', 'video/mp4']) {
      expect(isInertViewerMime(mime)).toBe(true);
    }
    for (const mime of [
      'image/svg+xml',
      'image/svg+xml;charset=utf-8',
      'text/html',
      'application/xhtml+xml',
      'application/xml',
      'application/octet-stream',
      'application/x-msdownload',
      '',
    ]) {
      expect(isInertViewerMime(mime)).toBe(false);
    }
  });

  it('accepts only raster images where an image is shown', () => {
    for (const mime of ['image/png', 'image/jpeg;x=1', 'image/webp', 'IMAGE/GIF']) {
      expect(isInertRasterImageMime(mime)).toBe(true);
    }
    for (const mime of [
      'image/svg+xml',
      'image/svg+xml;charset=utf-8',
      'application/pdf',
      'video/mp4',
      'text/html',
      '',
    ]) {
      expect(isInertRasterImageMime(mime)).toBe(false);
    }
  });

  it('builds viewer blobs whose own type is inert, or a plain download', () => {
    const png = toViewerBlob(new Blob(['png'], { type: 'image/png;charset=binary' }), 'image/png;charset=binary');
    expect(png.mime).toBe('image/png');
    expect(png.blob.type).toBe('image/png');

    // The declared type decides, so a blob claiming another type is retyped too.
    const relabeled = toViewerBlob(new Blob(['<svg/>'], { type: 'image/svg+xml' }), 'image/png');
    expect(relabeled.blob.type).toBe('image/png');

    for (const mime of ['image/svg+xml;charset=utf-8', 'application/xhtml+xml', 'application/x-msdownload', '']) {
      const download = toViewerBlob(new Blob(['<svg onload="alert(1)"/>'], { type: mime }), mime);
      expect(download.mime).toBe('application/octet-stream');
      expect(download.blob.type).toBe('application/octet-stream');
    }
  });
});
