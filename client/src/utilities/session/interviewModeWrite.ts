// Session Workers reject interviewMode keys they do not recognize, and these keys
// are newer than some deployed Workers. Leave each out at its default, which readers
// treat the same as a missing key, so other interview settings still save to them.
const NEWER_INTERVIEW_DEFAULTS: Record<string, unknown> = {
  shareDraftChangesByDefault: false,
  researchDetail: 'minimal',
  hiddenDraftShare: 0,
  showFidelityScore: false,
  suggestGroups: false,
};

export const withoutNewInterviewDefaults = (interviewMode: Record<string, unknown>): Record<string, unknown> => {
  const settings = { ...interviewMode };
  for (const [key, value] of Object.entries(NEWER_INTERVIEW_DEFAULTS)) {
    if (settings[key] === value) delete settings[key];
  }
  return settings;
};
