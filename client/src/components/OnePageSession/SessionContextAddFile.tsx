import { useState } from 'react';
import { Input } from 'reactstrap';

import ContextAccessSelect, { SESSION_WIDE_ACCESS, contextAccessOf } from '../Sessions/setup/ContextAccessSelect';
import { SetupField } from '../Sessions/setup/SetupPrimitives';
import setupStyles from '../Sessions/setup/SessionSetup.module.scss';
import { checkContextFile, uploadContextFile } from '../../utilities/docLibrary/contextSources';
import type { ContextGroup } from '../../utilities/docLibrary/useContextGroups';

type Props = {
  sessionSlug: string;
  sessionConfig: Record<string, unknown> | null;
  account: string;
  groups: ContextGroup[];
  onAdded: () => void;
};

const ABOUT_ACCESS =
  'A locked file is for that group’s members and the session’s admins. The session’s AI uses it only when it works for one of them.';

// A participant's own addition to the session's context: a file, and who may read it.
const SessionContextAddFile = ({ sessionSlug, sessionConfig, account, groups, onAdded }: Props) => {
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [access, setAccess] = useState(SESSION_WIDE_ACCESS);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const problem = file ? checkContextFile(file) : '';
  const add = async () => {
    if (!file || busy) return;
    setBusy(true);
    setStatus('Adding the file…');
    try {
      await uploadContextFile(
        { file, ...contextAccessOf(access) },
        { sessionSlug, sessionConfig, context: { account } },
      );
      setFile(null);
      setFileKey((key) => key + 1);
      setStatus('File added.');
      onAdded();
    } catch (failure) {
      setStatus(failure instanceof Error ? failure.message : 'That did not work. Try again.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={setupStyles.listRowBody} data-testid="ce-session-context-add-file">
      <SetupField id="ce-session-context-file" label="File">
        <Input
          key={fileKey}
          id="ce-session-context-file"
          type="file"
          accept=".pdf,.md,.markdown,.txt,.csv,.json,application/pdf,text/markdown,text/plain,text/csv,application/json"
          onChange={(event) => setFile((event.target as HTMLInputElement).files?.[0] || null)}
        />
      </SetupField>
      {problem ? <p className={setupStyles.errorText}>{problem}</p> : null}
      <SetupField id="ce-session-context-access" label="Who can read it" help={ABOUT_ACCESS}>
        <ContextAccessSelect id="ce-session-context-access" value={access} groups={groups} onChange={setAccess} />
      </SetupField>
      <div className={setupStyles.buttonRow}>
        <button
          type="button"
          className={setupStyles.button}
          disabled={busy || !file || !!problem}
          onClick={() => void add()}
        >
          Add file
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

export default SessionContextAddFile;
