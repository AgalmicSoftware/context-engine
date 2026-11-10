/**
 * @file speakerMerges.ts: speakers the host found to be one person. A group recording can give one voice more
 * than one label; once merged, every line shows under the label the voice joined, and one code carries it all.
 */

/** Each merged label, mapped to the label it joined. Kept flat: a label that others joined never joins another. */
export type SpeakerMerges = Record<string, string>;

const LABEL = /^Person \d+$/;
const TURN = /^(Person \d+): /;
const labelNumber = (person: string) => Number(person.slice(7));

/** Merges as saved with a recording, without anything malformed in them. */
export const readSpeakerMerges = (value: unknown): SpeakerMerges => {
  if (!value || typeof value !== 'object') return {};
  const merges = Object.entries(value).filter(
    (entry): entry is [string, string] =>
      LABEL.test(entry[0]) && typeof entry[1] === 'string' && LABEL.test(entry[1]) && entry[0] !== entry[1],
  );
  return Object.fromEntries(merges.filter(([, shown]) => !merges.some(([person]) => person === shown)));
};

/** Puts `from`, with anyone who joined it, under `into`'s label. */
export const mergeSpeakers = (merges: SpeakerMerges, from: string, into: string): SpeakerMerges => {
  const source = merges[from] || from;
  const target = merges[into] || into;
  if (source === target) return merges;
  const moved = Object.entries(merges).map(([person, shown]) => [person, shown === source ? target : shown]);
  return { ...Object.fromEntries(moved), [source]: target };
};

/** Shows everyone who joined `person` under their own labels again. */
export const splitSpeakers = (merges: SpeakerMerges, person: string): SpeakerMerges =>
  Object.fromEntries(Object.entries(merges).filter(([, shown]) => shown !== person));

/** Who shows under `person`: themselves, then those who joined them, by number. */
export const speakersShownAs = (merges: SpeakerMerges, person: string): string[] => [
  person,
  ...Object.keys(merges)
    .filter((merged) => merges[merged] === person)
    .sort((left, right) => labelNumber(left) - labelNumber(right)),
];

/** "Person 1 + 3" once Person 3 joined Person 1. */
export const mergedSpeakerLabel = (merges: SpeakerMerges, person: string): string => {
  const shown = speakersShownAs(merges, person);
  return shown.length < 2 ? person : `Person ${shown.map(labelNumber).join(' + ')}`;
};

/** The transcript with each merged speaker's lines under the label they joined. */
export const applySpeakerMerges = (transcript: string, merges: SpeakerMerges): string => {
  if (!Object.keys(merges).length) return transcript;
  return transcript
    .split('\n')
    .map((line) => {
      const turn = TURN.exec(line);
      const shown = turn && merges[turn[1]];
      return shown ? `${shown}${line.slice(turn[1].length)}` : line;
    })
    .join('\n');
};
