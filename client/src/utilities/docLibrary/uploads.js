/** @file uploads.js */

import { arweaveScripts } from '../arweave/arweaveScripts.js';
import { litStorage } from '../crypto/litProtocol.js';
import { toStr } from '../shared/primitives.js';
import { buildPublicUrlPath } from '../ui/publicUrl.js';

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
  storage = 'lit-arweave',
  kind = 'file',
  name = '',
} = {}) => {
  const token = toStr(sessionToken).trim();
  const id = toStr(txId).trim();
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
    const result = await buildEncryptedUploadArgs({
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
    return {
      txId,
      url: txId ? litStorage.buildLitArweaveUrl(txId) : '',
      storage: 'lit-arweave',
      kind: 'file',
      tagMap: buildTagMap(normalizedTags),
      data: { size: null, type: 'application/json' },
    };
  }

  const txId = await arweaveScripts.uploadDataToArweave(file, undefined, {
    sessionSlug,
    sessionConfig,
    context: buildBaseUploadContext({ account, providerLike, chainId }),
    tags: normalizedTags,
    contentType,
  });

  return {
    txId,
    url: txId ? arweaveScripts.buildArweaveGatewayUrl(txId) : '',
    storage: 'arweave',
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
    const result = await buildEncryptedUploadArgs({
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
    return {
      txId,
      url: txId ? litStorage.buildLitArweaveUrl(txId) : '',
      storage: 'lit-arweave',
      kind: 'link',
      tagMap: buildTagMap(normalizedTags),
      data: { size: null, type: 'application/json' },
      record,
    };
  }

  const txId = await arweaveScripts.uploadDataToArweave(record, 'json', {
    sessionSlug,
    sessionConfig,
    context: buildBaseUploadContext({ account, providerLike, chainId }),
    tags: normalizedTags,
  });

  return {
    txId,
    url: txId ? arweaveScripts.buildArweaveGatewayUrl(txId) : '',
    storage: 'arweave',
    kind: 'link',
    tagMap: buildTagMap(normalizedTags),
    data: { size: null, type: 'application/json' },
    record,
  };
};
