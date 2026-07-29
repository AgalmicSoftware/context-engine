import { uploadDataToSessionStorage } from '../../utilities/storage/storageClient';
import {
  normalizeSessionStorageConfig,
  resolveSessionStorageBackend,
  SESSION_STORAGE_PAYLOAD_ENCRYPTION_MODES,
} from '../../utilities/storage/sessionStorageConfig';
import {
  normalizeStorageRef,
  STORAGE_BACKENDS,
} from '../../utilities/storage/storageRefs';
import { canonicalizeSessionSlug } from '../../utilities/session/canonicalSessionContext';
import { normalizeWorkerUrl } from '../../utilities/worker/workerUrl';

type UnknownRecord = Record<string, unknown>;

export const MAX_WORKER_GROUP_IMAGE_BYTES = 10 * 1024 * 1024;

const SUPPORTED_WORKER_GROUP_IMAGE_TYPES = new Set([
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const asRecord = (value: unknown): UnknownRecord =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as UnknownRecord) : {};

const imageFormatForType = (contentType: string): string => {
  if (contentType === 'image/jpeg') return 'jpg';
  if (contentType === 'image/gif') return 'gif';
  if (contentType === 'image/webp') return 'webp';
  return 'png';
};

export const validateWorkerGroupImageFile = (file: Blob | null | undefined): string => {
  if (!(file instanceof Blob)) return 'Choose an image to upload.';
  if (!SUPPORTED_WORKER_GROUP_IMAGE_TYPES.has(String(file.type || '').trim().toLowerCase())) {
    return 'Use a PNG, JPEG, GIF, or WebP image.';
  }
  if (file.size > MAX_WORKER_GROUP_IMAGE_BYTES) return 'Image too large (>10MB).';
  return '';
};

export const resolveWorkerGroupImageUrl = ({
  result,
  workerUrl,
}: {
  result: unknown;
  workerUrl: unknown;
}): string => {
  const payload = asRecord(result);
  const storageRef = normalizeStorageRef(payload.storageRef || payload, {
    fallbackBackend: payload.storage,
    legacyArweaveTxId: payload.arweaveTxId || payload.txId || payload.id,
    resource: 'images',
  });
  if (!storageRef) throw new Error('Image upload succeeded without a usable storage reference.');

  if (storageRef.backend === STORAGE_BACKENDS.CLOUDFLARE) {
    const baseUrl = normalizeWorkerUrl(workerUrl);
    if (!baseUrl) throw new Error('Worker URL is missing for the uploaded image.');
    const imageUrl = new URL(
      storageRef.uri || `/storage/read?id=${encodeURIComponent(storageRef.id)}`,
      `${baseUrl}/`,
    );
    if (imageUrl.protocol !== 'https:' || imageUrl.origin !== new URL(baseUrl).origin) {
      throw new Error('Worker image upload returned an unsafe URL.');
    }
    return imageUrl.href;
  }

  if (storageRef.backend === STORAGE_BACKENDS.ARWEAVE) {
    return `https://arweave.net/${encodeURIComponent(storageRef.id)}`;
  }

  throw new Error('Encrypted image storage cannot be used as a public group image. Use a public HTTPS URL.');
};

export const uploadWorkerGroupImage = async ({
  file,
  sessionSlug,
  sessionConfig,
  workerUrl,
  credentialToken = '',
  context = null,
  fetchImpl = fetch,
  uploadData = uploadDataToSessionStorage,
}: {
  file: Blob;
  sessionSlug: unknown;
  sessionConfig: unknown;
  workerUrl: unknown;
  credentialToken?: unknown;
  context?: unknown;
  fetchImpl?: typeof fetch;
  uploadData?: typeof uploadDataToSessionStorage;
}): Promise<string> => {
  const validationError = validateWorkerGroupImageFile(file);
  if (validationError) throw new Error(validationError);

  const normalizedSessionSlug = canonicalizeSessionSlug(sessionSlug);
  const normalizedWorkerUrl = normalizeWorkerUrl(workerUrl);
  if (!normalizedSessionSlug) throw new Error('Session slug is missing for the image upload.');
  if (!normalizedWorkerUrl) throw new Error('Worker URL is missing for the image upload.');

  const backend = resolveSessionStorageBackend(sessionConfig, {
    resource: 'images',
    encrypted: false,
  });
  const storageConfig = normalizeSessionStorageConfig(sessionConfig);
  if (
    backend === STORAGE_BACKENDS.LIT_ARWEAVE ||
    (backend === STORAGE_BACKENDS.CLOUDFLARE &&
      storageConfig.payloadAccessControl.encryption === SESSION_STORAGE_PAYLOAD_ENCRYPTION_MODES.LIT)
  ) {
    throw new Error('Encrypted image storage cannot be used as a group thumbnail. Use a public HTTPS URL.');
  }

  const contentType = String(file.type || '').trim().toLowerCase();
  const result = await uploadData(file, imageFormatForType(contentType), {
    sessionSlug: normalizedSessionSlug,
    sessionConfig,
    context,
    workerUrl: normalizedWorkerUrl,
    credentialToken,
    fetchImpl,
    resource: 'images',
    contentType,
    tags: [
      { name: 'Content-Type', value: contentType },
      { name: 'CE-Resource', value: 'worker-group-image' },
    ],
  });

  return resolveWorkerGroupImageUrl({
    result,
    workerUrl: normalizedWorkerUrl,
  });
};
