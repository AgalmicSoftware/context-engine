import { apiLocal } from '/js/api.mjs';
import { state } from '/js/state.mjs';
import { collectSelectedSessionSlugs } from '/js/sessionSlugs.mjs';
import { escapeHtml, renderSessionPlaceholder, setStatus } from '/js/ui.mjs';

export function getSelectedSessions() {
  return collectSelectedSessionSlugs(document.querySelectorAll('.session-item.selected'));
}

export function toggleSession(el) {
  el.classList.toggle('selected');
  const check = el.querySelector('.session-check');
  if (check) {
    check.textContent = el.classList.contains('selected') ? '✓' : '';
  }
}

export async function loadSessionOptions() {
  const list = document.getElementById('session-list');
  const countEl = document.getElementById('session-count');
  list.innerHTML = renderSessionPlaceholder('Loading...');
  countEl.textContent = '';

  try {
    const data = await apiLocal('/api/sessions');
    const sessions = data.sessions || [];
    if (sessions.length === 0) {
      list.innerHTML = renderSessionPlaceholder('No sessions found');
      return;
    }

    countEl.textContent = `(${sessions.length})`;
    const selectedSessions = new Set(state.selectedSessions || []);
    list.innerHTML = sessions.map((slug) => {
      const isSelected = selectedSessions.has(slug);
      return `<div class="session-item${isSelected ? ' selected' : ''}" data-slug="${escapeHtml(slug)}" tabindex="0">`
        + `<span class="session-check">${isSelected ? '✓' : ''}</span>`
        + `<span class="session-name">${escapeHtml(slug || '(default)')}</span></div>`;
    }).join('');

    list.querySelectorAll('.session-item[data-slug]').forEach((el) => {
      el.addEventListener('click', () => toggleSession(el));
      el.addEventListener('keydown', (event) => {
        if (event.key === ' ' || event.key === 'Enter') {
          event.preventDefault();
          toggleSession(el);
        }
      });
    });
  } catch (err) {
    list.innerHTML = renderSessionPlaceholder('Failed to load');
    setStatus('session-auth-status', err.message, 'error');
  }
}

export async function loadSessions({ onSelectSession } = {}) {
  const sessionsList = document.getElementById('sessions-list');
  sessionsList.textContent = 'Loading...';

  try {
    const data = await apiLocal('/api/sessions');
    if (data.error) {
      sessionsList.innerHTML = `<span class="error">${escapeHtml(data.error)}</span>`;
      return;
    }

    const sessions = data.sessions || [];
    if (sessions.length === 0) {
      sessionsList.textContent = 'No sessions found on registry.';
      return;
    }

    const selected = new Set(state.selectedSessions);
    sessionsList.innerHTML = sessions.map((slug) => {
      const activeClass = selected.has(slug) ? ' session-btn-active' : '';
      return `<button class="btn-secondary btn-small session-btn${activeClass}" data-slug="${escapeHtml(slug)}">${escapeHtml(slug || '(default)')}</button>`;
    }).join('');

    sessionsList.querySelectorAll('.session-btn').forEach((button) => {
      button.addEventListener('click', () => {
        state.currentSession = button.dataset.slug;
        state.seenIds = [];
        if (typeof onSelectSession === 'function') {
          onSelectSession(button.dataset.slug);
        }
      });
    });
  } catch (err) {
    sessionsList.innerHTML = `<span class="error">${escapeHtml(err.message)}</span>`;
  }
}
