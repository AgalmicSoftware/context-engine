/**
 * @module polisMath
 * @description Legacy Polis-inspired utilities retained for generic charting helpers.
 *              Live Polis-equivalent report math now lives in `polisReportMath.js`.
 *
 * Key exports: (standalone library, exports via default)
 */
/**************************************************************
 * polisMath.js
 *
 * A self-contained utility library for shared chart helpers:
 *  - generic beeswarm layout
 *  - simple PCA / UMAP / clustering experiments
 *  - summary helpers used by older demos
 *
 * Dependencies:
 *    npm install d3 umap-js networkanalysis-ts ml-kmeans
 ***************************************************************/

import * as d3 from 'd3';
import { UMAP } from 'umap-js';
import { kmeans as Kmeans } from 'ml-kmeans';

import { Network, Clustering, LeidenAlgorithm } from 'networkanalysis-ts';

type NumericCell = number | null | undefined;
type NumericMatrix = number[][];
type RatingMatrix = NumericCell[][];
type NumericVector = number[];
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
type PcaResult = {
  comps: NumericVector[];
};
type KmeansOptions = {
  seed?: number;
};
type KmeansResult = {
  clusters: number[];
};
type ClusterStat = {
  sum: number;
  cnt: number;
};
type RepresentativeQuestion = {
  questionIndex: number;
  difference: number;
  label: string;
  prompt: string;
};
type Svd2Result = {
  U: NumericMatrix;
  S: NumericMatrix;
  V: NumericMatrix;
};
type SvdRank1Result = {
  u: NumericVector;
  s: number;
  v: NumericVector;
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
 * Utility: shape, dot, norm, matrix multiply
 ***************************************************************/

export function matrixShape(M: readonly (readonly unknown[])[]): [number, number] {
  const rows = M.length;
  const cols = M[0].length;
  return [rows, cols];
}

function dot(a: NumericVector, b: NumericVector): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function norm(v: NumericVector): number {
  return Math.sqrt(dot(v, v));
}

// M is shape [rows x cols], v is shape [cols]
function matVec(M: NumericMatrix, v: NumericVector): NumericVector {
  const r: NumericVector = [];
  for (let i = 0; i < M.length; i++) {
    let sum = 0;
    for (let j = 0; j < M[i].length; j++) {
      sum += M[i][j] * v[j];
    }
    r.push(sum);
  }
  return r;
}

// M^T x v
function matVecTranspose(M: NumericMatrix, v: NumericVector): NumericVector {
  const rows = M.length;
  const cols = M[0].length;
  const result = new Array(cols).fill(0);
  for (let j = 0; j < cols; j++) {
    let sum = 0;
    for (let i = 0; i < rows; i++) {
      sum += M[i][j] * v[i];
    }
    result[j] = sum;
  }
  return result;
}

/***************************************************************
 * Mean-subtraction, row-based or column-based
 ***************************************************************/

export function subtractRowMeans(M: NumericMatrix): NumericMatrix {
  for (let i = 0; i < M.length; i++) {
    const row = M[i];
    let sum = 0;
    let count = 0;
    for (let j = 0; j < row.length; j++) {
      let val = row[j] ?? 0;
      sum += val;
      count++;
    }
    const mean = count > 0 ? sum / count : 0;
    for (let j = 0; j < row.length; j++) {
      row[j] = (row[j] ?? 0) - mean;
    }
  }
  return M;
}

export function subtractColumnMeans(M: NumericMatrix): NumericMatrix {
  const [rows, cols] = matrixShape(M);
  const colMeans = new Array(cols).fill(0);
  const colCounts = new Array(cols).fill(0);
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const val = M[i][j] ?? 0;
      colMeans[j] += val;
      colCounts[j]++;
    }
  }
  for (let j = 0; j < cols; j++) {
    colMeans[j] = colCounts[j] ? colMeans[j] / colCounts[j] : 0;
  }
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      M[i][j] = (M[i][j] ?? 0) - colMeans[j];
    }
  }
  return M;
}

/***************************************************************
 * PCA: power iteration approach
 ***************************************************************/

function powerIteration(M: NumericMatrix, nIters = 20): NumericVector {
  // M shape [rows x cols], we do vector [cols]
  const cols = M[0].length;
  let v = new Array(cols).fill(0).map(() => Math.random() - 0.5);
  for (let iter = 0; iter < nIters; iter++) {
    const Mv = matVec(M, v); // shape [rows]
    const MtMv = matVecTranspose(M, Mv); // shape [cols]
    const length = norm(MtMv);
    if (length < 1e-12) break;
    for (let k = 0; k < cols; k++) {
      MtMv[k] /= length;
    }
    v = MtMv;
  }
  return v;
}

function deflate(M: NumericMatrix, pc: NumericVector): void {
  for (let i = 0; i < M.length; i++) {
    const row = M[i];
    const dp = dot(row, pc);
    for (let j = 0; j < row.length; j++) {
      row[j] = row[j] - dp * pc[j];
    }
  }
}

export function doPCA(M: NumericMatrix, nComps = 2): NumericVector[] {
  const comps: NumericVector[] = [];
  for (let c = 0; c < nComps; c++) {
    const pc = powerIteration(M, 30);
    comps.push(pc);
    deflate(M, pc);
  }
  return comps;
}

/***************************************************************
 * wrappedPCA
 ***************************************************************/

export function wrappedPCA(ratingMatrix: RatingMatrix, subtractWhat = 'row'): PcaResult {
  const M: NumericMatrix = ratingMatrix.map((r) => r.map((value) => value ?? 0));
  if (subtractWhat === 'row') {
    subtractRowMeans(M);
  } else {
    subtractColumnMeans(M);
  }
  const comps = doPCA(M, 2);
  return { comps };
}

/***************************************************************
 * Project rows or columns onto PCA comps
 ***************************************************************/

export function projectRows(ratingMatrix: RatingMatrix, pca: PcaResult): PositionedPoint2D[] {
  const out: PositionedPoint2D[] = [];
  const pc1 = pca.comps[0],
    pc2 = pca.comps[1];
  for (let i = 0; i < ratingMatrix.length; i++) {
    const row = ratingMatrix[i];
    let x = 0,
      y = 0;
    for (let j = 0; j < row.length; j++) {
      x += (row[j] ?? 0) * pc1[j];
      y += (row[j] ?? 0) * pc2[j];
    }
    out.push({ index: i, x, y });
  }
  return out;
}

/***************************************************************
 * “extremity” (used by some older demos)
 ***************************************************************/

export function computeExtremity(points: Point2D[]): Point2D[] {
  for (let p of points) {
    const x = p.x ?? 0;
    const y = p.y ?? 0;
    p.extremity = Math.sqrt(x * x + y * y);
  }
  return points;
}

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
 * Summaries
 ***************************************************************/

export function computePolisStats(ratingMatrix: RatingMatrix) {
  const [nComments, nParticipants] = matrixShape(ratingMatrix);
  let participantVotes = new Array(nParticipants).fill(0);
  let totalVotes = 0;
  for (let c = 0; c < nComments; c++) {
    for (let p = 0; p < nParticipants; p++) {
      const val = ratingMatrix[c][p];
      if (val === 1 || val === -1) {
        participantVotes[p]++;
        totalVotes++;
      }
    }
  }
  let voters = participantVotes.filter((v) => v > 0).length;
  let votesPerVoterAvg = voters > 0 ? totalVotes / voters : 0;
  return {
    nComments,
    nParticipants,
    totalVotes,
    voters,
    votesPerVoterAvg,
  };
}

/***************************************************************
 * K-Means for participants
 ***************************************************************/

export function clusterParticipantsKmeans(ratingMatrix: RatingMatrix, k = 3): KmeansResult {
  const [nComments, nParticipants] = matrixShape(ratingMatrix);
  // build participant array
  const partData: NumericMatrix = [];
  for (let p = 0; p < nParticipants; p++) {
    const row = [];
    for (let c = 0; c < nComments; c++) {
      row.push(ratingMatrix[c][p] ?? 0);
    }
    partData.push(row);
  }
  const out = Kmeans(partData, k, {}) as KmeansResult;
  return out;
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
 * Leiden
 *   We do “normalized network” approach...
 ***************************************************************/

function buildSimilarityMatrix(ratingMatrix: RatingMatrix): NumericMatrix {
  const [nComments, nParticipants] = matrixShape(ratingMatrix);
  const participants: NumericMatrix = [];
  for (let p = 0; p < nParticipants; p++) {
    let row = [];
    for (let c = 0; c < nComments; c++) {
      row.push(ratingMatrix[c][p] ?? 0);
    }
    participants.push(row);
  }
  const adjacency: NumericMatrix = [];
  for (let i = 0; i < nParticipants; i++) {
    adjacency[i] = new Array(nParticipants).fill(0);
  }
  for (let i = 0; i < nParticipants; i++) {
    for (let j = i + 1; j < nParticipants; j++) {
      const v1 = participants[i],
        v2 = participants[j];
      let s = 0;
      for (let k = 0; k < v1.length; k++) {
        s += v1[k] * v2[k];
      }
      adjacency[i][j] = s;
      adjacency[j][i] = s;
    }
  }
  return adjacency;
}

export function clusterParticipantsLeiden(ratingMatrix: RatingMatrix): number[] {
  const adjacency = buildSimilarityMatrix(ratingMatrix);
  const nNodes = adjacency.length;
  const edgesRow: number[] = [];
  const edgesCol: number[] = [];
  for (let i = 0; i < nNodes; i++) {
    for (let j = i + 1; j < nNodes; j++) {
      let weight = adjacency[i][j];
      if (weight > 0) {
        edgesRow.push(i);
        edgesCol.push(j);
      }
    }
  }
  const network = new Network({
    nNodes,
    setNodeWeightsToTotalEdgeWeights: true,
    edges: [edgesRow, edgesCol],
    sortedEdges: false,
    checkIntegrity: false,
  });
  const normed = network.createNormalizedNetworkUsingAssociationStrength();
  const leiden = new LeidenAlgorithm();
  leiden.setResolution(0.3);
  leiden.setNIterations(50);
  let bestClustering: Clustering | null = null;
  let bestQuality = -Infinity;
  for (let i = 0; i < 5; i++) {
    let c = new Clustering({ nNodes: normed.getNNodes() });
    leiden.improveClustering(normed, c);
    let q = leiden.calcQuality(normed, c);
    if (q > bestQuality) {
      bestQuality = q;
      bestClustering = c;
    }
  }
  const assignment: number[] = [];
  for (let n = 0; n < nNodes; n++) {
    assignment[n] = bestClustering?.getCluster(n) ?? 0;
  }
  return assignment;
}

/***************************************************************
 * Silhouette
 ***************************************************************/

function euclDist(a: NumericVector, b: NumericVector): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    let d = a[i] - b[i];
    s += d * d;
  }
  return Math.sqrt(s);
}

export function silhouetteScore(data: NumericMatrix, clusters: number[], k: number): number {
  const cMembers: number[][] = [];
  for (let i = 0; i < k; i++) {
    cMembers[i] = [];
  }
  for (let i = 0; i < data.length; i++) {
    cMembers[clusters[i]].push(i);
  }
  const n = data.length;
  const distMat = Array.from({ length: n }, () => new Array(n));
  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      let d = euclDist(data[i], data[j]);
      distMat[i][j] = d;
      distMat[j][i] = d;
    }
  }
  let sumS = 0;
  for (let i = 0; i < n; i++) {
    let c = clusters[i];
    let a = 0;
    if (cMembers[c].length > 1) {
      for (let idx of cMembers[c]) {
        if (idx !== i) {
          a += distMat[i][idx];
        }
      }
      a /= cMembers[c].length - 1;
    }
    let b = Infinity;
    for (let c2 = 0; c2 < k; c2++) {
      if (c2 === c) continue;
      if (cMembers[c2].length < 1) continue;
      let sumD = 0;
      for (let idx2 of cMembers[c2]) {
        sumD += distMat[i][idx2];
      }
      let avgD = sumD / cMembers[c2].length;
      if (avgD < b) b = avgD;
    }
    const s = (b - a) / Math.max(a, b);
    sumS += s;
  }
  return sumS / n;
}

/***************************************************************
 * UMAP
 ***************************************************************/

export function doUMAP(data: NumericMatrix, nNeighbors = 15, randomSeed: number | null = null): NumericMatrix {
  const umapOptions: { nNeighbors: number; random?: () => number } = { nNeighbors };

  if (randomSeed !== null) {
    // Simple PRNG for deterministic results
    const mulberry32 = (a: number) => {
      return function () {
        var t = (a += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    };
    umapOptions.random = mulberry32(randomSeed);
  }

  const umap = new UMAP(umapOptions);
  const embedding = umap.fit(data); // shape => [nSamples][2]
  return embedding;
}

/***************************************************************
 * Example “bar chart data” summarizing how many participants
 * agreed / disagreed / passed for each comment
 ***************************************************************/

export function getCommentBarData(ratingMatrix: RatingMatrix) {
  const barData: Array<{ index: number; agrees: number; disagrees: number; passes: number; total: number }> = [];
  for (let c = 0; c < ratingMatrix.length; c++) {
    const row = ratingMatrix[c];
    let agrees = 0,
      disagrees = 0,
      passes = 0;
    for (let val of row) {
      if (val === 1) agrees++;
      else if (val === -1) disagrees++;
      else passes++;
    }
    barData.push({ index: c, agrees, disagrees, passes, total: row.length });
  }
  return barData;
}

/***************************************************************
 * computeCommentVoteCounts
 ***************************************************************/

export function computeCommentVoteCounts(ratingMatrix: RatingMatrix) {
  // Example: compute how many participants agreed/disagreed for each comment
  const result: Array<{ commentIndex: number; total: number; agrees: number; disagrees: number; passes: number }> = [];
  for (let c = 0; c < ratingMatrix.length; c++) {
    let agrees = 0;
    let disagrees = 0;
    let passes = 0;
    for (let p = 0; p < ratingMatrix[c].length; p++) {
      let val = ratingMatrix[c][p];
      if (val === 1) agrees++;
      else if (val === -1) disagrees++;
      else passes++;
    }
    result.push({
      commentIndex: c,
      total: ratingMatrix[c].length,
      agrees,
      disagrees,
      passes,
    });
  }
  return result;
}

/***************************************************************
 * findRepresentativeQuestions
 ***************************************************************/

export function findRepresentativeQuestions(
  ratingMatrix: RatingMatrix,
  assignments: number[],
  questionPromptsMap: Record<string, string> | null | undefined,
  allQuestions: string[],
): Record<number, RepresentativeQuestion[]> {
  const [nComments, nParticipants] = matrixShape(ratingMatrix);
  if (!assignments || assignments.length !== nParticipants) return {};

  // Compute global average for each comment
  const globalAvg = new Array(nComments).fill(0);
  const globalCount = new Array(nComments).fill(0);
  for (let c = 0; c < nComments; c++) {
    for (let p = 0; p < nParticipants; p++) {
      const val = ratingMatrix[c][p];
      if (val === 1 || val === -1) {
        globalAvg[c] += val === 1 ? 1 : 0;
        globalCount[c]++;
      }
    }
  }
  for (let c = 0; c < nComments; c++) {
    if (globalCount[c] > 0) {
      globalAvg[c] /= globalCount[c]; // fraction that agree
    } else {
      globalAvg[c] = 0;
    }
  }

  // For each cluster, compute average for each comment
  const clusterMaps: Record<number, ClusterStat[]> = {};
  for (let p = 0; p < nParticipants; p++) {
    const cl = assignments[p];
    if (!clusterMaps[cl]) {
      clusterMaps[cl] = new Array(nComments).fill(0).map(() => ({ sum: 0, cnt: 0 }));
    }
    for (let c = 0; c < nComments; c++) {
      const val = ratingMatrix[c][p];
      if (val === 1 || val === -1) {
        clusterMaps[cl][c].cnt++;
        if (val === 1) {
          clusterMaps[cl][c].sum++;
        }
      }
    }
  }

  const result: Record<number, RepresentativeQuestion[]> = {};

  Object.keys(clusterMaps).forEach((kStr) => {
    const k = parseInt(kStr, 10);
    const arr = clusterMaps[k];
    const diffs = [];
    for (let c = 0; c < nComments; c++) {
      const { sum, cnt } = arr[c];
      let clusterAvg = 0;
      if (cnt > 0) clusterAvg = sum / cnt;
      const diff = clusterAvg - globalAvg[c];
      const qId = allQuestions[c];
      const realPrompt =
        questionPromptsMap && qId && questionPromptsMap[qId] ? questionPromptsMap[qId] : `Question #${c + 1}`;
      diffs.push({
        questionIndex: c,
        difference: diff,
        label: `#${c + 1}`,
        prompt: realPrompt,
      });
    }
    diffs.sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));
    result[k] = diffs;
  });

  return result;
}

/***************************************************************
 * computeJointSVD
 ***************************************************************/

export function computeJointSVD(ratingMatrix: RatingMatrix, randomSeed = 42): { part2D: Point2D[]; stmt2D: Point2D[] } {
  const nComments = ratingMatrix.length;
  const nParticipants = ratingMatrix[0].length;
  const M: NumericMatrix = [];
  for (let c = 0; c < nComments; c++) {
    let row = [];
    for (let p = 0; p < nParticipants; p++) {
      row.push(ratingMatrix[c][p] ?? 0);
    }
    M.push(row);
  }
  const { U, S, V } = approximateSVD2(M, randomSeed);

  function sqrt2x2(M2: NumericMatrix): NumericMatrix {
    let s0 = Math.sqrt(M2[0][0] || 0);
    let s1 = Math.sqrt(M2[1][1] || 0);
    return [
      [s0, 0],
      [0, s1],
    ];
  }
  const sSqrt = sqrt2x2(S);

  const rowCoords: Point2D[] = [];
  for (let c = 0; c < nComments; c++) {
    const ux = U[c][0] || 0;
    const uy = U[c][1] || 0;
    const x = ux * (sSqrt[0][0] || 0) + uy * (sSqrt[0][1] || 0);
    const y = ux * (sSqrt[1][0] || 0) + uy * (sSqrt[1][1] || 0);
    rowCoords.push({ index: c, x, y });
  }

  const colCoords: Point2D[] = [];
  for (let p = 0; p < nParticipants; p++) {
    const vx = V[p][0] || 0;
    const vy = V[p][1] || 0;
    const x = vx * (sSqrt[0][0] || 0) + vy * (sSqrt[0][1] || 0);
    const y = vx * (sSqrt[1][0] || 0) + vy * (sSqrt[1][1] || 0);
    colCoords.push({ index: p, x, y });
  }

  return {
    part2D: colCoords,
    stmt2D: rowCoords,
  };
}

function approximateSVD2(A: NumericMatrix, randomSeed: number | null = null): Svd2Result {
  const m = A.length;
  const n = A[0].length;

  // --- deterministic RNG (mulberry32) when a seed is provided ---
  function mulberry32(a: number): () => number {
    return function () {
      let t = (a += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rng = randomSeed == null ? Math.random : mulberry32(randomSeed);

  function matVec(mtx: NumericMatrix, vec: NumericVector): NumericVector {
    const out = new Array(mtx.length).fill(0);
    for (let i = 0; i < mtx.length; i++) {
      const row = mtx[i];
      let sum = 0;
      for (let j = 0; j < row.length; j++) sum += row[j] * vec[j];
      out[i] = sum;
    }
    return out;
  }

  function matTvec(mtx: NumericMatrix, vec: NumericVector): NumericVector {
    const out = new Array(mtx[0].length).fill(0);
    for (let j = 0; j < mtx[0].length; j++) {
      let sum = 0;
      for (let i = 0; i < mtx.length; i++) sum += mtx[i][j] * vec[i];
      out[j] = sum;
    }
    return out;
  }

  function normV(vec: NumericVector): number {
    let s = 0;
    for (let x of vec) s += x * x;
    return Math.sqrt(s);
  }

  function scale(vec: NumericVector, sc: number): NumericVector {
    return vec.map((x: number) => x * sc);
  }

  function powerIterationRank1(Min: NumericMatrix, maxIter = 25): SvdRank1Result {
    const nCols = Min[0].length;
    // **seeded** initialization instead of Math.random()
    let v = new Array(nCols).fill(0).map(() => rng() - 0.5);
    let vnorm = normV(v);
    if (vnorm < 1e-12) return { u: [], s: 0, v: [] };
    v = scale(v, 1 / vnorm);

    let sVal = 0;
    for (let iter = 0; iter < maxIter; iter++) {
      const Av = matVec(Min, v);
      const Avn = normV(Av);
      if (Avn < 1e-12) break;
      const uCandidate = scale(Av, 1 / Avn);

      const Atu = matTvec(Min, uCandidate);
      const atun = normV(Atu);
      if (atun < 1e-12) break;
      const vCandidate = scale(Atu, 1 / atun);
      sVal = atun;
      v = vCandidate;
    }
    const Avfinal = matVec(Min, v);
    const sCheck = normV(Avfinal) || 1e-12;
    const u = scale(Avfinal, 1 / sCheck);
    return { u, s: sVal, v };
  }

  function deflate(Min: NumericMatrix, { u, s, v }: SvdRank1Result): void {
    for (let i = 0; i < m; i++) {
      for (let j = 0; j < n; j++) {
        Min[i][j] = Min[i][j] - s * u[i] * v[j];
      }
    }
  }

  const U: NumericMatrix = [],
    S = [
      [0, 0],
      [0, 0],
    ],
    V: NumericMatrix = [];

  const r1 = powerIterationRank1(A, 25);
  if (r1.s < 1e-12) {
    const Uout = new Array(m).fill(null).map(() => [0, 0]);
    const Vout = new Array(n).fill(null).map(() => [0, 0]);
    return { U: Uout, S, V: Vout };
  }
  for (let i = 0; i < m; i++) U.push([r1.u[i], 0]);
  for (let j = 0; j < n; j++) V.push([r1.v[j], 0]);
  S[0][0] = r1.s;
  S[1][1] = 0;
  deflate(A, r1);

  // second component (seeded too because the same rng is reused)
  const r2 = powerIterationRank1(A, 25);
  if (r2.s > 1e-12) {
    S[1][1] = r2.s;
    for (let i = 0; i < m; i++) U[i][1] = r2.u[i];
    for (let j = 0; j < n; j++) V[j][1] = r2.v[j];
  }

  return { U, S, V };
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
  const [nComments, nParticipants] = matrixShape(ratingMatrix);
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
    for (let p = 0; p < nParticipants; p++) {
      const val = ratingMatrix[c][p];
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
