export const REALTIME_INTERVIEW_PROVIDER = 'openai';
// A session with no stored model runs its Worker's default. Workers that report
// GPT_LIVE_1_1_FEATURE default to gpt-live-1.1 and accept it on save; older
// ones default to gpt-live-1 and refuse gpt-live-1.1. So the site never stores
// the default (interviewModeWrite), and lists gpt-live-1.1 only where it is taken.
export const GPT_LIVE_1_1_MODEL = 'gpt-live-1.1';
export const GPT_LIVE_1_1_FEATURE = 'interview_gpt_live_1_1_v1';
export const DEFAULT_REALTIME_INTERVIEW_MODEL = GPT_LIVE_1_1_MODEL;
export const PREVIOUS_DEFAULT_REALTIME_INTERVIEW_MODEL = 'gpt-live-1';
// Workers that report it take interviewMode.voiceSessionContext on save; older ones refuse the key.
export const INTERVIEW_VOICE_CONTEXT_FEATURE = 'interview_voice_context_v1';
// Workers that report it take interviewMode.questionOrder on save; older ones refuse the key.
export const INTERVIEW_QUESTION_ORDER_FEATURE = 'interview_question_order_v1';

// Keep only documented, supported aliases; a matching prefix is not a model contract.
// The Live API models, in the order the site lists them, then the Realtime API ones.
const liveModels = new Set([GPT_LIVE_1_1_MODEL, PREVIOUS_DEFAULT_REALTIME_INTERVIEW_MODEL]);
export const REALTIME_INTERVIEW_MODELS = Object.freeze([
  ...liveModels, 'gpt-realtime-2.1', 'gpt-realtime-2.1-mini', 'gpt-realtime-2', 'gpt-realtime-1.5',
]);
const models = new Set(REALTIME_INTERVIEW_MODELS);

export const isRealtimeInterviewModel = (value) => typeof value === 'string' && models.has(value);

// True for the models the Live API serves (`/v1/live/sessions`); the rest use the Realtime API.
export const isLiveInterviewModel = (value) => typeof value === 'string' && liveModels.has(value);

export const normalizeRealtimeInterviewModel = (value) => {
  const model = String(value ?? '').trim();
  return isRealtimeInterviewModel(model) ? model : DEFAULT_REALTIME_INTERVIEW_MODEL;
};

export const resolveRealtimeInterviewModel = (config = {}) => {
  const interview = config?.interviewMode || config?.interview;
  return normalizeRealtimeInterviewModel(interview?.realtimeModel || config?.ai?.realtimeModel);
};
