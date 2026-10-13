export const DEFAULT_CHIPOTLE_ACTION_NAME = 'ce-sbt-gated-crypto-v4';
export const DEFAULT_CHIPOTLE_ACTION_DESCRIPTION = 'Context Engine SBT-gated Lit action';
const ACTION_BODY = `const ERC721_BALANCE_OF_ABI = [
  "function balanceOf(address owner) view returns (uint256)"
];

const CHIPOTLE_WRAPPED_KEY_VERSION = 2;
const CHIPOTLE_POLICY_VERSION = "chipotle-sbt-v2";

function toStr(value) {
  if (typeof value === "string") return value;
  if (value == null) return "";
  return String(value);
}

function toChainId(value) {
  const parsed = Number(value || 0);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

function normalizeMode(value) {
  return String(value || "any").trim().toLowerCase() === "all" ? "all" : "any";
}

function normalizePolicyAddresses(values) {
  const out = [];
  const seen = {};
  (Array.isArray(values) ? values : [values]).forEach((rawAddress) => {
    const value = toStr(rawAddress).trim();
    if (!value) return;
    const normalized = ethers.utils.getAddress(value).toLowerCase();
    if (seen[normalized]) return;
    seen[normalized] = true;
    out.push(normalized);
  });
  out.sort();
  return out;
}

function stableStringify(value) {
  if (value == null) return JSON.stringify(value);
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return "[" + value.map((entry) => stableStringify(entry)).join(",") + "]";
  }
  if (typeof value === "object") {
    const keys = Object.keys(value).sort();
    return "{" + keys.map((key) => JSON.stringify(key) + ":" + stableStringify(value[key])).join(",") + "}";
  }
  return JSON.stringify(toStr(value));
}

function buildPolicy({ chainId, gateMode, sbtAddresses, litActionCid, litPkpId }) {
  const normalizedChainId = toChainId(chainId);
  if (!normalizedChainId) throw new Error("Missing policy chainId");
  const normalizedAddresses = normalizePolicyAddresses(sbtAddresses);
  if (!normalizedAddresses.length) throw new Error("Missing policy sbtAddresses");
  const normalizedActionCid = toStr(litActionCid).trim();
  if (!normalizedActionCid) throw new Error("Missing policy litActionCid");
  const normalizedPkpId = toStr(litPkpId).trim();
  if (!normalizedPkpId) throw new Error("Missing policy litPkpId");
  return {
    version: CHIPOTLE_POLICY_VERSION,
    chainId: normalizedChainId,
    gateMode: normalizeMode(gateMode),
    sbtAddresses: normalizedAddresses,
    litActionCid: normalizedActionCid,
    litPkpId: normalizedPkpId,
  };
}

function fingerprintPolicy(policy) {
  return ethers.utils.keccak256(ethers.utils.toUtf8Bytes(stableStringify(buildPolicy(policy))));
}

function buildApprovedPolicy(params) {
  return buildPolicy({
    chainId: params.expectedChainId || params.gateChainId || params.chainId,
    gateMode: params.gateMode,
    sbtAddresses: params.sbtAddresses,
    litActionCid: params.litActionCid,
    litPkpId: params.litPkpId || params.pkpId,
  });
}

function requireExpectedFingerprint(expectedPolicyFingerprint, approvedFingerprint) {
  const expected = toStr(expectedPolicyFingerprint).trim().toLowerCase();
  if (!expected) throw new Error("Missing expected policy fingerprint");
  if (expected !== approvedFingerprint.toLowerCase()) {
    throw new Error("Expected policy fingerprint does not match approved policy.");
  }
}

function parseWrappedPlaintext(plaintext) {
  let parsed;
  try {
    parsed = JSON.parse(toStr(plaintext));
  } catch (_) {
    throw new Error("Lit Chipotle legacy wrapped keys are not supported.");
  }
  if (!parsed || typeof parsed !== "object" || parsed.v !== CHIPOTLE_WRAPPED_KEY_VERSION) {
    throw new Error("Lit Chipotle legacy wrapped keys are not supported.");
  }
  const cekHex = toStr(parsed.cekHex).trim();
  if (!/^0x[0-9a-f]{64}$/i.test(cekHex)) {
    throw new Error("Lit Chipotle wrapped key CEK is invalid.");
  }
  const policy = buildPolicy(parsed.policy || {});
  const policyFingerprint = fingerprintPolicy(policy);
  if (toStr(parsed.policyFingerprint).trim().toLowerCase() !== policyFingerprint.toLowerCase()) {
    throw new Error("Lit Chipotle wrapped key policy fingerprint mismatch.");
  }
  return { cekHex, policyFingerprint, policy };
}

function hasPositiveBalance(balance) {
  if (balance && typeof balance.isZero === "function") return !balance.isZero();
  const asString = balance && typeof balance.toString === "function" ? balance.toString() : String(balance || "0");
  return Number(asString) > 0;
}

async function checkSbtGate({ requesterAddress, sbtAddresses, gateMode, rpcUrl, expectedChainId }) {
  if (!requesterAddress) throw new Error("Missing requesterAddress");
  if (!Array.isArray(sbtAddresses) || sbtAddresses.length === 0) {
    throw new Error("Missing sbtAddresses");
  }
  if (!rpcUrl) throw new Error("Missing rpcUrl");
  const normalizedExpectedChainId = toChainId(expectedChainId);
  if (!normalizedExpectedChainId) throw new Error("Missing expectedChainId");

  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  const network = await provider.getNetwork();
  const networkChainId = toChainId(network && network.chainId);
  if (networkChainId !== normalizedExpectedChainId) {
    throw new Error("Lit Chipotle RPC chain ID mismatch.");
  }
  const requester = ethers.utils.getAddress(requesterAddress);
  const mode = normalizeMode(gateMode);

  const checks = await Promise.all(
    sbtAddresses.map(async (rawAddress) => {
      const sbtAddress = ethers.utils.getAddress(rawAddress);
      const contract = new ethers.Contract(sbtAddress, ERC721_BALANCE_OF_ABI, provider);
      const balance = await contract.balanceOf(requester);
      return {
        sbtAddress,
        balance: balance.toString(),
        hasToken: hasPositiveBalance(balance),
      };
    })
  );

  const allowed =
    mode === "all"
      ? checks.every((entry) => entry.hasToken)
      : checks.some((entry) => entry.hasToken);

  return { allowed, mode, checks };
}


const AUTHORIZATION_DOMAIN = "Context Engine Lit authorization v1\\n";

function authorizationMessage(params) {
  const auth = params.authorization || {};
  return AUTHORIZATION_DOMAIN + stableStringify({
    version: "worker-signed-v1",
    sessionSlug: auth.sessionSlug,
    op: params.op,
    requesterAddress: toStr(params.requesterAddress).toLowerCase(),
    chainId: params.expectedChainId,
    rpcUrl: params.rpcUrl || "",
    policyFingerprint: params.expectedPolicyFingerprint,
    pkpId: params.pkpId,
    actionCid: params.litActionCid,
    inputDigest: ethers.utils.keccak256(ethers.utils.toUtf8Bytes(params.op === "encrypt" ? params.message || "" : params.op === "decrypt" ? params.ciphertext || "" : "")),
    issuedAt: auth.issuedAt,
    expiresAt: auth.expiresAt,
    requestId: auth.requestId,
    replyPublicKey: auth.replyPublicKey,
  });
}

function verifyAuthorization(params) {
  const auth = params.authorization;
  if (!auth || !WORKER_AUTHORIZATION.signer || !WORKER_AUTHORIZATION.pkpId) {
    throw new Error("Worker authorization required. Reprovision this session's Lit authority.");
  }
  const now = Math.floor(Date.now() / 1000);
  if (auth.sessionSlug !== WORKER_AUTHORIZATION.sessionSlug || params.pkpId !== WORKER_AUTHORIZATION.pkpId ||
      !Number.isSafeInteger(auth.issuedAt) || !Number.isSafeInteger(auth.expiresAt) ||
      auth.issuedAt > now + 5 || auth.expiresAt <= now ||
      auth.expiresAt <= auth.issuedAt || auth.expiresAt - auth.issuedAt > 60 ||
      !/^0x[0-9a-f]{64}$/.test(auth.requestId || "") ||
      !/^0x04[0-9a-f]{128}$/.test(auth.replyPublicKey || "")) {
    throw new Error("Invalid or expired Worker authorization.");
  }
  const message = authorizationMessage(params);
  let signer;
  try { signer = ethers.utils.verifyMessage(message, auth.signature); }
  catch (_) { throw new Error("Invalid Worker authorization signature."); }
  if (signer.toLowerCase() !== WORKER_AUTHORIZATION.signer.toLowerCase()) {
    throw new Error("Invalid Worker authorization signature.");
  }
  return message;
}

async function sealReply(plaintext, params, authorizationText) {
  const peerKey = await crypto.subtle.importKey("raw", ethers.utils.arrayify(params.authorization.replyPublicKey),
    { name: "ECDH", namedCurve: "P-256" }, false, []);
  const keyPair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const sharedSecret = await crypto.subtle.deriveBits({ name: "ECDH", public: peerKey }, keyPair.privateKey, 256);
  const material = await crypto.subtle.importKey("raw", sharedSecret, "HKDF", false, ["deriveKey"]);
  const aad = ethers.utils.toUtf8Bytes(authorizationText);
  const key = await crypto.subtle.deriveKey({ name: "HKDF", hash: "SHA-256",
    salt: ethers.utils.arrayify(ethers.utils.keccak256(aad)),
    info: ethers.utils.toUtf8Bytes("Context Engine Lit reply v1") }, material,
    { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: aad }, key,
    ethers.utils.toUtf8Bytes(plaintext));
  verifyAuthorization(params);
  return { version: "worker-signed-v1", publicKey: ethers.utils.hexlify(new Uint8Array(await crypto.subtle.exportKey("raw", keyPair.publicKey))),
    iv: ethers.utils.hexlify(iv), ciphertext: ethers.utils.hexlify(new Uint8Array(ciphertext)) };
}

async function main(params) {
  // Authenticate before any RPC read or Lit key operation; parameters alone are never identity proof.
  const authorizationText = verifyAuthorization(params || {});
  const {
    op,
    pkpId,
    requesterAddress,
    sbtAddresses,
    gateMode = "any",
    rpcUrl,
    expectedChainId,
    litActionCid,
    expectedPolicyFingerprint,
    policy,
    message,
    ciphertext,
  } = params || {};

  if (!pkpId) throw new Error("Missing pkpId");
  if (!op) throw new Error("Missing op");

  if (!["check", "encrypt", "decrypt"].includes(op)) throw new Error("Unsupported authorization op");

  const approvedPolicy = buildApprovedPolicy({
    ...policy,
    expectedChainId,
    gateChainId: expectedChainId,
    chainId: expectedChainId,
    gateMode,
    sbtAddresses,
    litActionCid,
    litPkpId: pkpId,
    pkpId,
  });
  const approvedFingerprint = fingerprintPolicy(approvedPolicy);
  requireExpectedFingerprint(expectedPolicyFingerprint, approvedFingerprint);

  let gate = null;
  if (op === "check" || op === "decrypt") {
    gate = await checkSbtGate({
      requesterAddress,
      sbtAddresses,
      gateMode,
      rpcUrl,
      expectedChainId: approvedPolicy.chainId,
    });

    if (!gate.allowed) {
      return {
        ok: false,
        allowed: false,
        reason: "Requester does not satisfy the SBT gate.",
        gate,
      };
    }
  }

  if (op === "check") {
    verifyAuthorization(params);
    return {
      ok: true,
      allowed: true,
      op,
      gate,
      policyFingerprint: approvedFingerprint,
      policy: approvedPolicy,
    };
  }

  if (op === "encrypt") {
    if (typeof message !== "string" || !message.length) {
      throw new Error("Missing message for encrypt");
    }
    const wrappedPayload = parseWrappedPlaintext(message);
    if (wrappedPayload.policyFingerprint.toLowerCase() !== approvedFingerprint.toLowerCase()) {
      throw new Error("Lit Chipotle policy mismatch.");
    }

    verifyAuthorization(params);
    const nextCiphertext = await Lit.Actions.Encrypt({
      pkpId,
      message,
    });

    verifyAuthorization(params);
    return {
      ok: true,
      allowed: true,
      op,
      ciphertext: nextCiphertext,
      policyFingerprint: approvedFingerprint,
      policy: approvedPolicy,
    };
  }

  if (op === "decrypt") {
    if (typeof ciphertext !== "string" || !ciphertext.length) {
      throw new Error("Missing ciphertext for decrypt");
    }

    verifyAuthorization(params);
    const plaintext = await Lit.Actions.Decrypt({
      pkpId,
      ciphertext,
    });
    const wrappedPayload = parseWrappedPlaintext(plaintext);
    if (wrappedPayload.policyFingerprint.toLowerCase() !== approvedFingerprint.toLowerCase()) {
      throw new Error("Lit Chipotle policy mismatch.");
    }

    verifyAuthorization(params);
    return {
      ok: true,
      allowed: true,
      op,
      gate,
      encryptedReply: await sealReply(wrappedPayload.cekHex, params, authorizationText),
      policyFingerprint: approvedFingerprint,
    };
  }

  throw new Error("Unsupported op: " + op);
}`;


export const LIT_AUTHORIZATION_VERSION = 'worker-signed-v1';
export const isWorkerAuthorizedLitConfig = (value = {}) => (
  value.litAuthorizationVersion === LIT_AUTHORIZATION_VERSION &&
  /^0x[0-9a-f]{40}$/i.test(value.litAuthorizationSigner || '')
);

// The signer and session are code constants included in the immutable Action CID.
// Never substitute caller-supplied jsParams for these trust anchors.
export const buildWorkerAuthorizedLitAction = ({ signer = '', sessionSlug = '', pkpId = '' } = {}) => (
  'const WORKER_AUTHORIZATION = Object.freeze(' + JSON.stringify({ signer, sessionSlug, pkpId }) + ');\n' + ACTION_BODY
);
export const DEFAULT_CHIPOTLE_ACTION_CODE = buildWorkerAuthorizedLitAction();

export const DEFAULT_CHIPOTLE_ACTION_PARAMS_EXAMPLE = Object.freeze({
  op: 'check',
  pkpId: '<pkp-id>',
  requesterAddress: '0x0000000000000000000000000000000000000000',
  sbtAddresses: ['0x0000000000000000000000000000000000000000'],
  gateMode: 'any',
  rpcUrl: 'https://sepolia.optimism.io',
  expectedChainId: 11155420,
  litActionCid: '<lit-action-cid>',
  expectedPolicyFingerprint: '<policy-fingerprint>',
});

export const DEFAULT_CHIPOTLE_ACTION = Object.freeze({
  key: 'ce-sbt-gated-crypto-v4',
  name: DEFAULT_CHIPOTLE_ACTION_NAME,
  description: DEFAULT_CHIPOTLE_ACTION_DESCRIPTION,
  code: DEFAULT_CHIPOTLE_ACTION_CODE,
  paramsExample: DEFAULT_CHIPOTLE_ACTION_PARAMS_EXAMPLE,
});
