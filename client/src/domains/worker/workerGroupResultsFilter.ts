import {
  claimsWorkerCanonicalAuthority,
  resolveSessionCapabilityProjection,
} from '../../utilities/session/sessionCapabilityProjection';

export const GROUP_FILTER_ROLES = ['creatorInclude', 'creatorExclude', 'responderInclude', 'responderExclude'] as const;
export type GroupFilterRole = (typeof GROUP_FILTER_ROLES)[number];
export type GroupSelection = { groupId: string; label: string };
export type WorkerGroupFilterScope = { sessionId: string; sessionSlug: string; workerUrl: string };
export type WorkerGroupResultsSelection = WorkerGroupFilterScope & Record<GroupFilterRole, GroupSelection[]>;
export type WorkerGroupCohort = {
  active: boolean;
  status: 'ready' | 'loading' | 'error';
  message: string;
  selection: WorkerGroupResultsSelection | null;
  members: Record<string, ReadonlySet<string>>;
};
export const asGroupRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
export const usesWorkerGroupFilters = (config: unknown): boolean => claimsWorkerCanonicalAuthority(config);
export const hasWorkerGroupSelection = (value: unknown): boolean => {
  if (value == null) return false;
  const record = asGroupRecord(value);
  return GROUP_FILTER_ROLES.some(
    (role) => record[role] != null && (!Array.isArray(record[role]) || record[role].length > 0),
  );
};
const origin = (value: unknown): string => {
  try {
    return new URL(String(value)).origin;
  } catch {
    return '';
  }
};
export const normalizeWorkerGroupSelection = (
  value: unknown,
  scope: WorkerGroupFilterScope | null,
): WorkerGroupResultsSelection | null => {
  if (!hasWorkerGroupSelection(value)) return null;
  const record = asGroupRecord(value);
  if (
    !scope ||
    record.sessionId !== scope.sessionId ||
    record.sessionSlug !== scope.sessionSlug ||
    origin(record.workerUrl) !== origin(scope.workerUrl)
  ) {
    throw new Error('This Group filter belongs to a different session. Clear it and select Groups from this session.');
  }
  const result: WorkerGroupResultsSelection = {
    ...scope,
    creatorInclude: [],
    creatorExclude: [],
    responderInclude: [],
    responderExclude: [],
  };
  for (const role of GROUP_FILTER_ROLES) {
    const entries = record[role] ?? [];
    if (!Array.isArray(entries) || entries.length > 100)
      throw new Error('This Group filter is invalid. Clear it and select Groups again.');
    const seen = new Set<string>();
    for (const entry of entries) {
      const group = asGroupRecord(entry);
      if (typeof group.groupId !== 'string' || !/^[a-z0-9][a-z0-9._-]{0,79}$/i.test(group.groupId))
        throw new Error('This Group filter contains an invalid Group.');
      if (!seen.has(group.groupId))
        result[role].push({ groupId: group.groupId, label: String(group.label || group.groupId).slice(0, 200) });
      seen.add(group.groupId);
    }
  }
  return result;
};
export const groupPrincipalMatches = (
  address: unknown,
  include: GroupSelection[],
  exclude: GroupSelection[],
  members: WorkerGroupCohort['members'],
): boolean => {
  if (!include.length && !exclude.length) return true;
  const normalized = String(address || '')
    .trim()
    .toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(normalized)) return false;
  const belongs = (group: GroupSelection) => members[group.groupId]?.has(normalized) === true;
  return (!include.length || include.some(belongs)) && !exclude.some(belongs);
};
export const filterWorkerGroupResponses = (
  source: unknown,
  metadata: Record<string, unknown>,
  cohort: WorkerGroupCohort,
): Record<string, Record<string, unknown>[]> => {
  const records = asGroupRecord(source) as Record<string, Record<string, unknown>[]>;
  if (!cohort.active) return records;
  if (cohort.status !== 'ready' || !cohort.selection) return {};
  const { selection, members } = cohort;
  const filtered: Record<string, Record<string, unknown>[]> = {};
  for (const [id, rows] of Object.entries(records)) {
    if (!Array.isArray(rows)) continue;
    const question = asGroupRecord(metadata[id] || metadata[id.toLowerCase()]);
    if (!groupPrincipalMatches(question.creator, selection.creatorInclude, selection.creatorExclude, members)) continue;
    const matching = rows.filter((row) =>
      groupPrincipalMatches(row.responder, selection.responderInclude, selection.responderExclude, members),
    );
    if (matching.length) filtered[id] = matching;
  }
  return filtered;
};

// Registry and explicitly SBT-enabled hybrids retain their original SBT rules.
export const reportFilterStateForSession = <T extends { sbtFilter?: unknown }>(
  config: unknown,
  state: T | null | undefined,
) =>
  usesWorkerGroupFilters(config) && !resolveSessionCapabilityProjection(config).usesOnChainSbt
    ? { ...state, sbtFilter: null }
    : state;

export const buildWorkerGroupAnalysisKey = (base: string, selection: unknown, responders: string[], matrix: unknown) =>
  JSON.stringify([base, selection, responders, matrix]);
