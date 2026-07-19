import {
  findArweaveTagIndex,
  getArweaveTagValue,
  setArweaveTagValue,
} from './arweaveCeTagNormalization.js';
import { attestRpcEndpointChain } from './rpcChainAttestation.js';
import { resolveRegistryChainId } from './chainIdNormalization.js';

const SESSION_ID_MISMATCH_ERROR = 'CE-SessionId does not match authenticated session.';
const SBT_PAIR_ERROR = 'CE-SbtChainId and CE-SbtAddress must be provided together.';
const INVALID_SBT_CHAIN_ID_ERROR = 'Invalid CE-SbtChainId.';
const INVALID_SBT_ADDRESS_ERROR = 'Invalid CE-SbtAddress.';
const MISSING_UPLOADER_ADDRESS_ERROR = 'Missing uploader address for SBT association check.';
const SBT_UNAUTHORIZED_ERROR = 'Uploader is not authorized to associate this SBT group.';

const toErrorMessage = (value, deps) => (
  deps?.toStr
    ? deps.toStr(value).trim()
    : (typeof value === 'string' ? value : value == null ? '' : String(value)).trim()
);

const resolveSessionIdHexForSlug = async ({ config, slug, chainAttestationCache, deps }) => {
  const registryAddress = deps.toStr(config?.registryAddress).trim();
  const registryRpcUrls = deps.resolveRegistryRpcUrls(config);
  if (!deps.isAddress(registryAddress) || !registryRpcUrls.length) {
    throw new Error('Session registry not configured (registryAddress + rpcUrl required).');
  }

  const registrySlug = deps.toRegistrySessionSlug(slug);
  const tupleRead = await deps.readSessionBySlugOnChain({
    registryAddress,
    registryRpcUrls,
    registrySlug,
    expectedChainId: resolveRegistryChainId(config),
    chainAttestationCache,
  });
  if (!tupleRead?.ok) {
    throw tupleRead?.error || new Error('Failed to resolve sessionId from SessionRegistry.');
  }

  const sessionIdHex = deps.normalizeSessionIdHex(tupleRead?.tuple?.[7]);
  if (!sessionIdHex) {
    throw new Error('SessionRegistry returned invalid sessionId.');
  }
  return sessionIdHex;
};

const writeCanonicalSbtTags = ({ tags, chainId, sbtAddress }) => {
  setArweaveTagValue(tags, 'CE-SbtChainId', String(chainId));
  setArweaveTagValue(tags, 'CE-SbtAddress', sbtAddress);
};

export const resolveArweaveSessionIdAssociation = async ({
  tags,
  slug,
  config,
  chainAttestationCache,
  deps,
} = {}) => {
  const normalizedTags = Array.isArray(tags) ? tags : [];
  const hasSessionIdTag = findArweaveTagIndex(normalizedTags, 'CE-SessionId') >= 0;
  if (!hasSessionIdTag) {
    return {
      ok: true,
      status: 200,
      error: '',
      reason: '',
      tags: normalizedTags,
    };
  }

  let expectedSessionId = '';
  try {
    expectedSessionId = await resolveSessionIdHexForSlug({ config, slug, chainAttestationCache, deps });
  } catch (err) {
    return {
      ok: false,
      status: 400,
      error: toErrorMessage(err?.message || err, deps) || 'Failed to resolve sessionId.',
      reason: 'session-id-resolve',
      tags: normalizedTags,
    };
  }

  const providedSessionId = deps.normalizeSessionIdHex(getArweaveTagValue(normalizedTags, 'CE-SessionId'));
  if (providedSessionId && providedSessionId !== expectedSessionId) {
    return {
      ok: false,
      status: 403,
      error: SESSION_ID_MISMATCH_ERROR,
      reason: 'session-id-mismatch',
      tags: normalizedTags,
    };
  }

  setArweaveTagValue(normalizedTags, 'CE-SessionId', expectedSessionId);
  return {
    ok: true,
    status: 200,
    error: '',
    reason: '',
    tags: normalizedTags,
  };
};

export const authorizeArweaveSbtAssociation = async ({
  config,
  tags,
  uploaderAddress,
  chainAttestationCache,
  deps,
} = {}) => {
  const normalizedTags = Array.isArray(tags) ? tags : [];
  const hasChainIdTag = findArweaveTagIndex(normalizedTags, 'CE-SbtChainId') >= 0;
  const hasAddressTag = findArweaveTagIndex(normalizedTags, 'CE-SbtAddress') >= 0;
  if (!hasChainIdTag && !hasAddressTag) {
    return {
      ok: true,
      status: 200,
      error: '',
      reason: '',
      tags: normalizedTags,
    };
  }
  if (!(hasChainIdTag && hasAddressTag)) {
    return {
      ok: false,
      status: 403,
      error: SBT_PAIR_ERROR,
      reason: 'sbt-association',
      tags: normalizedTags,
    };
  }

  const chainIdRaw = getArweaveTagValue(normalizedTags, 'CE-SbtChainId');
  const chainId = deps.toChainId(chainIdRaw);
  if (!chainId) {
    return {
      ok: false,
      status: 403,
      error: INVALID_SBT_CHAIN_ID_ERROR,
      reason: 'sbt-association',
      tags: normalizedTags,
    };
  }

  const sbtAddress = deps.toStr(getArweaveTagValue(normalizedTags, 'CE-SbtAddress')).trim().toLowerCase();
  if (!deps.isAddress(sbtAddress)) {
    return {
      ok: false,
      status: 403,
      error: INVALID_SBT_ADDRESS_ERROR,
      reason: 'sbt-association',
      tags: normalizedTags,
    };
  }

  const uploader = deps.toStr(uploaderAddress).trim().toLowerCase();
  if (!uploader || !deps.isAddress(uploader)) {
    return {
      ok: false,
      status: 403,
      error: MISSING_UPLOADER_ADDRESS_ERROR,
      reason: 'sbt-association',
      tags: normalizedTags,
    };
  }

  const rpcUrls = deps.resolveRpcUrlListForGate(config, chainId);
  if (!rpcUrls.length) {
    return {
      ok: false,
      status: 403,
      error: `Missing RPC URL for chainId ${chainId}.`,
      reason: 'sbt-association',
      tags: normalizedTags,
    };
  }

  const erc721 = deps.getErc721Interface();
  const adminIface = deps.getSbtAdminInterface();
  const requestChainAttestationCache = chainAttestationCache instanceof Map
    ? chainAttestationCache
    : new Map();

  for (const rpcUrl of rpcUrls) {
    // Each association request re-attests endpoints; the cache lives only for
    // this request and prevents duplicate probes across holder/admin/owner reads.
    const attestation = await attestRpcEndpointChain({
      rpcUrl,
      expectedChainId: chainId,
      rpcRequest: deps.rpcRequest,
      toChainId: deps.toChainId,
      cache: requestChainAttestationCache,
    });
    if (!attestation.ok) continue;
    try {
      const decodedBal = await deps.callContractFunction({
        rpcUrl,
        contractAddress: sbtAddress,
        iface: erc721,
        method: 'balanceOf',
        args: [uploader],
      });
      const bal = Array.isArray(decodedBal) ? decodedBal[0] : decodedBal;
      if (deps.isPositiveBalance(bal)) {
        writeCanonicalSbtTags({ tags: normalizedTags, chainId, sbtAddress });
        return { ok: true, status: 200, error: '', reason: '', tags: normalizedTags };
      }
    } catch (_) {
      // fall through to admin/owner checks
    }

    try {
      const decodedAdmin = await deps.callContractFunction({
        rpcUrl,
        contractAddress: sbtAddress,
        iface: adminIface,
        method: 'admin',
        args: [],
      });
      const admin = (Array.isArray(decodedAdmin) ? decodedAdmin[0] : decodedAdmin) || '';
      if (deps.toStr(admin).trim().toLowerCase() === uploader) {
        writeCanonicalSbtTags({ tags: normalizedTags, chainId, sbtAddress });
        return { ok: true, status: 200, error: '', reason: '', tags: normalizedTags };
      }
    } catch (_) {
      // ignore
    }

    try {
      const decodedOwner = await deps.callContractFunction({
        rpcUrl,
        contractAddress: sbtAddress,
        iface: adminIface,
        method: 'owner',
        args: [],
      });
      const owner = (Array.isArray(decodedOwner) ? decodedOwner[0] : decodedOwner) || '';
      if (deps.toStr(owner).trim().toLowerCase() === uploader) {
        writeCanonicalSbtTags({ tags: normalizedTags, chainId, sbtAddress });
        return { ok: true, status: 200, error: '', reason: '', tags: normalizedTags };
      }
    } catch (_) {
      // ignore
    }
  }

  return {
    ok: false,
    status: 403,
    error: SBT_UNAUTHORIZED_ERROR,
    reason: 'sbt-association',
    tags: normalizedTags,
  };
};
