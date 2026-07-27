export const GROUP_CREATION_POLICIES = Object.freeze({
  ADMIN_ONLY: 'admin_only',
  PARTICIPANTS: 'participants',
} as const);

export type GroupCreationPolicy = (typeof GROUP_CREATION_POLICIES)[keyof typeof GROUP_CREATION_POLICIES];

export const DEFAULT_NEW_SESSION_GROUP_CREATION_POLICY: GroupCreationPolicy = GROUP_CREATION_POLICIES.PARTICIPANTS;

export const LEGACY_GROUP_CREATION_POLICY: GroupCreationPolicy = GROUP_CREATION_POLICIES.ADMIN_ONLY;

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

export const normalizeGroupCreationPolicy = (
  value: unknown,
  fallback: GroupCreationPolicy = LEGACY_GROUP_CREATION_POLICY,
): GroupCreationPolicy =>
  value === GROUP_CREATION_POLICIES.PARTICIPANTS
    ? GROUP_CREATION_POLICIES.PARTICIPANTS
    : value === GROUP_CREATION_POLICIES.ADMIN_ONLY
      ? GROUP_CREATION_POLICIES.ADMIN_ONLY
      : fallback;

export const resolveGroupCreationPolicy = (
  sessionConfig: unknown,
  fallback: GroupCreationPolicy = LEGACY_GROUP_CREATION_POLICY,
): GroupCreationPolicy => {
  const config = asRecord(sessionConfig);
  return normalizeGroupCreationPolicy(config.groupCreationPolicy, fallback);
};
