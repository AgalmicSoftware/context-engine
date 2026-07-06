import {
  buildSurveyResultsLockedGateDetails,
} from './surveyResultsLockedGateDetailsModel';

describe('surveyResultsLockedGateDetailsModel', () => {
  const normalizeGateSbtEntries = (gate: unknown) => {
    if (!gate || typeof gate !== 'object') return [];
    const record = gate as { sbts?: Array<{ address?: string; label?: string }> };
    return Array.isArray(record.sbts) ? record.sbts : [];
  };

  it('returns an empty model when no locked rows are present', () => {
    expect(buildSurveyResultsLockedGateDetails()).toEqual({
      gateDetails: [],
      hasGenericGateMessage: false,
    });
  });

  it('uses question gates, configured gate entries, and deduped display labels', () => {
    const result = buildSurveyResultsLockedGateDetails({
      baseSlug: 'base-session',
      buildSbtDetailPath: (address, slug) => `/sbt/${slug}/${address}`,
      getQuestionEncryptionGates: (question) => (question ? [{ gateId: 'gate-a', sbts: [{ address: '0xbbb', label: 'Direct' }] }] : []),
      getShortenedAddress: (address) => `short:${address}`,
      lockedRows: [
        { questionId: 'Q1' },
      ],
      normalizeGateSbtEntries,
      normalizeGateText: (value) => String(value || '').trim().toLowerCase(),
      questionLookup: {
        q1: { sessionSlug: 'question-session' },
      },
      readSessionGateContext: (slug) => ({
        configuredGateMap: {
          'gate-a': { sbts: [{ address: '0xaaa', label: 'Configured' }] },
        },
        defaultPolicy: {},
        fallbackChainId: 111,
        slug,
      }),
      resolveSbtDisplayLabel: ({ address, preferredSlug }) => (
        address === '0xaaa' ? `Resolved ${preferredSlug}` : ''
      ),
    });

    expect(result).toEqual({
      gateDetails: [
        {
          address: '0xaaa',
          href: '/sbt/question-session/0xaaa',
          label: 'Resolved question-session',
        },
        {
          address: '0xbbb',
          href: '/sbt/question-session/0xbbb',
          label: 'Direct',
        },
      ],
      hasGenericGateMessage: false,
    });
  });

  it('falls back to default gates and then generic copy when no gates resolve', () => {
    const result = buildSurveyResultsLockedGateDetails({
      buildSbtDetailPath: (address, slug) => `/sbt/${slug}/${address}`,
      getQuestionEncryptionGates: () => [],
      lockedRows: [
        { questionId: 'q1' },
        { questionId: 'q2' },
      ],
      normalizeGateSbtEntries,
      questionLookup: {
        q1: { sessionSlug: 'session-a' },
      },
      readSessionGateContext: (slug) => ({
        defaultPolicy: slug === 'session-a'
          ? { gates: [{ sbts: [{ address: '0xccc' }] }] }
          : { gates: [{}] },
        slug,
      }),
    });

    expect(result).toEqual({
      gateDetails: [
        {
          address: '0xccc',
          href: '/sbt/session-a/0xccc',
          label: '0xccc',
        },
      ],
      hasGenericGateMessage: true,
    });
  });
});
