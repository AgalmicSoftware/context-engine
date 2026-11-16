import { ethers } from 'ethers';

import { sha256Hex, stableJson } from './runtimePrimitives.mjs';

import { assertNoSecretShape } from './redaction.mjs';

const ACTION_ID_RE = /^ceab_[a-z0-9]{10,50}$/;

function stableHash(seed = '') {
  const digest = ethers.sha256(ethers.toUtf8Bytes(String(seed || 'agent-action')));
  // Base36 preserves all 256 bits in a compact, fixed-width identifier.
  return BigInt(digest).toString(36).padStart(50, '0');
}

function buildSubmitIdempotencyKey({ transport, principal, sessionSlug, questionId, answer }) {
  const fingerprint = stableHash(stableJson({ questionId, answer }));
  return `${transport}:${principal}:${sessionSlug}:${fingerprint}`;
}

function buildId(prefix, pattern, seed) {
  assertNoSecretShape(String(seed || ''), 'Opaque action seeds must not contain secrets.');
  const id = `${prefix}${stableHash(seed)}`;
  if (!pattern.test(id)) {
    throw new Error('Invalid opaque action id.');
  }
  return id;
}

function buildOpaqueActionId(seed = '') {
  return buildId('ceab_', ACTION_ID_RE, seed);
}

/** The request identity of one revision of a person's answer to a question. */
async function answerRevisionIdentity({ transport, principalId, sessionId, questionId, revision }) {
  const idempotencyKey = buildOpaqueActionId(await sha256Hex(stableJson([transport, principalId, sessionId, questionId, revision])));
  return { idempotencyKey, requestId: buildOpaqueActionId(idempotencyKey) };
}

export { answerRevisionIdentity, buildSubmitIdempotencyKey, buildOpaqueActionId };
