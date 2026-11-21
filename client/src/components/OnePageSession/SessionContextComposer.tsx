/** @file SessionContextComposer.tsx: one box that adds a note, a link or a file to a session's context. */
import { useId, useRef, useState } from 'react';
import { Input } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileAlt, faPaperclip, faTimes } from '@fortawesome/free-solid-svg-icons';

import {
  CONTEXT_SOURCE_LIMITS,
  contextFileIsReadByAi,
  resolveContextFileType,
} from '@ce-shared/sessionContextSources.mjs';
import ContextAccessPicker, { contextGroupsLabel } from '../Sessions/setup/ContextAccessPicker';
import { SetupCheck, SetupField } from '../Sessions/setup/SetupPrimitives';
import setupStyles from '../Sessions/setup/SessionSetup.module.scss';
import {
  addContextLink,
  buildContextNote,
  checkContextFile,
  contextFileAccept,
  formatContextSize,
  readContextPdf,
  uploadContextFile,
  type ContextFileAccess,
} from '../../utilities/docLibrary/contextSources';
import type { ContextGroup } from '../../utilities/docLibrary/useContextGroups';
import css from './SessionContextSources.module.scss';

type Props = {
  sessionSlug: string;
  sessionConfig: Record<string, unknown> | null;
  account: string;
  groups: ContextGroup[];
  /** An admin adds as one: for admins only too, and a link may be for admins only. */
  asAdmin?: boolean;
  /** Whether a link can be added: always for an admin, for others where the session's Worker takes theirs. */
  linksAllowed?: boolean;
  /** Whether the session has Context cards on: it then takes images, and a PDF or image can be read by its AI. */
  cardsOn?: boolean;
  onAdded: () => void;
};

const ABOUT_ACCESS =
  'Who may read what you add. Something locked to groups is for their members and the session’s admins, and the session’s AI uses it only when it works for one of them. A link is for everyone in the session.';
const ABOUT_ACCESS_ADMIN =
  'Who may read what you add. Something locked to groups is for their members and the session’s admins; admins only is for admins. The session’s AI uses it only when it works for someone who may read it. A link can be for everyone or for admins only.';
const ABOUT_ANALYZE =
  'Sends the PDF or image to the session’s AI. The text it returns is saved with the file, for everyone who can see the file, and counts as one of your AI uses today. Unticked, the file is kept but gives the AI no text until an admin has it read.';
const ABOUT_ANALYZE_ADMIN =
  'Sends the PDF or image to the session’s own AI provider with the session’s key. The text it returns is saved with the file. Unticked, the file is kept but gives the AI no text.';

/** A lone https address is a link; anything else typed is a note. */
export const contextLinkIn = (text: string): string => {
  const value = text.trim();
  return /^https:\/\/\S+$/i.test(value) && value.length <= CONTEXT_SOURCE_LIMITS.urlChars ? value : '';
};

// One box for the three things a session's context takes. What is typed is a link when it is a lone https
// address and a note otherwise; a file is attached or dropped. Each is added exactly as its own form added it:
// the same upload, link reading and limits. Nothing is added until Add is pressed.
const SessionContextComposer = ({
  sessionSlug,
  sessionConfig,
  account,
  groups,
  asAdmin = false,
  linksAllowed = false,
  cardsOn = false,
  onAdded,
}: Props) => {
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [access, setAccess] = useState<ContextFileAccess>({});
  const [analyze, setAnalyze] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [dragging, setDragging] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  const attach = useRef<HTMLButtonElement>(null);
  const saysId = useId();
  const options = { sessionSlug, sessionConfig, context: { account }, ...(asAdmin ? { asAdmin: true } : {}) };

  const address = contextLinkIn(text);
  const everyone = !access.adminsOnly && !access.groupIds?.length;
  // A link is for everyone, or from an admin for admins only; groups are for files and notes. An address typed
  // for any other audience is kept as a note, so the audience chosen is never widened to fit a link.
  const linkAudienceOk = everyone || (asAdmin && !!access.adminsOnly);
  const kind = file ? 'file' : !text.trim() ? '' : address && linksAllowed && linkAudienceOk ? 'link' : 'note';
  const problem = file ? checkContextFile(file, { images: cardsOn }) : '';
  const offersAnalyze = (asAdmin || cardsOn) && !!file && contextFileIsReadByAi(resolveContextFileType(file));
  const audience = access.adminsOnly
    ? 'admins only'
    : access.groupIds?.length
      ? contextGroupsLabel(access.groupIds, groups)
      : 'everyone in the session';
  const says =
    kind === 'link'
      ? `Adds a link for ${audience}: the session reads the page for its AI.`
      : kind === 'note'
        ? address && linksAllowed
          ? `A link can be for everyone${asAdmin ? ' or for admins only' : ''}, so for ${audience} this address is kept as a note.`
          : address
            ? `Links can’t be added here, so this is kept as a note for ${audience}.`
            : /^http:\/\/\S+$/i.test(text.trim())
              ? `Adds a note for ${audience}. To add it as a link, use an https:// address.`
              : `Adds a note for ${audience}.`
        : kind === 'file'
          ? `Adds this file for ${audience}.${text.trim() ? ' What you typed is kept in the box for after.' : ''}`
          : '';
  const ready = !!kind && !busy && !problem;

  const dropFile = () => {
    setFile(null);
    setFileKey((key) => key + 1);
  };
  // One file at a time, and none while something is being added.
  const takeFiles = (files: FileList | File[] | null | undefined) => {
    const list = Array.from(files || []);
    if (!list.length || busy) return;
    setFile(list[0]);
    setStatus(list.length > 1 ? `Only ${list[0].name} was taken. Add the others one at a time.` : '');
  };
  const add = async () => {
    if (!ready) return;
    setBusy(true);
    try {
      if (kind === 'link') {
        setStatus('Reading the page…');
        await addContextLink(
          { url: address, title: title.trim(), ...(asAdmin ? { adminsOnly: !!access.adminsOnly } : {}) },
          options,
        );
        setStatus('Link added.');
      } else if (kind === 'note') {
        setStatus('Adding the note…');
        await uploadContextFile({ file: buildContextNote({ text, title }), ...access }, options);
        setStatus('Note added.');
      } else if (file) {
        setStatus('Adding the file…');
        const id = await uploadContextFile({ file, ...access }, options);
        dropFile();
        if (offersAnalyze && analyze) {
          setStatus('File added. The session’s AI is reading it…');
          onAdded();
          try {
            await readContextPdf(id, options);
            setStatus('File added and read by the session’s AI.');
          } catch (failure) {
            setStatus(
              `File added, but the session’s AI could not read it: ${failure instanceof Error ? failure.message : asAdmin ? 'try Read with AI.' : 'an admin can have it read.'}`,
            );
          }
        } else setStatus('File added.');
      }
      // A file leaves what was typed in the box; a note or a link was what was typed.
      if (kind !== 'file') {
        setText('');
        setTitle('');
      }
      onAdded();
    } catch (failure) {
      setStatus(failure instanceof Error ? failure.message : 'That did not work. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={css.composer} data-testid="ce-session-context-composer">
      <div
        className={`${css.composerBox} ${dragging ? css.composerBoxDragging : ''}`}
        onDragOver={(event) => {
          if (!event.dataTransfer?.types?.includes('Files')) return;
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          if (!event.dataTransfer?.files?.length) return;
          event.preventDefault();
          setDragging(false);
          takeFiles(event.dataTransfer.files);
        }}
      >
        {file ? (
          <div className={css.composerFile} data-testid="ce-session-context-chosen-file">
            <FontAwesomeIcon icon={faFileAlt} fixedWidth aria-hidden="true" />
            <span>{file.name}</span>
            <span className={css.composerFileSize}>{formatContextSize(file.size)}</span>
            <button
              type="button"
              aria-label={`Remove ${file.name}`}
              disabled={busy}
              onClick={() => {
                dropFile();
                // The row goes with this button, so focus moves to the one beside it.
                attach.current?.focus();
              }}
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>
          </div>
        ) : (
          <Input
            id="ce-session-context-compose"
            type="textarea"
            rows={3}
            value={text}
            disabled={busy}
            aria-label={linksAllowed ? 'Write a note, paste a link, or drop a file' : 'Write a note, or drop a file'}
            placeholder={linksAllowed ? 'Write a note, paste a link, or drop a file' : 'Write a note, or drop a file'}
            className={css.composerText}
            data-testid="ce-session-context-compose"
            onChange={(event) => setText(event.target.value)}
          />
        )}
        <button
          type="button"
          ref={attach}
          className={css.composerAttach}
          aria-label="Attach a file"
          title="Attach a file"
          disabled={busy}
          onClick={() => picker.current?.click()}
        >
          <FontAwesomeIcon icon={faPaperclip} />
        </button>
        <input
          key={fileKey}
          ref={picker}
          type="file"
          hidden
          accept={contextFileAccept({ images: cardsOn })}
          aria-label="File to add"
          data-testid="ce-session-context-file-input"
          onChange={(event) => takeFiles(event.target.files)}
        />
        <p className={css.composerHint}>
          {[
            'Notes',
            ...(linksAllowed ? ['links'] : []),
            cardsOn ? 'PDF, text or image files' : 'PDF or text files',
          ].join(', ')}
        </p>
      </div>
      {kind === 'note' || kind === 'link' ? (
        <Input
          id="ce-session-context-compose-title"
          value={title}
          maxLength={CONTEXT_SOURCE_LIMITS.titleChars}
          disabled={busy}
          aria-label={kind === 'link' ? 'Link title' : 'Note title'}
          placeholder={
            kind === 'link'
              ? 'Title (optional): the page’s own title if left empty'
              : 'Title (optional): its first line if left empty'
          }
          onChange={(event) => setTitle(event.target.value)}
        />
      ) : null}
      {problem ? <p className={setupStyles.errorText}>{problem}</p> : null}
      {offersAnalyze ? (
        <SetupCheck
          id="ce-session-context-analyze"
          label="Analyze with the session’s AI"
          help={asAdmin ? ABOUT_ANALYZE_ADMIN : ABOUT_ANALYZE}
          checked={analyze}
          onChange={setAnalyze}
          testId="ce-session-context-analyze"
        />
      ) : null}
      <div className={css.composerFoot}>
        <SetupField
          id="ce-session-context-access"
          label="Visible to"
          help={asAdmin ? ABOUT_ACCESS_ADMIN : ABOUT_ACCESS}
        >
          <ContextAccessPicker
            id="ce-session-context-access"
            value={access}
            groups={groups}
            allowAdminsOnly={asAdmin}
            data-testid="ce-session-context-access"
            onChange={setAccess}
          />
        </SetupField>
        <button
          type="button"
          className={`${setupStyles.button} ${setupStyles.primaryButton}`}
          disabled={!ready}
          aria-describedby={says ? saysId : undefined}
          data-testid="ce-session-context-compose-add"
          onClick={() => void add()}
        >
          Add
        </button>
      </div>
      {says ? (
        <p id={saysId} className={setupStyles.hint} aria-live="polite" data-testid="ce-session-context-compose-says">
          {says}
        </p>
      ) : null}
      {status ? (
        <p className={setupStyles.statusText} role="status">
          {status}
        </p>
      ) : null}
    </div>
  );
};

export default SessionContextComposer;
