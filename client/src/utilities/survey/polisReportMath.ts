/**
 * @module polisReportMath
 * @description Polis-style report math helpers for the live report views.
 *
 * This file ports the parts of the open-source Polis math pipeline that most
 * directly affect how the UI looks:
 *   - column-centered PCA over a participant x comment matrix
 *   - sparsity-aware participant/comment projection
 *   - in-conversation participant selection
 *   - base/group clustering with silhouette-based k selection
 *   - representative-comment ("repness") ranking
 */

type VoteValue = -1 | 0 | 1 | null | undefined;
type RatingRow = VoteValue[];
export type PolisReportRatingMatrix = RatingRow[];
type NumericVector = number[];
type NumericMatrix = NumericVector[];
type ConsensusKind = 'agree' | 'disagree';

interface PolisReportMathOptions {
  randomSeed?: number;
  nComps?: number;
  pcaIterations?: number;
  baseK?: number;
  maxK?: number;
  kmeansIterations?: number;
  inConversationFloor?: number;
  inConversationThresholdCap?: number;
  pcaBundle?: PolisPcaBundle | null;
}

interface PcaModel {
  center: NumericVector;
  comps: NumericMatrix;
}

interface PolisPoint {
  [key: string]: unknown;
  index: number;
  x: number;
  y: number;
}

interface PolisPcaBundle {
  pca: PcaModel;
  participantMatrix: PolisReportRatingMatrix;
  participantCoords: PolisPoint[];
  statementCoords: PolisPoint[];
  commentExtremity: NumericVector;
}

interface KMeansItem {
  id: number;
  position: NumericVector;
}

interface Cluster {
  id: number;
  center: NumericVector;
  members: number[];
}

interface WorkingCluster extends Cluster {
  positions: KMeansItem[];
}

interface CommentStats {
  agree: number;
  disagree: number;
  pass: number;
  seen: number;
  pa: number;
  pd: number;
  pat: number;
  pdt: number;
}

interface ComparativeCommentStats extends CommentStats {
  restAgree: number;
  restDisagree: number;
  restSeen: number;
  restPass: number;
  ra: number;
  rd: number;
  rat: number;
  rdt: number;
}

interface RepresentativeComment {
  [key: string]: unknown;
  questionIndex: number;
  label: string;
  prompt: string;
  repfulFor: ConsensusKind;
  nSuccess: number;
  nTrials: number;
  pSuccess: number;
  pTest: number;
  repness: number;
  repnessTest: number;
  difference: number;
  clusterAgreeRate: number;
  clusterDisagreeRate: number;
  overallAgreeRate: number;
  overallDisagreeRate: number;
  bestAgree?: boolean;
  nAgree?: number;
}

interface ConsensusComment {
  questionIndex: number;
  label: string;
  prompt: string;
  kind: ConsensusKind;
  nSuccess: number;
  nTrials: number;
  pSuccess: number;
  pTest: number;
}

interface GroupVoteStats {
  A: number;
  D: number;
  S: number;
}

interface GroupVoteBucket {
  nMembers: number;
  votes: Record<string, GroupVoteStats>;
}

type GroupVotes = Record<string, GroupVoteBucket>;

const SIG_90_Z = 1.2816;
const POLIS_DEFAULTS: Required<Omit<PolisReportMathOptions, 'pcaBundle'>> = Object.freeze({
  randomSeed: 42,
  nComps: 2,
  pcaIterations: 100,
  baseK: 100,
  maxK: 5,
  kmeansIterations: 100,
  inConversationFloor: 15,
  inConversationThresholdCap: 7,
});

const isMissingVote = (value: unknown): value is null | undefined => value === null || value === undefined;
const isCountedVote = (value: unknown): value is -1 | 0 | 1 => value === 1 || value === -1 || value === 0;
const isAgreeVote = (value: unknown): value is 1 => value === 1;
const isDisagreeVote = (value: unknown): value is -1 => value === -1;
const isBinaryVote = (value: unknown): value is -1 | 1 => isAgreeVote(value) || isDisagreeVote(value);

function matrixShape(matrix: PolisReportRatingMatrix = []): [number, number] {
  const rows = Array.isArray(matrix) ? matrix.length : 0;
  const cols = rows > 0 && Array.isArray(matrix[0]) ? matrix[0].length : 0;
  return [rows, cols];
}

function dot(left: NumericVector = [], right: NumericVector = []): number {
  let sum = 0;
  const len = Math.min(left.length, right.length);
  for (let i = 0; i < len; i += 1) {
    sum += (left[i] || 0) * (right[i] || 0);
  }
  return sum;
}

function norm(vector: NumericVector = []): number {
  return Math.sqrt(dot(vector, vector));
}

function euclideanDistance(left: NumericVector = [], right: NumericVector = []): number {
  let sum = 0;
  const len = Math.min(left.length, right.length);
  for (let i = 0; i < len; i += 1) {
    const delta = (left[i] || 0) - (right[i] || 0);
    sum += delta * delta;
  }
  return Math.sqrt(sum);
}

function normalize(vector: NumericVector = []): NumericVector {
  const length = norm(vector);
  if (length < 1e-12) return vector.map(() => 0);
  return vector.map((value) => value / length);
}

function mulberry32(seed = 42): () => number {
  let value = seed >>> 0;
  return function next() {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mean(values: NumericVector = []): number {
  if (!values.length) return 0;
  let total = 0;
  for (let i = 0; i < values.length; i += 1) total += values[i];
  return total / values.length;
}

function zipRest<T, R>(items: T[] = [], mapper: (item: T, rest: T[]) => R): R[] {
  return items.map((item, index) => {
    const rest = items.slice(0, index).concat(items.slice(index + 1));
    return mapper(item, rest);
  });
}

function buildParticipantMajorMatrix(ratingMatrix: PolisReportRatingMatrix = []): PolisReportRatingMatrix {
  const [nComments, nParticipants] = matrixShape(ratingMatrix);
  if (!nComments || !nParticipants) return [];

  return Array.from({ length: nParticipants }, (_, participantIndex) =>
    Array.from({ length: nComments }, (_, commentIndex) => {
      const row = Array.isArray(ratingMatrix[commentIndex]) ? ratingMatrix[commentIndex] : [];
      return row[participantIndex] ?? null;
    }),
  );
}

function countVotesPerParticipant(
  ratingMatrix: PolisReportRatingMatrix = [],
  shouldCountVote: (value: VoteValue) => boolean = isCountedVote,
): number[] {
  const [nComments, nParticipants] = matrixShape(ratingMatrix);
  const counts = new Array(nParticipants).fill(0);
  for (let commentIndex = 0; commentIndex < nComments; commentIndex += 1) {
    const row = Array.isArray(ratingMatrix[commentIndex]) ? ratingMatrix[commentIndex] : [];
    for (let participantIndex = 0; participantIndex < nParticipants; participantIndex += 1) {
      if (shouldCountVote(row[participantIndex])) counts[participantIndex] += 1;
    }
  }
  return counts;
}

function computeColumnMeans(participantMatrix: PolisReportRatingMatrix = []): NumericVector {
  if (!participantMatrix.length) return [];
  const nComments = participantMatrix[0]?.length || 0;
  const sums = new Array(nComments).fill(0);
  const counts = new Array(nComments).fill(0);

  participantMatrix.forEach((row = []) => {
    for (let commentIndex = 0; commentIndex < nComments; commentIndex += 1) {
      const value = row[commentIndex];
      if (isMissingVote(value)) continue;
      sums[commentIndex] += value;
      counts[commentIndex] += 1;
    }
  });

  return sums.map((sum, commentIndex) => (counts[commentIndex] ? sum / counts[commentIndex] : 0));
}

function buildCenteredDenseMatrix(
  participantMatrix: PolisReportRatingMatrix = [],
  center: NumericVector = [],
): NumericMatrix {
  return participantMatrix.map((row = []) =>
    row.map((value, commentIndex) => {
      const filled = isMissingVote(value) ? center[commentIndex] || 0 : value;
      return filled - (center[commentIndex] || 0);
    }),
  );
}

function xtxr(data: NumericMatrix = [], startVector: NumericVector = []): NumericVector {
  const nCols = startVector.length;
  const currentVector = new Array(nCols).fill(0);
  data.forEach((row = []) => {
    const product = dot(startVector, row);
    for (let columnIndex = 0; columnIndex < nCols; columnIndex += 1) {
      currentVector[columnIndex] += product * (row[columnIndex] || 0);
    }
  });
  return currentVector;
}

function factorMatrix(data: NumericMatrix = [], principalComponent: NumericVector = []): NumericMatrix {
  if (Math.abs(dot(principalComponent, principalComponent)) < 1e-12) {
    return data.map((row) => [...row]);
  }
  return data.map((row = []) => {
    const coefficient = dot(row, principalComponent) / dot(principalComponent, principalComponent);
    return row.map((value, index) => value - coefficient * (principalComponent[index] || 0));
  });
}

function buildStartingVector(nCols: number, rng: () => number): NumericVector {
  return Array.from({ length: nCols }, () => rng() - 0.5);
}

function powerIteration(
  data: NumericMatrix = [],
  iterations = POLIS_DEFAULTS.pcaIterations,
  rng = mulberry32(),
): NumericVector {
  const nCols = data[0]?.length || 0;
  if (!nCols) return [];

  let vector = normalize(buildStartingVector(nCols, rng));
  let lastEigenvalue = 0;

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const productVector = xtxr(data, vector);
    const eigenvalue = norm(productVector);
    const normalized = normalize(productVector);
    if (Math.abs(eigenvalue - lastEigenvalue) < 1e-12) {
      vector = normalized;
      break;
    }
    vector = normalized;
    lastEigenvalue = eigenvalue;
  }

  return vector;
}

function computePca(
  centeredData: NumericMatrix = [],
  options: PolisReportMathOptions = {},
): { comps: NumericMatrix; center?: NumericVector } {
  const nRows = centeredData.length;
  const nCols = centeredData[0]?.length || 0;
  const nComps = Math.min(options.nComps || POLIS_DEFAULTS.nComps, nRows || 0, nCols || 0);
  const rng = mulberry32(options.randomSeed ?? POLIS_DEFAULTS.randomSeed);

  if (!nRows || !nCols || nComps <= 0) {
    return {
      center: new Array(nCols).fill(0),
      comps: Array.from({ length: POLIS_DEFAULTS.nComps }, () => new Array(nCols).fill(0)),
    };
  }

  let working = centeredData.map((row) => [...row]);
  const comps = [];
  for (let componentIndex = 0; componentIndex < nComps; componentIndex += 1) {
    const component = powerIteration(working, options.pcaIterations ?? POLIS_DEFAULTS.pcaIterations, rng);
    comps.push(component);
    working = factorMatrix(working, component);
  }

  while (comps.length < POLIS_DEFAULTS.nComps) {
    comps.push(new Array(nCols).fill(0));
  }

  return { comps };
}

function sparsityAwareProjectVoteVector(votes: RatingRow = [], pca: Partial<PcaModel> = {}): [number, number] {
  const center = Array.isArray(pca.center) ? pca.center : [];
  const comps = Array.isArray(pca.comps) ? pca.comps : [];
  const pc1 = Array.isArray(comps[0]) ? comps[0] : [];
  const pc2 = Array.isArray(comps[1]) ? comps[1] : [];
  const nComments = votes.length;

  let nVotes = 0;
  let x = 0;
  let y = 0;

  for (let commentIndex = 0; commentIndex < nComments; commentIndex += 1) {
    const value = votes[commentIndex];
    if (isMissingVote(value)) continue;
    const centered = value - (center[commentIndex] || 0);
    x += centered * (pc1[commentIndex] || 0);
    y += centered * (pc2[commentIndex] || 0);
    nVotes += 1;
  }

  const scale = Math.sqrt(nComments / Math.max(nVotes, 1));
  return [x * scale, y * scale];
}

function buildCommentCoordinates(pca: Partial<PcaModel> = {}, nComments = 0): PolisPoint[] {
  return Array.from({ length: nComments }, (_, commentIndex) => {
    const votes = new Array(nComments).fill(null);
    // Regression guard: use the local "agree = 1" encoding here; flipping the
    // sign mirrors the entire PCA space and breaks alignment with the rest of
    // this client's vote semantics.
    votes[commentIndex] = 1;
    const [x, y] = sparsityAwareProjectVoteVector(votes, pca);
    return { index: commentIndex, x, y };
  });
}

function computeCommentExtremity(statementCoords: PolisPoint[] = []): NumericVector {
  return statementCoords.map((point) => Math.sqrt((point.x || 0) ** 2 + (point.y || 0) ** 2));
}

function serializePosition(position: NumericVector = []): string {
  return position.map((value) => Number(value).toFixed(12)).join('|');
}

function weightedMeanPosition(items: KMeansItem[] = [], weightsById: Record<number, number> = {}): [number, number] {
  if (!items.length) return [0, 0];

  let totalWeight = 0;
  let x = 0;
  let y = 0;
  items.forEach((item) => {
    const weight = weightsById[item.id] || 1;
    totalWeight += weight;
    x += (item.position[0] || 0) * weight;
    y += (item.position[1] || 0) * weight;
  });

  if (!totalWeight) return [0, 0];
  return [x / totalWeight, y / totalWeight];
}

function sameCenters(previous: Cluster[] = [], next: Cluster[] = [], threshold = 0.01): boolean {
  if (previous.length !== next.length) return false;
  const previousSorted = previous
    .map((cluster) => cluster.center)
    .sort((left, right) => {
      if (left[0] !== right[0]) return left[0] - right[0];
      return left[1] - right[1];
    });
  const nextSorted = next
    .map((cluster) => cluster.center)
    .sort((left, right) => {
      if (left[0] !== right[0]) return left[0] - right[0];
      return left[1] - right[1];
    });
  return previousSorted.every((center, index) => euclideanDistance(center, nextSorted[index]) < threshold);
}

function initClusters(items: KMeansItem[] = [], k = 1): Cluster[] {
  const seen = new Set<string>();
  const clusters: Cluster[] = [];

  items.forEach((item) => {
    const key = serializePosition(item.position);
    if (seen.has(key)) return;
    seen.add(key);
    clusters.push({
      id: clusters.length,
      center: [...item.position],
      members: [],
    });
  });

  return clusters.slice(0, Math.max(1, k));
}

function runWeightedKMeans(
  items: KMeansItem[] = [],
  k = 1,
  weightsById: Record<number, number> = {},
  maxIters = POLIS_DEFAULTS.kmeansIterations,
): Cluster[] {
  const initialClusters = initClusters(items, k);
  if (!initialClusters.length) return [];

  let clusters = initialClusters;
  let iterationsRemaining = maxIters;

  while (iterationsRemaining > 0) {
    const nextClusters: WorkingCluster[] = clusters.map((cluster) => ({
      ...cluster,
      members: [],
      positions: [],
    }));

    items.forEach((item) => {
      let bestIndex = 0;
      let bestDistance = Number.POSITIVE_INFINITY;
      nextClusters.forEach((cluster, clusterIndex) => {
        const distance = euclideanDistance(item.position, cluster.center);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = clusterIndex;
        }
      });
      nextClusters[bestIndex].members.push(item.id);
      nextClusters[bestIndex].positions.push(item);
    });

    const compactClusters = nextClusters
      .filter((cluster) => cluster.members.length > 0)
      .map((cluster, clusterIndex) => ({
        id: clusterIndex,
        center: weightedMeanPosition(cluster.positions, weightsById),
        members: [...cluster.members],
      }));

    if (sameCenters(clusters, compactClusters)) {
      clusters = compactClusters;
      break;
    }

    clusters = compactClusters;
    iterationsRemaining -= 1;
  }

  return clusters;
}

function buildBaseClusters(
  participantCoords: PolisPoint[] = [],
  participantIndices: number[] = [],
  options: PolisReportMathOptions = {},
): Cluster[] {
  const items = participantIndices
    .map((participantIndex) => participantCoords.find((point) => point.index === participantIndex))
    .filter((point): point is PolisPoint => Boolean(point))
    .map((point) => ({
      id: point.index,
      position: [point.x, point.y],
    }));

  if (!items.length) return [];

  const uniqueMap = new Map();
  items.forEach((item) => {
    const key = serializePosition(item.position);
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, {
        id: uniqueMap.size,
        center: [...item.position],
        members: [item.id],
      });
      return;
    }
    uniqueMap.get(key).members.push(item.id);
  });

  const uniqueClusters = Array.from(uniqueMap.values());
  const baseK = Math.min(options.baseK ?? POLIS_DEFAULTS.baseK, items.length);
  if (uniqueClusters.length <= baseK) {
    return uniqueClusters;
  }

  const computed = runWeightedKMeans(items, baseK, {}, options.kmeansIterations ?? POLIS_DEFAULTS.kmeansIterations);
  return computed.map((cluster, clusterIndex) => ({
    id: clusterIndex,
    center: [...cluster.center],
    members: [...cluster.members],
  }));
}

function silhouetteScore(data: NumericMatrix = [], clusters: number[] = [], k = 0): number {
  if (!data.length || !clusters.length || k <= 1) return 0;

  const clusterMembers: number[][] = Array.from({ length: k }, () => []);
  clusters.forEach((clusterId, index) => {
    if (clusterId === null || clusterId === undefined || clusterId < 0) return;
    if (!clusterMembers[clusterId]) clusterMembers[clusterId] = [];
    clusterMembers[clusterId].push(index);
  });

  const n = data.length;
  const distanceMatrix = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let rowIndex = 0; rowIndex < n; rowIndex += 1) {
    for (let columnIndex = rowIndex; columnIndex < n; columnIndex += 1) {
      const distance = euclideanDistance(data[rowIndex], data[columnIndex]);
      distanceMatrix[rowIndex][columnIndex] = distance;
      distanceMatrix[columnIndex][rowIndex] = distance;
    }
  }

  let total = 0;
  for (let index = 0; index < n; index += 1) {
    const clusterId = clusters[index];
    const ownMembers = clusterMembers[clusterId] || [];
    if (ownMembers.length <= 1) continue;

    let a = 0;
    ownMembers.forEach((memberIndex) => {
      if (memberIndex === index) return;
      a += distanceMatrix[index][memberIndex];
    });
    a /= ownMembers.length - 1;

    let b = Number.POSITIVE_INFINITY;
    clusterMembers.forEach((members, candidateClusterId) => {
      if (candidateClusterId === clusterId || !members?.length) return;
      let sum = 0;
      members.forEach((memberIndex) => {
        sum += distanceMatrix[index][memberIndex];
      });
      b = Math.min(b, sum / members.length);
    });

    if (!Number.isFinite(b) || Math.max(a, b) < 1e-12) continue;
    total += (b - a) / Math.max(a, b);
  }

  return total / n;
}

function selectInConversationParticipantIndices(
  ratingMatrix: PolisReportRatingMatrix = [],
  options: PolisReportMathOptions = {},
): number[] {
  const [nComments, nParticipants] = matrixShape(ratingMatrix);
  if (!nComments || !nParticipants) return [];

  const counts = countVotesPerParticipant(ratingMatrix);
  const threshold = Math.min(
    options.inConversationThresholdCap ?? POLIS_DEFAULTS.inConversationThresholdCap,
    nComments,
  );
  const indices = counts
    .map((count, index) => ({ count, index }))
    .filter(({ count }) => count >= threshold)
    .map(({ index }) => index);

  const floor = Math.min(options.inConversationFloor ?? POLIS_DEFAULTS.inConversationFloor, nParticipants);
  if (indices.length >= floor) {
    return Array.from(new Set(indices)).sort((left, right) => left - right);
  }

  const selected = new Set(indices);
  counts
    .map((count, index) => ({ count, index }))
    .filter(({ index }) => !selected.has(index))
    .sort((left, right) => {
      if (right.count !== left.count) return right.count - left.count;
      return left.index - right.index;
    })
    .slice(0, Math.max(0, floor - selected.size))
    .forEach(({ index }) => selected.add(index));

  return Array.from(selected).sort((left, right) => left - right);
}

function clusterBaseClusters(
  baseClusters: Cluster[] = [],
  options: PolisReportMathOptions = {},
): { clusterCount: number; groupClusters: Cluster[] } {
  if (!baseClusters.length) {
    return { clusterCount: 0, groupClusters: [] };
  }

  if (baseClusters.length === 1) {
    return {
      clusterCount: 1,
      groupClusters: [
        {
          id: 0,
          center: [...baseClusters[0].center],
          members: [baseClusters[0].id],
        },
      ],
    };
  }

  const items = baseClusters.map((cluster) => ({
    id: cluster.id,
    position: [...cluster.center],
  }));
  const weightsById = Object.fromEntries(baseClusters.map((cluster) => [cluster.id, cluster.members.length || 1]));
  const maxK = Math.min(
    options.maxK ?? POLIS_DEFAULTS.maxK,
    2 + Math.floor(baseClusters.length / 12),
    baseClusters.length,
  );

  let bestScore = Number.NEGATIVE_INFINITY;
  let bestClusters: Cluster[] | null = null;

  for (let k = 2; k <= Math.max(2, maxK); k += 1) {
    if (k > baseClusters.length) break;
    const clusters = runWeightedKMeans(
      items,
      k,
      weightsById,
      options.kmeansIterations ?? POLIS_DEFAULTS.kmeansIterations,
    );
    if (!clusters.length) continue;

    const assignmentByBaseClusterId: Record<number, number> = {};
    clusters.forEach((cluster) => {
      cluster.members.forEach((baseClusterId) => {
        assignmentByBaseClusterId[baseClusterId] = cluster.id;
      });
    });

    const silhouette = silhouetteScore(
      items.map((item) => item.position),
      items.map((item) => assignmentByBaseClusterId[item.id] ?? 0),
      clusters.length,
    );

    if (silhouette > bestScore) {
      bestScore = silhouette;
      bestClusters = clusters;
    }
  }

  if (!bestClusters) {
    return {
      clusterCount: 1,
      groupClusters: [
        {
          id: 0,
          center: weightedMeanPosition(items, weightsById),
          members: baseClusters.map((cluster) => cluster.id),
        },
      ],
    };
  }

  return {
    clusterCount: bestClusters.length,
    groupClusters: bestClusters.map((cluster) => ({
      id: cluster.id,
      center: [...cluster.center],
      members: [...cluster.members],
    })),
  };
}

function assignParticipantsToGroups(
  nParticipants: number,
  participantCoords: PolisPoint[] = [],
  baseClusters: Cluster[] = [],
  groupClusters: Cluster[] = [],
): number[] {
  if (!nParticipants) return [];
  if (!groupClusters.length) return new Array(nParticipants).fill(0);

  const assignment: Array<number | null> = new Array(nParticipants).fill(null);
  const groupByBaseClusterId: Record<number, number> = {};
  groupClusters.forEach((group) => {
    group.members.forEach((baseClusterId) => {
      groupByBaseClusterId[baseClusterId] = group.id;
    });
  });

  baseClusters.forEach((baseCluster) => {
    const groupId = groupByBaseClusterId[baseCluster.id];
    baseCluster.members.forEach((participantIndex) => {
      assignment[participantIndex] = groupId;
    });
  });

  const centers = groupClusters.map((group) => ({
    id: group.id,
    center: group.center,
  }));

  participantCoords.forEach((point) => {
    if (assignment[point.index] !== null && assignment[point.index] !== undefined) return;

    let bestGroup = centers[0]?.id ?? 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    centers.forEach((group) => {
      const distance = euclideanDistance([point.x, point.y], group.center);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestGroup = group.id;
      }
    });
    assignment[point.index] = bestGroup;
  });

  return assignment.map((value) => (value === null || value === undefined ? 0 : value));
}

function propTest(successes = 0, trials = 0): number {
  const adjSuccesses = successes + 1;
  const adjTrials = trials + 1;
  return 2 * Math.sqrt(adjTrials) * (adjSuccesses / adjTrials - 0.5);
}

function twoPropTest(successIn = 0, successOut = 0, popIn = 0, popOut = 0): number {
  const adjSuccessIn = successIn + 1;
  const adjSuccessOut = successOut + 1;
  const adjPopIn = popIn + 1;
  const adjPopOut = popOut + 1;
  const pi1 = adjSuccessIn / adjPopIn;
  const pi2 = adjSuccessOut / adjPopOut;
  const piHat = (adjSuccessIn + adjSuccessOut) / (adjPopIn + adjPopOut);
  if (piHat === 1) return 0;
  return (pi1 - pi2) / Math.sqrt(piHat * (1 - piHat) * (1 / adjPopIn + 1 / adjPopOut));
}

function zSig90(value: number): boolean {
  return value > SIG_90_Z;
}

function computeCommentStats(votes: RatingRow = []): CommentStats {
  const filtered = votes.filter((vote) => !isMissingVote(vote));
  const agree = filtered.filter(isAgreeVote).length;
  const disagree = filtered.filter(isDisagreeVote).length;
  const seen = filtered.length;
  const pass = filtered.filter((vote) => vote === 0).length;
  const pa = (agree + 1) / (seen + 2);
  const pd = (disagree + 1) / (seen + 2);
  return {
    agree,
    disagree,
    pass,
    seen,
    pa,
    pd,
    pat: propTest(agree, seen),
    pdt: propTest(disagree, seen),
  };
}

function addComparativeStats(inStats: CommentStats, restStats: CommentStats[] = []): ComparativeCommentStats {
  const restAgree = restStats.reduce((sum, stats) => sum + (stats.agree || 0), 0);
  const restDisagree = restStats.reduce((sum, stats) => sum + (stats.disagree || 0), 0);
  const restSeen = restStats.reduce((sum, stats) => sum + (stats.seen || 0), 0);
  const restPass = restStats.reduce((sum, stats) => sum + (stats.pass || 0), 0);
  const restAgreeProb = (restAgree + 1) / (restSeen + 2);
  const restDisagreeProb = (restDisagree + 1) / (restSeen + 2);

  return {
    ...inStats,
    restAgree,
    restDisagree,
    restSeen,
    restPass,
    ra: restAgreeProb > 0 ? inStats.pa / restAgreeProb : 0,
    rd: restDisagreeProb > 0 ? inStats.pd / restDisagreeProb : 0,
    rat: twoPropTest(inStats.agree, restAgree, inStats.seen, restSeen),
    rdt: twoPropTest(inStats.disagree, restDisagree, inStats.seen, restSeen),
  };
}

function passesByTest(commentStats: Partial<ComparativeCommentStats> = {}): boolean {
  return (
    (zSig90(commentStats.rat || 0) && zSig90(commentStats.pat || 0)) ||
    (zSig90(commentStats.rdt || 0) && zSig90(commentStats.pdt || 0))
  );
}

function beatsBestByTest(
  commentStats: Partial<ComparativeCommentStats> = {},
  currentBestZ: number | null = null,
): boolean {
  return currentBestZ == null || Math.max(commentStats.rat || 0, commentStats.rdt || 0) > currentBestZ;
}

function beatsBestAgree(
  commentStats: Partial<ComparativeCommentStats> = {},
  currentBest: Partial<ComparativeCommentStats> | null = null,
): boolean {
  if ((commentStats.agree || 0) === 0 && (commentStats.disagree || 0) === 0) return false;
  if (currentBest && (currentBest.ra || 0) > 1) {
    return (
      (commentStats.ra || 0) * (commentStats.rat || 0) * (commentStats.pa || 0) * (commentStats.pat || 0) >
      (currentBest.ra || 0) * (currentBest.rat || 0) * (currentBest.pa || 0) * (currentBest.pat || 0)
    );
  }
  if (currentBest) {
    return (commentStats.pa || 0) * (commentStats.pat || 0) > (currentBest.pa || 0) * (currentBest.pat || 0);
  }
  return zSig90(commentStats.pat || 0) || ((commentStats.ra || 0) > 1 && (commentStats.pa || 0) > 0.5);
}

function finalizeRepresentativeComment(
  questionIndex: number,
  prompt: string,
  stats: Partial<ComparativeCommentStats> = {},
): RepresentativeComment {
  const repfulFor: ConsensusKind = (stats.rat || 0) > (stats.rdt || 0) ? 'agree' : 'disagree';
  const nSuccess = repfulFor === 'agree' ? stats.agree || 0 : stats.disagree || 0;
  const pSuccess = repfulFor === 'agree' ? stats.pa || 0 : stats.pd || 0;
  const pTest = repfulFor === 'agree' ? stats.pat || 0 : stats.pdt || 0;
  const repness = repfulFor === 'agree' ? stats.ra || 0 : stats.rd || 0;
  const repnessTest = repfulFor === 'agree' ? stats.rat || 0 : stats.rdt || 0;
  const clusterAgreeRate = stats.seen ? (stats.agree || 0) / stats.seen : 0;
  const clusterDisagreeRate = stats.seen ? (stats.disagree || 0) / stats.seen : 0;
  const overallSeen = (stats.seen || 0) + (stats.restSeen || 0);
  const overallAgreeRate = overallSeen ? ((stats.agree || 0) + (stats.restAgree || 0)) / overallSeen : 0;
  const overallDisagreeRate = overallSeen ? ((stats.disagree || 0) + (stats.restDisagree || 0)) / overallSeen : 0;
  const difference =
    repfulFor === 'agree'
      ? Math.abs(clusterAgreeRate - overallAgreeRate)
      : Math.abs(clusterDisagreeRate - overallDisagreeRate);

  return {
    questionIndex,
    label: `#${questionIndex + 1}`,
    prompt: prompt || `Question #${questionIndex + 1}`,
    repfulFor,
    nSuccess,
    nTrials: stats.seen || 0,
    pSuccess,
    pTest,
    repness,
    repnessTest,
    difference,
    clusterAgreeRate,
    clusterDisagreeRate,
    overallAgreeRate,
    overallDisagreeRate,
  };
}

function repnessMetric(item: Partial<RepresentativeComment> = {}): number {
  return (item.repness || 0) * (item.repnessTest || 0) * (item.pSuccess || 0) * (item.pTest || 0);
}

function repnessSort(items: RepresentativeComment[] = []): RepresentativeComment[] {
  return [...items].sort((left, right) => repnessMetric(right) - repnessMetric(left));
}

function agreesBeforeDisagrees(items: RepresentativeComment[] = []): RepresentativeComment[] {
  return [
    ...items.filter((item) => item.repfulFor === 'agree'),
    ...items.filter((item) => item.repfulFor === 'disagree'),
  ];
}

function questionPromptForIndex(
  questionIndex: number,
  questionPromptsMap: Record<string, string> = {},
  allQuestions: Array<string | number> = [],
): string {
  const questionId = allQuestions[questionIndex];
  const questionKey = questionId != null ? String(questionId) : '';
  if (questionKey && questionPromptsMap && questionPromptsMap[questionKey]) {
    return questionPromptsMap[questionKey];
  }
  return `Question #${questionIndex + 1}`;
}

function buildMemberIndicesByGroup(assignments: number[] = []): {
  groupIds: number[];
  byGroup: Record<number, number[]>;
} {
  const groupIds = Array.from(new Set(assignments.filter((clusterId) => Number.isInteger(clusterId)))).sort(
    (left, right) => left - right,
  );

  const byGroup: Record<number, number[]> = Object.fromEntries(groupIds.map((groupId) => [groupId, []]));
  assignments.forEach((groupId, participantIndex) => {
    if (!Number.isInteger(groupId) || !byGroup[groupId]) return;
    byGroup[groupId].push(participantIndex);
  });
  return { groupIds, byGroup };
}

function collectVotesForQuestion(
  ratingMatrix: PolisReportRatingMatrix = [],
  questionIndex = 0,
  memberIndices: number[] = [],
): RatingRow {
  const row = Array.isArray(ratingMatrix[questionIndex]) ? ratingMatrix[questionIndex] : [];
  return memberIndices.map((memberIndex) => row[memberIndex] ?? null);
}

function formatConsensusComment(
  kind: ConsensusKind,
  questionIndex: number,
  prompt: string,
  stats: CommentStats,
): ConsensusComment {
  const successKey = kind === 'agree' ? 'agree' : 'disagree';
  const probabilityKey = kind === 'agree' ? 'pa' : 'pd';
  const testKey = kind === 'agree' ? 'pat' : 'pdt';
  return {
    questionIndex,
    label: `#${questionIndex + 1}`,
    prompt,
    kind,
    nSuccess: stats[successKey] || 0,
    nTrials: stats.seen || 0,
    pSuccess: stats[probabilityKey] || 0,
    pTest: stats[testKey] || 0,
  };
}

function computeConsensusSummary(
  ratingMatrix: PolisReportRatingMatrix = [],
  questionPromptsMap: Record<string, string> = {},
  allQuestions: Array<string | number> = [],
): { agree: ConsensusComment[]; disagree: ConsensusComment[] } {
  const [nComments] = matrixShape(ratingMatrix);
  const stats = Array.from({ length: nComments }, (_, questionIndex) => {
    const row = Array.isArray(ratingMatrix[questionIndex]) ? ratingMatrix[questionIndex] : [];
    const commentStats = computeCommentStats(row);
    return {
      ...commentStats,
      questionIndex,
      prompt: questionPromptForIndex(questionIndex, questionPromptsMap, allQuestions),
      agreeMetric: commentStats.pa * commentStats.pat,
      disagreeMetric: commentStats.pd * commentStats.pdt,
    };
  });

  const top = (kind: ConsensusKind) => {
    const metricKey = kind === 'agree' ? 'agreeMetric' : 'disagreeMetric';
    const probabilityKey = kind === 'agree' ? 'pa' : 'pd';
    const testKey = kind === 'agree' ? 'pat' : 'pdt';
    return stats
      .filter((entry) => entry[probabilityKey] > 0.5 && zSig90(entry[testKey]))
      .sort((left, right) => right[metricKey] - left[metricKey])
      .slice(0, 5)
      .map((entry) => formatConsensusComment(kind, entry.questionIndex, entry.prompt, entry));
  };

  return {
    agree: top('agree'),
    disagree: top('disagree'),
  };
}

function computeGroupVotes(
  ratingMatrix: PolisReportRatingMatrix = [],
  assignments: number[] = [],
  allQuestions: Array<string | number> = [],
): GroupVotes {
  const [nComments, nParticipants] = matrixShape(ratingMatrix);
  if (!nComments || !nParticipants || !assignments.length) return {};

  const { groupIds } = buildMemberIndicesByGroup(assignments);
  const questionKeys = Array.from({ length: nComments }, (_, questionIndex) => {
    const questionId = allQuestions[questionIndex];
    return questionId != null ? String(questionId) : String(questionIndex);
  });

  const result: GroupVotes = {};
  groupIds.forEach((groupId) => {
    result[groupId] = { nMembers: 0, votes: {} };
    questionKeys.forEach((questionKey) => {
      result[groupId].votes[questionKey] = { A: 0, D: 0, S: 0 };
    });
  });

  for (let participantIndex = 0; participantIndex < nParticipants; participantIndex += 1) {
    const groupId = assignments[participantIndex];
    if (!result[groupId]) continue;
    result[groupId].nMembers += 1;
    for (let questionIndex = 0; questionIndex < nComments; questionIndex += 1) {
      const questionKey = questionKeys[questionIndex];
      const value = ratingMatrix[questionIndex]?.[participantIndex];
      if (!isCountedVote(value)) continue;
      result[groupId].votes[questionKey].S += 1;
      if (isAgreeVote(value)) result[groupId].votes[questionKey].A += 1;
      if (isDisagreeVote(value)) result[groupId].votes[questionKey].D += 1;
    }
  }

  return result;
}

export function computeGroupAwareConsensus(groupVotes: GroupVotes = {}): Record<string, number> {
  const byQuestion: Record<string, number> = {};
  Object.values(groupVotes).forEach((groupStats) => {
    Object.entries(groupStats.votes || {}).forEach(([questionKey, voteStats]) => {
      const probability = ((voteStats.A || 0) + 1) / ((voteStats.S || 0) + 2);
      if (!Object.prototype.hasOwnProperty.call(byQuestion, questionKey)) {
        byQuestion[questionKey] = 1;
      }
      byQuestion[questionKey] *= probability;
    });
  });
  return byQuestion;
}

export function computePolisPcaBundle(
  ratingMatrix: PolisReportRatingMatrix = [],
  options: PolisReportMathOptions = {},
): PolisPcaBundle {
  const [nComments, nParticipants] = matrixShape(ratingMatrix);
  const participantMatrix = buildParticipantMajorMatrix(ratingMatrix);
  const center = computeColumnMeans(participantMatrix);
  const centeredDenseMatrix = buildCenteredDenseMatrix(participantMatrix, center);
  const pca = {
    center,
    ...computePca(centeredDenseMatrix, options),
  };

  const participantCoords = Array.from({ length: nParticipants }, (_, participantIndex) => {
    const [x, y] = sparsityAwareProjectVoteVector(participantMatrix[participantIndex] || [], pca);
    return { index: participantIndex, x, y };
  });
  const statementCoords = buildCommentCoordinates(pca, nComments);
  const commentExtremity = computeCommentExtremity(statementCoords);

  return {
    pca,
    participantMatrix,
    participantCoords,
    statementCoords,
    commentExtremity,
  };
}

export function computePolisStats(ratingMatrix: PolisReportRatingMatrix = []): {
  nComments: number;
  nParticipants: number;
  totalVotes: number;
  voters: number;
  votesPerVoterAvg: number;
} {
  const [nComments, nParticipants] = matrixShape(ratingMatrix);
  const participantVotes = countVotesPerParticipant(ratingMatrix, isCountedVote);
  const totalVotes = participantVotes.reduce((sum, count) => sum + count, 0);
  const voters = participantVotes.filter((count) => count > 0).length;
  return {
    nComments,
    nParticipants,
    totalVotes,
    voters,
    votesPerVoterAvg: voters ? totalVotes / voters : 0,
  };
}

export function computePolisCommentStats(
  ratingMatrix: PolisReportRatingMatrix = [],
  options: PolisReportMathOptions = {},
): Array<{
  commentIndex: number;
  agrees: number;
  disagrees: number;
  unsure: number;
  total: number;
  responded: number;
  extremity: number;
  divisiveness: number;
}> {
  const { pcaBundle = null, ...pcaOptions } = options && typeof options === 'object' ? options : {};
  const { commentExtremity } =
    pcaBundle && typeof pcaBundle === 'object' ? pcaBundle : computePolisPcaBundle(ratingMatrix, pcaOptions);
  const [nComments] = matrixShape(ratingMatrix);

  return Array.from({ length: nComments }, (_, commentIndex) => {
    const row = Array.isArray(ratingMatrix[commentIndex]) ? ratingMatrix[commentIndex] : [];
    const agrees = row.filter(isAgreeVote).length;
    const disagrees = row.filter(isDisagreeVote).length;
    const unsure = row.filter((vote) => vote === 0).length;
    const responded = agrees + disagrees + unsure;

    return {
      commentIndex,
      agrees,
      disagrees,
      unsure,
      total: responded,
      responded,
      extremity: commentExtremity[commentIndex] || 0,
      // Preserve the existing caller contract, but the value is now official-style
      // comment extremity instead of the old 50/50 split heuristic.
      divisiveness: commentExtremity[commentIndex] || 0,
    };
  });
}

export function findRepresentativeQuestions(
  ratingMatrix: PolisReportRatingMatrix = [],
  assignments: number[] = [],
  questionPromptsMap: Record<string, string> = {},
  allQuestions: Array<string | number> = [],
): Record<number, RepresentativeComment[]> {
  const [nComments] = matrixShape(ratingMatrix);
  const { groupIds, byGroup } = buildMemberIndicesByGroup(assignments);
  if (!nComments || !groupIds.length) return {};

  const result: Record<
    number,
    {
      best: RepresentativeComment | null;
      bestAgree: (ComparativeCommentStats & { questionIndex: number; prompt: string }) | null;
      sufficient: RepresentativeComment[];
    }
  > = Object.fromEntries(groupIds.map((groupId) => [groupId, { best: null, bestAgree: null, sufficient: [] }]));

  for (let questionIndex = 0; questionIndex < nComments; questionIndex += 1) {
    const prompt = questionPromptForIndex(questionIndex, questionPromptsMap, allQuestions);
    const perGroupStats = groupIds.map((groupId) =>
      computeCommentStats(collectVotesForQuestion(ratingMatrix, questionIndex, byGroup[groupId])),
    );
    const comparativeStats = zipRest(perGroupStats, addComparativeStats);

    comparativeStats.forEach((stats, statsIndex) => {
      const groupId = groupIds[statsIndex];
      const state = result[groupId];
      const finalized = finalizeRepresentativeComment(questionIndex, prompt, stats);

      if (passesByTest(stats)) {
        state.sufficient.push(finalized);
      }

      if (!state.sufficient.length && beatsBestByTest(stats, state.best?.repnessTest ?? null)) {
        state.best = finalized;
      }

      if (beatsBestAgree(stats, state.bestAgree)) {
        state.bestAgree = { ...stats, questionIndex, prompt };
      }
    });
  }

  const finalizedByGroup: Record<number, RepresentativeComment[]> = {};
  groupIds.forEach((groupId) => {
    const state = result[groupId];
    const bestAgree = state.bestAgree
      ? {
          ...finalizeRepresentativeComment(state.bestAgree.questionIndex, state.bestAgree.prompt, state.bestAgree),
          bestAgree: true,
          nAgree: state.bestAgree.agree || 0,
        }
      : null;

    const bestHead = bestAgree ? [bestAgree] : state.best ? [state.best] : [];

    if (!state.sufficient.length) {
      finalizedByGroup[groupId] = bestHead;
      return;
    }

    const sufficient = state.sufficient.filter((item) => item.questionIndex !== bestAgree?.questionIndex);
    finalizedByGroup[groupId] = agreesBeforeDisagrees([
      ...(bestAgree ? [bestAgree] : []),
      ...repnessSort(sufficient),
    ]).slice(0, 5);
  });

  return finalizedByGroup;
}

export function computePolisConversationMath(
  ratingMatrix: PolisReportRatingMatrix = [],
  questionPromptsMap: Record<string, string> = {},
  allQuestions: Array<string | number> = [],
  options: PolisReportMathOptions = {},
): {
  stats: ReturnType<typeof computePolisStats>;
  participantCoords: PolisPoint[];
  statementCoords: PolisPoint[];
  commentStats: ReturnType<typeof computePolisCommentStats>;
  clusterAssignments: number[];
  clusterCount: number;
  repQuestions: Record<number, RepresentativeComment[]>;
  baseClusters: Cluster[];
  groupClusters: Cluster[];
  inConversationParticipantIndices: number[];
} {
  const mergedOptions = { ...POLIS_DEFAULTS, ...options };
  const stats = computePolisStats(ratingMatrix);
  const pcaBundle = computePolisPcaBundle(ratingMatrix, mergedOptions);
  const inConversationParticipantIndices = selectInConversationParticipantIndices(ratingMatrix, mergedOptions);
  const baseClusters = buildBaseClusters(pcaBundle.participantCoords, inConversationParticipantIndices, mergedOptions);
  const clusteredBase = clusterBaseClusters(baseClusters, mergedOptions);
  const clusterAssignments = assignParticipantsToGroups(
    stats.nParticipants,
    pcaBundle.participantCoords,
    baseClusters,
    clusteredBase.groupClusters,
  );
  const repQuestions = findRepresentativeQuestions(ratingMatrix, clusterAssignments, questionPromptsMap, allQuestions);

  return {
    stats,
    participantCoords: pcaBundle.participantCoords,
    statementCoords: pcaBundle.statementCoords,
    commentStats: computePolisCommentStats(ratingMatrix, {
      ...mergedOptions,
      pcaBundle,
    }),
    clusterAssignments,
    clusterCount: clusteredBase.clusterCount || (clusterAssignments.length ? 1 : 0),
    repQuestions,
    baseClusters,
    groupClusters: clusteredBase.groupClusters,
    inConversationParticipantIndices,
  };
}

const polisReportMath = {
  computeGroupAwareConsensus,
  computePolisCommentStats,
  computePolisConversationMath,
  computePolisPcaBundle,
  computePolisStats,
  findRepresentativeQuestions,
};

export default polisReportMath;
