/**
 * @module arweaveUploadHelpers
 * @description Shared Arweave upload option resolvers extracted from contractScripts.
 *              Builds upload tags and resolves per-session upload auth/bootstrap state.
 *
 * Key exports: buildArweaveUploadTags, resolveArweaveUploadOpts
 */

import { getChainById } from '../../variables/chains.js';
import { getEffectiveArweaveKey } from '../session/resourceKeys.js';
import { getSessionConfigBySlugOrDefault, normalizeSessionSlug } from '../web3/sessionConfigResolvers.js';
import { buildArweaveUploadBootstrapAuth } from '../web3/contractArweaveUploadRuntime.js';

type LooseRecord = Record<string, any>;

export interface ArweaveUploadTag {
  name: string;
  value: string;
}

export interface ArweaveUploadOpts {
  arweaveJwk: string;
  sessionSlug: string;
  sessionConfig: Record<string, unknown> | null;
  tags: ArweaveUploadTag[];
  adminAuth?: unknown;
  skipAuth?: boolean;
  forceDirectArweaveUpload?: boolean;
}

type RefreshSessionConfig = (input: {
  providerLike?: unknown;
  sessionConfig: Record<string, unknown> | null;
  slug: string;
}) => Promise<Record<string, unknown> | null | undefined>;

export const buildArweaveUploadTags = (
  cfg: Record<string, unknown> | null | undefined,
  slugOrEmpty = '',
): ArweaveUploadTag[] => {
  const cfgAny = cfg as LooseRecord | null | undefined;
  const slug = normalizeSessionSlug(slugOrEmpty);
  const rawChainId = Number(
    cfgAny?.networkChainId || cfgAny?.network?.chainId || cfgAny?.chainID || cfgAny?.chainId || 0,
  );
  const chainId = Number.isFinite(rawChainId) && rawChainId > 0 ? rawChainId : 0;
  const surveysRef = cfgAny?.contracts?.surveys || {};
  const rawAddress = String(surveysRef?.address || cfgAny?.contractAddress || cfgAny?.address || '').trim();
  const contractAddress = /^0x[0-9a-fA-F]{40}$/.test(rawAddress) ? rawAddress : '';
  const chain = chainId > 0 ? getChainById(chainId) : null;
  const networkName = String(cfgAny?.network?.name || chain?.name || '').trim();
  const tags: ArweaveUploadTag[] = [];

  if (slug) tags.push({ name: 'CE-SessionSlug', value: slug });
  if (chainId > 0) tags.push({ name: 'CE-ChainId', value: String(chainId) });
  if (contractAddress) tags.push({ name: 'CE-ContractAddress', value: contractAddress });
  if (networkName) tags.push({ name: 'CE-Network', value: networkName });

  return tags;
};

export const resolveArweaveUploadOpts = async (
  groupKeyOrCfg?: string | Record<string, unknown> | null,
  { providerLike = null, signer = null }: { providerLike?: unknown; signer?: unknown } = {},
): Promise<ArweaveUploadOpts> => {
  const cfg = (
    groupKeyOrCfg && typeof groupKeyOrCfg === 'object'
      ? groupKeyOrCfg
      : getSessionConfigBySlugOrDefault(groupKeyOrCfg === undefined ? '' : groupKeyOrCfg)
  ) as Record<string, unknown> | null;
  const cfgAny = cfg as LooseRecord | null;
  const slug = normalizeSessionSlug(typeof groupKeyOrCfg === 'string' ? groupKeyOrCfg : cfgAny?.slug || '');
  const tags = buildArweaveUploadTags(cfg, slug);

  let arweaveJwk = '';
  let arweaveJwkSource = '';
  try {
    const result = await getEffectiveArweaveKey({ sessionSlug: slug, sessionConfig: cfg });
    arweaveJwk = result?.arweaveJwk || '';
    arweaveJwkSource = String(result?.source || '')
      .trim()
      .toLowerCase();
  } catch (_) {
    arweaveJwk = '';
    arweaveJwkSource = '';
  }
  const forceDirectArweaveUpload = !!arweaveJwk && arweaveJwkSource === 'local';

  const bootstrapAuth =
    arweaveJwk && !forceDirectArweaveUpload
      ? await buildArweaveUploadBootstrapAuth({
          signer: signer as LooseRecord | null,
          providerLike,
          sessionSlug: slug,
          sessionConfig: cfg,
        })
      : null;

  return {
    arweaveJwk,
    sessionSlug: slug,
    sessionConfig: cfg as Record<string, unknown>,
    tags,
    ...(forceDirectArweaveUpload ? { forceDirectArweaveUpload: true, skipAuth: true } : {}),
    ...(bootstrapAuth ? { adminAuth: bootstrapAuth, skipAuth: true } : {}),
  };
};
