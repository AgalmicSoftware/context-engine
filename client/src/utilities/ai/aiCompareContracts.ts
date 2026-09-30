type UnknownRecord = Record<string, unknown>;

export interface CompareBullets {
  agreements: string[];
  disagreements: string[];
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

export const readCompareToolkitTask = (task: unknown): string => String(task || '').toLowerCase();

export const resolveCompareToolkitPayload = (payload: unknown, maxUsers = 10): CompareToolkitPayload => {
  const record = isRecord(payload) ? payload : {};
  return {
    users: Array.isArray(record.users) ? record.users.slice(0, maxUsers) : [],
  };
};
