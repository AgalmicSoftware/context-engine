export function show(screenId) {
  document.querySelectorAll('.screen').forEach((screen) => {
    screen.classList.toggle('active', screen.id === screenId);
  });
}

export function setStatus(id, msg, type = '') {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.className = `status${type ? ` ${type}` : ''}`;
}

export function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function setHidden(target, hidden = true) {
  const el = typeof target === 'string' ? document.getElementById(target) : target;
  if (!el) return;
  el.classList.toggle('is-hidden', hidden);
}

export function setBadgeCount(target, count) {
  const el = typeof target === 'string' ? document.getElementById(target) : target;
  if (!el) return;
  const numericCount = Number(count) || 0;
  el.textContent = String(numericCount);
  setHidden(el, numericCount <= 0);
}

export function renderSessionPlaceholder(message) {
  return `<div class="session-item session-item-placeholder"><span class="session-name">${escapeHtml(message)}</span></div>`;
}
