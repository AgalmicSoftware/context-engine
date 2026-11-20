import { findAtlasTopicForQuestions, listAtlasTopics } from './riskMatrixAtlasTopic';
import type { DebateAtlasBuild } from '../debateAtlas/debateAtlasTypes';

const atlas: DebateAtlasBuild = {
  id: 'atlas_k1_00000001',
  builtAt: '2026-11-08T14:00:00.000Z',
  branches: [
    {
      id: 'b1',
      label: 'Getting around',
      topics: [
        { id: 't1', label: 'Night buses', questions: [{ id: 'q1', prompt: 'Late buses?' }] },
        {
          id: 't2',
          label: 'Bus lanes',
          questions: [
            { id: 'q2', prompt: 'Lanes?' },
            { id: 'q3', prompt: 'Cost?' },
          ],
        },
      ],
    },
    {
      id: 'b2',
      label: 'Safety',
      topics: [{ id: 't3', label: 'Street lighting', questions: [{ id: 'q4', prompt: 'Lit?' }] }],
    },
  ],
};
const topics = listAtlasTopics(atlas);

it('lists every topic in atlas order, named as the atlas view names its nodes', () => {
  expect(topics).toEqual([
    { nodeId: 'atlas_k1_00000001:t1', label: 'Night buses', questionIds: ['q1'] },
    { nodeId: 'atlas_k1_00000001:t2', label: 'Bus lanes', questionIds: ['q2', 'q3'] },
    { nodeId: 'atlas_k1_00000001:t3', label: 'Street lighting', questionIds: ['q4'] },
  ]);
});

it('picks the topic holding most of a note’s questions', () => {
  expect(findAtlasTopicForQuestions(['q4'], topics)?.label).toBe('Street lighting');
  expect(findAtlasTopicForQuestions(['q1', 'q2', 'q3'], topics)?.label).toBe('Bus lanes');
});

it('breaks a tie with the first topic in atlas order', () => {
  expect(findAtlasTopicForQuestions(['q4', 'q1'], topics)?.label).toBe('Night buses');
});

it('finds nothing when no topic holds the note’s questions, or there is no atlas', () => {
  expect(findAtlasTopicForQuestions(['q9'], topics)).toBeNull();
  expect(findAtlasTopicForQuestions([], topics)).toBeNull();
  expect(findAtlasTopicForQuestions(['q1'], [])).toBeNull();
});
