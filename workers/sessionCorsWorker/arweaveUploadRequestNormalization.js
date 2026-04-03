const hasOwn = Object.prototype.hasOwnProperty;
const encoder = new TextEncoder();

export const normalizeArweaveUploadJsonPayload = (raw) => {
  const source = raw && typeof raw === 'object' ? raw : {};
  if (!hasOwn.call(source, 'data')) {
    return {
      ok: false,
      error: 'Missing "data" in JSON body',
      payload: null,
    };
  }

  const rawData = typeof source.data === 'string' ? source.data : JSON.stringify(source.data);
  return {
    ok: true,
    error: '',
    payload: {
      bytes: encoder.encode(rawData),
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

const readMultipartArweaveUploadPayload = async (request) => {
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
  const formRequestId = form.get('requestId');
  const formJwk = form.get('arweaveJwk');

  return {
    ok: true,
    error: '',
    payload: {
      bytes: new Uint8Array(buf),
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

const readJsonArweaveUploadPayload = async (request) => {
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

  return normalizeArweaveUploadJsonPayload(raw);
};

export const readArweaveUploadRequestPayload = async (request) => {
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    return readMultipartArweaveUploadPayload(request);
  }
  if (contentType.includes('application/json')) {
    return readJsonArweaveUploadPayload(request);
  }

  return {
    ok: false,
    error: 'Unsupported Content-Type',
    payload: null,
  };
};
