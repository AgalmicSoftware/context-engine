import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AGENT_BRIDGE_EVENT_TYPES,
  TELEGRAM_BRIDGE_ACTIONS,
} from './constants.mjs';
import {
  MockTelegramTransportHarness,
  runMockTelegramDemoFlow,
} from './transportMock.mjs';

test('mock Telegram group-to-private transport runs the managed account answer lane end-to-end', async () => {
  const result = await runMockTelegramDemoFlow({
    deploymentId: 'deploy-a',
    rootSecret: 'root-a',
    sessionSlug: 'alpha',
    createdAt: '2026-05-07T12:00:00.000Z',
  });

  assert.equal(result.ok, true);
  assert.equal(result.groupCard.publicSummary.sessionSlug, 'alpha');
  assert.equal(result.groupCard.publicSummary.text, 'Session: alpha');
  assert.deepEqual(result.groupCard.publicSummary.buttons.map((button) => button.label), [
    'Join Session',
    'View Questions',
    'Pose Question',
  ]);
  assert.equal(JSON.stringify(result.groupCard).includes('Answer Privately'), false);
  assert.equal(result.groupCard.publicSummary.question.questionText.includes('Telegram account lane'), true);
  assert.equal(result.groupCard.publicSummary.question.aggregateCount, 0);
  assert.equal(result.privateStart.deepLinkPayload.startsWith('cetg_'), true);
  assert.equal(result.privateStart.deepLinkPayload.includes('alpha'), false);
  assert.equal(result.privateStart.deepLinkPayload.includes('question-demo-1'), false);
  assert.equal(result.privateStart.requiresPrivateAccountSetup, true);
  assert.equal(result.privateStart.nextStep, 'private_account_setup');
  assert.equal(result.account.accountMode, 'managed_telegram_demo');
  assert.equal(result.account.chainScope, 'testnet');
  assert.equal(result.questions[0].questionType, 'rating');
  assert.equal(result.answered.ok, true);
  assert.equal(result.answered.groupSafeSummary.status, AGENT_BRIDGE_EVENT_TYPES.DIRECT_SUBMITTED);
  assert.deepEqual(result.events.map((event) => event.eventType), [
    AGENT_BRIDGE_EVENT_TYPES.GROUP_CARD_POSTED,
    AGENT_BRIDGE_EVENT_TYPES.PRIVATE_START_OPENED,
    AGENT_BRIDGE_EVENT_TYPES.ACCOUNT_CREATED,
    AGENT_BRIDGE_EVENT_TYPES.QUESTION_LISTED,
    AGENT_BRIDGE_EVENT_TYPES.DIRECT_SUBMITTED,
  ]);
  assert.equal(JSON.stringify(result.groupCard).includes(result.account.accountAddress), false);
  assert.equal(JSON.stringify(result.events).includes('root-a'), false);
});

test('group lobby defaults to viewing questions and exposes add/generate by policy only', () => {
  const harness = new MockTelegramTransportHarness({
    sessionPolicy: {
      defaultSessionSlug: 'alpha',
      riskCeiling: 'submit',
      allowAddQuestion: true,
      allowQuestionGeneration: true,
      sessions: [{
        sessionSlug: 'alpha',
        sessionName: 'Alpha',
        telegramBridgeEnabled: true,
      }],
    },
  });
  const card = harness.postGroupSessionCard({
    update: {
      message: {
        chat: { id: '-100101', type: 'group', title: 'Alpha lobby' },
        text: '/session',
      },
    },
  });

  assert.equal(card.ok, true);
  assert.equal(card.action.action, TELEGRAM_BRIDGE_ACTIONS.VIEW_QUESTIONS);
  assert.equal(card.groupSafeCard.publicSummary.defaultAction, TELEGRAM_BRIDGE_ACTIONS.VIEW_QUESTIONS);
  assert.deepEqual(card.groupSafeCard.publicSummary.buttons.map((button) => button.label), [
    'Join Session',
    'View Questions',
    'Pose Question',
  ]);
  assert.deepEqual(card.groupSafeCard.publicSummary.policyActions.map((button) => button.action), [
    TELEGRAM_BRIDGE_ACTIONS.ADD_QUESTION,
    TELEGRAM_BRIDGE_ACTIONS.GENERATE_QUESTION,
  ]);
  const event = harness.events[0];
  assert.equal(event.summary.defaultAction, TELEGRAM_BRIDGE_ACTIONS.VIEW_QUESTIONS);
  assert.equal(event.summary.addQuestionAvailable, true);
  assert.equal(event.summary.generateQuestionAvailable, true);
  assert.deepEqual(event.summary.buttons, ['Join Session', 'View Questions', 'Pose Question']);
  assert.deepEqual(event.summary.policyActions, [
    TELEGRAM_BRIDGE_ACTIONS.ADD_QUESTION,
    TELEGRAM_BRIDGE_ACTIONS.GENERATE_QUESTION,
  ]);
});

test('view questions lists existing session questions and pose question posts group-safe output', () => {
  const harness = new MockTelegramTransportHarness({
    sessionPolicy: {
      defaultSessionSlug: 'alpha',
      riskCeiling: 'submit',
      allowQuestionGeneration: true,
      sessions: [{
        sessionSlug: 'alpha',
        sessionName: 'Alpha',
        telegramBridgeEnabled: true,
      }],
    },
    questions: [
      {
        questionId: 'q-1',
        questionType: 'freeform',
        prompt: 'What should Alpha decide next?',
      },
      {
        questionId: 'q-locked',
        questionType: 'freeform',
        prompt: 'Locked prompt must not be posed publicly',
        visibility: 'sbt_gated',
      },
    ],
  });

  const listed = harness.listQuestions({ sessionSlug: 'alpha' });
  const posed = harness.poseQuestion({ sessionSlug: 'alpha', questionId: 'q-1' });
  const locked = harness.poseQuestion({ sessionSlug: 'alpha', questionId: 'q-locked' });

  assert.equal(listed.listState.source, 'canonical_agent_questions');
  assert.deepEqual(listed.listState.questions.map((question) => question.title), [
    'What should Alpha decide next?',
    'Encrypted question',
  ]);
  assert.equal(posed.poseState.action.action, TELEGRAM_BRIDGE_ACTIONS.POSE_QUESTION);
  assert.equal(posed.poseState.action.command, '/pose_question');
  assert.deepEqual(posed.poseState.action.aliases, ['/q']);
  assert.equal(posed.groupSafeOutput.questionText, 'What should Alpha decide next?');
  assert.equal(locked.groupSafeOutput.questionText, null);
  assert.equal(JSON.stringify(locked).includes('Locked prompt must not be posed publicly'), false);
  assert.deepEqual(harness.events.map((event) => event.eventType), [
    AGENT_BRIDGE_EVENT_TYPES.QUESTION_LISTED,
    AGENT_BRIDGE_EVENT_TYPES.QUESTION_POSED,
    AGENT_BRIDGE_EVENT_TYPES.QUESTION_POSED,
  ]);
  assert.equal(harness.events.every((event) => event.lane === 'telegram_group_lobby'), true);
});

test('group join deep link resolves missing managed accounts to private account setup', () => {
  const harness = new MockTelegramTransportHarness();
  const card = harness.postGroupSessionCard({
    update: {
      message: {
        chat: { id: '-100102', type: 'supergroup', title: 'General lobby' },
        text: '/session',
      },
    },
  });
  const missingAccount = harness.openPrivateStart({
    groupActionId: card.action.actionId,
    update: {
      message: {
        chat: { id: '55', type: 'private' },
        from: { id: 55, username: 'participant' },
        text: '/start',
      },
    },
  });
  const configuredAccount = harness.openPrivateStart({
    groupActionId: card.action.actionId,
    update: {
      message: {
        chat: { id: '55', type: 'private' },
        from: { id: 55, username: 'participant' },
        text: '/start',
      },
    },
    hasConfiguredAccount: true,
  });

  assert.equal(missingAccount.requiresPrivateAccountSetup, true);
  assert.equal(missingAccount.nextStep, 'private_account_setup');
  assert.equal(configuredAccount.requiresPrivateAccountSetup, false);
  assert.equal(configuredAccount.nextStep, TELEGRAM_BRIDGE_ACTIONS.VIEW_QUESTIONS);
});

test('suggest responses are ephemeral while draft responses are saved', async () => {
  const harness = new MockTelegramTransportHarness({
    sessionPolicy: {
      defaultSessionSlug: 'alpha',
      riskCeiling: 'submit',
      sessions: [{
        sessionSlug: 'alpha',
        sessionName: 'Alpha',
        telegramBridgeEnabled: true,
        managedAccountSubmitAllowed: true,
      }],
    },
  });
  const account = (await harness.createOrRecoverManagedAccount({
    principal: { telegramUserId: '55' },
  })).account;

  const suggestion = harness.answerQuestion({
    account,
    action: TELEGRAM_BRIDGE_ACTIONS.SUGGEST_RESPONSE,
  });
  const draft = harness.answerQuestion({
    account,
    action: TELEGRAM_BRIDGE_ACTIONS.DRAFT_RESPONSE,
  });
  const submitRequest = harness.answerQuestion({
    account,
    action: TELEGRAM_BRIDGE_ACTIONS.SUBMIT_RESPONSE,
  });

  assert.equal(suggestion.policy.persisted, false);
  assert.equal(draft.policy.persisted, true);
  assert.equal(submitRequest.policy.requiresApproval, true);
});


test('managed Telegram demo accounts submit to normal sessions when gates and grants allow', async () => {
  const harness = new MockTelegramTransportHarness({
    sessionPolicy: {
      defaultSessionSlug: 'normal-room',
      riskCeiling: 'submit',
      sessions: [{
        sessionSlug: 'normal-room',
        sessionName: 'Normal Room',
        telegramBridgeEnabled: true,
        managedAccountSubmitAllowed: true,
      }],
    },
  });
  const account = (await harness.createOrRecoverManagedAccount({
    principal: { telegramUserId: '88' },
  })).account;
  const first = harness.answerQuestion({
    account,
    action: TELEGRAM_BRIDGE_ACTIONS.DIRECT_SUBMIT_RESPONSE,
    answer: { sessionSlug: 'normal-room', answer: 'private response text' },
    grant: {
      allowedActions: [TELEGRAM_BRIDGE_ACTIONS.DIRECT_SUBMIT_RESPONSE],
      riskCeiling: 'submit',
    },
    idempotencyKey: 'telegram:normal-room:q1:answer1',
  });
  const replay = harness.answerQuestion({
    account,
    action: TELEGRAM_BRIDGE_ACTIONS.DIRECT_SUBMIT_RESPONSE,
    answer: { sessionSlug: 'normal-room', answer: 'changed text ignored by idempotency' },
    grant: {
      allowedActions: [TELEGRAM_BRIDGE_ACTIONS.DIRECT_SUBMIT_RESPONSE],
      riskCeiling: 'submit',
    },
    idempotencyKey: 'telegram:normal-room:q1:answer1',
  });

  assert.equal(first.ok, true);
  assert.equal(first.policy.directSubmitAllowed, true);
  assert.equal(first.groupSafeSummary.status, AGENT_BRIDGE_EVENT_TYPES.DIRECT_SUBMITTED);
  assert.equal(replay.idempotentReplay, true);
  assert.equal(replay.actionRecord.actionId, first.actionRecord.actionId);
  assert.equal(harness.events.filter((event) => event.eventType === AGENT_BRIDGE_EVENT_TYPES.DIRECT_SUBMITTED).length, 1);
  assert.equal(JSON.stringify(harness.events).includes('private response text'), false);
  assert.equal(JSON.stringify(first).includes('changed text'), false);
});

test('normal-session submit respects SBT gates and falls back when direct submit is not allowed', async () => {
  const harness = new MockTelegramTransportHarness({
    sessionPolicy: {
      defaultSessionSlug: 'gated-room',
      riskCeiling: 'submit',
      sessions: [{
        sessionSlug: 'gated-room',
        sessionName: 'Gated Room',
        telegramBridgeEnabled: true,
        managedAccountSubmitAllowed: false,
        requiredSbtGroups: [{ sbtId: 'alpha-pass', groupId: 'alpha-pass', joinMode: 'public' }],
      }],
    },
  });
  const account = (await harness.createOrRecoverManagedAccount({
    principal: { telegramUserId: '99' },
  })).account;
  const blocked = harness.answerQuestion({
    account,
    action: TELEGRAM_BRIDGE_ACTIONS.DIRECT_SUBMIT_RESPONSE,
    answer: { sessionSlug: 'gated-room', answerLabel: 'Agree' },
    grant: {
      allowedActions: [TELEGRAM_BRIDGE_ACTIONS.DIRECT_SUBMIT_RESPONSE],
      riskCeiling: 'submit',
    },
  });
  const fallback = harness.answerQuestion({
    account,
    action: TELEGRAM_BRIDGE_ACTIONS.DIRECT_SUBMIT_RESPONSE,
    joinedSbtIds: ['alpha-pass'],
    answer: { sessionSlug: 'gated-room', answerLabel: 'Agree' },
    grant: {
      allowedActions: [TELEGRAM_BRIDGE_ACTIONS.SUBMIT_RESPONSE],
      riskCeiling: 'submit',
    },
  });
  const draftFallback = harness.answerQuestion({
    account,
    action: TELEGRAM_BRIDGE_ACTIONS.DIRECT_SUBMIT_RESPONSE,
    joinedSbtIds: ['alpha-pass'],
    answer: { sessionSlug: 'gated-room', answerLabel: 'Unsure' },
    grant: {
      allowedActions: [],
      riskCeiling: 'submit',
    },
  });

  assert.equal(blocked.ok, false);
  assert.equal(blocked.reason, 'session_sbt_gate_required');
  assert.equal(fallback.ok, true);
  assert.equal(fallback.policy.directSubmitAllowed, false);
  assert.equal(fallback.policy.reason, 'direct_submit_denied_submit_request_created');
  assert.equal(fallback.actionRecord.action, TELEGRAM_BRIDGE_ACTIONS.SUBMIT_RESPONSE);
  assert.equal(fallback.groupSafeSummary.status, AGENT_BRIDGE_EVENT_TYPES.SUBMIT_REQUESTED);
  assert.equal(draftFallback.actionRecord.action, TELEGRAM_BRIDGE_ACTIONS.DRAFT_RESPONSE);
  assert.equal(draftFallback.groupSafeSummary.status, AGENT_BRIDGE_EVENT_TYPES.DRAFT_SAVED);
});

test('any linked group participant can pose an existing question by id or search without leaking gated prompts', () => {
  const harness = new MockTelegramTransportHarness({
    sessionPolicy: {
      defaultSessionSlug: 'alpha',
      sessions: [{
        sessionSlug: 'alpha',
        sessionName: 'Alpha',
        telegramBridgeEnabled: true,
      }],
    },
    questions: [
      { questionId: 'q-roadmap', prompt: 'Which roadmap item should Alpha pose next?' },
      { questionId: 'q-private', prompt: 'Private eligibility context', visibility: 'private' },
    ],
  });

  const bySearch = harness.poseQuestion({
    sessionSlug: 'alpha',
    questionSearch: 'roadmap',
    participant: { role: 'member' },
  });
  const missingSession = harness.poseQuestion({ sessionSlug: 'missing', questionId: 'q-roadmap' });
  const locked = harness.poseQuestion({ sessionSlug: 'alpha', questionId: 'q-private' });

  assert.equal(bySearch.ok, true);
  assert.equal(bySearch.poseState.action.targetLane, 'telegram_group_lobby');
  assert.equal(bySearch.groupSafeOutput.questionText, 'Which roadmap item should Alpha pose next?');
  assert.equal(missingSession.reason, 'session_not_linked');
  assert.equal(locked.groupSafeOutput.locked, true);
  assert.equal(locked.groupSafeOutput.questionText, null);
  assert.equal(JSON.stringify(locked).includes('Private eligibility context'), false);
  assert.equal(harness.events.find((event) => event.questionId === 'q-roadmap').summary.participantRole, 'member');
});
