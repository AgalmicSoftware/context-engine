import {
  computeGroupAwareConsensus,
  computePolisCommentStats,
  computePolisConversationMath,
  computePolisStats,
  findRepresentativeQuestions,
} from './consensusReportMath';

describe('computePolisStats', () => {
  it('counts agree, disagree, and unsure votes in the summary stats', () => {
    const ratingMatrix = [
      [1, 0, null],
      [-1, null, 0],
    ];

    expect(computePolisStats(ratingMatrix)).toEqual({
      nComments: 2,
      nParticipants: 3,
      totalVotes: 4,
      voters: 3,
      votesPerVoterAvg: 4 / 3,
    });
  });
});

describe('computePolisCommentStats', () => {
  it('keeps unsure votes in the responded total while exposing Polis-style extremity', () => {
    const ratingMatrix = [
      [1, -1, 0, 0],
      [1, -1, 1, -1],
      [1, 1, 1, 1],
    ];

    const stats = computePolisCommentStats(ratingMatrix, { randomSeed: 42 });

    expect(stats[0]).toEqual(
      expect.objectContaining({
        agrees: 1,
        disagrees: 1,
        unsure: 2,
        total: 4,
      }),
    );
    expect(stats[0].extremity).toBeCloseTo(stats[0].divisiveness);
    expect(Number.isFinite(stats[0].extremity)).toBe(true);
  });

  it('reuses a provided PCA bundle instead of recomputing extremity coordinates', () => {
    const ratingMatrix = [
      [1, -1, 0],
      [-1, 1, 1],
    ];

    const stats = computePolisCommentStats(ratingMatrix, {
      pcaBundle: {
        commentExtremity: [0.25, 0.75],
      },
    });

    expect(stats).toEqual([
      expect.objectContaining({ commentIndex: 0, extremity: 0.25, divisiveness: 0.25 }),
      expect.objectContaining({ commentIndex: 1, extremity: 0.75, divisiveness: 0.75 }),
    ]);
  });
});

describe('computePolisConversationMath', () => {
  const ratingMatrix = [
    [1, 1, 1, -1, -1, -1],
    [1, 1, 1, -1, -1, -1],
    [1, 1, 1, -1, -1, null],
    [1, 1, 1, -1, -1, null],
    [-1, -1, -1, 1, 1, null],
    [-1, -1, -1, 1, 1, null],
    [-1, -1, -1, 1, 1, null],
    [-1, -1, -1, 1, 1, null],
  ];

  const allQuestions = Array.from({ length: ratingMatrix.length }, (_, index) => `q${index}`);
  const questionPromptsMap = Object.fromEntries(
    allQuestions.map((questionId, index) => [questionId, `Question ${index + 1}`]),
  );

  it('auto-selects Polis-style groups and still assigns low-participation outliers', () => {
    const result = computePolisConversationMath(ratingMatrix, questionPromptsMap, allQuestions, { randomSeed: 42 });

    expect(result.clusterCount).toBe(2);
    expect(result.clusterAssignments).toHaveLength(6);
    expect(result.clusterAssignments[0]).toBe(result.clusterAssignments[1]);
    expect(result.clusterAssignments[1]).toBe(result.clusterAssignments[2]);
    expect(result.clusterAssignments[3]).toBe(result.clusterAssignments[4]);
    expect(result.clusterAssignments[0]).not.toBe(result.clusterAssignments[3]);
    expect(Number.isInteger(result.clusterAssignments[5])).toBe(true);
    expect(result.groupVotes).toBeUndefined();
    expect(result.groupAwareConsensus).toBeUndefined();
    expect(result.consensus).toBeUndefined();
  });
});

describe('findRepresentativeQuestions', () => {
  it('returns agree and disagree representative metadata instead of raw average deltas only', () => {
    const ratingMatrix = [
      [1, 1, 1, -1, -1, -1],
      [1, 1, 1, -1, -1, -1],
      [-1, -1, -1, 1, 1, 1],
      [-1, -1, -1, 1, 1, 1],
    ];
    const assignments = [0, 0, 0, 1, 1, 1];
    const allQuestions = ['q1', 'q2', 'q3', 'q4'];
    const questionPromptsMap = {
      q1: 'Agree question',
      q2: 'Agree question 2',
      q3: 'Disagree question',
      q4: 'Disagree question 2',
    };

    const repQuestions = findRepresentativeQuestions(ratingMatrix, assignments, questionPromptsMap, allQuestions);

    expect(repQuestions[0].some((item) => item.repfulFor === 'agree')).toBe(true);
    expect(repQuestions[0].some((item) => item.repfulFor === 'disagree')).toBe(true);
    expect(repQuestions[0][0]).toEqual(
      expect.objectContaining({
        questionIndex: expect.any(Number),
        prompt: expect.any(String),
        repfulFor: expect.stringMatching(/agree|disagree/),
        repness: expect.any(Number),
        repnessTest: expect.any(Number),
      }),
    );
  });
});

describe('computeGroupAwareConsensus', () => {
  it('matches the official per-group probability product', () => {
    const groupVotes = {
      0: {
        votes: {
          q1: { A: 2, D: 0, S: 2 },
        },
      },
      1: {
        votes: {
          q1: { A: 0, D: 2, S: 2 },
        },
      },
    };

    expect(computeGroupAwareConsensus(groupVotes).q1).toBeCloseTo(0.1875);
  });
});
