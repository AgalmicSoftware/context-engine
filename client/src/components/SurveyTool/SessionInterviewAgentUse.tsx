/** @file SessionInterviewAgentUse.tsx: at the foot of the interview dialog, whether the Session Agent may use this person's answers and files. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Input, Label } from 'reactstrap';

import { sessionAgentSettingOf } from '@ce-shared/sessionAgent.mjs';
import SessionAgentNotice from '../OnePageSession/SessionAgentNotice';
import { readSessionAgentStatus, setSessionAgentOptOut } from '../OnePageSession/sessionAgentRequests';
import styles from './SessionInterviewResearchConsent.module.scss';

/** Why a submit stopped: the choice is saved before any answer is, and it couldn't be. */
export const AGENT_USE_NOT_SAVED = 'Your Session Agent choice couldn’t be saved, so nothing was submitted. Try again.';

export type SessionAgentUse = {
  /** While the session's Session Agent is on. */
  shown: boolean;
  allowed: boolean;
  saving: boolean;
  error: string;
  change: (allowed: boolean) => void;
  /**
   * True when the Worker already holds their choice; otherwise saves it, giving false when it couldn't, so no
   * answer is submitted ahead of it.
   */
  settle: () => true | Promise<boolean>;
};

type Options = {
  sessionSlug: string;
  sessionConfig: unknown;
  account: string;
  /** While the dialog shows; each opening reads what the Worker holds again. */
  active: boolean;
};

// The same stored switch as the Session Agent's own "Use my answers and files". Signed in, a change is saved at
// once. Made before sign-in it is held and saved as soon as they have signed in; `settle` makes sure of it, and
// tries a failed save again, before any answer is stored.
export const useSessionAgentUse = ({ sessionSlug, sessionConfig, account, active }: Options): SessionAgentUse => {
  const setting = (sessionConfig as { sessionAgent?: unknown } | null)?.sessionAgent;
  const [turnedOff, setTurnedOff] = useState(false);
  const [allowed, setAllowed] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  // Read when a request is sent, so a config object rebuilt on each render asks nothing again.
  const options = useRef({ sessionSlug, sessionConfig, account });
  options.current = { sessionSlug, sessionConfig, account };
  const configured = Boolean(sessionAgentSettingOf(setting));
  const on = configured && !turnedOff;
  // What they want, whether that is a choice made here that the Worker doesn't hold yet, and what the Worker
  // holds once that is known.
  const wanted = useRef(true);
  const unsaved = useRef(false);
  const stored = useRef<boolean | null>(null);
  const signedInAs = useRef('');

  const save = useCallback(async () => {
    const target = wanted.current;
    const { account: saver } = options.current;
    setSaving(true);
    setError('');
    try {
      const kept = !(await setSessionAgentOptOut(!target, options.current));
      // Someone else has signed in since: this was the last person's choice, not theirs.
      if (options.current.account !== saver) return false;
      stored.current = kept;
      if (kept === wanted.current) unsaved.current = false;
      return kept === target;
    } catch {
      if (options.current.account === saver) setError('Not saved. Try again.');
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  useEffect(() => {
    // Another person signing in starts from their own stored choice, never the last person's.
    if (signedInAs.current && signedInAs.current !== account) {
      unsaved.current = false;
      wanted.current = true;
      setAllowed(true);
      setError('');
    }
    signedInAs.current = account;
    stored.current = null;
    if (!configured || !account || !active) return undefined;
    // A choice held from before sign-in is saved now, whichever way their answers are then submitted.
    if (unsaved.current) void save();
    let current = true;
    readSessionAgentStatus(options.current).then(
      (status) => {
        if (!current) return;
        setTurnedOff(!status.on);
        // A save made here meanwhile is newer than this read.
        if (stored.current !== null) return;
        stored.current = !status.optedOut;
        if (unsaved.current) return;
        wanted.current = stored.current;
        setAllowed(stored.current);
      },
      // Unread, the box keeps what it shows, and a change made here is still saved.
      () => {},
    );
    return () => {
      current = false;
    };
  }, [account, active, configured, save, sessionSlug]);

  const settle = useCallback(
    () => (!on || !account || !unsaved.current || stored.current === wanted.current ? true : save()),
    [account, on, save],
  );

  const change = useCallback(
    (next: boolean) => {
      unsaved.current = true;
      wanted.current = next;
      setAllowed(next);
      if (account) void save();
    },
    [account, save],
  );

  return { shown: on, allowed, saving, error, change, settle };
};

type Props = { use: SessionAgentUse; disabled?: boolean; className?: string };

export default function SessionInterviewAgentUse({ use, disabled = false, className }: Props) {
  if (!use.shown) return null;
  return (
    <span className={[styles.researchConsent, className].filter(Boolean).join(' ')}>
      <Label check className={styles.provenanceOption}>
        <Input
          type="checkbox"
          checked={use.allowed}
          disabled={disabled || use.saving}
          onChange={(event) => use.change(event.target.checked)}
          data-testid="ce-interview-session-agent-use"
        />{' '}
        <span>Session Agent may use my answers and files</span>
      </Label>
      <SessionAgentNotice id="ce-interview-session-agent-notice" where="switch" className={styles.researchHelp} />
      {use.error ? <span role="alert">{use.error}</span> : null}
    </span>
  );
}
