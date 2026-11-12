import {
  buildDebateAtlasTree,
  buildSessionAtlasLink,
  buildSessionQuestionLink,
  debateAtlasBuildIdOf,
} from './debateAtlasTree';
import type { DebateAtlasBuild } from '../../domains/debateAtlas/debateAtlasTypes';

const address = `0x${'ab'.repeat(20)}`;
const compass = {
  x: { label: 'Pace', left: 'Slow', right: 'Fast' },
  y: { label: 'Scope', top: 'Local', bottom: 'Global' },
};
const build: DebateAtlasBuild = {
  id: 'atlas_k1_00000001',
  builtAt: '2026-11-08T14:05:00.000Z',
  counts: { responses: 12, participants: 1 },
  branches: [
    {
      id: 'b1',
      label: 'Trust',
      summary: 'About trust.',
      compass,
      positions: [{ label: 'Prove it', participantCount: 1, x: 0.9, y: 0.1 }],
      participants: [{ address, x: 0.8, y: 0.2, reason: 'Wants proof.' }],
      answered: 3,
      topics: [
        {
          id: 'b1t1',
          label: 'Identity',
          summary: 'They split.',
          questions: [{ id: 'q1', prompt: 'Should agents prove they are human?', type: 'binary' }],
          compass,
          positions: [
            { label: 'Go slow', summary: 'Care first.', participantCount: 2, x: 0.2, y: 0.8 },
            { label: 'Go slow', participantCount: 1, x: 0.3, y: 0.7 },
            { label: 'Unplaced', participantCount: 1 },
          ],
          participants: [
            { address, x: 0.25, y: 0.9, reason: 'Wants care.' },
            { label: 'Participant 4', x: 0.6, y: 0.4 },
          ],
          answered: 5,
        },
        { id: 'b1t2', label: 'Privacy', compass: null, positions: [{ label: 'Forget at home', participantCount: 3 }] },
      ],
    },
  ],
};

it('nests topics under branches as leaves that open in one click, under ids unique to the build', () => {
  const [branch] = buildDebateAtlasTree(build, { sessionSlug: 'salon' });
  expect(branch).toMatchObject({ id: 'atlas_k1_00000001:b1', name: 'Trust', depth: 0 });
  // The summary, then each position with how many of those who answered hold it.
  expect(branch.comments).toEqual([
    { id: 'atlas_k1_00000001:b1:summary', comment: 'About trust.' },
    {
      id: 'atlas_k1_00000001:b1:position:0',
      comment: '',
      label: 'Prove it',
      participantCount: 1,
      participantTotal: 3,
    },
  ]);
  const [identity, privacy] = branch.children || [];
  expect(identity).toMatchObject({ id: 'atlas_k1_00000001:b1t1', name: 'Identity', depth: 1 });
  expect(identity.children).toBeUndefined();
  expect(identity.questions).toEqual([
    { id: 'q1', question: 'Should agents prove they are human?', questionType: 'binary' },
  ]);
  expect(identity.comments?.map(({ comment, label, participantCount }) => [label, comment, participantCount])).toEqual([
    [undefined, 'They split.', undefined],
    ['Go slow', 'Care first.', 2],
    ['Go slow', '', 1],
    ['Unplaced', '', 1],
  ]);
  // Counted against everyone who answered, not only the two placed on the compass.
  expect(identity.comments?.[1].participantTotal).toBe(5);
  expect(new Set(identity.comments?.map((comment) => comment.id)).size).toBe(4);
  expect(privacy.compass).toBeUndefined();
  // A map that does not say how many answered shows no share.
  expect(privacy.comments).toEqual([
    { id: 'atlas_k1_00000001:b1t2:position:0', comment: '', label: 'Forget at home', participantCount: 3 },
  ]);
});

it('places positions and participants on the topic compass, each under its own name', () => {
  const [branch] = buildDebateAtlasTree(build, { sessionSlug: 'salon' });
  const topicCompass = branch.children?.[0].compass;
  expect(topicCompass?.xAxis).toEqual(compass.x);
  expect(topicCompass?.yAxis).toEqual(compass.y);
  const points = topicCompass?.points || [];
  expect(points.map((point) => [point.name, point.type, point.x, point.y])).toEqual([
    ['Go slow', 'debater', 0.2, 0.8],
    ['Go slow (2)', 'debater', 0.3, 0.7],
    ['0xabab…abab', 'participant', 0.25, 0.9],
    ['Participant 4', 'participant', 0.6, 0.4],
  ]);
  expect(points[0].comment).toBe('Care first. Held by 2 participants.');
  expect(points[2]).toMatchObject({
    comment: 'AI reading: Wants care.',
    profileUrl: `/u/${address}?session=salon`,
    avatarUrl: expect.stringMatching(/^data:image\//),
  });
  expect(points[3].avatarUrl).toBeUndefined();
  expect(points[3].profileUrl).toBeUndefined();
});

// The compass for one branch with these positions and participants.
const compassOf = (positions: Array<{ x: number; y: number }>, participants: Array<{ x: number; y: number }>) =>
  buildDebateAtlasTree({
    ...build,
    branches: [
      {
        id: 'b1',
        label: 'Trust',
        compass,
        positions: positions.map((spot, index) => ({ label: `Position ${index + 1}`, participantCount: 1, ...spot })),
        participants: participants.map((spot, index) => ({
          address: `0x${String(index + 1)
            .padStart(2, '0')
            .repeat(20)}`,
          ...spot,
        })),
        topics: [],
      },
    ],
  })[0].compass?.points || [];
// The closest any two points come, so no avatar covers another or a position's dot.
const closest = (points: Array<{ x: number; y: number }>) =>
  Math.min(...points.flatMap((a, i) => points.slice(i + 1).map((b) => Math.hypot(a.x - b.x, a.y - b.y))));
const onChart = (points: Array<{ x: number; y: number }>) =>
  points.every((point) => point.x >= 0.02 && point.x <= 0.98 && point.y >= 0.02 && point.y <= 0.98);

it('seats participants who share a position below it, so each can be pointed at', () => {
  const spot = { x: 0.5, y: 0.9 };
  const points = compassOf([spot], [spot, { x: 0.51, y: 0.89 }, spot, { x: 0.1, y: 0.1 }]);
  const [position, ...participants] = points;
  // The position stays put; the three on its spot sit on a half ring centred on
  // it, left to right and below it, clear of its label above.
  expect([position.x, position.y]).toEqual([0.5, 0.9]);
  const ring = participants.slice(0, 3);
  ring.forEach((point) => {
    expect(Math.hypot(point.x - 0.5, point.y - 0.9)).toBeCloseTo(0.05, 6);
    expect(point.y).toBeLessThanOrEqual(0.9 + 1e-9);
  });
  expect(ring[0].x).toBeLessThan(ring[1].x);
  expect(ring[1].x).toBeLessThan(ring[2].x);
  // Someone alone stays where the AI put them.
  expect([participants[3].x, participants[3].y]).toEqual([0.1, 0.1]);
  expect(closest(points)).toBeGreaterThanOrEqual(0.0499);
});

it('keeps every avatar apart at the chart edges, in large groups and beside other groups', () => {
  const cases = [
    // A crowd on one position, needing several rings.
    { positions: [{ x: 0.5, y: 0.6 }], participants: Array.from({ length: 20 }, () => ({ x: 0.5, y: 0.6 })) },
    // Groups against each side, the corners included.
    {
      positions: [
        { x: 0.01, y: 0.5 },
        { x: 0.99, y: 0.99 },
      ],
      participants: [
        ...Array.from({ length: 5 }, () => ({ x: 0.01, y: 0.5 })),
        ...Array.from({ length: 5 }, () => ({ x: 0.99, y: 0.99 })),
      ],
    },
    // Someone alone just beside a pair, and two neighbouring positions' groups.
    {
      positions: [
        { x: 0.3, y: 0.5 },
        { x: 0.36, y: 0.5 },
      ],
      participants: [
        { x: 0.3, y: 0.5 },
        { x: 0.3, y: 0.5 },
        { x: 0.34, y: 0.44 },
        { x: 0.36, y: 0.5 },
        { x: 0.36, y: 0.5 },
        { x: 0.7, y: 0.3 },
        { x: 0.7, y: 0.3 },
        { x: 0.74, y: 0.3 },
      ],
    },
  ];
  for (const { positions, participants } of cases) {
    const points = compassOf(positions, participants);
    expect(points).toHaveLength(positions.length + participants.length);
    expect(onChart(points.slice(positions.length))).toBe(true);
    expect(closest(points)).toBeGreaterThanOrEqual(0.0499);
    // The positions themselves never move.
    expect(points.slice(0, positions.length).map(({ x, y }) => ({ x, y }))).toEqual(positions);
  }
});

it('turns the half ring upwards at the bottom edge', () => {
  const spot = { x: 0.4, y: 0.02 };
  const points = compassOf(
    [spot],
    Array.from({ length: 6 }, () => spot),
  );
  // None below the position, at the edge; the ring rises above it instead.
  points.slice(1).forEach((point) => expect(point.y).toBeGreaterThanOrEqual(0.02 - 1e-9));
  expect(Math.max(...points.slice(1).map((point) => point.y))).toBeGreaterThan(0.06);
  expect(closest(points)).toBeGreaterThanOrEqual(0.0499);
});

it('gives a category its own compass, and each compass a legend of the kinds of point it shows', () => {
  const [branch] = buildDebateAtlasTree(build, { sessionSlug: 'salon' });
  expect(branch.compass?.xAxis).toEqual(compass.x);
  expect(branch.compass?.points?.map((point) => [point.name, point.type])).toEqual([
    ['Prove it', 'debater'],
    ['0xabab…abab', 'participant'],
  ]);
  const legend = [
    { label: 'Position', shape: 'circle' },
    { label: 'Participant', shape: 'ring' },
  ];
  expect(branch.compass?.legend).toEqual(legend);
  expect(branch.children?.[0].compass?.legend).toEqual(legend);

  // A compass on which no one is placed names only its positions.
  const [positionsOnly] = buildDebateAtlasTree({
    ...build,
    branches: [
      {
        id: 'b2',
        label: 'Care',
        compass,
        positions: [{ label: 'Wait', participantCount: 2, x: 0.1, y: 0.1 }],
        topics: [],
      },
    ],
  });
  expect(positionsOnly.compass?.legend).toEqual([{ label: 'Position', shape: 'circle' }]);
});

it('links a node to its session, with the Worker a fresh browser needs, and knows its build', () => {
  const nodeId = 'atlas_k1_00000001:b1t1';
  expect(debateAtlasBuildIdOf(nodeId)).toBe('atlas_k1_00000001');
  const link = new URL(
    buildSessionAtlasLink({ nodeId, sessionSlug: 'salon', workerUrl: 'https://ce-salon.workers.dev' }),
    'https://site.example',
  );
  expect(link.pathname).toBe('/atlas/atlas_k1_00000001%3Ab1t1');
  expect(Object.fromEntries(link.searchParams)).toEqual({ session: 'salon', worker: 'https://ce-salon.workers.dev' });
  // A question opens its own page, in the same session and Worker.
  const question = new URL(
    buildSessionQuestionLink({ questionId: '0xABC', sessionSlug: 'salon', workerUrl: 'https://ce-salon.workers.dev' }),
    'https://site.example',
  );
  expect(question.pathname).toBe('/question/0xabc');
  expect(Object.fromEntries(question.searchParams)).toEqual({
    session: 'salon',
    worker: 'https://ce-salon.workers.dev',
  });
  // A Worker address that is not a plain origin is left out rather than shared.
  expect(
    new URL(
      buildSessionAtlasLink({ nodeId, sessionSlug: 'salon', workerUrl: 'not a url' }),
      'https://site.example',
    ).searchParams.has('worker'),
  ).toBe(false);
});
