// "Sign Agents Out", for the "Your AI agent" menu of the account dialog: ends every prompt and key the person
// copied for an agent in this tab, and says to copy a new one to let an agent in again (see signAgentsOut.ts).
//
// Offered only to a person signed in with their passkey: the page then signs in to the session again by itself,
// so they are not left signed out. A browser wallet would have to be asked to sign again, and an account an AI
// agent set up has no such key to end; neither is offered it.
import React, { useState } from 'react';

import { signAgentsOut } from '../../utilities/session/signAgentsOut';

export const SIGN_AGENTS_OUT_HELP =
  'Ends every prompt and key you copied for an AI agent in this tab, for this session. You stay signed in. To let an agent in again, copy a new prompt from Your AI agent. A prompt you copied in another tab or on another device has to be ended there; left alone, it runs out within four hours.';

type Props = {
  provider: unknown;
  sessionSlug: string;
  buttonClassName?: string;
  // After the agents are signed out: a key the menu still shows is dead, and should go.
  onDone?: () => void;
};

export default function SignAgentsOutControl({
  provider,
  sessionSlug,
  buttonClassName = '',
  onDone,
}: Props): React.ReactElement | null {
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<{ text: string; isError: boolean } | null>(null);
  if (provider !== 'passkey_eoa') return null;
  const run = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    try {
      await signAgentsOut(sessionSlug);
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
