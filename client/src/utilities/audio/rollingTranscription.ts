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
  // No voice matched the samples sent, so this chunk numbers its voices on its own.
  speakersRenumbered?: boolean;
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
/** The words people said: gap markers keep a transcript honest about missing audio, but they are not speech. */
export const transcriptSpeech = (transcript: string): string =>
  transcript
    .replace(/\[Recording gap: chunk \d+ could not be transcribed\.\]/g, '')
    .replace(/\[Recording gap: audio could not be transcribed\.\]/g, '')
    .replace(/\[(?:Microphone paused|No audio) for [\w ]+\.\]/g, '')
    .replace(/^Person \d+: /gm, '')
    .trim();

// A line of the transcript: a voice's turn, or plain text and gap markers (no speaker).
type TranscriptLine = { speaker: string; text: string };
const chunkLines = (segment: RollingTranscriptSegment): TranscriptLine[] => {
  const gap = segment.gapBefore ? [{ speaker: '', text: captureGap(segment.gapBefore) }] : [];
  if (segment.status === 'failed') return [...gap, { speaker: '', text: recordingGap() }];
  const turns = (segment.speakerTurns || []).filter((turn) => turn.speaker && turn.text.trim());
  const lines = turns.length ? turns : [{ speaker: '', text: segment.text }];
  return [...gap, ...lines.map(({ speaker, text }) => ({ speaker, text: text.trim() })).filter((line) => line.text)];
};

/**
 * Chunks in order, each voice's turns as "Person N: …" lines. Speech that the text so far already ends with
 * is dropped from a chunk's start, and a voice that carries on, like plain text and gap markers, stays on
 * the same line.
 */
export const stitchRollingTranscriptSegments = (segments: RollingTranscriptSegment[] = []): string => {
  const lines: TranscriptLine[] = [];
  for (const segment of [...segments].sort((a, b) => a.index - b.index)) {
    if (segment.status !== 'complete' && segment.status !== 'failed') continue;
    let next = chunkLines(segment);
    const tail = transcriptOverlapTail(
      lines.map((line) => line.text).join(' '),
      next.map((line) => line.text).join(' '),
      OVERLAP_WORDS,
    );
    // Drop the repeated characters, line by line (lines are joined by one space).
    let repeated = tail == null ? 0 : next.map((line) => line.text).join(' ').length - tail.length;
    next = next.flatMap((line) => {
      const text = line.text.slice(repeated).trimStart();
      repeated = Math.max(0, repeated - line.text.length - 1);
      return text ? [{ ...line, text }] : [];
    });
    for (const line of next) {
      const last = lines[lines.length - 1];
      if (last?.speaker === line.speaker) last.text = joinTranscriptText(last.text, line.text);
      else lines.push(line);
    }
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
