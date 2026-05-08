export const AGENT_BRIDGE_CONTRACT_VERSION = 'agent-bridge-worker-contract-v1';

export const AGENT_BRIDGE_EVENT_TYPES = Object.freeze({
  GROUP_CARD_POSTED: 'group_card_posted',
  PRIVATE_START_OPENED: 'private_start_opened',
  ACCOUNT_CREATED: 'account_created',
  ACCOUNT_RECOVERED: 'account_recovered',
  LINK_REQUESTED: 'link_requested',
  QUESTION_DELIVERED: 'question_delivered',
  RESPONSE_SUGGESTED: 'response_suggested',
  RESPONSE_ACTION_CREATED: 'response_action_created',
  DRAFT_SAVED: 'draft_saved',
  SUBMIT_REQUESTED: 'submit_requested',
  DELEGATED_EXECUTE_DEFERRED: 'delegated_execute_deferred',
  DELEGATED_EXECUTE_EXECUTED: 'delegated_execute_executed',
  APPROVED: 'approved',
  SUBMITTED: 'submitted',
  FAILED: 'failed',
  GRANT_REVOKED: 'grant_revoked',
});

export const AGENT_ACCOUNT_SIGNER_BOUNDARIES = Object.freeze({
  DURABLE_OBJECT_ISOLATED_SIGNER_PLANNED: 'durable_object_isolated_signer_planned',
  MANAGED_TESTNET_ACCOUNT_RUNTIME: 'managed_testnet_account_runtime',
});

const SECRET_FIELD_RE = /(?:privatekey|private_key|worker.?token|bearer|jwt|authorization|secret|signature|mnemonic|seed|password|signingauthority)/i;
const SECRET_VALUE_RE = /(?:bearer\s+[a-z0-9._:-]+|eyj[a-z0-9_-]*\.[a-z0-9_-]*\.|0x[0-9a-f]{64})/i;
const SAFE_HASH_VALUE_KEYS = new Set(['questionid', 'contenthash', 'hash', 'txhash']);
const SAFE_ID_RE = /^[a-z0-9][a-z0-9._:@-]{0,127}$/i;
const SESSION_RE = /^[a-z0-9_-]{1,128}$/i;

const safeString = (value) => String(value || '').trim();
const lower = (value) => safeString(value).toLowerCase();

function unique(values = []) {
  return [...new Set(values)];
}

function stableHash(value = '') {
  let hash = 0x811c9dc5;
  const input = String(value || '');
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36).padStart(7, '0');
}

export function redactAgentBridgeSecrets(value, path = []) {
  if (Array.isArray(value)) return value.map((entry, index) => redactAgentBridgeSecrets(entry, [...path, String(index)]));
  if (typeof value === 'string') {
    const key = lower(path[path.length - 1]);
    return !SAFE_HASH_VALUE_KEYS.has(key) && SECRET_VALUE_RE.test(value.toLowerCase()) ? '[redacted]' : value;
  }
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => {
    if (SECRET_FIELD_RE.test(key)) return [key, '[redacted]'];
    return [key, redactAgentBridgeSecrets(entry, [...path, key])];
  }));
}

function normalizeSafeId(value, fallback = '') {
  const normalized = safeString(value);
  return SAFE_ID_RE.test(normalized) ? normalized : fallback;
}

function normalizeSession(value) {
  const session = safeString(value);
  return SESSION_RE.test(session) ? session : '';
}

export function normalizeAgentPrincipal(principal = {}) {
  const kind = lower(principal.kind || principal.principalKind || 'agent');
  const principalId = normalizeSafeId(
    principal.principalId || principal.id || principal.agentId || principal.subject,
    kind ? `${kind}:unknown` : 'agent:unknown',
  );
  return {
    type: 'agent_principal_summary',
    version: AGENT_BRIDGE_CONTRACT_VERSION,
    principalKind: kind || 'agent',
    principalId,
    displayName: safeString(principal.displayName || principal.name) || null,
    handle: safeString(principal.handle || principal.username) || null,
  };
}

export function normalizeTelegramPrincipal(principal = {}) {
  const telegramUserId = safeString(principal.telegramUserId || principal.userId || principal.id);
  return normalizeAgentPrincipal({
    kind: 'telegram',
    principalId: principal.principalId || (telegramUserId ? `telegram:${telegramUserId}` : 'telegram:unknown'),
    displayName: principal.displayName || principal.firstName || principal.name,
    handle: principal.handle || principal.username,
  });
}

export function normalizeOpenClawPrincipal(principal = {}) {
  const threadId = safeString(principal.threadId || principal.conversationId || principal.id);
  return normalizeAgentPrincipal({
    kind: 'openclaw',
    principalId: principal.principalId || (threadId ? `openclaw:${threadId}` : 'openclaw:unknown'),
    displayName: principal.displayName || principal.name,
    handle: principal.handle || principal.workspace,
  });
}

export function normalizeAgentBridgeScope(scope = {}) {
  const accountPrincipal = normalizeAgentPrincipal(scope.accountPrincipal || {
    kind: 'ce_account',
    principalId: scope.accountPrincipalId || scope.accountId || scope.accountAddress || scope.humanPrincipal,
  });
  const agentPrincipal = normalizeAgentPrincipal(scope.agentPrincipal || {
    kind: 'agent',
    principalId: scope.agentPrincipalId || scope.agentId,
  });
  const integrationPrincipal = normalizeAgentPrincipal(scope.integrationPrincipal || {
    kind: scope.integrationKind || 'integration',
    principalId: scope.integrationPrincipalId || scope.integrationId,
  });
  const session = normalizeSession(scope.session);
  const grantId = normalizeSafeId(scope.grantId, '');
  const scopeKey = [
    accountPrincipal.principalId,
    agentPrincipal.principalId,
    integrationPrincipal.principalId,
    session,
    grantId,
  ].join('|');
  return {
    type: 'agent_bridge_scope',
    version: AGENT_BRIDGE_CONTRACT_VERSION,
    accountPrincipal,
    agentPrincipal,
    integrationPrincipal,
    session,
    grantId,
    scopeKey,
    privateByDefault: true,
  };
}

export function buildOpaqueAgentActionId(seed = '') {
  return `agent_action_${stableHash(seed || 'action')}`;
}

export function normalizeAgentActionRecord(record = {}) {
  const scope = normalizeAgentBridgeScope(record);
  const actionName = normalizeSafeId(record.actionName || record.actionType || record.actionId, 'agent.action');
  const fingerprint = safeString(record.fingerprint || stableHash(JSON.stringify({
    scopeKey: scope.scopeKey,
    actionName,
    payloadRef: record.payloadRef || null,
  })));
  const actionRecordId = /^agent_action_[a-z0-9]{7,32}$/.test(safeString(record.actionRecordId))
    ? safeString(record.actionRecordId)
    : buildOpaqueAgentActionId(`${scope.scopeKey}|${actionName}|${fingerprint}`);
  return {
    type: 'agent_action_record',
    version: AGENT_BRIDGE_CONTRACT_VERSION,
    actionRecordId,
    actionName,
    scope,
    fingerprint,
    payloadRef: normalizePreferenceBundleRef(record.payloadRef || record.payloadRefId || null),
    status: lower(record.status || 'recorded'),
    createdAt: record.createdAt || null,
  };
}

export function normalizeAgentIdempotencyRecord(record = {}) {
  const scope = normalizeAgentBridgeScope(record);
  return {
    type: 'agent_idempotency_record',
    version: AGENT_BRIDGE_CONTRACT_VERSION,
    key: lower(record.key || record.idempotencyKey),
    fingerprint: safeString(record.fingerprint),
    scope,
    actionRecordId: safeString(record.actionRecordId) || null,
    createdAt: record.createdAt || null,
  };
}

export function evaluateAgentIdempotencyRecord(existing = {}, candidate = {}) {
  const current = normalizeAgentIdempotencyRecord(existing);
  const next = normalizeAgentIdempotencyRecord(candidate);
  if (!current.key || !next.key) return { ok: true, reason: 'idempotency_key_absent', record: next };
  if (current.key !== next.key || current.scope.scopeKey !== next.scope.scopeKey) {
    return { ok: true, reason: 'idempotency_scope_distinct', record: next };
  }
  if (current.fingerprint !== next.fingerprint) {
    return {
      ok: false,
      reason: 'idempotency_fingerprint_conflict',
      existing: current,
      candidate: next,
    };
  }
  return { ok: true, reason: 'idempotency_replay', record: current };
}

export function normalizePreferenceBundleRef(ref = {}) {
  if (!ref) return null;
  if (typeof ref === 'string') {
    return {
      type: 'agent_preference_bundle_ref',
      refId: normalizeSafeId(ref, ''),
      uri: null,
      contentHash: null,
      source: null,
    };
  }
  return {
    type: 'agent_preference_bundle_ref',
    refId: normalizeSafeId(ref.refId || ref.id, ''),
    uri: safeString(ref.uri) || null,
    contentHash: safeString(ref.contentHash || ref.hash) || null,
    source: safeString(ref.source) || null,
  };
}

function normalizePreferenceEntries(input = {}, source = 'agent') {
  if (Array.isArray(input)) {
    return input.map((entry) => ({
      key: lower(entry?.key),
      value: redactAgentBridgeSecrets(entry?.value),
      source: safeString(entry?.source || source) || 'agent',
    })).filter((entry) => entry.key);
  }
  if (input && typeof input === 'object') {
    return Object.entries(input).map(([key, value]) => ({
      key: lower(key),
      value: redactAgentBridgeSecrets(value),
      source,
    })).filter((entry) => entry.key);
  }
  return [];
}

export function normalizeAgentPreferenceProfile(profile = {}) {
  const refs = [
    normalizePreferenceBundleRef(profile.preferenceProfileRef || profile.ref || null),
    ...((Array.isArray(profile.refs) ? profile.refs : []).map((ref) => normalizePreferenceBundleRef(ref))),
  ].filter(Boolean);
  const source = safeString(profile.source || profile.sourceTag || 'agent') || 'agent';
  const entries = normalizePreferenceEntries(profile.entries || profile.preferences || {}, source);
  return {
    type: 'agent_preference_profile',
    version: AGENT_BRIDGE_CONTRACT_VERSION,
    profileId: normalizeSafeId(profile.profileId || profile.id, ''),
    mode: entries.length ? 'by_value' : 'by_ref',
    sourceTags: unique([source, ...entries.map((entry) => entry.source), ...refs.map((ref) => ref.source).filter(Boolean)]),
    preferences: entries,
    refs,
  };
}

export function mergeAgentPreferenceProfiles(profiles = []) {
  const merged = new Map();
  const suggestions = [];
  const refs = [];
  const sourceTags = [];

  for (const profileInput of Array.isArray(profiles) ? profiles : []) {
    const profile = normalizeAgentPreferenceProfile(profileInput);
    refs.push(...profile.refs);
    sourceTags.push(...profile.sourceTags);
    for (const entry of profile.preferences) {
      const current = merged.get(entry.key);
      if (!current) {
        merged.set(entry.key, { ...entry, sources: [entry.source] });
      } else if (JSON.stringify(current.value) === JSON.stringify(entry.value)) {
        current.sources = unique([...current.sources, entry.source]);
      } else {
        suggestions.push({
          key: entry.key,
          current: current.value,
          suggested: entry.value,
          currentSources: current.sources,
          suggestedSource: entry.source,
          reason: 'preference_conflict_requires_human_review',
        });
      }
    }
  }

  return {
    type: 'agent_preference_profile_merge',
    version: AGENT_BRIDGE_CONTRACT_VERSION,
    preferences: [...merged.values()],
    suggestions,
    refs,
    sourceTags: unique(sourceTags),
    mergePolicy: 'additive_conflicts_as_suggestions',
  };
}

export function normalizeAgentBridgeEvent(event = {}) {
  const eventType = Object.values(AGENT_BRIDGE_EVENT_TYPES).includes(event.eventType)
    ? event.eventType
    : AGENT_BRIDGE_EVENT_TYPES.FAILED;
  return {
    type: 'agent_bridge_event',
    version: AGENT_BRIDGE_CONTRACT_VERSION,
    eventId: normalizeSafeId(event.eventId || `agent_event_${stableHash(JSON.stringify({
      eventType,
      scope: event.scopeKey || event.session,
      actionRecordId: event.actionRecordId,
      createdAt: event.createdAt,
    }))}`, ''),
    eventType,
    scope: normalizeAgentBridgeScope(event),
    actionRecordId: safeString(event.actionRecordId) || null,
    summary: redactAgentBridgeSecrets(event.summary || {}),
    refs: {
      actionRecordId: safeString(event.actionRecordId) || null,
      payloadRef: normalizePreferenceBundleRef(event.payloadRef || null),
      preferenceProfileRef: normalizePreferenceBundleRef(event.preferenceProfileRef || null),
    },
    createdAt: event.createdAt || null,
  };
}

export function summarizeAgentGrantForBridgeCache(grant = {}) {
  return {
    type: 'agent_grant_cache_summary',
    version: AGENT_BRIDGE_CONTRACT_VERSION,
    grantId: normalizeSafeId(grant.grantId, ''),
    humanPrincipal: lower(grant.humanPrincipal || grant.accountPrincipalId),
    agentId: safeString(grant.agentId || grant.subject),
    sessions: Array.isArray(grant.sessions) ? grant.sessions.map((entry) => safeString(entry)).filter(Boolean) : [],
    allowedActions: Array.isArray(grant.allowedActions) ? grant.allowedActions.map((entry) => lower(entry)).filter(Boolean) : [],
    riskCeiling: lower(grant.riskCeiling || 'low'),
    executionPolicy: lower(grant.executionPolicy || 'approval_required'),
    auditRequired: grant.auditRequired !== false,
    status: lower(grant.status || 'active'),
    expiresAt: grant.expiresAt || null,
    revokedAt: grant.revokedAt || null,
    signingAuthority: false,
    workerTokenAuthority: false,
    privateKeyAuthority: false,
    longLivedBearerAuthority: false,
  };
}

export function normalizeAgentCreatedAccountMetadata(account = {}) {
  return {
    type: 'agent_created_account_metadata',
    version: AGENT_BRIDGE_CONTRACT_VERSION,
    accountId: normalizeSafeId(account.accountId || account.address || account.accountAddress, ''),
    accountAddress: safeString(account.accountAddress || account.address) || null,
    accountKind: lower(account.accountKind || 'managed_testnet_account_runtime'),
    chainScope: safeString(account.chainScope || 'testnet') || 'testnet',
    createdByAgentPrincipal: normalizeAgentPrincipal(account.createdByAgentPrincipal || {
      kind: 'agent',
      principalId: account.agentId,
    }),
    integrationPrincipal: normalizeAgentPrincipal(account.integrationPrincipal || {
      kind: account.integrationKind || 'integration',
      principalId: account.integrationPrincipalId || account.integrationId,
    }),
    session: normalizeSession(account.session),
    signerBoundary: Object.values(AGENT_ACCOUNT_SIGNER_BOUNDARIES).includes(account.signerBoundary)
      ? account.signerBoundary
      : AGENT_ACCOUNT_SIGNER_BOUNDARIES.DURABLE_OBJECT_ISOLATED_SIGNER_PLANNED,
    signingAuthority: false,
    workerTokenAuthority: false,
    privateKeyAuthority: false,
    longLivedBearerAuthority: false,
    rawKeyMaterialExportable: false,
    createdAt: account.createdAt || null,
  };
}
