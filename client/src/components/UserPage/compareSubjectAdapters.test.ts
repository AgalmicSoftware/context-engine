import { analyzeCompareSubjectCompatibility, resolveCompareSubjects } from './compareSubjectAdapters';

describe('compare subject adapters', () => {
  const addressA = `0x${'a'.repeat(40)}`;
  const addressB = `0x${'b'.repeat(40)}`;

  const questionsCaches = [
    {
      '11155420': {
        questionResponses: {
          shared: {
            [addressA]: JSON.stringify({ answer: { value: 'Agree' } }),
            [addressB]: JSON.stringify({ answer: { value: 'Disagree' } }),
          },
          worker_only: {
            'telegram:123': JSON.stringify({ answer: { value: 'Agree' } }),
          },
        },
        questions: {
          shared: { prompt: 'Shared session question', type: 'binary' },
          worker_only: { prompt: 'Worker session question', type: 'binary' },
        },
      },
    },
  ];

  it('normalizes shipped simulated figures with stable shared question IDs and provenance', () => {
    const result = resolveCompareSubjects({
      sessionSlug: 'demo-session',
      subjects: ['sim:Franklin', 'sim:FDR'],
    });

    expect(result.errors).toEqual([]);
    expect(result.users.map((user) => user.label)).toEqual(['Benjamin Franklin', 'Franklin D. Roosevelt']);
    expect(result.users.map((user) => user.address)).toEqual(['sim:Franklin', 'sim:FDR']);
    expect(result.users[0].profileHref).toContain('/su/Franklin');
    expect(result.users[0].provenance).toEqual({
      sessionSlug: 'demo-session',
      source: 'shipped_simulation',
      subjectKind: 'sim',
    });
    expect(result.users[0].questions.some((question) => question.id === 'demo-comment:11')).toBe(true);
    expect(result.users[1].questions.some((question) => question.id === 'demo-comment:11')).toBe(true);

    const compatibility = analyzeCompareSubjectCompatibility(result.users);
    expect(compatibility.opinionComparable).toBe(true);
    expect(compatibility.membershipComparable).toBe(false);
    expect(compatibility.sharedQuestionIds).toContain('demo-comment:11');

    expect(
      analyzeCompareSubjectCompatibility([
        ...result.users,
        {
          ...result.users[0],
          address: 'sim:third',
          addressLower: 'sim:third',
          questions: [],
          subjectToken: 'sim:third',
        },
      ]).opinionComparable,
    ).toBe(false);
  });

  it('projects wallet, address-backed Worker, and native Worker responders from session caches', () => {
    const result = resolveCompareSubjects({
      questionsCaches,
      sessionSlug: 'worker-session',
      subjects: [`wallet:${addressA}`, `worker:evm_address:${addressB}`, 'worker:telegram:123'],
    });

    expect(result.errors).toEqual([]);
    expect(result.users.map((user) => user.address)).toEqual([
      `wallet:${addressA}`,
      `worker:evm_address:${addressB}`,
      'worker:telegram:123',
    ]);
    expect(result.users.map((user) => user.questions.length)).toEqual([1, 1, 1]);
    expect(result.users[1]).toEqual(
      expect.objectContaining({
        cacheSubjectId: addressB,
        profileHref: expect.stringContaining(`/u/${addressB}`),
        supportsMembership: true,
      }),
    );
    expect(result.users[2]).toEqual(
      expect.objectContaining({
        cacheSubjectId: 'telegram:123',
        profileHref: '',
        supportsMembership: false,
      }),
    );
    expect(result.users[2].provenance).toEqual({
      cacheSubjectId: 'telegram:123',
      sessionSlug: 'worker-session',
      source: 'session_cache',
      subjectKind: 'worker',
    });
  });

  it('reports unresolved simulations and refuses unrelated cross-source evidence', () => {
    const unknown = resolveCompareSubjects({ subjects: ['sim:Franklin', 'sim:MissingFigure'] });
    expect(unknown.users).toHaveLength(1);
    expect(unknown.errors).toEqual([
      { message: 'Unknown simulated subject: MissingFigure', token: 'sim:MissingFigure' },
    ]);

    const mixed = resolveCompareSubjects({
      questionsCaches,
      subjects: [`wallet:${addressA}`, 'sim:Franklin'],
    });
    expect(analyzeCompareSubjectCompatibility(mixed.users)).toEqual({
      membershipComparable: false,
      notice:
        'These subjects do not share a canonical question ID across all participants or comparable session membership evidence.',
      opinionComparable: false,
      sharedQuestionIds: [],
      summaryComparable: false,
    });
  });
});
