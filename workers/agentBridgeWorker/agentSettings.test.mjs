import assert from 'node:assert/strict';
import test from 'node:test';

import {
  loadAgentSettings,
  agentSettingsKey,
  __test__agentSettings,
} from './agentSettings.mjs';

const {
  defaultAgentSettings,
  normalizeAgentSettingsPatch,
} = __test__agentSettings;

test('default Telegram agent settings include question cadence preferences', () => {
  const defaults = defaultAgentSettings({});
  assert.equal(defaults.questionsPerBatch, 3);
  assert.equal(defaults.digestFrequency, 'weekly');
  assert.equal(defaults.digestTimeOfDay, 'morning');
  assert.equal(defaults.attendanceLinkOptIn, false);
  assert.equal(defaults.showAgentResponses, true);
});

test('settings patch accepts and clamps questionsPerBatch', () => {
  assert.deepEqual(normalizeAgentSettingsPatch({ questionsPerBatch: 7 }), {
    ok: true,
    patch: { questionsPerBatch: 7 },
    publicSummary: { questionsPerBatch: 7 },
  });
  assert.equal(normalizeAgentSettingsPatch({ questionsPerBatch: 99 }).patch.questionsPerBatch, 10);
  assert.equal(normalizeAgentSettingsPatch({ questionsPerBatch: 0 }).patch.questionsPerBatch, 1);
  assert.deepEqual(normalizeAgentSettingsPatch({ questionsPerBatch: 'abc' }), {
    ok: false,
    reason: 'questions_per_batch_invalid',
  });
  assert.deepEqual(normalizeAgentSettingsPatch({ questionsPerBatch: false }), {
    ok: false,
    reason: 'questions_per_batch_invalid',
  });
});

test('settings patch validates digestFrequency', () => {
  assert.deepEqual(normalizeAgentSettingsPatch({ digestFrequency: 'daily' }), {
    ok: true,
    patch: { digestFrequency: 'daily' },
    publicSummary: { digestFrequency: 'daily' },
  });
  assert.deepEqual(normalizeAgentSettingsPatch({ digestFrequency: 'hourly' }), {
    ok: false,
    reason: 'digest_frequency_invalid',
  });
});

test('settings patch validates digestTimeOfDay', () => {
  assert.deepEqual(normalizeAgentSettingsPatch({ digestTimeOfDay: 'night' }), {
    ok: true,
    patch: { digestTimeOfDay: 'night' },
    publicSummary: { digestTimeOfDay: 'night' },
  });
  assert.equal(normalizeAgentSettingsPatch({ digestTimeOfDay: 'pm' }).patch.digestTimeOfDay, 'night');
  assert.equal(normalizeAgentSettingsPatch({ digestTimeOfDay: 'am' }).patch.digestTimeOfDay, 'morning');
  assert.deepEqual(normalizeAgentSettingsPatch({ digestTimeOfDay: 'afternoon' }), {
    ok: false,
    reason: 'digest_time_of_day_invalid',
  });
});

test('settings patch validates attendance sharing opt-in', () => {
  assert.deepEqual(normalizeAgentSettingsPatch({ attendanceLinkOptIn: 'yes' }), {
    ok: true,
    patch: { attendanceLinkOptIn: true },
    publicSummary: { attendanceLinkOptIn: true },
  });
  assert.deepEqual(normalizeAgentSettingsPatch({ attendanceLinkOptIn: 'sometimes' }), {
    ok: false,
    reason: 'attendance_link_opt_in_invalid',
  });
});

test('settings patch validates showAgentResponses', () => {
  assert.deepEqual(normalizeAgentSettingsPatch({ showAgentResponses: 'no' }), {
    ok: true,
    patch: { showAgentResponses: false },
    publicSummary: { showAgentResponses: false },
  });
  assert.deepEqual(normalizeAgentSettingsPatch({ showAgentResponses: 'sometimes' }), {
    ok: false,
    reason: 'show_agent_responses_invalid',
  });
});

test('loadTelegramAgentSettings returns stored question cadence preferences', async () => {
  const sessionSlug = 'ee-26-organizers';
  const telegramUserId = '42';
  const key = agentSettingsKey({ sessionSlug, telegramUserId });
  const stored = {
    type: 'telegram_agent_settings',
    version: 1,
    sessionSlug,
    telegramUserId,
    settings: {
      questionsPerBatch: 6,
      digestFrequency: 'few_per_week',
      digestTimeOfDay: 'night',
      attendanceLinkOptIn: true,
      showAgentResponses: false,
    },
  };
  const env = {
    AGENT_ACTION_KV: {
      async get(requestedKey) {
        assert.equal(requestedKey, key);
        return JSON.stringify(stored);
      },
    },
  };

  const settings = await loadAgentSettings({ env, sessionSlug, telegramUserId });
  assert.equal(settings.questionsPerBatch, 6);
  assert.equal(settings.digestFrequency, 'few_per_week');
  assert.equal(settings.digestTimeOfDay, 'night');
  assert.equal(settings.attendanceLinkOptIn, true);
  assert.equal(settings.showAgentResponses, false);
});
