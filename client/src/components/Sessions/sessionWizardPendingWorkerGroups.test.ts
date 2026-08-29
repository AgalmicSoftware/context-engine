import {
  buildPendingWorkerGroupInput,
  createPendingWorkerGroupDraft,
  normalizePendingWorkerGroupDrafts,
  validatePendingWorkerGroupDrafts,
} from './sessionWizardPendingWorkerGroups';

describe('sessionWizardPendingWorkerGroups', () => {
  it('creates a stable Worker-compatible draft and normalizes open-group visibility', () => {
    const draft = createPendingWorkerGroupDraft(' Research team ', {
      groupId: 'Draft-1',
      joinMode: 'open',
      memberVisibility: 'admin_only',
    });

    expect(draft).toEqual({
      groupId: 'Draft-1',
      label: 'Research team',
      description: '',
      joinMode: 'open',
      memberVisibility: 'session',
    });
    expect(buildPendingWorkerGroupInput({ defaultTags: ['research'], draft })).toEqual({
      groupId: 'Draft-1',
      label: 'Research team',
      tags: ['research'],
      joinMode: 'open',
      memberVisibility: 'session',
    });
  });

  it('restores only bounded, unique, Worker-compatible cache entries', () => {
    expect(
      normalizePendingWorkerGroupDrafts([
        { groupId: 'group-1', label: 'One', joinMode: 'open', memberVisibility: 'session' },
        { groupId: 'GROUP-1', label: 'Duplicate', joinMode: 'open', memberVisibility: 'session' },
        { groupId: 'bad/id', label: 'Invalid', joinMode: 'open', memberVisibility: 'session' },
      ]),
    ).toEqual([
      {
        groupId: 'group-1',
        label: 'One',
        description: '',
        joinMode: 'open',
        memberVisibility: 'session',
      },
    ]);
  });

  it('blocks publishing when a queued group no longer has a name', () => {
    expect(
      validatePendingWorkerGroupDrafts([
        { groupId: 'group-1', label: '', description: '', joinMode: 'open', memberVisibility: 'session' },
      ]),
    ).toContain('Group 1 needs a name.');
  });
});
