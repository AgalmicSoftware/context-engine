import { ethers } from 'ethers';
import { stableChipotleStringify } from './litChipotlePolicyCore.mjs';
import { LIT_AUTHORIZATION_VERSION, buildWorkerAuthorizedLitAction } from '../../shared/litChipotleAction.mjs';

const utils = ethers.utils || ethers;
const bytes = utils.arrayify || utils.getBytes;
export const LIT_AUTHORIZATION_REPROVISION_ERROR = 'Worker authorization is not configured. Ask the session admin to reprovision Lit with a fresh session authority.';

export const resolveLitAuthorization = ({ secrets = {}, config = {}, sessionSlug = '' } = {}) => {
  const credentials = config.litCredentials || {};
  if (credentials.litAuthorizationVersion !== LIT_AUTHORIZATION_VERSION || !secrets.litAuthorizationPrivateKey) {
    throw new Error(LIT_AUTHORIZATION_REPROVISION_ERROR);
  }
  let wallet;
  try { wallet = new ethers.Wallet(secrets.litAuthorizationPrivateKey); }
  catch { throw new Error(LIT_AUTHORIZATION_REPROVISION_ERROR); }
  if (wallet.address.toLowerCase() !== String(credentials.litAuthorizationSigner || '').toLowerCase()) {
    throw new Error(LIT_AUTHORIZATION_REPROVISION_ERROR);
  }
  return { wallet, actionCode: buildWorkerAuthorizedLitAction({
    signer: wallet.address, sessionSlug, pkpId: credentials.litPkpId,
  }) };
};

export const prepareLitAuthorization = async ({ secrets = {}, persistAuthorizationSecret } = {}) => {
  let wallet;
  try {
    wallet = secrets.litAuthorizationPrivateKey
      ? new ethers.Wallet(secrets.litAuthorizationPrivateKey) : ethers.Wallet.createRandom();
  } catch { throw new Error(LIT_AUTHORIZATION_REPROVISION_ERROR); }
  // The coordinator returns one durable winner to concurrent initial bootstraps.
  // Use that key for source specialization; a losing proposed key must never be published.
  if (persistAuthorizationSecret) {
    const persistedKey = await persistAuthorizationSecret(wallet.privateKey);
    if (persistedKey) {
      try { wallet = new ethers.Wallet(persistedKey); }
      catch { throw new Error(LIT_AUTHORIZATION_REPROVISION_ERROR); }
    }
  }
  return {
    litAuthorizationPrivateKey: wallet.privateKey,
    litAuthorizationSigner: wallet.address,
    litAuthorizationVersion: LIT_AUTHORIZATION_VERSION,
  };
};

export const litAuthorizationMessage = (params) => {
  const auth = params.authorization;
  return 'Context Engine Lit authorization v1\n' + stableChipotleStringify({
    version: LIT_AUTHORIZATION_VERSION,
    sessionSlug: auth.sessionSlug,
    op: params.op,
    requesterAddress: String(params.requesterAddress).toLowerCase(),
    chainId: params.expectedChainId,
    rpcUrl: params.rpcUrl || '',
    policyFingerprint: params.expectedPolicyFingerprint,
    pkpId: params.pkpId,
    actionCid: params.litActionCid,
    inputDigest: utils.keccak256(utils.toUtf8Bytes(params.op === 'encrypt' ? params.message || '' : params.op === 'decrypt' ? params.ciphertext || '' : '')),
    issuedAt: auth.issuedAt,
    expiresAt: auth.expiresAt,
    requestId: auth.requestId,
    replyPublicKey: auth.replyPublicKey,
  });
};

export const authorizeLitRequest = async ({ wallet, jsParams, sessionSlug, now = Math.floor(Date.now() / 1000) }) => {
  const replyKeys = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
  jsParams.authorization = {
    sessionSlug, issuedAt: now, expiresAt: now + 60,
    requestId: utils.hexlify(crypto.getRandomValues(new Uint8Array(32))),
    replyPublicKey: utils.hexlify(new Uint8Array(await crypto.subtle.exportKey('raw', replyKeys.publicKey))),
  };
  const message = litAuthorizationMessage(jsParams);
  jsParams.authorization.signature = await wallet.signMessage(message);
  return { privateKey: replyKeys.privateKey, message };
};

export const openLitReply = async (reply, context) => {
  if (reply?.version !== LIT_AUTHORIZATION_VERSION || !/^0x04[0-9a-f]{128}$/.test(reply.publicKey || '') ||
    !/^0x[0-9a-f]{24}$/.test(reply.iv || '') || !/^0x[0-9a-f]+$/.test(reply.ciphertext || '')) {
    throw new Error('Invalid encrypted Lit authorization reply.');
  }
  const publicKey = await crypto.subtle.importKey('raw', bytes(reply.publicKey), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const sharedSecret = await crypto.subtle.deriveBits({ name: 'ECDH', public: publicKey }, context.privateKey, 256);
  const material = await crypto.subtle.importKey('raw', sharedSecret, 'HKDF', false, ['deriveKey']);
  const aad = utils.toUtf8Bytes(context.message);
  const key = await crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256',
    salt: bytes(utils.keccak256(aad)), info: utils.toUtf8Bytes('Context Engine Lit reply v1') }, material,
  { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes(reply.iv), additionalData: aad }, key, bytes(reply.ciphertext)));
};

export const isLitAuthorizationReady = ({ secrets = {}, config = {} } = {}) => {
  try { resolveLitAuthorization({ secrets, config }); return true; }
  catch { return false; }
};
