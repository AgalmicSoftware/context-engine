import { useCallback, useEffect, useRef, useState } from 'react';
import { transcribeAudio, transcribeGroupAudio } from '../ai/aiClient.js';
import { RecordingChunkQueue } from './recordingChunkQueue';
import { stitchRollingTranscriptSegments, type RollingTranscriptSegment } from './rollingTranscription';

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
  const scope = JSON.stringify([
    options.workerUrl || options.sessionConfig?.corsWorkerUrl || options.sessionConfig?.workerUrl || '',
    options.sessionSlug,
    account.toLowerCase(),
  ]);

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
    await queue.prepare();
  }, []);
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
    const extension = record.audio.type.includes('mp4') ? 'm4a' : record.audio.type.includes('ogg') ? 'ogg' : 'webm';
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
    } catch (error) {
      setStorageError(error instanceof Error ? error.message : String(error));
    }
  }, []);
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
