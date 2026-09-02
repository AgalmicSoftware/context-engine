import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadSessionPolicy } from './sessionPolicyLoader.mjs';

class MemoryKv {
  constructor(entries = []) {
    this.store = new Map(entries);
  }

  async get(key) {
    return this.store.get(key) || null;
  }
}

test('session policy loading finalizes persisted exposure and default-session overrides', async () => {
  const env = {
    AGENT_ACTION_KV: new MemoryKv([
      ['telegram:results-exposure:alpha', JSON.stringify({
        aggregateResultsEnabled: false,
        anonymizedGroupsEnabled: true,
        minGroupSize: 5,
      })],
      ['telegram:admin-default-session:v1', JSON.stringify({
        version: 1,
        sessionSlug: 'beta',
        updatedAt: '2026-07-20T00:00:00.000Z',
      })],
    ]),
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      sessions: [
        { sessionSlug: 'alpha', telegramBridgeEnabled: true },
        { sessionSlug: 'beta', telegramBridgeEnabled: true },
      ],
    }),
  };

  const policy = await loadSessionPolicy(env);

  assert.equal(policy.defaultSessionSlug, 'beta');
  assert.equal(policy.scheduledDefaultSessionSlug, 'alpha');
  assert.deepEqual(policy.linkedSessions[0].resultsExposure, {
    metricsEnabled: true,
    publishedQuestionsEnabled: false,
    aggregateResultsEnabled: false,
    anonymizedGroupsEnabled: true,
    minGroupSize: 5,
  });
});

test('session policy loading fails closed when no configured or registry session is available', async () => {
  const policy = await loadSessionPolicy({});

  assert.equal(policy.registryAvailable, false);
  assert.equal(policy.registryFailureReason, 'registry_rpc_url_missing');
  assert.equal(policy.defaultSessionSlug, '');
  assert.deepEqual(policy.linkedSessions, []);
  assert.equal(policy.riskCeiling, 'read');
  assert.equal(policy.allowQuestionGeneration, false);
  assert.equal(policy.allowGenerateQuestion, false);
});

test('transport-neutral handoff imports policy authority from the policy domain', () => {
  const source = readFileSync(fileURLToPath(new URL('./telegramAgentHandoff.mjs', import.meta.url)), 'utf8');
  const loaderSource = readFileSync(fileURLToPath(new URL('./sessionPolicyLoader.mjs', import.meta.url)), 'utf8');

  assert.match(source, /from ['"]\.\/sessionPolicyLoader\.mjs['"]/);
  assert.doesNotMatch(
    source,
    /import\s*\{[\s\S]*?\bloadSessionPolicy\b[\s\S]*?\}\s*from\s*['"]\.\/telegramCommands\.mjs['"]/
  );
  assert.doesNotMatch(loaderSource, /from ['"]\.\/telegram(?:Commands|MiniApp|AgentHandoff)\.mjs['"]/);
});
