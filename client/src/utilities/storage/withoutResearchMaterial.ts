type UnknownRecord = Record<string, unknown>;
const isRecord = (value: unknown): value is UnknownRecord =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const strip = (item: unknown) => {
  if (!isRecord(item) || !('interviewProvenance' in item)) return item;
  const { interviewProvenance: _left, ...rest } = item;
  return rest;
};

/**
 * An answer upload without the agent mirror evaluation's material (interviewProvenance), for storage that is public
 * for good, such as Arweave: only the session's admins may read it, and only the Session Worker can hold it back.
 * Takes one answer or a survey bundle, as an object or its JSON text, and returns the same form.
 */
export const withoutResearchMaterial = <T>(payload: T): T => {
  const text = typeof payload === 'string';
  let parsed: unknown = payload;
  if (text) {
    try {
      parsed = JSON.parse(payload as string);
    } catch {
      return payload;
    }
  }
  if (!isRecord(parsed)) return payload;
  const next = Array.isArray(parsed.responses) ? { ...parsed, responses: parsed.responses.map(strip) } : strip(parsed);
  if (JSON.stringify(next) === JSON.stringify(parsed)) return payload;
  return (text ? JSON.stringify(next) : next) as T;
};
