export const DEFAULT_CHIPOTLE_ACTION_NAME = 'ce-sbt-gated-crypto-v3';
export const DEFAULT_CHIPOTLE_ACTION_DESCRIPTION = 'Context Engine SBT-gated Lit action';
export const DEFAULT_CHIPOTLE_ACTION_CODE = `const ERC721_BALANCE_OF_ABI = [
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

async function main(params) {
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

    const nextCiphertext = await Lit.Actions.Encrypt({
      pkpId,
      message,
    });

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

    const plaintext = await Lit.Actions.Decrypt({
      pkpId,
      ciphertext,
    });
    const wrappedPayload = parseWrappedPlaintext(plaintext);
    if (wrappedPayload.policyFingerprint.toLowerCase() !== approvedFingerprint.toLowerCase()) {
      throw new Error("Lit Chipotle policy mismatch.");
    }

    return {
      ok: true,
      allowed: true,
      op,
      gate,
      plaintext: wrappedPayload.cekHex,
      policyFingerprint: approvedFingerprint,
    };
  }

  throw new Error("Unsupported op: " + op);
}`;

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
  key: 'ce-sbt-gated-crypto-v3',
  name: DEFAULT_CHIPOTLE_ACTION_NAME,
  description: DEFAULT_CHIPOTLE_ACTION_DESCRIPTION,
  code: DEFAULT_CHIPOTLE_ACTION_CODE,
  paramsExample: DEFAULT_CHIPOTLE_ACTION_PARAMS_EXAMPLE,
});
