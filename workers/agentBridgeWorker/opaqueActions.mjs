import { assertNoSecretShape } from './redaction.mjs';

const ACTION_ID_RE = /^ceab_[a-z0-9]{10,48}$/;
const CALLBACK_ID_RE = /^cecb_[a-z0-9]{10,48}$/;
const START_ID_RE = /^cetg_[a-z0-9]{10,48}$/;

function stableHash(seed = '') {
  let hash = 0x811c9dc5;
  const input = String(seed || 'agent-bridge-action');
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36).padStart(10, '0');
}

function bytesToHex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function buildId(prefix, pattern, seed) {
  assertNoSecretShape(String(seed || ''), 'Opaque action seeds must not contain secrets.');
  const id = `${prefix}${stableHash(seed)}`;
  if (!pattern.test(id)) {
    throw new Error('Invalid opaque action id.');
  }
  return id;
}

export function buildOpaqueActionId(seed = '') {
  return buildId('ceab_', ACTION_ID_RE, seed);
}

export function buildTelegramCallbackId(seed = '') {
  return buildId('cecb_', CALLBACK_ID_RE, seed);
}

export function buildTelegramStartId(seed = '') {
  return buildId('cetg_', START_ID_RE, seed);
}

export function buildRandomTelegramCallbackId({
  byteLength = 16,
  cryptoImpl = globalThis.crypto,
} = {}) {
  const length = Math.max(16, Math.min(32, Math.floor(Number(byteLength) || 16)));
  if (!cryptoImpl || typeof cryptoImpl.getRandomValues !== 'function') {
    throw new Error('Secure random source unavailable.');
  }
  const bytes = new Uint8Array(length);
  cryptoImpl.getRandomValues(bytes);
  const id = `cecb_${bytesToHex(bytes)}`;
  if (!CALLBACK_ID_RE.test(id)) {
    throw new Error('Invalid opaque action id.');
  }
  return id;
}

export function buildRandomTelegramStartId({
  byteLength = 16,
  cryptoImpl = globalThis.crypto,
} = {}) {
  const length = Math.max(16, Math.min(29, Math.floor(Number(byteLength) || 16)));
  if (!cryptoImpl || typeof cryptoImpl.getRandomValues !== 'function') {
    throw new Error('Secure random source unavailable.');
  }
  const bytes = new Uint8Array(length);
  cryptoImpl.getRandomValues(bytes);
  const id = `cetg_${bytesToHex(bytes)}`;
  if (!START_ID_RE.test(id)) {
    throw new Error('Invalid opaque action id.');
  }
  return id;
}

export function parseOpaqueActionId(value = '') {
  const actionId = String(value || '').trim();
  if (!ACTION_ID_RE.test(actionId) && !CALLBACK_ID_RE.test(actionId) && !START_ID_RE.test(actionId)) {
    return { ok: false, error: 'Invalid opaque action id.' };
  }
  return { ok: true, actionId };
}

export function createOpaqueActionRecord({
  seed = '',
  action = '',
  lane = '',
  serverContextRef = {},
  expiresAt = null,
  createdAt = null,
} = {}) {
  const actionId = buildOpaqueActionId(seed || `${action}|${lane}|${JSON.stringify(serverContextRef)}`);
  const record = {
    type: 'agent_bridge_opaque_action',
    actionId,
    action: String(action || '').trim(),
    lane: String(lane || '').trim(),
    serverContextRef: { ...serverContextRef },
    createdAt,
    expiresAt,
  };
  assertNoSecretShape(record, 'Opaque action records must not contain secrets.');
  return record;
}

export function createTelegramCallbackAction(input = {}) {
  const record = createOpaqueActionRecord(input);
  return {
    callbackData: buildTelegramCallbackId(record.actionId),
    record,
  };
}

export function createRandomTelegramCallbackAction({
  action = '',
  lane = '',
  serverContextRef = {},
  expiresAt = null,
  createdAt = null,
} = {}, options = {}) {
  const callbackData = buildRandomTelegramCallbackId(options);
  const record = {
    type: 'agent_bridge_opaque_action',
    actionId: callbackData,
    action: String(action || '').trim(),
    lane: String(lane || '').trim(),
    serverContextRef: { ...serverContextRef },
    createdAt,
    expiresAt,
  };
  assertNoSecretShape(record, 'Opaque action records must not contain secrets.');
  return { callbackData, record };
}

export function createTelegramStartAction(input = {}) {
  const record = createOpaqueActionRecord(input);
  return {
    deepLinkPayload: buildTelegramStartId(record.actionId),
    record,
  };
}

export function createRandomTelegramStartAction({
  action = '',
  lane = '',
  serverContextRef = {},
  expiresAt = null,
  createdAt = null,
} = {}, options = {}) {
  const deepLinkPayload = buildRandomTelegramStartId(options);
  const record = {
    type: 'agent_bridge_opaque_action',
    actionId: deepLinkPayload,
    action: String(action || '').trim(),
    lane: String(lane || '').trim(),
    serverContextRef: { ...serverContextRef },
    createdAt,
    expiresAt,
  };
  assertNoSecretShape(record, 'Opaque action records must not contain secrets.');
  return { deepLinkPayload, record };
}
