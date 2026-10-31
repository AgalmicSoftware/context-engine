import { audioFileExtension } from './audioFileExtension';
import { useCallback, useEffect, useRef, useState } from 'react';
import { transcribeAudio, transcribeGroupAudio } from '../ai/aiClient.js';
import { hasUnsavedAudio, RecordingChunkQueue } from './recordingChunkQueue';
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
const forgetPinnedScope = (identity: string) => {
  memoryScopes.delete(identity);
  try {
    window.sessionStorage.removeItem(scopeStorageKey(identity));
  } catch {
    // Clearing the in-memory pin still starts the next recording in the current account scope.
  }
};
// The account a recording was made under; empty when made signed out.
const scopeAccount = (scope: string): string => {
  try {
    const parts: unknown = JSON.parse(scope);
    return Array.isArray(parts) ? String(parts[2] || '') : '';
  } catch {
    return '';
  }
};
const OWNER_NOTICE =
  'This recording belongs to the account that made it. It closes when its uploads finish and its audio is saved, or when you clear it. Download any audio you need first.';

type Options = {
  sessionSlug: string;
  sessionConfig: Record<string, unknown> | null;
  context?: unknown;
  workerUrl?: string;
  labelSpeakers: boolean;
  // Another account's recording stays open while capture continues.
  capturing?: boolean;
};

export function useRecordingChunkQueue(options: Options) {
  const latest = useRef(options);
  latest.current = options;
  const queueRef = useRef<RecordingChunkQueue | null>(null);
  const [segments, setSegments] = useState<RollingTranscriptSegment[]>([]);
  const [downloadableChunkIds, setDownloadableChunkIds] = useState<string[]>([]);
  const [storageError, setStorageError] = useState('');
  const [labelsUnavailableReason, setLabelsUnavailableReason] = useState('');
  const [hiddenPeriods, setHiddenPeriods] = useState<Array<{ startedAt: number; endedAt: number }>>([]);
  const [offline, setOffline] = useState(typeof navigator !== 'undefined' && navigator.onLine === false);
  const account =
    options.context && typeof options.context === 'object' && 'account' in options.context
      ? String(options.context.account || '')
      : '';
  const normalizedAccount = account.toLowerCase();
  const worker = options.workerUrl || options.sessionConfig?.corsWorkerUrl || options.sessionConfig?.workerUrl || '';
  const identity = JSON.stringify([worker, options.sessionSlug]);
  const pinned = useRef({ identity, scope: readPinnedScope(identity) });
  const openScope = useRef('');
  const [, refreshScope] = useState(0);
  if (pinned.current.identity !== identity) pinned.current = { identity, scope: readPinnedScope(identity) };
  const isForeign = (pin: string) => Boolean(scopeAccount(pin)) && scopeAccount(pin) !== normalizedAccount;
  // Record pins a recording so signing in or a late account restore neither stops capture nor splits it. A pin
  // made while signed in never reaches another account, which would see its transcript and upload with its own
  // credentials: opening the recorder drops it, unless only this page holds some of its audio (kept below).
  if (
    isForeign(pinned.current.scope) &&
    openScope.current !== pinned.current.scope &&
    !hasUnsavedAudio(pinned.current.scope)
  ) {
    forgetPinnedScope(identity);
    pinned.current = { identity, scope: '' };
  }
  const foreignPin = isForeign(pinned.current.scope);
  const scope = pinned.current.scope || JSON.stringify([worker, options.sessionSlug, normalizedAccount]);
  const releasePin = useCallback(() => {
    pinned.current = { identity, scope: '' };
    forgetPinnedScope(identity);
    refreshScope((value) => value + 1);
  }, [identity]);

  useEffect(() => {
    let current = true;
    openScope.current = scope;
    setSegments([]);
    setHiddenPeriods([]);
    const queue = new RecordingChunkQueue({
      scope,
      transcribe: async (audio, labels, signal) => {
        const request = { ...latest.current, signal };
        if (labels) {
          const result = await transcribeGroupAudio(audio, request);
          return {
            text: result.text,
            speakerTurns: result.segments,
            labelsUnavailableReason: result.labelsUnavailableReason,
          };
        }
        return { text: await transcribeAudio(audio, request) };
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
        setHiddenPeriods(
          queue.hiddenPeriods.flatMap(({ startedAt, endedAt }) => (endedAt == null ? [] : [{ startedAt, endedAt }])),
        );
      },
    });
    queueRef.current = queue;
    const onOnline = () => {
      setOffline(false);
      void queue.reconnect();
    };
    const onOffline = () => {
      setOffline(true);
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      current = false;
      openScope.current = '';
      queue.dispose();
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [scope, options.sessionSlug]);
  // An open recording that now belongs to another account is released only once nothing would be lost: no
  // capture, no chunk waiting or uploading (closing would drop a paid transcript), and no audio held only by
  // this page. Until then it stays with its account, the recorder says so, and Record waits.
  useEffect(() => {
    const queue = queueRef.current;
    if (!foreignPin || options.capturing || !queue) return undefined;
    let current = true;
    void queue.settled().then(({ idle, unsaved }) => {
      if (current && idle && !unsaved) releasePin();
    });
    return () => {
      current = false;
    };
  }, [foreignPin, options.capturing, segments, storageError, releasePin]);

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
  const pageHidden = useCallback((at: number) => queueRef.current?.pageHidden(at), []);
  const pageShown = useCallback((at: number) => queueRef.current?.pageShown(at), []);
  const dismissHiddenPeriods = useCallback(() => queueRef.current?.dismissHiddenPeriods(), []);
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
  const clearDraft = useCallback(
    async (discardAudio = false) => {
      try {
        await queueRef.current?.clear(discardAudio);
        releasePin();
      } catch (error) {
        setStorageError(error instanceof Error ? error.message : String(error));
      }
    },
    [releasePin],
  );
  return {
    scope,
    prepare,
    beginChunk,
    finishTranscription,
    keepAudio,
    retryChunk,
    pageHidden,
    pageShown,
    dismissHiddenPeriods,
    hiddenPeriods,
    downloadChunk,
    clearDraft,
    downloadableChunkIds,
    segments,
    transcript: stitchRollingTranscriptSegments(segments),
    storageError,
    offline,
    labelsUnavailableReason,
    ownerNotice: foreignPin && !options.capturing ? OWNER_NOTICE : '',
  };
}
