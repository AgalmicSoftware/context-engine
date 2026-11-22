import { withWorkerHintForSession } from '../../utilities/ui/currentWorkerHint';
import { generateBlockieDataUrl } from '../../utilities/ui/blockieAvatars.js';
import { buildPublicRoute } from '../../utilities/ui/publicUrl.js';
import { buildQuestionRoutePath } from '../../utilities/survey/questionRouting.js';
import { parseSessionWorkerDiscoveryOrigin } from '../../utilities/session/sessionWorkerDiscovery';
import type { DebateNode, HistoricalCompassPoint } from '../DebateMap/debateMapTypes';
import type {
  DebateAtlasBuild,
  DebateAtlasMapping,
  DebateAtlasPlacedParticipant,
  DebateAtlasQuestionAnalysis,
} from '../../domains/debateAtlas/debateAtlasTypes';

// Markers take the document's text colour, which every theme keeps readable on
// the compass's document surface.
const POINT_COLOR = 'var(--ce-document-text)';

export const shortenAddress = (address: string): string => `${address.slice(0, 6)}…${address.slice(-4)}`;

const plural = (count: number, word: string): string => `${count} ${word}${count === 1 ? '' : 's'}`;

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

// Within this distance on either axis, a participant shares a spot.
const NEAR = 0.03;
// Centres closer than this, in chart widths, draw avatars over one another.
const GAP = 0.05;
type Spot = { x: number; y: number };
const near = (a: Spot, b: Spot) => Math.abs(a.x - b.x) < NEAR && Math.abs(a.y - b.y) < NEAR;
const inside = (value: number) => Math.min(0.98, Math.max(0.02, value));

// Seats on half rings around a spot, left to right: neighbours sit GAP apart,
// and a full ring starts a wider one.
const halfRingSeats = (count: number) => {
  const seats: Array<{ radius: number; angle: number }> = [];
  for (let ring = 1; seats.length < count; ring += 1) {
    const radius = GAP * ring;
    const here = Math.min(Math.floor((Math.PI * radius) / GAP) + 1, count - seats.length);
    for (let index = 0; index < here; index += 1) {
      seats.push({ radius, angle: here > 1 ? Math.PI - (Math.PI * index) / (here - 1) : Math.PI / 2 });
    }
  }
  return seats;
};

// The AI often puts everyone who gave the same answers on one spot, usually a
// position's, where only the top avatar could be pointed at. Each group sits on
// half rings below its spot instead, clear of a position's label above it,
// turning upwards at the chart's bottom edge and shifting inwards at its sides.
// Whatever still overlaps then moves apart; positions stay put.
const spreadParticipants = (
  participants: DebateAtlasPlacedParticipant[],
  spots: Spot[],
): DebateAtlasPlacedParticipant[] => {
  const spread = participants.map((participant) => ({ ...participant }));
  // A position's spot comes first, so a participant on it joins its group.
  const groups: Array<Spot & { members: number[]; position: boolean }> = spots.map((spot) => ({
    x: spot.x,
    y: spot.y,
    members: [],
    position: true,
  }));
  participants.forEach((participant, index) => {
    const group = groups.find((entry) => near(entry, participant));
    if (group) group.members.push(index);
    else groups.push({ x: participant.x, y: participant.y, members: [index], position: false });
  });
  groups
    .filter((group) => group.members.length > (group.position ? 0 : 1))
    .forEach((group) => {
      const seats = halfRingSeats(group.members.length);
      const outer = seats[seats.length - 1].radius;
      const centre = Math.min(0.98 - outer, Math.max(0.02 + outer, group.x));
      const side = group.y - outer >= 0.02 ? -1 : 1;
      group.members.forEach((index, order) => {
        spread[index].x = inside(centre + seats[order].radius * Math.cos(seats[order].angle));
        spread[index].y = inside(group.y + side * seats[order].radius * Math.sin(seats[order].angle));
      });
    });
  // Each round moves an avatar half of its overlap away from everything it
  // overlaps. When those moves cancel, between two positions say, it goes below.
  for (let round = 0; round < 100; round += 1) {
    let moved = false;
    spread.forEach((point, index) => {
      let pushX = 0;
      let pushY = 0;
      let total = 0;
      [...spots, ...spread.filter((_, other) => other !== index)].forEach((other) => {
        const distance = Math.hypot(point.x - other.x, point.y - other.y);
        if (distance >= GAP - 1e-6) return;
        const angle =
          distance > 1e-9 ? Math.atan2(point.y - other.y, point.x - other.x) : (2 * Math.PI * index) / spread.length;
        pushX += ((GAP - distance) / 2) * Math.cos(angle);
        pushY += ((GAP - distance) / 2) * Math.sin(angle);
        total += (GAP - distance) / 2;
      });
      if (!total) return;
      if (Math.hypot(pushX, pushY) < total / 4) pushY -= GAP / 2;
      point.x = inside(point.x + pushX);
      point.y = inside(point.y + pushY);
      moved = true;
    });
    if (!moved) break;
  }
  return spread;
};

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
  const participants = spreadParticipants(mapping.participants || [], positions).map((participant) => {
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
            profileUrl: withWorkerHintForSession(
              `/u/${encodeURIComponent(address)}${sessionSlug ? `?session=${encodeURIComponent(sessionSlug)}` : ''}`,
              sessionSlug,
            ),
          }
        : {}),
    };
  });
  return [...positions, ...participants];
};

// The summary, then each position with how many of those who answered hold
// it. The popup leads with the summary and lists the positions on request.
const summaryComments = (id: string, mapping: DebateAtlasMapping) => {
  const answered = Number(mapping.answered) || 0;
  return [
    ...(mapping.summary ? [{ id: `${id}:summary`, comment: mapping.summary }] : []),
    ...(mapping.positions || []).map((position, index) => ({
      id: `${id}:position:${index}`,
      comment: position.summary || '',
      label: position.label,
      participantCount: position.participantCount,
      ...(answered ? { participantTotal: answered } : {}),
    })),
  ];
};

// A circle's name for a question: its first words, since a whole prompt does not fit a circle.
const QUESTION_NAME_CHARS = 48;
const questionName = (prompt: string): string => {
  const text = String(prompt || '')
    .trim()
    .replace(/\s+/g, ' ');
  if (text.length <= QUESTION_NAME_CHARS) return text || 'Question';
  const cut = text.slice(0, QUESTION_NAME_CHARS);
  return `${cut.slice(0, cut.lastIndexOf(' ') > QUESTION_NAME_CHARS / 2 ? cut.lastIndexOf(' ') : cut.length)}…`;
};

// A branch or topic's summary, positions and compass.
const mappedNode = (id: string, mapping: DebateAtlasMapping, sessionSlug: string) => {
  const points = mapping.compass ? compassPoints(mapping, sessionSlug) : [];
  return {
    comments: summaryComments(id, mapping),
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

// A question's saved analysis, cleaned for drawing whatever a build holds: nothing without a summary, text only
// where it is text, whole counts, only named categories, and no category above those who answered. How many
// categories and how long the text are the session's settings, so none is capped here.
const cleanAnalysis = (analysis: DebateAtlasQuestionAnalysis | undefined) => {
  const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
  const whole = (value: unknown) => (Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : 0);
  const summary = text(analysis?.summary);
  if (!summary) return null;
  const answered = whole(analysis?.answered);
  const categories = (Array.isArray(analysis?.categories) ? analysis.categories : [])
    .map((category) => ({
      label: text(category?.label),
      summary: text(category?.summary),
      participantCount: answered
        ? Math.min(answered, whole(category?.participantCount))
        : whole(category?.participantCount),
    }))
    .filter((category) => category.label);
  return { summary, answered, categories };
};

// A question circle's window leads with the analysis as a topic's does with its summary: the summary, then each
// category with how many of those who answered fall in it.
const analysisComments = (id: string, analysis: NonNullable<ReturnType<typeof cleanAnalysis>>) => [
  { id: `${id}:analysis`, comment: analysis.summary },
  ...analysis.categories.map((category, index) => ({
    id: `${id}:category:${index}`,
    kind: 'category',
    comment: category.summary,
    label: category.label,
    participantCount: category.participantCount,
    ...(analysis.answered ? { participantTotal: analysis.answered } : {}),
  })),
];

// Branches, then topics, then each topic's questions as the smallest circles. A branch maps all its topics'
// questions on a compass of its own; a topic opens its summary, positions, questions and compass; a question
// opens to itself, with its link, under the AI's analysis of its answers where the build has one. The circles are
// in every build, so older builds gain the third level too; the analysis is only in builds that made it.
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
        const questions = (topic.questions || []).map(({ id, prompt, type, options, voiceCredits, analysis }) => {
          const read = cleanAnalysis(analysis);
          return {
            id,
            question: prompt,
            questionType: type,
            ...(options ? { options } : {}),
            ...(voiceCredits ? { voiceCredits } : {}),
            ...(read ? { analysis: read } : {}),
          };
        });
        return {
          id: topicId,
          name: topic.label,
          depth: 1,
          ...mappedNode(topicId, topic, sessionSlug),
          questions,
          // A lone question would be a circle inside a circle of the same thing.
          ...(questions.length > 1
            ? {
                children: questions.map(({ analysis, ...question }, index) => {
                  const id = `${topicId}-q${index + 1}`;
                  return {
                    id,
                    name: questionName(question.question),
                    depth: 2,
                    isQuestion: true,
                    // Its own window leads with the analysis, so its card does not repeat it.
                    questions: [question],
                    ...(analysis ? { comments: analysisComments(id, analysis) } : {}),
                  };
                }),
              }
            : {}),
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

// A question's own page, where it can be answered, with the Worker a fresh browser needs.
export const buildSessionQuestionLink = ({
  questionId,
  sessionSlug,
  workerUrl = '',
}: {
  questionId: string;
  sessionSlug: string;
  workerUrl?: string;
}): string => {
  const [path, query = ''] = buildQuestionRoutePath(questionId, { sessionSlug }).split('?');
  const params = new URLSearchParams(query);
  try {
    if (workerUrl) params.set('worker', parseSessionWorkerDiscoveryOrigin(workerUrl));
  } catch {
    // Without the Worker the page still opens a session the site already knows.
  }
  return `${buildPublicRoute(path)}?${params}`;
};
