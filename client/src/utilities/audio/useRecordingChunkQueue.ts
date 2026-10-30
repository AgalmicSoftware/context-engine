import { audioFileExtension } from './audioFileExtension';
import { useCallback, useEffect, useRef, useState } from 'react';
import { transcribeAudio, transcribeGroupAudio } from '../ai/aiClient.js';
import { RecordingChunkQueue } from './recordingChunkQueue';
import { stitchRollingTranscriptSegments, type RollingTranscriptSegment } from './rollingTranscription';

const memoryScopes = new Map<string, string>();
const scopeStorageKey = (identity: string) => `ce:recording-scope:${identity}`;
const readPinnedScope = (identity: string): string => {
  const memoryScope = memoryScopes.get(identity);
  if (memoryScope) return memoryScope;
  try {
    const saved = window.sessionStorage.getItem(scopeStorageKey(identity)) || '';
    const parts: unknown = JSON.parse(saved);
    return Array.isArray(parts) && parts.length === 3 && JSON.stringify(parts.slice(0, 2)) === identity ? saved : '';
  } catch {
    return '';
  }
};

type Options = {
  sessionSlug: string;
  sessionConfig: Record<string, unknown> | null;
  context?: unknown;
  workerUrl?: string;
  labelSpeakers: boolean;
};

export function useRecordingChunkQueue(options: Options) {
  const latest = useRef(options);
  latest.current = options;
  const queueRef = useRef<RecordingChunkQueue | null>(null);
  const [segments, setSegments] = useState<RollingTranscriptSegment[]>([]);
  const [downloadableChunkIds, setDownloadableChunkIds] = useState<string[]>([]);
  const [storageError, setStorageError] = useState('');
  const [labelsUnavailableReason, setLabelsUnavailableReason] = useState('');
  const [offline, setOffline] = useState(typeof navigator !== 'undefined' && navigator.onLine === false);
  const account =
    options.context && typeof options.context === 'object' && 'account' in options.context
      ? String(options.context.account || '')
      : '';
  const worker = options.workerUrl || options.sessionConfig?.corsWorkerUrl || options.sessionConfig?.workerUrl || '';
  const identity = JSON.stringify([worker, options.sessionSlug]);
  const pinned = useRef({ identity, scope: readPinnedScope(identity) });
  const [, refreshScope] = useState(0);
  if (pinned.current.identity !== identity) pinned.current = { identity, scope: readPinnedScope(identity) };
  const scope = pinned.current.scope || JSON.stringify([worker, options.sessionSlug, account.toLowerCase()]);

  useEffect(() => {
    let current = true;
    setSegments([]);
    const queue = new RecordingChunkQueue({
      scope,
      transcribe: async (audio, labels) => {
        if (labels) {
          const result = await transcribeGroupAudio(audio, latest.current);
          return {
            text: result.text,
            speakerTurns: result.segments,
            labelsUnavailableReason: result.labelsUnavailableReason,
          };
        }
        return { text: await transcribeAudio(audio, latest.current) };
      },
      onChange: () => {
        if (!current) return;
        const next = queue.segments;
        setSegments(next);
        setDownloadableChunkIds(
          [...queue.records.values()].filter((record) => record.audio?.size).map((record) => record.segment.id),
        );
        setStorageError(queue.storageError);
        setLabelsUnavailableReason(queue.labelsUnavailableReason);
      },
    });
    queueRef.current = queue;
    const onOnline = () => {
      setOffline(false);
      queue.retry();
    };
    const onOffline = () => {
      setOffline(true);
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      current = false;
      queue.dispose();
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [scope, options.sessionSlug]);

  const prepare = useCallback(async () => {
    const queue = queueRef.current;
    if (!queue) throw new Error('Audio storage is not ready. Reopen the recorder.');
    // Pin before awaiting storage or microphone access: account hydration can run during either.
    pinned.current = { identity, scope };
    memoryScopes.set(identity, scope);
    try {
      window.sessionStorage.setItem(scopeStorageKey(identity), scope);
    } catch {
      // Memory still protects an active recording when browser storage is unavailable.
    }
    await queue.prepare();
  }, [identity, scope]);
  const beginChunk = useCallback(() => {
    const queue = queueRef.current!;
    const id = queue.begin(latest.current.labelSpeakers);
    return (audio: Blob, finished = false) => queue.capture(id, audio, finished);
  }, []);
  const finishTranscription = useCallback(async () => {
    await queueRef.current?.finish();
  }, []);
  const keepAudio = useCallback(async () => {
    await queueRef.current?.keepAudio();
  }, []);
  const retryChunk = useCallback((id?: string) => queueRef.current?.retry(id), []);
  const downloadChunk = useCallback((id: string) => {
    const record = queueRef.current?.records.get(id);
    if (!record?.audio) return;
    const extension = audioFileExtension(record.audio.type);
    const url = URL.createObjectURL(record.audio);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `recording-chunk-${record.segment.index + 1}.${extension}`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, []);
  const clearDraft = useCallback(async () => {
    try {
      await queueRef.current?.clear();
      pinned.current = { identity, scope: '' };
      memoryScopes.delete(identity);
      try {
        window.sessionStorage.removeItem(scopeStorageKey(identity));
      } catch {
        // Clearing the in-memory pin still starts the next recording in the current account scope.
      }
      refreshScope((value) => value + 1);
    } catch (error) {
      setStorageError(error instanceof Error ? error.message : String(error));
    }
  }, [identity]);
  return {
    scope,
    prepare,
    beginChunk,
    finishTranscription,
    keepAudio,
    retryChunk,
    downloadChunk,
    clearDraft,
    downloadableChunkIds,
    segments,
    transcript: stitchRollingTranscriptSegments(segments),
    storageError,
    offline,
    labelsUnavailableReason,
  };
}
