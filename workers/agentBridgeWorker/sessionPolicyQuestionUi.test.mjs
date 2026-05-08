import test from 'node:test';
import assert from 'node:assert/strict';
import { TELEGRAM_BRIDGE_ACTIONS } from './constants.mjs';
import {
  TELEGRAM_SCREEN_IDS,
  assertQuestionCardParity,
  buildTelegramGroupSessionCardState,
  buildTelegramQuestionCard,
  buildTelegramQuestionControls,
  buildTelegramScreenState,
  listTelegramScreenLaunchContracts,
} from './questionUi.mjs';
import {
  evaluateResponseActionPolicy,
  evaluateSbtJoinPolicy,
  evaluateSponsoredResourceEligibility,
  normalizeSessionPolicy,
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
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  );
  assert.equal(rating.controls.find((control) => control.value === 10).label, '10');
  assert.equal(rating.controls.find((control) => control.controlType === 'rating_button').min, 0);
  assert.equal(rating.controls.find((control) => control.controlType === 'rating_button').max, 10);
  assert.equal(ratingControls.some((control) => control.action === TELEGRAM_BRIDGE_ACTIONS.ADDITIONAL_COMMENTS), true);
  assert.equal(ratingControls.some((control) => control.action === TELEGRAM_BRIDGE_ACTIONS.MICROPHONE_INPUT), true);
  assert.equal(ratingControls.some((control) => control.action === TELEGRAM_BRIDGE_ACTIONS.DOC_CONTEXT), true);

  assert.deepEqual(
    binary.controls
      .filter((control) => control.controlType === 'agree_unsure_disagree')
      .map((control) => control.label),
    ['Agree', 'Unsure', 'Disagree'],
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

  assert.equal(states.length, 19);
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
  assert.equal(docLibrary.title, 'View / Add Docs');
  assert.equal(docLibrary.buttonLabel, 'View / Add Docs');
  assert.equal(docLibrary.launch.command, '/ce_docs');

  const onboarding = states.find((state) => state.screen === 'onboarding');
  assert.equal(onboarding.text, 'Enter startup info so I can suggest answers for you.');
  assert.equal(onboarding.launch.command, '/ce_onboarding');

  const accountCreated = states.find((state) => state.screen === 'account_created');
  assert.equal(JSON.stringify(accountCreated).includes('Open in CE'), false);

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

  assert.equal(card.text, 'Context Engine session linked: Alpha');
  assert.deepEqual(card.buttons.map((button) => button.label), [
    'Join Session',
    'View Questions',
    'View / Add Docs',
  ]);
  assert.equal(card.buttons.some((button) => button.label === 'Answer Privately'), false);
  assert.equal(card.defaultAction, TELEGRAM_BRIDGE_ACTIONS.VIEW_QUESTIONS);
  assert.deepEqual(card.policyActions.map((button) => button.action), [
    TELEGRAM_BRIDGE_ACTIONS.ADD_QUESTION,
    TELEGRAM_BRIDGE_ACTIONS.GENERATE_QUESTION,
  ]);
});
