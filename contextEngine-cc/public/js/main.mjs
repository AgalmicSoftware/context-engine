import { apiLocal, persistSessionSelection } from '/js/api.mjs';
import {
  createPasskey,
  ensureLocalToken,
  loginPasskey,
  pluginDir,
  signIntoSession,
  showSessionSelect,
  showTokenScreen,
} from '/js/auth.mjs';
import { loadNextQuestion, showQuestions } from '/js/form.mjs';
import { bindSettingsControls, loadSettingsScreen, saveSettings } from '/js/settings.mjs';
import { loadSessionOptions, loadSessions, getSelectedSessions } from '/js/sessions.mjs';
import { getToken, hydrateBrowserAuthState, resetAuthState, setAuthCredentials, state } from '/js/state.mjs';
import {
  loadSubmitScreen,
  setSubmitMode,
  submitAllResponses,
  updatePendingBadge,
} from '/js/submit.mjs';
import { setStatus, show } from '/js/ui.mjs';

async function completePasskeyLogin(authFn) {
  try {
    const { privateKey, address } = await authFn();
    setAuthCredentials({ walletAddress: address, privateKey });
    state.localJwtResult = null;
    setStatus(
      'auth-status',
      `Connected as ${address}. If this doesn't match your client wallet, sign in again and choose a different passkey.`,
      'success',
    );
    await showSessionSelect({ loadSessionOptions });
  } catch (err) {
    setStatus('auth-status', err.message, 'error');
  }
}

function openSessionsBrowser() {
  show('screen-sessions');
  loadSessions({
    onSelectSession: () => {
      showQuestions();
    },
  });
}

document.getElementById('btn-register').addEventListener('click', () => {
  completePasskeyLogin(createPasskey);
});

document.getElementById('btn-login').addEventListener('click', () => {
  completePasskeyLogin(loginPasskey);
});

document.getElementById('btn-wrong-wallet').addEventListener('click', () => {
  resetAuthState();
  show('screen-auth');
});

document.getElementById('btn-session-auth').addEventListener('click', async () => {
  const selected = getSelectedSessions();
  if (selected.length === 0) {
    setStatus('session-auth-status', 'Select at least one session', 'error');
    return;
  }

  let authed = 0;
  let skipped = 0;
  const errors = [];

  for (let index = 0; index < selected.length; index += 1) {
    const slug = selected[index];
    setStatus('session-auth-status', `Signing into ${index + 1}/${selected.length}: ${slug}...`, '');

    try {
      const urlData = await apiLocal(`/api/session/worker-url?session=${encodeURIComponent(slug)}`);
      if (!urlData.workerUrl) {
        skipped += 1;
        continue;
      }

      const { token } = await signIntoSession(urlData.workerUrl, slug);
      await apiLocal('/api/auth/worker-token', {
        method: 'POST',
        body: JSON.stringify({ session: slug, workerToken: token }),
      });
      authed += 1;
    } catch (err) {
      errors.push(`${slug}: ${err.message}`);
    }
  }

  await ensureLocalToken();

  if (errors.length > 0) {
    setStatus('session-auth-status', `${authed} session sign-ins succeeded, ${errors.length} failed: ${errors[0]}`, 'error');
  } else if (authed === 0 && skipped > 0) {
    setStatus('session-auth-status', 'No session sign-in endpoints were found for the selected sessions. Continuing with the Claude Code token only.', '');
  } else {
    setStatus(
      'session-auth-status',
      `Signed into ${authed} session${authed === 1 ? '' : 's'}${skipped ? `, ${skipped} skipped (no session sign-in endpoint)` : ''}`,
      'success',
    );
  }

  state.selectedSessions = selected;
  await persistSessionSelection(selected);

  const delay = errors.length > 0 ? 3000 : (authed > 0 || skipped > 0 ? 800 : 0);
  window.setTimeout(() => {
    showTokenScreen({ updatePendingBadge });
  }, delay);
});

document.getElementById('btn-skip-session-auth').addEventListener('click', async () => {
  const selected = getSelectedSessions();
  if (selected.length === 0) {
    setStatus('session-auth-status', 'Select at least one session', 'error');
    return;
  }

  try {
    await ensureLocalToken();
    state.selectedSessions = selected;
    await persistSessionSelection(selected);
    await showTokenScreen({ updatePendingBadge });
  } catch (err) {
    setStatus('session-auth-status', err.message, 'error');
  }
});

document.getElementById('btn-copy-token').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(getToken());
    setStatus('link-status', 'Token copied!', 'success');
  } catch {
    setStatus('link-status', 'Copy failed', 'error');
  }
});

document.getElementById('btn-download-token').addEventListener('click', () => {
  const blob = new Blob([getToken()], { type: 'text/plain' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'token.jwt';
  link.click();
  URL.revokeObjectURL(link.href);
  setStatus('link-status', `Downloaded! Move to ${pluginDir()}/.state/`, 'success');
});

document.getElementById('btn-copy-cli').addEventListener('click', async () => {
  const command = `mkdir -p ${pluginDir()}/.state && echo '${getToken()}' > ${pluginDir()}/.state/token.jwt`;
  try {
    await navigator.clipboard.writeText(command);
    setStatus('link-status', 'Manual fallback copied. Prefer the local auto-link flow when it works.', 'success');
  } catch {
    setStatus('link-status', 'Copy failed', 'error');
  }
});

document.getElementById('btn-to-sessions').addEventListener('click', () => {
  if (state.selectedSessions.length > 0) {
    state.seenIds = [];
    showQuestions();
    return;
  }
  openSessionsBrowser();
});

document.getElementById('btn-to-submit').addEventListener('click', () => {
  show('screen-submit');
  loadSubmitScreen();
});

document.getElementById('btn-back-token').addEventListener('click', () => {
  show('screen-token');
});

document.getElementById('btn-refresh-sessions').addEventListener('click', () => {
  openSessionsBrowser();
});

document.getElementById('btn-back-sessions').addEventListener('click', () => {
  openSessionsBrowser();
});

document.getElementById('btn-next-question').addEventListener('click', () => {
  loadNextQuestion();
});

document.getElementById('btn-back-from-submit').addEventListener('click', () => {
  show('screen-token');
});

document.getElementById('btn-refresh-pending').addEventListener('click', () => {
  loadSubmitScreen();
});

document.getElementById('btn-to-settings').addEventListener('click', async () => {
  await loadSettingsScreen();
  show('screen-settings');
});

document.getElementById('btn-back-from-settings').addEventListener('click', () => {
  show('screen-token');
});

bindSettingsControls();

document.getElementById('btn-save-settings').addEventListener('click', async () => {
  try {
    await saveSettings();
    setStatus('link-status', 'Settings saved.', 'success');
    show('screen-token');
  } catch (err) {
    setStatus('link-status', `Failed to save: ${err.message}`, 'error');
  }
});

document.getElementById('btn-mode-immediate').addEventListener('click', () => {
  setSubmitMode('immediate');
});

document.getElementById('btn-mode-batch').addEventListener('click', () => {
  setSubmitMode('batch');
});

window.setSubmitMode = setSubmitMode;

document.getElementById('btn-submit-all').addEventListener('click', () => {
  submitAllResponses();
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

async function bootstrapLinkedSession() {
  const restored = hydrateBrowserAuthState();
  if (!restored.restored || !getToken()) {
    return;
  }

  try {
    const me = await apiLocal('/api/me');
    if (!me?.sub) {
      throw new Error('Missing authenticated subject.');
    }
    state.walletAddress = me.sub;
    state.hookConfig = await apiLocal('/api/config');
    state.selectedSessions = Array.isArray(state.hookConfig?.selectedSessions)
      ? state.hookConfig.selectedSessions.slice()
      : [];
    let hasExpiredTokens = false;
    let authCheckSucceeded = false;
    try {
      const authCheck = await apiLocal('/api/auth/check');
      if (authCheck && typeof authCheck === 'object' && !Array.isArray(authCheck) && !Object.hasOwn(authCheck, 'error') && (authCheck.anyExpired === true || authCheck.anyExpired === false)) {
        hasExpiredTokens = authCheck.anyExpired === true;
        authCheckSucceeded = true;
      }
    } catch {}
    if (hasExpiredTokens) {
      resetAuthState();
      show('screen-auth');
      setStatus(
        'auth-status',
        'Sign in expired. Sign in with your passkey to re-authenticate.',
        'error',
      );
      return;
    }
    await showTokenScreen({
      updatePendingBadge,
      notice: authCheckSucceeded
        ? 'Claude Code already linked on this browser. Press q in Claude Code for a question.'
        : 'Claude Code linked. Sign in status could not be verified.',
      noticeType: authCheckSucceeded ? 'success' : '',
    });
  } catch {
    resetAuthState();
    show('screen-auth');
  }
}

bootstrapLinkedSession().catch(() => {
  resetAuthState();
  show('screen-auth');
});
