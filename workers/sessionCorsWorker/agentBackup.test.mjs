import test from 'node:test';
import assert from 'node:assert/strict';
import { assertAgentBackupTargetEmpty, stripAgentAdmissionFromBackup } from './agent/backup.mjs';
const sessionId = '0x11111111111111111111111111111111';
test('backup config removes invite verifier material without mutating active config', () => {
  const config = { sessionId, agentHttp: { managedAccountSubmitAllowed: true, invites: [{ tokenHash: 'a'.repeat(64) }] } };
  const exported = stripAgentAdmissionFromBackup(config);
  assert.equal(exported.agentHttp.invites, undefined); assert.equal(exported.agentHttp.managedAccountSubmitAllowed, true);
  assert.equal(config.agentHttp.invites.length, 1);
});
test('restore refuses credentials, pending invite journals and an incomplete emptiness check', async () => {
  const storage = { list: async () => new Map() };
  const empty = { list: async () => ({ keys: [], list_complete: true }) };
  await assertAgentBackupTargetEmpty({ kv: empty, storage, sessionId });
  for (const suffix of ['agent:credential:v2:hash', 'telegram:answer-draft:principal']) {
    await assert.rejects(assertAgentBackupTargetEmpty({ kv: { list: async () => ({ keys: [{ name: `ce-agent:${sessionId}:${suffix}` }], list_complete: true }) }, storage, sessionId }), { reason: 'backup_target_not_empty' });
  }
  for (const journalPrefix of ['ce-agent-invite:', 'ce-agent-submit:', 'ce-agent-wrapped:']) {
    await assert.rejects(assertAgentBackupTargetEmpty({ kv: empty, storage: { list: async ({ prefix }) => prefix === journalPrefix ? new Map([[`${prefix}pending`, {}]]) : new Map() }, sessionId }), { reason: 'backup_target_not_empty' });
  }
  for (const value of [{ keys: [] }, { keys: [], list_complete: false, cursor: 'next' }, { keys: null, list_complete: true }]) {
    await assert.rejects(assertAgentBackupTargetEmpty({ kv: { list: async () => value }, storage, sessionId }), { status: 503 });
  }
});
