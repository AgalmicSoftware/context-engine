/**
 * Envelope v1 encryption facade for CE-CC.
 * Pure crypto primitives are shared with the client via envelopeV1Core.mjs.
 */

import {
  requireBigInt, getCrypto, BN254_P,
  hexToBytes, bytesToHex, concatBytes, b64encode, b64decode, utf8e, utf8d,
  safeLower, isObj, stableStringify, assertBytes32Hex, getContextBytes,
  sha256, importAesGcmKey, aesGcmEncrypt, aesGcmDecrypt, deriveKekFromSig,
  buildEip712KeyWrap, computeContext, buildAAD, hashIdentifier,
  encodeFreeform, encodeBinary, encodeRating, encodeMultichoiceBitset, encodeValueBytes,
  toField, bigIntToHex32, poseidonHashBytes,
  buildCommitDomainBytes, computeSaltedCommitments,
  buildEnvelope, wrapCekWithSelfRecipient,
} from './shared/encryption/envelopeV1Core.mjs';

export {
  requireBigInt, getCrypto, BN254_P,
  hexToBytes, bytesToHex, concatBytes, b64encode, b64decode, utf8e, utf8d,
  safeLower, isObj, stableStringify, assertBytes32Hex, getContextBytes,
  sha256, importAesGcmKey, aesGcmEncrypt, aesGcmDecrypt, deriveKekFromSig,
  buildEip712KeyWrap, computeContext, buildAAD, hashIdentifier,
  encodeFreeform, encodeBinary, encodeRating, encodeMultichoiceBitset, encodeValueBytes,
  toField, bigIntToHex32, poseidonHashBytes,
  buildCommitDomainBytes, computeSaltedCommitments,
  buildEnvelope, wrapCekWithSelfRecipient,
};

const maybeAddOneLitRecipient = async (cekRaw, litOpts = {}) => {
  if (!isObj(litOpts) || typeof litOpts.saveKey !== 'function') return null;
  if (!Array.isArray(litOpts.accessControlConditions) || !litOpts.accessControlConditions.length) {
    return null;
  }
  if (!litOpts.chain) return null;

  const result = await litOpts.saveKey(cekRaw, {
    accessControlConditions: litOpts.accessControlConditions,
    chain: litOpts.chain,
    ...(litOpts.chainId ? { chainId: litOpts.chainId } : {}),
    ...(litOpts.resourceId ? { resourceId: litOpts.resourceId } : {}),
    ...(litOpts.litNetwork ? { litNetwork: litOpts.litNetwork } : {}),
    ...(litOpts.connectTimeout ? { connectTimeout: litOpts.connectTimeout } : {}),
    ...(litOpts.resourceAbilityRequests ? { resourceAbilityRequests: litOpts.resourceAbilityRequests } : {}),
    ...(litOpts.rpcUrl ? { rpcUrl: litOpts.rpcUrl } : {}),
    ...(litOpts.providerLike ? { providerLike: litOpts.providerLike } : {}),
    ...(litOpts.chipotle ? { chipotle: litOpts.chipotle } : {}),
  });
  if (!result) return null;

  const litPayload = {
    accessControlConditions: litOpts.accessControlConditions,
    chain: litOpts.chain,
    ...(litOpts.resourceId ? { resourceId: litOpts.resourceId } : {}),
    ...(result?.chipotle ? { chipotle: result.chipotle } : {}),
  };

  if (typeof result.ciphertext === 'string' && typeof result.dataToEncryptHash === 'string') {
    return {
      type: 'lit-sbt-v1',
      lit: {
        ...litPayload,
        ciphertext: result.ciphertext,
        dataToEncryptHash: result.dataToEncryptHash,
      },
    };
  }

  const eskB64 =
    typeof result.encryptedSymmetricKey === 'string'
      ? result.encryptedSymmetricKey
      : b64encode(new Uint8Array(result.encryptedSymmetricKey || []));
  return {
    type: 'lit-sbt-v1',
    lit: {
      ...litPayload,
      encryptedSymmetricKey: eskB64,
    },
  };
};

const maybeAddLitRecipients = async (cekRaw, litOpts = {}) => {
  if (!isObj(litOpts)) return [];
  const configuredRecipients = Array.isArray(litOpts.recipients)
    ? litOpts.recipients.filter(Boolean)
    : [litOpts];
  const out = [];
  const dedupe = new Set();

  for (const entry of configuredRecipients) {
    const merged = {
      ...litOpts,
      ...(isObj(entry) ? entry : {}),
    };
    delete merged.recipients;
    // eslint-disable-next-line no-await-in-loop
    const recipient = await maybeAddOneLitRecipient(cekRaw, merged);
    if (!recipient || !recipient.lit) continue;
    const dedupeKey = JSON.stringify(recipient.lit);
    if (dedupe.has(dedupeKey)) continue;
    dedupe.add(dedupeKey);
    out.push(recipient);
  }

  return out;
};

export const encryptField = async ({
  signTypedData,
  account,
  chainId,
  surveyId,
  qId,
  kind,
  value,
  optionsForKind = [],
  hasher,
  litOpts,
}) => {
  const contextHex = computeContext({ chainId, account, surveyId, qId });
  assertBytes32Hex(contextHex, 'context');
  const aadObj = buildAAD({ contextHex, chainId, surveyId, qId });
  const aadBytes = utf8e(stableStringify(aadObj));

  const commitments = await computeSaltedCommitments({
    chainId,
    surveyId,
    qId,
    kind,
    value,
    optionsForKind,
    hasher,
  });

  const plaintextObj = {
    v: 1,
    value,
    kind,
    salt: commitments.salt,
  };
  const plaintextBytes = utf8e(JSON.stringify(plaintextObj));

  const cekRaw = new Uint8Array(32);
  getCrypto().getRandomValues(cekRaw);
  const cek = await importAesGcmKey(cekRaw);
  const { iv, ciphertext } = await aesGcmEncrypt(cek, plaintextBytes, { aadBytes });

  const selfRecipient = await wrapCekWithSelfRecipient({
    signTypedData,
    account,
    chainId,
    contextHex,
    cekRaw,
  });
  const litRecipients = await maybeAddLitRecipients(cekRaw, litOpts);

  const envelopeJson = buildEnvelope({
    iv,
    ciphertextBytes: ciphertext,
    aadObj,
    recipients: [selfRecipient, ...litRecipients],
    commitments,
    kind,
  });

  return {
    envelopeJson,
    commitments: {
      keccak256: commitments.keccak256,
      ...(commitments.poseidon ? { poseidon: commitments.poseidon } : {}),
    },
    salt: commitments.salt,
  };
};
