export const DEFAULT_CHIPOTLE_ACTION_NAME = 'ce-sbt-gated-crypto-v3';
export const DEFAULT_CHIPOTLE_ACTION_DESCRIPTION = 'Context Engine SBT-gated Lit action';
export const DEFAULT_CHIPOTLE_ACTION_CODE = `const ERC721_BALANCE_OF_ABI = [
  "function balanceOf(address owner) view returns (uint256)"
];

function normalizeMode(value) {
  return String(value || "any").trim().toLowerCase() === "all" ? "all" : "any";
}

async function checkSbtGate({ requesterAddress, sbtAddresses, gateMode, rpcUrl }) {
  if (!requesterAddress) throw new Error("Missing requesterAddress");
  if (!Array.isArray(sbtAddresses) || sbtAddresses.length === 0) {
    throw new Error("Missing sbtAddresses");
  }
  if (!rpcUrl) throw new Error("Missing rpcUrl");

  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
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
        hasToken: !balance.isZero(),
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
    message,
    ciphertext,
  } = params || {};

  if (!pkpId) throw new Error("Missing pkpId");
  if (!op) throw new Error("Missing op");

  const gate = await checkSbtGate({
    requesterAddress,
    sbtAddresses,
    gateMode,
    rpcUrl,
  });

  if (!gate.allowed) {
    return {
      ok: false,
      allowed: false,
      reason: "Requester does not satisfy the SBT gate.",
      gate,
    };
  }

  if (op === "check") {
    return {
      ok: true,
      allowed: true,
      op,
      gate,
    };
  }

  if (op === "encrypt") {
    if (typeof message !== "string" || !message.length) {
      throw new Error("Missing message for encrypt");
    }

    const nextCiphertext = await Lit.Actions.Encrypt({
      pkpId,
      message,
    });

    return {
      ok: true,
      allowed: true,
      op,
      gate,
      ciphertext: nextCiphertext,
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

    return {
      ok: true,
      allowed: true,
      op,
      gate,
      plaintext,
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
});

export const DEFAULT_CHIPOTLE_ACTION = Object.freeze({
  key: 'ce-sbt-gated-crypto-v3',
  name: DEFAULT_CHIPOTLE_ACTION_NAME,
  description: DEFAULT_CHIPOTLE_ACTION_DESCRIPTION,
  code: DEFAULT_CHIPOTLE_ACTION_CODE,
  paramsExample: DEFAULT_CHIPOTLE_ACTION_PARAMS_EXAMPLE,
});
