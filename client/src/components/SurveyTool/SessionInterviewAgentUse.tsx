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

type Options = { sessionSlug: string; sessionConfig: unknown; account: string };

// The same stored switch as the Session Agent's own "Use my answers and files". Signed in, a change is saved at
// once; before sign-in it is held, and `settle` saves it once they are, ahead of their answers. A save that
// failed is tried again by `settle`.
export const useSessionAgentUse = ({ sessionSlug, sessionConfig, account }: Options): SessionAgentUse => {
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
  // What they want, whether they chose it here, and what the Worker holds once that is known.
  const wanted = useRef(true);
  const chosen = useRef(false);
  const stored = useRef<boolean | null>(null);

  useEffect(() => {
    stored.current = null;
    if (!configured || !account) return undefined;
    let current = true;
    readSessionAgentStatus(options.current).then(
      (status) => {
        if (!current) return;
        setTurnedOff(!status.on);
        // A save made here meanwhile is newer than this read.
        if (stored.current !== null) return;
        stored.current = !status.optedOut;
        if (chosen.current) return;
        wanted.current = stored.current;
        setAllowed(stored.current);
      },
      // Unread, the box keeps its default, and a change made here is still saved.
      () => {},
    );
    return () => {
      current = false;
    };
  }, [account, configured, sessionSlug]);

  const save = useCallback(async () => {
    const target = wanted.current;
    setSaving(true);
    setError('');
    try {
      stored.current = !(await setSessionAgentOptOut(!target, options.current));
      return stored.current === target;
    } catch {
      setError('Not saved. Try again.');
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  const settle = useCallback(
    () => (!on || !account || !chosen.current || stored.current === wanted.current ? true : save()),
    [account, on, save],
  );

  const change = useCallback(
    (next: boolean) => {
      chosen.current = true;
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
