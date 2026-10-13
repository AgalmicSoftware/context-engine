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

  // Browsers use the LAST type of a comma-separated list, so "image/png,text/html"
  // would run as HTML. Only a single type/subtype token counts as a type at all.
  const notOneMediaType = [
    'image/png,text/html',
    'audio/mpeg,text/html',
    'video/mp4,image/svg+xml',
    'audio/ogg,application/xhtml+xml',
    'image/png text/html',
    'image/png\ttext/html',
    'imagé/png',
    'image/',
    '/png',
    'image',
    '',
    ' ',
  ];

  it('accepts only one type/subtype token as a type', () => {
    for (const mime of notOneMediaType) {
      expect(readBaseMimeType(mime)).toBe('');
      expect(readBaseMimeType(`${mime};charset=utf-8`)).toBe('');
      expect(isInertViewerMime(mime)).toBe(false);
      expect(isInertRasterImageMime(mime)).toBe(false);
      expect(isTextLikeMime(mime)).toBe(false);
    }
  });

  it('turns a blob with a type list into a plain download, whatever is declared', () => {
    for (const mime of notOneMediaType) {
      const fromBlob = toViewerBlob(new Blob(['<html onload="alert(1)">'], { type: mime }), '');
      expect(fromBlob.blob.type).toBe('application/octet-stream');
      expect(fromBlob.mime).toBe('application/octet-stream');
    }
    // A valid declared type still rebuilds a blob that carries a list of its own.
    const declared = toViewerBlob(new Blob(['png'], { type: 'image/png,text/html' }), 'image/png');
    expect(declared.blob.type).toBe('image/png');
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
