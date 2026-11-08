import { buildDebateAtlasTree, describeDebateAtlasBuild, type DebateAtlasBuild } from './debateAtlasTree';

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
        },
        { id: 'b1t2', label: 'Privacy', compass: null, positions: [{ label: 'Forget at home', participantCount: 3 }] },
      ],
    },
  ],
};

it('nests topics under branches as leaves that open in one click, under ids unique to the build', () => {
  const [branch] = buildDebateAtlasTree(build, { sessionSlug: 'salon' });
  expect(branch).toMatchObject({ id: 'atlas_k1_00000001:b1', name: 'Trust', depth: 0 });
  expect(branch.comments).toEqual([{ id: 'atlas_k1_00000001:b1:summary:0', comment: 'About trust.' }]);
  const [identity, privacy] = branch.children || [];
  expect(identity).toMatchObject({ id: 'atlas_k1_00000001:b1t1', name: 'Identity', depth: 1 });
  expect(identity.children).toBeUndefined();
  expect(identity.questions).toEqual([
    { id: 'q1', question: 'Should agents prove they are human?', questionType: 'binary' },
  ]);
  expect(identity.comments?.map((comment) => comment.comment)).toEqual([
    'They split.',
    'Go slow: Care first. Held by 2 participants.',
    'Go slow: Held by 1 participant.',
    'Unplaced: Held by 1 participant.',
  ]);
  expect(new Set(identity.comments?.map((comment) => comment.id)).size).toBe(4);
  expect(privacy.compass).toBeUndefined();
  expect(privacy.comments?.map((comment) => comment.comment)).toEqual(['Forget at home: Held by 3 participants.']);
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
    comment: 'Wants care.',
    profileUrl: `/u/${address}?session=salon`,
    avatarUrl: expect.stringMatching(/^data:image\//),
  });
  expect(points[3].avatarUrl).toBeUndefined();
  expect(points[3].profileUrl).toBeUndefined();
});

it('stamps a build with its time and counts', () => {
  const stamp = describeDebateAtlasBuild(build);
  expect(stamp).toMatch(/2026/);
  expect(stamp).toMatch(/ · 12 responses · 1 participant$/);
  expect(describeDebateAtlasBuild({ id: 'x', builtAt: 'not a date' })).toBe('');
});
