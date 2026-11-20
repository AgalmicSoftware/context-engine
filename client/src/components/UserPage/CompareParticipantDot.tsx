import type { CSSProperties } from 'react';
import { resolveCompareCompassSeriesColor } from './compareAddressStyles';
import styles from './CompareResult.module.scss';

export const participantLetter = (index: number) => String.fromCharCode(65 + index);
export const participantIndex = (letter: string) => letter.charCodeAt(0) - 65;
export const participantName = (labels: string[], index: number) =>
  labels[index] || `Participant ${participantLetter(index)}`;

/**
 * A person's letter in a disc of their colour. The letter carries who it is, so colour is never the
 * only cue; the name goes beside it, or in `title` where there is no room.
 */
export function ParticipantDot({ index, title }: { index: number; title?: string }) {
  const color = { '--compare-person': resolveCompareCompassSeriesColor(index) } as CSSProperties;
  return (
    <span className={styles.dot} style={color} title={title} aria-hidden="true">
      {participantLetter(index)}
    </span>
  );
}

/** "Ada", "Ada and Ben", "Ada, Ben and Cleo". */
export const joinNames = (names: string[]) =>
  names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
