import { buildArweaveGatewayUrlCandidates, normalizeArweaveUrl } from '../../utilities/arweave/arweaveUrls.js';
import { decodeSbtPageJsonDataUri } from './sbtPagePasswordExportHelpers';

export type SbtPageInfoImageLike = Record<string, unknown> & {
  image?: unknown;
};
type SbtPageDisplayImageFallbackState = {
  displayImageFallbackKey?: unknown;
  displayImageFallbackIndex?: unknown;
};
type SbtPageDisplayImageNextFallbackArgs = {
  activeIndex?: number;
  maxIndex?: number;
  sourceKey?: string;
};
type ResolveSbtPageTokenMetadataLinkDisplayStateArgs = {
  tokenUriRaw?: unknown;
};
export type SbtPageDisplayImageState = {
  sourceKey: string;
  candidates: string[];
  activeIndex: number;
  src: string;
  canRetry: boolean;
};
export type SbtPageTokenMetadataLinkDisplayState = {
  href: string;
  shouldRenderLink: boolean;
};

export const isSbtPageImageLikeUri = (uriRaw: unknown): boolean => {
  const raw = String(uriRaw || '').trim();
  if (!raw) return false;
  if (/^data:image\//i.test(raw)) return true;
  try {
    const parsed = new URL(raw);
    const path = String(parsed.pathname || '').toLowerCase();
    if (/\.(png|jpe?g|gif|webp|svg|bmp|avif|ico|tiff?)$/i.test(path)) return true;
    const extHint = String(parsed.searchParams.get('ext') || parsed.searchParams.get('format') || '').toLowerCase();
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'avif', 'ico', 'tif', 'tiff'].includes(extHint)) {
      return true;
    }
  } catch (_) {
    return false;
  }
  return false;
};

export const getDisplayImageUrlCandidates = (sbtInfo: SbtPageInfoImageLike | null | undefined): string[] => {
  const imageValue = sbtInfo?.image;
  return buildArweaveGatewayUrlCandidates(imageValue, { gateway: 'https://arweave.net' }).filter((candidate) => {
    try {
      const host = new URL(candidate).hostname.toLowerCase();
      const isKnownArweaveGateway =
        host === 'ar-io.dev' ||
        host.endsWith('.ar-io.dev') ||
        host === 'arweave.net' ||
        host.endsWith('.arweave.net') ||
        host === 'gateway.irys.xyz' ||
        host.endsWith('.gateway.irys.xyz') ||
        host === 'permagate.io' ||
        host.endsWith('.permagate.io') ||
        host === 'g8way.io' ||
        host.endsWith('.g8way.io');
      if (!isKnownArweaveGateway) return true;
      return (
        host === 'arweave.net' ||
        host.endsWith('.arweave.net') ||
        host === 'gateway.irys.xyz' ||
        host.endsWith('.gateway.irys.xyz')
      );
    } catch (_) {
      return true;
    }
  });
};

export const resolveDisplayImageHref = (
  sbtInfo: SbtPageInfoImageLike | null | undefined,
  defaultImage: unknown = '',
): string => {
  const candidates = getDisplayImageUrlCandidates(sbtInfo);
  const candidate = candidates[0] || '';
  return candidate || String(defaultImage || '');
};

export const getDisplayImageRenderState = (
  sbtInfo: SbtPageInfoImageLike | null | undefined,
  fallbackState: SbtPageDisplayImageFallbackState = {},
  defaultImage: unknown = '',
): SbtPageDisplayImageState => {
  const sourceKey = String(sbtInfo?.image || '').trim();
  const candidates = getDisplayImageUrlCandidates(sbtInfo);
  const activeIndex =
    fallbackState.displayImageFallbackKey === sourceKey
      ? Math.max(0, Number(fallbackState.displayImageFallbackIndex || 0))
      : 0;
  const fallbackImage = String(defaultImage || '');
  const src = candidates[activeIndex] || fallbackImage;
  return {
    sourceKey,
    candidates,
    activeIndex,
    src,
    canRetry: activeIndex < candidates.length,
  };
};

export const getDisplayImageFallbackCandidateCount = (candidates: unknown): number =>
  Array.isArray(candidates) ? candidates.length : 0;

export const getNextDisplayImageFallbackState = (
  { activeIndex = 0, maxIndex = 0, sourceKey = '' }: SbtPageDisplayImageNextFallbackArgs = {},
  prevState: SbtPageDisplayImageFallbackState = {},
): SbtPageDisplayImageFallbackState | null => {
  const currentIndex =
    prevState.displayImageFallbackKey === sourceKey ? Math.max(0, Number(prevState.displayImageFallbackIndex || 0)) : 0;
  if (currentIndex !== activeIndex) return null;
  return {
    displayImageFallbackKey: sourceKey,
    displayImageFallbackIndex: Math.min(activeIndex + 1, maxIndex),
  };
};

export const normalizeSbtPageCanonicalMetadataHref = (candidateRaw: unknown): string => {
  const candidate = String(candidateRaw || '').trim();
  if (!candidate) return '';
  const normalized = normalizeArweaveUrl(candidate, { contextLabel: 'sbt_page_token_uri' });
  if (!normalized || /^data:/i.test(normalized)) return '';
  if (isSbtPageImageLikeUri(normalized)) return '';
  return normalized;
};

export const resolveSbtPageTokenMetadataHref = (tokenUriRaw: unknown): string => {
  const raw = String(tokenUriRaw || '').trim();
  if (!raw) return '';

  const normalizedDirect = normalizeSbtPageCanonicalMetadataHref(raw);
  if (normalizedDirect) return normalizedDirect;
  if (!/^data:application\/json/i.test(raw)) return '';

  const decoded = decodeSbtPageJsonDataUri(raw);
  if (!decoded) return '';
  const candidates = [
    decoded.tokenURI,
    decoded.tokenUri,
    decoded.token_uri,
    decoded.uri,
    decoded.sbtTokenURI,
    decoded.sbtTokenUri,
    decoded.sbt_token_uri,
    decoded.metadataUri,
    decoded.metadataURI,
    decoded.metadata_uri,
    decoded.arweaveUri,
    decoded.arweaveURL,
    typeof decoded.arweaveTxId === 'string' ? `ar://${decoded.arweaveTxId}` : null,
  ];
  for (const candidate of candidates) {
    const normalized = normalizeSbtPageCanonicalMetadataHref(candidate);
    if (normalized) return normalized;
  }
  return '';
};

export const resolveSbtPageTokenMetadataLinkDisplayState = ({
  tokenUriRaw = '',
}: ResolveSbtPageTokenMetadataLinkDisplayStateArgs = {}): SbtPageTokenMetadataLinkDisplayState => {
  const href = resolveSbtPageTokenMetadataHref(tokenUriRaw);
  return {
    href,
    shouldRenderLink: !!href,
  };
};
