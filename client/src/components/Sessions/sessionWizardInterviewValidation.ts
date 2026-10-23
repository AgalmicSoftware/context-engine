import { validInterviewSettings } from '../../../../shared/interviewSettings.mjs';

export const getSessionWizardInterviewValidationError = (value: unknown): string => {
  if (value === undefined) return '';
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 'Check the interview settings.';
  const settings = value as Record<string, unknown>;
  if (settings.openingMode === 'owner' && !String(settings.openingPrompt || '').trim()) {
    return 'Enter an owner opening question, or choose an automatically generated opening.';
  }
  return validInterviewSettings(settings) ? '' : 'Check the interview settings and prompt lengths.';
};
