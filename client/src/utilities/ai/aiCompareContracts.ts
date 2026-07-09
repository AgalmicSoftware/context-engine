type UnknownRecord = Record<string, unknown>;

export type CompareVennRegionKey = 'a' | 'b' | 'c' | 'ab' | 'ac' | 'bc' | 'abc';

export const COMPARE_VENN_REGION_KEYS: readonly CompareVennRegionKey[] = ['a', 'b', 'c', 'ab', 'ac', 'bc', 'abc'];

export interface CompareBullets {
  agreements: string[];
  disagreements: string[];
}

export type CompareVennCounts = Partial<Record<CompareVennRegionKey, number>>;
export type CompareVennEvidenceMap = Partial<Record<CompareVennRegionKey, unknown[]>>;

export interface CompareVennResult {
  counts: CompareVennCounts;
  semantics?: string | null;
  evidenceMap?: CompareVennEvidenceMap;
}

export type CompareToolkitPointType = 'agreement' | 'disagreement';

export interface CompareToolkitPayload {
  pointText: string;
  type: CompareToolkitPointType;
  users: unknown[];
}

const isRecord = (value: unknown): value is UnknownRecord =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export const normalizeCompareBullets = (
  candidate: unknown,
  fallback: CompareBullets,
  maxItems = 12,
): CompareBullets => {
  const candidateRecord = isRecord(candidate) ? candidate : null;
  const candidateHasShape =
    candidateRecord && Array.isArray(candidateRecord.agreements) && Array.isArray(candidateRecord.disagreements)
      ? candidateRecord
      : null;
  const agreements = candidateHasShape ? (candidateHasShape.agreements as string[]) : fallback.agreements;
  const disagreements = candidateHasShape ? (candidateHasShape.disagreements as string[]) : fallback.disagreements;

  return {
    agreements: agreements.slice(0, maxItems),
    disagreements: disagreements.slice(0, maxItems),
  };
};

export const mergeCompareVennWithEvidence = (
  candidate: unknown,
  fallback: CompareVennResult,
): CompareVennResult | null => {
  if (!isRecord(candidate) || !isRecord(candidate.counts)) return null;

  const evidenceMap = isRecord(candidate.evidenceMap) ? candidate.evidenceMap : {};
  const out: CompareVennResult = {
    counts: { ...fallback.counts, ...candidate.counts } as CompareVennCounts,
    semantics: (candidate.semantics as string | null | undefined) || fallback.semantics,
    evidenceMap: { ...fallback.evidenceMap, ...evidenceMap } as CompareVennEvidenceMap,
  };

  for (const key of COMPARE_VENN_REGION_KEYS) {
    if ((out.counts[key] || 0) > 0 && (!Array.isArray(out.evidenceMap?.[key]) || out.evidenceMap[key]?.length === 0)) {
      out.evidenceMap = out.evidenceMap || {};
      out.evidenceMap[key] = fallback.evidenceMap?.[key] || [];
    }
  }

  return out;
};

export const readCompareToolkitTask = (task: unknown): string => String(task || '').toLowerCase();

export const resolveCompareToolkitPayload = (payload: unknown, maxUsers = 10): CompareToolkitPayload => {
  const record = isRecord(payload) ? payload : {};
  return {
    pointText: String(record.pointText || ''),
    type: record.type === 'disagreement' ? 'disagreement' : 'agreement',
    users: Array.isArray(record.users) ? record.users.slice(0, maxUsers) : [],
  };
};
