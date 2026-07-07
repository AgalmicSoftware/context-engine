/** @file uploads.ts */

import { Buffer } from 'buffer';
import { arweaveClient as arweaveScripts } from '../arweave/arweaveClient.js';
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

type UnknownRecord = Record<string, unknown>;

type BaseUploadContextArgs = {
  account?: unknown;
  providerLike?: unknown;
  chainId?: unknown;
};

type DocPayloadOptions = {
  name?: unknown;
  format?: unknown;
  mime?: unknown;
  type?: unknown;
};

type DocEncryptionOptions = UnknownRecord & {
  enabled?: boolean;
  arweaveJwk?: unknown;
  chainId?: unknown;
  contextLabel?: unknown;
  saveKey?: unknown;
  accessControlConditions?: unknown;
  litChain?: unknown;
  chain?: unknown;
  litNetwork?: unknown;
  connectTimeout?: unknown;
  providerLike?: unknown;
  resourceAbilityRequests?: unknown;
};

type EncryptedDocUploadArgs = BaseUploadContextArgs & {
  data?: unknown;
  name?: unknown;
  mime?: unknown;
  tags?: unknown;
  sessionSlug?: unknown;
  sessionConfig?: unknown;
  encryption?: DocEncryptionOptions | null;
};

type SelfRecipientDocUploadArgs = EncryptedDocUploadArgs & {
  format?: unknown;
  arweaveJwk?: unknown;
  arweave?: unknown;
  contextLabel?: unknown;
};

type UploadDocLibraryFileArgs = BaseUploadContextArgs & {
  file?: (Blob & { name?: string }) | null;
  sessionSlug?: unknown;
  sessionConfig?: unknown;
  tags?: unknown;
  encryption?: DocEncryptionOptions | null;
};

type UploadDocLibraryUrlRecordArgs = BaseUploadContextArgs & {
  url?: unknown;
  title?: unknown;
  sessionSlug?: unknown;
  sessionConfig?: unknown;
  tags?: unknown;
  encryption?: DocEncryptionOptions | null;
};

type EncryptedUploadResult = {
  txId?: unknown;
  url?: unknown;
  arweaveUrl?: unknown;
  envelope?: unknown;
};

type EncryptedUploadFn = (args: EncryptedDocUploadArgs) => Promise<EncryptedUploadResult>;
type LitUploadOptions = NonNullable<Parameters<typeof litStorage.uploadEncryptedArweaveData>[0]>;
type LitUploadHookOptions = NonNullable<LitUploadOptions['lit']>;
type LitSaveKey = NonNullable<LitUploadHookOptions['saveKey']>;

const isRecord = (value: unknown): value is UnknownRecord =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const readRecord = (value: unknown, key: string): unknown => (isRecord(value) ? value[key] : undefined);

const spreadRecord = (value: unknown): UnknownRecord => (isRecord(value) ? value : {});

const isLitSaveKey = (value: unknown): value is LitSaveKey => typeof value === 'function';

const resolveLitSaveKey = (value: unknown): LitSaveKey | null => (isLitSaveKey(value) ? value : null);

const resolveLitAccessControlConditions = (value: unknown): LitUploadHookOptions['accessControlConditions'] =>
  Array.isArray(value) ? (value as LitUploadHookOptions['accessControlConditions']) : undefined;

export {
  buildSessionDocLibraryViewerUrl,
  createDocLibraryLinkRecord,
  isSelfRecipientDocEncryption,
  resolveDocUploadsGate,
} from './docUploadContracts.js';

const buildBaseUploadContext = ({ account, providerLike, chainId }: BaseUploadContextArgs = {}) => ({
  account,
  providerLike,
  chainId: chainId || null,
});

const readDocBlobAsArrayBuffer = (blob: Blob): Promise<ArrayBuffer> => {
  if (blob && typeof blob.arrayBuffer === 'function') return blob.arrayBuffer();
  return new Promise((resolve, reject) => {
    try {
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result instanceof ArrayBuffer) {
          resolve(reader.result);
        } else {
          reject(new Error('Failed to read file data.'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file data.'));
      reader.readAsArrayBuffer(blob);
    } catch (err) {
      reject(err);
    }
  });
};

const DOC_MIME_BY_EXT: Readonly<Record<string, string>> = Object.freeze({
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

const resolveDocExt = ({ name, format }: DocPayloadOptions = {}) => {
  const fmt = toStr(format).trim().toLowerCase();
  if (fmt) return fmt;
  const rawName = toStr(name).trim();
  const dot = rawName.lastIndexOf('.');
  if (dot > 0 && dot < rawName.length - 1) return rawName.slice(dot + 1).toLowerCase();
  return '';
};

const resolveDocMime = ({ mime, name, format, type }: DocPayloadOptions = {}) => {
  const raw = toStr(mime || type).trim();
  const ext = resolveDocExt({ name, format });
  if (raw && raw !== 'application/octet-stream') return raw;
  if (ext && DOC_MIME_BY_EXT[ext]) return DOC_MIME_BY_EXT[ext];
  return raw || 'application/octet-stream';
};

const isDocBlob = (value: unknown): value is Blob & { name?: string } =>
  typeof Blob !== 'undefined' && value instanceof Blob;

const encodeDocEncryptedPayload = async (data: unknown, opts: DocPayloadOptions = {}) => {
  const name = toStr(opts.name || '');
  const format = toStr(opts.format || '');
  const mime = toStr(opts.mime || '');

  if (isDocBlob(data)) {
    const buf = await readDocBlobAsArrayBuffer(data);
    const b64 = Buffer.from(new Uint8Array(buf)).toString('base64');
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
}: SelfRecipientDocUploadArgs = {}) => {
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
    ...spreadRecord(arweave),
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
}: EncryptedDocUploadArgs = {}) =>
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
      saveKey: resolveLitSaveKey(encryption?.saveKey),
      accessControlConditions: resolveLitAccessControlConditions(encryption?.accessControlConditions),
      chain: encryption?.litChain || encryption?.chain || null,
      ...(encryption?.litNetwork ? { litNetwork: encryption.litNetwork } : {}),
      ...(encryption?.connectTimeout ? { connectTimeout: encryption.connectTimeout } : {}),
      ...(encryption?.providerLike ? { providerLike: encryption.providerLike } : {}),
      ...(encryption?.resourceAbilityRequests ? { resourceAbilityRequests: encryption.resourceAbilityRequests } : {}),
    },
  });

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
}: EncryptedDocUploadArgs = {}) =>
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
  });

export const uploadDocLibraryFile = async ({
  file,
  sessionSlug,
  sessionConfig,
  account,
  providerLike,
  chainId,
  tags,
  encryption = null,
}: UploadDocLibraryFileArgs = {}) => {
  if (!file) throw new Error('Missing file.');

  const normalizedTags = normalizeTagsForTagMap(tags);
  const contentType = file.type || 'application/octet-stream';
  if (encryption?.enabled) {
    const uploadEncrypted: EncryptedUploadFn = isSelfRecipientDocEncryption(encryption)
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
  const resultStorageRef = readRecord(result, 'storageRef');

  return {
    txId,
    url:
      storage === STORAGE_BACKENDS.CLOUDFLARE
        ? toStr(readRecord(resultStorageRef, 'uri')).trim()
        : txId
          ? arweaveScripts.buildArweaveGatewayUrl(txId)
          : '',
    storage,
    storageRef: resultStorageRef || null,
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
}: UploadDocLibraryUrlRecordArgs = {}) => {
  const record = createDocLibraryLinkRecord({ url, title });
  const normalizedTags = normalizeTagsForTagMap(tags);

  if (encryption?.enabled) {
    const uploadEncrypted: EncryptedUploadFn = isSelfRecipientDocEncryption(encryption)
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
  const resultStorageRef = readRecord(result, 'storageRef');

  return {
    txId,
    url:
      storage === STORAGE_BACKENDS.CLOUDFLARE
        ? toStr(readRecord(resultStorageRef, 'uri')).trim()
        : txId
          ? arweaveScripts.buildArweaveGatewayUrl(txId)
          : '',
    storage,
    storageRef: resultStorageRef || null,
    kind: 'link',
    tagMap: buildTagMap(normalizedTags),
    data: { size: null, type: 'application/json' },
    record,
  };
};
