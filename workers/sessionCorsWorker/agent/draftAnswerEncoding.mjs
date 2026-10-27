import { safeString, lower } from './runtimePrimitives.mjs';
import { answerFromStoredDraft } from './agentDraftEditMetrics.mjs';

export function onChainAnswerFromDraft(draft = {}) {
  // Agent preferences store the normalized typed answer as JSON, including
  // comments. Ordinary chat drafts still store the button's plain value.
  if (draft.source === 'agent_handoff') return answerFromStoredDraft(draft);
  const controlType = safeString(draft.controlType);
  if (controlType === 'rating_button') {
    return {
      questionType: 'rating',
      value: Number(draft.answerValue),
      comments: '',
    };
  }
  if (controlType === 'agree_unsure_disagree') {
    return {
      questionType: 'agree_unsure_disagree',
      value: lower(draft.answerValue || draft.answerLabel),
      label: safeString(draft.answerLabel),
      comments: '',
    };
  }
  if (controlType === 'single_select' || controlType === 'multi_select_toggle') {
    return {
      questionType: 'multichoice',
      values: [safeString(draft.answerValue || draft.answerLabel)].filter(Boolean),
      selectionMode: controlType === 'single_select' ? 'single' : 'multi',
      comments: '',
    };
  }
  return {
    questionType: 'freeform',
    text: safeString(draft.answerValue || draft.answerLabel),
    comments: '',
  };
}
