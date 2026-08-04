import type { WorkerGroup, WorkerGroupOverview } from '../../domains/worker/workerGroupPorts';
import {
  buildWorkerGroupMembershipIdentity,
  projectWorkerGroupMembership,
} from '../../domains/membership/membershipProjection';

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
  const hasGroup = overview.groups.some(groupMatches);
  const groups = hasGroup
    ? overview.groups.map((candidate) => (groupMatches(candidate) ? group : candidate))
    : [...overview.groups, group];
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
          membershipMatches(membership) ? { ...membership, group } : membership,
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
