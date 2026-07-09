import {
  computePolisCommentStats,
  computePolisConversationMath,
  type PolisReportRatingMatrix,
} from './consensusReportMath';

type VoteValue = -1 | 0 | 1 | null;

type UnknownRecord = Record<string, unknown>;

interface DemoCommentRecord extends UnknownRecord {
  commentBody?: unknown;
  commentId?: unknown;
  type?: unknown;
}

interface DemoParticipantRecord extends UnknownRecord {
  votes?: unknown;
}

interface DemoPolisDataset extends UnknownRecord {
  comments?: unknown;
  participantsVotes?: unknown;
}

interface SnapshotStatement {
  index: number;
  text: string;
}

interface SnapshotCluster {
  id: number;
  members: string[];
  member_indices: number[];
  center: number[];
}

export interface CommonGroundSnapshot {
  session_id: string;
  statements: SnapshotStatement[];
  participants: string[];
  votes: VoteValue[][];
  masked_cells: [];
  held_out: Record<string, never>;
  clusters: SnapshotCluster[];
  stats: {
    comment: ReturnType<typeof computePolisCommentStats>;
  };
  meta: {
    k_anonymity: number;
    source: 'ce-demo';
    synthetic: false;
    seed: number;
  };
}

const ADDRESS_REDACTION_PATTERN = /0x[0-9a-fA-F]{40}/;
const EMAIL_REDACTION_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const DEFAULT_SEED = 42;
const DEFAULT_K_ANONYMITY = 5;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function hasRedactedIdentifier(value: unknown): boolean {
  const text = String(value || '');
  return ADDRESS_REDACTION_PATTERN.test(text) || EMAIL_REDACTION_PATTERN.test(text);
}

function isBinaryComment(comment: DemoCommentRecord): boolean {
  const type = String(comment.type || '')
    .trim()
    .toLowerCase();
  return !type || type === 'binary';
}

export function normalizeCommonGroundVote(value: unknown): VoteValue {
  if (value === 1 || value === '1' || value === true) return 1;
  if (value === -1 || value === '-1' || value === false) return -1;
  if (value === 0 || value === '0') return 0;

  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  if (normalized === 'agree' || normalized === 'yes' || normalized === 'true') return 1;
  if (normalized === 'disagree' || normalized === 'no' || normalized === 'false') return -1;
  if (normalized === 'unsure' || normalized === 'neutral' || normalized === 'unknown') return 0;
  return null;
}

function participantPseudonym(index: number): string {
  return `p${String(index).padStart(3, '0')}`;
}

function buildClusters(
  clusterAssignments: number[],
  groupClusters: Array<{ id: number; center: number[] }>,
  participants: string[],
): SnapshotCluster[] {
  const centerById = new Map(groupClusters.map((cluster) => [cluster.id, cluster.center]));
  const memberIndicesById = new Map<number, number[]>();
  clusterAssignments.forEach((clusterId, participantIndex) => {
    if (!Number.isInteger(clusterId)) return;
    const members = memberIndicesById.get(clusterId) || [];
    members.push(participantIndex);
    memberIndicesById.set(clusterId, members);
  });

  return Array.from(memberIndicesById.entries())
    .sort(([leftId], [rightId]) => leftId - rightId)
    .map(([id, memberIndices]) => ({
      id,
      members: memberIndices.map((participantIndex) => participants[participantIndex]),
      member_indices: memberIndices,
      center: centerById.get(id) || [],
    }));
}

function passesKAnonymity(clusters: SnapshotCluster[], kAnonymity: number): boolean {
  return clusters.length > 0 && clusters.every((cluster) => cluster.members.length >= kAnonymity);
}

export function buildCommonGroundSnapshotFromDemoDataset(
  dataset: DemoPolisDataset,
  options: {
    sessionId?: string;
    seed?: number;
    kAnonymity?: number;
  } = {},
): CommonGroundSnapshot | null {
  const sessionId = options.sessionId || 'ce-demo';
  const seed = options.seed ?? DEFAULT_SEED;
  const kAnonymity = options.kAnonymity ?? DEFAULT_K_ANONYMITY;
  const comments = Array.isArray(dataset?.comments) ? dataset.comments.filter(isRecord) : [];
  const participantsSource = Array.isArray(dataset?.participantsVotes)
    ? dataset.participantsVotes.filter(isRecord)
    : [];

  if (!comments.length || !participantsSource.length) {
    throw new Error('CommonGround export requires comments and participantsVotes arrays.');
  }

  const binaryComments = comments
    .map((comment, originalIndex) => ({ comment: comment as DemoCommentRecord, originalIndex }))
    .filter(({ comment }) => isBinaryComment(comment))
    .filter(({ comment }) => !hasRedactedIdentifier(comment.commentBody));

  const participants = participantsSource.map((_, participantIndex) => participantPseudonym(participantIndex));
  const statements = binaryComments.map(({ comment }, index) => ({
    index,
    text: String(comment.commentBody || '(No prompt)'),
  }));

  const votes: VoteValue[][] = binaryComments.map(() => new Array(participants.length).fill(null));
  participantsSource.forEach((participant, participantIndex) => {
    const typedParticipant = participant as DemoParticipantRecord;
    const voteMap = isRecord(typedParticipant.votes) ? typedParticipant.votes : {};
    binaryComments.forEach(({ originalIndex }, filteredIndex) => {
      const rawVote = voteMap[String(originalIndex)];
      if (rawVote === undefined) return;
      votes[filteredIndex][participantIndex] = normalizeCommonGroundVote(rawVote);
    });
  });

  const allQuestions = statements.map((statement) => `s${statement.index}`);
  const questionPromptsMap = Object.fromEntries(
    statements.map((statement) => [`s${statement.index}`, statement.text]),
  );
  const mathResult = computePolisConversationMath(
    votes as PolisReportRatingMatrix,
    questionPromptsMap,
    allQuestions,
    { randomSeed: seed },
  );

  if (!Array.isArray(mathResult.clusterAssignments) || !mathResult.clusterAssignments.length) {
    throw new Error('CommonGround export requires computePolisConversationMath cluster assignments.');
  }

  const clusters = buildClusters(mathResult.clusterAssignments, mathResult.groupClusters || [], participants);
  if (!passesKAnonymity(clusters, kAnonymity)) return null;

  return {
    session_id: sessionId,
    statements,
    participants,
    votes,
    masked_cells: [],
    held_out: {},
    clusters,
    stats: {
      comment: computePolisCommentStats(votes as PolisReportRatingMatrix, { randomSeed: seed }),
    },
    meta: {
      k_anonymity: kAnonymity,
      source: 'ce-demo',
      synthetic: false,
      seed,
    },
  };
}
