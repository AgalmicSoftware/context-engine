import { useState } from 'react';
import { Input } from 'reactstrap';

import { CONTEXT_SOURCE_LIMITS } from '@ce-shared/sessionContextSources.mjs';
import ContextAccessPicker from '../Sessions/setup/ContextAccessPicker';
import { SetupField } from '../Sessions/setup/SetupPrimitives';
import setupStyles from '../Sessions/setup/SessionSetup.module.scss';
import { buildContextNote, uploadContextFile, type ContextFileAccess } from '../../utilities/docLibrary/contextSources';
import type { ContextGroup } from '../../utilities/docLibrary/useContextGroups';

type Props = {
  sessionSlug: string;
  sessionConfig: Record<string, unknown> | null;
  account: string;
  groups: ContextGroup[];
  onAdded: () => void;
};

const ABOUT_NOTE = 'Stored as a Markdown file, with the limits a file has. Without a title, its first line names it.';
const ABOUT_ACCESS =
  'A note locked to groups is for their members and the session’s admins. The session’s AI uses it only when it works for one of them.';

// A participant's typed note, added as a file is: the same upload, types, limits and access.
const SessionContextAddNote = ({ sessionSlug, sessionConfig, account, groups, onAdded }: Props) => {
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [access, setAccess] = useState<ContextFileAccess>({});
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const add = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    setStatus('Adding the note…');
    try {
      const file = buildContextNote({ text, title });
      await uploadContextFile({ file, ...access }, { sessionSlug, sessionConfig, context: { account } });
      setTitle('');
      setText('');
      setStatus('Note added.');
      onAdded();
    } catch (failure) {
      setStatus(failure instanceof Error ? failure.message : 'That did not work. Try again.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={setupStyles.listRowBody} data-testid="ce-session-context-add-note">
      <SetupField id="ce-session-context-note-title" label="Note title">
        <Input
          id="ce-session-context-note-title"
          value={title}
          maxLength={CONTEXT_SOURCE_LIMITS.titleChars}
          placeholder="Optional"
          onChange={(event) => setTitle(event.target.value)}
        />
      </SetupField>
      <SetupField id="ce-session-context-note-text" label="Note" help={ABOUT_NOTE}>
        <Input
          id="ce-session-context-note-text"
          type="textarea"
          rows={5}
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
      </SetupField>
      <SetupField id="ce-session-context-note-access" label="Visible to" help={ABOUT_ACCESS}>
        <ContextAccessPicker id="ce-session-context-note-access" value={access} groups={groups} onChange={setAccess} />
      </SetupField>
      <div className={setupStyles.buttonRow}>
        <button type="button" className={setupStyles.button} disabled={busy || !text.trim()} onClick={() => void add()}>
          Add note
        </button>
      </div>
      {status ? (
        <p className={setupStyles.statusText} role="status">
          {status}
        </p>
      ) : null}
    </div>
  );
};

export default SessionContextAddNote;
