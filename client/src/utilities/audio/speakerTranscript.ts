export type SpeakerTranscriptTurn = {
  speaker: string;
  start: number;
  end: number;
  text: string;
};

/** A voice heard in an earlier chunk: its Person name and a short WAV sample, as a data URL. */
export type KnownSpeaker = { name: string; sample: string };

/** The labels as the model gave them, before the recorder names them. */
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

// OpenAI matches voices to at most four known speakers.
export const MAX_KNOWN_SPEAKERS = 4;
// The model's own labels for voices it has no sample of: A, B, C...
const VOICE_LABEL = /^[A-Z]{1,2}$/;
const words = (text: string) => text.replace(/\s+/g, ' ').trim();
const overlaps = (a: SpeakerTranscriptTurn, b: SpeakerTranscriptTurn) =>
  Math.max(a.start, b.start) < Math.min(a.end, b.end) || (a.start === b.start && a.end === b.end);
const knownName = (known: string[], label: string) => known.find((name) => name.toLowerCase() === label.toLowerCase());

export type SpeakerPlan = {
  turns: SpeakerTranscriptTurn[];
  // Samples were sent but no voice matched one, as when an older Worker drops them.
  isolated: boolean;
  // Voices without a known name, by first appearance, each with its longest turn to sample.
  voices: Array<{ label: string; start: number; end: number }>;
};

export const planSpeakerTurns = (turns: SpeakerTranscriptTurn[], known: string[]): SpeakerPlan => {
  // The model sometimes gives a line twice over the same time.
  const kept = turns.filter(
    (turn, index) =>
      !turns.slice(0, index).some((earlier) => overlaps(earlier, turn) && words(earlier.text) === words(turn.text)),
  );
  const voices: SpeakerPlan['voices'] = [];
  for (const { speaker, start, end } of kept) {
    if (!VOICE_LABEL.test(speaker)) continue;
    const voice = voices.find((entry) => entry.label === speaker);
    if (!voice) voices.push({ label: speaker, start, end });
    else if (end - start > voice.end - voice.start) Object.assign(voice, { start, end });
  }
  return { turns: kept, isolated: known.length > 0 && !kept.some((turn) => knownName(known, turn.speaker)), voices };
};

/**
 * Names each turn's voice. A known voice keeps its name, and each `sampled` voice joins the known people as
 * the next Person. Other voices are numbered after them for this chunk only, and an isolated chunk numbers
 * all its voices afresh. A turn with an odd label, such as "@", joins the voice before it (or after it).
 */
export const nameSpeakerTurns = (plan: SpeakerPlan, known: string[], sampled: string[]) => {
  const names = new Map<string, string>();
  let next = plan.isolated ? 1 : known.length + 1;
  const nextName = (label: string) => {
    const name = `Person ${next++}`;
    names.set(label, name);
    return name;
  };
  const added = plan.isolated ? [] : sampled.map(nextName);
  for (const { label } of plan.voices) if (!names.has(label)) nextName(label);
  const named = plan.turns.map((turn) => ({
    ...turn,
    speaker: knownName(known, turn.speaker) ?? names.get(turn.speaker) ?? '',
  }));
  const beside = (index: number) =>
    named
      .slice(0, index)
      .reverse()
      .find((turn) => turn.speaker)?.speaker ??
    named.slice(index + 1).find((turn) => turn.speaker)?.speaker ??
    '';
  return {
    turns: named
      .map((turn, index) => (turn.speaker ? turn : { ...turn, speaker: beside(index) }))
      .filter((turn) => turn.speaker),
    added,
  };
};
