import { resolveSessionWizardWorkerStorageProfilePayload } from './sessionWizardWriteNormalization.js';
import { toStr } from '../../utilities/shared/primitives.js';
import type { AnyRecord } from '../shellTypes';

const isRecord = (value: unknown): value is AnyRecord => !!value && typeof value === 'object' && !Array.isArray(value);

const firstTrimmed = (...values: unknown[]): string => {
  for (const value of values) {
    const trimmed = toStr(value).trim();
    if (trimmed) return trimmed;
  }
  return '';
};

const resolveDeployOnlyR2BucketName = (draft: AnyRecord, deployPayload: AnyRecord): string => {
  const rawStorageProfile = isRecord(draft.storageProfile)
    ? draft.storageProfile
    : isRecord(deployPayload.storageProfile)
      ? deployPayload.storageProfile
      : {};
  const cloudflare = isRecord(rawStorageProfile.cloudflare) ? rawStorageProfile.cloudflare : {};
  const r2 = isRecord(cloudflare.r2) ? cloudflare.r2 : {};
  return firstTrimmed(
    rawStorageProfile.r2BucketName,
    rawStorageProfile.r2Bucket,
    rawStorageProfile.bucketName,
    rawStorageProfile.bucket,
    cloudflare.r2BucketName,
    cloudflare.r2Bucket,
    cloudflare.bucketName,
    cloudflare.bucket,
    r2.bucketName,
    r2.bucket,
  );
};

export const buildSessionWizardDeployStorageProfilePayload = (
  draft: AnyRecord,
  deployPayload: AnyRecord,
): AnyRecord | null => {
  const { storageProfile } = resolveSessionWizardWorkerStorageProfilePayload({
    draft,
    deployPayload,
  });
  if (toStr(storageProfile.backend).trim().toLowerCase() !== 'cloudflare') return null;
  const r2BucketName = resolveDeployOnlyR2BucketName(draft, deployPayload);
  if (!r2BucketName) return storageProfile;
  return {
    ...storageProfile,
    cloudflare: {
      ...(isRecord(storageProfile.cloudflare) ? storageProfile.cloudflare : {}),
      r2BucketName,
    },
  };
};
