import { buildArweaveGatewayUrlCandidates, normalizeArweaveUrl } from '../../utilities/arweave/arweaveUrls.js';

export type SbtListHelperRecord = Record<string, unknown>;
export type SbtListHelperItem = SbtListHelperRecord & {
  blockNumber?: unknown;
  burnedAddresses?: unknown;
  defaultSbtTags?: unknown;
  docURLs?: unknown;
  documentURLs?: unknown;
  documentUrls?: unknown;
  documents?: unknown;
  featuredSbtTags?: unknown;
  historySummary?: SbtListHelperRecord & {
    currentHolderCount?: unknown;
    historicalHolderCount?: unknown;
  };
  mintedAddresses?: unknown;
  sbtAddress?: unknown;
  sbtInfo?: SbtListHelperRecord;
  sessionSlug?: unknown;
  slug?: unknown;
};

export type SbtListDocumentLink = {
  href: string;
  label: string;
};

export type SbtCardDetails = {
  documentUrls: SbtListDocumentLink[];
  hasDetails: boolean;
  tags: string[];
};

const isSbtListCardRecord = (value: unknown): value is SbtListHelperRecord => !!value && typeof value === 'object';

export const normalizeSbtListGatewayUri = (uri: unknown, contextLabel: string = 'sbt_list_asset'): string | null => {
  if (!uri) return null;
  const s = String(uri).trim();
  if (!s) return null;
  if (/^ipfs:\/\//i.test(s)) return `https://ipfs.io/ipfs/${s.replace(/^ipfs:\/\//i, '')}`;
  const arweaveCandidates = buildArweaveGatewayUrlCandidates(s, { gateway: 'https://arweave.net' });
  const preferredArweaveCandidate = arweaveCandidates[0] || '';
  if (preferredArweaveCandidate && preferredArweaveCandidate !== s) return preferredArweaveCandidate;
  return normalizeArweaveUrl(s, { contextLabel });
};

export const normalizeSbtListTokenUri = (uri: unknown): string | null =>
  normalizeSbtListGatewayUri(uri, 'sbt_list_image');

export const normalizeSbtListDocumentHref = (uri: unknown): string | null =>
  normalizeSbtListGatewayUri(uri, 'sbt_list_document');

export const dedupeCaseInsensitiveStrings = (values: unknown = []): string[] => {
  const out: string[] = [];
  const seen = new Set<string>();
  (Array.isArray(values) ? values : []).forEach((value: unknown) => {
    const trimmed = String(value || '').trim();
    if (!trimmed) return;
    const normalized = trimmed.toLowerCase();
    if (seen.has(normalized)) return;
    seen.add(normalized);
    out.push(trimmed);
  });
  return out;
};

export const collectSbtTagValues = (...candidates: unknown[]): string[] => {
  const values: string[] = [];
  const visit = (candidate: unknown): void => {
    if (candidate == null) return;
    if (Array.isArray(candidate)) {
      candidate.forEach(visit);
      return;
    }
    if (typeof candidate === 'string') {
      candidate
        .split(',')
        .map((entry: string) => entry.trim())
        .filter(Boolean)
        .forEach((entry: string) => values.push(entry));
      return;
    }
    if (isSbtListCardRecord(candidate)) {
      const objectText = [candidate.label, candidate.name, candidate.value, candidate.tag].find(
        (value: unknown) => typeof value === 'string' && value.trim().length > 0,
      );
      if (typeof objectText === 'string') values.push(objectText);
    }
  };
  candidates.forEach(visit);
  return dedupeCaseInsensitiveStrings(values);
};

export const collectSbtDocumentUrls = (...candidates: unknown[]): string[] => {
  const values: string[] = [];
  const visit = (candidate: unknown): void => {
    if (candidate == null) return;
    if (Array.isArray(candidate)) {
      candidate.forEach(visit);
      return;
    }
    if (typeof candidate === 'string') {
      values.push(candidate);
      return;
    }
    if (isSbtListCardRecord(candidate)) {
      const documentHref = [
        candidate.url,
        candidate.href,
        candidate.link,
        candidate.documentURL,
        candidate.documentUrl,
        candidate.docURL,
        candidate.docUrl,
        candidate.value,
      ].find((value: unknown) => typeof value === 'string' && value.trim().length > 0);
      if (typeof documentHref === 'string') values.push(documentHref);
    }
  };
  candidates.forEach(visit);
  return dedupeCaseInsensitiveStrings(values);
};

export const getSbtCardDetails = (sbt: unknown): SbtCardDetails => {
  const record = isSbtListCardRecord(sbt) ? (sbt as SbtListHelperItem) : {};
  const sbtInfo = isSbtListCardRecord(record.sbtInfo) ? record.sbtInfo : {};
  const tags = collectSbtTagValues(
    sbtInfo.tags,
    record.tags,
    record.defaultSbtTags,
    record.featuredSbtTags,
    sbtInfo.defaultSbtTags,
    sbtInfo.featuredSbtTags,
  );
  const documentUrls = collectSbtDocumentUrls(
    sbtInfo.documentURLs,
    sbtInfo.documentUrls,
    sbtInfo.docURLs,
    sbtInfo.documents,
    record.documentURLs,
    record.documentUrls,
    record.docURLs,
    record.documents,
  ).map((rawHref: string) => ({
    href: normalizeSbtListDocumentHref(rawHref) || rawHref,
    label: rawHref,
  }));

  return {
    tags,
    documentUrls,
    hasDetails: documentUrls.length > 0,
  };
};
