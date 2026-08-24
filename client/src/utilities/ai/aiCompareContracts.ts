type UnknownRecord = Record<string, unknown>;

export type CompareVennRegionKey = 'a' | 'b' | 'c' | 'ab' | 'ac' | 'bc' | 'abc';

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

export interface CompareToolkitPayload {
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
  return {
    counts: { ...fallback.counts },
    semantics: (candidate.semantics as string | null | undefined) || fallback.semantics,
    evidenceMap: { ...fallback.evidenceMap },
  };
};

export const readCompareToolkitTask = (task: unknown): string => String(task || '').toLowerCase();

export const resolveCompareToolkitPayload = (payload: unknown, maxUsers = 10): CompareToolkitPayload => {
  const record = isRecord(payload) ? payload : {};
  return {
    users: Array.isArray(record.users) ? record.users.slice(0, maxUsers) : [],
  };
};
