import test from 'node:test';
import assert from 'node:assert/strict';
import { TELEGRAM_BRIDGE_ACTIONS } from './constants.mjs';
import {
  TELEGRAM_SCREEN_IDS,
  assertQuestionCardParity,
  buildSessionStorageAccessContract,
  buildTelegramCreateSbtGroupState,
  buildTelegramGeneratedQuestionCandidatesState,
  buildTelegramGroupSessionCardState,
  buildTelegramJoinPasswordSbtState,
  buildTelegramJoinPublicSbtState,
  buildTelegramMyAccountState,
  buildTelegramPoseQuestionState,
  buildTelegramPrivateQuestionReadState,
  buildTelegramQuestionAccessState,
  buildTelegramQuestionCard,
  buildTelegramQuestionControls,
  buildTelegramQuestionListState,
  buildTelegramSbtGroupCardState,
  buildTelegramScreenState,
  buildTelegramSessionSbtGateJoinState,
  buildTelegramSubmitResponseState,
  createTelegramPrivateQuestionDecryptRequest,
  listTelegramScreenLaunchContracts,
  parseTelegramSbtCommand,
} from './questionUi.mjs';
import {
  evaluateSessionSbtGateJoin,
  evaluateResponseActionPolicy,
  evaluateSbtJoinPolicy,
  evaluateTelegramGroupSessionAccess,
  evaluateSponsoredResourceEligibility,
  normalizeSessionPolicy,
  resolveAgentHttpSessionInvocation,
  resolveMiniAppSessionInvocation,
  resolveSessionInvocation,
} from './sessionPolicy.mjs';

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
  assert.equal(resolveSessionInvocation(policy, 'beta').reason, 'telegram_bridge_disabled');
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

  assert.equal(resolveSessionInvocation(policy, 'wrapped-alpha').reason, 'telegram_bridge_disabled');
  assert.equal(resolveAgentHttpSessionInvocation(policy, 'wrapped-alpha').session.sessionSlug, 'wrapped-alpha');
});

test('Mini App invocation requires both Telegram and the Telegram Mini App surface', () => {
  const policy = normalizeSessionPolicy({
    sessions: [
      {
        sessionSlug: 'telegram-only',
        sessionModeProfile: { surfaces: { telegram: true, miniApp: false } },
      },
      {
        sessionSlug: 'mini-app',
        sessionModeProfile: { surfaces: { telegram: true, miniApp: true } },
      },
    ],
  });

  assert.equal(resolveSessionInvocation(policy, 'telegram-only').ok, true);
  assert.equal(resolveMiniAppSessionInvocation(policy, 'telegram-only').reason, 'mini_app_disabled');
  assert.equal(resolveMiniAppSessionInvocation(policy, 'mini-app').session.sessionSlug, 'mini-app');
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
  assert.equal(profileTelegram.ok, true);
  assert.equal(profileTelegram.session.telegramBridgeEnabled, true);
  assert.equal(profileTelegram.session.telegramOnly, true);
  assert.equal(profileTelegram.session.sessionModeProfile.surfaces.telegram, true);

  const profileWeb = resolveSessionInvocation(profilePolicy, 'profile-web');
  assert.equal(profileWeb.ok, false);
  assert.equal(profileWeb.reason, 'telegram_bridge_disabled');

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
        surfaces: { telegram: true, miniApp: true },
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

  const resolved = resolveMiniAppSessionInvocation(policy, 'profile-exposure');
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

  assert.equal(evaluateTelegramGroupSessionAccess(policy.linkedSessions[0], { chatId: '-100123' }).ok, false);
  assert.equal(evaluateTelegramGroupSessionAccess(policy.linkedSessions[0], { chatId: '-100123' }).reason, 'telegram_group_not_approved_for_session');
  assert.equal(evaluateTelegramGroupSessionAccess(policy.linkedSessions[1], { chatId: '-100999' }).ok, true);
  assert.equal(evaluateTelegramGroupSessionAccess(policy.linkedSessions[1], { chatId: '-100999' }).telegramGroupOpenAccess, true);
  assert.equal(evaluateTelegramGroupSessionAccess(policy.linkedSessions[2], { chatId: '-100123' }).ok, true);
  assert.equal(evaluateTelegramGroupSessionAccess(policy.linkedSessions[2], { chatId: '-100999' }).ok, false);
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
    allowedActions: [TELEGRAM_BRIDGE_ACTIONS.DIRECT_SUBMIT_RESPONSE],
    riskCeiling: 'submit',
  };

  assert.equal(evaluateResponseActionPolicy({
    account: managedAccount,
    grant,
    session,
    action: TELEGRAM_BRIDGE_ACTIONS.DIRECT_SUBMIT_RESPONSE,
  }).ok, true);
  assert.equal(evaluateResponseActionPolicy({
    account: { accountMode: 'linked_external_wallet' },
    grant,
    session,
    action: TELEGRAM_BRIDGE_ACTIONS.DIRECT_SUBMIT_RESPONSE,
  }).reason, 'direct_submit_managed_demo_only');
  assert.equal(evaluateResponseActionPolicy({
    account: managedAccount,
    grant: { ...grant, riskCeiling: 'draft' },
    session,
    action: TELEGRAM_BRIDGE_ACTIONS.DIRECT_SUBMIT_RESPONSE,
  }).reason, 'risk_ceiling_exceeded');
});

test('Telegram question cards preserve CE rating/comment/mic/doc conventions by type', () => {
  const rating = buildTelegramQuestionCard({
    questionId: 'rating-1',
    questionType: 'rating',
    prompt: 'Rate readiness',
    ratingScale: { min: 1, max: 5 },
  }, {
    docsExist: true,
  });
  const ratingControls = buildTelegramQuestionControls({
    questionId: 'rating-1',
    questionType: 'rating',
    ratingScale: { min: 1, max: 5 },
  }, {
    docsExist: true,
  });
  const binary = buildTelegramQuestionCard({
    questionId: 'binary-1',
    questionType: 'binary',
    prompt: 'Do you agree?',
  });
  const singleChoice = buildTelegramQuestionCard({
    questionId: 'single-1',
    questionType: 'multichoice',
    prompt: 'Pick one',
    singleSelect: true,
    options: ['Alpha', 'Beta'],
  });
  const multiChoice = buildTelegramQuestionCard({
    questionId: 'multi-1',
    questionType: 'multi_choice',
    prompt: 'Pick many',
    selectedValues: ['Beta'],
    options: ['Alpha', 'Beta'],
  });
  const freeform = buildTelegramQuestionCard({
    questionId: 'freeform-1',
    questionType: 'freeform',
    prompt: 'Explain',
  });
  const docsRelevant = buildTelegramQuestionCard({
    questionId: 'freeform-docs-1',
    questionType: 'freeform',
    prompt: 'Explain with context',
  }, {
    docsRelevant: true,
  });

  assert.deepEqual(
    rating.controls
      .filter((control) => control.controlType === 'rating_button')
      .map((control) => control.value),
    [1, 2, 3, 4, 5],
  );
  assert.equal(rating.controls.find((control) => control.value === 5).label, '5');
  assert.equal(rating.controls.find((control) => control.controlType === 'rating_button').min, 1);
  assert.equal(rating.controls.find((control) => control.controlType === 'rating_button').max, 5);
  assert.equal(ratingControls.some((control) => control.action === TELEGRAM_BRIDGE_ACTIONS.ADDITIONAL_COMMENTS), true);
  assert.equal(ratingControls.some((control) => control.action === TELEGRAM_BRIDGE_ACTIONS.MICROPHONE_INPUT), true);
  assert.equal(ratingControls.some((control) => control.action === TELEGRAM_BRIDGE_ACTIONS.DOC_CONTEXT), true);

  assert.deepEqual(
    binary.controls
      .filter((control) => control.controlType === 'agree_unsure_disagree')
      .map((control) => control.label),
    ['Agree', 'Disagree', 'Unsure'],
  );
  assert.equal(singleChoice.selectionMode, 'single');
  assert.equal(singleChoice.controls.filter((control) => control.controlType === 'single_select').length, 2);
  assert.equal(multiChoice.selectionMode, 'multi');
  assert.deepEqual(
    multiChoice.controls
      .filter((control) => control.controlType === 'multi_select_toggle')
      .map((control) => [control.label, control.selected]),
    [['Alpha', false], ['Beta', true]],
  );
  assert.equal(freeform.controls.some((control) => control.controlType === 'text_input' && control.label === 'Type'), true);
  assert.equal(freeform.controls.some((control) => control.controlType === 'voice_input' && control.label === 'Voice'), true);
  assert.equal(freeform.controls.some((control) => control.action === TELEGRAM_BRIDGE_ACTIONS.DOC_CONTEXT), false);
  assert.equal(docsRelevant.controls.some((control) => control.action === TELEGRAM_BRIDGE_ACTIONS.DOC_CONTEXT), true);

  assert.deepEqual(assertQuestionCardParity(rating), {
    ok: true,
    reason: 'telegram_question_card_matches_ce_conventions',
  });
  assert.deepEqual(assertQuestionCardParity(singleChoice), {
    ok: true,
    reason: 'telegram_question_card_matches_ce_conventions',
  });
  assert.deepEqual(assertQuestionCardParity(multiChoice), {
    ok: true,
    reason: 'telegram_question_card_matches_ce_conventions',
  });
  assert.deepEqual(assertQuestionCardParity(freeform), {
    ok: true,
    reason: 'telegram_question_card_matches_ce_conventions',
  });
  assert.deepEqual(assertQuestionCardParity(docsRelevant), {
    ok: true,
    reason: 'telegram_question_card_matches_ce_conventions',
  });
});

test('screen states expose launch commands and current UX copy', () => {
  const states = TELEGRAM_SCREEN_IDS.map((screen) => buildTelegramScreenState(screen, { status: 'ready' }));
  const launches = listTelegramScreenLaunchContracts();

  assert.equal(states.length, 36);
  assert.equal(states.every((state) => state.type === 'telegram_screen_state'), true);
  assert.deepEqual(states.map((state) => state.screen), TELEGRAM_SCREEN_IDS);
  assert.deepEqual(launches.map((entry) => entry.screen), TELEGRAM_SCREEN_IDS);
  for (const state of states) {
    assert.equal(typeof state.launch, 'object', state.screen);
    assert.equal(
      Boolean(state.launch.command || state.launch.callback || state.launch.deepLink),
      true,
      state.screen,
    );
  }

  const docLibrary = states.find((state) => state.screen === 'doc_library');
  assert.equal(docLibrary.title, 'Attachments');
  assert.equal(docLibrary.buttonLabel, 'Attachments');
  assert.equal(docLibrary.launch.command, '/attachments');
  assert.deepEqual(docLibrary.launch.aliases, ['/docs']);

  const onboarding = states.find((state) => state.screen === 'onboarding');
  assert.equal(onboarding.text, 'Enter startup info so I can suggest answers for you.');
  assert.equal(onboarding.launch.command, '/onboarding');

  const accountCreated = states.find((state) => state.screen === 'account_created');
  assert.equal(JSON.stringify(accountCreated).includes('Open in CE'), false);

  const actionMenu = states.find((state) => state.screen === 'agent_action_menu');
  assert.equal(actionMenu.title, 'Agent Actions');
  assert.equal(actionMenu.launch.command, '/agent');
  assert.equal(actionMenu.launch.aliases, undefined);
  assert.deepEqual(actionMenu.buttons.map((button) => button.label), ['Settings', 'View Questions']);

  const agentCreate = states.find((state) => state.screen === 'agent_account_create');
  assert.equal(agentCreate.launch.command, '/create_agent');
  assert.equal(agentCreate.launch.deepLink, 't.me/<bot>?start=<opaque-action-id>');

  const settings = states.find((state) => state.screen === 'agent_settings_overview');
  assert.equal(settings.launch.command, '/settings');
  assert.equal(settings.buttons.find((button) => button.label === 'Edit Settings').targetLane, 'telegram_mini_app');

  const poseQuestion = states.find((state) => state.screen === 'pose_question');
  assert.equal(poseQuestion.title, 'Pose Question');
  assert.equal(poseQuestion.launch.command, '/pose_question');
  assert.deepEqual(poseQuestion.launch.aliases, ['/q']);
  assert.deepEqual(poseQuestion.launch.deprecatedAliases, ['/drop_question']);
  assert.equal(poseQuestion.launch.callback, 'callback:<pose_question_action>');

  const sbtGroup = states.find((state) => state.screen === 'sbt_group_card');
  assert.equal(sbtGroup.launch.command, '/sbt <sbt-address-or-group-id-or-link>');
  const joinSbt = states.find((state) => state.screen === 'join_public_sbt');
  assert.equal(joinSbt.launch.command, '/join_sbt <sbt-address-or-invite-code-or-link>');
  const createSbt = states.find((state) => state.screen === 'create_sbt_group');
  assert.equal(createSbt.launch.command, '/create_sbt_group [session-slug]');
  assert.equal(JSON.stringify(launches).includes('/sbt_join'), false);
  assert.equal(JSON.stringify(launches).includes('/sbt_create'), false);

  const submitResponse = states.find((state) => state.screen === 'submit_response');
  assert.equal(submitResponse.title, 'Submit Response');

  const confirmation = states.find((state) => state.screen === 'confirmation_signing');
  assert.equal(confirmation.text, 'Submit this response?');
  assert.deepEqual(confirmation.buttons.map((button) => button.label), ['Save draft', 'Edit']);
  assert.equal(JSON.stringify(confirmation).includes('managed demo account'), false);
});

test('group session card uses safe public copy and required lobby buttons', () => {
  const card = buildTelegramGroupSessionCardState({
    sessionSlug: 'alpha',
    sessionName: 'Alpha',
    policy: {
      allowAddQuestion: true,
      allowQuestionGeneration: true,
    },
  });

  assert.equal(card.text, 'Session: Alpha');
  assert.deepEqual(card.buttons.map((button) => button.label), [
    'Join Session',
    'View Questions',
    'Pose Question',
  ]);
  assert.equal(card.buttons.find((button) => button.label === 'Pose Question').command, '/pose_question');
  assert.equal(card.buttons.some((button) => button.label === 'Answer Privately'), false);
  assert.equal(card.defaultAction, TELEGRAM_BRIDGE_ACTIONS.VIEW_QUESTIONS);
  assert.deepEqual(card.policyActions.map((button) => button.action), [
    TELEGRAM_BRIDGE_ACTIONS.ADD_QUESTION,
    TELEGRAM_BRIDGE_ACTIONS.GENERATE_QUESTION,
  ]);
});

test('SBT command parser accepts explicit public targets and keeps credentials private', () => {
  const address = '0x1111111111111111111111111111111111111111';
  const byAddress = parseTelegramSbtCommand(`/sbt ${address}`);
  const legacyByAddress = parseTelegramSbtCommand(`/ce_sbt ${address}`);
  const byGroupId = parseTelegramSbtCommand('/sbt alpha-contributors');
  const joinPublic = parseTelegramSbtCommand(`/join_sbt ${address}`);
  const joinInviteFromGroup = parseTelegramSbtCommand('/join_sbt invite:alpha-invite-code', {
    lane: 'telegram_group_lobby',
  });
  const joinInvitePrivately = parseTelegramSbtCommand('/join_sbt invite:alpha-invite-code', {
    lane: 'telegram_mini_app',
  });
  const createForSession = parseTelegramSbtCommand('/create_sbt_group alpha');
  const createWithCredential = parseTelegramSbtCommand('/create_sbt_group password:do-not-serialize', {
    lane: 'telegram_group_lobby',
  });

  assert.equal(byAddress.ok, true);
  assert.equal(byAddress.targetKind, 'sbt_address');
  assert.equal(byAddress.target, address);
  assert.equal(legacyByAddress.ok, true);
  assert.equal(legacyByAddress.command, '/sbt');
  assert.equal(legacyByAddress.target, address);
  assert.equal(byGroupId.ok, true);
  assert.equal(byGroupId.targetKind, 'sbt_group_id');
  assert.equal(byGroupId.publicCommandTargetAllowed, true);
  assert.equal(joinPublic.ok, true);
  assert.equal(joinPublic.command, '/join_sbt');
  assert.equal(joinPublic.targetLane, 'telegram_private_account');
  assert.equal(joinInviteFromGroup.ok, false);
  assert.equal(joinInviteFromGroup.reason, 'private_sbt_credential_required');
  assert.equal(joinInviteFromGroup.requiresPrivateLane, true);
  assert.equal(joinInviteFromGroup.target, null);
  assert.equal(JSON.stringify(joinInviteFromGroup).includes('alpha-invite-code'), false);
  assert.equal(joinInvitePrivately.ok, true);
  assert.equal(joinInvitePrivately.credentialRef, 'telegram_private_input_ref');
  assert.equal(JSON.stringify(joinInvitePrivately).includes('alpha-invite-code'), false);
  assert.equal(createForSession.ok, true);
  assert.equal(createForSession.command, '/create_sbt_group');
  assert.equal(createForSession.sessionSlug, 'alpha');
  assert.equal(createWithCredential.ok, false);
  assert.equal(createWithCredential.requiresPrivateLane, true);
  assert.equal(JSON.stringify(createWithCredential).includes('do-not-serialize'), false);
});

test('question list pulls existing session questions and pose action is group-safe', () => {
  const questions = [
    {
      questionId: 'q-public',
      questionType: 'freeform',
      prompt: 'What should the group discuss next?',
      options: [],
    },
    {
      questionId: 'q-private',
      questionType: 'freeform',
      prompt: 'Private prompt must stay out of group summaries',
      visibility: 'sbt_gated',
    },
    {
      questionId: 'q-unavailable',
      questionType: 'unknown',
      payloadUnavailable: true,
      title: 'Question unavailable',
    },
  ];
  const list = buildTelegramQuestionListState({
    sessionSlug: 'alpha',
    questions,
  });
  const posed = buildTelegramPoseQuestionState({
    sessionSlug: 'alpha',
    question: questions[0],
  });
  const locked = buildTelegramPoseQuestionState({
    sessionSlug: 'alpha',
    question: questions[1],
  });

  assert.equal(list.source, 'canonical_agent_questions');
  assert.equal(list.canonicalApiRequest.path, '/api/agent/questions');
  assert.deepEqual(list.questions.map((question) => question.title), [
    'What should the group discuss next?',
    'Encrypted question',
    'Question unavailable',
  ]);
  assert.equal(list.questions[2].locked, false);
  assert.equal(list.questions[2].payloadUnavailable, true);
  assert.equal(list.questions[2].retryable, true);
  assert.equal(posed.action.action, TELEGRAM_BRIDGE_ACTIONS.POSE_QUESTION);
  assert.equal(posed.action.command, '/pose_question');
  assert.deepEqual(posed.action.aliases, ['/q']);
  assert.equal(posed.groupSafeOutput.questionText, 'What should the group discuss next?');
  assert.equal(locked.groupSafeOutput.questionText, null);
  assert.equal(locked.groupSafeOutput.encrypted, true);
  assert.equal(JSON.stringify(locked).includes('Private prompt must stay out of group summaries'), false);
  const unavailable = buildTelegramPoseQuestionState({
    sessionSlug: 'alpha',
    question: questions[2],
  });
  assert.equal(unavailable.card, null);
  assert.equal(unavailable.groupSafeOutput.locked, false);
  assert.equal(unavailable.groupSafeOutput.payloadUnavailable, true);
  assert.equal(unavailable.groupSafeOutput.status, 'payload_unavailable');
});

test('SBT group screens support public/password joins and account summaries without private leaks', () => {
  const sbt = {
    sbtAddress: '0xabc123',
    name: 'Alpha Contributors',
    description: 'Public group card',
    joinMode: 'public',
    sessionSlug: 'alpha',
    holderAddresses: ['0xshould-not-leak'],
  };
  const account = {
    accountAddress: '0x1111111111111111111111111111111111111111',
    privateKey: `0x${'22'.repeat(32)}`,
  };
  const publicJoin = buildTelegramJoinPublicSbtState({
    sbt,
    session: { sessionSlug: 'alpha', sbtJoinModes: ['public'] },
    account,
  });
  const passwordRequired = buildTelegramJoinPasswordSbtState({
    sbt,
    session: { sessionSlug: 'alpha', sbtJoinModes: ['password'] },
    account,
  });
  const passwordEntered = buildTelegramJoinPasswordSbtState({
    sbt,
    session: { sessionSlug: 'alpha', sbtJoinModes: ['password'] },
    account,
    credentialEntered: true,
  });
  const card = buildTelegramSbtGroupCardState({ sbt });
  const accountState = buildTelegramMyAccountState({
    account,
    joinedSessions: [{ sessionSlug: 'alpha', sessionName: 'Alpha' }],
    joinedSbts: [sbt],
  });

  assert.deepEqual(card.buttons.map((button) => button.label), ['Join SBT', 'Details', 'My Account']);
  assert.equal(card.privateHolderMetadataIncluded, false);
  assert.equal(JSON.stringify(card).includes('holderAddresses'), false);
  assert.equal(publicJoin.joinAvailable, true);
  assert.equal(publicJoin.canonicalApiRequest.path, '/api/agent/sbt-groups/claim-request');
  assert.equal(passwordRequired.credentialRequired, true);
  assert.equal(passwordRequired.joinAvailable, false);
  assert.equal(passwordRequired.canonicalApiRequest, null);
  assert.equal(passwordEntered.joinAvailable, true);
  assert.equal(passwordEntered.canonicalApiRequest.body.credentialRef, 'telegram_private_input_ref');
  assert.equal(JSON.stringify(passwordEntered).includes('provided-by-private-input'), false);
  assert.equal(accountState.managedAddress, account.accountAddress);
  assert.deepEqual(accountState.joinedSbts.map((entry) => entry.name), ['Alpha Contributors']);
  assert.equal(JSON.stringify(accountState).includes(account.privateKey), false);
});

test('session join flow models required SBT gates without leaking private eligibility inputs', () => {
  const session = {
    sessionSlug: 'alpha',
    sessionName: 'Alpha',
    requiredSbtGroups: [
      {
        sbtAddress: '0x2222222222222222222222222222222222222222',
        name: 'Open Alpha',
        joinMode: 'public',
        holderAddresses: ['0xholder-should-not-leak'],
      },
      {
        groupId: 'review-password',
        name: 'Review Password',
        joinMode: 'password',
        credential: 'hunter2',
      },
      {
        shareLink: 'https://t.me/ce_demo_bot?start=sbt-public-review',
        name: 'Invite Review',
        joinMode: 'invite',
        inviteCode: 'invite-code-should-not-leak',
      },
      {
        groupId: 'wallet-only',
        name: 'Wallet Only',
        joinMode: 'passkey',
        walletProof: 'wallet-proof-should-not-leak',
      },
    ],
  };
  const evaluation = evaluateSessionSbtGateJoin(session, {
    joinedSbtIds: ['0x2222222222222222222222222222222222222222'],
  });
  const gateState = buildTelegramSessionSbtGateJoinState({
    session,
    joinedSbtIds: ['0x2222222222222222222222222222222222222222'],
  });
  const satisfiedState = buildTelegramSessionSbtGateJoinState({
    session,
    joinedSbtIds: [
      '0x2222222222222222222222222222222222222222',
      'review-password',
      'https://t.me/ce_demo_bot?start=sbt-public-review',
      'wallet-only',
    ],
  });

  assert.equal(evaluation.ok, false);
  assert.equal(evaluation.requiredSbtGroups.length, 4);
  assert.equal(gateState.screen, 'session_join_sbt_gate');
  assert.equal(gateState.status, 'sbt_gate_required');
  assert.equal(gateState.requiredSbtGroups[0].joined, true);
  assert.equal(gateState.requiredSbtGroups[0].action.action, TELEGRAM_BRIDGE_ACTIONS.RETRY_SESSION_JOIN);
  assert.equal(gateState.requiredSbtGroups[1].credentialRequired, true);
  assert.equal(gateState.requiredSbtGroups[1].action.targetLane, 'telegram_mini_app');
  assert.equal(gateState.requiredSbtGroups[1].action.credentialRef, 'telegram_private_input_ref');
  assert.equal(gateState.requiredSbtGroups[2].action.credentialType, 'invite');
  assert.equal(gateState.requiredSbtGroups[3].requiresFullCeAccount, true);
  assert.equal(gateState.requiredSbtGroups[3].action.action, TELEGRAM_BRIDGE_ACTIONS.LINK_FULL_CE_ACCOUNT);
  assert.equal(gateState.requiredSbtGroups[3].action.targetLane, 'telegram_mini_app');
  assert.equal(JSON.stringify(gateState).includes('hunter2'), false);
  assert.equal(JSON.stringify(gateState).includes('invite-code-should-not-leak'), false);
  assert.equal(JSON.stringify(gateState).includes('wallet-proof-should-not-leak'), false);
  assert.equal(JSON.stringify(gateState).includes('holderAddresses'), false);
  assert.equal(satisfiedState.status, 'ready_to_retry_session_join');
  assert.equal(satisfiedState.joinAvailable, true);
  assert.equal(satisfiedState.retryAction.action, TELEGRAM_BRIDGE_ACTIONS.RETRY_SESSION_JOIN);
  assert.equal(satisfiedState.retryAction.command, '/join');
});

test('create SBT group uses planned canonical agent contract and Mini App fields', () => {
  const state = buildTelegramCreateSbtGroupState({
    sessionSlug: 'alpha',
    fields: {
      name: 'Review Crew',
      description: 'Session reviewers',
      image: 'https://example.test/review.png',
      visibility: 'public',
      joinMode: 'password',
      credentialConfigured: true,
    },
  });

  assert.equal(state.preferredLane, 'telegram_mini_app');
  assert.equal(state.fields.name, 'Review Crew');
  assert.equal(state.fields.credentialConfigured, true);
  assert.equal(state.canonicalApiRequest.path, '/api/agent/sbt-groups/create-request');
  assert.equal(state.canonicalApiRequest.status, 'planned_contract_only');
  assert.equal(state.contractOnlyPlaceholder, true);
});

test('private question states keep group locked and request decrypt only through canonical API', () => {
  const privateQuestion = {
    questionId: 'q-private',
    questionType: 'freeform',
    prompt: 'Encrypted prompt visible only to eligible accounts',
    context: 'Encrypted context visible only privately',
    visibility: 'lit_encrypted',
  };
  const lockedGroup = buildTelegramQuestionAccessState({
    sessionSlug: 'alpha',
    question: privateQuestion,
    eligible: false,
  });
  const eligibleRequest = createTelegramPrivateQuestionDecryptRequest({
    sessionSlug: 'alpha',
    question: privateQuestion,
    account: {
      accountId: 'acct-1',
      accountAddress: '0x1111111111111111111111111111111111111111',
    },
    eligible: true,
  });
  const ineligibleRequest = createTelegramPrivateQuestionDecryptRequest({
    sessionSlug: 'alpha',
    question: privateQuestion,
    eligible: false,
  });
  const lockedPose = buildTelegramPoseQuestionState({
    sessionSlug: 'alpha',
    question: privateQuestion,
  });
  const privateRead = buildTelegramPrivateQuestionReadState({
    sessionSlug: 'alpha',
    question: privateQuestion,
    decrypted: {
      prompt: privateQuestion.prompt,
      context: privateQuestion.context,
    },
    lane: 'telegram_group_lobby',
    eligible: true,
  });

  assert.equal(lockedGroup.screen, 'locked_private_question');
  assert.equal(lockedGroup.groupSafeOutput.questionText, null);
  assert.equal(JSON.stringify(lockedGroup).includes(privateQuestion.prompt), false);
  assert.equal(JSON.stringify(lockedPose.action).includes(privateQuestion.prompt), false);
  assert.equal(lockedPose.action.callback.includes(privateQuestion.prompt), false);
  assert.equal(Object.hasOwn(lockedPose.action, 'deepLink'), false);
  assert.equal(eligibleRequest.ok, true);
  assert.equal(eligibleRequest.canonicalApiRequest.path, '/api/agent/decrypt/request');
  assert.equal(eligibleRequest.telegramDecryptImplemented, false);
  assert.equal(ineligibleRequest.ok, false);
  assert.equal(ineligibleRequest.status, 'locked_unavailable');
  assert.equal(privateRead.targetLane, 'telegram_private_account');
  assert.equal(privateRead.decryptedPrompt, privateQuestion.prompt);
  assert.equal(JSON.stringify({
    summary: lockedGroup.groupSafeOutput,
    refs: { requestId: eligibleRequest.requestId },
  }).includes(privateQuestion.prompt), false);
  assert.equal(JSON.stringify(lockedGroup).includes(privateQuestion.context), false);
  assert.equal(JSON.stringify(eligibleRequest).includes(privateQuestion.prompt), false);
});

test('Cloudflare storage access is session-config selected and does not require Lit unless payload encrypted', () => {
  const cloudflareAccess = buildSessionStorageAccessContract({
    sessionSlug: 'alpha',
    storageProfile: 'cloudflare',
    resource: 'docs',
    gate: {
      mode: 'Any',
      sbtAddresses: ['0xabc123'],
    },
    payloadEncrypted: false,
  });
  const encryptedAccess = buildSessionStorageAccessContract({
    sessionSlug: 'alpha',
    storageProfile: 'cloudflare',
    resource: 'docs',
    gate: {
      mode: 'Any',
      sbtAddresses: ['0xabc123'],
    },
    payloadEncrypted: true,
  });

  assert.equal(cloudflareAccess.storageProfile, 'cloudflare');
  assert.equal(cloudflareAccess.defaultProfile, 'arweave');
  assert.equal(cloudflareAccess.telegramSelectedStorage, false);
  assert.equal(cloudflareAccess.sbtGated, true);
  assert.equal(cloudflareAccess.litRequired, false);
  assert.equal(encryptedAccess.litRequired, true);
  assert.equal(cloudflareAccess.exposesCloudflareCredential, false);
  assert.equal(cloudflareAccess.exposesBucketName, false);
  assert.equal(cloudflareAccess.exposesRawStoragePath, false);
  assert.equal(cloudflareAccess.exposesLongLivedUrl, false);
});

test('generated candidates can be saved or posed and submit response waits for answers', () => {
  const candidates = buildTelegramGeneratedQuestionCandidatesState({
    sessionSlug: 'alpha',
    selectedDocIds: ['doc-1'],
    candidates: [{
      candidateId: 'cand-1',
      questionType: 'freeform',
      prompt: 'What question should come from the selected docs?',
    }],
  });
  const unavailableSubmit = buildTelegramSubmitResponseState({
    sessionSlug: 'alpha',
    questionId: 'q-1',
  });
  const readySubmit = buildTelegramSubmitResponseState({
    sessionSlug: 'alpha',
    questionId: 'q-1',
    answer: {
      answerLabel: 'Agree',
      contentHash: `0x${'33'.repeat(32)}`,
    },
  });

  assert.equal(candidates.screen, 'generated_question_candidates');
  assert.equal(candidates.splitFromSubmitResponse, true);
  assert.equal(candidates.candidates[0].poseAction.action, TELEGRAM_BRIDGE_ACTIONS.POSE_QUESTION);
  assert.equal(candidates.candidates[0].poseAction.source, 'generated_candidate');
  assert.equal(unavailableSubmit.submitAvailable, false);
  assert.equal(unavailableSubmit.status, 'answer_required');
  assert.equal(readySubmit.submitAvailable, true);
  assert.equal(readySubmit.status, 'ready_to_submit');
});
