import { generateBlockieDataUrl } from '../../utilities/ui/blockieAvatars.js';
import { buildPublicRoute } from '../../utilities/ui/publicUrl.js';
import { parseSessionWorkerDiscoveryOrigin } from '../../utilities/session/sessionWorkerDiscovery';
import type { DebateNode, HistoricalCompassPoint } from '../DebateMap/debateMapTypes';
import type {
  DebateAtlasBuild,
  DebateAtlasBuildSummary,
  DebateAtlasMapping,
  DebateAtlasPosition,
} from '../../domains/debateAtlas/debateAtlasTypes';

// Markers take the document's text colour, which every theme keeps readable on
// the compass's document surface.
const POINT_COLOR = 'var(--ce-document-text)';

export const shortenAddress = (address: string): string => `${address.slice(0, 6)}…${address.slice(-4)}`;

const plural = (count: number, word: string): string => `${count} ${word}${count === 1 ? '' : 's'}`;

const formatBuiltAt = (value: string): string => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
};

// "8 Nov 2026, 14:05 · 512 responses · 47 participants"
export const describeDebateAtlasBuild = (build: DebateAtlasBuildSummary): string => {
  const counts = build.counts || {};
  return [
    formatBuiltAt(build.builtAt),
    Number.isFinite(counts.responses) ? plural(Number(counts.responses), 'response') : '',
    Number.isFinite(counts.participants) ? plural(Number(counts.participants), 'participant') : '',
  ]
    .filter(Boolean)
    .join(' · ');
};

const uniqueName = (taken: Set<string>, name: string): string => {
  let candidate = name;
  for (let copy = 2; taken.has(candidate); copy += 1) candidate = `${name} (${copy})`;
  taken.add(candidate);
  return candidate;
};

// Positions are drawn as labelled dots and participants as their avatars, or a
// ring without one; the legend names only the kinds a compass shows.
const compassLegend = (points: HistoricalCompassPoint[]) => [
  ...(points.some((point) => point.type === 'debater') ? [{ label: 'Position', shape: 'circle' }] : []),
  ...(points.some((point) => point.type === 'participant') ? [{ label: 'Participant', shape: 'ring' }] : []),
];

const compassPoints = (mapping: DebateAtlasMapping, sessionSlug: string): HistoricalCompassPoint[] => {
  // The compass keys points by name, so a repeated label gets a number.
  const taken = new Set<string>();
  const positions = (mapping.positions || [])
    .filter((position) => Number.isFinite(position.x) && Number.isFinite(position.y))
    .map((position) => ({
      name: uniqueName(taken, position.label),
      x: Number(position.x),
      y: Number(position.y),
      type: 'debater',
      color: POINT_COLOR,
      comment: [position.summary, `Held by ${plural(position.participantCount, 'participant')}.`]
        .filter(Boolean)
        .join(' '),
    }));
  const participants = (mapping.participants || []).map((participant) => {
    const address = String(participant.address || '');
    return {
      name: uniqueName(taken, address ? shortenAddress(address) : participant.label || 'Participant'),
      x: participant.x,
      y: participant.y,
      type: 'participant',
      color: POINT_COLOR,
      // The AI wrote this from their answers; it is never their own words.
      comment: participant.reason ? `AI reading: ${participant.reason}` : '',
      ...(address
        ? {
            // The same avatar and profile link the Report shows for this address.
            avatarUrl: generateBlockieDataUrl(address.toLowerCase(), 8, 4),
            profileUrl: `/u/${encodeURIComponent(address)}${sessionSlug ? `?session=${encodeURIComponent(sessionSlug)}` : ''}`,
          }
        : {}),
    };
  });
  return [...positions, ...participants];
};

const summaryComments = (id: string, ...texts: Array<string | undefined>) =>
  texts.filter(Boolean).map((comment, index) => ({ id: `${id}:summary:${index}`, comment: String(comment) }));

const describePosition = (position: DebateAtlasPosition): string =>
  [`${position.label}:`, position.summary, `Held by ${plural(position.participantCount, 'participant')}.`]
    .filter(Boolean)
    .join(' ');

// A branch or topic's summary, positions and compass.
const mappedNode = (id: string, mapping: DebateAtlasMapping, sessionSlug: string) => {
  const points = mapping.compass ? compassPoints(mapping, sessionSlug) : [];
  return {
    comments: summaryComments(id, mapping.summary, ...(mapping.positions || []).map(describePosition)),
    ...(mapping.compass
      ? {
          compass: {
            xAxis: { ...mapping.compass.x },
            yAxis: { ...mapping.compass.y },
            points,
            legend: compassLegend(points),
          },
        }
      : {}),
  };
};

// Branches, then topics. A topic is a leaf, as in the demo atlas, so one click
// opens it: its summary and positions, its questions and its compass. A branch
// maps all its topics' questions on a compass of its own.
export const buildDebateAtlasTree = (build: DebateAtlasBuild, { sessionSlug = '' } = {}): DebateNode[] =>
  (build.branches || []).map((branch) => {
    const branchId = `${build.id}:${branch.id}`;
    return {
      id: branchId,
      name: branch.label,
      depth: 0,
      ...mappedNode(branchId, branch, sessionSlug),
      children: (branch.topics || []).map((topic) => {
        const topicId = `${build.id}:${topic.id}`;
        return {
          id: topicId,
          name: topic.label,
          depth: 1,
          ...mappedNode(topicId, topic, sessionSlug),
          questions: (topic.questions || []).map((question) => ({
            id: question.id,
            question: question.prompt,
            questionType: question.type,
          })),
        };
      }),
    };
  });

// A node's id starts with its build's: "<build id>:<branch or topic id>".
export const debateAtlasBuildIdOf = (nodeId: string): string => String(nodeId || '').split(':')[0];

// What a node's copy button shares. /atlas sends it to the session's page, and
// the Worker in it lets a fresh browser find the session.
export const buildSessionAtlasLink = ({
  nodeId,
  sessionSlug,
  workerUrl = '',
}: {
  nodeId: string;
  sessionSlug: string;
  workerUrl?: string;
}): string => {
  const params = new URLSearchParams({ session: sessionSlug });
  try {
    if (workerUrl) params.set('worker', parseSessionWorkerDiscoveryOrigin(workerUrl));
  } catch {
    // Without the Worker the link still opens a session the site already knows.
  }
  return `${buildPublicRoute(`/atlas/${encodeURIComponent(nodeId)}`)}?${params}`;
};
