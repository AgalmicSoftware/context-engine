// Session Workers reject interviewMode keys they do not recognize, and these keys
// are newer than some deployed Workers. Leave each out at its default, which readers
// treat the same as a missing key, so other interview settings still save to them.
const NEWER_INTERVIEW_DEFAULTS: Record<string, unknown> = {
  shareDraftChangesByDefault: true,
  researchDetail: 'minimal',
  hiddenDraftShare: 0,
  showFidelityScore: false,
  suggestGroups: false,
  joinMatchingGroups: false,
  groupSuggestionData: ['country', 'work', 'interests'],
  showFidelityResults: false,
  fidelityMinimumPeople: 5,
};

export const withoutNewInterviewDefaults = (interviewMode: Record<string, unknown>): Record<string, unknown> => {
  const settings = { ...interviewMode };
  for (const [key, value] of Object.entries(NEWER_INTERVIEW_DEFAULTS)) {
    if (JSON.stringify(settings[key]) === JSON.stringify(value)) delete settings[key];
  }
  // Only group suggestions read it, so while they're off it isn't saved, where no one would see it.
  if (settings.joinMatchingGroups !== true) delete settings.groupSuggestionData;
  return settings;
};
