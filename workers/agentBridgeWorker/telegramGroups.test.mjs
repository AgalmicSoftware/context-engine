import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_TELEGRAM_GROUP_CATEGORIES,
  TELEGRAM_BUCKET_MEMBERSHIP_KV_PREFIX,
  loadTelegramLightweightGroups,
  readTelegramBucketMembership,
  saveTelegramLightweightGroupMembership,
} from './telegramGroups.mjs';

class MemoryKv {
  constructor() {
    this.store = new Map();
  }

  async put(key, value) {
    this.store.set(key, value);
  }

  async get(key) {
    return this.store.get(key) || null;
  }

  async list({ prefix = '' } = {}) {
    return {
      keys: Array.from(this.store.keys())
        .filter((key) => key.startsWith(prefix))
        .map((name) => ({ name })),
      list_complete: true,
    };
  }
}

test('Telegram group defaults include Edge demo bucket categories', () => {
  const ids = DEFAULT_TELEGRAM_GROUP_CATEGORIES.map((category) => category.categoryId);

  assert.equal(ids.includes('age_bucket'), true);
  assert.equal(ids.includes('country_relationship'), true);
  assert.equal(ids.includes('events_attended'), true);
  assert.equal(ids.includes('time_in_crypto'), false);
  assert.equal(ids.includes('primary_focus'), false);
  assert.equal(ids.includes('region'), true);
  const attendance = DEFAULT_TELEGRAM_GROUP_CATEGORIES.find((category) => category.categoryId === 'events_attended');
  assert.equal(attendance.label, 'Attendance');
  assert.deepEqual(attendance.options.map((option) => option.optionId), [
    'week_1',
    'week_2',
    'week_3',
    'week_4',
    'entire_month',
    'attended_previous_edge_events',
  ]);
});

test('Telegram bucket memberships are durable and readable by managed wallet address', async () => {
  const env = { AGENT_ACTION_KV: new MemoryKv() };
  const session = { sessionSlug: 'edge', telegramOnly: true };
  const accountAddress = '0x00000000000000000000000000000000000000aa';
  const saved = await saveTelegramLightweightGroupMembership({
    env,
    session,
    telegramUserId: '42',
    accountAddress,
    selections: {
      age_bucket: ['25_34'],
      contribution_role: ['other'],
      region: ['north_america'],
    },
    details: {
      contribution_role: { other_text: 'Facilitator' },
    },
    createdAt: '2026-05-29T12:00:00.000Z',
  });

  assert.equal(saved.ok, true);
  const bucketKey = `${TELEGRAM_BUCKET_MEMBERSHIP_KV_PREFIX}edge:${accountAddress}`;
  assert.equal(env.AGENT_ACTION_KV.store.has(bucketKey), true);
  const bucketRecord = await readTelegramBucketMembership(env, {
    sessionSlug: 'edge',
    accountAddress,
  });
  assert.deepEqual(bucketRecord.selections.contribution_role, ['other']);
  assert.deepEqual(bucketRecord.details.contribution_role, { other_text: 'Facilitator' });

  await env.AGENT_ACTION_KV.store.delete('telegram:lightweight-group-membership:edge:42');
  const groups = await loadTelegramLightweightGroups({
    env,
    session,
    telegramUserId: '42',
    accountAddress,
  });

  assert.equal(groups.membershipSource, 'managed_wallet');
  assert.deepEqual(groups.selections.age_bucket, ['25_34']);
  assert.deepEqual(groups.selections.region, ['north_america']);
  assert.deepEqual(groups.details.contribution_role, { other_text: 'Facilitator' });
});
