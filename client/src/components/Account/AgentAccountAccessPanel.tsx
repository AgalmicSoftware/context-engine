// What a person signed in to the account their AI agent set up can do about it: create a passkey for it, where it
// has none, and in the account dialog take that passkey off again. Shown in the session's standing notice and in the account
// dialog; it renders nothing for any other account. Signing out is the account dialog's own Disconnect.
//
// The Worker can also end the agent's access to such an account. The site no longer offers that: it only lets
// the same agent key back in, which is not the "sign agents out, then hand one a new prompt" people expect. An
// account already in that state still gets the way back.
import React, { useEffect, useState, useSyncExternalStore } from 'react';
import {
  isAgentLinkProvider,
  readAgentLinkAccount,
  subscribeAgentLinkAccount,
} from '../../utilities/session/agentLinkAccount';
import {
  attachPasskeyHere,
  changeAgentAccess,
  heldAccountHasPasskey,
  removeAttachedPasskey,
} from '../../utilities/session/agentSignInAccount';

export const shortAddress = (address: string): string => `${address.slice(0, 6)}…${address.slice(-4)}`;

const HELP = {
  passkey:
    'A passkey of your own lets you sign in to this account again without your agent, in this session. Your agent keeps its access.',
  restore:
    'Lets the AI agent that set this account up sign in to it again with its own key. Your passkey keeps working.',
  remove: 'Takes your passkey off this account and signs you out of it. The account is then your agent’s alone again.',
};

type Props = {
  provider: unknown;
  buttonClassName?: string;
  // For the one main action, creating a passkey for the account; the other buttons take `buttonClassName`.
  primaryButtonClassName?: string;
  // Called with what happened, in words, for the notice that shows this panel.
  onMessage?: (message: string, isError: boolean) => void;
  // The notice keeps to the one step a new arrival needs; the account dialog has the rest.
  inNotice?: boolean;
  // Create passkey is offered only where the account has no passkey attached. The notice asks the Worker and
  // says so here; left out, as in the account dialog, the panel asks for itself.
  offerPasskey?: boolean;
};

export default function AgentAccountAccessPanel({
  provider,
  buttonClassName = '',
  primaryButtonClassName = '',
  onMessage,
  inNotice = false,
  offerPasskey,
}: Props): React.ReactElement | null {
  const account = useSyncExternalStore(subscribeAgentLinkAccount, readAgentLinkAccount);
  const [busy, setBusy] = useState('');
  // Where no notice is listening (the account dialog), what happened is said here.
  const [said, setSaid] = useState<{ text: string; isError: boolean } | null>(null);
  const tell = (text: string, isError: boolean): void =>
    onMessage ? onMessage(text, isError) : setSaid({ text, isError });
  // The Worker's word on whether a passkey is attached, where nobody passed it in: undefined while asking.
  const [hasPasskey, setHasPasskey] = useState<boolean | null | undefined>(undefined);
  const asks =
    offerPasskey === undefined && !!account && account.via !== 'passkey_link' && isAgentLinkProvider(provider);
  const askedFor = asks ? account.address : '';
  useEffect(() => {
    if (!askedFor) return undefined;
    let current = true;
    setHasPasskey(undefined);
    void heldAccountHasPasskey().then((has) => {
      if (current) setHasPasskey(has);
    });
    return () => {
      current = false;
    };
  }, [askedFor]);
  if (!account || !isAgentLinkProvider(provider)) return null;
  // Offered once the account is known to have none. Where the Worker can't be asked it is offered too: the
  // Worker refuses a second passkey itself.
  const offer = offerPasskey ?? (hasPasskey !== undefined && hasPasskey !== true);
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
  const button = (
    name: string,
    label: React.ReactNode,
    help: string,
    onClick: () => void,
    main = false,
  ): React.ReactElement => (
    <button
      type="button"
      className={main ? primaryButtonClassName || buttonClassName : buttonClassName}
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
      {!withPasskey && offer
        ? button(
            'add-passkey',
            'Create passkey',
            HELP.passkey,
            run('add-passkey', attachPasskeyHere, 'Your passkey is attached to this account.'),
            true,
          )
        : null}
      {withPasskey && account.agentAccess === 'cancelled'
        ? button(
            'allow',
            'Restore agent access',
            HELP.restore,
            run(
              'allow',
              () => changeAgentAccess('active'),
              'Agent access restored: your agent can sign in to this account again.',
            ),
          )
        : null}
      {withPasskey && account.agentAccess === 'active' && !inNotice
        ? button(
            'remove-passkey',
            'Remove passkey',
            HELP.remove,
            run('remove-passkey', removeAttachedPasskey, 'Your passkey was taken off this account.'),
          )
        : null}
      {said ? (
        <span role={said.isError ? 'alert' : 'status'} data-testid="ce-agent-account-said">
          {said.text}
        </span>
      ) : null}
    </>
  );
}
