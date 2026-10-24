import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WRAPPED_QUESTION_SOURCE_MODES,
  loadWrappedQuestionSource,
  resolveWrappedQuestionSourceMode,
} from './wrappedQuestionSource.mjs';

test('ordinary Wrapped defaults to canonical session questions', async () => {
  const calls = [];
  const result = await loadWrappedQuestionSource({
    env: {},
    sessionSlug: 'alpha',
    loadedConfig: { source: 'default', config: {} },
    loadCanonicalQuestions: async () => {
      calls.push('canonical');
      return {
        ok: true,
        source: 'telegram_worker_question_index',
        questions: [{
          questionId: `0x${'ab'.repeat(32)}`,
          prompt: 'Should Alpha use its canonical session statement?',
          questionType: 'binary',
        }],
      };
    },
    loadProposalQuestions: async () => {
      calls.push('proposals');
      return [];
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.mode, WRAPPED_QUESTION_SOURCE_MODES.CANONICAL_SESSION);
  assert.equal(result.source, 'telegram_worker_question_index');
  assert.deepEqual(calls, ['canonical']);
  assert.deepEqual(result.questions.map((question) => question.questionId), [`0x${'ab'.repeat(32)}`]);
});

test('explicit agent-only mode retains the configured Bridge proposal order', async () => {
  const result = await loadWrappedQuestionSource({
    env: {},
    sessionSlug: 'alpha',
    loadedConfig: {
      source: 'kv',
      config: {
        questionSourceMode: 'agent_only_proposals',
        enabledQuestionIds: ['ceq_second', 'ceq_first'],
      },
    },
    loadCanonicalQuestions: async () => assert.fail('canonical questions must not load'),
    loadProposalQuestions: async () => [
      { questionId: 'ceq_first', prompt: 'First proposal', questionType: 'freeform' },
      { questionId: 'ceq_second', prompt: 'Second proposal', questionType: 'rating' },
    ],
  });

  assert.equal(result.ok, true);
  assert.equal(result.mode, WRAPPED_QUESTION_SOURCE_MODES.AGENT_ONLY_PROPOSALS);
  assert.deepEqual(result.questions.map((question) => question.questionId), ['ceq_second', 'ceq_first']);
});

test('legacy persisted configs remain proposal-backed while new empty configs are canonical', () => {
  assert.equal(
    resolveWrappedQuestionSourceMode({ source: 'kv', config: { enabledQuestionIds: ['ceq_legacy'] } }),
    WRAPPED_QUESTION_SOURCE_MODES.AGENT_ONLY_PROPOSALS,
  );
  assert.equal(
    resolveWrappedQuestionSourceMode({ source: 'default', config: {} }),
    WRAPPED_QUESTION_SOURCE_MODES.CANONICAL_SESSION,
  );
});

test('canonical question failures fail closed without consulting proposal storage', async () => {
  const result = await loadWrappedQuestionSource({
    env: {},
    sessionSlug: 'alpha',
    loadedConfig: { source: 'default', config: {} },
    loadCanonicalQuestions: async () => ({
      ok: false,
      reason: 'question_rpc_url_missing',
      questions: [],
    }),
    loadProposalQuestions: async () => assert.fail('proposal fallback must not activate'),
  });

  assert.deepEqual(result, {
    ok: false,
    status: 503,
    reason: 'question_rpc_url_missing',
    mode: WRAPPED_QUESTION_SOURCE_MODES.CANONICAL_SESSION,
    source: 'canonical_session_questions',
    questions: [],
  });
});
