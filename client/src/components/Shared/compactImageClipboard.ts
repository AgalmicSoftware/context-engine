const CLIPBOARD_GENERIC_ERROR = 'Clipboard does not contain a supported image or URL.';
const ARWEAVE_TXID_RE = /^[A-Za-z0-9_-]{43}$/;

const SUPPORTED_IMAGE_MIME_TO_EXT: Record<string, string> = Object.freeze({
  'image/png': 'png',
  'image/jpeg': 'jpeg',
  'image/jpg': 'jpg',
  'image/gif': 'gif',
});

const toText = (value: unknown): string => (typeof value === 'string' ? value : value == null ? '' : String(value));

const isSupportedArweaveReference = (value: unknown): boolean => {
  const raw = toText(value).trim();
  if (!raw) return false;
  if (ARWEAVE_TXID_RE.test(raw)) return true;
  const arweaveMatch = raw.match(/^ar:\/\/([^/?#]+)/i);
  return ARWEAVE_TXID_RE.test(arweaveMatch?.[1] || '');
};

const isSupportedRelativeAssetPath = (value: unknown): boolean => /^assets\/\S+$/i.test(toText(value).trim());

const isSupportedClipboardText = (value: unknown): boolean => {
  const raw = toText(value).trim();
  if (!raw) return false;
  if (isSupportedArweaveReference(raw)) return true;
  if (isSupportedRelativeAssetPath(raw)) return true;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch (_) {
    return false;
  }
};

const buildClipboardFile = ({
  blob,
  imageType,
  fileNamePrefix,
}: {
  blob?: Blob | null;
  imageType?: unknown;
  fileNamePrefix?: unknown;
}) => {
  if (!(blob instanceof Blob)) return null;
  const normalizedType = toText(blob.type || imageType)
    .trim()
    .toLowerCase();
  const extension = SUPPORTED_IMAGE_MIME_TO_EXT[normalizedType];
  if (!extension) return null;
  const fileName = `${toText(fileNamePrefix).trim() || 'clipboard-image'}.${extension}`;

  if (typeof File !== 'undefined') {
    return new File([blob], fileName, { type: blob.type || normalizedType });
  }

  try {
    Object.defineProperty(blob, 'name', {
      configurable: true,
      value: fileName,
    });
  } catch (_) {}

  return blob;
};

export const readCompactImageClipboard = async ({
  fileNamePrefix = 'clipboard-image',
}: { fileNamePrefix?: unknown } = {}) => {
  if (typeof navigator === 'undefined' || !navigator.clipboard) {
    return { error: CLIPBOARD_GENERIC_ERROR };
  }

  if (typeof navigator.clipboard.read === 'function') {
    try {
      const items = await navigator.clipboard.read();
      for (const item of Array.isArray(items) ? items : []) {
        const imageType = (Array.isArray(item?.types) ? item.types : [])
          .map((type) => toText(type).trim().toLowerCase())
          .find((type) => !!SUPPORTED_IMAGE_MIME_TO_EXT[type]);
        if (!imageType || typeof item?.getType !== 'function') continue;
        const blob = await item.getType(imageType);
        const file = buildClipboardFile({ blob, imageType, fileNamePrefix });
        if (file) return { kind: 'file', file };
      }
    } catch (_) {
      // Fall back to text clipboard support below.
    }
  }

  if (typeof navigator.clipboard.readText !== 'function') {
    return { error: CLIPBOARD_GENERIC_ERROR };
  }

  try {
    const text = toText(await navigator.clipboard.readText()).trim();
    if (!isSupportedClipboardText(text)) {
      return { error: CLIPBOARD_GENERIC_ERROR };
    }
    return { kind: 'text', text };
  } catch (_) {
    return { error: CLIPBOARD_GENERIC_ERROR };
  }
};

export { CLIPBOARD_GENERIC_ERROR, SUPPORTED_IMAGE_MIME_TO_EXT };
