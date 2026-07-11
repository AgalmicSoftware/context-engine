/**
 * @module consensusMath
 * @description Legacy Polis-inspired utilities retained for generic charting helpers.
 *              Live Polis-equivalent report math now lives in `consensusReportMath.ts`.
 *
 * Key exports: beeswarmByExtremity, doUMAP, clusterUMAPPointsKmeans, computeQuestionDivisiveness
 */
/**************************************************************
 * consensusMath.ts
 *
 * A self-contained utility library for shared chart helpers:
 *  - generic beeswarm layout
 *  - UMAP and simple clustering experiments
 *  - question divisiveness summaries used by older demos
 *
 * Dependencies:
 *    npm install d3 umap-js ml-kmeans
 ***************************************************************/

import * as d3 from 'd3';
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
  extremity?: number;
  [key: string]: unknown;
};
type PositionedPoint2D = Point2D & {
  index: number;
  x: number;
  y: number;
};
type KmeansOptions = {
  seed?: number;
};
type KmeansResult = {
  clusters: number[];
};
type D3LinearScale = {
  domain(values: [number, number]): {
    range(values: [number, number]): (value: number) => number;
  };
};
type D3Simulation<T> = {
  force(name: string, force: unknown): D3Simulation<T>;
  stop(): D3Simulation<T>;
  tick(): D3Simulation<T>;
};
type D3Facade = {
  min<T>(values: T[], accessor: (value: T) => number | undefined): number | undefined;
  max<T>(values: T[], accessor: (value: T) => number | undefined): number | undefined;
  scaleLinear(): D3LinearScale;
  forceSimulation<T>(data: T[]): D3Simulation<T>;
  forceX<T>(accessor: (value: T) => number): unknown & { strength(value: number): unknown };
  forceY(value: number): unknown & { strength(value: number): unknown };
  forceCollide(radius: number): unknown;
};

const d3Runtime = Object(d3) as D3Facade;

/***************************************************************
 * BeeSwarm by x=extremity (example usage)
 ***************************************************************/

export function beeswarmByExtremity(points: Point2D[], width: number, height: number): PositionedPoint2D[] {
  const minE = d3Runtime.min(points, (d) => d.extremity) ?? 0;
  const maxE = d3Runtime.max(points, (d) => d.extremity) ?? 1;
  const xScale = d3Runtime
    .scaleLinear()
    .domain([minE, maxE])
    .range([40, width - 40]);
  const dataCopy = points.map((d) => ({ ...d }));
  const centerY = height / 2;

  const sim = d3Runtime
    .forceSimulation(dataCopy)
    .force('x', d3Runtime.forceX<Point2D>((d) => xScale(d.extremity ?? 0)).strength(2))
    .force('y', d3Runtime.forceY(centerY).strength(0.2))
    .force('collide', d3Runtime.forceCollide(7))
    .stop();

  for (let i = 0; i < 120; i++) sim.tick();

  return dataCopy.map((point, index) => ({
    ...point,
    index: typeof point.index === 'number' ? point.index : index,
    x: Number(point.x ?? 0),
    y: Number(point.y ?? centerY),
  }));
}

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
