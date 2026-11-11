import React, { useState } from 'react';
import { Input } from 'reactstrap';

import { MAX_AGENT_INSTRUCTIONS_CHARS } from '@ce-shared/sessionConfigEdits.mjs';
import { SetupField, setupHelpId } from './SetupPrimitives';
import styles from './SessionSetup.module.scss';

const MAX_CHARS = MAX_AGENT_INSTRUCTIONS_CHARS.toLocaleString('en-US');
const HELP =
  'Optional Markdown that AI agents read before taking part, such as which group to join or what to focus on. It adds to the site’s guide for agents. Anyone can read it without signing in, at the Session Worker’s /session-config and /llms.txt, so put nothing private in it.';
const FILE_HELP = `A .md or .txt file of up to ${MAX_CHARS} characters. Its text replaces the instructions above, where you can edit it.`;
const TOO_LONG = `The file is longer than ${MAX_CHARS} characters.`;
const NOT_TEXT = 'This file isn’t plain text saved as UTF-8.';

// FileReader, as the client's other uploads use.
const readFileText = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error || new Error('The file could not be read.'));
    reader.readAsText(file);
  });

type Props = {
  value: string;
  onChange: (value: string) => void;
};

// Admins type the instructions, or load them from a Markdown or text file.
const SetupAgentInstructionsField = ({ value, onChange }: Props): React.ReactElement => {
  const [error, setError] = useState('');
  const load = async (file: File | undefined) => {
    setError('');
    if (!file) return;
    // No character takes more than 4 bytes, so a larger file is too long unread.
    if (file.size > MAX_AGENT_INSTRUCTIONS_CHARS * 4) {
      setError(TOO_LONG);
      return;
    }
    let loaded = '';
    try {
      loaded = await readFileText(file);
    } catch {
      setError('This file couldn’t be read.');
      return;
    }
    // One line break each, as in the box, so CRLF files aren't counted double.
    const text = loaded.replace(/\r\n?/g, '\n');
    // Reading as UTF-8 turns other encodings into U+FFFD; binary files hold NULs.
    if (text.includes('\uFFFD') || text.includes('\u0000')) {
      setError(NOT_TEXT);
      return;
    }
    if (text.length > MAX_AGENT_INSTRUCTIONS_CHARS) {
      setError(TOO_LONG);
      return;
    }
    onChange(text);
  };
  return (
    <>
      <SetupField id="ce-setup-agent-instructions" label="Instructions for AI agents" help={HELP}>
        <Input
          id="ce-setup-agent-instructions"
          type="textarea"
          className={styles.textarea}
          value={value}
          maxLength={MAX_AGENT_INSTRUCTIONS_CHARS}
          aria-describedby={setupHelpId('ce-setup-agent-instructions')}
          data-testid="ce-setup-agent-instructions"
          onChange={(event) => onChange(event.target.value)}
        />
      </SetupField>
      <SetupField id="ce-setup-agent-instructions-file" label="Instructions file" help={FILE_HELP}>
        <Input
          id="ce-setup-agent-instructions-file"
          type="file"
          accept=".md,.txt,text/markdown,text/plain"
          aria-describedby={setupHelpId('ce-setup-agent-instructions-file')}
          data-testid="ce-setup-agent-instructions-file"
          onChange={(event) => {
            const input = event.currentTarget;
            void load(input.files?.[0]).finally(() => {
              input.value = '';
            });
          }}
        />
      </SetupField>
      {error ? (
        <p className={styles.errorText} role="alert" data-testid="ce-setup-agent-instructions-error">
          {error}
        </p>
      ) : null}
    </>
  );
};

export default SetupAgentInstructionsField;
