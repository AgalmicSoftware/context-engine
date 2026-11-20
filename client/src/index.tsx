import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { initLogging } from 'utilities/logging.js';
import { initializeRuntimeConfig } from 'utilities/session/runtimeConfig';
import App from 'components/App';
import { removeGroupInviteFromAddress } from './domains/worker/workerGroupAutoJoinIntent';
import { removeAgentSignInCodeFromAddress, watchAddressForAgentSignInCode } from './utilities/session/agentSignIn';
import { rememberArrivalDrafts } from './utilities/ui/arrivalLink';

// A link's group invite, and a sign-in code from a person's AI agent, leave the address before the router reads
// it and before anything is fetched.
removeAgentSignInCodeFromAddress();
watchAddressForAgentSignInCode();
// The drafts a review link carries are noted for "Copy link" in a browser without passkeys: after a sign-in code
// has left the address, so the copied link can never hold one.
rememberArrivalDrafts();
removeGroupInviteFromAddress();
initializeRuntimeConfig();
initLogging({ showGuide: process.env.NODE_ENV !== 'production' });

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root container #root was not found.');
}

const root = createRoot(container);

root.render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
);
