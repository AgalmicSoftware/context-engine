// The one rule for what each model family takes: which OpenAI API, which token
// field, which reasoning efforts, and whether it reads images. The client and
// the Session Worker both use it. A model it doesn't name keeps the plain Chat
// Completions path: max_tokens and temperature, and no reasoning effort.

export const toModelLeaf = (model) => String(model ?? '').trim().toLowerCase().split('/').pop() || '';

// The provider a model's name implies, or '' when it names none.
export const inferAiProviderFromModel = (model) => {
  const name = String(model ?? '').trim().toLowerCase();
  if (!name) return '';
  if (name.startsWith('claude')) return 'anthropic';
  if (/^(?:gpt-|o[1-9]|chatgpt)/.test(name)) return 'openai';
  return name.includes('/') ? 'openrouter' : '';
};

// gpt-5, gpt-5-mini, gpt-5.6-terra, gpt-6-astra, gpt-6.1-sol and so on.
const isGpt5Or6 = (leaf) => /^gpt-[56](?:$|[.-])/.test(leaf);
// o1, o3-mini, o4-mini and so on.
const isOSeries = (leaf) => /^o[1-9](?:$|-)/.test(leaf);

// GPT-5, GPT-6 and o-series models reason. They take a reasoning effort and,
// on Chat Completions, max_completion_tokens and no temperature.
export const isOpenAiReasoningModel = (model) => {
  const leaf = toModelLeaf(model);
  return isGpt5Or6(leaf) || isOSeries(leaf);
};

// OpenAI itself serves GPT-5 and GPT-6 models through the Responses API.
export const usesOpenAiResponsesApi = ({ provider = '', model = '', endpoint = '' } = {}) => {
  if (String(provider || '').trim().toLowerCase() !== 'openai') return false;
  const route = String(endpoint || '').trim().toLowerCase();
  return route === 'responses' || route.includes('/responses') || isGpt5Or6(toModelLeaf(model));
};

// GPT-4o, GPT-4.1, GPT-5, GPT-6 and Claude models read images.
export const takesImageInput = (model) => /^(?:gpt-(?:4o|4\.1|[56])(?:$|[.-])|claude-)/.test(toModelLeaf(model));

// Reasoning efforts, lowest first, and the levels each family accepts as its
// provider documents them. Claude has no none or minimal level.
const LADDER = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'];
const GPT_FULL = Object.freeze(['none', 'low', 'medium', 'high', 'xhigh', 'max']);
const GPT_FROM_LOW = Object.freeze(['low', 'medium', 'high', 'xhigh', 'max']);
const GPT_5 = Object.freeze(['minimal', 'low', 'medium', 'high']);
const GPT_5_POINT = Object.freeze(['none', 'low', 'medium', 'high']);
const LOW_TO_HIGH = Object.freeze(['low', 'medium', 'high']);
const CLAUDE = Object.freeze(['low', 'medium', 'high', 'xhigh', 'max']);

const reasoningEffortsOf = (model) => {
  const leaf = toModelLeaf(model);
  if (/^gpt-6(?:\.\d+)?-(?:sol|astra)(?:$|-)/.test(leaf)) return GPT_FROM_LOW;
  if (/^gpt-(?:5\.6|6)(?:$|[.-])/.test(leaf)) return GPT_FULL;
  if (/^gpt-5(?:-mini|-nano)?(?:-\d{4}-\d{2}-\d{2})?$/.test(leaf)) return GPT_5;
  if (isGpt5Or6(leaf)) return GPT_5_POINT;
  if (isOSeries(leaf)) return LOW_TO_HIGH;
  if (/^claude-(?:opus|sonnet|haiku|fable|mythos)-[5-9]/.test(leaf)) return CLAUDE;
  if (/^claude-(?:opus-4-[5-9]|sonnet-4-[6-9])/.test(leaf)) return LOW_TO_HIGH;
  return null;
};

export const takesReasoningEffort = (model) => reasoningEffortsOf(model) !== null;

// The effort to send: the request's own when the model accepts it, else the
// nearest level above it, else the model's highest. An effort the ladder lacks
// counts as low. A model this rule doesn't know gets the effort unchanged.
export const fitReasoningEffort = (model, effort) => {
  const wanted = String(effort ?? '').trim().toLowerCase();
  const accepted = reasoningEffortsOf(model);
  if (!wanted || !accepted || accepted.includes(wanted)) return wanted;
  const rank = LADDER.includes(wanted) ? LADDER.indexOf(wanted) : LADDER.indexOf('low');
  return accepted.find((level) => LADDER.indexOf(level) >= rank) || accepted[accepted.length - 1];
};
