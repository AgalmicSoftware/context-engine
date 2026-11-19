import { useState } from 'react';
import { Input } from 'reactstrap';

import { contextFileIsReadByAi, resolveContextFileType } from '@ce-shared/sessionContextSources.mjs';
import ContextAccessPicker from '../Sessions/setup/ContextAccessPicker';
import { SetupCheck, SetupField } from '../Sessions/setup/SetupPrimitives';
import setupStyles from '../Sessions/setup/SessionSetup.module.scss';
import {
  checkContextFile,
  contextFileAccept,
  readContextPdf,
  uploadContextFile,
  type ContextFileAccess,
} from '../../utilities/docLibrary/contextSources';
import type { ContextGroup } from '../../utilities/docLibrary/useContextGroups';

type Props = {
  sessionSlug: string;
  sessionConfig: Record<string, unknown> | null;
  account: string;
  groups: ContextGroup[];
  /** Whether the session has Context cards on: it then takes images, and whoever adds a PDF or image may have its AI read it. */
  cardsOn?: boolean;
  onAdded: () => void;
};

const ABOUT_ACCESS =
  'A file locked to groups is for their members and the session’s admins. The session’s AI uses it only when it works for one of them.';
const ABOUT_ANALYZE =
  'Sends the PDF or image to the session’s AI. The text it returns is saved with the file, for everyone who can see the file, and counts as one of your AI uses today. Unticked, the file is kept but gives the AI no text until an admin has it read.';

// A participant's own addition to the session's context: a file, and who may read it.
const SessionContextAddFile = ({ sessionSlug, sessionConfig, account, groups, cardsOn = false, onAdded }: Props) => {
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [access, setAccess] = useState<ContextFileAccess>({});
  const [analyze, setAnalyze] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const problem = file ? checkContextFile(file, { images: cardsOn }) : '';
  const offersAnalyze = cardsOn && !!file && contextFileIsReadByAi(resolveContextFileType(file));
  const add = async () => {
    if (!file || busy) return;
    setBusy(true);
    setStatus('Adding the file…');
    try {
      const options = { sessionSlug, sessionConfig, context: { account } };
      const id = await uploadContextFile({ file, ...access }, options);
      setFile(null);
      setFileKey((key) => key + 1);
      if (!(offersAnalyze && analyze)) {
        setStatus('File added.');
        onAdded();
        return;
      }
      setStatus('File added. The session’s AI is reading it…');
      onAdded();
      try {
        await readContextPdf(id, options);
        setStatus('File added and read by the session’s AI.');
      } catch (failure) {
        setStatus(
          `File added, but the session’s AI could not read it: ${failure instanceof Error ? failure.message : 'an admin can have it read.'}`,
        );
      }
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
          accept={contextFileAccept({ images: cardsOn })}
          onChange={(event) => setFile((event.target as HTMLInputElement).files?.[0] || null)}
        />
      </SetupField>
      {problem ? <p className={setupStyles.errorText}>{problem}</p> : null}
      <SetupField id="ce-session-context-access" label="Visible to" help={ABOUT_ACCESS}>
        <ContextAccessPicker id="ce-session-context-access" value={access} groups={groups} onChange={setAccess} />
      </SetupField>
      {offersAnalyze ? (
        <SetupCheck
          id="ce-session-context-analyze"
          label="Analyze with the session’s AI"
          help={ABOUT_ANALYZE}
          checked={analyze}
          onChange={setAnalyze}
          testId="ce-session-context-analyze"
        />
      ) : null}
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
