/** @file SessionAgentUseOption.tsx: in the Context section, whether the Session Agent may use this person's answers and files. */
import { useEffect, useId, useRef, useState } from 'react';

import SessionAgentNotice from './SessionAgentNotice';
import { readSessionAgentStatus, setSessionAgentOptOut } from './sessionAgentRequests';
import styles from './SessionAgentUseOption.module.scss';

type Props = {
  sessionSlug: string;
  sessionConfig: unknown;
  /** Signed in only: someone signed out has no answers or files here to keep out. */
  account: string;
};

// The same stored switch as the Session Agent's own "Use my answers and files": read from the Worker first, and
// saved there at once. Nothing else is stored here, and nothing that names them is added.
const SessionAgentUseOption = ({ sessionSlug, sessionConfig, account }: Props) => {
  const id = `ce-session-agent-use-${useId().replace(/:/g, '')}`;
  const [turnedOff, setTurnedOff] = useState(false);
  // Until the stored choice is read the box can't say it, so it waits; unread, it isn't shown.
  const [read, setRead] = useState<'pending' | 'done' | 'failed'>('pending');
  const [allowed, setAllowed] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  // Read when a request is sent, so a config object rebuilt on each render asks nothing again.
  const options = useRef({ sessionSlug, sessionConfig, account });
  options.current = { sessionSlug, sessionConfig, account };
  // A save made since the last read is newer than it.
  const savedSinceRead = useRef(false);

  useEffect(() => {
    // Another person signing in starts from their own stored choice, never the last person's.
    setAllowed(true);
    setTurnedOff(false);
    setError('');
    setRead('pending');
    savedSinceRead.current = false;
    if (!account) return undefined;
    let current = true;
    readSessionAgentStatus(options.current).then(
      (status) => {
        if (!current) return;
        setTurnedOff(!status.on);
        if (!savedSinceRead.current) setAllowed(!status.optedOut);
        setRead('done');
      },
      // The Session Agent's own dialog still has the switch.
      () => {
        if (current) setRead('failed');
      },
    );
    return () => {
      current = false;
    };
  }, [account, sessionSlug]);

  if (!account || turnedOff || read === 'failed') return null;

  const change = async (next: boolean) => {
    const saver = options.current.account;
    setAllowed(next);
    setSaving(true);
    setError('');
    try {
      const optedOut = await setSessionAgentOptOut(!next, options.current);
      if (options.current.account !== saver) return;
      savedSinceRead.current = true;
      setAllowed(!optedOut);
    } catch {
      if (options.current.account !== saver) return;
      // It shows what the Worker still holds, not the change that failed.
      setAllowed(!next);
      setError('Not saved. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <span className={styles.option}>
      <label htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          checked={allowed}
          disabled={saving || read === 'pending'}
          onChange={(event) => void change(event.target.checked)}
          data-testid="ce-session-agent-use-option"
        />
        Session Agent may use my answers and files
      </label>
      <SessionAgentNotice id={`${id}-notice`} where="switch" className={styles.help} />
      {error ? <span role="alert">{error}</span> : null}
    </span>
  );
};

export default SessionAgentUseOption;
