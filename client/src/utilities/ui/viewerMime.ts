// One type/subtype token, as the Worker's MEDIA_TYPE_RE accepts.
const MEDIA_TYPE_RE = /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/;

// File types come from uploaders, and the Worker passes parameters such as
// ";charset=utf-8" through, so every check reads the base type only. Anything
// else, such as "image/png,text/html" (browsers use the last type of a list),
// is no type at all and reads as ''.
export const readBaseMimeType = (mime: unknown): string => {
  if (typeof mime !== 'string') return '';
  const base = mime.split(';')[0].trim().toLowerCase();
  return MEDIA_TYPE_RE.test(base) ? base : '';
};

const TEXT_LIKE_MIME_TYPES = new Set([
  'application/json',
  'application/xml',
  'application/xhtml+xml',
  'application/javascript',
  'application/x-javascript',
  'image/svg+xml',
]);

export const isTextLikeMime = (mime: unknown): boolean => {
  const base = readBaseMimeType(mime);
  return base.startsWith('text/') || TEXT_LIKE_MIME_TYPES.has(base);
};

// Raster images run nothing, unlike SVG, which can carry script.
export const isInertRasterImageMime = (mime: unknown): boolean => {
  const base = readBaseMimeType(mime);
  return base.startsWith('image/') && !base.includes('svg') && !base.includes('xml');
};

// A blob: URL has the app's own origin, so opening one in a tab runs any script
// an SVG, HTML or XML document carries as the app. Only these types run nothing.
export const isInertViewerMime = (mime: unknown): boolean => {
  const base = readBaseMimeType(mime);
  return (
    base === 'application/pdf' || base.startsWith('audio/') || base.startsWith('video/') || isInertRasterImageMime(base)
  );
};

// The blob behind a viewer link always carries the validated inert type (the
// original blob is reused only when its type is exactly that string); anything
// else becomes a plain download (application/octet-stream), never a viewable page.
export const toViewerBlob = (blob: Blob, mime: unknown): { blob: Blob; mime: string } => {
  const base = readBaseMimeType(mime || blob.type);
  if (!isInertViewerMime(base)) {
    return { blob: new Blob([blob], { type: 'application/octet-stream' }), mime: 'application/octet-stream' };
  }
  return { blob: blob.type === base ? blob : new Blob([blob], { type: base }), mime: base };
};
