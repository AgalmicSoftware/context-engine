import {
  clusterParticipantsKmeans,
  clusterParticipantsLeiden,
  clusterUMAPPointsKmeans,
  computeCommentVoteCounts,
  computeExtremity,
  computeJointSVD,
  computePolisStats,
  computeQuestionDivisiveness,
  doUMAP,
  findRepresentativeQuestions,
  getCommentBarData,
  matrixShape,
  projectRows,
  silhouetteScore,
  subtractColumnMeans,
  subtractRowMeans,
  wrappedPCA,
} from './polisMath';

const ratingMatrix = [
  [1, 1, -1, -1],
  [1, 0, -1, null],
  [-1, -1, 1, 1],
  [null, 1, 0, -1],
];

describe('polisMath matrix and PCA helpers', () => {
  it('computes shapes and subtracts row/column means in place', () => {
    expect(matrixShape(ratingMatrix)).toEqual([4, 4]);

    expect(subtractRowMeans([[1, 2, 3]])).toEqual([[-1, 0, 1]]);
    expect(
      subtractColumnMeans([
        [1, 3],
        [3, 7],
      ]),
    ).toEqual([
      [-1, -2],
      [1, 2],
    ]);
  });

  it('projects rows through a deterministic PCA bundle and computes extremity', () => {
    const pca = wrappedPCA(ratingMatrix, 'column');
    expect(pca.comps).toHaveLength(2);
    expect(pca.comps[0]).toHaveLength(ratingMatrix[0].length);

    const projected = projectRows(ratingMatrix, pca);
    expect(projected).toHaveLength(ratingMatrix.length);
    expect(projected[0]).toEqual(
      expect.objectContaining({
        index: 0,
        x: expect.any(Number),
        y: expect.any(Number),
      }),
    );

    const withExtremity = computeExtremity(projected);
    expect(withExtremity.every((point) => Number.isFinite(point.extremity))).toBe(true);
  });
});

describe('polisMath clustering helpers', () => {
  it('clusters participants from matrix rows and embedded points', () => {
    const participantClusters = clusterParticipantsKmeans(ratingMatrix, 2);
    expect(participantClusters.clusters).toHaveLength(4);

    expect(clusterUMAPPointsKmeans([], 2)).toEqual([]);
    expect(
      clusterUMAPPointsKmeans(
        [
          { index: 0, x: 0, y: 0 },
          { index: 1, x: 1, y: 1 },
        ],
        3,
      ),
    ).toEqual([0, 0]);

    const embeddedClusters = clusterUMAPPointsKmeans(
      [
        { index: 0, x: 0, y: 0 },
        { index: 1, x: 0.1, y: 0.1 },
        { index: 2, x: 5, y: 5 },
        { index: 3, x: 5.1, y: 5.2 },
      ],
      2,
      7,
    );
    expect(embeddedClusters).toHaveLength(4);
    expect(new Set(embeddedClusters).size).toBe(2);
  });

  it('runs Leiden and silhouette scoring on simple separated data', () => {
    const leidenAssignments = clusterParticipantsLeiden(ratingMatrix);
    expect(leidenAssignments).toHaveLength(4);
    expect(leidenAssignments.every((cluster) => Number.isInteger(cluster))).toBe(true);

    const score = silhouetteScore(
      [
        [0, 0],
        [0, 1],
        [8, 8],
        [8, 9],
      ],
      [0, 0, 1, 1],
      2,
    );
    expect(score).toBeGreaterThan(0.8);
  });

  it('produces deterministic UMAP coordinates for a seeded tiny dataset', () => {
    const embedding = doUMAP(
      [
        [0, 0, 0],
        [0, 1, 0],
        [1, 0, 1],
        [1, 1, 1],
      ],
      2,
      12,
    );

    expect(embedding).toHaveLength(4);
    expect(embedding[0]).toHaveLength(2);
    expect(embedding.flat().every(Number.isFinite)).toBe(true);
  });
});

describe('polisMath vote summaries and representative questions', () => {
  it('summarizes votes by participant and comment', () => {
    expect(computePolisStats(ratingMatrix)).toEqual({
      nComments: 4,
      nParticipants: 4,
      totalVotes: 12,
      voters: 4,
      votesPerVoterAvg: 3,
    });

    expect(getCommentBarData(ratingMatrix)).toEqual([
      { index: 0, agrees: 2, disagrees: 2, passes: 0, total: 4 },
      { index: 1, agrees: 1, disagrees: 1, passes: 2, total: 4 },
      { index: 2, agrees: 2, disagrees: 2, passes: 0, total: 4 },
      { index: 3, agrees: 1, disagrees: 1, passes: 2, total: 4 },
    ]);

    expect(computeCommentVoteCounts(ratingMatrix)[1]).toEqual({
      commentIndex: 1,
      total: 4,
      agrees: 1,
      disagrees: 1,
      passes: 2,
    });
  });

  it('selects representative question deltas with fallback prompt labels', () => {
    expect(findRepresentativeQuestions(ratingMatrix, [0], {}, ['q1'])).toEqual({});

    const representatives = findRepresentativeQuestions(
      ratingMatrix,
      [0, 0, 1, 1],
      { q1: 'Shared support', q3: 'Shared opposition' },
      ['q1', 'q2', 'q3', 'q4'],
    );

    expect(Object.keys(representatives)).toEqual(['0', '1']);
    expect(representatives[0][0]).toEqual(
      expect.objectContaining({
        questionIndex: expect.any(Number),
        label: expect.stringMatching(/^#/),
        prompt: expect.any(String),
        difference: expect.any(Number),
      }),
    );
    expect(representatives[0].some((item) => item.prompt === 'Question #2')).toBe(true);
  });

  it('computes joint SVD coordinates and question divisiveness', () => {
    const svd = computeJointSVD(ratingMatrix, 44);
    expect(svd.part2D).toHaveLength(4);
    expect(svd.stmt2D).toHaveLength(4);
    expect(svd.part2D[0]).toEqual(expect.objectContaining({ index: 0, x: expect.any(Number), y: expect.any(Number) }));

    expect(
      computeJointSVD(
        [
          [0, 0],
          [0, 0],
        ],
        44,
      ),
    ).toEqual({
      part2D: [
        { index: 0, x: 0, y: 0 },
        { index: 1, x: 0, y: 0 },
      ],
      stmt2D: [
        { index: 0, x: 0, y: 0 },
        { index: 1, x: 0, y: 0 },
      ],
    });

    expect(computeQuestionDivisiveness(ratingMatrix)).toEqual([
      { commentIndex: 0, agrees: 2, disagrees: 2, total: 4, divisiveness: 1 },
      { commentIndex: 1, agrees: 1, disagrees: 1, total: 2, divisiveness: 1 },
      { commentIndex: 2, agrees: 2, disagrees: 2, total: 4, divisiveness: 1 },
      { commentIndex: 3, agrees: 1, disagrees: 1, total: 2, divisiveness: 1 },
    ]);
  });
});
