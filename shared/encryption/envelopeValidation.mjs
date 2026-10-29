// Envelope shape validation is shared by browser uploads, Worker uploads and
// readers. Keep it independent of ethers so the Worker retains its v6 boundary.
const isObj = (value) => !!value && typeof value === 'object' && !Array.isArray(value);

const decodeBase64 = (value) => {
  try { return atob(value); } catch { return ''; }
};

export const parseEnvelope = (jsonStr) => {
  if (typeof jsonStr !== 'string') {
    throw new Error('envelope must be a JSON string');
  }

  let env = null;
  try {
    env = JSON.parse(jsonStr);
  } catch (_) {
    throw new Error('envelope is not valid JSON');
  }

  if (!isObj(env)) throw new Error('envelope must be a JSON object');
  if (env.v !== 1) throw new Error('envelope version must be 1');
  if (env.cipher !== 'aes-gcm-256') throw new Error('envelope cipher must be aes-gcm-256');
  if (typeof env.iv !== 'string') throw new Error('envelope iv must be a string');
  const ivBytes = decodeBase64(env.iv);
  if (ivBytes.length !== 12) throw new Error(`envelope iv must decode to exactly 12 bytes (got ${ivBytes.length})`);
  if (!isObj(env.aad)) throw new Error('envelope aad must be an object');
  if (typeof env.ciphertext !== 'string') throw new Error('envelope ciphertext must be a string');
  const ciphertextBytes = decodeBase64(env.ciphertext);
  if (ciphertextBytes.length === 0) throw new Error('envelope ciphertext must decode to non-empty bytes');
  if (!Array.isArray(env.recipients)) {
    throw new Error('envelope recipients must be an array');
  }
  for (let i = 0; i < env.recipients.length; i++) {
    const recipient = env.recipients[i];
    if (!isObj(recipient) || typeof recipient.type !== 'string' || recipient.type.length === 0) {
      throw new Error('envelope recipient type must be a string');
    }
    if (recipient.type === 'self-eip712-v1') {
      const prefix = `envelope recipient[${i}] self-eip712-v1`;
      if (
        Object.prototype.hasOwnProperty.call(recipient, 'context') &&
        (typeof recipient.context !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(recipient.context))
      ) {
        throw new Error(`${prefix} context must be 32-byte hex`);
      }
      if (typeof recipient.wrap_iv !== 'string' || recipient.wrap_iv.length === 0) {
        throw new Error(`${prefix} is missing wrap_iv`);
      }
      const wrapIvBytes = decodeBase64(recipient.wrap_iv);
      if (wrapIvBytes.length !== 12) {
        throw new Error(`${prefix} wrap_iv must decode to exactly 12 bytes (got ${wrapIvBytes.length})`);
      }
      if (typeof recipient.wrapped_cek !== 'string' || recipient.wrapped_cek.length === 0) {
        throw new Error(`${prefix} is missing wrapped_cek`);
      }
      const wrappedCekBytes = decodeBase64(recipient.wrapped_cek);
      if (wrappedCekBytes.length === 0) {
        throw new Error(`${prefix} wrapped_cek must decode to non-empty bytes`);
      }
      // A null nonce, like a missing one, means the key wrap signed no nonce.
      if (
        recipient.nonce !== undefined &&
        recipient.nonce !== null &&
        (typeof recipient.nonce !== 'string' || recipient.nonce.length === 0)
      ) {
        throw new Error(`${prefix} nonce must be a non-empty string`);
      }
    }
  }
  if (!isObj(env.commitments)) throw new Error('envelope commitments must be an object');
  if (
    typeof env.commitments.keccak256 !== 'string' ||
    !/^0x[0-9a-fA-F]{64}$/.test(env.commitments.keccak256)
  ) {
    throw new Error('envelope commitments.keccak256 must be 32-byte hex');
  }
  if (
    typeof env.commitments.poseidon === 'string' &&
    env.commitments.poseidon.length > 0 &&
    !/^0x[0-9a-fA-F]{64}$/.test(env.commitments.poseidon)
  ) {
    throw new Error('envelope commitments.poseidon must be 32-byte hex');
  }

  return env;
};

export const isResponseFieldEnvelope = (value) => {
  try {
    const envelope = parseEnvelope(value);
    // Current response writers always wrap the field key for its author.
    return envelope.recipients.some(recipient => recipient.type === 'self-eip712-v1');
  } catch {
    return false;
  }
};
