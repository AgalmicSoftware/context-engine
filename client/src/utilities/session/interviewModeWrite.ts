// Session Workers before 0.7.0 reject interviewMode keys they do not recognize.
// Leave the research-sharing default out while it is off, which readers treat
// the same as false, so other interview settings still save to those Workers.
export const withoutOffResearchSharingDefault = (interviewMode: Record<string, unknown>): Record<string, unknown> => {
  if (interviewMode.shareDraftChangesByDefault === true) return interviewMode;
  const settings = { ...interviewMode };
  delete settings.shareDraftChangesByDefault;
  return settings;
};
