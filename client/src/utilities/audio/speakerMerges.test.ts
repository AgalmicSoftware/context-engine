import {
  applySpeakerMerges,
  mergedSpeakerLabel,
  mergeSpeakers,
  readSpeakerMerges,
  speakersShownAs,
  splitSpeakers,
} from './speakerMerges';

const TRANSCRIPT = [
  'Person 1: Should we fund the garden?',
  'Person 3: Yes, I think so.',
  '[Recording paused for 2 min.]',
  'Person 2: Person 3: is quoted here.',
  'Person 13: A thirteenth voice.',
].join('\n');

describe('speakers the host merged', () => {
  it('relabels only the merged speakers’ own lines', () => {
    expect(applySpeakerMerges(TRANSCRIPT, { 'Person 3': 'Person 1' })).toBe(
      [
        'Person 1: Should we fund the garden?',
        'Person 1: Yes, I think so.',
        '[Recording paused for 2 min.]',
        'Person 2: Person 3: is quoted here.',
        'Person 13: A thirteenth voice.',
      ].join('\n'),
    );
    expect(applySpeakerMerges(TRANSCRIPT, {})).toBe(TRANSCRIPT);
  });

  it('moves a whole group when it joins another, and keeps the merges flat', () => {
    let merges = mergeSpeakers({}, 'Person 3', 'Person 1');
    merges = mergeSpeakers(merges, 'Person 5', 'Person 1');
    expect(mergedSpeakerLabel(merges, 'Person 1')).toBe('Person 1 + 3 + 5');
    // Person 1, with those who joined it, joins Person 2.
    merges = mergeSpeakers(merges, 'Person 1', 'Person 2');
    expect(merges).toEqual({ 'Person 1': 'Person 2', 'Person 3': 'Person 2', 'Person 5': 'Person 2' });
    expect(speakersShownAs(merges, 'Person 2')).toEqual(['Person 2', 'Person 1', 'Person 3', 'Person 5']);
    // Dropping a member on its own group, or a group on itself, changes nothing.
    expect(mergeSpeakers(merges, 'Person 3', 'Person 2')).toBe(merges);
    expect(mergeSpeakers(merges, 'Person 2', 'Person 5')).toBe(merges);
  });

  it('splits a group back into its people and leaves other groups alone', () => {
    const merges = { 'Person 3': 'Person 1', 'Person 5': 'Person 1', 'Person 4': 'Person 2' };
    expect(splitSpeakers(merges, 'Person 1')).toEqual({ 'Person 4': 'Person 2' });
    expect(mergedSpeakerLabel(splitSpeakers(merges, 'Person 1'), 'Person 1')).toBe('Person 1');
  });

  it('keeps only well-formed merges from a saved recording', () => {
    expect(readSpeakerMerges(null)).toEqual({});
    expect(readSpeakerMerges('Person 3')).toEqual({});
    expect(
      readSpeakerMerges({
        'Person 3': 'Person 1',
        'Person 4': 'Person 4',
        'Person 6': 7,
        Host: 'Person 1',
        // A chain would show a line under a label that is itself merged away.
        'Person 8': 'Person 3',
      }),
    ).toEqual({ 'Person 3': 'Person 1' });
  });
});
