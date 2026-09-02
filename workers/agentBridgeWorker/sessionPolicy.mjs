import { safeString } from './runtimePrimitives.mjs';
import { RISK_CEILINGS, RISK_RANK, TELEGRAM_BRIDGE_ACTIONS } from './constants.mjs';

const SESSION_SLUG_RE = /^[a-z0-9_-]{1,128}$/i;
const PUBLIC_SBT_JOIN_MODES = new Set(['public', 'open']);
const PRIVATE_CREDENTIAL_SBT_JOIN_MODES = new Set(['password', 'invite']);
const FULL_CE_ACCOUNT_SBT_JOIN_MODES = new Set([
  'linked-wallet',
  'wallet',
  'wallet-proof',
  'passkey',
  'non-public',
  'private',
]);

function normalizeCanonicalSessionId(value) {
  const normalized = safeString(value).toLowerCase().replace(/^0x/, '').replace(/-/g, '');
  return /^[0-9a-f]{32}$/.test(normalized) && !/^0+$/.test(normalized)
    ? `0x${normalized}`
    : '';
}

function resolveCanonicalSessionId(session = {}) {
  const rawValues = [session.sessionId, session.sessionIdHex].filter((value) => safeString(value));
  const normalized = rawValues.map(normalizeCanonicalSessionId);
  const unique = new Set(normalized.filter(Boolean));
  return normalized.some((value) => !value) || unique.size !== 1 ? '' : [...unique][0];
}

function normalizeBool(value = false) {
  if (value === true) return true;
  const normalized = safeString(value).toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(normalized);
}

function normalizeRisk(value = RISK_CEILINGS.READ) {
  const risk = safeString(value).toLowerCase();
  return Object.hasOwn(RISK_RANK, risk) ? risk : RISK_CEILINGS.READ;
}

function riskAllows(requested, ceiling) {
  return RISK_RANK[normalizeRisk(requested)] <= RISK_RANK[normalizeRisk(ceiling)];
}

function normalizeJoinMode(value = 'public') {
  return safeString(value || 'public').toLowerCase().replace(/_/g, '-');
}

function normalizeRequiredSbtGroup(input = {}) {
  const joinMode = normalizeJoinMode(input.joinMode || input.mode || input.claimMode || input.gateMode);
  const sbtAddress = safeString(input.sbtAddress || input.address);
  const groupId = safeString(input.groupId || input.sbtGroupId || input.groupSlug || input.slug);
  const shareLink = safeString(input.shareLink || input.link || input.url);
  const sbtId = safeString(input.sbtId || input.id || sbtAddress || groupId || shareLink);
  if (!sbtId) return null;
  return {
    sbtId,
    sbtAddress: sbtAddress || null,
    groupId: groupId || null,
    shareLink: shareLink || null,
    name: safeString(input.name || input.title) || 'Required SBT',
    description: safeString(input.description || input.summary) || null,
    joinMode,
    credentialRequired: PRIVATE_CREDENTIAL_SBT_JOIN_MODES.has(joinMode),
    credentialType: PRIVATE_CREDENTIAL_SBT_JOIN_MODES.has(joinMode) ? joinMode : null,
    requiresFullCeAccount: FULL_CE_ACCOUNT_SBT_JOIN_MODES.has(joinMode) || input.requiresFullCeAccount === true,
    publicCommandTargetAllowed: Boolean(sbtAddress || groupId || shareLink),
  };
}

export function normalizeRequiredSbtGroups(session = {}) {
  const candidates = Array.isArray(session.requiredSbtGroups)
    ? session.requiredSbtGroups
    : (
      Array.isArray(session.requiredSbts)
        ? session.requiredSbts
        : (Array.isArray(session.sbtGates) ? session.sbtGates : [])
    );
  return candidates
    .map(normalizeRequiredSbtGroup)
    .filter(Boolean);
}

function plainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function sessionModeProfile(session = {}) {
  return plainObject(session.sessionModeProfile) ? session.sessionModeProfile : null;
}

function sessionModeProfileSurfaces(session = {}) {
  const profile = sessionModeProfile(session);
  return plainObject(profile?.surfaces) ? profile.surfaces : null;
}

function sessionModeProfileAuthority(session = {}) {
  const profile = sessionModeProfile(session);
  return plainObject(profile?.authority) ? profile.authority : null;
}

function sessionModeProfileExport(session = {}) {
  const profile = sessionModeProfile(session);
  return plainObject(profile?.export) ? profile.export : null;
}

function sessionModeProfileResultsExposure(session = {}) {
  const profile = sessionModeProfile(session);
  return plainObject(profile?.results?.exposure) ? profile.results.exposure : null;
}

function normalizeExportScope(value = '') {
  const scope = safeString(value).toLowerCase();
  return [
    'admin_raw',
    'all_session',
    'selected_surfaces',
    'encrypted_envelopes_only',
  ].includes(scope) ? scope : null;
}

function legacyTelegramOnlySession(session = {}) {
  return (
    normalizeBool(session.telegramOnly) ||
    normalizeBool(session.telegram_only) ||
    normalizeBool(session.telegram?.only) ||
    safeString(session.sessionMode || session.mode || session.telegramMode || session.telegram?.mode).toLowerCase() === 'telegram_only'
  );
}

function sessionModeProfileTelegramEnabled(session = {}) {
  const surfaces = sessionModeProfileSurfaces(session);
  return surfaces ? surfaces.telegram === true : null;
}

function sessionModeProfileTelegramFirst(session = {}) {
  const surfaces = sessionModeProfileSurfaces(session);
  const authority = sessionModeProfileAuthority(session);
  if (!surfaces || !authority) return null;
  return surfaces.telegram === true && authority.mode === 'worker_canonical';
}

function normalizeLightweightGroups(session = {}) {
  const groups = Array.isArray(session.lightweightGroups)
    ? session.lightweightGroups
    : (
      Array.isArray(session.telegramGroups)
        ? session.telegramGroups
        : (Array.isArray(session.telegramOnlyGroups) ? session.telegramOnlyGroups : [])
    );
  return groups
    .filter(plainObject)
    .map((group) => ({
      ...group,
      options: Array.isArray(group.options) ? group.options.slice() : [],
    }));
}

function normalizeTelegramGroupChatIds(...values) {
  const out = [];
  for (const value of values) {
    const source = Array.isArray(value) ? value : safeString(value).split(/[\s,;|]+/);
    for (const item of source) {
      const raw = item && typeof item === 'object' && !Array.isArray(item)
        ? safeString(item.chatId || item.groupChatId || item.telegramChatId || item.id)
        : safeString(item);
      if (raw && !out.includes(raw)) out.push(raw);
    }
  }
  return out;
}

function normalizePositiveInteger(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return fallback;
  return Math.floor(number);
}

function timestampMs(value = '') {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 0 && value < 10_000_000_000 ? Math.floor(value * 1000) : Math.floor(value);
  }
  const text = safeString(value);
  if (!text) return null;
  if (/^\d+$/.test(text)) {
    const number = Number(text);
    if (!Number.isFinite(number) || number <= 0) return null;
    return number < 10_000_000_000 ? Math.floor(number * 1000) : Math.floor(number);
  }
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeDefaultSessionSchedule(input = {}) {
  const source = Array.isArray(input.defaultSessionSchedule)
    ? input.defaultSessionSchedule
    : (
      Array.isArray(input.defaultSessionTimeline)
        ? input.defaultSessionTimeline
        : (Array.isArray(input.telegramDefaultSessionSchedule) ? input.telegramDefaultSessionSchedule : [])
    );
  return source
    .filter(plainObject)
    .map((entry) => {
      const sessionSlug = safeString(entry.sessionSlug || entry.slug || entry.defaultSessionSlug).toLowerCase();
      if (!SESSION_SLUG_RE.test(sessionSlug)) return null;
      return {
        sessionSlug,
        from: safeString(entry.from || entry.effectiveAt || entry.startsAt || entry.startAt || entry.after) || null,
        until: safeString(entry.until || entry.expiresAt || entry.endsAt || entry.endAt || entry.before) || null,
      };
    })
    .filter(Boolean);
}

function selectDefaultSessionSlug({
  baseDefaultSessionSlug = '',
  schedule = [],
  now = null,
} = {}) {
  const base = safeString(baseDefaultSessionSlug).toLowerCase();
  const nowMs = timestampMs(now) ?? Date.now();
  const candidates = schedule
    .map((entry, index) => {
      const hasFrom = safeString(entry.from) !== '';
      const hasUntil = safeString(entry.until) !== '';
      const fromMs = timestampMs(entry.from);
      const untilMs = timestampMs(entry.until);
      if ((hasFrom && !Number.isFinite(fromMs)) || (hasUntil && !Number.isFinite(untilMs))) {
        return null;
      }
      const starts = !Number.isFinite(fromMs) || nowMs >= fromMs;
      const notEnded = !Number.isFinite(untilMs) || nowMs < untilMs;
      if (!starts || !notEnded) return null;
      return { ...entry, index, fromMs: Number.isFinite(fromMs) ? fromMs : Number.NEGATIVE_INFINITY };
    })
    .filter(Boolean)
    .sort((left, right) => right.fromMs - left.fromMs || right.index - left.index);
  return candidates[0]?.sessionSlug || base;
}

function normalizeResultsExposurePolicy(session = {}) {
  const profileExposure = sessionModeProfileResultsExposure(session);
  const source = profileExposure
    ? profileExposure
    : plainObject(session.resultsExposure)
      ? session.resultsExposure
    : (
      plainObject(session.telegramResultsExposure)
        ? session.telegramResultsExposure
        : (plainObject(session.publicResultsExposure) ? session.publicResultsExposure : {})
    );
  const aggregateValue = source.aggregateResultsEnabled ??
    source.aggregateResults ??
    source.level3Enabled ??
    session.aggregateResultsEnabled ??
    session.telegramAggregateResultsEnabled;
  const publishedQuestionsValue = source.publishedQuestionsEnabled ??
    source.publishedQuestions ??
    source.level2Enabled ??
    session.publishedQuestionsEnabled ??
    session.telegramPublishedQuestionsEnabled;
  const anonymizedGroupsValue = source.anonymizedGroupsEnabled ??
    source.anonymizedGroups ??
    source.groupViewEnabled ??
    source.groupsEnabled ??
    source.level4Enabled ??
    session.anonymizedGroupsEnabled ??
    session.telegramAnonymizedGroupsEnabled;

  return {
    metricsEnabled: true,
    publishedQuestionsEnabled: normalizeBool(publishedQuestionsValue),
    aggregateResultsEnabled: aggregateValue === undefined || aggregateValue === null
      ? true
      : normalizeBool(aggregateValue),
    anonymizedGroupsEnabled: normalizeBool(anonymizedGroupsValue),
    minGroupSize: Math.max(2, normalizePositiveInteger(
      source.minGroupSize ?? session.resultsMinGroupSize ?? session.telegramResultsMinGroupSize,
      2
    )),
  };
}

function buildJoinedSbtLookup(joinedSbtIds = []) {
  return new Set((Array.isArray(joinedSbtIds) ? joinedSbtIds : [])
    .map((value) => safeString(value).toLowerCase())
    .filter(Boolean));
}

function isRequiredSbtJoined(group = {}, joinedLookup = new Set()) {
  return [group.sbtId, group.sbtAddress, group.groupId, group.shareLink]
    .map((value) => safeString(value).toLowerCase())
    .filter(Boolean)
    .some((value) => joinedLookup.has(value));
}

export function normalizeSessionPolicy(input = {}, {
  now = null,
} = {}) {
  const sessions = Array.isArray(input.sessions)
    ? input.sessions
    : (Array.isArray(input.linkedSessions) ? input.linkedSessions : []);
  const linkedSessions = sessions.map((session) => {
    const profileTelegramEnabled = sessionModeProfileTelegramEnabled(session);
    const profileTelegramFirst = sessionModeProfileTelegramFirst(session);
    const profileSurfaces = sessionModeProfileSurfaces(session);
    const profileAuthority = sessionModeProfileAuthority(session);
    const workerCanonical = safeString(profileAuthority?.mode).toLowerCase() === 'worker_canonical';
    const telegramBridgeEnabled = profileTelegramEnabled === null
      ? session.telegramBridgeEnabled !== false
      : profileTelegramEnabled;
    return {
    sessionMode: safeString(session.sessionMode || session.mode || session.telegramMode || session.telegram?.mode).toLowerCase(),
    sessionSlug: safeString(session.sessionSlug || session.slug || session.name).toLowerCase(),
    sessionIdHex: resolveCanonicalSessionId(session) || null,
    sessionName: safeString(session.sessionName || session.name || session.slug),
    createdAt: safeString(
      session.createdAt ||
      session.created_at ||
      session.created ||
      session.sessionCreatedAt ||
      session.telegramCreatedAt ||
      session.groupCreatedAt ||
      session.metadata?.createdAt ||
      session.telegram?.createdAt
    ) || null,
    createdTimestamp: safeString(
      session.createdTimestamp ||
      session.createdAtMs ||
      session.createdTimestampMs ||
      session.sessionCreatedTimestamp ||
      session.groupCreatedTimestamp ||
      session.blockTimestamp ||
      session.createdBlockTimestamp ||
      session.metadata?.createdTimestamp ||
      session.telegram?.createdTimestamp
    ) || null,
    sessionContext: safeString(
      session.sessionContext ||
      session.telegramSessionContext ||
      session.context ||
      session.description ||
      session.purpose ||
      session.topic ||
      session.metadata?.sessionContext ||
      session.metadata?.context ||
      session.metadata?.description
    ).replace(/\s+/g, ' ').slice(0, 1200) || null,
    questionTags: (Array.isArray(session.questionTags)
      ? session.questionTags
      : (Array.isArray(session.defaultQuestionTags)
        ? session.defaultQuestionTags
        : (Array.isArray(session.telegramQuestionTags) ? session.telegramQuestionTags : [])))
      .map(safeString)
      .filter(Boolean)
      .slice(0, 20),
    tags: (Array.isArray(session.tags)
      ? session.tags
      : (Array.isArray(session.defaultTags) ? session.defaultTags : []))
      .map(safeString)
      .filter(Boolean)
      .slice(0, 20),
    default: session.default === true,
    telegramBridgeEnabled,
    miniAppEnabled: profileSurfaces
      ? profileSurfaces.miniApp === true
      : session.miniAppEnabled === false
        ? false
        : telegramBridgeEnabled,
    agentHttpEnabled: sessionModeProfileSurfaces(session)
      ? sessionModeProfileSurfaces(session).agentHttp === true
      : session.agentHttpEnabled === undefined && session.agentHttp === undefined
        ? telegramBridgeEnabled
        : normalizeBool(session.agentHttpEnabled || session.agentHttp),
    telegramOnly: profileTelegramFirst === null ? legacyTelegramOnlySession(session) : profileTelegramFirst,
    sessionModeProfile: sessionModeProfile(session) ? { ...sessionModeProfile(session) } : null,
    managedAccountSubmitAllowed: session.managedAccountSubmitAllowed === true,
    sponsoredAiAllowed: session.sponsoredAiAllowed === true,
    sponsoredRpcAllowed: session.sponsoredRpcAllowed === true,
    sponsoredFaucetAllowed: session.sponsoredFaucetAllowed === true,
    sbtJoinModes: Array.isArray(session.sbtJoinModes) ? session.sbtJoinModes.slice() : ['public'],
    requiredSbtGroups: normalizeRequiredSbtGroups(session),
    lightweightGroups: normalizeLightweightGroups(session),
    resultsExposure: normalizeResultsExposurePolicy(session),
    questionAuthoringPermissionMode: safeString(
      session.questionAuthoringPermissionMode ||
      session.telegramQuestionAuthoringPermissionMode ||
      session.telegram?.questionAuthoringPermissionMode ||
      input.questionAuthoringPermissionMode ||
      input.telegramQuestionAuthoringPermissionMode
    ).toLowerCase() || null,
    authoringGroupChatIds: (Array.isArray(session.authoringGroupChatIds)
      ? session.authoringGroupChatIds
      : (Array.isArray(session.telegramAuthoringGroupChatIds)
        ? session.telegramAuthoringGroupChatIds
        : (Array.isArray(input.authoringGroupChatIds) ? input.authoringGroupChatIds : [])))
      .map(safeString)
      .filter(Boolean),
    telegramAuthoringGroupChatIds: (Array.isArray(session.telegramAuthoringGroupChatIds)
      ? session.telegramAuthoringGroupChatIds
      : (Array.isArray(input.telegramAuthoringGroupChatIds) ? input.telegramAuthoringGroupChatIds : []))
      .map(safeString)
      .filter(Boolean),
    approvedTelegramGroupChatIds: normalizeTelegramGroupChatIds(
      session.approvedTelegramGroupChatIds,
      session.telegramApprovedGroupChatIds,
      session.allowedTelegramGroupChatIds,
      session.telegramAllowedGroupChatIds,
      session.approvedTelegramChats,
      session.telegramApprovedChats,
      session.allowedTelegramChats,
      session.telegramAllowedChats,
      session.telegram?.approvedGroupChatIds,
      session.telegram?.allowedGroupChatIds,
      input.approvedTelegramGroupChatIds,
      input.telegramApprovedGroupChatIds,
      input.allowedTelegramGroupChatIds,
      input.telegramAllowedGroupChatIds
    ),
    telegramGroupOpenAccess: normalizeBool(
      session.telegramGroupOpenAccess ||
      session.telegramOpenGroupAccess ||
      session.telegram?.groupOpenAccess ||
      session.telegram?.openGroupAccess ||
      input.telegramGroupOpenAccess ||
      input.telegramOpenGroupAccess
    ),
    telegramGroupApprovalRequired: normalizeBool(
      session.telegramGroupApprovalRequired ||
      session.requireTelegramGroupApproval ||
      session.telegramApprovedGroupsRequired ||
      session.telegram?.groupApprovalRequired ||
      session.telegram?.requireGroupApproval ||
      input.telegramGroupApprovalRequired ||
      input.requireTelegramGroupApproval
    ),
    docLibraryEnabled: session.docLibraryEnabled === true,
    responseExportAllowedAddresses: Array.isArray(session.responseExportAllowedAddresses)
      ? session.responseExportAllowedAddresses.slice()
      : safeString(session.responseExportAllowedAddresses),
    telegramResponseExportAllowedAddresses: Array.isArray(session.telegramResponseExportAllowedAddresses)
      ? session.telegramResponseExportAllowedAddresses.slice()
      : safeString(session.telegramResponseExportAllowedAddresses),
    exportScope: normalizeExportScope(
      session.exportScope ||
      session.export?.scope ||
      sessionModeProfileExport(session)?.scope ||
      input.exportScope ||
      input.export?.scope
    ),
    questions: Array.isArray(session.questions)
      ? session.questions.slice()
      : (Array.isArray(session.telegramQuestions) ? session.telegramQuestions.slice() : []),
    storageProfile: (
      session.storageProfile && typeof session.storageProfile === 'object' && !Array.isArray(session.storageProfile)
        ? { ...session.storageProfile }
        : null
    ),
    defaultGroupChatId: safeString(session.defaultGroupChatId || input.defaultGroupChatId) || null,
    sessionWorkerUrl: safeString(
      session.sessionWorkerUrl ||
      session.workerUrl ||
      session.corsWorkerUrl ||
      session.ceSessionWorkerBaseUrl ||
      session.CE_SESSION_WORKER_BASE_URL ||
      (workerCanonical
        ? ''
        : (
          input.sessionWorkerUrl ||
          input.workerUrl ||
          input.corsWorkerUrl ||
          input.ceSessionWorkerBaseUrl ||
          input.CE_SESSION_WORKER_BASE_URL
        ))
    ) || null,
    workerSessionSlug: safeString(
      session.workerSessionSlug ||
      session.sessionWorkerSlug ||
      session.ceSessionWorkerSessionSlug ||
      session.sessionWorkerSessionSlug ||
      input.workerSessionSlug ||
      input.sessionWorkerSlug ||
      input.ceSessionWorkerSessionSlug ||
      input.sessionWorkerSessionSlug
    ).toLowerCase() || null,
    workerLoginOrigin: safeString(
      session.workerLoginOrigin ||
      session.sessionWorkerLoginOrigin ||
      session.ceSessionWorkerLoginOrigin ||
      session.loginOrigin ||
      input.workerLoginOrigin ||
      input.sessionWorkerLoginOrigin ||
      input.ceSessionWorkerLoginOrigin ||
      input.loginOrigin
    ) || null,
    allowOrigins: (Array.isArray(session.allowOrigins)
      ? session.allowOrigins
      : (Array.isArray(input.allowOrigins) ? input.allowOrigins : []))
      .map(safeString)
      .filter(Boolean),
    surveysAddress: safeString(
      session.surveysAddress ||
      session.surveyAddress ||
      session.surveysContractAddress ||
      session.surveyContractAddress ||
      input.surveysAddress ||
      input.surveyAddress ||
      input.surveysContractAddress ||
      input.surveyContractAddress
    ) || null,
    chainId: safeString(session.chainId || input.chainId || input.defaultChainId) || null,
  };
  }).filter((session) => SESSION_SLUG_RE.test(session.sessionSlug));
  const baseDefaultSessionSlug = safeString(
    input.defaultSessionSlug ||
    input.defaultSession ||
    (typeof input.default === 'string' ? input.default : '') ||
    linkedSessions.find((session) => session.default)?.sessionSlug ||
    linkedSessions[0]?.sessionSlug
  ).toLowerCase();
  const defaultSessionSchedule = normalizeDefaultSessionSchedule(input);
  return {
    type: 'agent_bridge_session_policy',
    linkedSessions,
    defaultSessionSlug: selectDefaultSessionSlug({
      baseDefaultSessionSlug,
      schedule: defaultSessionSchedule,
      now: now || input.policyNow || input.now,
    }),
    configuredDefaultSessionSlug: baseDefaultSessionSlug,
    defaultSessionSchedule,
    riskCeiling: normalizeRisk(input.riskCeiling || RISK_CEILINGS.READ),
    allowQuestionGeneration: input.allowQuestionGeneration === true,
    allowAddQuestion: input.allowAddQuestion === true,
    allowGenerateQuestion: input.allowGenerateQuestion === true || input.allowQuestionGeneration === true,
  };
}

function resolveLinkedSessionInvocation(policyInput = {}, sessionNameOrSlug = '') {
  const policy = policyInput?.type === 'agent_bridge_session_policy' && Array.isArray(policyInput.linkedSessions)
    ? policyInput
    : normalizeSessionPolicy(policyInput);
  const lookup = safeString(sessionNameOrSlug || policy.defaultSessionSlug).toLowerCase();
  const session = policy.linkedSessions.find((entry) => (
    entry.sessionSlug === lookup || entry.sessionName.toLowerCase() === lookup
  ));
  if (!session) return { ok: false, reason: 'session_not_linked', sessionSlug: lookup };
  return { ok: true, session, policy };
}

export function resolveSessionInvocation(policyInput = {}, sessionNameOrSlug = '') {
  const resolved = resolveLinkedSessionInvocation(policyInput, sessionNameOrSlug);
  if (!resolved.ok || resolved.session.telegramBridgeEnabled === true) return resolved;
  return { ok: false, reason: 'telegram_bridge_disabled', sessionSlug: resolved.session.sessionSlug };
}

export function resolveAgentHttpSessionInvocation(policyInput = {}, sessionNameOrSlug = '') {
  const resolved = resolveLinkedSessionInvocation(policyInput, sessionNameOrSlug);
  if (!resolved.ok || resolved.session.agentHttpEnabled === true) return resolved;
  return { ok: false, reason: 'agent_http_disabled', sessionSlug: resolved.session.sessionSlug };
}

export function resolveMiniAppSessionInvocation(policyInput = {}, sessionNameOrSlug = '') {
  const resolved = resolveLinkedSessionInvocation(policyInput, sessionNameOrSlug);
  if (!resolved.ok) return resolved;
  if (resolved.session.telegramBridgeEnabled !== true) {
    return { ok: false, reason: 'telegram_bridge_disabled', sessionSlug: resolved.session.sessionSlug };
  }
  if (resolved.session.miniAppEnabled !== true) {
    return { ok: false, reason: 'mini_app_disabled', sessionSlug: resolved.session.sessionSlug };
  }
  return resolved;
}

export function evaluateTelegramGroupSessionAccess(session = {}, {
  chatId = '',
  normalized = {},
} = {}) {
  const groupChatId = safeString(chatId || normalized.chat?.chatId || normalized.groupChatId);
  const approved = normalizeTelegramGroupChatIds(session.approvedTelegramGroupChatIds);
  const openAccess = session.telegramGroupOpenAccess === true;
  const approvalRequired = !openAccess || session.telegramGroupApprovalRequired === true || approved.length > 0;
  if (openAccess) {
    return {
      ok: true,
      reason: 'telegram_group_access_unrestricted',
      groupChatId,
      approvedTelegramGroupChatIds: [],
      telegramGroupApprovalRequired: false,
      telegramGroupOpenAccess: true,
    };
  }
  if (groupChatId && approved.includes(groupChatId)) {
    return {
      ok: true,
      reason: 'telegram_group_access_approved',
      groupChatId,
      approvedTelegramGroupChatIds: approved,
      telegramGroupApprovalRequired: approvalRequired,
      telegramGroupOpenAccess: openAccess,
    };
  }
  return {
    ok: false,
    reason: 'telegram_group_not_approved_for_session',
    groupChatId,
    approvedTelegramGroupChatIds: approved,
    telegramGroupApprovalRequired: approvalRequired,
    telegramGroupOpenAccess: openAccess,
  };
}

export function evaluateSbtJoinPolicy(session = {}, {
  mode = 'public',
  password = '',
  linkedWalletEligible = false,
} = {}) {
  const modes = Array.isArray(session.sbtJoinModes) ? session.sbtJoinModes : [];
  if (modes.includes('public') || modes.includes('open')) {
    return { ok: true, reason: 'sbt_public_open_join_allowed', requiresPassword: false };
  }
  if (modes.includes('linked-wallet') && linkedWalletEligible) {
    return { ok: true, reason: 'linked_wallet_sbt_join_allowed', requiresPassword: false };
  }
  if (modes.includes('password')) {
    return password
      ? { ok: true, reason: 'sbt_password_join_allowed', requiresPassword: true }
      : { ok: false, reason: 'sbt_password_required', requiresPassword: true };
  }
  if (modes.includes('invite')) {
    return { ok: false, reason: 'sbt_invite_required', requiresInvite: true };
  }
  return { ok: false, reason: 'sbt_join_not_allowed' };
}

export function evaluateSessionSbtGateJoin(session = {}, {
  joinedSbtIds = [],
} = {}) {
  const requiredSbtGroups = normalizeRequiredSbtGroups(session);
  const joinedLookup = buildJoinedSbtLookup(joinedSbtIds);
  const groups = requiredSbtGroups.map((group) => ({
    ...group,
    joined: isRequiredSbtJoined(group, joinedLookup),
  }));
  const allSatisfied = groups.every((group) => group.joined === true);
  if (groups.length === 0) {
    return {
      ok: true,
      status: 'no_sbt_gate_required',
      requiredSbtGroups: [],
      allSatisfied: true,
      nextStep: TELEGRAM_BRIDGE_ACTIONS.JOIN_SESSION,
    };
  }
  return {
    ok: allSatisfied,
    status: allSatisfied ? 'ready_to_retry_session_join' : 'sbt_gate_required',
    requiredSbtGroups: groups,
    allSatisfied,
    nextStep: allSatisfied
      ? TELEGRAM_BRIDGE_ACTIONS.RETRY_SESSION_JOIN
      : 'join_required_sbt',
  };
}

export function evaluateSponsoredResourceEligibility(session = {}, {
  resource = 'ai',
  requestedRisk = RISK_CEILINGS.SPONSORED,
  riskCeiling = RISK_CEILINGS.SPONSORED,
} = {}) {
  if (!riskAllows(requestedRisk, riskCeiling)) {
    return { ok: false, reason: 'risk_ceiling_exceeded', resource };
  }
  const resourceAllowed = {
    ai: session.sponsoredAiAllowed === true,
    rpc: session.sponsoredRpcAllowed === true,
    faucet: session.sponsoredFaucetAllowed === true,
  }[resource] === true;
  return resourceAllowed
    ? { ok: true, reason: `sponsored_${resource}_allowed`, resource, secretExposed: false }
    : { ok: false, reason: `sponsored_${resource}_not_allowed`, resource, secretExposed: false };
}

export function evaluateResponseActionPolicy({
  account = {},
  grant = {},
  session = {},
  action = TELEGRAM_BRIDGE_ACTIONS.DRAFT_RESPONSE,
} = {}) {
  if (action === TELEGRAM_BRIDGE_ACTIONS.DIRECT_SUBMIT_RESPONSE) {
    if (account.accountMode !== 'managed_telegram_demo') {
      return { ok: false, reason: 'direct_submit_managed_demo_only' };
    }
    if (session.managedAccountSubmitAllowed !== true) {
      return { ok: false, reason: 'session_direct_submit_not_allowed' };
    }
    if (!Array.isArray(grant.allowedActions) || !grant.allowedActions.includes(action)) {
      return { ok: false, reason: 'grant_direct_submit_not_allowed' };
    }
    if (!riskAllows(RISK_CEILINGS.SUBMIT, grant.riskCeiling || RISK_CEILINGS.READ)) {
      return { ok: false, reason: 'risk_ceiling_exceeded' };
    }
    return { ok: true, reason: 'direct_submit_allowed' };
  }
  if (action === TELEGRAM_BRIDGE_ACTIONS.SUBMIT_RESPONSE) {
    return { ok: true, reason: 'submit_request_requires_policy_approval', requiresApproval: true };
  }
  if (action === TELEGRAM_BRIDGE_ACTIONS.SUGGEST_RESPONSE) {
    return { ok: true, reason: 'suggest_response_ephemeral', persisted: false };
  }
  if (action === TELEGRAM_BRIDGE_ACTIONS.DRAFT_RESPONSE) {
    return { ok: true, reason: 'draft_response_saved', persisted: true };
  }
  return { ok: false, reason: 'unknown_response_action' };
}

export function evaluateTelegramNormalSessionSubmit({
  account = {},
  grant = {},
  session = {},
  action = TELEGRAM_BRIDGE_ACTIONS.DIRECT_SUBMIT_RESPONSE,
  joinedSbtIds = [],
  fallbackWhenDirectDenied = true,
} = {}) {
  const gate = evaluateSessionSbtGateJoin(session, { joinedSbtIds });
  if (!gate.ok) {
    return {
      ok: false,
      reason: 'session_sbt_gate_required',
      gate,
      effectiveAction: null,
    };
  }

  const direct = evaluateResponseActionPolicy({
    account,
    grant,
    session,
    action,
  });
  if (direct.ok) {
    return {
      ...direct,
      ok: true,
      mode: action === TELEGRAM_BRIDGE_ACTIONS.DIRECT_SUBMIT_RESPONSE ? 'direct_submit' : action,
      effectiveAction: action,
      directSubmitAllowed: action === TELEGRAM_BRIDGE_ACTIONS.DIRECT_SUBMIT_RESPONSE,
      gate,
    };
  }

  if (action !== TELEGRAM_BRIDGE_ACTIONS.DIRECT_SUBMIT_RESPONSE || fallbackWhenDirectDenied !== true) {
    return { ...direct, gate, effectiveAction: null };
  }

  const allowedActions = Array.isArray(grant.allowedActions) ? grant.allowedActions : [];
  const fallbackAction = allowedActions.includes(TELEGRAM_BRIDGE_ACTIONS.SUBMIT_RESPONSE)
    ? TELEGRAM_BRIDGE_ACTIONS.SUBMIT_RESPONSE
    : TELEGRAM_BRIDGE_ACTIONS.DRAFT_RESPONSE;
  const fallback = evaluateResponseActionPolicy({
    account,
    grant,
    session,
    action: fallbackAction,
  });
  return {
    ...fallback,
    ok: fallback.ok === true,
    reason: fallbackAction === TELEGRAM_BRIDGE_ACTIONS.SUBMIT_RESPONSE
      ? 'direct_submit_denied_submit_request_created'
      : 'direct_submit_denied_draft_created',
    deniedDirectSubmitReason: direct.reason,
    directSubmitAllowed: false,
    fallbackCreated: true,
    effectiveAction: fallbackAction,
    mode: fallbackAction === TELEGRAM_BRIDGE_ACTIONS.SUBMIT_RESPONSE ? 'submit_request' : 'draft',
    gate,
  };
}
