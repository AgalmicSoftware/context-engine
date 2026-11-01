import { audioFileExtension } from './audioFileExtension';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { transcribeAudio, transcribeGroupAudio } from '../ai/aiClient.js';
import { audioBufferToWavParts, decodeAudioAtRate, TRANSCRIBE_WAV_TARGET_HZ } from '../ai/aiClientAudioTranscription';
import {
  countKeptChunks,
  hasUnsavedRecording,
  RecordingChunkQueue,
  subscribeUnsavedRecordings,
} from './recordingChunkQueue';
import { recordingOwner, type RecordingOptions } from './recordingOwner';
import {
  stitchRollingTranscriptSegments,
  type CaptureGap,
  type RollingTranscriptSegment,
} from './rollingTranscription';

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
const ownedByAnother = (scope: string, account: string) =>
  Boolean(scopeAccount(scope)) && scopeAccount(scope) !== account;
const OPEN_ELSEWHERE_NOTICE = 'This recording is open in another tab.';
// Reopening in the same tab gets the lock back at once; only a longer wait means another tab holds it.
const OPEN_ELSEWHERE_WAIT_MS = 1000;
const OWNER_NOTICE =
  'This recording belongs to the account that made it. It closes when its uploads finish and its audio is saved, or when you clear it. Download any audio you need first.';
// Longer imports are refused rather than decoded and uploaded whole.
const MAX_IMPORT_SECONDS = 30 * 60;

type Options = RecordingOptions & {
  labelSpeakers: boolean;
  // The recorder's chunk length, which imported audio is cut to.
  chunkMs: number;
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
  const [unsaved, setUnsaved] = useState(false);
  const [labelsUnavailableReason, setLabelsUnavailableReason] = useState('');
  const [hiddenPeriods, setHiddenPeriods] = useState<Array<{ startedAt: number; endedAt: number }>>([]);
  const [offline, setOffline] = useState(typeof navigator !== 'undefined' && navigator.onLine === false);
  const [openElsewhere, setOpenElsewhere] = useState(false);
  const { account: normalizedAccount, worker, identity } = recordingOwner(options);
  const pinned = useRef({ identity, scope: readPinnedScope(identity) });
  const openScope = useRef('');
  const [, refreshScope] = useState(0);
  if (pinned.current.identity !== identity) pinned.current = { identity, scope: readPinnedScope(identity) };
  const isForeign = (pin: string) => ownedByAnother(pin, normalizedAccount);
  // Record pins a recording so signing in or a late account restore neither stops capture nor splits it. A pin
  // made while signed in never reaches another account, which would see its transcript and upload with its own
  // credentials: opening the recorder drops it, unless only this page holds some of it (kept below).
  if (
    isForeign(pinned.current.scope) &&
    openScope.current !== pinned.current.scope &&
    !hasUnsavedRecording(pinned.current.scope)
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
    setOpenElsewhere(false);
    const open = () => {
      const queue = new RecordingChunkQueue({
        scope,
        transcribe: async (audio, labels, signal, knownSpeakers) => {
          const request = { ...latest.current, signal };
          if (labels) {
            const result = await transcribeGroupAudio(audio, { ...request, knownSpeakers });
            return {
              text: result.text,
              speakerTurns: result.segments,
              labelsUnavailableReason: result.labelsUnavailableReason,
              speakerSamplesRefused: result.speakerSamplesRefused,
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
          setUnsaved(queue.unsaved);
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
        if (queueRef.current === queue) queueRef.current = null;
        queue.dispose();
        window.removeEventListener('online', onOnline);
        window.removeEventListener('offline', onOffline);
        return queue.settled();
      };
    };
    const finish = () => {
      current = false;
      openScope.current = '';
    };
    // One tab at a time opens a recording, so two never upload the same chunks; another tab waits its turn.
    // Without Web Locks every tab opens it, as before.
    const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;
    if (!locks?.request) {
      const close = open();
      return () => {
        finish();
        void close();
      };
    }
    const abort = new AbortController();
    let close: (() => Promise<unknown>) | undefined;
    let release = () => {};
    const waiting = setTimeout(() => setOpenElsewhere(true), OPEN_ELSEWHERE_WAIT_MS);
    locks
      .request(`ce-recording:${scope}`, { signal: abort.signal }, () => {
        clearTimeout(waiting);
        if (!current) return undefined;
        setOpenElsewhere(false);
        close = open();
        return new Promise<void>((resolve) => {
          release = resolve;
        });
      })
      .catch(() => {
        // Closed before this tab's turn came. Otherwise the browser refused the lock (as in an opaque origin, or
        // with site data blocked): open the recording without one, as browsers without Web Locks do.
        if (!current) return;
        clearTimeout(waiting);
        setOpenElsewhere(false);
        close = open();
      });
    return () => {
      finish();
      clearTimeout(waiting);
      abort.abort();
      // The next tab gets the recording once this one's last saves are done.
      void Promise.resolve(close?.()).finally(release);
    };
  }, [scope, options.sessionSlug]);
  // An open recording that now belongs to another account is released only once nothing would be lost: no
  // capture, no chunk waiting or uploading (closing would drop a paid transcript), and no audio or text held
  // only by this page. Until then it stays with its account, the recorder says so, and Record waits.
  useEffect(() => {
    const queue = queueRef.current;
    if (!foreignPin || options.capturing || !queue) return undefined;
    let current = true;
    void queue.settled().then((settled) => {
      if (current && settled.idle && !settled.unsaved) releasePin();
    });
    return () => {
      current = false;
    };
  }, [foreignPin, options.capturing, segments, storageError, releasePin]);

  const prepare = useCallback(async () => {
    const queue = queueRef.current;
    if (!queue) throw new Error(OPEN_ELSEWHERE_NOTICE);
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
  const beginChunk = useCallback((gapBefore?: CaptureGap) => {
    const queue = queueRef.current!;
    const id = queue.begin(latest.current.labelSpeakers, gapBefore);
    return (audio: Blob, finished = false) => queue.capture(id, audio, finished);
  }, []);
  // An import is decoded once, when added, into chunk-length parts that upload like recorded chunks, each with
  // its own deadline and retry: nothing later decodes or uploads the whole file, and one that can't be decoded,
  // or is too long, adds nothing that a reload would retry.
  const addAudio = useCallback(
    async (audio: Blob) => {
      const queue = queueRef.current;
      const decoded = await decodeAudioAtRate(audio, TRANSCRIBE_WAV_TARGET_HZ);
      if (!decoded?.length) throw new Error("This audio file couldn't be read. Try an MP3 or WAV file.");
      if (decoded.duration > MAX_IMPORT_SECONDS)
        throw new Error('Choose audio up to 30 minutes. Split longer recordings first.');
      const parts = audioBufferToWavParts(decoded, latest.current.chunkMs / 1000);
      await prepare();
      if (!queue || queue !== queueRef.current) throw new Error('The recording changed. Add the audio again.');
      for (const part of parts) queue.capture(queue.begin(latest.current.labelSpeakers), part, true);
    },
    [prepare],
  );
  const addTranscript = useCallback(
    async (text: string) => {
      const queue = queueRef.current;
      await prepare();
      if (!queue || queue !== queueRef.current) throw new Error('The recording changed. Add the transcript again.');
      await queue.addTranscript(text);
    },
    [prepare],
  );
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
  const downloadRecording = useCallback(async (onProgress: (percent: number) => void) => {
    const audio = [...(queueRef.current?.records.values() || [])]
      .sort((a, b) => a.segment.index - b.segment.index)
      .flatMap((record) => (record.audio?.size ? [record.audio] : []));
    const { combineRecordingAudio } = await import('./combinedRecordingAudio');
    const mp3 = await combineRecordingAudio(audio, onProgress);
    const url = URL.createObjectURL(mp3);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'conversation.mp3';
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
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
    addAudio,
    addTranscript,
    finishTranscription,
    keepAudio,
    retryChunk,
    pageHidden,
    pageShown,
    dismissHiddenPeriods,
    hiddenPeriods,
    downloadChunk,
    downloadRecording,
    clearDraft,
    downloadableChunkIds,
    segments,
    transcript: stitchRollingTranscriptSegments(segments),
    storageError,
    unsaved,
    offline,
    labelsUnavailableReason,
    ownerNotice: foreignPin && !options.capturing ? OWNER_NOTICE : '',
    openElsewhereNotice: openElsewhere ? OPEN_ELSEWHERE_NOTICE : '',
  };
}

/**
 * While the recorder is closed (`enabled`), what the recording it would open left on this device: how many
 * chunks still hold audio to upload, and whether only this page holds some of it, so the session page can ask
 * for it to be reopened.
 */
export function useKeptRecording(options: RecordingOptions, enabled: boolean): { waiting: number; unsaved: boolean } {
  const { account, worker, identity } = recordingOwner(options);
  const pin = readPinnedScope(identity);
  // As the recorder does on opening, another account's recording gives way unless only this page holds some of it.
  const scope =
    pin && (!ownedByAnother(pin, account) || hasUnsavedRecording(pin))
      ? pin
      : JSON.stringify([worker, options.sessionSlug, account]);
  // Memory can change after the dialog closes, as when the recorder's last save fails while it unmounts.
  const unsaved = useSyncExternalStore(subscribeUnsavedRecordings, () => hasUnsavedRecording(scope));
  const [waiting, setWaiting] = useState(0);
  useEffect(() => {
    if (!enabled) return undefined;
    let current = true;
    void countKeptChunks(scope).then((count) => {
      if (current) setWaiting(count);
    });
    return () => {
      current = false;
    };
  }, [enabled, scope]);
  return enabled ? { waiting, unsaved } : { waiting: 0, unsaved: false };
}
