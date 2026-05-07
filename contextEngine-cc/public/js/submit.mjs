import { apiLocal } from '/js/api.mjs';
import { getActiveSessions, state } from '/js/state.mjs';
import { escapeHtml, setBadgeCount } from '/js/ui.mjs';

let cachedSubmitSettings = {
  autoSubmitResponses: true,
  submitMode: 'immediate',
  chainName: 'OP Sepolia',
  txExplorerTxBaseUrl: '',
};

function stringifyPendingAnswer(answer) {
  if (Array.isArray(answer)) return answer.join(', ');
  return String(answer || '');
}

function normalizeAutoSubmitResponses(settings = {}) {
  if (typeof settings?.autoSubmitResponses === 'boolean') return settings.autoSubmitResponses;
  return settings?.submitMode !== 'batch';
}

function updateSubmitSubtitle(settings = {}) {
  const subtitle = document.getElementById('submit-subtitle');
  if (!subtitle) return;
  const chainName = String(settings.chainName || cachedSubmitSettings.chainName || 'OP Sepolia').trim();
  subtitle.textContent = `Submit responses to ${chainName} via Arweave`;
}

export function updateModeToggle(mode) {
  const autoSubmitResponses = typeof mode === 'boolean' ? mode : mode !== 'batch';
  document.getElementById('btn-mode-immediate').classList.toggle('active', autoSubmitResponses);
  document.getElementById('btn-mode-batch').classList.toggle('active', !autoSubmitResponses);
}

export async function setSubmitMode(mode) {
  const autoSubmitResponses = typeof mode === 'boolean' ? mode : mode !== 'batch';
  updateModeToggle(autoSubmitResponses);
  cachedSubmitSettings = {
    ...cachedSubmitSettings,
    autoSubmitResponses,
    submitMode: autoSubmitResponses ? 'immediate' : 'batch',
  };
  try {
    await apiLocal('/api/settings', {
      method: 'POST',
      body: JSON.stringify({ autoSubmitResponses }),
    });
  } catch {}
}

export async function loadSubmitScreen() {
  try {
    const settingsData = await apiLocal('/api/settings');
    cachedSubmitSettings = {
      ...cachedSubmitSettings,
      ...settingsData,
      autoSubmitResponses: normalizeAutoSubmitResponses(settingsData),
    };
    updateModeToggle(cachedSubmitSettings.autoSubmitResponses);
    updateSubmitSubtitle(cachedSubmitSettings);
  } catch {}

  try {
    const status = await apiLocal('/api/submit/status');
    const statusSettings = status.settings || {};
    cachedSubmitSettings = {
      ...cachedSubmitSettings,
      ...statusSettings,
      autoSubmitResponses: normalizeAutoSubmitResponses(statusSettings),
    };
    updateSubmitSubtitle(cachedSubmitSettings);
    const parts = [];
    if (cachedSubmitSettings.chainName) {
      parts.push(`Chain: ${cachedSubmitSettings.chainName}`);
    }
    parts.push(`Auto-submit: ${cachedSubmitSettings.autoSubmitResponses ? 'On' : 'Off'}`);
    if (status.hasKey) parts.push('Key: ✓');
    else parts.push('Key: ✕ (re-auth needed)');
    if (status.hasContract) parts.push('Contract: ✓');
    else parts.push('Contract: ✕');
    const statusEl = document.getElementById('submit-status-info');
    statusEl.textContent = parts.join('  ·  ');
    statusEl.className = `status ${status.ready ? 'success' : 'error'}`;
  } catch {}

  await loadPendingList();
}

export async function loadPendingList() {
  const sessions = getActiveSessions();
  let allPending = [];

  for (const slug of sessions) {
    try {
      const data = await apiLocal(`/api/responses/pending?session=${encodeURIComponent(slug)}`);
      if (data.pending) {
        allPending.push(...data.pending.map((response) => ({ ...response, session: slug })));
      }
    } catch {}
  }

  document.getElementById('pending-count').textContent = String(allPending.length);
  setBadgeCount('pending-badge', allPending.length);

  if (allPending.length === 0) {
    document.getElementById('pending-list').innerHTML =
      '<div class="response-item"><span class="response-meta">No pending responses</span></div>';
    state._pendingResponses = [];
    return;
  }

  document.getElementById('pending-list').innerHTML = allPending.map((response) => {
    const answer = stringifyPendingAnswer(response.answer);
    const clippedAnswer = answer.slice(0, 80);
    return `
      <div class="response-item">
        <div class="response-meta">${escapeHtml(String(response.questionId || '').slice(0, 18))}... · ${escapeHtml(response.questionType || 'unknown')}</div>
        <div class="response-answer">${escapeHtml(clippedAnswer)}${answer.length > 80 ? '...' : ''}</div>
        ${response.conviction ? `<div class="response-meta">Conviction: ${escapeHtml(response.conviction)}</div>` : ''}
      </div>
    `;
  }).join('');

  state._pendingResponses = allPending;
}

export async function submitAllResponses() {
  const sessions = getActiveSessions();
  const resultEl = document.getElementById('submit-result');
  const progressEl = document.getElementById('submit-progress');
  const submitButton = document.getElementById('btn-submit-all');

  if (sessions.length === 0) {
    resultEl.textContent = 'No session selected';
    resultEl.className = 'status error';
    return;
  }

  submitButton.disabled = true;
  resultEl.textContent = 'Uploading to Arweave & signing tx...';
  resultEl.className = 'status';
  progressEl.style.width = '30%';

  let totalSubmitted = 0;
  let lastTxHash = '';

  for (const slug of sessions) {
    try {
      const result = await apiLocal('/api/responses/submit-onchain', {
        method: 'POST',
        body: JSON.stringify({ session: slug }),
      });

      if (result.ok) {
        totalSubmitted += result.count || 0;
        lastTxHash = result.txHash || '';
        progressEl.style.width = '100%';
      } else {
        resultEl.textContent = `Error: ${result.error}`;
        resultEl.className = 'status error';
        progressEl.style.width = '0%';
        submitButton.disabled = false;
        return;
      }
    } catch (err) {
      resultEl.textContent = `Error: ${err.message}`;
      resultEl.className = 'status error';
      submitButton.disabled = false;
      return;
    }
  }

  resultEl.textContent = '';
  const submitted = document.createElement('span');
  submitted.className = 'response-submitted';
  submitted.textContent = `✓ Submitted ${totalSubmitted} response(s) on-chain`;
  resultEl.appendChild(submitted);

  const txExplorerTxBaseUrl = String(cachedSubmitSettings.txExplorerTxBaseUrl || '').trim();
  if (lastTxHash && /^0x[a-fA-F0-9]{64}$/.test(lastTxHash) && txExplorerTxBaseUrl) {
    resultEl.appendChild(document.createElement('br'));
    const meta = document.createElement('span');
    meta.className = 'response-meta';
    meta.textContent = 'TX: ';
    const link = document.createElement('a');
    link.href = `${txExplorerTxBaseUrl}${encodeURIComponent(lastTxHash)}`;
    link.target = '_blank';
    link.rel = 'noopener';
    link.className = 'tx-link';
    link.textContent = `${lastTxHash.slice(0, 18)}...`;
    meta.appendChild(link);
    resultEl.appendChild(meta);
  }

  resultEl.className = 'status';
  submitButton.disabled = false;
  await loadPendingList();
}

export async function updatePendingBadge() {
  const sessions = getActiveSessions();
  let count = 0;

  for (const slug of sessions) {
    try {
      const data = await apiLocal(`/api/responses/pending?session=${encodeURIComponent(slug)}`);
      count += data.count || 0;
    } catch {}
  }

  setBadgeCount('pending-badge', count);
}
