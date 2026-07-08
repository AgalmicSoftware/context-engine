type UnknownRecord = Record<string, unknown>;
type TokenRecord = Record<string, unknown>;

interface DedupedTaskMap {
  get(key: string): Promise<unknown> | undefined;
  set(key: string, value: Promise<unknown>): unknown;
  delete(key: string): unknown;
}

const isRecord = (value: unknown): value is UnknownRecord =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const asRecord = (value: unknown): UnknownRecord => (isRecord(value) ? value : {});

const asTokenRecord = (value: unknown): TokenRecord => ({ ...asRecord(value) });

export const runDedupedDecryptTask = (
  inFlightMap: DedupedTaskMap,
  taskKey: unknown,
  runner: unknown,
): Promise<unknown> => {
  const key = String(taskKey || '');
  if (!key || typeof runner !== 'function') {
    return Promise.resolve(false);
  }
  const existing = inFlightMap.get(key);
  if (existing) return existing;
  const task = Promise.resolve()
    .then(() => runner())
    .finally(() => {
      if (inFlightMap.get(key) === task) {
        inFlightMap.delete(key);
      }
    });
  inFlightMap.set(key, task);
  return task;
};

export const getQuestionFieldTaskKey = (questionId: unknown, fieldKey: unknown = 'answer'): string => {
  const qid = String(questionId || '')
    .trim()
    .toLowerCase();
  const normalizedFieldKey = String(fieldKey || 'answer')
    .trim()
    .toLowerCase();
  if (!qid) return '';
  return `${qid}:${normalizedFieldKey}`;
};

export const getQuestionFieldTaskKeys = (
  questionId: unknown,
  { includeAnswer = false, includeAdditional = false }: { includeAnswer?: boolean; includeAdditional?: boolean } = {},
): string[] => {
  const keys: string[] = [];
  if (includeAnswer) {
    const answerKey = getQuestionFieldTaskKey(questionId, 'answer');
    if (answerKey) keys.push(answerKey);
  }
  if (includeAdditional) {
    const additionalKey = getQuestionFieldTaskKey(questionId, 'additional');
    if (additionalKey) keys.push(additionalKey);
  }
  return keys;
};

export const markQuestionFieldBusyMap = (busyMap: unknown, keysToMark: unknown[] = []): UnknownRecord => {
  const next = { ...asRecord(busyMap) };
  keysToMark.forEach((key) => {
    if (key) next[String(key)] = true;
  });
  return next;
};

export const clearQuestionFieldBusyMap = (
  busyMap: unknown,
  questionId: unknown,
  fieldToDecrypt: unknown = 'both',
): UnknownRecord => {
  const cleared = { ...asRecord(busyMap) };
  const normalizedFieldToDecrypt = String(fieldToDecrypt || 'both');
  const keysToClear = getQuestionFieldTaskKeys(questionId, {
    includeAnswer: normalizedFieldToDecrypt === 'answer' || normalizedFieldToDecrypt === 'both',
    includeAdditional: normalizedFieldToDecrypt === 'additional' || normalizedFieldToDecrypt === 'both',
  });
  keysToClear.forEach((key) => {
    cleared[key] = false;
  });
  return cleared;
};

export const hasQuestionDecryptBusy = (busyMap: unknown = {}): boolean =>
  Object.values(asRecord(busyMap)).some(Boolean);

export const buildQuestionDecryptBusyTokenRegistration = ({
  tokenSeq = 0,
  busyTokens = {},
  keysToMark = [],
}: {
  tokenSeq?: unknown;
  busyTokens?: unknown;
  keysToMark?: unknown[];
} = {}) => {
  const token = (Number(tokenSeq) || 0) + 1;
  const nextBusyTokens = asTokenRecord(busyTokens);
  keysToMark.forEach((key) => {
    if (key) nextBusyTokens[String(key)] = token;
  });
  return {
    token,
    busyTokens: nextBusyTokens,
  };
};

export const buildClearedQuestionDecryptBusyTokens = ({
  busyTokens = {},
  keysToClear = [],
  token = null,
}: {
  busyTokens?: unknown;
  keysToClear?: unknown[];
  token?: unknown;
} = {}): TokenRecord => {
  const nextBusyTokens = asTokenRecord(busyTokens);
  keysToClear.forEach((key) => {
    if (!key) return;
    const normalizedKey = String(key);
    if (token == null || nextBusyTokens[normalizedKey] === token) {
      delete nextBusyTokens[normalizedKey];
    }
  });
  return nextBusyTokens;
};

export const ownsQuestionDecryptBusyTokens = ({
  busyTokens = {},
  keysToCheck = [],
  token = null,
}: {
  busyTokens?: unknown;
  keysToCheck?: unknown[];
  token?: unknown;
} = {}): boolean => {
  if (token == null) return true;
  const tokenRecord = asTokenRecord(busyTokens);
  const keys = keysToCheck.filter(Boolean).map(String);
  return keys.length > 0 && keys.every((key) => tokenRecord[key] === token);
};

export const buildQuestionDecryptOwnedClearState = ({
  prevState = null,
  questionId = '',
  fieldToDecrypt = 'both',
  token = null,
  busyTokens = {},
  activeSurveyDecryptAttemptSeq = 0,
  extraPatch = {},
}: {
  prevState?: unknown;
  questionId?: unknown;
  fieldToDecrypt?: unknown;
  token?: unknown;
  busyTokens?: unknown;
  activeSurveyDecryptAttemptSeq?: unknown;
  extraPatch?: UnknownRecord;
} = {}) => {
  const normalizedFieldToDecrypt = String(fieldToDecrypt || 'both');
  const tokenRecord = asTokenRecord(busyTokens);
  const keysToClear = getQuestionFieldTaskKeys(questionId, {
    includeAnswer: normalizedFieldToDecrypt === 'answer' || normalizedFieldToDecrypt === 'both',
    includeAdditional: normalizedFieldToDecrypt === 'additional' || normalizedFieldToDecrypt === 'both',
  }).filter((key) => key && token != null && tokenRecord[key] === token);

  const previousState = asRecord(prevState);
  const previousDecryptingByKey = previousState.decryptingByKey;

  if (keysToClear.length === 0) {
    return {
      busyTokens: { ...tokenRecord },
      statePatch:
        token == null
          ? {
              ...extraPatch,
              isDecrypting:
                Number(activeSurveyDecryptAttemptSeq || 0) > 0 || hasQuestionDecryptBusy(previousDecryptingByKey),
              decryptingByKey: previousDecryptingByKey || {},
            }
          : null,
    };
  }

  const decryptingByKey = { ...asRecord(previousDecryptingByKey) };
  keysToClear.forEach((key) => {
    decryptingByKey[key] = false;
  });

  return {
    busyTokens: buildClearedQuestionDecryptBusyTokens({
      busyTokens: tokenRecord,
      keysToClear,
      token,
    }),
    statePatch: {
      ...extraPatch,
      isDecrypting: Number(activeSurveyDecryptAttemptSeq || 0) > 0 || hasQuestionDecryptBusy(decryptingByKey),
      decryptingByKey,
    },
  };
};

export const getQuestionFieldDecryptSelection = (
  questionId: unknown,
  fieldToDecrypt: unknown = 'both',
  responseSlice: unknown = null,
) => {
  const qid = String(questionId || '')
    .trim()
    .toLowerCase();
  const normalizedFieldToDecrypt = String(fieldToDecrypt || 'both');
  const slice = asRecord(responseSlice);
  const answers = asRecord(slice.answers);
  const additionalComments = asRecord(slice.additionalComments);
  const answer = asRecord(answers[qid]);
  const additional = asRecord(additionalComments[qid]);
  const maskedAnswer = !!(
    (normalizedFieldToDecrypt === 'answer' || normalizedFieldToDecrypt === 'both') &&
    answer.value === '*' &&
    (answer.encryptedPortion || answer.encrypted)
  );

  const maskedAdditional = !!(
    (normalizedFieldToDecrypt === 'additional' || normalizedFieldToDecrypt === 'both') &&
    additional.value === '*' &&
    (additional.encryptedPortion || additional.encrypted)
  );

  return {
    maskedAnswer,
    maskedAdditional,
    hasMaskedField: !!(maskedAnswer || maskedAdditional),
    clearMode:
      maskedAnswer && maskedAdditional ? 'both' : maskedAnswer ? 'answer' : maskedAdditional ? 'additional' : '',
    keysToMark: getQuestionFieldTaskKeys(qid, {
      includeAnswer: maskedAnswer,
      includeAdditional: maskedAdditional,
    }),
  };
};

export const buildQuestionDecryptStartState = (prevState: unknown, keysToMark: unknown[] = []) => ({
  isDecrypting: true,
  submissionError: '',
  suppressPrefill: true,
  decryptingByKey: markQuestionFieldBusyMap(asRecord(prevState).decryptingByKey, keysToMark),
});

export const buildQuestionDecryptFailureState = (
  prevState: unknown,
  questionId: unknown,
  fieldToDecrypt: unknown = 'both',
  errorMessage: unknown = '',
) => ({
  isDecrypting: false,
  submissionError: errorMessage || 'Decryption failed.',
  decryptingByKey: clearQuestionFieldBusyMap(asRecord(prevState).decryptingByKey, questionId, fieldToDecrypt),
});
