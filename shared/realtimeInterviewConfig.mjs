export const REALTIME_INTERVIEW_PROVIDER = 'openai';
export const DEFAULT_REALTIME_INTERVIEW_MODEL = 'gpt-live-1';

// Keep only documented, supported aliases; a matching prefix is not a model contract.
const models = new Set(['gpt-live-1', 'gpt-realtime-2.1', 'gpt-realtime-2.1-mini', 'gpt-realtime-2', 'gpt-realtime-1.5']);

export const isRealtimeInterviewModel = (value) => typeof value === 'string' && models.has(value);

export const normalizeRealtimeInterviewModel = (value) => {
  const model = String(value ?? '').trim();
  return isRealtimeInterviewModel(model) ? model : DEFAULT_REALTIME_INTERVIEW_MODEL;
};

export const resolveRealtimeInterviewModel = (config = {}) => {
  const interview = config?.interviewMode || config?.interview;
  return normalizeRealtimeInterviewModel(interview?.realtimeModel || config?.ai?.realtimeModel);
};
