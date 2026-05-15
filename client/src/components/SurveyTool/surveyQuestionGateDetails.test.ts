import {
  buildLockedGateRequirementSentence,
  buildLockedQuestionGateDetailsFromPool,
  isGenericResourceGateLabel,
} from './surveyQuestionGateDetails';

describe('surveyQuestionGateDetails', () => {
  it('treats resource-key labels as generic gate labels', () => {
    expect(isGenericResourceGateLabel('questionResponses')).toBe(true);
    expect(isGenericResourceGateLabel('default gate')).toBe(true);
    expect(isGenericResourceGateLabel('VIP Gate')).toBe(false);
  });

  it('builds grouped locked-question gate details from question gates', () => {
    const address = '0x1111111111111111111111111111111111111111';
    const details = buildLockedQuestionGateDetailsFromPool({
      hiddenMaskedQuestionIds: ['q1', 'q2'],
      pool: [
        {
          id: 'q1',
          sessionSlug: 'alpha',
          encryption: {
            gates: [{
              gateId: 'default',
              label: 'questionResponses',
              sbtAddress: address,
            }],
          },
        },
        {
          id: 'q2',
          sessionSlug: 'alpha',
          encryption: {
            gates: [{
              gateId: 'default',
              label: 'questionResponses',
              sbtAddresses: [address],
            }],
          },
        },
      ],
      getQuestionEncryptionGates: (question: any) => question?.encryption?.gates || [],
      resolveSbtGateLabel: () => 'VIP SBT',
      getShortenedAddress: (value) => `short:${value}`,
      buildSbtDetailPath: (value, slug) => `/sbt/${slug}/${value}`,
      getChecksumAddress: (value) => value.toUpperCase(),
      translate: (key) => (key === 'gate' ? 'Gate' : key),
    });

    expect(details).toHaveLength(1);
    expect(details[0]).toEqual(expect.objectContaining({
      label: 'VIP SBT gate',
      questionCount: 2,
      sessionSlug: 'alpha',
    }));
    expect(details[0].questionIds).toEqual(new Set(['q1', 'q2']));
    expect(details[0].sbts).toEqual([{
      address: address.toUpperCase(),
      label: 'VIP SBT',
      href: `/sbt/alpha/${address.toUpperCase()}`,
    }]);
  });

  it('prefers configured labels and summarizes required SBT names', () => {
    const details = buildLockedQuestionGateDetailsFromPool({
      hiddenMaskedQuestionIds: ['q1'],
      pool: [{
        id: 'q1',
        encryption: {
          gates: [{
            gateId: 'fallback_gate',
            label: 'default gate',
            resourceKey: 'questionResponses',
            sbtAddress: '0x2222222222222222222222222222222222222222',
          }],
        },
      }],
      getQuestionEncryptionGates: (question: any) => question?.encryption?.gates || [],
      resolveConfiguredGateLabel: () => 'Configured Gate',
      resolveSbtGateLabel: () => 'Configured SBT',
      buildSbtDetailPath: (value) => `/sbt/${value}`,
    });

    expect(details[0].label).toBe('Configured Gate');
    expect(buildLockedGateRequirementSentence(details, {
      translate: (key) => (key === 'sbt' ? 'Badge' : key),
    })).toBe('Badge required: Configured SBT.');
  });
});
