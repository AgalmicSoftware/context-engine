import {
  STORAGE_BACKENDS,
  assertNoCloudflarePrivateMaterial,
  isArweaveStorageBackend,
  isSafeCloudflareStorageRefId,
  normalizeStorageBackend,
  normalizeStorageRef,
} from './storageRefNormalization.js';

const encoder = new TextEncoder();
const toStr = (value) => (typeof value === 'string' ? value : value == null ? '' : String(value));
const trim = (value) => toStr(value).trim();
const isObj = (value) => !!value && typeof value === 'object' && !Array.isArray(value);

const getStorageR2Binding = (env = {}) => env.CE_STORAGE_R2 || env.STORAGE_R2 || env.R2_BUCKET || null;
const getStorageIndexBinding = (env = {}) => env.CE_STORAGE_INDEX_KV || env.STORAGE_INDEX_KV || env.STORAGE_KV || null;

const safeSlugPart = (value) => trim(value || 'general').toLowerCase().replace(/[^a-z0-9._:-]+/g, '-').replace(/^-+|-+$/g, '') || 'general';
const buildCloudflareStorageId = ({ randomUUID, now = Date.now } = {}) => {
  const raw = typeof randomUUID === 'function'
    ? randomUUID()
    : `ts-${now()}-${Math.random().toString(36).slice(2)}`;
  return `cf_${trim(raw).toLowerCase().replace(/[^a-z0-9._:-]+/g, '')}`.slice(0, 120);
};
const buildObjectKey = ({ slug, id }) => `sessions/${safeSlugPart(slug)}/storage/${id}`;
const buildIndexKey = ({ slug, resource, id }) => `ce-storage:${safeSlugPart(slug)}:${trim(resource) || 'docsContext'}:${id}`;
const buildIndexPrefix = ({ slug, resource }) => `ce-storage:${safeSlugPart(slug)}:${trim(resource) || 'docsContext'}:`;

const normalizeTagsForMetadata = (tagsInput) => {
  let tags = tagsInput;
  if (typeof tagsInput === 'string' && tagsInput.trim()) {
    try { tags = JSON.parse(tagsInput); } catch { tags = []; }
  }
  return (Array.isArray(tags) ? tags : [])
    .filter((tag) => tag && typeof tag === 'object')
    .map((tag) => ({ name: trim(tag.name), value: trim(tag.value) }))
    .filter((tag) => tag.name && tag.value !== '');
};

const readJsonPayload = async (request) => {
  let raw = null;
  try {
    raw = await (typeof request?.clone === 'function' ? request.clone() : request).json();
  } catch {
    return { ok: false, error: 'Invalid JSON.' };
  }
  if (!isObj(raw)) return { ok: false, error: 'Invalid JSON.' };
  const data = Object.prototype.hasOwnProperty.call(raw, 'data') ? raw.data : '';
  const contentType = trim(raw.contentType) || (typeof data === 'string' ? 'text/plain' : 'application/json');
  const serialized = contentType === 'application/json' && typeof data !== 'string'
    ? JSON.stringify(data)
    : toStr(data);
  return {
    ok: true,
    payload: {
      bytes: encoder.encode(serialized),
      contentType,
      backend: raw.backend || raw.storageBackend || raw.storage,
      resource: trim(raw.resource) || 'docsContext',
      gate: raw.gate || raw.gateResource || raw.resourceGate,
      tags: normalizeTagsForMetadata(raw.tags),
      payloadEncrypted: raw.payloadEncrypted === true || raw.encrypted === true,
      requestId: trim(raw.requestId),
    },
  };
};

const readMultipartPayload = async (request) => {
  let form;
  try {
    form = await (typeof request?.clone === 'function' ? request.clone() : request).formData();
  } catch {
    return { ok: false, error: 'Expected multipart/form-data.' };
  }
  const fileOrBlob = form.get('file') || form.get('data');
  if (!fileOrBlob || typeof fileOrBlob.arrayBuffer !== 'function') {
    return { ok: false, error: 'Missing "file" or "data" field.' };
  }
  const buf = await fileOrBlob.arrayBuffer();
  return {
    ok: true,
    payload: {
      bytes: new Uint8Array(buf),
      contentType: trim(form.get('contentType')) || fileOrBlob.type || 'application/octet-stream',
      backend: form.get('backend') || form.get('storageBackend') || form.get('storage'),
      resource: trim(form.get('resource')) || 'docsContext',
      gate: form.get('gate') || form.get('gateResource') || form.get('resourceGate'),
      tags: normalizeTagsForMetadata(form.get('tags')),
      payloadEncrypted: trim(form.get('payloadEncrypted') || form.get('encrypted')).toLowerCase() === 'true',
      requestId: trim(form.get('requestId')),
    },
  };
};

export const readStorageUploadRequestPayload = async (request) => {
  const contentType = request?.headers?.get?.('content-type') || '';
  if (contentType.includes('multipart/form-data')) return readMultipartPayload(request);
  if (contentType.includes('application/json')) return readJsonPayload(request);
  return { ok: false, error: 'Unsupported Content-Type.' };
};

const resolveConfiguredStorageBackend = ({ config, requestedBackend, payloadEncrypted }) => {
  const configured = normalizeStorageBackend(config?.storageProfile?.backend || config?.storageBackend);
  if (configured === STORAGE_BACKENDS.CLOUDFLARE || configured === STORAGE_BACKENDS.LIT_ARWEAVE) return configured;
  if (payloadEncrypted) return STORAGE_BACKENDS.LIT_ARWEAVE;
  return normalizeStorageBackend(requestedBackend, configured);
};

const responseJson = (deps, body, status, headers) => deps?.json?.(body, status, headers) || new Response(JSON.stringify(body), { status, headers });

const parseArweaveUploadResponse = async (response) => {
  let body = {};
  try { body = await response.clone().json(); } catch { body = {}; }
  const id = trim(body.id || body.txId || body.arweaveTxId || body.url || body.arweaveUrl);
  return { body, id };
};

const handleArweaveStorageUpload = async ({ request, config, slug, uploaderAddress, backend, baseHeaders, deps }) => {
  const secrets = (await deps?.getSessionSecrets?.(slug)) || {};
  const response = await deps?.arweaveUpload?.({
    request,
    secrets,
    baseHeaders,
    config,
    slug,
    uploaderAddress,
  });
  if (!response?.ok) return response;
  const parsed = await parseArweaveUploadResponse(response);
  if (!parsed.id) return responseJson(deps, { error: 'Storage upload succeeded but no id was returned.' }, 502, baseHeaders);
  const storageRef = normalizeStorageRef({
    backend,
    id: parsed.id,
    encrypted: backend === STORAGE_BACKENDS.LIT_ARWEAVE,
  });
  return responseJson(deps, {
    id: parsed.id,
    arweaveTxId: parsed.id,
    storageRef,
  }, 200, baseHeaders);
};

const handleCloudflareUpload = async ({ env, slug, payload, baseHeaders, deps }) => {
  const r2 = getStorageR2Binding(env);
  if (!r2 || typeof r2.put !== 'function') {
    return responseJson(deps, { error: 'Cloudflare storage binding not configured.' }, 501, baseHeaders);
  }

  const id = buildCloudflareStorageId({ randomUUID: deps?.randomUUID, now: deps?.now });
  if (!isSafeCloudflareStorageRefId(id)) {
    return responseJson(deps, { error: 'Failed to create safe Cloudflare storage reference.' }, 500, baseHeaders);
  }
  const createdAt = new Date((deps?.now?.() || Date.now())).toISOString();
  const objectKey = buildObjectKey({ slug, id });
  const resource = trim(payload.resource) || 'docsContext';
  const metadata = {
    id,
    backend: STORAGE_BACKENDS.CLOUDFLARE,
    resource,
    contentType: trim(payload.contentType) || 'application/octet-stream',
    encrypted: payload.payloadEncrypted === true,
    gate: trim(payload.gate),
    tags: payload.tags,
    size: payload.bytes?.length || 0,
    createdAt,
  };
  assertNoCloudflarePrivateMaterial(metadata);

  await r2.put(objectKey, payload.bytes, {
    httpMetadata: { contentType: metadata.contentType },
    customMetadata: {
      id,
      resource,
      encrypted: metadata.encrypted ? 'true' : 'false',
    },
  });

  const index = getStorageIndexBinding(env);
  if (index && typeof index.put === 'function') {
    await index.put(buildIndexKey({ slug, resource, id }), JSON.stringify(metadata));
  }

  const storageRef = normalizeStorageRef(metadata);
  return responseJson(deps, {
    id,
    storageRef,
  }, 200, baseHeaders);
};

const readRequestId = async ({ request, url }) => {
  const fromQuery = trim(url.searchParams.get('id') || url.searchParams.get('storageId'));
  if (fromQuery) return fromQuery;
  if (request.method.toUpperCase() !== 'POST') return '';
  try {
    const body = await (typeof request?.clone === 'function' ? request.clone() : request).json();
    return trim(body?.id || body?.storageId || body?.storageRef?.id);
  } catch {
    return '';
  }
};

const handleCloudflareRead = async ({ request, env, slug, baseHeaders, deps }) => {
  const url = new URL(request.url);
  const id = await readRequestId({ request, url });
  if (!isSafeCloudflareStorageRefId(id)) return responseJson(deps, { error: 'Invalid storage id.' }, 400, baseHeaders);
  const r2 = getStorageR2Binding(env);
  if (!r2 || typeof r2.get !== 'function') {
    return responseJson(deps, { error: 'Cloudflare storage binding not configured.' }, 501, baseHeaders);
  }
  const object = await r2.get(buildObjectKey({ slug, id }));
  if (!object) return responseJson(deps, { error: 'Storage object not found.' }, 404, baseHeaders);
  const contentType = trim(object?.httpMetadata?.contentType || object?.customMetadata?.contentType) || 'application/octet-stream';
  let body = object?.body || object;
  if (typeof object?.arrayBuffer === 'function') {
    body = await object.arrayBuffer();
  } else if (typeof object?.text === 'function') {
    body = await object.text();
  }
  return new Response(body, {
    status: 200,
    headers: {
      ...baseHeaders,
      'Content-Type': contentType,
      'X-CE-Storage-Backend': STORAGE_BACKENDS.CLOUDFLARE,
      'X-CE-Storage-Ref': id,
    },
  });
};

const handleCloudflareList = async ({ request, env, slug, baseHeaders, deps }) => {
  const url = new URL(request.url);
  const resource = trim(url.searchParams.get('resource')) || 'docsContext';
  const index = getStorageIndexBinding(env);
  if (!index || typeof index.list !== 'function') {
    return responseJson(deps, { error: 'Cloudflare storage index binding not configured.' }, 501, baseHeaders);
  }
  const listed = await index.list({ prefix: buildIndexPrefix({ slug, resource }) });
  const keys = Array.isArray(listed?.keys) ? listed.keys : [];
  const items = [];
  for (const keyEntry of keys) {
    const name = trim(keyEntry?.name || keyEntry);
    if (!name || typeof index.get !== 'function') continue;
    try {
      // eslint-disable-next-line no-await-in-loop
      const raw = await index.get(name);
      const metadata = typeof raw === 'string' ? JSON.parse(raw) : raw;
      const storageRef = normalizeStorageRef(metadata || {});
      if (storageRef) {
        items.push({
          storageRef,
          metadata: {
            resource: storageRef.resource || resource,
            contentType: trim(metadata?.contentType),
            encrypted: metadata?.encrypted === true,
            tags: normalizeTagsForMetadata(metadata?.tags),
            size: Number(metadata?.size || 0) || 0,
            createdAt: trim(metadata?.createdAt),
          },
        });
      }
    } catch {
      // ignore malformed index rows
    }
  }
  return responseJson(deps, { items }, 200, baseHeaders);
};

export const storageRoute = async ({ path, method, request, env, config, slug, uploaderAddress, baseHeaders, deps } = {}) => {
  if (path === '/storage/upload' && method === 'POST') {
    const uploadPayload = await (deps?.readStorageUploadRequestPayload || readStorageUploadRequestPayload)(request);
    if (!uploadPayload?.ok) return responseJson(deps, { error: uploadPayload?.error || 'Invalid storage upload payload.' }, 400, baseHeaders);
    const payload = uploadPayload.payload || {};
    const backend = resolveConfiguredStorageBackend({
      config,
      requestedBackend: payload.backend,
      payloadEncrypted: payload.payloadEncrypted,
    });
    if (isArweaveStorageBackend(backend)) {
      return handleArweaveStorageUpload({ request, config, slug, uploaderAddress, backend, baseHeaders, deps });
    }
    return handleCloudflareUpload({ env, slug, payload, baseHeaders, deps });
  }

  const configuredBackend = normalizeStorageBackend(config?.storageProfile?.backend || config?.storageBackend);
  if (configuredBackend !== STORAGE_BACKENDS.CLOUDFLARE) {
    return responseJson(deps, { error: 'Storage route read/list is only available for Cloudflare storage.' }, 400, baseHeaders);
  }
  if (path === '/storage/read' && (method === 'GET' || method === 'POST')) {
    return handleCloudflareRead({ request, env, slug, baseHeaders, deps });
  }
  if (path === '/storage/list' && (method === 'GET' || method === 'POST')) {
    return handleCloudflareList({ request, env, slug, baseHeaders, deps });
  }

  return responseJson(deps, { error: 'Not found.' }, 404, baseHeaders);
};
