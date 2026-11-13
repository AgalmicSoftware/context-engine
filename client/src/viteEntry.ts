import './browserGlobals';
import { clearBootReloadMarker, renderBootFailure } from './bootRecovery.js';
import { initializeThemeRuntime } from './utilities/ui/themeRuntime';
import { initializeColorVisionRuntime } from './utilities/ui/colorVisionRuntime';
import 'assets/css/contextEngine.scss';

// index.html's note for AI agents is for a fetcher that runs no scripts. It goes before the app loads, so
// nobody using the app hears it read out or tabs to its link, even when startup fails.
document.getElementById('ce-agent-note')?.remove();

initializeThemeRuntime();
initializeColorVisionRuntime();
// No vite:preloadError reload here: it fires on the first failed attempt, before
// retry helpers run. Error boundaries recover once an import has really failed.

// Keep the app import dynamic so browser globals are available before app modules run.
import('./index')
  .then(() => {
    clearBootReloadMarker();
  })
  .catch((error) => {
    console.error('[boot] App startup failed', error);
    renderBootFailure(error);
  });
