/** Whole seconds as m:ss: how long a recording, or a wait, has run. */
export const formatSessionRecordingElapsed = (secondsRaw: unknown) => {
  const seconds = Math.max(0, Math.floor(Number(secondsRaw || 0)));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
};
