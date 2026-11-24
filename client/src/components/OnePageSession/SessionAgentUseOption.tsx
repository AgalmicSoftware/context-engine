/** @file SessionAgentUseOption.tsx: in the Context section, whether the Session Agent may use this person's answers and files, and whether exports carry their address. */
import { useEffect, useId, useRef, useState } from 'react';

import SessionAgentHelp from './SessionAgentHelp';
import { readSessionAgentStatus, setSessionAgentOptOut, setSessionAgentUnattributed } from './sessionAgentRequests';
import { SESSION_AGENT_USE_NOTICE, sessionAgentAddressNotice } from './sessionAgentWording';
import styles from './SessionAgentUseOption.module.scss';

type Props = {
  sessionSlug: string;
  sessionConfig: unknown;
  /** Signed in only: someone signed out has no answers or files here to keep out. */
  account: string;
};

// The person's two stored Session Agent switches, the only place they are set: read from the Worker first, and
// each saved there at once. Nothing else is stored here, and nothing that names them is added.
const SessionAgentUseOption = ({ sessionSlug, sessionConfig, account }: Props) => {
  const id = `ce-session-agent-use-${useId().replace(/:/g, '')}`;
  const [turnedOff, setTurnedOff] = useState(false);
  // Until the stored choice is read the box can't say it, so it waits; unread, it isn't shown.
  const [read, setRead] = useState<'pending' | 'done' | 'failed'>('pending');
  const [allowed, setAllowed] = useState(true);
  // On unless turned off; null where there's no such switch: a Worker without it, or no address to carry.
  const [withAddress, setWithAddress] = useState<boolean | null>(null);
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
    setWithAddress(null);
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
        if (!savedSinceRead.current) {
          setAllowed(!status.optedOut);
          setWithAddress(status.unattributed === null ? null : !status.unattributed);
        }
        setRead('done');
      },
      // Unread, the boxes aren't shown: a reload reads them again.
      () => {
        if (current) setRead('failed');
      },
    );
    return () => {
      current = false;
    };
  }, [account, sessionSlug]);

  if (!account || turnedOff || read === 'failed') return null;

  // A box shows the change at once, then what the Worker saved.
  const change = async (show: (value: boolean) => void, next: boolean, save: () => Promise<boolean>) => {
    const saver = options.current.account;
    show(next);
    setSaving(true);
    setError('');
    try {
      const saved = await save();
      if (options.current.account !== saver) return;
      savedSinceRead.current = true;
      show(saved);
    } catch {
      if (options.current.account !== saver) return;
      // It shows what the Worker still holds, not the change that failed.
      show(!next);
      setError('Not saved. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <span className={styles.option}>
      <span className={styles.pair}>
        <label htmlFor={id}>
          <input
            id={id}
            type="checkbox"
            checked={allowed}
            disabled={saving || read === 'pending'}
            onChange={(event) => {
              const next = event.target.checked;
              void change(setAllowed, next, async () => !(await setSessionAgentOptOut(!next, options.current)));
            }}
            data-testid="ce-session-agent-use-option"
          />
          Session Agent may use my answers and files
        </label>
        <SessionAgentHelp
          id={`${id}-help`}
          label="About using your answers and files"
          text={SESSION_AGENT_USE_NOTICE}
          className={styles.help}
        />
      </span>
      {withAddress === null ? null : (
        <span className={styles.pair}>
          <label htmlFor={`${id}-address`}>
            <input
              id={`${id}-address`}
              type="checkbox"
              checked={withAddress}
              disabled={saving || read === 'pending'}
              onChange={(event) => {
                const next = event.target.checked;
                void change(
                  setWithAddress,
                  next,
                  async () => !(await setSessionAgentUnattributed(!next, options.current)),
                );
              }}
              data-testid="ce-session-agent-include-address"
            />
            Include my address with my answers
          </label>
          <SessionAgentHelp
            id={`${id}-address-help`}
            label="About your address on your answers"
            text={sessionAgentAddressNotice(sessionConfig)}
            className={styles.help}
          />
        </span>
      )}
      {error ? <span role="alert">{error}</span> : null}
    </span>
  );
};

export default SessionAgentUseOption;
