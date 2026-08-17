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
      retainGroup: true,
      sessionSlug: 'alpha',
    });
    expect(joined.groups).toEqual([refreshedGroup]);
    expect(joined.memberships).toHaveLength(1);
    expect(joined.memberships[0].group).toEqual(refreshedGroup);

    const left = reconcileConfirmedWorkerGroupMembership({
      overview: joined,
      group: refreshedGroup,
      isMember: false,
      retainGroup: true,
      sessionSlug: 'alpha',
    });
    expect(left.groups).toEqual([refreshedGroup]);
    expect(left.memberships).toEqual([]);
  });

  it('preserves the authoritative count returned by join', () => {
    const next = reconcileConfirmedWorkerGroupMembership({
      overview: { groups: [existingGroup], memberships: [] },
      group: refreshedGroup,
      memberCount: 6,
      isMember: true,
      retainGroup: true,
      sessionSlug: 'alpha',
    });

    expect(next.groups).toEqual([expect.objectContaining({ groupId: 'reviewers', memberCount: 6 })]);
    expect(next.memberships).toEqual([
      expect.objectContaining({
        group: expect.objectContaining({ groupId: 'reviewers', memberCount: 6 }),
        memberCount: 6,
      }),
    ]);
  });

  it('retains only a session-visible group and count after leave', () => {
    const next = reconcileConfirmedWorkerGroupMembership({
      overview,
      group: refreshedGroup,
      memberCount: 4,
      isMember: false,
      retainGroup: true,
      sessionSlug: 'alpha',
    });

    expect(next.memberships).toEqual([]);
    expect(next.groups).toEqual([expect.objectContaining({ groupId: 'reviewers', memberCount: 4 })]);
  });

  it('removes restricted group and membership state after leave', () => {
    const restrictedGroup = { ...refreshedGroup, memberVisibility: 'members' as const };
    const next = reconcileConfirmedWorkerGroupMembership({
      overview: {
        groups: [restrictedGroup],
        memberships: [{ group: restrictedGroup, member: { groupId: 'Reviewers', sessionSlug: 'Alpha' } }],
      },
      group: restrictedGroup,
      isMember: false,
      retainGroup: false,
      sessionSlug: 'alpha',
    });

    expect(next).toEqual({ groups: [], memberships: [] });
  });
});
