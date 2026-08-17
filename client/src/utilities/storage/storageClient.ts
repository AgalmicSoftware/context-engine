/** @file storageClient.ts */

import { arweaveClient } from '../arweave/arweaveClient.js';
import { getCorsProxyUrlOrThrow } from '../worker/corsProxy.js';
import { fetchWorkerWithAuth } from '../worker/workerAuth.js';
import { defaultStrictAllowDemoFallback } from '../worker/workerSessionResolution.js';
import { toStr } from '../shared/primitives.js';
import { STORAGE_BACKENDS, normalizeStorageRef } from './storageRefs.js';
import {
  SESSION_STORAGE_PAYLOAD_ACCESS_MODES,
  normalizeSessionStorageConfig,
  resolveSessionStorageBackend,
} from './sessionStorageConfig.js';

type UnknownRecord = Record<string, unknown>;

interface StorageWorkerOptions {
  sessionSlug?: unknown;
  sessionConfig?: unknown;
  context?: unknown;
  workerUrl?: unknown;
  credentialToken?: unknown;
  fetchImpl?: typeof fetch;
}

interface UploadDataToSessionStorageOptions extends StorageWorkerOptions {
  tags?: unknown;
  contentType?: unknown;
  resource?: unknown;
  encrypted?: unknown;
  payloadEncrypted?: unknown;
  arweaveJwk?: unknown;
}

interface ReadSessionStorageBlobOptions extends StorageWorkerOptions {
  storageRef?: unknown;
}

interface ListSessionStorageRefsPageOptions extends StorageWorkerOptions {
  resource?: unknown;
  cursor?: unknown;
  limit?: unknown;
}

interface SessionStorageRefsPage {
  items: unknown[];
  cursor: string | null;
  listComplete: boolean;
}

const normalizeWorkerBaseUrl = (rawUrl: unknown): string => toStr(rawUrl).trim().replace(/\/+$/, '');
const normalizeTags = (tags: unknown): Array<{ name: string; value: string }> =>
  (Array.isArray(tags) ? tags : [])
    .filter((tag) => tag && typeof tag === 'object')
    .map((tag) => ({
      name: toStr((tag as UnknownRecord).name).trim(),
      value: toStr((tag as UnknownRecord).value).trim(),
    }))
    .filter((tag) => tag.name && tag.value !== '');

const resolveStorageWorkerUrl = async ({
  sessionSlug,
  sessionConfig,
  context,
  workerUrl,
}: StorageWorkerOptions = {}): Promise<string> => {
  const explicit = normalizeWorkerBaseUrl(workerUrl);
  if (explicit) return explicit;
  const resolved = await getCorsProxyUrlOrThrow({
    sessionSlug,
    sessionConfig,
    context,
    allowDemoFallback: defaultStrictAllowDemoFallback(),
  });
  return normalizeWorkerBaseUrl(resolved);
};

const parseStorageUploadResponse = async (response: Response): Promise<UnknownRecord> => {
  const body = (await response.json().catch(() => ({}))) as UnknownRecord;
  if (!response.ok) {
    throw new Error(
      (body?.error as string) || (body?.message as string) || `Storage upload failed (${response.status}).`,
    );
  }
  const storageRef = normalizeStorageRef(body?.storageRef || body, {
    legacyArweaveTxId: body?.arweaveTxId || body?.txId || body?.id,
  });
  if (!storageRef) throw new Error('Storage upload succeeded but no storageRef was returned.');
  return { ...body, storageRef, id: storageRef.id };
};

export const uploadDataToSessionStorage = async (
  data: unknown,
  format: unknown,
  {
    sessionSlug = '',
    sessionConfig = null,
    context = null,
    workerUrl = '',
    tags = [],
    contentType = '',
    resource = 'docsContext',
    encrypted = false,
    payloadEncrypted = false,
    arweaveJwk = '',
    credentialToken = '',
    fetchImpl = fetch,
  }: UploadDataToSessionStorageOptions = {},
): Promise<UnknownRecord> => {
  const payloadIsEncrypted = encrypted || payloadEncrypted;
  const backend = resolveSessionStorageBackend(sessionConfig, { resource, encrypted: payloadIsEncrypted });
  const normalizedTags = normalizeTags(tags);
  const storageConfig = normalizeSessionStorageConfig(sessionConfig);

  if (backend === STORAGE_BACKENDS.ARWEAVE || backend === STORAGE_BACKENDS.LIT_ARWEAVE) {
    const txId = await arweaveClient.uploadDataToArweave(data, format, {
      sessionSlug,
      sessionConfig,
      context,
      tags: normalizedTags,
      contentType,
      ...(arweaveJwk ? { arweaveJwk } : {}),
    });
    const storageRef = normalizeStorageRef({
      backend,
      id: txId,
      contentType,
      resource,
      encrypted: backend === STORAGE_BACKENDS.LIT_ARWEAVE || payloadIsEncrypted,
    });
    return {
      id: txId,
      txId,
      arweaveTxId: txId,
      storageRef,
      storage: backend,
    };
  }

  if (
    storageConfig.payloadAccessControl.mode === SESSION_STORAGE_PAYLOAD_ACCESS_MODES.LIT_ENCRYPTED &&
    !payloadIsEncrypted
  ) {
    throw new Error('Cloudflare lit_encrypted storage requires a pre-encrypted payload before upload.');
  }

  const baseUrl = await resolveStorageWorkerUrl({ sessionSlug, sessionConfig, context, workerUrl });
  if (!baseUrl) throw new Error('Worker URL is missing for storage upload.');
  const endpoint = `${baseUrl}/storage/upload`;
  const bodyContentType =
    toStr(contentType).trim() ||
    (typeof File !== 'undefined' && (data instanceof File || data instanceof Blob)
      ? data.type || 'application/octet-stream'
      : 'application/json');

  let requestInit: RequestInit;
  if (typeof File !== 'undefined' && (data instanceof File || data instanceof Blob)) {
    const form = new FormData();
    form.append('file', data, (data as File).name || 'payload.bin');
    form.append('backend', STORAGE_BACKENDS.CLOUDFLARE);
    form.append('resource', resource as string);
    form.append('contentType', bodyContentType);
    form.append('payloadEncrypted', payloadIsEncrypted ? 'true' : 'false');
    if (normalizedTags.length) form.append('tags', JSON.stringify(normalizedTags));
    requestInit = { method: 'POST', body: form };
  } else {
    requestInit = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        backend: STORAGE_BACKENDS.CLOUDFLARE,
        resource,
        contentType: bodyContentType,
        payloadEncrypted: payloadIsEncrypted,
        tags: normalizedTags,
        data,
      }),
    };
  }

  const normalizedCredentialToken = toStr(credentialToken).trim();
  const credentialHeaders = new Headers(requestInit.headers);
  if (normalizedCredentialToken) {
    credentialHeaders.set('Authorization', `Bearer ${normalizedCredentialToken}`);
    if (toStr(sessionSlug).trim()) credentialHeaders.set('X-Group-Slug', toStr(sessionSlug).trim());
  }
  const response = normalizedCredentialToken
    ? await fetchImpl(endpoint, {
        ...requestInit,
        headers: credentialHeaders,
      })
    : await fetchWorkerWithAuth(endpoint, requestInit, {
        sessionSlug,
        sessionConfig,
        context,
        workerUrl: baseUrl,
        allowDemoFallback: defaultStrictAllowDemoFallback(),
      });
  const parsed = await parseStorageUploadResponse(response);
  return {
    ...parsed,
    storage: STORAGE_BACKENDS.CLOUDFLARE,
  };
};

export const readSessionStorageBlob = async ({
  storageRef,
  sessionSlug = '',
  sessionConfig = null,
  context = null,
  workerUrl = '',
}: ReadSessionStorageBlobOptions = {}): Promise<Response> => {
  const ref = normalizeStorageRef(storageRef, { fallbackBackend: STORAGE_BACKENDS.CLOUDFLARE });
  if (!ref || ref.backend !== STORAGE_BACKENDS.CLOUDFLARE) throw new Error('Cloudflare storageRef is required.');
  const baseUrl = await resolveStorageWorkerUrl({ sessionSlug, sessionConfig, context, workerUrl });
  const endpoint = `${baseUrl}/storage/read?id=${encodeURIComponent(ref.id)}`;
  const response = await fetchWorkerWithAuth(
    endpoint,
    { method: 'GET' },
    {
      sessionSlug,
      sessionConfig,
      context,
      workerUrl: baseUrl,
      allowDemoFallback: defaultStrictAllowDemoFallback(),
      preferAnonymous: true,
    },
  );
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.error || `Storage read failed (${response.status}).`);
  }
  return response;
};

export const listSessionStorageRefsPage = async ({
  sessionSlug = '',
  sessionConfig = null,
  context = null,
  workerUrl = '',
  resource = 'docsContext',
  cursor = null,
  limit = null,
}: ListSessionStorageRefsPageOptions = {}): Promise<SessionStorageRefsPage> => {
  const baseUrl = await resolveStorageWorkerUrl({ sessionSlug, sessionConfig, context, workerUrl });
  const params = new URLSearchParams({ resource: toStr(resource).trim() || 'docsContext' });
  const normalizedCursor = toStr(cursor).trim();
  const normalizedLimit = Math.trunc(Number(limit));
  if (normalizedCursor) params.set('cursor', normalizedCursor);
  if (Number.isFinite(normalizedLimit) && normalizedLimit > 0) params.set('limit', String(normalizedLimit));
  const endpoint = `${baseUrl}/storage/list?${params.toString()}`;
  const response = await fetchWorkerWithAuth(
    endpoint,
    { method: 'GET' },
    {
      sessionSlug,
      sessionConfig,
      context,
      workerUrl: baseUrl,
      allowDemoFallback: defaultStrictAllowDemoFallback(),
      preferAnonymous: true,
    },
  );
  const body = (await response.json().catch(() => ({}))) as UnknownRecord;
  if (!response.ok) throw new Error((body?.error as string) || `Storage list failed (${response.status}).`);
  const nextCursor = toStr(body?.cursor).trim() || null;
  return {
    items: Array.isArray(body?.items) ? body.items : [],
    cursor: nextCursor,
    listComplete: body?.listComplete === true || !nextCursor,
  };
};
