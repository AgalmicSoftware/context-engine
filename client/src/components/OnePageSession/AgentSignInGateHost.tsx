// Decides whether the page needs the agent's-account notice at all, and only then fetches its code.
//
// The notice (AgentSignInGate) is a file of its own. An ordinary visitor never needs it, and a file that fails to
// load costs the whole page a reload, so it is asked for only when it can matter: a link's sign-in code was taken
// from the address, or something about an agent's account is in play in this tab (see agentAccountInPlay).
//
// What this keeps: the code that puts a tab into an agent's account lives in that same file. So a tab is never in
// an agent's account without the notice being there to say so: where the file can't be had, nobody is signed in
// from a link, and a reload does not reopen a held account.
import React, { Suspense, useEffect, useState, useSyncExternalStore } from 'react';

import { agentAccountInPlay, subscribeAgentLinkAccount } from '../../utilities/session/agentLinkAccount';
import { holdsAgentSignInCode, subscribeAgentSignInCode } from '../../utilities/session/agentSignIn';
import type { AgentSignInGateProps } from './AgentSignInGate';

const AgentSignInGate = React.lazy(() => import('./AgentSignInGate'));

export default function AgentSignInGateHost(props: AgentSignInGateProps): React.ReactElement | null {
  const inPlay = useSyncExternalStore(subscribeAgentLinkAccount, () => agentAccountInPlay(props.provider));
  // A code can also arrive later, when a link is pasted into this tab.
  const codeHeld = useSyncExternalStore(subscribeAgentSignInCode, holdsAgentSignInCode);
  const wanted = inPlay || codeHeld;
  // Once shown it stays for the page's life: the notice decides for itself what, if anything, to say.
  const [mounted, setMounted] = useState(wanted);
  useEffect(() => {
    if (wanted) setMounted(true);
  }, [wanted]);
  if (!mounted && !wanted) return null;
  return (
    <Suspense fallback={null}>
      <AgentSignInGate {...props} />
    </Suspense>
  );
}
