import type { WorkerGroup, WorkerGroupOverview } from '../../domains/worker/workerGroupPorts';
import {
  buildWorkerGroupMembershipIdentity,
  projectWorkerGroupMembership,
} from '../../domains/membership/membershipProjection';

export const reconcileConfirmedWorkerGroupMembership = ({
  overview,
  group,
  memberCount,
  isMember,
  retainGroup,
  sessionSlug,
}: {
  overview: WorkerGroupOverview;
  group: WorkerGroup;
  memberCount?: number;
  isMember: boolean;
  retainGroup: boolean;
  sessionSlug: string;
}): WorkerGroupOverview => {
  const targetIdentity = buildWorkerGroupMembershipIdentity({
    groupId: group.groupId,
    sessionSlug: group.sessionSlug || sessionSlug,
  });
  const groupMatches = (candidate: WorkerGroup) =>
    buildWorkerGroupMembershipIdentity({
      groupId: candidate.groupId,
      sessionSlug: candidate.sessionSlug || sessionSlug,
    }).key === targetIdentity.key;
  const membershipMatches = (membership: WorkerGroupOverview['memberships'][number]) =>
    projectWorkerGroupMembership({ membership, sessionSlug })?.identity.key === targetIdentity.key;
  const projectedGroup =
    Number.isSafeInteger(memberCount) && Number(memberCount) >= 0 ? { ...group, memberCount } : group;
  const hasGroup = overview.groups.some(groupMatches);
  const groups = retainGroup
    ? hasGroup
      ? overview.groups.map((candidate) => (groupMatches(candidate) ? projectedGroup : candidate))
      : [...overview.groups, projectedGroup]
    : overview.groups.filter((candidate) => !groupMatches(candidate));
  const existingMembership = overview.memberships.find(membershipMatches);

  if (!isMember) {
    return {
      groups,
      memberships: overview.memberships.filter((membership) => !membershipMatches(membership)),
    };
  }

  return {
    groups,
    memberships: existingMembership
      ? overview.memberships.map((membership) =>
          membershipMatches(membership)
            ? { ...membership, group: projectedGroup, ...(memberCount === undefined ? {} : { memberCount }) }
            : membership,
        )
      : [
          ...overview.memberships,
          {
            group: projectedGroup,
            member: {
              groupId: group.groupId,
              sessionSlug,
            },
            ...(memberCount === undefined ? {} : { memberCount }),
          },
        ],
  };
};
