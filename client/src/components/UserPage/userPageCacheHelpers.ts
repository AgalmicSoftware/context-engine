import { isPlainAnalysisObject, toAnalysisRecord, type UserPageUnknownRecord } from './userPageCoreHelpers';
import {
  compareUserPageResponseRecency,
  extractUserPageResponseRecencyWithHints,
  type UserPageResponseBucketMap,
  type UserPageResponseRecencyBucketMap,
} from './userPageResponseHelpers';

export type UserPageCacheNetworkBucket = UserPageUnknownRecord & {
  surveys?: unknown;
  surveyResponses?: unknown;
  questions?: unknown;
  questionResponses?: unknown;
  questionResponsesMeta?: unknown;
  sbtList?: unknown;
};
type UserPageCacheNetworkMergeKey =
  'surveys' | 'surveyResponses' | 'questions' | 'questionResponses' | 'questionResponsesMeta';

const USER_PAGE_CACHE_NETWORK_MERGE_KEYS: UserPageCacheNetworkMergeKey[] = [
  'surveys',
  'surveyResponses',
  'questions',
  'questionResponses',
  'questionResponsesMeta',
];
export type UserPagePrioritizedCacheNode = {
  key: string;
  value: UserPageCacheNetworkBucket;
};
export type UserPageUserChainNode = UserPageUnknownRecord & {
  data?: unknown;
};
export type UserPagePrioritizedUserChainNode = {
  chainKey: string;
  node: UserPageUserChainNode;
};
export type UserPageOwnershipCountMaps = {
  mintedCountMap: UserPageUnknownRecord | null;
  burnedCountMap: UserPageUnknownRecord | null;
};
export type UserPageOwnershipSignalAggregate = {
  mintedSet: Set<string>;
  burnedSet: Set<string>;
};
export type UserPageSbtAggregateEntry = UserPageUnknownRecord &
  UserPageOwnershipSignalAggregate & {
    blockNumber?: number;
    sbtAddress?: unknown;
    sbtInfo?: unknown;
    slug?: unknown;
    viewerCountsAuthoritative?: boolean;
  };
export type UserPageSbtAggregateMap = Record<string, UserPageSbtAggregateEntry | undefined>;
export type UserPageSourceSlugMap = Record<string, string>;
export type UserPageSourceSlugWriteOptions = {
  replace?: unknown;
};
export type UpsertUserPageResponseByRecencyArgs = {
  id?: unknown;
  responder?: unknown;
  responseRecencyMeta: UserPageResponseRecencyBucketMap;
  responses: UserPageResponseBucketMap;
  responseSourceSlugByKey: UserPageSourceSlugMap;
  responseValue?: unknown;
  sourceSlugById: UserPageSourceSlugMap;
  metaValue?: unknown;
  slug?: unknown;
};
export type MergeUserPageSurveyCacheSourceArgs = {
  cacheObj?: unknown;
  combinedSurveyResponses: UserPageResponseBucketMap;
  combinedSurveyResponsesMeta: UserPageResponseRecencyBucketMap;
  combinedSurveys: UserPageUnknownRecord;
  networkID?: unknown;
  slug?: unknown;
  surveyResponseSourceSlugById: UserPageSourceSlugMap;
  surveyResponseSourceSlugByKey: UserPageSourceSlugMap;
  surveySourceSlugById: UserPageSourceSlugMap;
};
export type MergeUserPageQuestionCacheSourceArgs = {
  cacheObj?: unknown;
  combinedQuestionResponses: UserPageResponseBucketMap;
  combinedQuestionResponsesMeta: UserPageResponseRecencyBucketMap;
  combinedQuestions: UserPageUnknownRecord;
  networkID?: unknown;
  questionResponseSourceSlugById: UserPageSourceSlugMap;
  questionResponseSourceSlugByKey: UserPageSourceSlugMap;
  questionSourceSlugById: UserPageSourceSlugMap;
  slug?: unknown;
};
export type UserPageUserCachePayload = UserPageUnknownRecord & {
  sbts?: unknown;
  createdSurveys?: unknown;
  createdQuestions?: unknown;
  surveyResponses?: unknown;
  questionResponses?: unknown;
};
type MergeUserPageSbtCacheEntryIntoAggregateArgs = {
  entry?: unknown;
  key?: unknown;
  sbtAggregate: UserPageSbtAggregateMap;
  slug?: unknown;
  viewAddressKey?: unknown;
};
type MergeUserPageUserCacheSbtIntoAggregateArgs = {
  item?: unknown;
  sbtAggregate: UserPageSbtAggregateMap;
  slug?: unknown;
  viewAddressKey?: unknown;
};

const normalizeUserPageCacheSourceSlug = (slug: unknown): string => {
  const raw = String(slug || '')
    .trim()
    .toLowerCase();
  return raw === 'general' ? '' : raw;
};

export const getUserPageOwnershipCountMaps = (entry: unknown = {}): UserPageOwnershipCountMaps => {
  const entryRecord = toAnalysisRecord(entry);
  const mintedCountMap = isPlainAnalysisObject(entryRecord.mintedCountByAddress)
    ? entryRecord.mintedCountByAddress
    : null;
  const burnedCountMap = isPlainAnalysisObject(entryRecord.burnedCountByAddress)
    ? entryRecord.burnedCountByAddress
    : null;
  return { mintedCountMap, burnedCountMap };
};

export const hasMeaningfulUserPageOwnershipCounts = (entry: unknown = {}, addressLower: unknown = ''): boolean => {
  const entryRecord = toAnalysisRecord(entry);
  const { mintedCountMap, burnedCountMap } = getUserPageOwnershipCountMaps(entry);
  if (!mintedCountMap && !burnedCountMap) return false;
  if (entryRecord.countsLoaded === true) return true;
  const normalizedAddress = String(addressLower || '').toLowerCase();
  if (!normalizedAddress) return false;
  return (
    Object.prototype.hasOwnProperty.call(mintedCountMap || {}, normalizedAddress) ||
    Object.prototype.hasOwnProperty.call(burnedCountMap || {}, normalizedAddress)
  );
};

export const readUserPageOwnershipCount = (countMap: UserPageUnknownRecord | null, addressLower: unknown): number =>
  countMap ? Math.max(0, Number(countMap[String(addressLower || '').toLowerCase()] || 0) || 0) : 0;

export const applyUserPageOwnershipSignal = (
  aggEntry: UserPageOwnershipSignalAggregate,
  entry: unknown,
  addressLower: unknown,
): void => {
  const addressKey = String(addressLower || '').toLowerCase();
  if (!addressKey) return;
  const { mintedCountMap, burnedCountMap } = getUserPageOwnershipCountMaps(entry);
  if (!mintedCountMap && !burnedCountMap) return;
  if (!hasMeaningfulUserPageOwnershipCounts(entry, addressKey)) return;

  const mintedCount = readUserPageOwnershipCount(mintedCountMap, addressKey);
  const burnedCount = readUserPageOwnershipCount(burnedCountMap, addressKey);
  // Regression guard: count maps decide the viewer's current ownership;
  // raw address sets remain bulk history for non-viewer aggregation.
  if (mintedCount > burnedCount) {
    aggEntry.mintedSet.add(addressKey);
    aggEntry.burnedSet.delete(addressKey);
  } else if (burnedCount > 0) {
    aggEntry.burnedSet.add(addressKey);
  }
};

const buildDefaultUserPageSbtAggregateEntry = (
  entry: UserPageUnknownRecord,
  key: string,
  slug: unknown,
): UserPageSbtAggregateEntry => ({
  sbtAddress: entry.sbtAddress || key,
  sbtInfo: null,
  mintedSet: new Set(),
  burnedSet: new Set(),
  viewerCountsAuthoritative: false,
  blockNumber: 0,
  slug: slug || '',
});

const applyUserPageSbtAggregateMetadata = (
  aggEntry: UserPageSbtAggregateEntry,
  entry: UserPageUnknownRecord,
  slug: unknown,
): void => {
  if (slug && !aggEntry.slug) aggEntry.slug = slug;
  if (!aggEntry.sbtInfo && entry.sbtInfo) aggEntry.sbtInfo = entry.sbtInfo;
  if (aggEntry.sbtInfo && entry.sbtInfo) {
    aggEntry.sbtInfo = {
      ...(aggEntry.sbtInfo as UserPageUnknownRecord),
      ...(entry.sbtInfo as UserPageUnknownRecord),
    };
  }
};

export const mergeUserPageSbtCacheEntryIntoAggregate = ({
  entry: entryIn = {},
  key: keyIn = '',
  sbtAggregate,
  slug = '',
  viewAddressKey = '',
}: MergeUserPageSbtCacheEntryIntoAggregateArgs): UserPageSbtAggregateEntry | null => {
  const entry = toAnalysisRecord(entryIn);
  const key = String(keyIn || entry.sbtAddress || '').toLowerCase();
  if (!key) return null;
  const addressKey = String(viewAddressKey || '').toLowerCase();
  const aggEntry = sbtAggregate[key] || buildDefaultUserPageSbtAggregateEntry(entry, key, slug);

  applyUserPageSbtAggregateMetadata(aggEntry, entry, slug);
  const hasExplicitCounts = hasMeaningfulUserPageOwnershipCounts(entry, addressKey);
  if (hasExplicitCounts) {
    aggEntry.mintedSet.delete(addressKey);
    aggEntry.burnedSet.delete(addressKey);
    aggEntry.viewerCountsAuthoritative = true;
  }
  (Array.isArray(entry.mintedAddresses) ? entry.mintedAddresses : []).forEach((address: unknown) => {
    const addressLower = String(address || '').toLowerCase();
    if (!addressLower) return;
    if ((hasExplicitCounts || aggEntry.viewerCountsAuthoritative) && addressLower === addressKey) return;
    aggEntry.mintedSet.add(addressLower);
  });
  (Array.isArray(entry.burnedAddresses) ? entry.burnedAddresses : []).forEach((address: unknown) => {
    const addressLower = String(address || '').toLowerCase();
    if (!addressLower) return;
    if ((hasExplicitCounts || aggEntry.viewerCountsAuthoritative) && addressLower === addressKey) return;
    aggEntry.burnedSet.add(addressLower);
  });
  applyUserPageOwnershipSignal(aggEntry, entry, addressKey);
  aggEntry.blockNumber = Math.max(aggEntry.blockNumber || 0, Number(entry.blockNumber || 0));
  if (entry.sbtAddress) aggEntry.sbtAddress = entry.sbtAddress;
  sbtAggregate[key] = aggEntry;
  return aggEntry;
};

export const mergeUserPageUserCacheSbtIntoAggregate = ({
  item: itemIn = {},
  sbtAggregate,
  slug = '',
  viewAddressKey = '',
}: MergeUserPageUserCacheSbtIntoAggregateArgs): UserPageSbtAggregateEntry | null => {
  const itemRecord = toAnalysisRecord(itemIn);
  const key = String(itemRecord.sbtAddress || '').toLowerCase();
  if (!key) return null;
  const addressKey = String(viewAddressKey || '').toLowerCase();
  const aggEntry = sbtAggregate[key] || buildDefaultUserPageSbtAggregateEntry(itemRecord, key, slug);

  applyUserPageSbtAggregateMetadata(aggEntry, itemRecord, slug);
  const hasAggregateOwnershipSignal = aggEntry.mintedSet.has(addressKey) || aggEntry.burnedSet.has(addressKey);
  const hasExplicitCounts = hasMeaningfulUserPageOwnershipCounts(itemRecord, addressKey);
  if (hasExplicitCounts) {
    applyUserPageOwnershipSignal(aggEntry, itemRecord, addressKey);
  } else if (!hasAggregateOwnershipSignal) {
    // Regression guard: userCache rows are fallback ownership hints; they must
    // not re-mint a viewer already burned by the fresher sbtCache aggregate.
    aggEntry.mintedSet.add(addressKey);
  }
  sbtAggregate[key] = aggEntry;
  return aggEntry;
};

export const writeUserPageSourceSlug = (
  target: UserPageSourceSlugMap,
  id: unknown,
  slug: unknown,
  opts: UserPageSourceSlugWriteOptions = {},
): void => {
  const key = String(id || '').toLowerCase();
  if (!key) return;
  const replace = !!(opts && opts.replace);
  if (!replace && Object.prototype.hasOwnProperty.call(target, key)) return;
  target[key] = normalizeUserPageCacheSourceSlug(slug || '');
};

export const writeUserPageResponseSourceSlug = (
  target: UserPageSourceSlugMap,
  id: unknown,
  responder: unknown,
  slug: unknown,
  opts: UserPageSourceSlugWriteOptions = {},
): void => {
  const idKey = String(id || '')
    .trim()
    .toLowerCase();
  const responderKey = String(responder || '')
    .trim()
    .toLowerCase();
  if (!idKey || !responderKey) return;
  const responseKey = `${idKey}|${responderKey}`;
  const replace = !!(opts && opts.replace);
  if (!replace && Object.prototype.hasOwnProperty.call(target, responseKey)) return;
  target[responseKey] = normalizeUserPageCacheSourceSlug(slug || '');
};

export const upsertUserPageResponseByRecency = ({
  id,
  responder,
  responseRecencyMeta,
  responses,
  responseSourceSlugByKey,
  responseValue,
  sourceSlugById,
  metaValue = null,
  slug = '',
}: UpsertUserPageResponseByRecencyArgs): void => {
  const idLower = String(id || '')
    .trim()
    .toLowerCase();
  const responderLower = String(responder || '')
    .trim()
    .toLowerCase();
  if (!idLower || !responderLower || responseValue == null) return;
  if (!responses[idLower]) responses[idLower] = {};
  if (!responseRecencyMeta[idLower]) responseRecencyMeta[idLower] = {};
  const existingResponse = responses[idLower][responderLower];
  const existingRecency = extractUserPageResponseRecencyWithHints(
    existingResponse,
    responseRecencyMeta[idLower][responderLower],
  );
  const incomingRecency = extractUserPageResponseRecencyWithHints(responseValue, metaValue);
  const hasExisting = Object.prototype.hasOwnProperty.call(responses[idLower], responderLower);
  let shouldReplace = !hasExisting;
  if (!shouldReplace) {
    const cmp = compareUserPageResponseRecency(incomingRecency, existingRecency);
    shouldReplace = cmp > 0 || (cmp === 0 && incomingRecency.hasHints && !existingRecency.hasHints);
  }
  if (!shouldReplace) return;
  responses[idLower][responderLower] = responseValue;
  responseRecencyMeta[idLower][responderLower] = incomingRecency;
  writeUserPageSourceSlug(sourceSlugById, idLower, slug, { replace: true });
  writeUserPageResponseSourceSlug(responseSourceSlugByKey, idLower, responderLower, slug, { replace: true });
};

export const mergeUserPageSurveyCacheSource = ({
  cacheObj,
  combinedSurveyResponses,
  combinedSurveyResponsesMeta,
  combinedSurveys,
  networkID,
  slug = '',
  surveyResponseSourceSlugById,
  surveyResponseSourceSlugByKey,
  surveySourceSlugById,
}: MergeUserPageSurveyCacheSourceArgs): void => {
  const netObj = readUserPageNetworkCache(cacheObj, networkID);
  const surveysMap = toAnalysisRecord(netObj.surveys);
  Object.keys(surveysMap).forEach((sidRaw: string) => {
    const sid = String(sidRaw || '').toLowerCase();
    if (!sid) return;
    if (!combinedSurveys[sid]) {
      combinedSurveys[sid] = toAnalysisRecord(surveysMap[sidRaw] || surveysMap[sid]);
    }
    writeUserPageSourceSlug(surveySourceSlugById, sid, slug);
  });

  const responseMap = toAnalysisRecord(netObj.surveyResponses);
  Object.keys(responseMap).forEach((sidRaw: string) => {
    const sid = String(sidRaw || '').toLowerCase();
    if (!sid) return;
    const perSurvey = toAnalysisRecord(responseMap[sidRaw] || responseMap[sid]);
    Object.keys(perSurvey).forEach((resAddrRaw: string) => {
      const responder = String(resAddrRaw || '').toLowerCase();
      if (!responder) return;
      const responseValue = Object.prototype.hasOwnProperty.call(perSurvey, resAddrRaw)
        ? perSurvey[resAddrRaw]
        : perSurvey[responder];
      const responseMeta = responseValue && typeof responseValue === 'object' ? responseValue : null;
      upsertUserPageResponseByRecency({
        id: sid,
        responder,
        responseRecencyMeta: combinedSurveyResponsesMeta,
        responses: combinedSurveyResponses,
        responseSourceSlugByKey: surveyResponseSourceSlugByKey,
        responseValue,
        sourceSlugById: surveyResponseSourceSlugById,
        metaValue: responseMeta,
        slug,
      });
    });
  });
};

export const mergeUserPageQuestionCacheSource = ({
  cacheObj,
  combinedQuestionResponses,
  combinedQuestionResponsesMeta,
  combinedQuestions,
  networkID,
  questionResponseSourceSlugById,
  questionResponseSourceSlugByKey,
  questionSourceSlugById,
  slug = '',
}: MergeUserPageQuestionCacheSourceArgs): void => {
  const netObj = readUserPageNetworkCache(cacheObj, networkID);
  const questionsMap = toAnalysisRecord(netObj.questions);
  Object.keys(questionsMap).forEach((qidRaw: string) => {
    const qid = String(qidRaw || '').toLowerCase();
    if (!qid) return;
    if (!combinedQuestions[qid]) {
      combinedQuestions[qid] = toAnalysisRecord(questionsMap[qidRaw] || questionsMap[qid]);
    }
    writeUserPageSourceSlug(questionSourceSlugById, qid, slug);
  });

  const responseMap = toAnalysisRecord(netObj.questionResponses);
  const responseMetaMap = toAnalysisRecord(netObj.questionResponsesMeta);
  Object.keys(responseMap).forEach((qidRaw: string) => {
    const qid = String(qidRaw || '').toLowerCase();
    if (!qid) return;
    const perQuestion = toAnalysisRecord(responseMap[qidRaw] || responseMap[qid]);
    const perQuestionMeta = isPlainAnalysisObject(responseMetaMap[qidRaw])
      ? responseMetaMap[qidRaw]
      : isPlainAnalysisObject(responseMetaMap[qid])
        ? responseMetaMap[qid]
        : {};
    Object.keys(perQuestion).forEach((resAddrRaw: string) => {
      const responder = String(resAddrRaw || '').toLowerCase();
      if (!responder) return;
      const responseValue = Object.prototype.hasOwnProperty.call(perQuestion, resAddrRaw)
        ? perQuestion[resAddrRaw]
        : perQuestion[responder];
      const responseMeta = perQuestionMeta[resAddrRaw] ?? perQuestionMeta[responder] ?? null;
      upsertUserPageResponseByRecency({
        id: qid,
        responder,
        responseRecencyMeta: combinedQuestionResponsesMeta,
        responses: combinedQuestionResponses,
        responseSourceSlugByKey: questionResponseSourceSlugByKey,
        responseValue,
        sourceSlugById: questionResponseSourceSlugById,
        metaValue: responseMeta,
        slug,
      });
    });
  });
};

export const readUserPageNetworkCache = (cacheObj: unknown, networkID: unknown): UserPageCacheNetworkBucket => {
  if (!isPlainAnalysisObject(cacheObj)) return {};
  const mergeBucket = (target: UserPageCacheNetworkBucket, bucket: unknown): void => {
    if (!isPlainAnalysisObject(bucket)) return;
    USER_PAGE_CACHE_NETWORK_MERGE_KEYS.forEach((key) => {
      const value = bucket[key];
      if (!isPlainAnalysisObject(value)) return;
      target[key] = {
        ...toAnalysisRecord(target[key]),
        ...value,
      };
    });
  };

  const merged: UserPageCacheNetworkBucket = {};
  Object.keys(cacheObj).forEach((key: string) => {
    mergeBucket(merged, cacheObj[key]);
  });
  if (networkID) {
    mergeBucket(merged, cacheObj[String(networkID)]);
  }
  return merged;
};

export const getPrioritizedUserPageNetworkCacheNodes = (
  cacheObj: unknown,
  networkID: unknown,
): UserPagePrioritizedCacheNode[] => {
  if (!isPlainAnalysisObject(cacheObj)) return [];
  const out: UserPagePrioritizedCacheNode[] = [];
  const seen = new Set<string>();
  const push = (keyRaw: unknown): void => {
    const key = String(keyRaw || '');
    if (!key || seen.has(key)) return;
    seen.add(key);
    const value = cacheObj[key];
    if (!isPlainAnalysisObject(value)) return;
    out.push({ key, value });
  };

  if (networkID) {
    push(networkID);
  }
  Object.keys(cacheObj).forEach(push);
  return out;
};

export const getPrioritizedUserPageChainNodes = (
  userNode: unknown,
  networkID: unknown,
): UserPagePrioritizedUserChainNode[] => {
  if (!isPlainAnalysisObject(userNode)) return [];
  const out: UserPagePrioritizedUserChainNode[] = [];
  const seen = new Set<string>();
  const push = (keyRaw: unknown): void => {
    const key = String(keyRaw || '');
    if (!key || seen.has(key)) return;
    seen.add(key);
    const node = userNode[key];
    if (!isPlainAnalysisObject(node)) return;
    out.push({ chainKey: key, node });
  };

  if (networkID) {
    push(networkID);
  }
  Object.keys(userNode).forEach(push);
  return out;
};

export const getActiveUserPageChainNode = (userNode: unknown, networkID: unknown): UserPageUserChainNode | null => {
  if (!isPlainAnalysisObject(userNode)) return null;
  const mergedData = getPrioritizedUserPageChainNodes(userNode, networkID).reduce<UserPageUserCachePayload>(
    (acc, { node }) => {
      if (!isPlainAnalysisObject(node.data)) return acc;
      const data = node.data as UserPageUserCachePayload;
      return {
        sbts: [...(Array.isArray(acc.sbts) ? acc.sbts : []), ...(Array.isArray(data.sbts) ? data.sbts : [])],
        createdSurveys: [
          ...(Array.isArray(acc.createdSurveys) ? acc.createdSurveys : []),
          ...(Array.isArray(data.createdSurveys) ? data.createdSurveys : []),
        ],
        createdQuestions: [
          ...(Array.isArray(acc.createdQuestions) ? acc.createdQuestions : []),
          ...(Array.isArray(data.createdQuestions) ? data.createdQuestions : []),
        ],
        surveyResponses: [
          ...(Array.isArray(acc.surveyResponses) ? acc.surveyResponses : []),
          ...(Array.isArray(data.surveyResponses) ? data.surveyResponses : []),
        ],
        questionResponses: [
          ...(Array.isArray(acc.questionResponses) ? acc.questionResponses : []),
          ...(Array.isArray(data.questionResponses) ? data.questionResponses : []),
        ],
      };
    },
    {},
  );
  if (Object.keys(mergedData).length === 0) return null;
  return { data: mergedData };
};
