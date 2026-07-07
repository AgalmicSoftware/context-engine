import {
  rejectBytesOverLimit,
  rejectContentLengthOverLimit,
  resolveMaxUploadBytes,
} from './uploadSizeLimits.js';

const hasOwn = Object.prototype.hasOwnProperty;
const encoder = new TextEncoder();

export const normalizeArweaveUploadJsonPayload = (raw, { maxUploadBytes } = {}) => {
  const source = raw && typeof raw === 'object' ? raw : {};
  if (!hasOwn.call(source, 'data')) {
    return {
      ok: false,
      error: 'Missing "data" in JSON body',
      payload: null,
    };
  }

  const rawData = typeof source.data === 'string' ? source.data : JSON.stringify(source.data);
  const bytes = encoder.encode(rawData);
  const tooLarge = rejectBytesOverLimit({ bytes, maxUploadBytes });
  if (tooLarge) return tooLarge;
  return {
    ok: true,
    error: '',
    payload: {
      bytes,
      contentType: source.contentType || 'application/json',
      tagsInput: hasOwn.call(source, 'tags') ? source.tags : null,
      requestId: source?.requestId != null
        ? typeof source.requestId === 'string'
          ? source.requestId.trim()
          : String(source.requestId)
        : '',
      providedJwk: source?.arweaveJwk ? source.arweaveJwk : null,
    },
  };
};

const readMultipartArweaveUploadPayload = async (request, { maxUploadBytes } = {}) => {
  let form;
  try {
    const source = typeof request?.clone === 'function' ? request.clone() : request;
    form = await source.formData();
  } catch {
    return {
      ok: false,
      error: 'Expected multipart/form-data',
      payload: null,
    };
  }

  const fileOrBlob = form.get('file') || form.get('data');
  if (!fileOrBlob) {
    return {
      ok: false,
      error: 'Missing "file" or "data" field',
      payload: null,
    };
  }

  const buf = await fileOrBlob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  const tooLarge = rejectBytesOverLimit({ bytes, maxUploadBytes });
  if (tooLarge) return tooLarge;
  const formRequestId = form.get('requestId');
  const formJwk = form.get('arweaveJwk');

  return {
    ok: true,
    error: '',
    payload: {
      bytes,
      contentType: form.get('contentType') || fileOrBlob.type || 'application/octet-stream',
      tagsInput: form.has('tags') ? form.get('tags') : null,
      requestId: typeof formRequestId === 'string' && formRequestId.trim()
        ? formRequestId.trim()
        : '',
      providedJwk: typeof formJwk === 'string' && formJwk.trim()
        ? formJwk.trim()
        : null,
    },
  };
};

const readJsonArweaveUploadPayload = async (request, { maxUploadBytes } = {}) => {
  let raw;
  try {
    const source = typeof request?.clone === 'function' ? request.clone() : request;
    raw = await source.json();
  } catch {
    return {
      ok: false,
      error: 'Invalid JSON',
      payload: null,
    };
  }

  return normalizeArweaveUploadJsonPayload(raw, { maxUploadBytes });
};

export const readArweaveUploadRequestPayload = async (request, options = {}) => {
  const contentType = request.headers.get('content-type') || '';
  const maxUploadBytes = resolveMaxUploadBytes(options);
  const contentLengthRejection = rejectContentLengthOverLimit({ request, maxUploadBytes });
  if (contentLengthRejection) return contentLengthRejection;

  if (contentType.includes('multipart/form-data')) {
    return readMultipartArweaveUploadPayload(request, { maxUploadBytes });
  }
  if (contentType.includes('application/json')) {
    return readJsonArweaveUploadPayload(request, { maxUploadBytes });
  }

  return {
    ok: false,
    error: 'Unsupported Content-Type',
    payload: null,
  };
};
