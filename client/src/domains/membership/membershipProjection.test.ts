import {
  buildOnchainSbtMembershipIdentity,
  buildWorkerGroupMembershipIdentity,
  projectOnchainSbtMembership,
  projectWorkerGroupMemberships,
  selectCanonicalMembershipProjection,
} from './membershipProjection';

describe('membershipProjection', () => {
  const subject = '0x00000000000000000000000000000000000000aa';

  it('treats completed structured counts as authoritative, including an empty result', () => {
    const projection = projectOnchainSbtMembership({
      chainId: 11155420,
      contractAddress: '0x00000000000000000000000000000000000000bb',
      entry: {
        countsLoaded: true,
        mintedCountByAddress: {},
        burnedCountByAddress: {},
        mintedAddresses: [subject],
      },
      sessionSlug: 'Alpha',
      subjectAddress: subject,
    });

    expect(projection).toEqual(
      expect.objectContaining({
        status: 'not_member',
        provenance: 'complete_counts',
        authoritative: true,
        mintedCount: 0,
        burnedCount: 0,
      }),
    );
  });

  it('preserves mint-burn-mint ownership from count maps', () => {
    expect(
      projectOnchainSbtMembership({
        entry: {
          countsLoaded: true,
          mintedCountByAddress: { [subject]: 2 },
          burnedCountByAddress: { [subject]: 1 },
        },
        subjectAddress: subject,
      }).status,
    ).toBe('member');
  });

  it('matches structured count-map addresses case-insensitively', () => {
    expect(
      projectOnchainSbtMembership({
        entry: {
          countsLoaded: false,
          mintedCountByAddress: { [subject.toUpperCase()]: 1 },
        },
        subjectAddress: subject,
      }),
    ).toEqual(expect.objectContaining({ status: 'member', provenance: 'partial_counts' }));
  });

  it('uses partial checkpoint counts only for a subject explicitly present in those maps', () => {
    expect(
      projectOnchainSbtMembership({
        entry: {
          countsLoaded: false,
          countsScanCheckpoint: { lastBlockScanned: 100 },
          mintedCountByAddress: { [subject]: 1 },
          burnedCountByAddress: {},
        },
        subjectAddress: subject,
      }),
    ).toEqual(expect.objectContaining({ status: 'member', provenance: 'partial_counts' }));

    expect(
      projectOnchainSbtMembership({
        entry: {
          countsLoaded: false,
          countsScanCheckpoint: { lastBlockScanned: 100 },
          mintedCountByAddress: {},
          burnedCountByAddress: {},
          mintedAddresses: [subject],
        },
        subjectAddress: subject,
      }).status,
    ).toBe('unknown');
  });

  it('keeps session, chain, and resource identity distinct', () => {
    const opIdentity = buildOnchainSbtMembershipIdentity({
      sessionSlug: 'Alpha',
      chainId: 11155420,
      contractAddress: '0xABC',
    });
    const baseIdentity = buildOnchainSbtMembershipIdentity({
      sessionSlug: 'Alpha',
      chainId: 84532,
      contractAddress: '0xABC',
    });
    const workerIdentity = buildWorkerGroupMembershipIdentity({ sessionSlug: 'Alpha', groupId: 'Reviewers' });

    expect(opIdentity.key).not.toBe(baseIdentity.key);
    expect(workerIdentity.key).toBe('worker_group:alpha:reviewers');
  });

  it('prefers authoritative empty counts over a legacy ownership hint', () => {
    const legacy = projectOnchainSbtMembership({
      chainId: 11155420,
      contractAddress: '0xabc',
      entry: { mintedAddresses: [subject] },
      subjectAddress: subject,
    });
    const complete = projectOnchainSbtMembership({
      chainId: 11155420,
      contractAddress: '0xabc',
      entry: { countsLoaded: true, mintedCountByAddress: {}, burnedCountByAddress: {} },
      subjectAddress: subject,
    });

    expect(selectCanonicalMembershipProjection(legacy, complete).status).toBe('not_member');
  });

  it('normalizes and deduplicates authoritative Worker Group memberships', () => {
    const projections = projectWorkerGroupMemberships(
      [
        { group: { groupId: 'Reviewers', label: 'Reviewers', sessionSlug: 'Alpha' }, member: {} },
        { group: { groupId: 'reviewers', label: 'Reviewers', sessionSlug: 'alpha' }, member: {} },
      ],
      'Alpha',
    );

    expect(projections).toHaveLength(1);
    expect(projections[0]).toEqual(
      expect.objectContaining({
        status: 'member',
        provenance: 'worker_authoritative',
        identity: expect.objectContaining({ key: 'worker_group:alpha:reviewers' }),
      }),
    );
  });
});
