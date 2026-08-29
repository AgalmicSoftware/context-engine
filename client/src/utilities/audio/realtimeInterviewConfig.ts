export const REALTIME_INTERVIEW_PROVIDER = 'openai';
export const DEFAULT_REALTIME_INTERVIEW_MODEL = 'gpt-realtime-2.1';

const REALTIME_INTERVIEW_MODEL_PATTERN = /^gpt-realtime(?:-[a-z0-9.]+)*$/i;

export const normalizeRealtimeInterviewModel = (value: unknown): string => {
  const model = String(value == null ? '' : value).trim();
  return REALTIME_INTERVIEW_MODEL_PATTERN.test(model) ? model : DEFAULT_REALTIME_INTERVIEW_MODEL;
};
