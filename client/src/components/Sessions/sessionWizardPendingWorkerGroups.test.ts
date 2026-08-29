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
      imageUrl: '',
      tags: [],
      documentURLs: [],
      memberLimit: '',
      joinEndsAt: '',
      adminAddress: '',
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
        imageUrl: '',
        tags: [],
        documentURLs: [],
        memberLimit: '',
        joinEndsAt: '',
        adminAddress: '',
        joinMode: 'open',
        memberVisibility: 'session',
      },
    ]);
  });

  it('builds the complete Worker Group metadata contract and merges default tags', () => {
    const draft = createPendingWorkerGroupDraft('Research team', {
      groupId: 'research-team',
      description: 'Reviews research questions.',
      imageUrl: 'https://images.example.test/research.png',
      tags: ['Research', 'Policy'],
      documentURLs: ['https://docs.example.test/brief'],
      memberLimit: '25',
      joinEndsAt: '2099-01-02T03:04',
      adminAddress: `0x${'34'.repeat(20)}`,
      joinMode: 'admin_add',
      memberVisibility: 'members',
    });

    expect(buildPendingWorkerGroupInput({ defaultTags: ['research', 'Session'], draft })).toEqual({
      groupId: 'research-team',
      label: 'Research team',
      description: 'Reviews research questions.',
      imageUrl: 'https://images.example.test/research.png',
      tags: ['research', 'Session', 'Policy'],
      documentURLs: ['https://docs.example.test/brief'],
      memberLimit: 25,
      joinEndsAt: new Date('2099-01-02T03:04').toISOString(),
      adminAddress: `0x${'34'.repeat(20)}`,
      joinMode: 'admin_add',
      memberVisibility: 'members',
    });
  });

  it('blocks publishing when a queued group no longer has a name', () => {
    expect(
      validatePendingWorkerGroupDrafts([
        { groupId: 'group-1', label: '', description: '', joinMode: 'open', memberVisibility: 'session' },
      ]),
    ).toContain('Group 1 needs a name.');
  });

  it('rejects unsafe rich metadata before publishing', () => {
    expect(
      validatePendingWorkerGroupDrafts([
        {
          groupId: 'group-1',
          label: 'Research',
          imageUrl: 'http://images.example.test/group.png',
          tags: ['Research', 'research'],
          documentURLs: ['http://docs.example.test/brief'],
          memberLimit: '0',
          joinEndsAt: '2020-01-01T00:00',
          adminAddress: 'not-an-address',
          joinMode: 'open',
          memberVisibility: 'session',
        },
      ]),
    ).toEqual(
      expect.arrayContaining([
        'Group 1 image must use a public HTTPS URL.',
        'Group 1 tags must be unique, non-empty, and 64 characters or fewer.',
        'Group 1 references must be unique public HTTPS URLs.',
        'Group 1 member limit must be a whole number from 1 to 1000.',
        'Group 1 join deadline must be in the future.',
        'Group 1 admin address must be a valid EVM address.',
      ]),
    );
  });
});
