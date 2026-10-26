// What a draft's confidence means. From prompt ce-interview-brief-v6 it is the chance
// the person keeps the answer unchanged, which calibration can check. Earlier prompts,
// like Session Wrapped's rubric, graded strength of support instead.
export const confidenceMeaningOf = (promptVersion) => {
  const version = Number(/^ce-interview-brief-v(\d+)$/.exec(String(promptVersion ?? '').trim())?.[1]);
  if (!version) return 'unknown';
  return version >= 6 ? 'keep' : 'support';
};
