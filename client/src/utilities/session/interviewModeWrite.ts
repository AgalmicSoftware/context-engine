import { DEFAULT_INTERVIEW_SETTINGS } from '../../../../shared/interviewSettings.mjs';

// Session Workers reject interviewMode keys they do not recognize, and these keys
// are newer than some deployed Workers. Leave each out at its shared default, which readers
// treat the same as a missing key, so other interview settings still save to them.
const NEWER_INTERVIEW_KEYS = [
  'shareDraftChangesByDefault',
  'researchDetail',
  'keepDraftTextForAdmins',
  'hiddenDraftShare',
  'showFidelityScore',
  'suggestGroups',
  'joinMatchingGroups',
  'groupSuggestionData',
  'showFidelityResults',
  'fidelityMinimumPeople',
  'recordingQuestionCount',
  'recordingQuestionTiming',
] as const;

export const withoutNewInterviewDefaults = (interviewMode: Record<string, unknown>): Record<string, unknown> => {
  const settings = { ...interviewMode };
  for (const key of NEWER_INTERVIEW_KEYS) {
    if (JSON.stringify(settings[key]) === JSON.stringify(DEFAULT_INTERVIEW_SETTINGS[key])) delete settings[key];
  }
  // Only group suggestions read it, so while they're off it isn't saved, where no one would see it.
  if (settings.joinMatchingGroups !== true) delete settings.groupSuggestionData;
  return settings;
};
