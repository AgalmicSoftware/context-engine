import { apiLocal } from '/js/api.mjs';
import { getActiveSessions, state } from '/js/state.mjs';
import { updatePendingBadge } from '/js/submit.mjs';
import { escapeHtml, setHidden, setStatus, show } from '/js/ui.mjs';

export function buildAudienceOptionMarkup(gateOptions, { includeFollow = false } = {}) {
  const options = [];
  if (includeFollow) options.push('<option value="follow">Match Answer</option>');
  options.push('<option value="none">Not encrypted</option>');
  options.push('<option value="self">Only me</option>');
  (Array.isArray(gateOptions) ? gateOptions : []).forEach((gate) => {
    options.push(`<option value="gate:${escapeHtml(gate.gateId)}">${escapeHtml(gate.label || gate.gateId)}</option>`);
  });
  return options.join('');
}

export function buildAnswerControlHtml(question) {
  const q = question || {};
  const type = String(q.type || 'freeform').toLowerCase();
  const options = Array.isArray(q.options) ? q.options : [];

  if (type === 'binary') {
    return `
      <label for="question-answer">Answer</label>
      <select id="question-answer">
        <option value="Agree">Agree</option>
        <option value="Unsure">Unsure</option>
        <option value="Disagree">Disagree</option>
      </select>
    `;
  }

  if (type === 'rating') {
    return `
      <label for="question-answer">Answer</label>
      <input id="question-answer" type="number" min="0" max="10" step="1" placeholder="0-10" />
    `;
  }

  if (type === 'multichoice') {
    const isSingleSelect = !!(q.singleSelect || q.oneSelectionOnly || q.singleChoice);
    return `
      <label for="question-answer">Answer</label>
      <select id="question-answer" ${isSingleSelect ? '' : 'multiple size="4"'}>
        ${options.map((option) => `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`).join('')}
      </select>
      ${isSingleSelect ? '' : '<div class="status">Hold Cmd/Ctrl to choose multiple options.</div>'}
    `;
  }

  return `
    <label for="question-answer">Answer</label>
    <textarea id="question-answer" placeholder="Write your response"></textarea>
  `;
}

export async function showQuestions() {
  const sessions = getActiveSessions();
  const label = sessions.length > 1
    ? `Pulling from ${sessions.length} sessions`
    : `Session: ${sessions[0] || '(default)'}`;
  document.getElementById('questions-session-label').textContent = label;
  show('screen-questions');
  await loadNextQuestion();
}

export async function loadNextQuestion() {
  document.getElementById('question-container').textContent = 'Loading...';
  setStatus('questions-status', '', '');

  const sessions = getActiveSessions();
  if (sessions.length === 0) {
    setStatus('questions-status', 'No sessions selected', 'error');
    return;
  }

  const shuffled = [...sessions].sort(() => Math.random() - 0.5);
  for (const slug of shuffled) {
    try {
      const seen = state.seenIds.join(',');
      const data = await apiLocal(`/api/questions?session=${encodeURIComponent(slug)}&seen=${encodeURIComponent(seen)}`);
      if (data.error) continue;
      const question = data.question;
      if (!question) continue;

      const gateOptions = Array.isArray(data.gateOptions) ? data.gateOptions : [];
      const defaultGateId = String(data.defaultGateId || gateOptions[0]?.gateId || '').trim();
      state.seenIds.push(question.id);
      state.currentSession = slug;
      state.currentQuestion = question;
      state.currentQuestionGateOptions = gateOptions;
      state.currentQuestionDefaultGateId = defaultGateId;

      const optionsHtml = question.options?.length
        ? `<div class="question-options">${question.options.map((option) => `<span>${escapeHtml(option)}</span>`).join('')}</div>`
        : '';
      const defaultAnswerAudienceValue = state.hookConfig?.encryptByDefault
        ? (defaultGateId ? `gate:${defaultGateId}` : 'self')
        : 'none';

      document.getElementById('question-container').innerHTML = `
        <div class="question-card">
          <div class="question-type">${escapeHtml(question.type || 'question')} <span class="question-session-tag">· ${escapeHtml(slug)}</span></div>
          <div class="question-prompt">${escapeHtml(question.prompt || '(no prompt)')}</div>
          ${optionsHtml}
          <div class="response-form">
            ${buildAnswerControlHtml(question)}
            <label for="question-additional">Additional comments</label>
            <textarea id="question-additional" placeholder="Optional context, links, or notes"></textarea>
            <div class="audience-grid">
              <div>
                <label for="question-answer-audience">Answer audience</label>
                <select id="question-answer-audience">
                  ${buildAudienceOptionMarkup(gateOptions)}
                </select>
                <div id="question-answer-gate-wrap" class="gate-wrap is-hidden">
                  <label for="question-answer-gate">Answer gate</label>
                  <select id="question-answer-gate">
                    ${(gateOptions || []).map((gate) => `<option value="${escapeHtml(gate.gateId)}">${escapeHtml(gate.label || gate.gateId)}</option>`).join('')}
                  </select>
                </div>
              </div>
              <div>
                <label for="question-additional-audience">Comments audience</label>
                <select id="question-additional-audience">
                  ${buildAudienceOptionMarkup(gateOptions, { includeFollow: true })}
                </select>
                <div id="question-additional-gate-wrap" class="gate-wrap is-hidden">
                  <label for="question-additional-gate">Comments gate</label>
                  <select id="question-additional-gate">
                    ${(gateOptions || []).map((gate) => `<option value="${escapeHtml(gate.gateId)}">${escapeHtml(gate.label || gate.gateId)}</option>`).join('')}
                  </select>
                </div>
              </div>
            </div>
            <div class="field-note">Gate choices are stored explicitly and sent to the local CC API with the response.</div>
            <button class="btn-primary" id="btn-save-response">Save Response</button>
          </div>
        </div>
      `;

      attachQuestionResponseForm({
        question,
        session: slug,
        defaultGateId,
        defaultAnswerAudienceValue,
      });
      return;
    } catch {}
  }

  document.getElementById('question-container').innerHTML =
    '<div class="question-card"><div class="question-prompt">No questions available across selected sessions.</div></div>';
}

export function attachQuestionResponseForm({ question, session, defaultGateId, defaultAnswerAudienceValue }) {
  const answerAudienceEl = document.getElementById('question-answer-audience');
  const answerGateWrapEl = document.getElementById('question-answer-gate-wrap');
  const answerGateEl = document.getElementById('question-answer-gate');
  const additionalAudienceEl = document.getElementById('question-additional-audience');
  const additionalGateWrapEl = document.getElementById('question-additional-gate-wrap');
  const additionalGateEl = document.getElementById('question-additional-gate');
  const saveButton = document.getElementById('btn-save-response');
  if (!answerAudienceEl || !additionalAudienceEl || !saveButton) return;

  answerAudienceEl.value = defaultAnswerAudienceValue || 'none';
  if (answerGateEl && defaultGateId) answerGateEl.value = defaultGateId;
  additionalAudienceEl.value = 'follow';
  if (additionalGateEl && defaultGateId) additionalGateEl.value = defaultGateId;

  const syncGateVisibility = () => {
    const answerValue = String(answerAudienceEl.value || '');
    const additionalValue = String(additionalAudienceEl.value || '');
    setHidden(answerGateWrapEl, !answerValue.startsWith('gate:'));
    setHidden(additionalGateWrapEl, !additionalValue.startsWith('gate:'));
  };

  syncGateVisibility();
  answerAudienceEl.addEventListener('change', syncGateVisibility);
  additionalAudienceEl.addEventListener('change', syncGateVisibility);

  const parseAudienceSelection = (value, gateSelectEl) => {
    const raw = String(value || '');
    if (raw.startsWith('gate:')) {
      return {
        audience: 'gate',
        gateId: String(gateSelectEl?.value || raw.slice(5) || defaultGateId || '').trim() || null,
      };
    }
    return { audience: raw || 'none', gateId: null };
  };

  saveButton.addEventListener('click', async () => {
    try {
      const answerEl = document.getElementById('question-answer');
      const additionalEl = document.getElementById('question-additional');
      let answerValue = answerEl ? answerEl.value : '';

      if (String(question?.type || '').toLowerCase() === 'multichoice' && answerEl?.multiple) {
        answerValue = Array.from(answerEl.selectedOptions || [])
          .map((option) => String(option?.value || '').trim())
          .filter(Boolean);
      }

      if (String(question?.type || '').toLowerCase() === 'rating') {
        answerValue = String(answerValue || '').trim();
      }

      const isEmptyAnswer = Array.isArray(answerValue)
        ? answerValue.length === 0
        : !String(answerValue || '').trim();
      if (isEmptyAnswer) {
        setStatus('questions-status', 'Answer is required.', 'error');
        return;
      }

      const parsedAnswerAudience = parseAudienceSelection(answerAudienceEl.value, answerGateEl);
      const parsedAdditionalAudience = parseAudienceSelection(additionalAudienceEl.value, additionalGateEl);
      const response = await apiLocal('/api/respond', {
        method: 'POST',
        body: JSON.stringify({
          questionId: question.id,
          session,
          questionType: question.type || 'unknown',
          answer: answerValue,
          additional: additionalEl ? additionalEl.value : '',
          answerEncryptionAudience: parsedAnswerAudience.audience,
          answerEncryptionGateId: parsedAnswerAudience.gateId,
          additionalEncryptionAudience: parsedAdditionalAudience.audience,
          additionalEncryptionGateId: parsedAdditionalAudience.gateId,
        }),
      });

      if (!response || response.error) {
        setStatus('questions-status', response?.error || 'Failed to save response.', 'error');
        return;
      }

      setStatus('questions-status', 'Saved locally for on-chain submission.', 'success');
      await updatePendingBadge();
      await loadNextQuestion();
    } catch (err) {
      setStatus('questions-status', err.message || 'Failed to save response.', 'error');
    }
  });
}
