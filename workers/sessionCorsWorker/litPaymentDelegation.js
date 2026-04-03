import { ethers } from 'ethers';

const DEFAULT_LIT_NETWORK = 'naga-dev';
const DEFAULT_RPC_URL = 'https://yellowstone-rpc.litprotocol.com/';
const DEFAULT_DELEGATION_TTL_MS = 1000 * 60 * 10;
const PAYMENT_DELEGATION_RECAP_URN = 'urn:recap:eyJhdHQiOnsibGl0LWFjY2Vzc2NvbnRyb2xjb25kaXRpb246Ly8qIjp7IlRocmVzaG9sZC9EZWNyeXB0aW9uIjpbe31dLCJUaHJlc2hvbGQvU2lnbmluZyI6W3t9XX0sImxpdC1wYXltZW50ZGVsZWdhdGlvbjovLyoiOnsiQXV0aC9BdXRoIjpbe31dfX0sInByZiI6W119';
const PAYMENT_DELEGATION_STATEMENT = "Authorize Lit session I further authorize the stated URI to perform the following actions on my behalf: (1) 'Threshold': 'Decryption', 'Signing' for 'lit-accesscontrolcondition://*'. (2) 'Auth': 'Auth' for 'lit-paymentdelegation://*'.";
const PAYMENT_DELEGATION_ABI = [
  'function delegatePayments(address user)',
  'function getPayers(address user) view returns (address[])',
  'function getUsers(address payer) view returns (address[])',
  'function getRestriction(address payer) view returns ((uint128 totalMaxPrice,uint256 requestsPerPeriod,uint256 periodSeconds))',
];
const LEDGER_ABI = [
  'function balance(address user) view returns (int256)',
  'function stableBalance(address user) view returns (int256)',
];

const LIT_NETWORK_ALIASES = Object.freeze({
  'naga-dev': 'naga-dev',
  nagadev: 'naga-dev',
  'naga-test': 'naga-test',
  nagatest: 'naga-test',
  naga: 'naga',
  'naga-mainnet': 'naga',
});

const LIT_PAYMENT_NETWORKS = Object.freeze({
  'naga-dev': {
    rpcUrl: DEFAULT_RPC_URL,
    paymentDelegationAddress: '0x2F202f846CBB27Aa5EbE6b9cfad50D65c49c01FF',
    ledgerAddress: '0x81061b50a66EBB3E7F9CEbeF2b1C1A961aE858F4',
  },
  'naga-test': {
    rpcUrl: DEFAULT_RPC_URL,
    paymentDelegationAddress: '0xeb5C9B118E118C034Ff59ac8B1F0c3c36f22906b',
    ledgerAddress: '0xBFcA364C37d82bF8D05F931084448798e2b6638b',
  },
  naga: {
    rpcUrl: DEFAULT_RPC_URL,
    paymentDelegationAddress: '0x5EF658cB6ab3C3BfB75C8293B9a6C8ccb0b96C3c',
    ledgerAddress: '0x9BD023448d2D3b2D73fe61E4d7859007F6dA372c',
  },
});

const toStr = (value) => (
  typeof value === 'string'
    ? value.trim()
    : value == null
      ? ''
      : String(value).trim()
);

const normalizeLitNetwork = (value) => {
  const raw = toStr(value || DEFAULT_LIT_NETWORK).toLowerCase().replace(/_/g, '-');
  return LIT_NETWORK_ALIASES[raw] || DEFAULT_LIT_NETWORK;
};

const normalizePrivateKey = (value) => {
  const trimmed = toStr(value);
  if (!trimmed) return '';
  if (/^0x[0-9a-fA-F]{64}$/.test(trimmed)) return trimmed;
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) return `0x${trimmed}`;
  return trimmed;
};

const normalizeSessionPublicKey = (value) => {
  const trimmed = toStr(value).replace(/^0x/i, '').trim();
  if (!trimmed) return '';
  return /^[0-9a-fA-F]{64}$/.test(trimmed) ? trimmed.toLowerCase() : '';
};

const buildNonce = () => {
  try {
    const bytes = new Uint8Array(8);
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes, (entry) => entry.toString(16).padStart(2, '0')).join('');
  } catch {
    return `${Date.now().toString(16)}${Math.random().toString(16).slice(2, 10)}`;
  }
};

const readAudienceHost = (audience) => {
  const raw = toStr(audience);
  if (!raw) return 'localhost';
  try {
    return new URL(raw).host || 'localhost';
  } catch {
    return raw.replace(/^https?:\/\//i, '').split('/')[0] || 'localhost';
  }
};

const resolveLitPaymentNetworkConfig = (litNetwork) => {
  const normalizedNetwork = normalizeLitNetwork(litNetwork);
  const networkConfig = LIT_PAYMENT_NETWORKS[normalizedNetwork];
  if (!networkConfig) {
    throw new Error(`Unsupported Lit payment network: ${normalizedNetwork}`);
  }
  return {
    litNetwork: normalizedNetwork,
    ...networkConfig,
  };
};

const getPayerWallet = (privateKey) => {
  const normalizedPrivateKey = normalizePrivateKey(privateKey);
  if (!normalizedPrivateKey) {
    throw new Error('Lit payer private key is required.');
  }
  return new ethers.Wallet(normalizedPrivateKey);
};

const getAddress = (value) => {
  if (typeof ethers?.getAddress === 'function') return ethers.getAddress(value);
  return ethers.utils.getAddress(value);
};

const isAddress = (value) => {
  if (typeof ethers?.isAddress === 'function') return ethers.isAddress(value);
  return ethers.utils.isAddress(value);
};

const getProvider = (rpcUrl) => {
  if (ethers.providers?.JsonRpcProvider) {
    return new ethers.providers.JsonRpcProvider(rpcUrl);
  }
  if (ethers.JsonRpcProvider) {
    return new ethers.JsonRpcProvider(rpcUrl);
  }
  throw new Error('JsonRpcProvider unavailable.');
};

const formatBalance = (value) => {
  try {
    if (typeof ethers?.formatEther === 'function') return ethers.formatEther(value);
    return ethers.utils.formatEther(value);
  } catch {
    return '0.0';
  }
};

const hasPositiveBalance = (value) => {
  if (typeof value === 'bigint') return value > 0n;
  if (value && typeof value.gt === 'function') return value.gt(0);
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) && numeric > 0;
};

const resolveDelegationExpiration = (requestedExpiresAt) => {
  const nowMs = Date.now();
  const maxExpiryMs = nowMs + DEFAULT_DELEGATION_TTL_MS;
  const requestedMs = Date.parse(toStr(requestedExpiresAt));
  if (!Number.isFinite(requestedMs) || requestedMs <= nowMs) {
    return new Date(maxExpiryMs).toISOString();
  }
  return new Date(Math.min(requestedMs, maxExpiryMs)).toISOString();
};

export const readLitPayerStatus = async ({
  litNetwork,
  litPayerPrivateKey,
} = {}) => {
  const networkConfig = resolveLitPaymentNetworkConfig(litNetwork);
  const payerWallet = getPayerWallet(litPayerPrivateKey);
  const payerAddress = getAddress(payerWallet.address);
  const provider = getProvider(networkConfig.rpcUrl);
  const ledgerContract = new ethers.Contract(networkConfig.ledgerAddress, LEDGER_ABI, provider);
  const paymentDelegationContract = new ethers.Contract(
    networkConfig.paymentDelegationAddress,
    PAYMENT_DELEGATION_ABI,
    provider,
  );

  const [totalBalanceWei, availableBalanceWei, restriction, delegatedUsers] = await Promise.all([
    ledgerContract.balance(payerAddress),
    ledgerContract.stableBalance(payerAddress),
    paymentDelegationContract.getRestriction(payerAddress).catch(() => null),
    paymentDelegationContract.getUsers(payerAddress).catch(() => []),
  ]);

  const ready = hasPositiveBalance(availableBalanceWei);
  return {
    payerAddress,
    litNetwork: networkConfig.litNetwork,
    balance: {
      totalBalance: formatBalance(totalBalanceWei),
      availableBalance: formatBalance(availableBalanceWei),
    },
    restriction: restriction
      ? {
          totalMaxPrice: toStr(restriction.totalMaxPrice ?? ''),
          requestsPerPeriod: toStr(restriction.requestsPerPeriod ?? ''),
          periodSeconds: toStr(restriction.periodSeconds ?? ''),
        }
      : null,
    delegatedUsersCount: Array.isArray(delegatedUsers) ? delegatedUsers.length : 0,
    ready,
  };
};

const ensureRequesterDelegated = async ({
  requesterAddress,
  networkConfig,
  payerWallet,
  payerAddress,
} = {}) => {
  const provider = getProvider(networkConfig.rpcUrl);
  const paymentDelegationContract = new ethers.Contract(
    networkConfig.paymentDelegationAddress,
    PAYMENT_DELEGATION_ABI,
    provider,
  );
  const normalizedRequester = getAddress(requesterAddress);
  const payers = await paymentDelegationContract.getPayers(normalizedRequester);
  const alreadyDelegated = Array.isArray(payers) && payers.some((entry) => (
    toStr(entry).toLowerCase() === payerAddress.toLowerCase()
  ));
  if (alreadyDelegated) {
    return { delegatedNow: false, alreadyDelegated: true };
  }
  const signerContract = paymentDelegationContract.connect(payerWallet.connect(provider));
  const tx = await signerContract.delegatePayments(normalizedRequester);
  if (tx && typeof tx.wait === 'function') {
    await tx.wait();
  }
  return { delegatedNow: true, alreadyDelegated: false };
};

const buildDelegationSignedMessage = ({
  payerAddress,
  sessionPublicKey,
  audience,
  expiresAt,
  nonce,
  issuedAt,
} = {}) => {
  const sessionKey = normalizeSessionPublicKey(sessionPublicKey);
  if (!sessionKey) {
    throw new Error('Lit delegation requires a valid session public key.');
  }
  const domain = readAudienceHost(audience);
  return `${domain} wants you to sign in with your Ethereum account:
${payerAddress}

${PAYMENT_DELEGATION_STATEMENT}

URI: lit:session:${sessionKey}
Version: 1
Chain ID: 1
Nonce: ${toStr(nonce) || buildNonce()}
Issued At: ${toStr(issuedAt) || new Date().toISOString()}
Expiration Time: ${toStr(expiresAt)}
Resources:
- ${PAYMENT_DELEGATION_RECAP_URN}`;
};

export const issueLitPaymentDelegation = async ({
  requesterAddress,
  sessionPublicKey,
  litNetwork,
  litPayerPrivateKey,
  audience,
  expiresAt,
} = {}) => {
  const normalizedRequesterAddress = toStr(requesterAddress);
  if (!isAddress(normalizedRequesterAddress)) {
    throw new Error('Lit delegation requires a valid requester address.');
  }

  const resolvedExpiresAt = resolveDelegationExpiration(expiresAt);
  if (!resolvedExpiresAt) {
    throw new Error('Lit delegation expiration is required.');
  }

  const networkConfig = resolveLitPaymentNetworkConfig(litNetwork);
  const payerWallet = getPayerWallet(litPayerPrivateKey);
  const payerAddress = getAddress(payerWallet.address);
  const delegationState = await ensureRequesterDelegated({
    requesterAddress: normalizedRequesterAddress,
    networkConfig,
    payerWallet,
    payerAddress,
  });
  const signedMessage = buildDelegationSignedMessage({
    payerAddress,
    sessionPublicKey,
    audience,
    expiresAt: resolvedExpiresAt,
  });
  const sig = await payerWallet.signMessage(signedMessage);
  const status = await readLitPayerStatus({
    litNetwork: networkConfig.litNetwork,
    litPayerPrivateKey,
  }).catch(() => null);
  return {
    capabilityAuthSig: {
      sig,
      derivedVia: 'web3.eth.personal.sign',
      signedMessage,
      address: payerAddress,
    },
    payerAddress,
    expiresAt: resolvedExpiresAt,
    delegatedNow: delegationState.delegatedNow,
    alreadyDelegated: delegationState.alreadyDelegated,
    status,
  };
};
