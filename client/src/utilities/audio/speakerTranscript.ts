export type SpeakerTranscriptTurn = {
  speaker: string;
  start: number;
  end: number;
  text: string;
};

/** Labels identify voices only within this upload, never a person or a later chunk. */
export const normalizeSpeakerTurns = (value: unknown): SpeakerTranscriptTurn[] =>
  (Array.isArray(value) ? value : []).flatMap((turn: unknown) => {
    if (!turn || typeof turn !== 'object') return [];
    const { speaker, start, end, text } = turn as Record<string, unknown>;
    if (
      typeof speaker !== 'string' ||
      !speaker.trim() ||
      typeof text !== 'string' ||
      !text.trim() ||
      typeof start !== 'number' ||
      !Number.isFinite(start) ||
      start < 0 ||
      typeof end !== 'number' ||
      !Number.isFinite(end) ||
      end < start
    )
      return [];
    return [{ speaker: speaker.trim().slice(0, 128), start, end, text: text.trim() }];
  });
