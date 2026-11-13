import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { initLogging } from 'utilities/logging.js';
import { initializeRuntimeConfig } from 'utilities/session/runtimeConfig';
import App from 'components/App';
import { removeGroupInviteFromAddress } from './domains/worker/workerGroupAutoJoinIntent';

// A link's group invite leaves the address before the router reads it.
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
