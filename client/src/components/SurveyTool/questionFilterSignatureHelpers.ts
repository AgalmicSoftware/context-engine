export const toLowerId = (value: unknown): string =>
  String(value || '')
    .trim()
    .toLowerCase();

export const areQuestionListsEquivalentById = (a: unknown, b: unknown): boolean => {
  const aa = Array.isArray(a) ? a : [];
  const bb = Array.isArray(b) ? b : [];
  if (aa === bb) return true;
  if (aa.length !== bb.length) return false;
  for (let i = 0; i < aa.length; i += 1) {
    const left = aa[i] as { id?: unknown } | null | undefined;
    const right = bb[i] as { id?: unknown } | null | undefined;
    if (toLowerId(left?.id) !== toLowerId(right?.id)) return false;
    // Preserve updates when IDs stay stable but question objects are refreshed.
    if (aa[i] !== bb[i]) return false;
  }
  return true;
};

export const hashNormalizedString = (value: unknown = ''): string => {
  let hash = 2166136261;
  const input = String(value || '');
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
};

export const stableSerializeSmallObject = (value: unknown, maxLen: unknown = 4096): string => {
  const normalize = (input: unknown, seen: WeakSet<object> = new WeakSet()): unknown => {
    if (input == null || typeof input !== 'object') return input;
    if (seen.has(input)) return null;
    seen.add(input);
    if (Array.isArray(input)) {
      return input.map((item) => normalize(item, seen));
    }
    const out: Record<string, unknown> = {};
    Object.keys(input)
      .sort()
      .forEach((key) => {
        out[key] = normalize((input as Record<string, unknown>)[key], seen);
      });
    return out;
  };
  try {
    const normalized = normalize(value);
    const serialized = JSON.stringify(normalized);
    if (!serialized) return '';
    const limit = Number(maxLen);
    const safeLimit = Number.isFinite(limit) ? limit : 4096;
    if (serialized.length <= safeLimit) return serialized;
    return `__large:${serialized.length}:${hashNormalizedString(serialized)}`;
  } catch (_) {
    return '';
  }
};

export const buildQuestionIdListSignature = (questions: unknown = []): string =>
  stableSerializeSmallObject(Array.isArray(questions) ? questions : [], 65536);

export const buildFilteredResponsesByQuestionSignature = (responsesByQuestion: unknown = {}): string => {
  if (!responsesByQuestion || typeof responsesByQuestion !== 'object') return '';
  return stableSerializeSmallObject(responsesByQuestion, 65536);
};

export const buildFilterPayloadSignature = (payload: unknown): string => {
  if (Array.isArray(payload)) {
    return `arr:${buildQuestionIdListSignature(payload)}`;
  }
  if (payload && typeof payload === 'object') {
    const payloadRecord = payload as {
      filteredQuestions?: unknown;
      filteredResponsesByQuestion?: unknown;
    };
    if (Array.isArray(payloadRecord.filteredQuestions)) {
      const qSig = buildQuestionIdListSignature(payloadRecord.filteredQuestions);
      const rSig = buildFilteredResponsesByQuestionSignature(payloadRecord.filteredResponsesByQuestion || {});
      return `combo:${qSig}|${rSig}`;
    }
    return `obj:${stableSerializeSmallObject(payload, 2048)}`;
  }
  return `prim:${String(payload)}`;
};

export const normalizeNonceKey = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const buildAiCandidateSignature = (questions: unknown = []): string => {
  const input = Array.isArray(questions) ? questions : [];
  return stableSerializeSmallObject(
    input.map((question) => {
      const q = question as { id?: unknown; prompt?: unknown } | null | undefined;
      return {
        id: String(q?.id || '').toLowerCase(),
        prompt: String(q?.prompt || ''),
      };
    }),
    65536,
  );
};
