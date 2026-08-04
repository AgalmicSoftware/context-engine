import type { WorkerGroupOverview } from '../../domains/worker/workerGroupPorts';
import { reconcileConfirmedWorkerGroupMembership } from './workerGroupMembershipProjection';

describe('reconcileConfirmedWorkerGroupMembership', () => {
  const existingGroup = {
    groupId: 'Reviewers',
    sessionSlug: 'Alpha',
    label: 'Old label',
    joinMode: 'open' as const,
    memberVisibility: 'session' as const,
  };
  const refreshedGroup = { ...existingGroup, groupId: 'reviewers', sessionSlug: 'alpha', label: 'Reviewers' };
  const overview: WorkerGroupOverview = {
    groups: [existingGroup],
    memberships: [{ group: existingGroup, member: { groupId: 'Reviewers', sessionSlug: 'Alpha' } }],
  };

  it('updates and removes memberships by canonical session/group identity', () => {
    const joined = reconcileConfirmedWorkerGroupMembership({
      overview,
      group: refreshedGroup,
      isMember: true,
      sessionSlug: 'alpha',
    });
    expect(joined.groups).toEqual([refreshedGroup]);
    expect(joined.memberships).toHaveLength(1);
    expect(joined.memberships[0].group).toEqual(refreshedGroup);

    const left = reconcileConfirmedWorkerGroupMembership({
      overview: joined,
      group: refreshedGroup,
      isMember: false,
      sessionSlug: 'alpha',
    });
    expect(left.groups).toEqual([refreshedGroup]);
    expect(left.memberships).toEqual([]);
  });
});
