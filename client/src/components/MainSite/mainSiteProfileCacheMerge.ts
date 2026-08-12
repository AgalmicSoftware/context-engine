type CacheRecord = Record<string, unknown>;
type ProfileRow = CacheRecord & {
  blockNumber?: unknown;
  bn?: unknown;
  id?: unknown;
  li?: unknown;
  logIndex?: unknown;
  questionID?: unknown;
  questionId?: unknown;
  responder?: unknown;
  sbtAddress?: unknown;
  surveyID?: unknown;
  surveyId?: unknown;
  timestamp?: unknown;
  ts?: unknown;
  transactionIndex?: unknown;
  txIndex?: unknown;
  txi?: unknown;
};

interface MergeProfileUserCacheOptions {
  chainEntry: CacheRecord;
  netKey: string;
  targetLower: string;
}

const isRecord = (value: unknown): value is CacheRecord =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const fallbackKey = (item: ProfileRow) => {
  try {
    return `__fallback__${JSON.stringify(item)}`;
  } catch (_) {
    return `__fallback__${String(item || '')}`;
  }
};

const compareRecency = (incoming: ProfileRow, existing: ProfileRow) => {
  const values = (row: ProfileRow) => [
    Number(row.blockNumber ?? row.bn ?? 0) || 0,
    Number(row.transactionIndex ?? row.txIndex ?? row.txi ?? 0) || 0,
    Number(row.logIndex ?? row.li ?? 0) || 0,
    Number(row.timestamp ?? row.ts ?? 0) || 0,
  ];
  const incomingValues = values(incoming);
  const existingValues = values(existing);
  for (let index = 0; index < incomingValues.length; index += 1) {
    if (incomingValues[index] !== existingValues[index]) return incomingValues[index] - existingValues[index];
  }
  return 0;
};

export const mergeMainSiteProfileRows = <TRow extends ProfileRow>(
  currentRows: TRow[] = [],
  incomingRows: TRow[] = [],
  keyFor: (item: TRow) => string,
  preferNewerByRecency = false,
): TRow[] => {
  const rows = new Map<string, TRow>();
  currentRows.forEach((item) => rows.set(keyFor(item) || fallbackKey(item), item));
  incomingRows.forEach((item) => {
    const key = keyFor(item) || fallbackKey(item);
    const existing = rows.get(key);
    if (!existing || !preferNewerByRecency || compareRecency(item, existing) >= 0) rows.set(key, item);
  });
  return Array.from(rows.values());
};

export const buildMainSiteProfileSurveyResponseKey = (item: ProfileRow) => {
  const surveyId = String(item.surveyId || item.surveyID || item.id || '').trim().toLowerCase();
  const responder = String(item.responder || '').trim().toLowerCase();
  return surveyId && responder ? `${surveyId}|${responder}` : '';
};

export const buildMainSiteProfileQuestionResponseKey = (item: ProfileRow) => {
  const questionId = String(item.questionId || item.questionID || item.id || '').trim().toLowerCase();
  const responder = String(item.responder || '').trim().toLowerCase();
  return questionId && responder ? `${questionId}|${responder}` : '';
};

export const mergeMainSiteProfileUserCache = (
  currentIn: CacheRecord | null,
  { chainEntry, netKey, targetLower }: MergeProfileUserCacheOptions,
): CacheRecord => {
  const next = isRecord(currentIn) ? { ...currentIn } : {};
  const currentUser = isRecord(next[targetLower]) ? next[targetLower] : {};
  const currentChain = isRecord(currentUser[netKey]) ? currentUser[netKey] : {};
  const currentData = isRecord(currentChain.data) ? currentChain.data : {};
  const incomingData = isRecord(chainEntry.data) ? chainEntry.data : {};
  const rows = (value: unknown): ProfileRow[] => (Array.isArray(value) ? (value as ProfileRow[]) : []);
  const maxField = (field: string) => Math.max(Number(currentChain[field]) || 0, Number(chainEntry[field]) || 0);

  const data = {
    ...currentData,
    ...incomingData,
    sbts: mergeMainSiteProfileRows(rows(currentData.sbts), rows(incomingData.sbts), (row) =>
      String(row.sbtAddress || JSON.stringify(row)).toLowerCase(),
    ),
    createdSurveys: mergeMainSiteProfileRows(rows(currentData.createdSurveys), rows(incomingData.createdSurveys), (row) =>
      String(row.id || JSON.stringify(row)),
    ),
    createdQuestions: mergeMainSiteProfileRows(
      rows(currentData.createdQuestions),
      rows(incomingData.createdQuestions),
      (row) => String(row.id || JSON.stringify(row)),
    ),
    surveyResponses: mergeMainSiteProfileRows(
      rows(currentData.surveyResponses),
      rows(incomingData.surveyResponses),
      buildMainSiteProfileSurveyResponseKey,
      true,
    ),
    questionResponses: mergeMainSiteProfileRows(
      rows(currentData.questionResponses),
      rows(incomingData.questionResponses),
      buildMainSiteProfileQuestionResponseKey,
      true,
    ),
  };

  next[targetLower] = {
    ...currentUser,
    [netKey]: {
      ...currentChain,
      ...chainEntry,
      lastBlockScanned: maxField('lastBlockScanned'),
      lastScanTimestamp: maxField('lastScanTimestamp'),
      surveyActivityLastBlockScanned: maxField('surveyActivityLastBlockScanned'),
      questionActivityLastBlockScanned: maxField('questionActivityLastBlockScanned'),
      sbtLastBlockScanned: maxField('sbtLastBlockScanned'),
      data,
    },
  };
  return next;
};
