import type {
  WorkerGroup,
  WorkerGroupJoinMode,
  WorkerGroupMemberVisibility,
} from '../../domains/worker/workerGroupPorts';
import { generateSessionId } from './sessionWizardCoreUtils';

export const MAX_PENDING_WORKER_GROUP_DRAFTS = 100;

export type PendingWorkerGroupDraft = {
  groupId: string;
  label: string;
  description: string;
  joinMode: WorkerGroupJoinMode;
  memberVisibility: WorkerGroupMemberVisibility;
};

const toText = (value: unknown): string => String(value ?? '').trim();

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
  });
  normalized.forEach((draft, index) => {
    if (!draft.label) issues.push(`Group ${index + 1} needs a name.`);
  });
  return issues;
};

export const buildPendingWorkerGroupInput = ({
  defaultTags = [],
  draft,
}: {
  defaultTags?: string[];
  draft: PendingWorkerGroupDraft;
}): Omit<WorkerGroup, 'sessionSlug'> => ({
  groupId: draft.groupId,
  label: draft.label,
  ...(draft.description ? { description: draft.description } : {}),
  ...(defaultTags.length ? { tags: defaultTags } : {}),
  joinMode: draft.joinMode,
  memberVisibility: draft.joinMode === 'open' && draft.memberVisibility === 'admin_only'
    ? 'session'
    : draft.memberVisibility,
});
