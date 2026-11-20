// The session page's part in signing a person in from a link their AI agent made.
//
// - A link's one-time code (already taken out of the address) is swapped for a sign-in as the agent's account,
//   at once, unless that would replace someone: an account signed in here, an agent's account the tab still
//   holds, or a passkey this browser would sign back in. Then the person is asked first. Who is here is read
//   when the answer is needed, and again when the sign-in comes back, never from an earlier render.
// - While the tab is that account, a notice stays on the page saying whose account it is and who else can use
//   it, with a way out. It can't be closed while the agent still has access.
// - A passkey attached to the account opens it again: after a reload, or when the passkey's own sign-in to this
//   session says so. The page never raises a passkey prompt for this by itself.
import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';

import { agentSignInLinksOn } from '@ce-shared/agentSignIn.mjs';

import { resolveWorkerGroupAutoJoinContext } from '../../domains/worker/workerGroupAutoJoinContext';
import {
  dismissAttachedPasskeyNotice,
  holdAgentLinkAccount,
  isAgentLinkProvider,
  readAttachedPasskeyNotice,
  readAgentLinkAccount,
  readLinkedAgentAccountHintCount,
  subscribeAgentLinkAccount,
  takeLinkedAgentAccountHint,
} from '../../utilities/session/agentLinkAccount';
import {
  type AgentSignInReply,
  detachAgentPasskey,
  dropAgentSignInCode,
  exchangeHeldAgentSignInCode,
  hasAgentSignInCodeFor,
  readAgentSignInCodeArrivals,
  readAgentSignInState,
  subscribeAgentSignInCode,
  workerHasAgentSignIn,
} from '../../utilities/session/agentSignIn';
import {
  enterAgentLinkAccount,
  enterThroughAttachedPasskey,
  isAttachedPasskeyKnown,
  liveAccount,
  resumeAgentLinkAccount,
  stayOnOwnAccount,
  staysOnOwnAccount,
  whoALinkWouldReplace,
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
  const attached = useSyncExternalStore(subscribeAgentLinkAccount, () =>
    readAttachedPasskeyNotice(target, String(account ?? '')),
  );
  // A code can arrive without a page load (a link pasted into this tab), and leaves when used or dropped.
  const codeArrivals = useSyncExternalStore(subscribeAgentSignInCode, readAgentSignInCodeArrivals);
  const [phase, setPhase] = useState<Phase>('idle');
  const [note, setNote] = useState<{ text: string; isError: boolean } | null>(null);
  const [fromLink, setFromLink] = useState(false);
  // Whose place the link's sign-in would take, shown when asking.
  const [replaces, setReplaces] = useState('');
  // A sign-in already made from the link, held while the person is asked: the code works once.
  const pending = useRef<AgentSignInReply | null>(null);
  const working = useRef(false);
  // The passkey's own account is open, and the passkey is attached to an agent's account here.
  const [offer, setOffer] = useState('');
  // A passkey the Worker says is attached to the account a link signed in to.
  const [attachedHere, setAttachedHere] = useState('');
  const signedInAs = lower(account);

  const fail = useCallback((error: unknown): void => {
    setNote({
      text: error instanceof Error && error.message ? error.message : 'This sign-in link could not be used.',
      isError: true,
    });
    setPhase('error');
  }, []);
  const enter = useCallback(
    (reply: AgentSignInReply): void => {
      if (!target) return;
      pending.current = null;
      enterAgentLinkAccount(target, reply);
      setFromLink(true);
      setPhase('idle');
    },
    [target],
  );
  // `agreed`: the person said to switch. Without it, an account that appeared while the Worker answered is not
  // replaced: the sign-in is held and the person asked.
  const signIn = useCallback(
    async ({ agreed }: { agreed: boolean }) => {
      if (!target || working.current) return;
      working.current = true;
      setPhase('working');
      try {
        const reply = pending.current || (await exchangeHeldAgentSignInCode(target));
        const now = liveAccount();
        if (!agreed && now && now !== reply.address) {
          pending.current = reply;
          setReplaces(now);
          setPhase('ask');
        } else enter(reply);
      } catch (error) {
        fail(error);
      } finally {
        working.current = false;
      }
    },
    [target, enter, fail],
  );

  // A link's code for this session: use it at once, or ask first when it would replace someone.
  useEffect(() => {
    // Another session, or another link: whatever was being asked or said belongs to the last one.
    pending.current = null;
    setPhase('idle');
    setNote(null);
    if (!target || !hasAgentSignInCodeFor(target)) return undefined;
    let current = true;
    void workerHasAgentSignIn(target)
      .then(async (supported) => {
        if (!current || !hasAgentSignInCodeFor(target)) return;
        if (!supported || !agentSignInLinksOn(sessionConfig)) {
          dropAgentSignInCode();
          setNote({
            text: supported
              ? 'This session has sign-in links from agents switched off. Sign in yourself to take part.'
              : 'This session can’t sign you in from an agent’s link yet. Ask its organisers, or sign in yourself.',
            isError: true,
          });
          setPhase('unsupported');
          return;
        }
        const who = await whoALinkWouldReplace();
        if (!current || !hasAgentSignInCodeFor(target)) return;
        if (who) {
          setReplaces(who);
          setPhase('ask');
        } else void signIn({ agreed: false });
      })
      .catch(fail);
    return () => {
      current = false;
    };
    // Run when a session is opened or a link's code arrives. Who is here is read inside, when it matters.
  }, [target, codeArrivals]); // eslint-disable-line react-hooks/exhaustive-deps

  // After a reload the tab is still the agent's account, while it holds that sign-in.
  useEffect(() => {
    if (target && !signedInAs && !hasAgentSignInCodeFor(target)) resumeAgentLinkAccount(target);
  }, [target, signedInAs, codeArrivals]);

  // Signed in with a passkey that is attached to an agent's account here: open that account, quietly where the
  // passkey's own sign-in is in hand or the passkey is unlocked; otherwise say so and offer it. The page never
  // raises a passkey prompt by itself. The Worker's word of it can come after the page settled, so it is counted.
  const hints = useSyncExternalStore(subscribeAgentLinkAccount, readLinkedAgentAccountHintCount);
  useEffect(() => {
    setOffer('');
    if (!target || !signedInAs || isAgentLinkProvider(provider) || lower(provider) !== 'passkey_eoa') return undefined;
    if (staysOnOwnAccount(target) || hasAgentSignInCodeFor(target)) return undefined;
    const hint = takeLinkedAgentAccountHint(target, signedInAs);
    if (!hint && !isAttachedPasskeyKnown(target, signedInAs)) return undefined;
    let current = true;
    void workerHasAgentSignIn(target).then(async (supported) => {
      if (!supported || !current) return;
      const opened = await enterThroughAttachedPasskey(target, signedInAs, {
        prompt: false,
        passkeyToken: hint?.passkeyToken || '',
      }).catch(() => null);
      // Still the passkey's own account: its person is told the other one is there.
      if (current && !opened && liveAccount() === signedInAs && isAttachedPasskeyKnown(target, signedInAs)) {
        setOffer(signedInAs);
      }
    });
    return () => {
      current = false;
    };
  }, [target, signedInAs, provider, hints, codeArrivals]);

  // What the notice says of the agent's access is the Worker's word, asked when the account is shown: it may have
  // been ended, or allowed again, from another tab or device.
  const heldAddress =
    linkAccount && isAgentLinkProvider(provider) && linkAccount.address === signedInAs ? linkAccount.address : '';
  useEffect(() => {
    if (!target || !heldAddress) return undefined;
    const token = heldSessionToken(target.workerUrl, target.sessionSlug);
    if (!token) return undefined;
    let current = true;
    setAttachedHere('');
    void readAgentSignInState(target, token)
      .then((state) => {
        const account = readAgentLinkAccount();
        if (!current || !account || account.address !== heldAddress || !state.attachedPasskey) return;
        // Someone signed in from a link is told when a passkey can already open this account.
        if (account.via !== 'passkey_link') setAttachedHere(state.attachedPasskey.address);
        if (account.agentAccess !== state.attachedPasskey.agentAccess) {
          holdAgentLinkAccount({ ...account, agentAccess: state.attachedPasskey.agentAccess });
        }
      })
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [target, heldAddress]);

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
        This link signs you in to <strong>an account an AI agent set up</strong>, in place of the account you use here
        now ({shortAddress(replaces || signedInAs)}). Only switch if your own agent gave you the link.
        {pending.current ? ' The link has been used: if you stay, ask your agent for a new one to switch later.' : ''}
      </>,
      <>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={() => void signIn({ agreed: true })}
          data-testid="ce-agent-sign-in-switch"
        >
          Switch to it
        </button>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={() => {
            pending.current = null;
            dropAgentSignInCode();
            setPhase('idle');
            // The agent's account this tab already held, if it was waiting behind the question, is opened again.
            if (!liveAccount()) resumeAgentLinkAccount(target);
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

  // Signed in with the account's own key, and the Worker says a passkey is attached to it: said once, with a way
  // to take it off. A passkey its person never attached lets someone else sign in as them here.
  if (attached && !isAgentLinkProvider(provider)) {
    return notice(
      <>
        A passkey (<span title={attached.passkey}>{shortAddress(attached.passkey)}</span>) is attached to your account
        in this session: whoever holds it can sign in here as you. If you did not attach it, remove it.
        {note ? <> {note.text}</> : null}
      </>,
      <>
        <button
          type="button"
          className={styles.secondaryButton}
          data-testid="ce-agent-attached-remove"
          onClick={() => {
            const token = heldSessionToken(target.workerUrl, target.sessionSlug);
            void detachAgentPasskey(target, token)
              .then(() => {
                dismissAttachedPasskeyNotice();
                setNote(null);
              })
              .catch((error: unknown) =>
                setNote({
                  text: error instanceof Error && error.message ? error.message : 'It could not be removed. Try again.',
                  isError: true,
                }),
              );
          }}
        >
          Remove it
        </button>
        <button
          type="button"
          className={styles.secondaryButton}
          data-testid="ce-agent-attached-keep"
          onClick={dismissAttachedPasskeyNotice}
        >
          It’s mine
        </button>
      </>,
      true,
    );
  }

  // In the passkey's own account, with the passkey attached to an agent's account in this session: answers given
  // here go to this account, not that one, so its person is told and can open the other.
  if (offer && offer === signedInAs && !isAgentLinkProvider(provider) && !staysOnOwnAccount(target)) {
    return notice(
      <>
        This passkey is also attached to <strong>an account your AI agent set up</strong> in this session. You are in
        the passkey’s own account now ({shortAddress(signedInAs)}): what you answer here is kept under it, not under the
        agent’s account.{note ? <> {note.text}</> : null}
      </>,
      <>
        <button
          type="button"
          className={styles.secondaryButton}
          data-testid="ce-agent-offer-open"
          onClick={() => {
            void enterThroughAttachedPasskey(target, offer, { prompt: true })
              .then((opened) => {
                if (opened) setNote(null);
              })
              .catch((error: unknown) =>
                setNote({
                  text: error instanceof Error && error.message ? error.message : 'It could not be opened. Try again.',
                  isError: true,
                }),
              );
          }}
        >
          Open the agent’s account
        </button>
        <button
          type="button"
          className={styles.secondaryButton}
          data-testid="ce-agent-offer-stay"
          onClick={() => {
            stayOnOwnAccount(target);
            setOffer('');
          }}
        >
          Stay here
        </button>
      </>,
      note?.isError,
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
        {attachedHere ? (
          <>
            {' '}
            A passkey (<span title={attachedHere}>{shortAddress(attachedHere)}</span>) is already attached to this
            account: whoever holds it can sign in here as this account. If it isn’t yours, sign out and tell your agent.
          </>
        ) : null}
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
