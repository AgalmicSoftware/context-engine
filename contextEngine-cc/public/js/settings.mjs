import { apiLocal } from '/js/api.mjs';

export async function loadSettingsScreen() {
  try {
    const config = await apiLocal('/api/config');
    document.getElementById('set-auto-cli').checked = config.autoCli !== false;
    document.getElementById('set-encrypt-default').checked = !!config.encryptByDefault;
    document.getElementById('set-ai-suggest').checked = config.aiSuggestFreeform !== false;
    document.getElementById('set-allow-reanswer').checked = config.allowReanswer === true || config.allowReanswer === 'true';
    document.getElementById('set-show-importance').checked = !!config.showImportance;
    document.getElementById('set-auto-submit-login').checked = config.autoSubmitOnLogin !== false;
    document.getElementById('set-surfacing-mode').value = config.questionSurfacingMode || 'manual';
    document.getElementById('set-ambient-interruptions').checked = !!config.ambientInterruptions;
    document.getElementById('set-statusline-question-hints').checked = config.statuslineQuestionHints !== false;
    syncSurfacingControls();
    const cooldown = Math.round((config.cooldownMs || 45000) / 1000);
    document.getElementById('set-cooldown').value = cooldown;
    document.getElementById('set-cooldown-val').textContent = `${cooldown}s`;
  } catch {}
}

function syncSurfacingControls() {
  const mode = document.getElementById('set-surfacing-mode').value || 'manual';
  const ambientInterruptions = document.getElementById('set-ambient-interruptions');
  ambientInterruptions.disabled = mode !== 'ambient';
  if (mode !== 'ambient') ambientInterruptions.checked = false;
}

export function bindSettingsControls() {
  document.getElementById('set-cooldown').addEventListener('input', (event) => {
    document.getElementById('set-cooldown-val').textContent = `${event.target.value}s`;
  });
  document.getElementById('set-surfacing-mode').addEventListener('change', syncSurfacingControls);
}

export async function saveSettings() {
  const payload = {
    autoCli: document.getElementById('set-auto-cli').checked,
    encryptByDefault: document.getElementById('set-encrypt-default').checked,
    aiSuggestFreeform: document.getElementById('set-ai-suggest').checked,
    allowReanswer: document.getElementById('set-allow-reanswer').checked,
    showImportance: document.getElementById('set-show-importance').checked,
    autoSubmitOnLogin: document.getElementById('set-auto-submit-login').checked,
    questionSurfacingMode: document.getElementById('set-surfacing-mode').value || 'manual',
    ambientInterruptions: document.getElementById('set-ambient-interruptions').checked,
    statuslineQuestionHints: document.getElementById('set-statusline-question-hints').checked,
    cooldownMs: Number(document.getElementById('set-cooldown').value) * 1000,
  };

  await apiLocal('/api/config', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  return payload;
}
