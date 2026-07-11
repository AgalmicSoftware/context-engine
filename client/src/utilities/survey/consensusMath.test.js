import { clusterUMAPPointsKmeans, computeQuestionDivisiveness, doUMAP } from './consensusMath';

const ratingMatrix = [
  [1, 1, -1, -1],
  [1, 0, -1, null],
  [-1, -1, 1, 1],
  [null, 1, 0, -1],
];

describe('consensusMath clustering helpers', () => {
  it('clusters embedded UMAP points', () => {
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

describe('computeQuestionDivisiveness', () => {
  it('computes 50/50 split divisiveness from agree and disagree votes', () => {
    expect(computeQuestionDivisiveness(ratingMatrix)).toEqual([
      { commentIndex: 0, agrees: 2, disagrees: 2, total: 4, divisiveness: 1 },
      { commentIndex: 1, agrees: 1, disagrees: 1, total: 2, divisiveness: 1 },
      { commentIndex: 2, agrees: 2, disagrees: 2, total: 4, divisiveness: 1 },
      { commentIndex: 3, agrees: 1, disagrees: 1, total: 2, divisiveness: 1 },
    ]);
  });

  it('returns an empty result for an empty matrix', () => {
    expect(computeQuestionDivisiveness([])).toEqual([]);
  });
});
