import test from 'node:test';
import { AGENT_ACTIONS } from './constants.mjs';
import assert from 'node:assert/strict';
import { evaluateResponseActionPolicy, evaluateSbtJoinPolicy, evaluateLegacyGroupSessionAccess, evaluateSponsoredResourceEligibility, normalizeSessionPolicy, resolveAgentHttpSessionInvocation, resolveSessionInvocation } from './sessionPolicy.mjs';
test('session policy resolves defaults and invocation by slug or name', () => {
  const policy = normalizeSessionPolicy({
    defaultSessionSlug: 'alpha',
    riskCeiling: 'sponsored',
    sessions: [
      { sessionSlug: 'alpha', sessionName: 'Alpha Room', default: true, telegramBridgeEnabled: true },
      { sessionSlug: 'beta', sessionName: 'Beta Room', telegramBridgeEnabled: false },
    ],
  });

  assert.equal(resolveSessionInvocation(policy, '').session.sessionSlug, 'alpha');
  assert.equal(resolveSessionInvocation(policy, 'Alpha Room').session.sessionSlug, 'alpha');
  assert.equal(resolveSessionInvocation(policy, 'beta').reason, 'agent_http_disabled');
  assert.equal(resolveSessionInvocation(policy, 'missing').reason, 'session_not_linked');

  const workerSlugPolicy = normalizeSessionPolicy({
    defaultSessionSlug: 'telegram-demo-2',
    sessions: [{
      sessionSlug: 'telegram-demo-2',
      workerSessionSlug: 'custom-13-may-2026',
      workerLoginOrigin: 'http://localhost:3000',
      allowOrigins: ['http://localhost:3000', 'https://contextengine.xyz'],
      telegramBridgeEnabled: true,
    }],
  });
  const workerSlugSession = resolveSessionInvocation(workerSlugPolicy, 'telegram-demo-2').session;
  assert.equal(workerSlugSession.workerSessionSlug, 'custom-13-may-2026');
  assert.equal(workerSlugSession.workerLoginOrigin, 'http://localhost:3000');
  assert.deepEqual(workerSlugSession.allowOrigins, ['http://localhost:3000', 'https://contextengine.xyz']);

  const exportScopePolicy = normalizeSessionPolicy({
    defaultSessionSlug: 'envelope-export',
    sessions: [{
      sessionSlug: 'envelope-export',
      telegramBridgeEnabled: true,
      sessionModeProfile: {
        export: { scope: 'encrypted_envelopes_only' },
      },
    }],
  });
  assert.equal(
    resolveSessionInvocation(exportScopePolicy, 'envelope-export').session.exportScope,
    'encrypted_envelopes_only'
  );
});

test('agentHttp invocation remains enabled when the optional Telegram surface is off', () => {
  const policy = normalizeSessionPolicy({
    defaultSessionSlug: 'wrapped-alpha',
    sessions: [{
      sessionSlug: 'wrapped-alpha',
      sessionModeProfile: {
        surfaces: { agentHttp: true, telegram: false },
        authority: { mode: 'registry_canonical' },
      },
    }],
  });

  assert.equal(resolveSessionInvocation(policy, 'wrapped-alpha').ok, true);
  assert.equal(resolveAgentHttpSessionInvocation(policy, 'wrapped-alpha').session.sessionSlug, 'wrapped-alpha');
});

test('legacy Bridge sessions retain Agent HTTP unless they explicitly disable it', () => {
  const policy = normalizeSessionPolicy({
    sessions: [
      { sessionSlug: 'legacy-bridge', telegramBridgeEnabled: true },
      { sessionSlug: 'legacy-disabled', telegramBridgeEnabled: true, agentHttpEnabled: false },
    ],
  });

  assert.equal(resolveAgentHttpSessionInvocation(policy, 'legacy-bridge').ok, true);
  assert.equal(resolveAgentHttpSessionInvocation(policy, 'legacy-disabled').reason, 'agent_http_disabled');
});

test('legacy Agent HTTP aliases are fallback values rather than overrides', () => {
  const cases = [
    { flags: { agentHttpEnabled: false, agentHttp: true }, enabled: false },
    { flags: { agentHttpEnabled: 0, agentHttp: true }, enabled: false },
    { flags: { agentHttpEnabled: true, agentHttp: false }, enabled: true },
    { flags: { agentHttp: true }, enabled: true },
    { flags: { agentHttp: false }, enabled: false },
  ];
  for (const { flags, enabled } of cases) {
    const policy = normalizeSessionPolicy({
      sessions: [{ sessionSlug: 'legacy-flags', telegramBridgeEnabled: true, ...flags }],
    });
    const resolved = resolveAgentHttpSessionInvocation(policy, 'legacy-flags');
    assert.equal(resolved.ok, enabled, JSON.stringify(flags));
    if (!enabled) assert.equal(resolved.reason, 'agent_http_disabled');
  }
});

test('session policy prefers sessionModeProfile with legacy fallback', () => {
  const profilePolicy = normalizeSessionPolicy({
    defaultSessionSlug: 'profile-telegram',
    sessions: [
      {
        sessionSlug: 'profile-telegram',
        sessionName: 'Profile Telegram',
        telegramBridgeEnabled: false,
        sessionModeProfile: {
          profileVersion: 1,
          preset: 'custom',
          authority: { mode: 'worker_canonical' },
          evm: { registryChainId: null },
          storage: { backend: 'cloudflare' },
          identity: { default: 'passkey', enabled: ['passkey', 'telegram'] },
          authorization: { mechanisms: ['worker_roles'] },
          encryption: { mode: 'none' },
          surfaces: { web: true, telegram: true, miniApp: true, agentHttp: false, mcp: false, ceCc: false },
          results: { visibility: 'participant_aggregate' },
          export: { scope: 'admin_raw' },
        },
      },
      {
        sessionSlug: 'profile-web',
        sessionName: 'Profile Web',
        telegramBridgeEnabled: true,
        telegramOnly: true,
        sessionModeProfile: {
          profileVersion: 1,
          preset: 'custom',
          authority: { mode: 'worker_canonical' },
          evm: { registryChainId: null },
          storage: { backend: 'cloudflare' },
          identity: { default: 'passkey', enabled: ['passkey'] },
          authorization: { mechanisms: ['worker_roles'] },
          encryption: { mode: 'none' },
          surfaces: { web: true, telegram: false, miniApp: false, agentHttp: false, mcp: false, ceCc: false },
          results: { visibility: 'participant_aggregate' },
          export: { scope: 'admin_raw' },
        },
      },
      {
        sessionSlug: 'legacy-telegram',
        sessionName: 'Legacy Telegram',
        telegramOnly: true,
      },
    ],
  });

  const profileTelegram = resolveSessionInvocation(profilePolicy, 'profile-telegram');
  assert.equal(profileTelegram.ok, false);
  assert.equal(profileTelegram.reason, 'agent_http_disabled');
  assert.equal(profilePolicy.linkedSessions[0].telegramBridgeEnabled, true);
  assert.equal(profilePolicy.linkedSessions[0].telegramOnly, true);
  assert.equal(profilePolicy.linkedSessions[0].sessionModeProfile.surfaces.telegram, true);

  const profileWeb = resolveSessionInvocation(profilePolicy, 'profile-web');
  assert.equal(profileWeb.ok, false);
  assert.equal(profileWeb.reason, 'agent_http_disabled');

  const legacyTelegram = resolveSessionInvocation(profilePolicy, 'legacy-telegram');
  assert.equal(legacyTelegram.ok, true);
  assert.equal(legacyTelegram.session.telegramBridgeEnabled, true);
  assert.equal(legacyTelegram.session.telegramOnly, true);
});

test('session policy keeps the shared aggregate privacy threshold at two or more', () => {
  const policy = normalizeSessionPolicy({
    defaultSessionSlug: 'member-results',
    sessions: [{
      sessionSlug: 'member-results',
      telegramBridgeEnabled: true,
      resultsExposure: { minGroupSize: 1 },
    }],
  });

  const resolved = resolveSessionInvocation(policy, 'member-results');
  assert.equal(resolved.ok, true);
  assert.equal(resolved.session.resultsExposure.minGroupSize, 2);
});

test('session policy reads results exposure from the canonical session mode profile', () => {
  const policy = normalizeSessionPolicy({
    sessions: [{
      sessionSlug: 'profile-exposure',
      sessionModeProfile: {
        surfaces: { agentHttp: true, telegram: false, miniApp: false },
        results: {
          exposure: {
            aggregateResultsEnabled: false,
            anonymizedGroupsEnabled: true,
            minGroupSize: 9,
          },
        },
      },
    }],
  });

  const resolved = resolveAgentHttpSessionInvocation(policy, 'profile-exposure');
  assert.equal(resolved.session.resultsExposure.aggregateResultsEnabled, false);
  assert.equal(resolved.session.resultsExposure.anonymizedGroupsEnabled, true);
  assert.equal(resolved.session.resultsExposure.minGroupSize, 9);
});

test('session policy can switch the default Telegram demo session by date', () => {
  const base = {
    default: 'ee-26-organizers',
    defaultSessionSchedule: [
      { sessionSlug: 'ee-26-organizers', until: '2026-05-30T00:00:00Z' },
      { sessionSlug: 'ee-26-users', from: '2026-05-30T00:00:00Z' },
    ],
    sessions: [
      {
        sessionSlug: 'ee-26-test',
        sessionName: 'EE26 Test',
        telegramBridgeEnabled: true,
        telegramOnly: true,
        createdAt: '2026-05-29T00:00:00Z',
      },
      {
        sessionSlug: 'ee-26-organizers',
        sessionName: 'EE26 Organizers',
        telegramBridgeEnabled: true,
        telegramOnly: true,
        createdAt: '2026-05-29T01:00:00Z',
      },
      {
        sessionSlug: 'ee-26-users',
        sessionName: 'EE26 Users',
        telegramBridgeEnabled: true,
        telegramOnly: true,
        createdAt: '2026-05-29T02:00:00Z',
      },
    ],
  };
  const beforeMay30 = normalizeSessionPolicy(base, { now: '2026-05-29T23:59:59Z' });
  const onMay30 = normalizeSessionPolicy(base, { now: '2026-05-30T00:00:00Z' });

  assert.equal(beforeMay30.defaultSessionSlug, 'ee-26-organizers');
  assert.equal(resolveSessionInvocation(beforeMay30, '').session.sessionSlug, 'ee-26-organizers');
  assert.equal(onMay30.defaultSessionSlug, 'ee-26-users');
  assert.equal(resolveSessionInvocation(onMay30, '').session.sessionSlug, 'ee-26-users');
  assert.equal(onMay30.configuredDefaultSessionSlug, 'ee-26-organizers');
  assert.deepEqual(onMay30.linkedSessions.map((session) => [session.sessionSlug, session.createdAt]), [
    ['ee-26-test', '2026-05-29T00:00:00Z'],
    ['ee-26-organizers', '2026-05-29T01:00:00Z'],
    ['ee-26-users', '2026-05-29T02:00:00Z'],
  ]);

  const invalidSchedule = normalizeSessionPolicy({
    ...base,
    defaultSessionSchedule: [{ from: 'not-a-date', sessionSlug: 'ee-26-users' }],
  }, { now: '2026-05-30T12:00:00-07:00' });
  assert.equal(invalidSchedule.defaultSessionSlug, 'ee-26-organizers');
});

test('Telegram group session access is closed by default unless explicitly open or approved', () => {
  const policy = normalizeSessionPolicy({
    defaultSessionSlug: 'alpha',
    sessions: [
      { sessionSlug: 'alpha', sessionName: 'Alpha Room', telegramBridgeEnabled: true },
      { sessionSlug: 'beta', sessionName: 'Beta Room', telegramBridgeEnabled: true, telegramGroupOpenAccess: true },
      { sessionSlug: 'gamma', sessionName: 'Gamma Room', telegramBridgeEnabled: true, approvedTelegramGroupChatIds: ['-100123'] },
    ],
  });

  assert.equal(evaluateLegacyGroupSessionAccess(policy.linkedSessions[0], { chatId: '-100123' }).ok, false);
  assert.equal(evaluateLegacyGroupSessionAccess(policy.linkedSessions[0], { chatId: '-100123' }).reason, 'telegram_group_not_approved_for_session');
  assert.equal(evaluateLegacyGroupSessionAccess(policy.linkedSessions[1], { chatId: '-100999' }).ok, true);
  assert.equal(evaluateLegacyGroupSessionAccess(policy.linkedSessions[1], { chatId: '-100999' }).telegramGroupOpenAccess, true);
  assert.equal(evaluateLegacyGroupSessionAccess(policy.linkedSessions[2], { chatId: '-100123' }).ok, true);
  assert.equal(evaluateLegacyGroupSessionAccess(policy.linkedSessions[2], { chatId: '-100999' }).ok, false);
});

test('SBT join and sponsored resources follow session policy without exposing secrets', () => {
  const session = {
    sbtJoinModes: ['password'],
    sponsoredAiAllowed: true,
    sponsoredRpcAllowed: true,
    sponsoredFaucetAllowed: false,
  };

  assert.deepEqual(evaluateSbtJoinPolicy({ sbtJoinModes: ['public'] }), {
    ok: true,
    reason: 'sbt_public_open_join_allowed',
    requiresPassword: false,
  });
  assert.equal(evaluateSbtJoinPolicy(session).reason, 'sbt_password_required');
  assert.equal(evaluateSbtJoinPolicy(session, { password: 'demo' }).ok, true);
  assert.equal(evaluateSponsoredResourceEligibility(session, { resource: 'ai' }).ok, true);
  assert.equal(evaluateSponsoredResourceEligibility(session, { resource: 'rpc' }).ok, true);
  assert.equal(evaluateSponsoredResourceEligibility(session, { resource: 'faucet' }).ok, false);
  assert.equal(evaluateSponsoredResourceEligibility(session, { resource: 'ai' }).secretExposed, false);
});

test('direct submit is limited to allowed managed Telegram demo accounts', () => {
  const session = { managedAccountSubmitAllowed: true };
  const managedAccount = { accountMode: 'managed_telegram_demo' };
  const grant = {
    allowedActions: [AGENT_ACTIONS.DIRECT_SUBMIT_RESPONSE],
    riskCeiling: 'submit',
  };

  assert.equal(evaluateResponseActionPolicy({
    account: managedAccount,
    grant,
    session,
    action: AGENT_ACTIONS.DIRECT_SUBMIT_RESPONSE,
  }).ok, true);
  assert.equal(evaluateResponseActionPolicy({
    account: { accountMode: 'linked_external_wallet' },
    grant,
    session,
    action: AGENT_ACTIONS.DIRECT_SUBMIT_RESPONSE,
  }).reason, 'direct_submit_managed_demo_only');
  assert.equal(evaluateResponseActionPolicy({
    account: managedAccount,
    grant: { ...grant, riskCeiling: 'draft' },
    session,
    action: AGENT_ACTIONS.DIRECT_SUBMIT_RESPONSE,
  }).reason, 'risk_ceiling_exceeded');
});
