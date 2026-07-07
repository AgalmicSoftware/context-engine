import { STORAGE_BACKENDS } from '../storage/storageRefs.js';
import { toStr } from '../shared/primitives.js';
import { buildPublicUrlPath } from '../ui/publicUrl.js';

type DocUploadRecord = Record<string, unknown>;

const isDocUploadRecord = (value: unknown): value is DocUploadRecord => !!value && typeof value === 'object';

const readRecord = (value: unknown, key: string): unknown => (isDocUploadRecord(value) ? value[key] : undefined);

export const resolveDocUploadsGate = (sessionConfig: unknown) => {
  const registry = readRecord(sessionConfig, '__registry');
  const gatesByResource = readRecord(registry, 'gatesByResource');
  const gate = readRecord(gatesByResource, 'docUploads') || null;
  const sbtAddressesValue = readRecord(gate, 'sbtAddresses');
  const sbtAddresses = Array.isArray(sbtAddressesValue) ? sbtAddressesValue.filter(Boolean) : [];
  const chainId = Number(readRecord(gate, 'chainId') || 0) || null;
  const rawMode = readRecord(gate, 'mode');
  const normalizedMode = toStr(rawMode || '')
    .trim()
    .toLowerCase();
  const mode =
    rawMode === 1 || normalizedMode === '1' || normalizedMode === 'all' || normalizedMode === 'and' ? 'all' : 'any';
  const lookupStatus = toStr(readRecord(gate, 'lookupStatus') || '')
    .trim()
    .toLowerCase();
  return {
    gate,
    lookupStatus,
    sbtAddresses,
    chainId,
    mode,
    hasRecipients: lookupStatus === 'ok' && sbtAddresses.length > 0,
  };
};

export const normalizeDocUploadTagsForTagMap = (tags: unknown) =>
  (Array.isArray(tags) ? tags : [])
    .filter((tag) => tag && typeof tag === 'object')
    .map((tag) => ({ name: toStr(readRecord(tag, 'name')).trim(), value: toStr(readRecord(tag, 'value')).trim() }))
    .filter((tag) => tag.name && tag.value !== '');

export const buildDocUploadTagMap = (tags: unknown) =>
  Object.fromEntries(normalizeDocUploadTagsForTagMap(tags).map((tag) => [tag.name, tag.value]));

export const resolveDocUploadResultId = (result: unknown): string =>
  toStr(readRecord(result, 'arweaveTxId') || readRecord(result, 'txId') || readRecord(result, 'id')).trim();

export const resolveDocUploadResultStorage = (result: unknown): string => {
  const storageRef = readRecord(result, 'storageRef');
  return (
    toStr(readRecord(storageRef, 'backend') || readRecord(result, 'storage') || STORAGE_BACKENDS.ARWEAVE).trim() ||
    STORAGE_BACKENDS.ARWEAVE
  );
};

export const buildSessionDocLibraryViewerUrl = ({
  sessionToken,
  txId,
  storageRef,
  storageId,
  storage = STORAGE_BACKENDS.LIT_ARWEAVE,
  kind = 'file',
  name = '',
}: {
  sessionToken?: unknown;
  txId?: unknown;
  storageRef?: unknown;
  storageId?: unknown;
  storage?: unknown;
  kind?: unknown;
  name?: unknown;
} = {}) => {
  const token = toStr(sessionToken).trim();
  const id = toStr(storageRef || storageId || txId).trim();
  if (!token || !id) return '';
  const pathname = buildPublicUrlPath(`/session/${encodeURIComponent(token)}/docs`);
  const query = new URLSearchParams();
  query.set('__ceDocTx', id);
  query.set('__ceDocStorage', toStr(storage).trim() || STORAGE_BACKENDS.LIT_ARWEAVE);
  query.set('__ceDocKind', toStr(kind).trim() || 'file');
  if (toStr(name).trim()) query.set('__ceDocName', toStr(name).trim());
  return `${pathname}?${query.toString()}`;
};

export const createDocLibraryLinkRecord = ({
  url,
  title,
}: {
  url?: unknown;
  title?: unknown;
} = {}) => {
  const rawUrl = toStr(url).trim();
  if (!rawUrl) throw new Error('Invalid URL.');

  let parsed: URL;
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

export const isSelfRecipientDocEncryption = (encryption: unknown = {}) => {
  const raw = toStr(
    readRecord(encryption, 'recipientType') || readRecord(encryption, 'mode') || readRecord(encryption, 'audience'),
  )
    .trim()
    .toLowerCase();
  return (
    readRecord(encryption, 'selfRecipient') === true ||
    raw === 'self' ||
    raw === 'only me' ||
    raw === 'only-me' ||
    raw === 'only_me' ||
    raw === 'self-eip712-v1'
  );
};
