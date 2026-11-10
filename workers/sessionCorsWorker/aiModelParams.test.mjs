import test from 'node:test';
import assert from 'node:assert/strict';

import {
  fitReasoningEffort,
  takesImageInput,
  takesReasoningEffort,
} from '../../shared/aiModelFamily.mjs';
import {
  applyChatCompletionBudget,
  isChatReasoningModel,
  resolveResponsesOutputTokens,
  usesOpenAiResponsesApi,
} from './aiModelParams.js';

test('usesOpenAiResponsesApi recognizes native OpenAI GPT-5 and GPT-6 models only', () => {
  for (const model of ['gpt-5', 'gpt-5-mini', 'gpt-5.6-terra', 'gpt-6.1-terra', 'gpt-6.1-sol', 'gpt-6-astra', 'gpt-6-luna']) {
    assert.equal(usesOpenAiResponsesApi({ provider: 'openai', model }), true, model);
  }
  assert.equal(usesOpenAiResponsesApi({ provider: 'openai', model: 'gpt-4o-mini' }), false);
  assert.equal(usesOpenAiResponsesApi({ provider: 'openai', model: 'gpt-50' }), false);
  assert.equal(usesOpenAiResponsesApi({ provider: 'openrouter', model: 'openai/gpt-6.1-terra' }), false);
  assert.equal(usesOpenAiResponsesApi({ provider: 'openai', endpoint: 'responses' }), true);
});

test('isChatReasoningModel recognizes GPT-5, GPT-6 and o-series models, never unknown ones', () => {
  for (const model of ['o1', 'o3-mini', 'o4-mini', 'gpt-5', 'openai/gpt-6.1-sol', 'gpt-6-luna']) {
    assert.equal(isChatReasoningModel({ model }), true, model);
  }
  for (const model of ['gpt-4o-mini', 'gpt-4.1', 'claude-opus-5-5', 'openrouter/auto', 'omni-1']) {
    assert.equal(isChatReasoningModel({ model }), false, model);
  }
});

test('the shared rule never sends an effort a model rejects', () => {
  const cases = [
    // Sol and Astra have no none; Terra and Luna do; GPT-5 has minimal instead.
    ['gpt-6.1-sol', 'none', 'low'], ['gpt-6-astra', 'none', 'low'], ['gpt-6.1-terra', 'none', 'none'],
    ['gpt-6-luna', 'minimal', 'low'], ['gpt-5', 'none', 'minimal'], ['gpt-5.6-terra', 'max', 'max'],
    ['o3-mini', 'xhigh', 'high'], ['claude-opus-5-5', 'none', 'low'], ['claude-sonnet-5-5', 'max', 'max'],
    ['claude-sonnet-4-6', 'xhigh', 'high'], ['gpt-6.1-terra', 'turbo', 'low'], ['gpt-6.1-terra', 'Medium ', 'medium'],
    // A model the rule doesn't know keeps the request's effort, as before.
    ['openrouter/auto', 'none', 'none'], ['gpt-6.1-sol', '', ''],
  ];
  for (const [model, effort, expected] of cases) {
    assert.equal(fitReasoningEffort(model, effort), expected, `${model} ${effort}`);
  }
  assert.equal(takesReasoningEffort('claude-haiku-5-5'), true);
  assert.equal(takesReasoningEffort('claude-haiku-4-5'), false);
  assert.equal(takesReasoningEffort('gpt-4o'), false);
});

test('takesImageInput covers GPT-4o, GPT-4.1, GPT-5, GPT-6 and Claude models', () => {
  for (const model of ['gpt-4o-mini', 'gpt-4.1', 'gpt-5', 'gpt-6.1-terra', 'gpt-6-luna', 'claude-sonnet-5-5']) {
    assert.equal(takesImageInput(model), true, model);
  }
  for (const model of ['gpt-3.5-turbo', 'o3-mini', 'gpt-4']) assert.equal(takesImageInput(model), false, model);
});

test('applyChatCompletionBudget uses max_completion_tokens for chat reasoning models', () => {
  const body = {};
  applyChatCompletionBudget({
    body,
    model: 'o3-mini',
    max_tokens: 321,
  });

  assert.equal(body.max_completion_tokens, 321);
  assert.equal(Object.prototype.hasOwnProperty.call(body, 'max_tokens'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(body, 'temperature'), false);
});

test('applyChatCompletionBudget keeps max_tokens for non-reasoning chat models', () => {
  const body = {};
  applyChatCompletionBudget({
    body,
    model: 'gpt-4o-mini',
    max_tokens: 123,
    temperature: 0.2,
  });

  assert.equal(body.max_tokens, 123);
  assert.equal(body.temperature, 0.2);
  assert.equal(Object.prototype.hasOwnProperty.call(body, 'max_completion_tokens'), false);
});

test('resolveResponsesOutputTokens prefers explicit responses output tokens', () => {
  assert.equal(resolveResponsesOutputTokens({ max_output_tokens: 999, max_completion_tokens: 500, max_tokens: 400 }), 999);
  assert.equal(resolveResponsesOutputTokens({ max_completion_tokens: 500, max_tokens: 400 }), 500);
  assert.equal(resolveResponsesOutputTokens({ max_tokens: 400 }), 400);
});
