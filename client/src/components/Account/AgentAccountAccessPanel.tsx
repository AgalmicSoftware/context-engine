// What a person signed in to the account their AI agent set up can do about it: attach a passkey, end or
// restore the agent's access, take the passkey off, go back to their own account, sign out. Shown in the
// session's standing notice and under "Your AI agent" in the account dialog; it renders nothing for any other
// account.
import React, { useState, useSyncExternalStore } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFingerprint } from '@fortawesome/free-solid-svg-icons';

import {
  isAgentLinkProvider,
  readAgentLinkAccount,
  subscribeAgentLinkAccount,
} from '../../utilities/session/agentLinkAccount';
import {
  attachPasskeyHere,
  changeAgentAccess,
  leaveAgentLinkAccount,
  removeAttachedPasskey,
  switchToOwnPasskeyAccount,
} from '../../utilities/session/agentSignInAccount';

export const shortAddress = (address: string): string => `${address.slice(0, 6)}…${address.slice(-4)}`;

const HELP = {
  passkey:
    'A passkey of your own lets you sign in to this account again without your agent, in this session. Your agent keeps its access until you cancel it.',
  existing:
    'Attaches a passkey you already use. If that passkey has an account of its own in this session, that account stays separate and nothing is merged; you can switch back to it.',
  cancel:
    'Ends your AI agent’s access to this account in this session: its sign-in is refused, every sign-in it had stops, and its unused links stop working. You can allow it again. From then on your passkey is the only way in: if you lose it, only the session’s admins can restore access.',
  remove: 'Takes your passkey off this account and signs you out of it. The account is then your agent’s alone again.',
  own: 'Goes back to the account your passkey has by itself in this session, for this tab.',
};

type Props = {
  provider: unknown;
  buttonClassName?: string;
  // Called with what happened, in words, for the notice that shows this panel.
  onMessage?: (message: string, isError: boolean) => void;
};

export default function AgentAccountAccessPanel({
  provider,
  buttonClassName = '',
  onMessage,
}: Props): React.ReactElement | null {
  const account = useSyncExternalStore(subscribeAgentLinkAccount, readAgentLinkAccount);
  const [busy, setBusy] = useState('');
  // Where no notice is listening (the account dialog), what happened is said here.
  const [said, setSaid] = useState<{ text: string; isError: boolean } | null>(null);
  const tell = (text: string, isError: boolean): void =>
    onMessage ? onMessage(text, isError) : setSaid({ text, isError });
  if (!account || !isAgentLinkProvider(provider)) return null;
  const target = { workerUrl: account.workerUrl, sessionSlug: account.sessionSlug, sessionId: account.sessionId };
  const run = (name: string, work: () => Promise<unknown>, done: string) => async (): Promise<void> => {
    if (busy) return;
    setBusy(name);
    try {
      await work();
      tell(done, false);
    } catch (error) {
      tell(error instanceof Error && error.message ? error.message : 'That could not be done. Try again.', true);
    } finally {
      setBusy('');
    }
  };
  const button = (name: string, label: React.ReactNode, help: string, onClick: () => void): React.ReactElement => (
    <button
      type="button"
      className={buttonClassName}
      onClick={onClick}
      disabled={!!busy}
      title={help}
      data-testid={`ce-agent-account-${name}`}
    >
      {busy === name ? 'Working…' : label}
    </button>
  );
  const withPasskey = account.via === 'passkey_link';
  return (
    <>
      {!withPasskey
        ? button(
            'add-passkey',
            'Create passkey',
            HELP.passkey,
            run(
              'add-passkey',
              () => attachPasskeyHere({ useExisting: false }),
              'Your passkey is attached to this account.',
            ),
          )
        : null}
      {!withPasskey
        ? button(
            'use-passkey',
            <>
              <FontAwesomeIcon icon={faFingerprint} /> I already have one
            </>,
            HELP.existing,
            run(
              'use-passkey',
              () => attachPasskeyHere({ useExisting: true }),
              'Your passkey is attached to this account.',
            ),
          )
        : null}
      {withPasskey && account.agentAccess === 'active'
        ? button(
            'cancel',
            'Cancel all agent authorizations',
            HELP.cancel,
            run('cancel', () => changeAgentAccess('cancelled'), 'Your agent’s access to this account is ended.'),
          )
        : null}
      {withPasskey && account.agentAccess === 'cancelled'
        ? button(
            'allow',
            'Let my agent sign in again',
            HELP.cancel,
            run('allow', () => changeAgentAccess('active'), 'Your agent can sign in to this account again.'),
          )
        : null}
      {withPasskey && account.agentAccess === 'active'
        ? button(
            'remove-passkey',
            'Remove passkey',
            HELP.remove,
            run('remove-passkey', removeAttachedPasskey, 'Your passkey was taken off this account.'),
          )
        : null}
      {withPasskey
        ? button(
            'own-account',
            'Use my own account',
            HELP.own,
            run('own-account', () => switchToOwnPasskeyAccount(target), 'You are in your own account.'),
          )
        : null}
      {button('sign-out', 'Sign out', 'Signs this browser out.', run('sign-out', leaveAgentLinkAccount, 'Signed out.'))}
      {said ? (
        <span role={said.isError ? 'alert' : 'status'} data-testid="ce-agent-account-said">
          {said.text}
        </span>
      ) : null}
    </>
  );
}
