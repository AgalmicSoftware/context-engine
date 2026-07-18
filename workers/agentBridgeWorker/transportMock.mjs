import {
  AGENT_BRIDGE_EVENT_TYPES,
  RISK_CEILINGS,
  TELEGRAM_BRIDGE_ACTIONS,
  TELEGRAM_CHAT_LANES,
} from './constants.mjs';
import { appendBridgeEvent, summarizeEventLog } from './eventLog.mjs';
import { deriveManagedDemoAccount } from './managedAccounts.mjs';
import { createOpaqueActionRecord, createTelegramStartAction } from './opaqueActions.mjs';
import {
  buildTelegramGroupSessionCardState,
  buildTelegramPoseQuestionState,
  buildTelegramQuestionCard,
  buildTelegramQuestionListState,
} from './questionUi.mjs';
import { buildSanitizedEnvelope, groupSafeQuestionSummary } from './sanitizedEnvelopes.mjs';
import {
  evaluateResponseActionPolicy,
  evaluateTelegramNormalSessionSubmit,
  normalizeSessionPolicy,
  resolveSessionInvocation,
} from './sessionPolicy.mjs';
import {
  normalizeTelegramGroup,
  normalizeTelegramMockUpdate,
  normalizeTelegramPrincipal,
} from './telegramUpdates.mjs';

const DEFAULT_QUESTION = Object.freeze({
  questionId: 'question-demo-1',
  questionType: 'rating',
  prompt: 'How ready is this group to try the Telegram account lane?',
  aggregateCount: 0,
  options: [],
});

function nowIso(value, offsetMs = 0) {
  const base = value ? Date.parse(value) : Date.parse('2026-05-07T12:00:00.000Z');
  return new Date(base + offsetMs).toISOString();
}

function questionMatchesSearch(question = {}, search = '') {
  const needle = String(search || '').trim().toLowerCase();
  if (!needle) return false;
  return [question.questionId, question.id, question.title, question.prompt, question.questionText]
    .map((value) => String(value || '').trim().toLowerCase())
    .some((value) => value.includes(needle));
}

function defaultPolicy(sessionSlug = 'general') {  return normalizeSessionPolicy({
    defaultSessionSlug: sessionSlug,
    riskCeiling: RISK_CEILINGS.SUBMIT,
    allowQuestionGeneration: true,
    sessions: [{
      sessionSlug,
      sessionName: sessionSlug,
      default: true,
      telegramBridgeEnabled: true,
      managedAccountSubmitAllowed: true,
      sponsoredAiAllowed: true,
      sponsoredRpcAllowed: true,
      sponsoredFaucetAllowed: true,
      sbtJoinModes: ['public', 'password'],
      docLibraryEnabled: true,
    }],
  });
}

export class MockTelegramTransportHarness {
  constructor({
    deploymentId = 'local-demo',
    botUsername = 'ce_demo_bot',
    sessionPolicy = defaultPolicy(),
    questions = [DEFAULT_QUESTION],
    rootSecret = 'mock-demo-root-secret',
  } = {}) {
    this.deploymentId = deploymentId;
    this.botUsername = botUsername;
    this.sessionPolicy = normalizeSessionPolicy(sessionPolicy);
    this.questions = Array.isArray(questions) && questions.length ? questions : [DEFAULT_QUESTION];
    this.rootSecret = rootSecret;
    this.actions = new Map();
    this.responseActions = new Map();
    this.events = [];
  }

  postGroupSessionCard({ update = {}, sessionSlug = this.sessionPolicy.defaultSessionSlug, createdAt = null } = {}) {
    const normalized = normalizeTelegramMockUpdate(update);
    const group = normalizeTelegramGroup(normalized);
    const resolved = resolveSessionInvocation(this.sessionPolicy, sessionSlug);
    if (!resolved.ok) return resolved;
    const question = this.questions[0];
    const action = createOpaqueActionRecord({
      seed: `group_card|${group.groupChatId}|${resolved.session.sessionSlug}|${question.questionId}`,
      action: TELEGRAM_BRIDGE_ACTIONS.VIEW_QUESTIONS,
      lane: TELEGRAM_CHAT_LANES.GROUP_LOBBY,
      serverContextRef: {
        groupChatId: group.groupChatId,
        sessionSlug: resolved.session.sessionSlug,
        questionId: question.questionId,
      },
      createdAt,
    });
    this.actions.set(action.actionId, action);
    const groupCardState = buildTelegramGroupSessionCardState({
      sessionSlug: resolved.session.sessionSlug,
      sessionName: resolved.session.sessionName,
      policy: resolved.policy,
      createdAt,
    });
    this.events = appendBridgeEvent(this.events, {
      eventType: AGENT_BRIDGE_EVENT_TYPES.GROUP_CARD_POSTED,
      lane: TELEGRAM_CHAT_LANES.GROUP_LOBBY,
      telegramGroupChatId: group.groupChatId,
      sessionSlug: resolved.session.sessionSlug,
      questionId: question.questionId,
      summary: {
        groupTitle: group.title,
        text: groupCardState.text,
        buttons: groupCardState.buttons.map((button) => button.label),
        policyActions: groupCardState.policyActions.map((button) => button.action),
        question: groupSafeQuestionSummary(question),
        defaultAction: TELEGRAM_BRIDGE_ACTIONS.VIEW_QUESTIONS,
        addQuestionAvailable: resolved.policy.allowAddQuestion === true,
        generateQuestionAvailable: resolved.policy.allowGenerateQuestion === true,
      },
      refs: {
        actionId: action.actionId,
      },
      createdAt,
    });
    return {
      ok: true,
      group,
      session: resolved.session,
      action,
      groupSafeCard: buildSanitizedEnvelope({
        envelopeType: 'telegram_group_session_card',
        lane: TELEGRAM_CHAT_LANES.GROUP_LOBBY,
        publicSummary: {
          ...groupCardState,
          sessionSlug: resolved.session.sessionSlug,
          sessionName: resolved.session.sessionName,
          question: groupSafeQuestionSummary(question),
          actionId: action.actionId,
        },
        privateRefs: {
          groupChatId: group.groupChatId,
          questionId: question.questionId,
        },
        createdAt,
      }),
    };
  }

  openPrivateStart({
    groupActionId = '',
    update = {},
    hasConfiguredAccount = false,
    createdAt = null,
  } = {}) {
    const groupAction = this.actions.get(groupActionId);
    if (!groupAction) return { ok: false, reason: 'group_action_not_found' };
    const normalized = normalizeTelegramMockUpdate(update);
    const principal = normalizeTelegramPrincipal(normalized);
    const start = createTelegramStartAction({
      seed: `start|${groupAction.actionId}|${principal.principalId}`,
      action: TELEGRAM_BRIDGE_ACTIONS.START_PRIVATE,
      lane: TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT,
      serverContextRef: {
        groupActionId: groupAction.actionId,
      },
      createdAt,
    });
    this.actions.set(start.deepLinkPayload, {
      ...start.record,
      deepLinkPayload: start.deepLinkPayload,
      principalId: principal.principalId,
      serverContextRef: {
        ...start.record.serverContextRef,
        ...groupAction.serverContextRef,
      },
    });
    this.events = appendBridgeEvent(this.events, {
      eventType: AGENT_BRIDGE_EVENT_TYPES.PRIVATE_START_OPENED,
      lane: TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT,
      telegramPrincipalId: principal.principalId,
      telegramGroupChatId: groupAction.serverContextRef.groupChatId,
      sessionSlug: groupAction.serverContextRef.sessionSlug,
      questionId: groupAction.serverContextRef.questionId,
      summary: {
        deepLinkPayload: start.deepLinkPayload,
        requiresPrivateAccountSetup: hasConfiguredAccount !== true,
        nextStep: hasConfiguredAccount === true ? TELEGRAM_BRIDGE_ACTIONS.VIEW_QUESTIONS : 'private_account_setup',
      },
      refs: {
        groupActionId,
      },
      createdAt,
    });
    return {
      ok: true,
      principal,
      deepLinkPayload: start.deepLinkPayload,
      requiresPrivateAccountSetup: hasConfiguredAccount !== true,
      nextStep: hasConfiguredAccount === true ? TELEGRAM_BRIDGE_ACTIONS.VIEW_QUESTIONS : 'private_account_setup',
      privateStartAction: this.actions.get(start.deepLinkPayload),
    };
  }

  async createOrRecoverManagedAccount({
    principal = {},
    lifecycle = AGENT_BRIDGE_EVENT_TYPES.ACCOUNT_CREATED,
    createdAt = null,
  } = {}) {
    const account = await deriveManagedDemoAccount({
      principal,
      deploymentId: this.deploymentId,
      rootSecret: this.rootSecret,
      lifecycle,
      createdAt,
    });
    this.events = appendBridgeEvent(this.events, {
      eventType: lifecycle === AGENT_BRIDGE_EVENT_TYPES.ACCOUNT_RECOVERED
        ? AGENT_BRIDGE_EVENT_TYPES.ACCOUNT_RECOVERED
        : AGENT_BRIDGE_EVENT_TYPES.ACCOUNT_CREATED,
      lane: TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT,
      telegramPrincipalId: account.principal.principalId,
      accountId: account.accountId,
      summary: {
        accountAddress: account.accountAddress,
        chainScope: account.chainScope,
        signerBoundary: account.signerBoundary,
      },
      createdAt,
    });
    return { ok: true, account };
  }

  listQuestions({ sessionSlug = this.sessionPolicy.defaultSessionSlug, createdAt = null } = {}) {
    const cards = this.questions.map((question) => buildTelegramQuestionCard(question, {
      docsExist: true,
      microphoneSupported: true,
    }));
    const listState = buildTelegramQuestionListState({
      sessionSlug,
      questions: this.questions,
      createdAt,
    });
    this.events = appendBridgeEvent(this.events, {
      eventType: AGENT_BRIDGE_EVENT_TYPES.QUESTION_LISTED,
      lane: TELEGRAM_CHAT_LANES.GROUP_LOBBY,
      sessionSlug,
      summary: {
        count: cards.length,
        source: listState.source,
        questions: listState.questions,
      },
      createdAt,
    });
    return {
      ok: true,
      sessionSlug,
      listState,
      questions: this.questions.slice(),
      cards,
    };
  }

  poseQuestion({
    sessionSlug = this.sessionPolicy.defaultSessionSlug,
    questionId = '',
    questionSearch = '',
    question = null,
    source = 'existing_session_question',
    participant = {},
    createdAt = null,
  } = {}) {
    const resolved = resolveSessionInvocation(this.sessionPolicy, sessionSlug);
    if (!resolved.ok) return resolved;
    const selected = question || this.questions.find((entry) => (
      String(entry.questionId || entry.id || '').trim() === String(questionId || '').trim()
    )) || this.questions.find((entry) => questionMatchesSearch(entry, questionSearch));
    if (!selected) return { ok: false, reason: 'question_not_found' };
    const state = buildTelegramPoseQuestionState({
      sessionSlug: resolved.session.sessionSlug,
      question: selected,
      source,
      createdAt,
    });
    this.events = appendBridgeEvent(this.events, {
      eventType: AGENT_BRIDGE_EVENT_TYPES.QUESTION_POSED,
      lane: TELEGRAM_CHAT_LANES.GROUP_LOBBY,
      sessionSlug: resolved.session.sessionSlug,
      questionId: state.questionId,
      summary: {
        action: TELEGRAM_BRIDGE_ACTIONS.POSE_QUESTION,
        source,
        participantRole: String(participant.role || 'group_participant'),
        groupSafeOutput: state.groupSafeOutput,
      },
      refs: {
        actionId: state.action.actionId,
      },
      createdAt,
    });
    return {
      ok: true,
      session: resolved.session,
      poseState: state,
      groupSafeOutput: state.groupSafeOutput,
    };
  }

  answerQuestion({
    account = {},
    question = this.questions[0],
    answer = {},
    action = TELEGRAM_BRIDGE_ACTIONS.DRAFT_RESPONSE,
    grant = {},
    joinedSbtIds = [],
    idempotencyKey = '',
    createdAt = null,
  } = {}) {
    const resolved = resolveSessionInvocation(this.sessionPolicy, answer.sessionSlug || this.sessionPolicy.defaultSessionSlug);
    if (!resolved.ok) return resolved;
    const policy = action === TELEGRAM_BRIDGE_ACTIONS.DIRECT_SUBMIT_RESPONSE
      ? evaluateTelegramNormalSessionSubmit({
        account,
        grant,
        session: resolved.session,
        action,
        joinedSbtIds,
      })
      : evaluateResponseActionPolicy({
        account,
        grant,
        session: resolved.session,
        action,
      });
    if (!policy.ok) return policy;
    const effectiveAction = policy.effectiveAction || action;
    const replayKey = String(idempotencyKey || '').trim().toLowerCase();
    if (replayKey && this.responseActions.has(replayKey)) {
      return {
        ...this.responseActions.get(replayKey),
        idempotentReplay: true,
      };
    }
    const eventType = {
      [TELEGRAM_BRIDGE_ACTIONS.SUGGEST_RESPONSE]: AGENT_BRIDGE_EVENT_TYPES.RESPONSE_SUGGESTED,
      [TELEGRAM_BRIDGE_ACTIONS.DRAFT_RESPONSE]: AGENT_BRIDGE_EVENT_TYPES.DRAFT_SAVED,
      [TELEGRAM_BRIDGE_ACTIONS.SUBMIT_RESPONSE]: AGENT_BRIDGE_EVENT_TYPES.SUBMIT_REQUESTED,
      [TELEGRAM_BRIDGE_ACTIONS.DIRECT_SUBMIT_RESPONSE]: AGENT_BRIDGE_EVENT_TYPES.DIRECT_SUBMITTED,
    }[effectiveAction] || AGENT_BRIDGE_EVENT_TYPES.FAILED;
    const actionRecord = createOpaqueActionRecord({
      seed: `${effectiveAction}|${account.accountId}|${question.questionId}|${replayKey || createdAt || ''}`,
      action: effectiveAction,
      lane: TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT,
      serverContextRef: {
        accountId: account.accountId,
        sessionSlug: resolved.session.sessionSlug,
        questionId: question.questionId,
      },
      createdAt,
    });
    this.events = appendBridgeEvent(this.events, {
      eventType,
      lane: TELEGRAM_CHAT_LANES.PRIVATE_ACCOUNT,
      accountId: account.accountId,
      telegramPrincipalId: account.principal?.principalId,
      sessionSlug: resolved.session.sessionSlug,
      questionId: question.questionId,
      summary: {
        action: effectiveAction,
        directSubmitAllowed: policy.directSubmitAllowed === true,
        fallbackCreated: policy.fallbackCreated === true,
        persisted: policy.persisted === true,
        requiresApproval: policy.requiresApproval === true,
        answerLabel: answer.answerLabel || null,
      },
      refs: {
        actionId: actionRecord.actionId,
        idempotencyKey: replayKey || null,
      },
      createdAt,
    });
    const result = {
      ok: true,
      policy,
      actionRecord,
      groupSafeSummary: {
        actionId: actionRecord.actionId,
        sessionSlug: resolved.session.sessionSlug,
        questionId: question.questionId,
        status: eventType,
      },
    };
    if (replayKey) this.responseActions.set(replayKey, result);
    return result;
  }
  eventLogSummary() {
    return summarizeEventLog(this.events);
  }
}

export async function runMockTelegramDemoFlow({
  deploymentId = 'local-demo',
  rootSecret = 'mock-demo-root-secret',
  sessionSlug = 'general',
  createdAt = '2026-05-07T12:00:00.000Z',
  action = TELEGRAM_BRIDGE_ACTIONS.DIRECT_SUBMIT_RESPONSE,
} = {}) {
  const harness = new MockTelegramTransportHarness({
    deploymentId,
    rootSecret,
    sessionPolicy: defaultPolicy(sessionSlug),
  });
  const groupCard = harness.postGroupSessionCard({
    sessionSlug,
    update: {
      message: {
        chat: { id: '-100100', type: 'supergroup', title: 'Demo lobby' },
        from: { id: 10, username: 'host' },
        text: '/session',
      },
    },
    createdAt,
  });
  const privateStart = harness.openPrivateStart({
    groupActionId: groupCard.action.actionId,
    update: {
      message: {
        chat: { id: '42', type: 'private' },
        from: { id: 42, username: 'participant' },
        text: '/start',
      },
    },
    createdAt: nowIso(createdAt, 1000),
  });
  const account = await harness.createOrRecoverManagedAccount({
    principal: privateStart.principal,
    lifecycle: AGENT_BRIDGE_EVENT_TYPES.ACCOUNT_CREATED,
    createdAt: nowIso(createdAt, 2000),
  });
  const listed = harness.listQuestions({
    sessionSlug,
    createdAt: nowIso(createdAt, 3000),
  });
  const answered = harness.answerQuestion({
    account: account.account,
    question: listed.questions[0],
    answer: {
      sessionSlug,
      answerLabel: '8',
    },
    action,
    grant: {
      status: 'active',
      sessions: [sessionSlug],
      allowedActions: [action],
      riskCeiling: RISK_CEILINGS.SUBMIT,
    },
    createdAt: nowIso(createdAt, 4000),
  });
  return {
    ok: true,
    groupCard: groupCard.groupSafeCard,
    privateStart: {
      deepLinkPayload: privateStart.deepLinkPayload,
      principal: privateStart.principal,
      requiresPrivateAccountSetup: privateStart.requiresPrivateAccountSetup,
      nextStep: privateStart.nextStep,
    },
    account: account.account,
    questions: listed.cards,
    answered,
    events: harness.events,
    eventLogSummary: harness.eventLogSummary(),
  };
}
