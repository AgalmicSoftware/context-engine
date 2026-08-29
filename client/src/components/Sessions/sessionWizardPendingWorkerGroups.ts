import type {
  WorkerGroup,
  WorkerGroupJoinMode,
  WorkerGroupMemberVisibility,
} from '../../domains/worker/workerGroupPorts';
import { validateWorkerGroupImageFile } from '../../domains/worker/workerGroupImageUpload';
import { generateSessionId } from './sessionWizardCoreUtils';

export const MAX_PENDING_WORKER_GROUP_DRAFTS = 100;

export type PendingWorkerGroupDraft = {
  groupId: string;
  label: string;
  description: string;
  imageUrl: string;
  imageFile?: Blob | null;
  tags: string[];
  documentURLs: string[];
  memberLimit: string;
  joinEndsAt: string;
  adminAddress: string;
  joinMode: WorkerGroupJoinMode;
  memberVisibility: WorkerGroupMemberVisibility;
};

const toText = (value: unknown): string => String(value ?? '').trim();

const isBlob = (value: unknown): value is Blob => typeof Blob !== 'undefined' && value instanceof Blob;

const isSafeHttpsUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password && value.length <= 2048;
  } catch {
    return false;
  }
};

const normalizeTags = (value: unknown): string[] => {
  const seen = new Set<string>();
  return (Array.isArray(value) ? value : [])
    .map(toText)
    .filter((tag) => {
      const key = tag.toLowerCase();
      if (!tag || tag.length > 64 || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 20);
};

const normalizeDocumentURLs = (value: unknown): string[] => {
  const seen = new Set<string>();
  return (Array.isArray(value) ? value : [])
    .map(toText)
    .filter((url) => {
      if (!isSafeHttpsUrl(url) || seen.has(url)) return false;
      seen.add(url);
      return true;
    })
    .slice(0, 10);
};

const normalizeJoinMode = (value: unknown): WorkerGroupJoinMode =>
  value === 'admin_add' ? 'admin_add' : 'open';

const normalizeMemberVisibility = (
  value: unknown,
  joinMode: WorkerGroupJoinMode,
): WorkerGroupMemberVisibility => {
  if (joinMode === 'open' && value === 'admin_only') return 'session';
  if (value === 'admin_only' || value === 'members') return value;
  return 'session';
};

export const createPendingWorkerGroupDraft = (
  label: unknown,
  overrides: Partial<PendingWorkerGroupDraft> = {},
): PendingWorkerGroupDraft => {
  const joinMode = normalizeJoinMode(overrides.joinMode);
  return {
    groupId: toText(overrides.groupId) || generateSessionId(),
    label: toText(label).slice(0, 120),
    description: toText(overrides.description).slice(0, 500),
    imageUrl: toText(overrides.imageUrl).slice(0, 2048),
    ...(isBlob(overrides.imageFile) ? { imageFile: overrides.imageFile } : {}),
    tags: normalizeTags(overrides.tags),
    documentURLs: normalizeDocumentURLs(overrides.documentURLs),
    memberLimit: toText(overrides.memberLimit),
    joinEndsAt: toText(overrides.joinEndsAt),
    adminAddress: toText(overrides.adminAddress),
    joinMode,
    memberVisibility: normalizeMemberVisibility(overrides.memberVisibility, joinMode),
  };
};

export const normalizePendingWorkerGroupDrafts = (value: unknown): PendingWorkerGroupDraft[] => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const drafts: PendingWorkerGroupDraft[] = [];
  value.slice(0, MAX_PENDING_WORKER_GROUP_DRAFTS).forEach((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return;
    const source = entry as Partial<PendingWorkerGroupDraft>;
    const groupId = toText(source.groupId).toLowerCase();
    if (!groupId || groupId.length > 80 || !/^[a-z0-9][a-z0-9._-]*$/.test(groupId) || seen.has(groupId)) return;
    seen.add(groupId);
    drafts.push(createPendingWorkerGroupDraft(source.label, { ...source, groupId }));
  });
  return drafts;
};

export const validatePendingWorkerGroupDrafts = (value: unknown): string[] => {
  const source = Array.isArray(value) ? value : [];
  const normalized = normalizePendingWorkerGroupDrafts(source);
  const issues: string[] = [];
  if (source.length > MAX_PENDING_WORKER_GROUP_DRAFTS) {
    issues.push(`A session can queue at most ${MAX_PENDING_WORKER_GROUP_DRAFTS} Groups.`);
  }
  if (normalized.length !== Math.min(source.length, MAX_PENDING_WORKER_GROUP_DRAFTS)) {
    issues.push('One or more queued Groups have an invalid or duplicate draft ID.');
  }
  source.slice(0, MAX_PENDING_WORKER_GROUP_DRAFTS).forEach((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return;
    const raw = entry as Partial<PendingWorkerGroupDraft>;
    if (toText(raw.label).length > 120) issues.push(`Group ${index + 1} name must be 120 characters or fewer.`);
    if (toText(raw.description).length > 500) {
      issues.push(`Group ${index + 1} description must be 500 characters or fewer.`);
    }
    const imageUrl = toText(raw.imageUrl);
    if (imageUrl && !isSafeHttpsUrl(imageUrl)) {
      issues.push(`Group ${index + 1} image must use a public HTTPS URL.`);
    }
    if (raw.imageFile != null) {
      const imageIssue = validateWorkerGroupImageFile(raw.imageFile);
      if (imageIssue) issues.push(`Group ${index + 1} image: ${imageIssue}`);
    }
    if (
      raw.tags != null &&
      (!Array.isArray(raw.tags) || raw.tags.length > 20 || normalizeTags(raw.tags).length !== raw.tags.length)
    ) {
      issues.push(`Group ${index + 1} tags must be unique, non-empty, and 64 characters or fewer.`);
    }
    if (
      raw.documentURLs != null &&
      (!Array.isArray(raw.documentURLs) ||
        raw.documentURLs.length > 10 ||
        normalizeDocumentURLs(raw.documentURLs).length !== raw.documentURLs.length)
    ) {
      issues.push(`Group ${index + 1} references must be unique public HTTPS URLs.`);
    }
    const memberLimit = toText(raw.memberLimit);
    const memberLimitNumber = Number(memberLimit);
    if (
      memberLimit &&
      (!Number.isSafeInteger(memberLimitNumber) || memberLimitNumber < 1 || memberLimitNumber > 1000)
    ) {
      issues.push(`Group ${index + 1} member limit must be a whole number from 1 to 1000.`);
    }
    const joinEndsAt = toText(raw.joinEndsAt);
    const joinEndsAtTime = joinEndsAt ? new Date(joinEndsAt).getTime() : 0;
    if (joinEndsAt && (!Number.isFinite(joinEndsAtTime) || joinEndsAtTime <= Date.now())) {
      issues.push(`Group ${index + 1} join deadline must be in the future.`);
    }
    const adminAddress = toText(raw.adminAddress);
    if (adminAddress && !/^0x[0-9a-fA-F]{40}$/.test(adminAddress)) {
      issues.push(`Group ${index + 1} admin address must be a valid EVM address.`);
    }
  });
  normalized.forEach((draft, index) => {
    if (!draft.label) issues.push(`Group ${index + 1} needs a name.`);
  });
  return issues;
};

export const buildPendingWorkerGroupInput = ({
  defaultAdminAddress = '',
  defaultTags = [],
  draft,
  preparedImageUrl = '',
}: {
  defaultAdminAddress?: string;
  defaultTags?: string[];
  draft: PendingWorkerGroupDraft;
  preparedImageUrl?: string;
}): Omit<WorkerGroup, 'sessionSlug'> => {
  const tags = normalizeTags([...defaultTags, ...draft.tags]);
  const memberLimit = Number(draft.memberLimit);
  const imageUrl = toText(preparedImageUrl || draft.imageUrl);
  const adminAddress = toText(draft.adminAddress || defaultAdminAddress);
  return {
    groupId: draft.groupId,
    label: draft.label,
    ...(draft.description ? { description: draft.description } : {}),
    ...(imageUrl ? { imageUrl } : {}),
    ...(tags.length ? { tags } : {}),
    ...(draft.documentURLs.length ? { documentURLs: draft.documentURLs } : {}),
    ...(Number.isSafeInteger(memberLimit) && memberLimit > 0 ? { memberLimit } : {}),
    ...(draft.joinEndsAt ? { joinEndsAt: new Date(draft.joinEndsAt).toISOString() } : {}),
    ...(adminAddress ? { adminAddress } : {}),
    joinMode: draft.joinMode,
    memberVisibility:
      draft.joinMode === 'open' && draft.memberVisibility === 'admin_only'
        ? 'session'
        : draft.memberVisibility,
  };
};

export const serializePendingWorkerGroupDrafts = (
  value: unknown,
): Array<Omit<PendingWorkerGroupDraft, 'imageFile'>> =>
  normalizePendingWorkerGroupDrafts(value).map((draft) => {
    const durableDraft: Partial<PendingWorkerGroupDraft> = { ...draft };
    delete durableDraft.imageFile;
    return durableDraft as Omit<PendingWorkerGroupDraft, 'imageFile'>;
  });
