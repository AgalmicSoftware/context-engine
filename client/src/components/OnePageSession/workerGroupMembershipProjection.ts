import type { WorkerGroup, WorkerGroupOverview } from '../../domains/worker/workerGroupPorts';

export const reconcileConfirmedWorkerGroupMembership = ({
  overview,
  group,
  isMember,
  sessionSlug,
}: {
  overview: WorkerGroupOverview;
  group: WorkerGroup;
  isMember: boolean;
  sessionSlug: string;
}): WorkerGroupOverview => {
  const hasGroup = overview.groups.some((candidate) => candidate.groupId === group.groupId);
  const groups = hasGroup
    ? overview.groups.map((candidate) => (candidate.groupId === group.groupId ? group : candidate))
    : [...overview.groups, group];
  const existingMembership = overview.memberships.find(
    (membership) => membership.group.groupId === group.groupId,
  );

  if (!isMember) {
    return {
      groups,
      memberships: overview.memberships.filter(
        (membership) => membership.group.groupId !== group.groupId,
      ),
    };
  }

  return {
    groups,
    memberships: existingMembership
      ? overview.memberships.map((membership) =>
          membership.group.groupId === group.groupId ? { ...membership, group } : membership,
        )
      : [
          ...overview.memberships,
          {
            group,
            member: {
              groupId: group.groupId,
              sessionSlug,
            },
          },
        ],
  };
};
