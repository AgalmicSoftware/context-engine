import { normalizeSignedWorkerRequest } from './signedRequestNormalization.js';
import { toStr } from './stringCoercion.js';

const hasOwn = Object.prototype.hasOwnProperty;

const hasProvidedArweaveJwk = (value) => (
  (typeof value === 'string' && value.trim().length > 0) ||
  (typeof value === 'object' && value != null)
);

export const normalizeArweaveBootstrapUploadPayload = (raw) => {
  const source = raw && typeof raw === 'object' ? raw : {};
  const body = {
    ...normalizeSignedWorkerRequest(source),
  };

  if (hasOwn.call(source, 'sessionSlug') && source.sessionSlug != null) {
    body.sessionSlug = toStr(source.sessionSlug).trim();
  }
  if (hasOwn.call(source, 'groupSlug') && source.groupSlug != null) {
    body.groupSlug = toStr(source.groupSlug).trim();
  }
  if (hasOwn.call(source, 'arweaveJwk') && source.arweaveJwk != null) {
    body.arweaveJwk = source.arweaveJwk;
  }

  return {
    ok: true,
    error: '',
    body,
    hasProvidedArweaveJwk: hasProvidedArweaveJwk(source.arweaveJwk),
  };
};

const readMultipartBootstrapUploadPayload = async (request) => {
  try {
    const form = await request.clone().formData();
    const raw = {
      address: form.get('address'),
      message: form.get('message'),
      signature: form.get('signature'),
      requestId: form.get('requestId'),
    };

    if (form.has('sessionSlug')) raw.sessionSlug = form.get('sessionSlug');
    if (form.has('groupSlug')) raw.groupSlug = form.get('groupSlug');
    if (form.has('arweaveJwk')) raw.arweaveJwk = form.get('arweaveJwk');

    return normalizeArweaveBootstrapUploadPayload(raw);
  } catch {
    return {
      ok: false,
      error: 'Expected multipart/form-data.',
      body: null,
      hasProvidedArweaveJwk: false,
    };
  }
};

const readJsonBootstrapUploadPayload = async (request) => {
  try {
    const raw = await request.clone().json();
    return normalizeArweaveBootstrapUploadPayload(raw);
  } catch {
    return {
      ok: false,
      error: 'Invalid JSON.',
      body: null,
      hasProvidedArweaveJwk: false,
    };
  }
};

export const readArweaveBootstrapUploadPayload = async (request) => {
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    return readMultipartBootstrapUploadPayload(request);
  }
  if (contentType.includes('application/json')) {
    return readJsonBootstrapUploadPayload(request);
  }

  return {
    ok: false,
    error: 'Unsupported Content-Type.',
    body: null,
    hasProvidedArweaveJwk: false,
  };
};
