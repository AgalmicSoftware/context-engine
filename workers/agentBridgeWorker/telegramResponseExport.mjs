import { AGENT_BRIDGE_EVENT_TYPES } from './constants.mjs';
import { deriveManagedDemoAccount } from './managedAccounts.mjs';
import {
  authenticateSessionWorker,
  resolveSessionWorkerUrl,
} from './onChainResponses.mjs';
import { normalizeTelegramPrincipal } from './telegramUpdates.mjs';
import {
  canonicalAnswerSessionKvPrefix,
  SUBMIT_REQUEST_KV_PREFIX,
  submitRequestSessionKvPrefix,
} from './telegramSubmitQueue.mjs';
import { buildZipArchive } from './zipArchive.mjs';

const RESPONSE_EXPORT_ALLOWLIST_KV_PREFIX = 'telegram:response-export-allowlist:v1:';

function safeString(value) {
  return String(value || '').trim();
}

function lower(value) {
  return safeString(value).toLowerCase();
}

function safeJsonParse(value, fallback = null) {
  const text = safeString(value);
  if (!text) return fallback;
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

function normalizeAddress(value = '') {
  const address = lower(value);
  return /^0x[0-9a-f]{40}$/.test(address) ? address : '';
}

function hasOwn(value = {}, key = '') {
  return Object.prototype.hasOwnProperty.call(value || {}, key);
}

function safeJsonScalar(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : safeString(value);
  if (typeof value === 'boolean') return value;
  return safeString(value);
}

function normalizeSessionSlug(value = '') {
  return lower(value).replace(/[^a-z0-9_-]/g, '').slice(0, 128) || 'general';
}

function normalizeExportScope(value = '') {
  const scope = lower(value);
  return [
    'admin_raw',
    'all_session',
    'selected_surfaces',
    'encrypted_envelopes_only',
  ].includes(scope) ? scope : '';
}

export function resolveResponseExportScope(session = {}) {
  return normalizeExportScope(
    session.exportScope ||
    session.export?.scope ||
    session.sessionModeProfile?.export?.scope ||
    session.telegram?.responseExportScope ||
    session.telegramResponseExportScope ||
    session.responseExportScope
  ) || 'all_session';
}

function parseAddressList(value = '') {
  if (Array.isArray(value)) return value.map(normalizeAddress).filter(Boolean);
  const raw = safeString(value);
  if (!raw) return [];
  const parsed = safeJsonParse(raw, null);
  if (Array.isArray(parsed)) return parsed.map(normalizeAddress).filter(Boolean);
  return raw.split(/[\s,;]+/).map(normalizeAddress).filter(Boolean);
}

export function configuredResponseExportAdminAddresses(env = {}, session = {}) {
  return [...new Set([
    ...parseAddressList(env.AGENT_BRIDGE_RESPONSE_EXPORT_ALLOWED_ADDRESSES),
    ...parseAddressList(session.responseExportAllowedAddresses),
    ...parseAddressList(session.telegramResponseExportAllowedAddresses),
  ])];
}

function responseExportAllowlistKey(sessionSlug = '') {
  return `${RESPONSE_EXPORT_ALLOWLIST_KV_PREFIX}${normalizeSessionSlug(sessionSlug)}`;
}

async function readResponseExportManagedAllowlist(env = {}, sessionSlug = '') {
  const kv = env?.AGENT_ACTION_KV;
  const normalizedSessionSlug = normalizeSessionSlug(sessionSlug);
  const empty = { version: 1, sessionSlug: normalizedSessionSlug, addresses: [] };
  if (!kv || typeof kv.get !== 'function') return empty;
  const parsed = safeJsonParse(await kv.get(responseExportAllowlistKey(normalizedSessionSlug)).catch(() => null), null);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return empty;
  const source = Array.isArray(parsed.addresses)
    ? parsed.addresses.map((entry) => (typeof entry === 'string' ? { address: entry } : entry))
    : Object.entries(parsed.addresses || {}).map(([address, entry]) => ({
      ...(entry && typeof entry === 'object' ? entry : {}),
      address,
    }));
  const deduped = new Map();
  source.forEach((entry) => {
    const address = normalizeAddress(entry?.address);
    if (!address) return;
    deduped.set(address, {
      address,
      addedAt: safeString(entry?.addedAt),
      addedByAddress: normalizeAddress(entry?.addedByAddress),
      addedByTelegramUserId: safeString(entry?.addedByTelegramUserId),
    });
  });
  return {
    version: 1,
    sessionSlug: normalizedSessionSlug,
    addresses: [...deduped.values()].sort((left, right) => left.address.localeCompare(right.address)),
  };
}

async function writeResponseExportManagedAllowlist(env = {}, sessionSlug = '', record = {}) {
  const kv = env?.AGENT_ACTION_KV;
  if (!kv || typeof kv.put !== 'function') return { ok: false, reason: 'action_kv_unavailable' };
  const normalizedSessionSlug = normalizeSessionSlug(sessionSlug);
  const addresses = Array.isArray(record.addresses) ? record.addresses : [];
  await kv.put(responseExportAllowlistKey(normalizedSessionSlug), JSON.stringify({
    version: 1,
    sessionSlug: normalizedSessionSlug,
    addresses: addresses
      .map((entry) => ({
        address: normalizeAddress(entry?.address),
        addedAt: safeString(entry?.addedAt),
        addedByAddress: normalizeAddress(entry?.addedByAddress),
        addedByTelegramUserId: safeString(entry?.addedByTelegramUserId),
      }))
      .filter((entry) => entry.address)
      .sort((left, right) => left.address.localeCompare(right.address)),
  }));
  return { ok: true };
}

export async function listResponseExportAccess({ env = {}, session = {} } = {}) {
  const sessionSlug = normalizeSessionSlug(session.sessionSlug);
  const configuredAdmins = configuredResponseExportAdminAddresses(env, session);
  const managed = await readResponseExportManagedAllowlist(env, sessionSlug);
  const additionalExporters = managed.addresses;
  const allAllowedAddresses = configuredAdmins.length
    ? [...new Set([
      ...configuredAdmins,
      ...additionalExporters.map((entry) => entry.address),
    ])].sort((left, right) => left.localeCompare(right))
    : [];
  return {
    sessionSlug,
    configuredAdmins,
    additionalExporters,
    allAllowedAddresses,
  };
}

export async function deriveTelegramResponseExportAccount({
  env = {},
  normalized = {},
  createdAt = null,
} = {}) {
  return deriveManagedDemoAccount({
    principal: normalizeTelegramPrincipal(normalized),
    deploymentId: env.AGENT_BRIDGE_DEPLOYMENT_ID || 'agent-bridge-live-demo',
    rootSecret: env.DEMO_SIGNER_ROOT_SECRET || '',
    lifecycle: AGENT_BRIDGE_EVENT_TYPES.ACCOUNT_CREATED,
    createdAt,
  });
}

export async function canExportResponsesForTelegramUser({
  env = {},
  normalized = {},
  session = {},
  createdAt = null,
} = {}) {
  const account = await deriveTelegramResponseExportAccount({ env, normalized, createdAt });
  const access = await listResponseExportAccess({ env, session });
  const allowed = access.allAllowedAddresses;
  const accountAddress = normalizeAddress(account.accountAddress);
  return {
    ok: !!accountAddress && allowed.includes(accountAddress),
    account,
    accountAddress,
    allowedCount: allowed.length,
    reason: allowed.length ? 'response_export_address_not_allowed' : 'response_export_allowlist_empty',
    rootAdmin: access.configuredAdmins.includes(accountAddress),
  };
}

export async function canManageResponseExportAllowlist({
  env = {},
  normalized = {},
  session = {},
  createdAt = null,
} = {}) {
  const account = await deriveTelegramResponseExportAccount({ env, normalized, createdAt });
  const access = await listResponseExportAccess({ env, session });
  const admins = access.allAllowedAddresses;
  const configuredAdmins = access.configuredAdmins;
  const accountAddress = normalizeAddress(account.accountAddress);
  return {
    ok: !!accountAddress && admins.includes(accountAddress),
    account,
    accountAddress,
    adminCount: admins.length,
    rootAdmin: configuredAdmins.includes(accountAddress),
    reason: admins.length ? 'response_export_admin_required' : 'response_export_admin_allowlist_empty',
  };
}

export async function addResponseExportAllowedAddress({
  env = {},
  normalized = {},
  session = {},
  address = '',
  createdAt = null,
} = {}) {
  const manager = await canManageResponseExportAllowlist({ env, normalized, session, createdAt });
  if (!manager.ok) {
    return {
      ok: false,
      reason: manager.reason,
      accountAddress: manager.accountAddress,
    };
  }
  const normalizedAddress = normalizeAddress(address);
  if (!normalizedAddress) {
    return {
      ok: false,
      reason: 'response_export_invalid_address',
      accountAddress: manager.accountAddress,
    };
  }
  const sessionSlug = normalizeSessionSlug(session.sessionSlug);
  const record = await readResponseExportManagedAllowlist(env, sessionSlug);
  const existing = record.addresses.find((entry) => entry.address === normalizedAddress);
  if (!existing) {
    record.addresses.push({
      address: normalizedAddress,
      addedAt: safeString(createdAt) || new Date().toISOString(),
      addedByAddress: manager.accountAddress,
      addedByTelegramUserId: safeString(normalized?.user?.telegramUserId),
    });
    const written = await writeResponseExportManagedAllowlist(env, sessionSlug, record);
    if (!written.ok) return { ok: false, reason: written.reason, accountAddress: manager.accountAddress };
  }
  const access = await listResponseExportAccess({ env, session });
  return {
    ok: true,
    added: !existing,
    address: normalizedAddress,
    sessionSlug,
    accountAddress: manager.accountAddress,
    allowedCount: access.allAllowedAddresses.length,
  };
}

export async function removeResponseExportAllowedAddress({
  env = {},
  normalized = {},
  session = {},
  address = '',
  createdAt = null,
} = {}) {
  const manager = await canManageResponseExportAllowlist({ env, normalized, session, createdAt });
  if (!manager.ok) {
    return {
      ok: false,
      reason: manager.reason,
      accountAddress: manager.accountAddress,
    };
  }
  const normalizedAddress = normalizeAddress(address);
  if (!normalizedAddress) {
    return {
      ok: false,
      reason: 'response_export_invalid_address',
      accountAddress: manager.accountAddress,
    };
  }
  const configuredAdmins = configuredResponseExportAdminAddresses(env, session);
  if (configuredAdmins.includes(normalizedAddress)) {
    return {
      ok: false,
      reason: 'response_export_configured_admin_not_revocable',
      address: normalizedAddress,
      accountAddress: manager.accountAddress,
    };
  }
  const sessionSlug = normalizeSessionSlug(session.sessionSlug);
  const record = await readResponseExportManagedAllowlist(env, sessionSlug);
  const nextAddresses = record.addresses.filter((entry) => entry.address !== normalizedAddress);
  const removed = nextAddresses.length !== record.addresses.length;
  if (removed) {
    const written = await writeResponseExportManagedAllowlist(env, sessionSlug, {
      ...record,
      addresses: nextAddresses,
    });
    if (!written.ok) return { ok: false, reason: written.reason, accountAddress: manager.accountAddress };
  }
  const access = await listResponseExportAccess({ env, session });
  return {
    ok: true,
    removed,
    address: normalizedAddress,
    sessionSlug,
    accountAddress: manager.accountAddress,
    allowedCount: access.allAllowedAddresses.length,
  };
}

async function listKvRecordsByPrefix(env = {}, prefix = '', {
  limit = 1000,
} = {}) {
  const kv = env?.AGENT_ACTION_KV;
  if (!kv || typeof kv.list !== 'function' || typeof kv.get !== 'function') return [];
  const records = [];
  const maxRecords = Number.isFinite(Number(limit)) && Number(limit) > 0
    ? Math.floor(Number(limit))
    : Infinity;
  let cursor = undefined;
  do {
    const page = await kv.list({
      prefix,
      limit: Math.min(1000, Math.max(1, Number.isFinite(maxRecords) ? maxRecords : 1000)),
      ...(cursor ? { cursor } : {}),
    }).catch(() => null);
    const keys = Array.isArray(page?.keys) ? page.keys : [];
    for (const entry of keys) {
      const key = safeString(entry?.name || entry);
      if (!key) continue;
      const record = safeJsonParse(await kv.get(key).catch(() => null), null);
      if (record && typeof record === 'object' && !Array.isArray(record)) {
        records.push({ ...record, key });
      }
      if (records.length >= maxRecords) return records;
    }
    cursor = page?.list_complete === false ? safeString(page.cursor) : '';
  } while (cursor);
  return records;
}

function dedupeSubmitRecords(records = []) {
  const byId = new Map();
  (Array.isArray(records) ? records : []).forEach((record) => {
    const requestId = safeString(record.requestId || record.idempotencyKey || record.key);
    if (!requestId) return;
    const existing = byId.get(requestId);
    const existingPriority = safeString(existing?.type) === 'telegram_canonical_answer' ? 1 : 0;
    const nextPriority = safeString(record?.type) === 'telegram_canonical_answer' ? 1 : 0;
    const newerOrEqual = safeString(existing?.createdAt).localeCompare(safeString(record.createdAt)) <= 0;
    if (!existing || nextPriority > existingPriority || (nextPriority === existingPriority && newerOrEqual)) {
      byId.set(requestId, record);
    }
  });
  return Array.from(byId.values());
}

function normalizeTelegramAnswer(answer = {}) {
  const source = answer && typeof answer === 'object' && !Array.isArray(answer) ? answer : {};
  const out = {};
  [
    'questionType',
    'controlType',
    'label',
    'selectionMode',
  ].forEach((key) => {
    const value = safeString(source[key]);
    if (value) out[key] = value;
  });
  if (hasOwn(source, 'value')) out.value = safeJsonScalar(source.value);
  if (Array.isArray(source.values)) {
    out.values = source.values.map(safeJsonScalar).filter((value) => safeString(value));
  }
  if (hasOwn(source, 'text')) out.text = safeString(source.text);
  const comments = safeString(source.comments || source.additionalComments);
  if (comments) out.comments = comments;
  return out;
}

function normalizeTelegramSubmitRecord(record = {}) {
  return {
    key: safeString(record.key),
    sourceRecordType: safeString(record.type) || 'telegram_submit_record',
    sourceKey: safeString(record.sourceKey),
    requestId: safeString(record.requestId),
    idempotencyKey: safeString(record.idempotencyKey),
    action: safeString(record.action),
    status: safeString(record.status),
    lane: safeString(record.lane),
    telegramUserId: safeString(record.telegramUserId),
    chatId: safeString(record.chatId),
    sessionSlug: safeString(record.sessionSlug),
    questionId: safeString(record.questionId),
    questionIdShort: safeString(record.questionIdShort),
    answer: normalizeTelegramAnswer(record.answer),
    onChain: record.onChain ? {
      ok: record.onChain.ok === true,
      status: safeString(record.onChain.status),
      accountAddress: safeString(record.onChain.accountAddress),
      txHash: safeString(record.onChain.txHash),
      blockNumber: record.onChain.blockNumber ?? null,
      storageRef: record.onChain.storageRef || null,
      storageId: safeString(record.onChain.storageId),
      responseHash: safeString(record.onChain.responseHash),
      chainId: record.onChain.chainId ?? null,
    } : null,
    createdAt: safeString(record.createdAt),
  };
}

async function listTelegramSubmitRecordsForSession(env = {}, sessionSlug = '') {
  const slug = lower(sessionSlug);
  const canonicalPrefix = canonicalAnswerSessionKvPrefix(slug);
  const canonicalRecords = canonicalPrefix
    ? await listKvRecordsByPrefix(env, canonicalPrefix, { limit: Infinity })
    : [];
  const indexedPrefix = submitRequestSessionKvPrefix(slug);
  const indexedRecords = indexedPrefix
    ? await listKvRecordsByPrefix(env, indexedPrefix, { limit: Infinity })
    : [];
  const legacyRecords = await listKvRecordsByPrefix(env, SUBMIT_REQUEST_KV_PREFIX, { limit: Infinity });
  const records = dedupeSubmitRecords([...canonicalRecords, ...indexedRecords, ...legacyRecords]);
  return records
    .filter((record) => lower(record.sessionSlug) === slug)
    .map(normalizeTelegramSubmitRecord)
    .sort((left, right) => safeString(left.createdAt).localeCompare(safeString(right.createdAt)));
}

export async function findLatestResponseExportSessionSlugForTelegramUser({
  env = {},
  normalized = {},
  createdAt = null,
} = {}) {
  const account = await deriveTelegramResponseExportAccount({ env, normalized, createdAt });
  const accountAddress = normalizeAddress(account.accountAddress);
  if (!accountAddress) return '';
  const records = await listKvRecordsByPrefix(env, SUBMIT_REQUEST_KV_PREFIX, { limit: Infinity });
  const matched = records
    .map(normalizeTelegramSubmitRecord)
    .filter((record) => (
      normalizeAddress(record.onChain?.accountAddress) === accountAddress &&
      !!safeString(record.sessionSlug)
    ))
    .sort((left, right) => safeString(right.createdAt).localeCompare(safeString(left.createdAt)));
  return safeString(matched[0]?.sessionSlug);
}

function jsonText(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function storageIdFromItem(item = {}) {
  return safeString(item.storageRef?.id || item.id || item.storageId);
}

function responsePayloadsFromSubmitRecords(env = {}, submitRecords = []) {
  return Promise.all((Array.isArray(submitRecords) ? submitRecords : []).map(async (record, index) => {
    const storageRef = record.onChain?.storageRef || (
      record.onChain?.storageId
        ? { backend: 'cloudflare', id: record.onChain.storageId, resource: 'responses' }
        : { backend: 'telegram-submit-record', id: record.requestId || `submit-record-${index + 1}`, resource: 'responses' }
    );
    const participant = await participantReferenceFromSubmitRecord(env, record);
    return {
      storageRef,
      metadata: {
        source: record.sourceRecordType === 'telegram_canonical_answer'
          ? 'telegram-canonical-answer'
          : 'telegram-submit-record',
        status: record.status,
        action: record.action,
        createdAt: record.createdAt,
      },
      submitRecord: record,
      payload: {
        type: 'telegram_research_response',
        version: 1,
        source: 'telegram-answer-record',
        responseId: record.requestId || `response-${index + 1}`,
        participant,
        session: {
          sessionSlug: record.sessionSlug,
        },
        question: {
          questionId: record.questionId,
          questionIdShort: record.questionIdShort,
        },
        answer: record.answer,
        provenance: {
          status: record.status,
          action: record.action,
          lane: record.lane,
          sourceRecordType: record.sourceRecordType,
        },
        onChain: record.onChain ? {
          ok: record.onChain.ok === true,
          status: safeString(record.onChain.status),
          accountAddress: normalizeAddress(record.onChain.accountAddress),
          txHash: safeString(record.onChain.txHash),
          blockNumber: record.onChain.blockNumber ?? null,
          storageRef: record.onChain.storageRef || null,
          storageId: safeString(record.onChain.storageId),
          responseHash: safeString(record.onChain.responseHash),
          chainId: record.onChain.chainId ?? null,
        } : null,
        createdAt: record.createdAt,
      },
      contentType: 'application/json',
      synthesizedFromSubmitRecord: true,
    };
  }));
}

async function participantReferenceFromSubmitRecord(env = {}, record = {}) {
  const onChainAddress = normalizeAddress(record.onChain?.accountAddress);
  const telegramUserId = safeString(record.telegramUserId);
  let accountAddress = onChainAddress;
  if (!accountAddress && telegramUserId) {
    const account = await deriveManagedDemoAccount({
      principal: { telegramUserId },
      deploymentId: env.AGENT_BRIDGE_DEPLOYMENT_ID || 'agent-bridge-live-demo',
      rootSecret: env.DEMO_SIGNER_ROOT_SECRET || '',
      createdAt: record.createdAt || null,
    });
    accountAddress = normalizeAddress(account.accountAddress);
  }
  return {
    stableRef: accountAddress ? `evm:${accountAddress}` : '',
    accountAddress,
    accountType: accountAddress ? 'managed_telegram_evm' : '',
  };
}

function responseIndexEntry(entry = {}) {
  const submitRecord = entry.submitRecord || null;
  return {
    storageRef: entry.storageRef || null,
    metadata: entry.metadata || {},
    submitRecordRef: submitRecord ? {
      requestId: safeString(submitRecord.requestId),
      status: safeString(submitRecord.status),
      createdAt: safeString(submitRecord.createdAt),
      participant: submitRecord.onChain?.accountAddress
        ? { accountAddress: normalizeAddress(submitRecord.onChain.accountAddress) }
        : undefined,
    } : null,
    payload: entry.payload,
    contentType: safeString(entry.contentType),
    synthesizedFromSubmitRecord: entry.synthesizedFromSubmitRecord === true,
    encryptedEnvelopeOnly: entry.encryptedEnvelopeOnly === true,
  };
}

function encryptedEnvelopeSubmitRecordRef(record = {}) {
  return {
    key: safeString(record.key),
    sourceRecordType: safeString(record.sourceRecordType),
    requestId: safeString(record.requestId),
    idempotencyKey: safeString(record.idempotencyKey),
    action: safeString(record.action),
    status: safeString(record.status),
    lane: safeString(record.lane),
    sessionSlug: safeString(record.sessionSlug),
    questionId: safeString(record.questionId),
    questionIdShort: safeString(record.questionIdShort),
    onChain: record.onChain ? {
      ok: record.onChain.ok === true,
      status: safeString(record.onChain.status),
      accountAddress: normalizeAddress(record.onChain.accountAddress),
      txHash: safeString(record.onChain.txHash),
      blockNumber: record.onChain.blockNumber ?? null,
      storageRef: record.onChain.storageRef || null,
      storageId: safeString(record.onChain.storageId),
      responseHash: safeString(record.onChain.responseHash),
      chainId: record.onChain.chainId ?? null,
    } : null,
    createdAt: safeString(record.createdAt),
  };
}

function safeFilePart(value = '') {
  return safeString(value).replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 80) || 'item';
}

async function readStoragePayload({
  fetchImpl,
  workerUrl = '',
  token = '',
  id = '',
} = {}) {
  const response = await fetchImpl(`${workerUrl}/storage/read?id=${encodeURIComponent(id)}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  const contentType = safeString(response?.headers?.get?.('content-type') || 'application/octet-stream');
  const bytes = response?.arrayBuffer
    ? new Uint8Array(await response.arrayBuffer())
    : new Uint8Array();
  if (!response?.ok) {
    return {
      ok: false,
      id,
      status: response?.status || 0,
      contentType,
      error: new TextDecoder().decode(bytes).slice(0, 500),
    };
  }
  const text = /^application\/json\b/i.test(contentType)
    ? new TextDecoder().decode(bytes)
    : '';
  return {
    ok: true,
    id,
    contentType,
    bytes,
    json: text ? safeJsonParse(text, null) : null,
    text,
  };
}

async function readEncryptedEnvelopeExport({
  fetchImpl,
  workerUrl = '',
  token = '',
} = {}) {
  const response = await fetchImpl(`${workerUrl}/storage/export-envelopes?resource=responses`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await response?.json?.().catch(() => ({}));
  if (!response?.ok) {
    return {
      ok: false,
      status: response?.status || 0,
      error: safeString(body?.error || response?.status) || 'encrypted_envelope_export_failed',
    };
  }
  return {
    ok: true,
    body: body && typeof body === 'object' ? body : {},
  };
}

function responsePayloadsFromEncryptedEnvelopeExport(envelopeExport = {}, submitRecords = []) {
  const submitRecordsByStorageId = new Map();
  submitRecords.forEach((record) => {
    const id = safeString(record.onChain?.storageRef?.id || record.onChain?.storageId);
    if (id) submitRecordsByStorageId.set(id, record);
  });
  const payloads = Array.isArray(envelopeExport?.payloads) ? envelopeExport.payloads : [];
  return payloads.map((entry, index) => {
    const storageRef = entry.storageRef || {
      backend: 'cloudflare',
      id: safeString(entry.metadata?.id) || `encrypted-envelope-${index + 1}`,
      resource: 'responses',
    };
    const id = storageIdFromItem({ ...entry, storageRef });
    return {
      storageRef,
      metadata: entry.metadata || {},
      submitRecord: submitRecordsByStorageId.get(id) || null,
      payload: {
        type: 'telegram_encrypted_response_envelope',
        version: 1,
        exportScope: 'encrypted_envelopes_only',
        storageRef,
        metadata: entry.metadata || {},
        envelope: entry.envelope || null,
        ciphertextBase64url: safeString(entry.ciphertextBase64url),
        keyProvider: safeString(entry.keyProvider),
        wrappedKeysIncluded: entry.wrappedKeysIncluded === true,
      },
      contentType: 'application/json',
      encryptedEnvelopeOnly: true,
    };
  });
}

export async function buildTelegramResponseExportArchive({
  env = {},
  normalized = {},
  session = {},
  createdAt = new Date().toISOString(),
  fetchImpl = env.AGENT_BRIDGE_FETCH || globalThis.fetch,
} = {}) {
  const authorization = await canExportResponsesForTelegramUser({
    env,
    normalized,
    session,
    createdAt,
  });
  if (!authorization.ok) {
    return {
      ok: false,
      reason: authorization.reason,
      accountAddress: authorization.accountAddress,
      allowedCount: authorization.allowedCount,
    };
  }

  const exportScope = resolveResponseExportScope(session);
  const submitRecords = await listTelegramSubmitRecordsForSession(env, session.sessionSlug);
  const buildArchive = async ({
    storageItems = [],
    responsePayloads = [],
    readErrors = [],
    storageListError = null,
    partial = false,
    encryptedEnvelopeExport = null,
  } = {}) => {
    const synthesizedPayloads = responsePayloads.length || encryptedEnvelopeExport
      ? []
      : await responsePayloadsFromSubmitRecords(env, submitRecords);
    const exportedPayloads = responsePayloads.length || encryptedEnvelopeExport ? responsePayloads : synthesizedPayloads;
    const submitRecordsForArchive = encryptedEnvelopeExport
      ? submitRecords.map(encryptedEnvelopeSubmitRecordRef)
      : submitRecords;
    const manifest = {
      type: 'telegram_response_export',
      version: 1,
      exportedAt: safeString(createdAt),
      sessionSlug: safeString(session.sessionSlug),
      sessionName: safeString(session.sessionName),
      exporterAccountAddress: authorization.accountAddress,
      storageItemCount: storageItems.length,
      exportedPayloadCount: exportedPayloads.length,
      exportScope,
      encryptedPayloadCount: encryptedEnvelopeExport?.manifest?.encryptedPayloadCount ?? exportedPayloads.filter((entry) => entry.encryptedEnvelopeOnly).length,
      wrappedKeysIncluded: encryptedEnvelopeExport?.manifest?.wrappedKeysIncluded === true,
      keyProvider: safeString(encryptedEnvelopeExport?.manifest?.keyProvider),
      rewrapRequiredForNewDeployment: encryptedEnvelopeExport?.manifest?.rewrapRequiredForNewDeployment === true,
      submitRecordCount: submitRecords.length,
      submitRecordsRedacted: !!encryptedEnvelopeExport,
      partial: partial === true,
      synthesizedFromSubmitRecords: synthesizedPayloads.length > 0,
      storageListError,
      readErrors,
    };
    const files = [
      { path: 'manifest.json', content: jsonText(manifest) },
      { path: 'storage-items.json', content: jsonText(storageItems) },
      { path: 'telegram-submit-records.json', content: jsonText(submitRecordsForArchive) },
      {
        path: 'responses.json',
        content: jsonText(exportedPayloads.map(responseIndexEntry)),
      },
    ];
    if (storageListError) {
      files.push({ path: 'storage-list-error.json', content: jsonText(storageListError) });
    }
    if (encryptedEnvelopeExport) {
      files.push({ path: 'encrypted-envelopes.json', content: jsonText(encryptedEnvelopeExport) });
    }
    exportedPayloads.forEach((entry, index) => {
      const id = storageIdFromItem(entry);
      const fileBase = `${String(index + 1).padStart(3, '0')}-${safeFilePart(id || entry.storageRef?.id)}`;
      const isJson = entry.payload && typeof entry.payload === 'object';
      files.push({
        path: `responses/${fileBase}${isJson ? '.json' : '.txt'}`,
        content: isJson ? jsonText(entry.payload) : (entry.payload || new TextDecoder().decode(entry.rawBytes)),
      });
    });

    const bytes = buildZipArchive(files);
    return {
      ok: true,
      partial: partial === true,
      storageUnavailableReason: safeString(storageListError?.reason),
      accountAddress: authorization.accountAddress,
      sessionSlug: safeString(session.sessionSlug),
      exportedPayloadCount: exportedPayloads.length,
      submitRecordCount: submitRecords.length,
      synthesizedFromSubmitRecords: synthesizedPayloads.length > 0,
      readErrorCount: readErrors.length,
      document: {
        bytes,
        filename: `context-engine-${safeFilePart(session.sessionSlug)}-responses.zip`,
        contentType: 'application/zip',
      },
    };
  };
  const fallbackArchive = (reason = 'storage_list_failed', extra = {}) => {
    const normalizedReason = safeString(reason) || 'storage_list_failed';
    if (exportScope === 'encrypted_envelopes_only') {
      return {
        ok: false,
        reason: normalizedReason,
        exportScope,
        accountAddress: authorization.accountAddress,
        ...extra,
      };
    }
    if (!submitRecords.length) {
      return {
        ok: false,
        reason: normalizedReason,
        accountAddress: authorization.accountAddress,
      };
    }
    return buildArchive({
      partial: true,
      storageListError: {
        reason: normalizedReason,
        ...extra,
      },
    });
  };

  const workerUrl = resolveSessionWorkerUrl(env, session);
  if (!workerUrl) {
    return fallbackArchive('session_worker_url_missing');
  }
  const principal = normalizeTelegramPrincipal(normalized);
  let auth;
  try {
    auth = await authenticateSessionWorker({
      env,
      session,
      account: authorization.account,
      principal,
      workerUrl,
      fetchImpl,
      now: createdAt ? new Date(createdAt) : new Date(),
    });
  } catch (error) {
    return fallbackArchive(safeString(error?.message || error) || 'worker_auth_failed');
  }
  if (!auth.ok || !auth.token) {
    return fallbackArchive(auth.reason || 'worker_auth_failed');
  }

  if (exportScope === 'encrypted_envelopes_only') {
    const envelopeExport = await readEncryptedEnvelopeExport({
      fetchImpl,
      workerUrl: auth.workerUrl,
      token: auth.token,
    });
    if (!envelopeExport.ok) {
      return fallbackArchive(envelopeExport.error || 'encrypted_envelope_export_failed', {
        status: envelopeExport.status || 0,
      });
    }
    const exportBody = envelopeExport.body || {};
    const manifest = exportBody.manifest || {};
    return buildArchive({
      storageItems: Array.isArray(exportBody.payloads) ? exportBody.payloads : [],
      responsePayloads: responsePayloadsFromEncryptedEnvelopeExport(exportBody, submitRecords),
      readErrors: Array.isArray(manifest.readErrors) ? manifest.readErrors : [],
      storageListError: manifest.storageListError || null,
      partial: manifest.partial === true,
      encryptedEnvelopeExport: exportBody,
    });
  }

  const listResponse = await fetchImpl(`${auth.workerUrl}/storage/list?resource=responses`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${auth.token}` },
  });
  const listBody = await listResponse.json().catch(() => ({}));
  if (!listResponse?.ok) {
    return fallbackArchive(safeString(listBody?.error || listResponse?.status) || 'storage_list_failed', {
      status: listResponse?.status || 0,
    });
  }

  const storageItems = Array.isArray(listBody.items) ? listBody.items : [];
  const submitRecordsByStorageId = new Map();
  submitRecords.forEach((record) => {
    const id = safeString(record.onChain?.storageRef?.id || record.onChain?.storageId);
    if (id) submitRecordsByStorageId.set(id, record);
  });

  const responsePayloads = [];
  const readErrors = [];
  for (const item of storageItems) {
    const id = storageIdFromItem(item);
    if (!id) continue;
    // eslint-disable-next-line no-await-in-loop
    const read = await readStoragePayload({
      fetchImpl,
      workerUrl: auth.workerUrl,
      token: auth.token,
      id,
    });
    if (!read.ok) {
      readErrors.push(read);
      continue;
    }
    responsePayloads.push({
      storageRef: item.storageRef || { backend: 'cloudflare', id, resource: 'responses' },
      metadata: item.metadata || {},
      submitRecord: submitRecordsByStorageId.get(id) || null,
      payload: read.json ?? read.text,
      rawBytes: read.bytes,
      contentType: read.contentType,
    });
  }

  return buildArchive({ storageItems, responsePayloads, readErrors });
}
