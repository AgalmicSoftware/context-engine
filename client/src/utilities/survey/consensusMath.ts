/**
 * @module consensusMath
 * @description Legacy Polis-inspired utilities retained for embedding and divisiveness helpers.
 *              Live Polis-equivalent report math now lives in `consensusReportMath.ts`.
 *
 * Key exports: doUMAP, clusterUMAPPointsKmeans, computeQuestionDivisiveness
 */
/**************************************************************
 * consensusMath.ts
 *
 * A self-contained utility library for shared analysis helpers:
 *  - UMAP and simple clustering experiments
 *  - question divisiveness summaries used by older demos
 *
 * Dependencies:
 *    npm install umap-js ml-kmeans
 ***************************************************************/

import { UMAP } from 'umap-js';
import { kmeans as Kmeans } from 'ml-kmeans';
import { mulberry32 } from './seededPrng.js';

type NumericCell = number | null | undefined;
type NumericMatrix = number[][];
type RatingMatrix = NumericCell[][];
type Point2D = {
  index?: number | string;
  x?: number;
  y?: number;
  [key: string]: unknown;
};
type KmeansOptions = {
  seed?: number;
};
type KmeansResult = {
  clusters: number[];
};
/***************************************************************
 * UMAP
 ***************************************************************/

export function doUMAP(data: NumericMatrix, nNeighbors = 15, randomSeed: number | null = null): NumericMatrix {
  const umapOptions: { nNeighbors: number; random?: () => number } = { nNeighbors };

  if (randomSeed !== null) {
    umapOptions.random = mulberry32(randomSeed);
  }

  const umap = new UMAP(umapOptions);
  const embedding = umap.fit(data); // shape => [nSamples][2]
  return embedding;
}

/***************************************************************
 * clusterUMAPPointsKmeans: cluster the 2D embedded participants
 ***************************************************************/
export function clusterUMAPPointsKmeans(umapPoints: Point2D[], k = 3, seed: number | null = null): number[] {
  // umapPoints is array of { x, y, index }
  if (!umapPoints || !umapPoints.length) return [];
  const data: NumericMatrix = umapPoints.map((d) => [d.x ?? 0, d.y ?? 0]);
  if (data.length < k) {
    return new Array(data.length).fill(0);
  }
  const kmeansOptions: KmeansOptions = {};
  if (seed !== null) {
    kmeansOptions.seed = seed;
  }
  const result = Kmeans(data, k, kmeansOptions) as KmeansResult;
  // result.clusters is array of cluster indices
  return result.clusters;
}

/***************************************************************
 * computeQuestionDivisiveness
 *
 * For each comment-row of ratingMatrix, we only count participants
 * who have either 1 (Agree) or -1 (Disagree).  We skip participants
 * with 0 (Unsure) or null/undefined (No response) in that row.
 *
 * Let agrees = # of participants that had value 1
 *     disagrees = # of participants that had value -1
 *     total = agrees + disagrees
 *
 * If total > 0, define probAgree = (agrees / total).
 * Then the “Pol.is style” divisiveness is:
 *    divisiveness = 1 - 2 * | probAgree - 0.5 |
 * This yields 0 for unanimous (all or none agrees),
 * up to 1 for a perfect 50/50 split.
 *
 ***************************************************************/
export function computeQuestionDivisiveness(ratingMatrix: RatingMatrix) {
  const rows = Array.isArray(ratingMatrix) ? ratingMatrix : [];
  const nComments = rows.length;
  const nParticipants = nComments > 0 && Array.isArray(rows[0]) ? rows[0].length : 0;
  const results: Array<{
    commentIndex: number;
    agrees: number;
    disagrees: number;
    total: number;
    divisiveness: number;
  }> = [];

  for (let c = 0; c < nComments; c++) {
    let agrees = 0;
    let disagrees = 0;
    const row = Array.isArray(rows[c]) ? rows[c] : [];
    for (let p = 0; p < nParticipants; p++) {
      const val = row[p];
      // Only count 1 or -1 as actual responses
      if (val === 1) agrees++;
      else if (val === -1) disagrees++;
      // if val === 0 (unsure) or null/undefined => ignore
    }
    const total = agrees + disagrees;
    let divisiveness = 0;
    if (total > 0) {
      const probAgree = agrees / total;
      const distFromHalf = Math.abs(probAgree - 0.5);
      divisiveness = 1 - 2 * distFromHalf; // range [0..1]
    }
    results.push({
      commentIndex: c,
      agrees,
      disagrees,
      total,
      divisiveness,
    });
  }

  return results;
}
