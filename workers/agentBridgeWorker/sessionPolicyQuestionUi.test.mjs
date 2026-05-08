import test from 'node:test';
import assert from 'node:assert/strict';
import { TELEGRAM_BRIDGE_ACTIONS } from './constants.mjs';
import {
  assertQuestionCardParity,
  buildTelegramQuestionCard,
  buildTelegramQuestionControls,
  buildTelegramScreenState,
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

test('Telegram question cards preserve CE rating/comment/mic/doc conventions', () => {
  const rating = buildTelegramQuestionCard({
    questionId: 'rating-1',
    questionType: 'rating',
    prompt: 'Rate readiness',
  }, {
    docsExist: true,
  });
  const controls = buildTelegramQuestionControls({
    questionId: 'rating-1',
    questionType: 'rating',
  }, {
    docsExist: true,
  });

  assert.equal(rating.controls.find((control) => control.controlType === 'rating').min, 0);
  assert.equal(rating.controls.find((control) => control.controlType === 'rating').max, 10);
  assert.equal(controls.some((control) => control.action === TELEGRAM_BRIDGE_ACTIONS.ADDITIONAL_COMMENTS), true);
  assert.equal(controls.some((control) => control.action === TELEGRAM_BRIDGE_ACTIONS.MICROPHONE_INPUT), true);
  assert.equal(controls.some((control) => control.action === TELEGRAM_BRIDGE_ACTIONS.DOC_CONTEXT), true);
  assert.deepEqual(assertQuestionCardParity(rating), {
    ok: true,
    reason: 'telegram_question_card_matches_ce_conventions',
  });
});

test('screen states cover setup, questions, docs, signing, submission, logs, and retry surfaces', () => {
  const screens = [
    'setup_welcome',
    'test_checklist',
    'group_session_card',
    'private_start',
    'account_created',
    'account_recovered',
    'onboarding',
    'freeform_question',
    'agree_unsure_disagree_question',
    'rating_question',
    'multichoice_question',
    'doc_library',
    'doc_detail',
    'generate_questions',
    'confirmation_signing',
    'submitted',
    'draft_saved',
    'event_log_summary',
    'error_retry',
  ];
  const states = screens.map((screen) => buildTelegramScreenState(screen, { status: 'ready' }));

  assert.equal(states.length, 19);
  assert.equal(states.every((state) => state.type === 'telegram_screen_state'), true);
  assert.deepEqual(states.map((state) => state.screen), screens);
});
