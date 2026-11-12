import { nameSpeakerTurns, planSpeakerTurns, type SpeakerTranscriptTurn } from './speakerTranscript';

const turn = (
  speaker: string,
  start: number,
  end: number,
  text = `${speaker} at ${start}.`,
): SpeakerTranscriptTurn => ({
  speaker,
  start,
  end,
  text,
});
const speakers = (turns: SpeakerTranscriptTurn[]) => turns.map((entry) => entry.speaker);

it('names voices Person 1, 2 and 3 by first appearance, sampling each from its longest turn', () => {
  const plan = planSpeakerTurns([turn('B', 0, 3), turn('A', 3, 4), turn('B', 4, 12), turn('C', 12, 15)], []);
  expect(plan.isolated).toBe(false);
  expect(plan.voices).toEqual([
    { label: 'B', start: 4, end: 12 },
    { label: 'A', start: 3, end: 4 },
    { label: 'C', start: 12, end: 15 },
  ]);
  // A voice without a sample (here A) is numbered after the voices that join the known people.
  const named = nameSpeakerTurns(plan, [], ['B', 'C']);
  expect(named.added).toEqual(['Person 1', 'Person 2']);
  expect(speakers(named.turns)).toEqual(['Person 1', 'Person 3', 'Person 1', 'Person 2']);
});

it('keeps known names and gives other voices the next free numbers', () => {
  const known = ['Person 1', 'Person 2'];
  const plan = planSpeakerTurns([turn('person 2', 0, 2), turn('A', 2, 6), turn('Person 1', 6, 8)], known);
  expect(plan.isolated).toBe(false);
  const named = nameSpeakerTurns(plan, known, ['A']);
  expect(named.added).toEqual(['Person 3']);
  expect(speakers(named.turns)).toEqual(['Person 2', 'Person 3', 'Person 1']);
});

it('numbers a voice without a sample after everyone already in the transcript, as heard in one part', () => {
  const known = ['Person 1', 'Person 2', 'Person 3', 'Person 4'];
  const plan = planSpeakerTurns([turn('Person 3', 0, 2), turn('B', 2, 6), turn('A', 6, 9)], known);
  // An earlier chunk already gave Person 5 and 6 to voices without samples.
  const named = nameSpeakerTurns(plan, known, [], 7);
  expect(named.added).toEqual([]);
  expect(named.oneOff).toEqual(['Person 7', 'Person 8']);
  expect(speakers(named.turns)).toEqual(['Person 3', 'Person 7', 'Person 8']);
  // New known people too start after them, so Record more never hands out an old number.
  expect(nameSpeakerTurns(planSpeakerTurns([turn('A', 0, 4)], []), [], ['A'], 9).added).toEqual(['Person 9']);
});

it('gives a chunk new numbers when samples were sent but no voice matched them', () => {
  // An older Worker drops the samples, and the model labels every voice A, B, C again.
  const known = ['Person 1', 'Person 2'];
  const plan = planSpeakerTurns([turn('A', 0, 4), turn('B', 4, 9), turn('C', 9, 12)], known);
  expect(plan.isolated).toBe(true);
  const named = nameSpeakerTurns(plan, known, ['A'], 3);
  expect(named.added).toEqual([]);
  expect(named.oneOff).toEqual(['Person 3', 'Person 4', 'Person 5']);
  expect(speakers(named.turns)).toEqual(['Person 3', 'Person 4', 'Person 5']);
});

it('tolerates odd labels and repeated lines from the model', () => {
  const plan = planSpeakerTurns(
    [
      turn('@', 0, 1, 'Well,'),
      turn('A', 1, 5, 'we should fund it.'),
      turn('B', 5, 7, 'Fighting grant.'),
      turn('A', 5.5, 6.5, ' Fighting  grant. '),
      turn('@', 7, 8, 'Agreed.'),
      turn('B', 8, 9, 'Agreed.'),
    ],
    [],
  );
  // The overlapping repeat is dropped; a line repeated later is speech.
  expect(plan.turns.map((entry) => entry.text)).toEqual([
    'Well,',
    'we should fund it.',
    'Fighting grant.',
    'Agreed.',
    'Agreed.',
  ]);
  expect(plan.voices.map((voice) => voice.label)).toEqual(['A', 'B']);
  const named = nameSpeakerTurns(plan, [], ['A', 'B']);
  // An odd label joins the voice before it, or after it at the start.
  expect(speakers(named.turns)).toEqual(['Person 1', 'Person 1', 'Person 2', 'Person 2', 'Person 2']);
  // A chunk with only odd labels has no turns, so its plain text is shown instead.
  expect(nameSpeakerTurns(planSpeakerTurns([turn('@', 0, 1)], []), [], []).turns).toEqual([]);
});
