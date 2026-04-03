/**
 * @module arweaveUploadHelpers
 * @description Shared Arweave upload option resolvers extracted from contractScripts.
 *              Builds upload tags and resolves per-session upload auth/bootstrap state.
 *
 * Key exports: buildArweaveUploadTags, resolveArweaveUploadOpts
 */

import { getChainById } from '../../variables/chains.js';
import { getEffectiveArweaveKey } from '../session/resourceKeys.js';
import {
  getSessionConfigBySlugOrDefault,
  normalizeSessionSlug,
} from '../web3/sessionConfigResolvers.js';
import { buildArweaveUploadBootstrapAuth } from '../web3/contractArweaveUploadRuntime.js';

export const buildArweaveUploadTags = (cfg, slugOrEmpty = '') => {
  const slug = normalizeSessionSlug(slugOrEmpty);
  const rawChainId = Number(cfg?.networkChainId || cfg?.network?.chainId || cfg?.chainID || cfg?.chainId || 0);
  const chainId = Number.isFinite(rawChainId) && rawChainId > 0 ? rawChainId : 0;
  const surveysRef = cfg?.contracts?.surveys || {};
  const rawAddress = String(surveysRef?.address || cfg?.contractAddress || cfg?.address || '').trim();
  const contractAddress = /^0x[0-9a-fA-F]{40}$/.test(rawAddress) ? rawAddress : '';
  const chain = chainId > 0 ? getChainById(chainId) : null;
  const networkName = String(cfg?.network?.name || chain?.name || '').trim();
  const tags = [];

  if (slug) tags.push({ name: 'CE-SessionSlug', value: slug });
  if (chainId > 0) tags.push({ name: 'CE-ChainId', value: String(chainId) });
  if (contractAddress) tags.push({ name: 'CE-ContractAddress', value: contractAddress });
  if (networkName) tags.push({ name: 'CE-Network', value: networkName });

  return tags;
};

export const resolveArweaveUploadOpts = async (
  groupKeyOrCfg,
  { providerLike = null, signer = null } = {}
) => {
  const cfg = (groupKeyOrCfg && typeof groupKeyOrCfg === 'object')
    ? groupKeyOrCfg
    : getSessionConfigBySlugOrDefault(groupKeyOrCfg === undefined ? '' : groupKeyOrCfg);
  const slug = normalizeSessionSlug(
    typeof groupKeyOrCfg === 'string'
      ? groupKeyOrCfg
      : (cfg?.slug || '')
  );
  const tags = buildArweaveUploadTags(cfg, slug);

  let arweaveJwk = '';
  try {
    const result = await getEffectiveArweaveKey({ sessionSlug: slug, sessionConfig: cfg });
    arweaveJwk = result?.arweaveJwk || '';
  } catch (_) {
    arweaveJwk = '';
  }

  const bootstrapAuth = arweaveJwk
    ? await buildArweaveUploadBootstrapAuth({
        signer,
        providerLike,
        sessionSlug: slug,
        sessionConfig: cfg,
      })
    : null;

  return {
    arweaveJwk,
    sessionSlug: slug,
    sessionConfig: cfg,
    tags,
    ...(bootstrapAuth ? { adminAuth: bootstrapAuth, skipAuth: true } : {}),
  };
};
