import { joinTranscriptText, transcriptOverlapTail } from './transcriptOverlap';
import type { SpeakerTranscriptTurn } from './speakerTranscript';
export const DEFAULT_ROLLING_TRANSCRIPTION_CHUNK_MS = 3 * 60 * 1000;
export const LISTENING_MODE_QUERY_VALUE = 'listening';

export type RollingTranscriptSegmentStatus =
  'recording' | 'queued' | 'transcribing' | 'complete' | 'failed' | 'retrying';

/** Time before a chunk when no audio was captured: the device paused the microphone, or audio stopped arriving. */
export type CaptureGap = { startedAt: number; endedAt: number; cause: 'muted' | 'stalled' };

export type RollingTranscriptSegment = {
  id: string;
  index: number;
  status: RollingTranscriptSegmentStatus;
  text: string;
  source?: 'text';
  error?: string;
  startedAt: number;
  completedAt?: number;
  speakerTurns?: SpeakerTranscriptTurn[];
  // No voice matched the samples sent, so this chunk's voices have new numbers.
  speakersRenumbered?: boolean;
  // Voices heard in this chunk only, with no sample to find them again: one may be someone with another number.
  oneOffSpeakers?: string[];
  // Its labelled uploads kept stalling, so it was transcribed without labels: its speech is in nobody's part.
  speakersDropped?: boolean;
  // Its voices are lettered Speaker A, B… for this part only (see letterSpeakerTurns): the next part's Speaker A
  // may be someone else, so the transcript marks where each part starts.
  speakersPerPart?: boolean;
  gapBefore?: CaptureGap;
};

// A chunk boundary repeats at most a second of speech, so only its last 80 words are compared.
const OVERLAP_WORDS = 80;

const recordingGap = () => '[Recording gap: audio could not be transcribed.]';
const duration = (milliseconds: number) => {
  const seconds = Math.max(1, Math.round(milliseconds / 1000));
  const minutes = Math.floor(seconds / 60);
  return minutes ? `${minutes} min${seconds % 60 ? ` ${seconds % 60} s` : ''}` : `${seconds} s`;
};
const captureGap = ({ startedAt, endedAt, cause }: CaptureGap) =>
  `[${cause === 'muted' ? 'Microphone paused' : 'No audio'} for ${duration(endedAt - startedAt)}.]`;
/** Where a part with lettered speakers, or the part after one, starts: "— Part 2 —". */
export const PART_BREAK = /^— Part (\d+) —$/;
const partBreak = (segment: RollingTranscriptSegment) => `— Part ${segment.index + 1} —`;

/** The words people said: gap markers keep a transcript honest about missing audio, but they are not speech. */
export const transcriptSpeech = (transcript: string): string =>
  transcript
    .replace(/\[Recording gap: chunk \d+ could not be transcribed\.\]/g, '')
    .replace(/\[Recording gap: audio could not be transcribed\.\]/g, '')
    .replace(/\[(?:Microphone paused|No audio) for [\w ]+\.\]/g, '')
    .replace(/^(?:Person \d+|Speaker [A-Z]{1,2}): /gm, '')
    .replace(/^— Part \d+ —$/gm, '')
    .trim();

// A line of the transcript: a voice's turn, plain text and gap markers (no speaker), or a part's start.
type TranscriptLine = { speaker: string; text: string; partBreak?: boolean };
const chunkLines = (segment: RollingTranscriptSegment): TranscriptLine[] => {
  const gap = segment.gapBefore ? [{ speaker: '', text: captureGap(segment.gapBefore) }] : [];
  if (segment.status === 'failed') return [...gap, { speaker: '', text: recordingGap() }];
  const turns = (segment.speakerTurns || []).filter((turn) => turn.speaker && turn.text.trim());
  const lines = turns.length ? turns : [{ speaker: '', text: segment.text }];
  return [...gap, ...lines.map(({ speaker, text }) => ({ speaker, text: text.trim() })).filter((line) => line.text)];
};

/**
 * Chunks in order, each voice's turns as "Person N: …" lines. Speech that the last line already ends with is
 * dropped from a chunk's first line when both are the same voice (or either is unlabelled): a second person
 * echoing "I agree" keeps their words. A voice that carries on, like plain text and gap markers, stays on the
 * same line. A part whose voices are lettered for that part alone, and the part after it, start under a
 * "— Part N —" line, which nothing joins across, and their seam is compared whatever its letters, since the
 * same voice may have another letter on each side.
 */
export const stitchRollingTranscriptSegments = (segments: RollingTranscriptSegment[] = []): string => {
  const lines: TranscriptLine[] = [];
  let previous: RollingTranscriptSegment | undefined;
  for (const segment of [...segments].sort((a, b) => a.index - b.index)) {
    if (segment.status !== 'complete' && segment.status !== 'failed') continue;
    const next = chunkLines(segment);
    const last = lines[lines.length - 1];
    const first = next[0];
    const newPart = Boolean(last && (segment.speakersPerPart || previous?.speakersPerPart));
    if (last && first && (newPart || last.speaker === first.speaker || !last.speaker || !first.speaker)) {
      const tail = transcriptOverlapTail(last.text, first.text, OVERLAP_WORDS);
      if (tail === '') next.shift();
      else if (tail != null) next[0] = { ...first, text: tail };
    }
    if (newPart && next.length) lines.push({ speaker: '', text: partBreak(segment), partBreak: true });
    for (const line of next) {
      const last = lines[lines.length - 1];
      if (last && !last.partBreak && last.speaker === line.speaker)
        last.text = joinTranscriptText(last.text, line.text);
      else lines.push(line);
    }
    previous = segment;
  }
  return lines.map(({ speaker, text }) => (speaker ? `${speaker}: ${text}` : text)).join('\n');
};

export const isListeningModeQueryEnabled = (search: unknown): boolean => {
  try {
    const raw = String(search || '').trim();
    const params = new URLSearchParams(raw.startsWith('?') ? raw : `?${raw}`);
    return params.get('mode') === LISTENING_MODE_QUERY_VALUE;
  } catch (_) {
    return false;
  }
};

export const buildListeningModeSearch = (search: unknown, enabled: boolean): string => {
  const raw = String(search || '').trim();
  const params = new URLSearchParams(raw.startsWith('?') ? raw : `?${raw}`);
  if (enabled) {
    params.set('mode', LISTENING_MODE_QUERY_VALUE);
  } else if (params.get('mode') === LISTENING_MODE_QUERY_VALUE) {
    params.delete('mode');
  }
  const next = params.toString();
  return next ? `?${next}` : '';
};
