import { describeDebateListRank, measureDebateNode, sortDebateList } from './DebateMap';
import type { DebateNode } from './debateMapTypes';

const node = (id: string, positions: Array<[number, number?]>): DebateNode => ({
  id,
  name: id,
  comments: [
    { id: `${id}:summary`, comment: 'A summary.' },
    ...positions.map(([participantCount, participantTotal], index) => ({
      id: `${id}:position:${index}`,
      label: `Position ${index + 1}`,
      participantCount,
      ...(participantTotal ? { participantTotal } : {}),
    })),
  ],
});

const agreed = node('agreed', [
  [9, 10],
  [1, 10],
]);
const even = node('even', [
  [5, 10],
  [5, 10],
]);
const leaning = node('leaning', [
  [7, 10],
  [3, 10],
]);
const crowded = node('crowded', [
  [20, 40],
  [15, 40],
]);
const single = node('single', [[6, 6]]);
const bare: DebateNode = { id: 'bare', name: 'bare' };
const all = [agreed, single, even, bare, leaning, crowded];
const ids = (nodes: DebateNode[]) => nodes.map((entry) => entry.id);

it('leaves the atlas order alone until a sort is chosen', () => {
  expect(sortDebateList(all, 'atlas')).toBe(all);
  expect(describeDebateListRank(even, 'atlas')).toBe('');
});

it('ranks most split first: the less the largest position holds, the higher', () => {
  expect(measureDebateNode(even).split).toBeCloseTo(0.5);
  // 20 and 15 of the 35 the positions account for (40 answered in all).
  expect(measureDebateNode(crowded).split).toBeCloseTo(15 / 35);
  expect(measureDebateNode(leaning).split).toBeCloseTo(0.3);
  expect(measureDebateNode(agreed).split).toBeCloseTo(0.1);
  // One position, or none, is no split: those go last, in the atlas's order; equals keep it too.
  expect(measureDebateNode(single).split).toBeNull();
  expect(measureDebateNode(bare).split).toBeNull();
  expect(ids(sortDebateList(all, 'split'))).toEqual(['even', 'crowded', 'leaning', 'agreed', 'single', 'bare']);
  expect(describeDebateListRank(leaning, 'split')).toBe('7 of 10 in the largest position');
  expect(describeDebateListRank(single, 'split')).toBe('');
});

it('ranks most answered first, by everyone who answered under the node', () => {
  expect(ids(sortDebateList(all, 'answered'))).toEqual(['crowded', 'agreed', 'even', 'leaning', 'single', 'bare']);
  expect(describeDebateListRank(crowded, 'answered')).toBe('40 answered');
  expect(describeDebateListRank(bare, 'answered')).toBe('');
  // Without the build's own total, the positions' holders stand in.
  expect(measureDebateNode(node('old', [[4], [2]]))).toMatchObject({ answered: 6, largest: 4 });
  expect(describeDebateListRank(node('old', [[4], [2]]), 'split')).toBe('4 of 6 in the largest position');
  // Split is among those the positions account for: few placed out of many is not a deep split.
  const fewPlaced = node('few', [
    [3, 20],
    [2, 20],
  ]);
  expect(measureDebateNode(fewPlaced).split).toBeCloseTo(0.4);
  expect(describeDebateListRank(fewPlaced, 'split')).toBe('3 of 5 in the largest position');
  expect(describeDebateListRank(fewPlaced, 'answered')).toBe('20 answered');
});
