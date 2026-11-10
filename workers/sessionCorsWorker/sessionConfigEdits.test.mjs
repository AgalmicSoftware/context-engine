import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CURATED_ID_LIST_KEYS,
  MAX_AGENT_INSTRUCTIONS_CHARS,
  MAX_CURATED_IDS,
  MAX_RESULTS_ADMINS,
  WORKER_CANONICAL_SET_CONFIG_KEYS,
  classifySessionConfigEdits as classify,
  sessionConfigRequiresReauthorization as revokes,
} from '../../shared/sessionConfigEdits.mjs';
import { applySessionConfigMutation } from './sessionConfigMutation.js';

const invite = { tokenHash: 'a'.repeat(64), enabled: true };
const second = { tokenHash: 'b'.repeat(64), enabled: true };
const withInvites = invites => ({ agentHttp: { invites } });

test('additive invite changes preserve all previous invite records without ambiguity', () => {
  assert.equal(revokes({}, withInvites([invite])), false);
  assert.equal(revokes(withInvites([invite]), withInvites([second, invite])), false);
  assert.equal(revokes(withInvites([invite, second]), withInvites([second, invite])), false);
  for (const next of [[], [{ ...invite, enabled: false }], [{ ...invite, label: 'Changed' }],
    [invite, { ...invite, enabled: false }], [second]]) {
    assert.equal(revokes(withInvites([invite]), withInvites(next)), true);
  }
  assert.equal(revokes(withInvites([{ ...invite, enabled: false }]), withInvites([invite])), true);
});

test('limiting who adds context signs no one out: each file is checked as it publishes', () => {
  assert.equal(revokes({}, { contextAdditionPolicy: 'admin_only' }), false);
  assert.equal(revokes({ contextAdditionPolicy: 'admin_only' }, { contextAdditionPolicy: 'participants' }), false);
});

test('interview settings are content: each interview request reads them afresh', () => {
  const before = { interviewModeEnabled: true, interviewMode: { enabled: true, openingPrompt: 'Earlier', steeringPrompt: 'Earlier' } };
  for (const interviewMode of [
    { ...before.interviewMode, openingPrompt: 'Updated', steeringPrompt: '' },
    { openingPrompt: 'Updated' },
    { ...before.interviewMode, hiddenDraftShare: 0.5 },
    { ...before.interviewMode, joinMatchingGroups: true, groupSuggestionData: ['country', 'town'] },
    { ...before.interviewMode, enabled: false },
  ]) assert.equal(revokes(before, { ...before, interviewMode }), false, JSON.stringify(interviewMode));
  assert.equal(revokes(before, { interviewModeEnabled: false }), false);
  assert.equal(revokes(before, { ...before, defaultTags: 'x' }), true);
});

for (const field of ['slug', 'sessionId', 'sessionIdHex', 'configRevision', 'adminAddress', 'adminAddresses',
  'corsWorkerUrl', 'allowOrigins', 'sessionModeProfile', 'workerAuthority', 'workerRoles', 'roles', 'authorization',
  'groupCreationPolicy', 'linkedWorkerGroups', 'workerGroupsBootstrap', 'resultsExposure', 'storageProfile',
  'storageEnvelope', 'responseFieldEncryption', 'agentSessionWrapped', 'scopes', 'limits', 'litCredentials',
  'sessionEndsAt', 'defaultTags', 'defaultGroupTags', 'defaultSbtTags', 'pileAutoAdvanceEnabled',
  'defaultFilterState', 'defaultFeaturedSBTs', 'autoFeatureSBTsBySessionSlug', 'ai', 'networkChainId', 'contracts',
  'embeddedDeployHelperEnabled', 'resultsAnalysis', 'futureUnclassifiedSetting']) {
  test(`${field} remains authority-sensitive even alongside a content edit`, () => {
    const before = { [field]: { value: 'earlier' } };
    const after = { [field]: { value: 'changed' }, sessionName: 'Updated title' };
    assert.equal(revokes(before, after), true);
    assert.equal(revokes(before, { sessionName: 'Updated title' }), true);
  });
}

const workerCanonicalConfig = () => ({
  slug: 'session-a',
  sessionName: 'Session A',
  sessionModeProfile: {
    profileVersion: 1,
    preset: 'custom',
    authority: { mode: 'worker_canonical' },
    evm: { registryChainId: null },
    storage: {
      backend: 'cloudflare',
      payloadAccessControl: {
        gate: 'role_gate',
        encryption: 'worker_envelope',
        accessConditions: { match: 'all', conditions: [{ kind: 'worker_role', role: 'admin' }] },
      },
    },
    identity: { default: 'passkey', enabled: ['passkey'] },
    authorization: { mechanisms: ['worker_roles'] },
    encryption: { mode: 'worker_envelope', keyProvider: 'worker_secret' },
    surfaces: { web: true, telegram: false, miniApp: false, agentHttp: false, mcp: false, ceCc: false },
    results: {
      visibility: 'participant_aggregate',
      exposure: { aggregateResultsEnabled: true, anonymizedGroupsEnabled: false, minGroupSize: 2 },
    },
    export: { scope: 'admin_raw' },
  },
  storageProfile: {
    backend: 'cloudflare',
    payloadAccessControl: {
      gate: 'role_gate',
      encryption: 'worker_envelope',
      accessConditions: { match: 'all', conditions: [{ kind: 'worker_role', role: 'admin' }] },
    },
  },
});
const setConfig = incomingConfig => applySessionConfigMutation({
  existingConfig: workerCanonicalConfig(),
  mutation: { kind: 'set-config', incomingConfig },
  slug: 'session-a',
});
const unsupported = key => `Unsupported worker-canonical session config field: ${key}.`;

test('the shared set-config key list is exactly what a Worker-canonical session accepts', () => {
  assert.ok(Object.isFrozen(WORKER_CANONICAL_SET_CONFIG_KEYS));
  assert.equal(new Set(WORKER_CANONICAL_SET_CONFIG_KEYS).size, WORKER_CANONICAL_SET_CONFIG_KEYS.length);
  for (const key of WORKER_CANONICAL_SET_CONFIG_KEYS) {
    assert.notEqual(setConfig({ [key]: 'x' }).error, unsupported(key), key);
  }
  assert.equal(setConfig({ sessionName: 'Renamed' }).ok, true);
  for (const key of ['blockLimits', 'publicKey', 'ignored_SBTs_LIST', 'featured_SBTs_LIST']) {
    assert.deepEqual(setConfig({ [key]: [] }), { ok: false, status: 400, error: unsupported(key) }, key);
  }
});

test('highlighted and hidden ID lists save as checked lists and sign no one out', () => {
  const questionId = `0x${'ab'.repeat(32)}`;
  for (const key of CURATED_ID_LIST_KEYS) {
    assert.ok(WORKER_CANONICAL_SET_CONFIG_KEYS.includes(key), key);
    const saved = setConfig({ [key]: [questionId, 'survey_2026-10:a.b'] });
    assert.equal(saved.ok, true, key);
    assert.deepEqual(saved.config[key], [questionId, 'survey_2026-10:a.b']);
    assert.deepEqual(classify({}, { [key]: [questionId] }), { content: [key], authority: [], signsParticipantsOut: false });
    const error = `${key} must be a list of at most ${MAX_CURATED_IDS} IDs.`;
    for (const invalid of ['q1', [''], ['has space'], [7], ['x'.repeat(129)], Array(MAX_CURATED_IDS + 1).fill('q')]) {
      assert.deepEqual(setConfig({ [key]: invalid }), { ok: false, status: 400, error }, `${key} ${JSON.stringify(invalid).slice(0, 40)}`);
    }
  }
  assert.equal(setConfig({ BLOCKED_QUESTION_IDS: Array(MAX_CURATED_IDS).fill('q') }).ok, true);
});

test('results admins save as a checked address list and sign no one out', () => {
  const first = `0x${'ab'.repeat(20)}`;
  const second = `0x${'CD'.repeat(20)}`;
  const saved = setConfig({ resultsAdminAddresses: [first, second] });
  assert.equal(saved.ok, true);
  assert.deepEqual(saved.config.resultsAdminAddresses, [first, second]);
  assert.deepEqual(classify({}, { resultsAdminAddresses: [first] }), { content: ['resultsAdminAddresses'], authority: [], signsParticipantsOut: false });
  assert.equal(revokes({ resultsAdminAddresses: [first] }, { resultsAdminAddresses: [] }), false);
  const error = `resultsAdminAddresses must list at most ${MAX_RESULTS_ADMINS} different addresses.`;
  const tooMany = Array.from({ length: MAX_RESULTS_ADMINS + 1 }, (_, index) => `0x${String(index).padStart(40, '0')}`);
  for (const invalid of [first, ['0x1234'], [7], [first, `0x${first.slice(2).toUpperCase()}`], tooMany]) {
    assert.deepEqual(setConfig({ resultsAdminAddresses: invalid }), { ok: false, status: 400, error }, JSON.stringify(invalid).slice(0, 40));
  }
  assert.equal(setConfig({ resultsAdminAddresses: tooMany.slice(1) }).ok, true);
});

test('instructions for AI agents save as text of at most 8,000 characters and sign no one out', () => {
  const instructions = '# Taking part\n\nJoin the Reviewers group.';
  const saved = setConfig({ agentInstructions: instructions });
  assert.equal(saved.ok, true);
  assert.equal(saved.config.agentInstructions, instructions);
  assert.deepEqual(classify({}, { agentInstructions: instructions }), { content: ['agentInstructions'], authority: [], signsParticipantsOut: false });
  assert.equal(MAX_AGENT_INSTRUCTIONS_CHARS, 8000);
  for (const valid of ['', 'x'.repeat(MAX_AGENT_INSTRUCTIONS_CHARS)]) assert.equal(setConfig({ agentInstructions: valid }).ok, true);
  const error = `agentInstructions must be text of at most ${MAX_AGENT_INSTRUCTIONS_CHARS} characters.`;
  for (const invalid of ['x'.repeat(MAX_AGENT_INSTRUCTIONS_CHARS + 1), 7, null, ['text'], { text: 'x' }]) {
    assert.deepEqual(setConfig({ agentInstructions: invalid }), { ok: false, status: 400, error }, JSON.stringify(invalid).slice(0, 40));
  }
});

test('set-config keeps stored instructions for AI agents it is not sent, and an empty value clears them', () => {
  const save = incomingConfig => applySessionConfigMutation({
    existingConfig: { ...workerCanonicalConfig(), agentInstructions: 'Join the open group.' },
    mutation: { kind: 'set-config', incomingConfig },
    slug: 'session-a',
  });
  assert.equal(save({ sessionName: 'Renamed' }).config.agentInstructions, 'Join the open group.');
  assert.equal(save({ agentInstructions: '' }).config.agentInstructions, '');
});

test('a Group Agent setting saves in its checked form, signs no one out, and null turns it off', () => {
  const everyone = { match: 'any', conditions: [{ kind: 'agent_grant_scope', scope: 'ai' }] };
  const hosts = { match: 'any', conditions: [{ kind: 'worker_group', groupIds: ['hosts'] }] };
  const saved = setConfig({
    groupAgent: { audiences: [{ who: { match: 'any', conditions: [{ kind: 'worker_group', groupIds: [' Hosts '] }] }, answers: 'detailed' }, { who: everyone, answers: 'general' }], instructions: { general: ' Be brief. ' } },
  });
  assert.equal(saved.ok, true, JSON.stringify(saved));
  const groupAgent = { audiences: [{ who: hosts, answers: 'detailed' }, { who: everyone, answers: 'general' }], instructions: { general: 'Be brief.' } };
  assert.deepEqual(saved.config.groupAgent, groupAgent);
  assert.deepEqual(classify({}, { groupAgent }), { content: ['groupAgent'], authority: [], signsParticipantsOut: false });
  assert.equal(revokes({ groupAgent }, {}), false);
  const refused = setConfig({ groupAgent: { audiences: [{ who: everyone, answers: 'everything' }] } });
  assert.deepEqual(refused, { ok: false, status: 400, error: 'Invalid Group Agent setting: Audience 1 must get General or Detailed answers.' });
  const off = applySessionConfigMutation({
    existingConfig: { ...workerCanonicalConfig(), groupAgent },
    mutation: { kind: 'set-config', incomingConfig: { groupAgent: null } },
    slug: 'session-a',
  });
  assert.equal(off.ok, true, JSON.stringify(off));
  assert.equal(Object.hasOwn(off.config, 'groupAgent'), false);
});

test('lists each edited path as content or as a sign-out', () => {
  const before = {
    sessionName: 'A',
    defaultTags: 'x',
    interviewMode: { enabled: true, openingPrompt: 'Hi', hiddenDraftShare: 0 },
    agentHttp: { enabled: true, invites: [invite] },
  };
  const after = {
    sessionName: 'B',
    defaultTags: 'y',
    interviewMode: { enabled: true, openingPrompt: 'Hello', hiddenDraftShare: 0.5 },
    agentHttp: { enabled: true, invites: [invite, second] },
  };
  assert.deepEqual(classify(before, after), {
    content: ['sessionName', 'interviewMode.openingPrompt', 'interviewMode.hiddenDraftShare', 'agentHttp.invites'],
    authority: ['defaultTags'],
    signsParticipantsOut: true,
  });
  assert.deepEqual(classify(before, { ...before, sessionName: 'B' }),
    { content: ['sessionName'], authority: [], signsParticipantsOut: false });
  assert.deepEqual(classify(before, before), { content: [], authority: [], signsParticipantsOut: false });
  assert.deepEqual(classify(withInvites([invite]), withInvites([])),
    { content: [], authority: ['agentHttp.invites'], signsParticipantsOut: true });
  assert.deepEqual(classify({ interviewMode: 'legacy' }, { interviewMode: { openingPrompt: 'Hi' } }),
    { content: ['interviewMode'], authority: [], signsParticipantsOut: false });
  assert.deepEqual(classify({}, { sessionModeProfile: { preset: 'custom' } }),
    { content: [], authority: ['sessionModeProfile'], signsParticipantsOut: true });
});

test('the path lists agree with the Worker verdict for any pair of configs', () => {
  let seed = 7;
  const pick = (count) => { // mulberry32
    seed = (seed + 0x6d2b79f5) | 0;
    let mixed = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) % count;
  };
  const keys = ['sessionName', 'sessionContext', 'defaultTags', 'interviewMode', 'agentHttp', 'futureSetting'];
  const values = [undefined, null, 'a', 'b', ['x'], {}, { openingPrompt: 'a' }, { openingPrompt: 'b', enabled: true },
    { enabled: true }, { invites: [invite] }, { invites: [invite, second] }, { invites: [second], enabled: false }];
  const config = () => Object.fromEntries(keys.filter(() => pick(2)).map(key => [key, values[pick(values.length)]]));
  for (let run = 0; run < 3000; run += 1) {
    const before = config();
    const after = pick(3) ? { ...before, ...config() } : config();
    const result = classify(before, after);
    const label = JSON.stringify({ before, after });
    assert.equal(result.signsParticipantsOut, revokes(before, after), label);
    assert.equal(result.signsParticipantsOut, result.authority.length > 0, label);
  }
});

test('the preview matches the authorization epoch the Worker assigns on save', () => {
  const initialized = setConfig({
    ...workerCanonicalConfig(),
    sessionInfo: 'About',
    defaultTags: 'a, b',
    groupCreationPolicy: 'participants',
    interviewModeEnabled: true,
    interviewMode: { enabled: true, provider: 'openai', openingPrompt: 'Hi', steeringPrompt: '', hiddenDraftShare: 0 },
  });
  assert.equal(initialized.ok, true);
  const stored = initialized.config;
  const profile = stored.sessionModeProfile;
  for (const [patch, signsOut] of [
    [{ sessionName: 'Renamed' }, false],
    [{ sessionName: stored.sessionName }, false],
    [{
      sessionInfo: 'New text',
      sessionContext: { title: 'Read first', paragraphs: ['One'], links: [] },
      appearance: { colorSchemeId: 'ocean' },
      sessionHeaderImg: 'https://example.com/header.png',
      questionsGenPrompt: 'Ask about parks',
      agentInstructions: 'Join the Reviewers group.',
    }, false],
    [{ interviewMode: { ...stored.interviewMode, openingPrompt: 'Welcome', steeringPrompt: 'Stay on topic' } }, false],
    [{ interviewMode: { ...stored.interviewMode, hiddenDraftShare: 0.5 } }, false],
    [{ interviewMode: { ...stored.interviewMode, joinMatchingGroups: true, groupSuggestionData: ['town'] } }, false],
    [{ interviewModeEnabled: false, interviewMode: { ...stored.interviewMode, enabled: false } }, false],
    [{ interviewMode: { ...stored.interviewMode, hiddenDraftShare: 0.2 }, defaultTags: 'a, b, c' }, true],
    [{ defaultTags: 'a, b, c' }, true],
    [{ groupCreationPolicy: 'admin_only' }, true],
    [{ sessionName: 'Renamed', defaultTags: 'a, b, c' }, true],
    [{ sessionModeProfile: { ...profile, results: { ...profile.results, exposure: { ...profile.results.exposure, minGroupSize: 3 } } } }, true],
    [{ resultsAnalysis: { generationMode: 'automatic' } }, true],
    [{ HIGHLIGHTED_QUESTION_IDS: ['q1'], BLOCKED_SURVEY_IDS: ['s1'] }, false],
    [{ sessionName: 'Renamed', BLOCKED_QUESTION_IDS: ['q2'] }, false],
  ]) {
    const saved = applySessionConfigMutation({
      existingConfig: stored,
      mutation: { kind: 'set-config', incomingConfig: patch },
      slug: 'session-a',
    });
    const label = JSON.stringify(patch);
    assert.equal(saved.ok, true, label);
    assert.equal(saved.config.authzEpoch !== stored.authzEpoch, signsOut, label);
    assert.equal(classify(stored, { ...stored, ...patch }).signsParticipantsOut, signsOut, label);
  }
});
