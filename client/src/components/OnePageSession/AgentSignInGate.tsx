// The session page's part in signing a person in from a link their AI agent made.
//
// - A link's one-time code (already taken out of the address) is swapped for a sign-in as the agent's account,
//   at once, unless the tab is signed in as someone else: then the person is asked first.
// - While the tab is that account, a notice stays on the page saying whose account it is and who else can use
//   it, with a way out. It can't be closed while the agent still has access.
// - A passkey attached to the account opens it again: after a reload, or when the passkey's own sign-in to this
//   session says so. The page never raises a passkey prompt for this by itself.
import React, { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';

import { resolveWorkerGroupAutoJoinContext } from '../../domains/worker/workerGroupAutoJoinContext';
import {
  isAgentLinkProvider,
  readAgentLinkAccount,
  subscribeAgentLinkAccount,
  takeLinkedAgentAccountHint,
} from '../../utilities/session/agentLinkAccount';
import {
  dropAgentSignInCode,
  exchangeHeldAgentSignInCode,
  hasAgentSignInCodeFor,
  workerHasAgentSignIn,
} from '../../utilities/session/agentSignIn';
import {
  enterAgentLinkAccount,
  enterThroughAttachedPasskey,
  isAttachedPasskeyKnown,
  resumeAgentLinkAccount,
  staysOnOwnAccount,
} from '../../utilities/session/agentSignInAccount';
import { heldSessionToken } from '../../utilities/worker/workerAuthTokenCache.js';
import AgentAccountAccessPanel, { shortAddress } from '../Account/AgentAccountAccessPanel';
import styles from './WorkerGroupAutoJoinNotice.module.scss';

export type AgentSignInGateProps = { sessionConfig: unknown; sessionSlug: string; account: unknown; provider: unknown };
type Phase = 'idle' | 'ask' | 'working' | 'unsupported' | 'error';

const lower = (value: unknown): string =>
  String(value ?? '')
    .trim()
    .toLowerCase();
const WHO_ELSE =
  'Whoever runs the agent that set this account up can see and change what you answer here. If the link did not come from your own agent, sign out.';

export default function AgentSignInGate({
  sessionConfig,
  sessionSlug,
  account,
  provider,
}: AgentSignInGateProps): React.ReactElement | null {
  const context = useMemo(
    () => resolveWorkerGroupAutoJoinContext(sessionConfig, sessionSlug),
    [sessionConfig, sessionSlug],
  );
  const target = useMemo(
    () =>
      context ? { workerUrl: context.workerUrl, sessionSlug: context.sessionSlug, sessionId: context.sessionId } : null,
    [context?.workerUrl, context?.sessionSlug, context?.sessionId], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const linkAccount = useSyncExternalStore(subscribeAgentLinkAccount, readAgentLinkAccount);
  const [phase, setPhase] = useState<Phase>('idle');
  const [note, setNote] = useState<{ text: string; isError: boolean } | null>(null);
  const [fromLink, setFromLink] = useState(false);
  const signedInAs = lower(account);

  const signIn = useCallback(async () => {
    if (!target) return;
    setPhase('working');
    try {
      enterAgentLinkAccount(target, await exchangeHeldAgentSignInCode(target));
      setFromLink(true);
      setPhase('idle');
    } catch (error) {
      setNote({
        text: error instanceof Error && error.message ? error.message : 'This sign-in link could not be used.',
        isError: true,
      });
      setPhase('error');
    }
  }, [target]);

  // A link's code for this session: use it at once, or ask first when someone is signed in here already.
  useEffect(() => {
    if (!target || !hasAgentSignInCodeFor(target)) return undefined;
    let current = true;
    void workerHasAgentSignIn(target).then((supported) => {
      if (!current || !hasAgentSignInCodeFor(target)) return;
      if (!supported) {
        dropAgentSignInCode();
        setNote({
          text: 'This session can’t sign you in from an agent’s link yet. Ask its organisers, or sign in yourself.',
          isError: true,
        });
        setPhase('unsupported');
        return;
      }
      if (signedInAs) setPhase('ask');
      else void signIn();
    });
    return () => {
      current = false;
    };
    // Asked once per session opened: who is signed in at that moment decides.
  }, [target]); // eslint-disable-line react-hooks/exhaustive-deps

  // After a reload the tab is still the agent's account, while it holds that sign-in.
  useEffect(() => {
    if (target && !signedInAs && !hasAgentSignInCodeFor(target)) resumeAgentLinkAccount(target);
  }, [target, signedInAs]);

  // Signed in with a passkey that is attached to an agent's account here: open that account, quietly.
  const hinted = useSyncExternalStore(subscribeAgentLinkAccount, () =>
    target && signedInAs && !isAgentLinkProvider(provider) ? `${target.sessionSlug}:${signedInAs}` : '',
  );
  useEffect(() => {
    if (!target || !signedInAs || isAgentLinkProvider(provider) || lower(provider) !== 'passkey_eoa') return;
    if (staysOnOwnAccount(target) || hasAgentSignInCodeFor(target)) return;
    const hint = takeLinkedAgentAccountHint(target.sessionSlug, signedInAs);
    if (!hint && !isAttachedPasskeyKnown(target, signedInAs)) return;
    void workerHasAgentSignIn(target).then((supported) => {
      if (!supported) return;
      void enterThroughAttachedPasskey(target, signedInAs, {
        prompt: false,
        passkeyToken: hint?.passkeyToken || '',
      }).catch(() => undefined);
    });
  }, [target, signedInAs, provider, hinted, linkAccount]);

  if (!target) return null;
  const notice = (message: React.ReactNode, actions: React.ReactNode, isError = false): React.ReactElement => (
    <section className={styles.notice} aria-label="Agent’s account" data-testid="ce-agent-sign-in-notice">
      <p className={styles.message} role={isError ? 'alert' : 'status'}>
        {message}
      </p>
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </section>
  );

  if (phase === 'ask') {
    return notice(
      <>
        This link signs you in to <strong>an account an AI agent set up</strong>, in place of the account you are signed
        in as now ({shortAddress(signedInAs)}). Only switch if your own agent gave you the link.
      </>,
      <>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={() => void signIn()}
          data-testid="ce-agent-sign-in-switch"
        >
          Switch to it
        </button>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={() => {
            dropAgentSignInCode();
            setPhase('idle');
          }}
          data-testid="ce-agent-sign-in-stay"
        >
          Stay as I am
        </button>
      </>,
    );
  }
  if (phase === 'working') return notice('Signing you in from your agent’s link…', null);
  if ((phase === 'error' || phase === 'unsupported') && note) {
    return notice(
      note.text,
      <button
        type="button"
        className={styles.secondaryButton}
        onClick={() => {
          setNote(null);
          setPhase('idle');
        }}
      >
        Dismiss
      </button>,
      true,
    );
  }

  const here =
    linkAccount &&
    isAgentLinkProvider(provider) &&
    linkAccount.sessionSlug === target.sessionSlug &&
    linkAccount.address === signedInAs
      ? linkAccount
      : null;
  if (!here) return null;
  const who = <strong title={here.address}>{shortAddress(here.address)}</strong>;
  const ended = !heldSessionToken(target.workerUrl, target.sessionSlug);
  const panel = (
    <AgentAccountAccessPanel
      provider={provider}
      buttonClassName={styles.secondaryButton}
      onMessage={(text, isError) => setNote({ text, isError })}
    />
  );
  const said = note ? <> {note.text}</> : null;
  if (ended && here.via !== 'passkey_link') {
    return notice(
      <>Your sign-in to {who}, the account your AI agent set up, has ended. Ask your agent for a new link.</>,
      panel,
      true,
    );
  }
  if (here.via !== 'passkey_link') {
    return notice(
      <>
        {fromLink ? 'Signed in from your agent’s link. ' : ''}You are signed in as {who}, the account your AI agent set
        up. {WHO_ELSE}
        {said}
      </>,
      panel,
      note?.isError,
    );
  }
  if (here.agentAccess === 'active') {
    return notice(
      <>
        You are using {who}, the account your AI agent set up, with your passkey. Your agent can still use it, and see
        and change what you answer here.{said}
      </>,
      panel,
      note?.isError,
    );
  }
  return notice(
    <>
      You are using {who}, the account your AI agent set up, with your passkey. Your agent’s access is ended.{said}
    </>,
    panel,
    note?.isError,
  );
}
