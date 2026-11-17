// Cloudflare Workers AI: the open model a session's Session Agent may answer
// with, through the Session Worker's own AI binding, billed to the Cloudflare
// account that hosts the Worker. Only the Session Agent uses it; every other AI
// task keeps the session's provider. The client and the Session Worker both read
// this, and a Worker refuses any other model. Keep models with a published
// retirement date off the list.
export const WORKERS_AI_PROVIDER = 'workers-ai';
export const WORKERS_AI_TASK = 'session-agent';

// `tokenField` is what the model's input schema calls its reply limit. Every
// call sets it, so a model's own default never applies. `reasoningEffort`, when
// listed, is sent as `reasoning_effort` on every call, whatever the session's own
// setting: GLM 5.3 can't stop thinking, defaults to its most (`max`), and reads
// `medium` as `max`, so `low` keeps its thinking from using up the reply limit.
// GLM 5.3 was chosen in a trial for keeping participants unnamed and not
// inventing answers.
export const WORKERS_AI_MODELS = Object.freeze([
  Object.freeze({ id: '@cf/zai-org/glm-5.3', tokenField: 'max_completion_tokens', reasoningEffort: 'low' }),
]);
export const DEFAULT_WORKERS_AI_MODEL = WORKERS_AI_MODELS[0].id;
export const WORKERS_AI_MODEL_IDS = Object.freeze(WORKERS_AI_MODELS.map((entry) => entry.id));

export const workersAiModel = (model) => WORKERS_AI_MODELS.find((entry) => entry.id === String(model ?? '').trim()) || null;
