import { mergeTranscriptOverlap } from './transcriptOverlap';
import type { SpeakerTranscriptTurn } from './speakerTranscript';
export const DEFAULT_ROLLING_TRANSCRIPTION_CHUNK_MS = 3 * 60 * 1000;
export const LISTENING_MODE_QUERY_VALUE = 'listening';

export type RollingTranscriptSegmentStatus =
  'recording' | 'queued' | 'transcribing' | 'complete' | 'error' | 'retrying';

export type RollingTranscriptSegment = {
  id: string;
  index: number;
  status: RollingTranscriptSegmentStatus;
  text: string;
  error?: string;
  startedAt: number;
  completedAt?: number;
  speakerTurns?: SpeakerTranscriptTurn[];
};

export const mergeRollingTranscriptText = (previous: string, next: string): string =>
  mergeTranscriptOverlap(previous, next, 80);

export const stitchRollingTranscriptSegments = (segments: RollingTranscriptSegment[] = []): string =>
  [...segments]
    .filter((segment) => segment.status === 'complete' && segment.text.trim())
    .sort((a, b) => a.index - b.index)
    .reduce((merged, segment) => mergeRollingTranscriptText(merged, segment.text), '');

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
