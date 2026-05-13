export const buildCreateSurveyOpenLockKeyPatch = (openLockKey: unknown = '') => ({
  openLockKey: String(openLockKey || ''),
});

export const buildCreateSurveySurveyLockGateIdsPatch = (surveyLockGateIds: unknown) => ({
  surveyLockGateIds: Array.isArray(surveyLockGateIds) ? surveyLockGateIds : [],
});
