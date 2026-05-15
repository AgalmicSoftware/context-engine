/** @file uploads.js */

import { Buffer } from 'buffer';
import { arweaveScripts } from '../arweave/arweaveScripts.js';
import { uploadDataToSessionStorage } from '../storage/storageClient.js';
import { STORAGE_BACKENDS, normalizeStorageRef } from '../storage/storageRefs.js';
import { cryptoUtils } from '../crypto/cryptography.js';
import { litStorage } from '../crypto/litProtocol.js';
import { toStr } from '../shared/primitives.js';
import {
  buildDocUploadTagMap as buildTagMap,
  createDocLibraryLinkRecord,
  isSelfRecipientDocEncryption,
  normalizeDocUploadTagsForTagMap as normalizeTagsForTagMap,
  resolveDocUploadResultId,
  resolveDocUploadResultStorage,
} from './docUploadContracts.js';

export const resolveDocUploadsGate = (sessionConfig) => {
  const gate = sessionConfig?.__registry?.gatesByResource?.docUploads || null;
  const sbtAddresses = Array.isArray(gate?.sbtAddresses) ? gate.sbtAddresses.filter(Boolean) : [];
  const chainId = Number(gate?.chainId || 0) || null;
  const rawMode = gate?.mode;
  const normalizedMode = toStr(rawMode || '').trim().toLowerCase();
  const mode = (
    rawMode === 1 ||
    normalizedMode === '1' ||
    normalizedMode === 'all' ||
    normalizedMode === 'and'
  ) ? 'all' : 'any';
  const lookupStatus = toStr(gate?.lookupStatus || '').trim().toLowerCase();
  return {
    gate,
    lookupStatus,
    sbtAddresses,
    chainId,
    mode,
    hasRecipients: lookupStatus === 'ok' && sbtAddresses.length > 0,
  };
};

const normalizeTagsForTagMap = (tags) => (
  (Array.isArray(tags) ? tags : [])
    .filter((tag) => tag && typeof tag === 'object')
    .map((tag) => ({ name: toStr(tag.name).trim(), value: toStr(tag.value).trim() }))
    .filter((tag) => tag.name && tag.value !== '')
);

const buildTagMap = (tags) => Object.fromEntries(
  normalizeTagsForTagMap(tags).map((tag) => [tag.name, tag.value])
);

export const buildSessionDocLibraryViewerUrl = ({
  sessionToken,
  txId,
  storageRef,
  storageId,
  storage = 'lit-arweave',
  kind = 'file',
  name = '',
} = {}) => {
  const token = toStr(sessionToken).trim();
  // __ceDocTx is the legacy query name. For non-Arweave backends it carries the
  // backend-specific opaque storage ref, not necessarily an Arweave transaction id.
  const id = toStr(storageRef || storageId || txId).trim();
  if (!token || !id) return '';
  const pathname = buildPublicUrlPath(`/session/${encodeURIComponent(token)}/docs`);
  const query = new URLSearchParams();
  query.set('__ceDocTx', id);
  query.set('__ceDocStorage', toStr(storage).trim() || 'lit-arweave');
  query.set('__ceDocKind', toStr(kind).trim() || 'file');
  if (toStr(name).trim()) query.set('__ceDocName', toStr(name).trim());
  return `${pathname}?${query.toString()}`;
};

export const createDocLibraryLinkRecord = ({ url, title } = {}) => {
  const rawUrl = toStr(url).trim();
  if (!rawUrl) throw new Error('Invalid URL.');

  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch (_) {
    throw new Error('Invalid URL.');
  }

  if (!/^https?:$/.test(parsed.protocol)) {
    throw new Error('URL must be http(s).');
  }

  return {
    v: 1,
    kind: 'link',
    url: parsed.toString(),
    title: toStr(title).trim() || null,
    createdAt: new Date().toISOString(),
  };
};

const buildBaseUploadContext = ({ account, providerLike, chainId } = {}) => ({
  account,
  providerLike,
  chainId: chainId || null,
});

const readDocBlobAsArrayBuffer = (blob) => {
  if (blob && typeof blob.arrayBuffer === 'function') return blob.arrayBuffer();
  return new Promise((resolve, reject) => {
    try {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Failed to read file data.'));
      reader.readAsArrayBuffer(blob);
    } catch (err) {
      reject(err);
    }
  });
};

const DOC_MIME_BY_EXT = Object.freeze({
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  pdf: 'application/pdf',
  txt: 'text/plain',
  md: 'text/markdown',
  markdown: 'text/markdown',
  json: 'application/json',
  csv: 'text/csv',
  mp4: 'video/mp4',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
});

const resolveDocExt = ({ name, format } = {}) => {
  const fmt = toStr(format).trim().toLowerCase();
  if (fmt) return fmt;
  const rawName = toStr(name).trim();
  const dot = rawName.lastIndexOf('.');
  if (dot > 0 && dot < rawName.length - 1) return rawName.slice(dot + 1).toLowerCase();
  return '';
};

const resolveDocMime = ({ mime, name, format, type } = {}) => {
  const raw = toStr(mime || type).trim();
  const ext = resolveDocExt({ name, format });
  if (raw && raw !== 'application/octet-stream') return raw;
  if (ext && DOC_MIME_BY_EXT[ext]) return DOC_MIME_BY_EXT[ext];
  return raw || 'application/octet-stream';
};

const encodeDocEncryptedPayload = async (data, opts = {}) => {
  const name = toStr(opts.name || '');
  const format = toStr(opts.format || '');
  const mime = toStr(opts.mime || '');

  if (typeof File !== 'undefined' && (data instanceof File || data instanceof Blob)) {
    const buf = await readDocBlobAsArrayBuffer(data);
    const b64 = Buffer.from(new Uint8Array(buf || [])).toString('base64');
    const resolvedName = name || data.name || 'encrypted-file';
    const resolvedFormat = resolveDocExt({ name: resolvedName, format });
    const resolvedMime = resolveDocMime({
      mime,
      name: resolvedName,
      format: resolvedFormat,
      type: data.type,
    });
    return {
      v: 1,
      kind: 'file',
      name: resolvedName,
      format: resolvedFormat,
      mime: resolvedMime,
      encoding: 'base64',
      data: b64,
    };
  }

  return {
    v: 1,
    kind: 'text',
    name: name || 'encrypted-text',
    format: format || '',
    mime: mime || 'text/plain',
    encoding: 'utf-8',
    data: toStr(data),
  };
};

export const uploadSelfRecipientEncryptedDocData = async ({
  data,
  format,
  name,
  mime,
  arweaveJwk,
  tags,
  arweave,
  providerLike,
  account,
  chainId,
  contextLabel,
} = {}) => {
  if (!toStr(account).trim()) {
    throw new Error('Wallet account is required for private document encryption.');
  }
  if (chainId === undefined || chainId === null || chainId === '') {
    throw new Error('Chain ID is required for private document encryption.');
  }

  const payload = await encodeDocEncryptedPayload(data, { format, name, mime });
  const envelope = await cryptoUtils.encryptEnvelopeValue(payload, {
    providerLike,
    account,
    chainId,
    contextLabel: contextLabel || 'doc-self',
  });

  const txId = await arweaveScripts.uploadDataToArweave(envelope, 'json', {
    arweaveJwk,
    tags,
    ...(arweave && typeof arweave === 'object' ? arweave : {}),
  });

  return {
    txId,
    url: litStorage.buildLitArweaveUrl(txId),
    arweaveUrl: arweaveScripts.buildArweaveGatewayUrl(txId),
    envelope,
  };
};

const buildEncryptedUploadArgs = ({
  data,
  name,
  mime,
  tags,
  sessionSlug,
  sessionConfig,
  account,
  providerLike,
  chainId,
  encryption,
} = {}) => (
  litStorage.uploadEncryptedArweaveData({
    data,
    name,
    mime,
    ...(encryption?.arweaveJwk ? { arweaveJwk: encryption.arweaveJwk } : {}),
    providerLike,
    account,
    chainId: encryption?.chainId || chainId || null,
    contextLabel: encryption?.contextLabel || `doc:${sessionSlug || ''}`,
    tags,
    arweave: {
      sessionSlug,
      sessionConfig,
      context: buildBaseUploadContext({ account, providerLike, chainId }),
    },
    lit: {
      saveKey: encryption?.saveKey,
      accessControlConditions: encryption?.accessControlConditions,
      chain: encryption?.litChain || encryption?.chain || null,
      ...(encryption?.litNetwork ? { litNetwork: encryption.litNetwork } : {}),
      ...(encryption?.connectTimeout ? { connectTimeout: encryption.connectTimeout } : {}),
      ...(encryption?.providerLike ? { providerLike: encryption.providerLike } : {}),
      ...(encryption?.resourceAbilityRequests ? { resourceAbilityRequests: encryption.resourceAbilityRequests } : {}),
    },
  })
);

const buildSelfRecipientUploadArgs = ({
  data,
  name,
  mime,
  tags,
  sessionSlug,
  sessionConfig,
  account,
  providerLike,
  chainId,
  encryption,
} = {}) => (
  uploadSelfRecipientEncryptedDocData({
    data,
    name,
    mime,
    ...(encryption?.arweaveJwk ? { arweaveJwk: encryption.arweaveJwk } : {}),
    providerLike,
    account,
    chainId: encryption?.chainId || chainId || null,
    contextLabel: encryption?.contextLabel || `doc-self:${sessionSlug || ''}`,
    tags,
    arweave: {
      sessionSlug,
      sessionConfig,
      context: buildBaseUploadContext({ account, providerLike, chainId }),
    },
  })
);

export const uploadDocLibraryFile = async ({
  file,
  sessionSlug,
  sessionConfig,
  account,
  providerLike,
  chainId,
  tags,
  encryption = null,
} = {}) => {
  if (!file) throw new Error('Missing file.');

  const normalizedTags = normalizeTagsForTagMap(tags);
  const contentType = file.type || 'application/octet-stream';
  if (encryption?.enabled) {
    const uploadEncrypted = isSelfRecipientDocEncryption(encryption)
      ? buildSelfRecipientUploadArgs
      : buildEncryptedUploadArgs;
    const result = await uploadEncrypted({
      data: file,
      name: file.name || 'document',
      mime: contentType,
      tags: normalizedTags,
      sessionSlug,
      sessionConfig,
      account,
      providerLike,
      chainId,
      encryption,
    });
    const txId = toStr(result?.txId).trim();
    const storageRef = normalizeStorageRef({
      backend: STORAGE_BACKENDS.LIT_ARWEAVE,
      id: txId,
      contentType: 'application/json',
      resource: 'docsContext',
      encrypted: true,
    });
    return {
      txId,
      url: txId ? litStorage.buildLitArweaveUrl(txId) : '',
      storage: STORAGE_BACKENDS.LIT_ARWEAVE,
      storageRef,
      kind: 'file',
      tagMap: buildTagMap(normalizedTags),
      data: { size: null, type: 'application/json' },
    };
  }

  const result = await uploadDataToSessionStorage(file, undefined, {
    sessionSlug,
    sessionConfig,
    context: buildBaseUploadContext({ account, providerLike, chainId }),
    tags: normalizedTags,
    contentType,
    resource: 'docsContext',
  });
  const txId = resolveDocUploadResultId(result);
  const storage = resolveDocUploadResultStorage(result);

  return {
    txId,
    url: storage === STORAGE_BACKENDS.CLOUDFLARE
      ? toStr(result?.storageRef?.uri).trim()
      : (txId ? arweaveScripts.buildArweaveGatewayUrl(txId) : ''),
    storage,
    storageRef: result?.storageRef || null,
    kind: 'file',
    tagMap: buildTagMap(normalizedTags),
    data: { size: file.size || null, type: file.type || null },
  };
};

export const uploadDocLibraryUrlRecord = async ({
  url,
  title,
  sessionSlug,
  sessionConfig,
  account,
  providerLike,
  chainId,
  tags,
  encryption = null,
} = {}) => {
  const record = createDocLibraryLinkRecord({ url, title });
  const normalizedTags = normalizeTagsForTagMap(tags);

  if (encryption?.enabled) {
    const uploadEncrypted = isSelfRecipientDocEncryption(encryption)
      ? buildSelfRecipientUploadArgs
      : buildEncryptedUploadArgs;
    const result = await uploadEncrypted({
      data: JSON.stringify(record),
      name: 'link.json',
      mime: 'application/json',
      tags: normalizedTags,
      sessionSlug,
      sessionConfig,
      account,
      providerLike,
      chainId,
      encryption: {
        ...encryption,
        contextLabel: encryption?.contextLabel || `doc-link:${sessionSlug || ''}`,
      },
    });
    const txId = toStr(result?.txId).trim();
    const storageRef = normalizeStorageRef({
      backend: STORAGE_BACKENDS.LIT_ARWEAVE,
      id: txId,
      contentType: 'application/json',
      resource: 'docsContext',
      encrypted: true,
    });
    return {
      txId,
      url: txId ? litStorage.buildLitArweaveUrl(txId) : '',
      storage: STORAGE_BACKENDS.LIT_ARWEAVE,
      storageRef,
      kind: 'link',
      tagMap: buildTagMap(normalizedTags),
      data: { size: null, type: 'application/json' },
      record,
    };
  }

  const result = await uploadDataToSessionStorage(record, 'json', {
    sessionSlug,
    sessionConfig,
    context: buildBaseUploadContext({ account, providerLike, chainId }),
    tags: normalizedTags,
    contentType: 'application/json',
    resource: 'docsContext',
  });
  const txId = resolveDocUploadResultId(result);
  const storage = resolveDocUploadResultStorage(result);

  return {
    txId,
    url: storage === STORAGE_BACKENDS.CLOUDFLARE
      ? toStr(result?.storageRef?.uri).trim()
      : (txId ? arweaveScripts.buildArweaveGatewayUrl(txId) : ''),
    storage,
    storageRef: result?.storageRef || null,
    kind: 'link',
    tagMap: buildTagMap(normalizedTags),
    data: { size: null, type: 'application/json' },
    record,
  };
};
