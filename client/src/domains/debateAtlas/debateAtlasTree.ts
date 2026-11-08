import { generateBlockieDataUrl } from '../../utilities/ui/blockieAvatars.js';
import type { DebateNode, HistoricalCompassPoint } from '../../components/DebateMap/debateMapTypes';

// A build as the Session Worker stores it (workers/sessionCorsWorker/debateAtlasBuild.js).
export type DebateAtlasPosition = { label: string; summary?: string; participantCount: number; x?: number; y?: number };
export type DebateAtlasPlacedParticipant = { address?: string; label?: string; x: number; y: number; reason?: string };
export type DebateAtlasTopic = {
  id: string;
  label: string;
  summary?: string;
  questions?: Array<{ id: string; prompt: string; type?: string }>;
  compass?: {
    x: { label: string; left: string; right: string };
    y: { label: string; top: string; bottom: string };
  } | null;
  positions?: DebateAtlasPosition[];
  participants?: DebateAtlasPlacedParticipant[];
};
export type DebateAtlasBranch = { id: string; label: string; summary?: string; topics: DebateAtlasTopic[] };
export type DebateAtlasBuildSummary = {
  id: string;
  builtAt: string;
  builtBy?: string;
  model?: string;
  title?: string;
  counts?: {
    responses?: number;
    participants?: number;
    questions?: number;
    aiResponses?: number;
    aiQuestions?: number;
  };
  missingTopics?: string[];
};
export type DebateAtlasBuild = DebateAtlasBuildSummary & { branches: DebateAtlasBranch[] };

// Points take the document's text colour, which every theme keeps readable
// when the compass also writes a selected point's name in it.
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

const compassPoints = (topic: DebateAtlasTopic, sessionSlug: string): HistoricalCompassPoint[] => {
  // The compass keys points by name, so a repeated label gets a number.
  const taken = new Set<string>();
  const positions = (topic.positions || [])
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
  const participants = (topic.participants || []).map((participant) => {
    const address = String(participant.address || '');
    return {
      name: uniqueName(taken, address ? shortenAddress(address) : participant.label || 'Participant'),
      x: participant.x,
      y: participant.y,
      type: 'participant',
      color: POINT_COLOR,
      comment: participant.reason || '',
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

// Branches, then topics. A topic is a leaf, as in the demo atlas, so one click
// opens it: its summary and positions, its questions and its compass.
export const buildDebateAtlasTree = (build: DebateAtlasBuild, { sessionSlug = '' } = {}): DebateNode[] =>
  (build.branches || []).map((branch) => {
    const branchId = `${build.id}:${branch.id}`;
    return {
      id: branchId,
      name: branch.label,
      depth: 0,
      comments: summaryComments(branchId, branch.summary),
      children: (branch.topics || []).map((topic) => {
        const topicId = `${build.id}:${topic.id}`;
        return {
          id: topicId,
          name: topic.label,
          depth: 1,
          comments: summaryComments(topicId, topic.summary, ...(topic.positions || []).map(describePosition)),
          questions: (topic.questions || []).map((question) => ({
            id: question.id,
            question: question.prompt,
            questionType: question.type,
          })),
          ...(topic.compass
            ? {
                compass: {
                  xAxis: { ...topic.compass.x },
                  yAxis: { ...topic.compass.y },
                  points: compassPoints(topic, sessionSlug),
                },
              }
            : {}),
        };
      }),
    };
  });
