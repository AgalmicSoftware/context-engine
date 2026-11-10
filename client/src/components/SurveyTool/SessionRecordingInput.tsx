import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './SessionRecordingInput.module.scss';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';

const AUDIO_TYPES: Record<string, string> = {
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  mp4: 'audio/mp4',
  wav: 'audio/wav',
  webm: 'audio/webm',
  ogg: 'audio/ogg',
};
const MAX_AUDIO_BYTES = 20 * 1024 * 1024;
const MAX_TRANSCRIPT_CHARS = 100_000;

type Props = {
  disabled: boolean;
  onAudio: (audio: Blob) => Promise<void>;
  onTranscript: (text: string) => Promise<void>;
  // Where the + goes instead, as in a dialog's header beside its other icons. Its choices stay here.
  triggerSlot?: Element | null;
};

/** Additional input joins the same saved recording without opening the microphone. */
export default function SessionRecordingInput({ disabled, onAudio, onTranscript, triggerSlot = null }: Props) {
  const [open, setOpen] = useState(false);
  const [pasting, setPasting] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const audioRef = useRef<HTMLInputElement>(null);
  const transcriptRef = useRef<HTMLInputElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const choicesRef = useRef<HTMLDivElement>(null);
  // An Escape this handled: its keyup must not reach the dialog, which closes on keyup.
  const escapeHandledRef = useRef(false);
  const id = useId();
  // The choices can open far from the +, which may be in the dialog's header: take focus to them, in view.
  useEffect(() => {
    if (!open) return;
    const first = choicesRef.current?.querySelector('button');
    first?.focus();
    first?.scrollIntoView?.({ block: 'nearest' });
  }, [open]);
  const blocked = disabled || busy;
  const run = async (action: () => Promise<void>, success: string) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
      setNotice(success);
      setOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not add this input. Please try again.');
    } finally {
      setBusy(false);
    }
  };
  const addTranscript = async (value: string) => {
    if (!value.trim()) throw new Error('Add some transcript text first.');
    if (value.length > MAX_TRANSCRIPT_CHARS) throw new Error('Use a transcript under 100,000 characters.');
    await onTranscript(value.trim());
    setText('');
    setPasting(false);
  };
  const trigger = (
    <button
      ref={toggleRef}
      type="button"
      aria-label="Add input"
      title="Add audio or a transcript"
      className={triggerSlot ? styles.headerAddButton : styles.addButton}
      data-ce-control-appearance={triggerSlot ? 'frameless' : undefined}
      disabled={blocked}
      aria-expanded={open}
      aria-controls={id}
      data-testid={E2E_TESTIDS.SESSION_RECORDING_ADD_INPUT}
      onClick={() => setOpen(!open)}
    >
      <span aria-hidden="true">+</span>
    </button>
  );
  return (
    <div
      className={styles.input}
      // Escape from the + reaches this through the portal too.
      onKeyDown={(event) => {
        if (event.key === 'Escape' && (open || pasting)) {
          event.stopPropagation();
          escapeHandledRef.current = true;
          setOpen(false);
          setPasting(false);
          toggleRef.current?.focus();
        }
      }}
      onKeyUp={(event) => {
        if (event.key === 'Escape' && escapeHandledRef.current) {
          escapeHandledRef.current = false;
          event.stopPropagation();
        }
      }}
    >
      {triggerSlot ? createPortal(trigger, triggerSlot) : trigger}
      {open && (
        <div id={id} ref={choicesRef} className={styles.choices}>
          <button type="button" disabled={blocked} onClick={() => audioRef.current?.click()}>
            Upload audio <small>MP3, M4A, WAV, MP4, WebM, OGG · up to 30 min, 20 MB</small>
          </button>
          <button type="button" disabled={blocked} onClick={() => transcriptRef.current?.click()}>
            Upload transcript <small>Text or Markdown · up to 100,000 characters</small>
          </button>
          <button
            type="button"
            disabled={blocked}
            onClick={() => {
              setPasting(true);
              setOpen(false);
            }}
          >
            Paste transcript
          </button>
        </div>
      )}
      <input
        ref={audioRef}
        type="file"
        hidden
        accept=".mp3,.m4a,.mp4,.wav,.webm,.ogg"
        aria-label="Upload audio file"
        data-testid={E2E_TESTIDS.SESSION_RECORDING_AUDIO_FILE}
        disabled={blocked}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (!file) return;
          void run(async () => {
            const mime = AUDIO_TYPES[file.name.split('.').pop()?.toLowerCase() || ''];
            if (!mime) throw new Error('Choose an MP3, M4A, WAV, MP4, WebM, or OGG audio file.');
            if (!file.size) throw new Error('This audio file is empty.');
            if (file.size > MAX_AUDIO_BYTES)
              throw new Error('Choose audio up to 20 MB. Split larger recordings first.');
            await onAudio(file.slice(0, file.size, mime));
          }, 'Audio added. Transcription will appear below.');
        }}
      />
      <input
        ref={transcriptRef}
        type="file"
        hidden
        accept=".txt,.md,text/plain,text/markdown"
        aria-label="Upload transcript file"
        data-testid={E2E_TESTIDS.SESSION_RECORDING_TRANSCRIPT_FILE}
        disabled={blocked}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (!file) return;
          void run(async () => {
            if (!/\.(txt|md)$/i.test(file.name)) throw new Error('Choose a .txt or .md transcript.');
            if (file.size > MAX_TRANSCRIPT_CHARS * 4) throw new Error('Use a transcript under 100,000 characters.');
            await addTranscript(await file.text());
          }, 'Transcript added.');
        }}
      />
      {pasting && (
        <div className={styles.paste}>
          <label htmlFor={`${id}-text`}>Written transcript</label>
          <textarea
            id={`${id}-text`}
            autoFocus
            rows={6}
            value={text}
            maxLength={MAX_TRANSCRIPT_CHARS}
            disabled={blocked}
            onChange={(event) => setText(event.target.value)}
            placeholder="Paste or type the conversation here…"
          />
          <div className={styles.actions}>
            <button
              type="button"
              disabled={blocked || !text.trim()}
              onClick={() => void run(() => addTranscript(text), 'Transcript added.')}
            >
              Add transcript
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setPasting(false);
                toggleRef.current?.focus();
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {busy && <p role="status">Adding input…</p>}
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
    </div>
  );
}
