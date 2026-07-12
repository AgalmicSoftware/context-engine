import test from 'node:test';
import assert from 'node:assert/strict';
import { TELEGRAM_TOPIC_MAP_CACHE_PREFIX, buildTelegramTopicMap } from './telegramTopicMap.mjs';

function response(questionId, index) {
  return {
    requestId: `r-${questionId}-${index}`,
    telegramUserId: `user-${index}`,
    questionId,
    answer: { value: index % 2 ? 'agree' : 'unsure', label: index % 2 ? 'Agree' : 'Unsure' },
    createdAt: `2026-05-29T00:00:0${index}.000Z`,
  };
}

test('topic map groups questions by content instead of low-signal tags', () => {
  const questions = [
    {
      questionId: 'q-agent',
      questionType: 'agree_unsure_disagree',
      prompt: 'AI agents should draft responses, but users should approve every submission.',
      tags: ['agree', 'demo'],
    },
    {
      questionId: 'q-privacy',
      questionType: 'agree_unsure_disagree',
      prompt: 'Public result summaries should hide individual wallet addresses by default.',
      tags: ['addresses'],
    },
    {
      questionId: 'q-results',
      questionType: 'agree_unsure_disagree',
      prompt: 'Country and role filters are useful for interpreting group differences.',
      tags: ['groups'],
    },
    {
      questionId: 'q-mobile',
      questionType: 'agree_unsure_disagree',
      prompt: 'A microphone input is important for people answering on mobile.',
      tags: ['able'],
    },
    {
      questionId: 'q-event',
      questionType: 'agree_unsure_disagree',
      prompt: 'Edge City should prioritize shared meals over more formal talks.',
      tags: ['demo'],
    },
  ];
  const records = questions.flatMap((question, index) => [
    response(question.questionId, index + 1),
    response(question.questionId, index + 11),
  ]);

  const map = buildTelegramTopicMap({
    session: { sessionSlug: 'alpha', sessionName: 'Demo' },
    questions,
    records,
    generatedAt: '2026-05-29T00:00:00.000Z',
  });

  assert.equal(map.availability.available, true);
  assert.equal(map.version, 2);
  assert.equal(TELEGRAM_TOPIC_MAP_CACHE_PREFIX, 'telegram:topic-map:v2:');
  const labels = map.topics.map((topic) => topic.label);
  assert.equal(labels.includes('Agent Workflows'), true);
  assert.equal(labels.includes('Privacy And Control'), true);
  assert.equal(labels.includes('Results And Groups'), true);
  assert.equal(labels.includes('Mobile UX'), true);
  assert.equal(labels.includes('Event Experience'), true);
  assert.equal(labels.some((label) => ['Agree', 'Demo', 'Able', 'Addresses', 'Groups'].includes(label)), false);
  assert.equal(map.topics.every((topic) => topic.source === 'semantic_question_content'), true);
});

test('topic map still uses meaningful explicit tags as fallback', () => {
  const questions = [
    {
      questionId: 'q-governance',
      questionType: 'agree_unsure_disagree',
      prompt: 'Should the council publish meeting notes?',
      tags: ['governance'],
    },
    {
      questionId: 'q-funding',
      questionType: 'agree_unsure_disagree',
      prompt: 'Should budget grants be reviewed monthly?',
      tags: ['funding'],
    },
  ];
  const records = questions.flatMap((question, index) => [
    response(question.questionId, index + 1),
    response(question.questionId, index + 11),
  ]);

  const map = buildTelegramTopicMap({
    session: { sessionSlug: 'alpha', sessionName: 'Demo' },
    questions,
    records,
  });

  assert.deepEqual(map.topics.map((topic) => topic.label).sort(), ['Funding', 'Governance']);
  assert.equal(map.topics.every((topic) => topic.source === 'question_tag'), true);
});
