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
  buildTelegramSubmitResponseState,
  createTelegramPrivateQuestionDecryptRequest,
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

  assert.equal(states.length, 31);
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

  const poseQuestion = states.find((state) => state.screen === 'pose_question');
  assert.equal(poseQuestion.title, 'Pose Question');
  assert.equal(poseQuestion.launch.command, '/ce_pose_question');
  assert.deepEqual(poseQuestion.launch.aliases, ['/q']);
  assert.deepEqual(poseQuestion.launch.deprecatedAliases, ['/ce_drop_question']);
  assert.equal(poseQuestion.launch.callback, 'callback:<pose_question_action>');

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
    'Locked question',
  ]);
  assert.equal(posed.action.action, TELEGRAM_BRIDGE_ACTIONS.POSE_QUESTION);
  assert.equal(posed.action.command, '/ce_pose_question');
  assert.deepEqual(posed.action.aliases, ['/q']);
  assert.equal(posed.groupSafeOutput.questionText, 'What should the group discuss next?');
  assert.equal(locked.groupSafeOutput.questionText, null);
  assert.equal(JSON.stringify(locked).includes('Private prompt must stay out of group summaries'), false);
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
