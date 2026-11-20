// "Sign Agents Out", for the "Your AI agent" menu of the account dialog: ends every prompt and key the person
// copied for an agent from this tab's sign-in, and says to copy a new one to let an agent in again. It renders
// nothing in an account an AI agent set up, where there is no such key to end (see signAgentsOut.ts).
import React, { useState } from 'react';

import { isAgentLinkProvider } from '../../utilities/session/agentLinkAccount';
import { signAgentsOut, type SignAgentsOutSession } from '../../utilities/session/signAgentsOut';

export const SIGN_AGENTS_OUT_HELP =
  'Ends every prompt and key you copied for an AI agent from this tab’s sign-in to this session. You stay signed in. To let an agent in again, copy a new prompt from Your AI agent. A prompt you copied in another tab or on another device has to be ended there.';

type Props = {
  provider: unknown;
  session: SignAgentsOutSession;
  buttonClassName?: string;
  // After the agents are signed out: a key the menu still shows is dead, and should go.
  onDone?: () => void;
};

export default function SignAgentsOutControl({
  provider,
  session,
  buttonClassName = '',
  onDone,
}: Props): React.ReactElement | null {
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<{ text: string; isError: boolean } | null>(null);
  if (isAgentLinkProvider(provider)) return null;
  const run = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    try {
      await signAgentsOut(session);
      setSaid({
        text: 'Agents signed out. To let one in again, copy a new prompt from Your AI agent.',
        isError: false,
      });
      onDone?.();
    } catch (error) {
      setSaid({
        text: error instanceof Error && error.message ? error.message : 'That could not be done. Try again.',
        isError: true,
      });
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <button
        type="button"
        className={buttonClassName}
        onClick={() => void run()}
        disabled={busy}
        title={SIGN_AGENTS_OUT_HELP}
        data-testid="ce-sign-agents-out"
      >
        {busy ? 'Working…' : 'Sign Agents Out'}
      </button>
      {said ? (
        <span role={said.isError ? 'alert' : 'status'} data-testid="ce-sign-agents-out-said">
          {said.text}
        </span>
      ) : null}
    </>
  );
}
