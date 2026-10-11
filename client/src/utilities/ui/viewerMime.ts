// File types come from uploaders, and the Worker passes parameters such as
// ";charset=utf-8" through, so every check reads the base type only.
export const readBaseMimeType = (mime: unknown): string =>
  typeof mime === 'string' ? mime.split(';')[0].trim().toLowerCase() : '';

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

// A blob: URL has the app's own origin, so opening one in a tab runs any script
// an SVG, HTML or XML document carries as the app. Only these types run nothing.
export const isInertViewerMime = (mime: unknown): boolean => {
  const base = readBaseMimeType(mime);
  return (
    base === 'application/pdf' ||
    base.startsWith('audio/') ||
    base.startsWith('video/') ||
    (base.startsWith('image/') && !base.includes('svg') && !base.includes('xml'))
  );
};

// The blob behind a viewer link gets an inert type of its own; anything else
// becomes a plain download (application/octet-stream), never a viewable page.
export const toViewerBlob = (blob: Blob, mime: unknown): { blob: Blob; mime: string } => {
  const base = readBaseMimeType(mime || blob.type);
  if (!isInertViewerMime(base)) {
    return { blob: new Blob([blob], { type: 'application/octet-stream' }), mime: 'application/octet-stream' };
  }
  return { blob: blob.type === base ? blob : new Blob([blob], { type: base }), mime: base };
};
