import { isPlainAnalysisObject, toAnalysisRecord, type UserPageUnknownRecord } from './userPageCoreHelpers';
import {
  extractUserPageAnalysisAdditionalComment,
  extractUserPageAnalysisImportance,
} from './userPageAnalysisStateHelpers';

type UserPageSbtDisplayNameReader = (sbtInfo: unknown) => unknown;

export type BuildUserPageAnalysisSbtsArgs = {
  getSbtDisplayName?: UserPageSbtDisplayNameReader | null;
  sbtList?: unknown;
};

type UserPageShortAddressReader = (address: unknown, compact?: boolean) => unknown;
type UserPageTranslateReader = (key: string) => unknown;

export type BuildUserPageSbtSectionArgs = {
  aggregate?: unknown;
  getSbtDisplayName?: UserPageSbtDisplayNameReader | null;
  getShortenedAddress?: UserPageShortAddressReader | null;
  translate?: UserPageTranslateReader | null;
  viewAddressLower?: unknown;
};

export type BuildUserPageAnalysisQuestionsArgs = {
  detailedQuestionResponses?: unknown;
  questionResponseInfo?: unknown;
};

export type BuildUserPageAnalysisSurveysArgs = {
  detailedSurveyResponses?: unknown;
  surveyResponseInfo?: unknown;
};

export type BuildUserPageAnalysisCreatedSurveysArgs = {
  networkID?: unknown;
  questionsCache?: unknown;
  surveyCreationInfo?: unknown;
  surveysCache?: unknown;
};

type UserPageAnalysisQuestionRecord = UserPageUnknownRecord & {
  id?: unknown;
  prompt?: unknown;
  type?: unknown;
};

type UserPageAnalysisSbtEntry = UserPageUnknownRecord & {
  name?: unknown;
  sbtInfo?: UserPageUnknownRecord & {
    sbtAddress?: unknown;
  };
};

type UserPageDerivedSbtListItem = {
  sbtInfo: UserPageUnknownRecord;
  slug?: unknown;
};

export type UserPageSbtSectionResult = {
  badgesReceived: number;
  sbtList: UserPageDerivedSbtListItem[];
  telemetry: {
    signature: string;
    payload: UserPageUnknownRecord;
  } | null;
};

type UserPageAnalysisSurveyRecord = UserPageUnknownRecord & {
  id?: unknown;
  questionsCount?: unknown;
  title?: unknown;
};

type UserPageAnalysisSurveyResponseItem = UserPageUnknownRecord & {
  questionData?: unknown;
  responseData?: unknown;
};

export const isUserPageSbtAggregateEntry = (value: unknown): boolean => {
  const record = toAnalysisRecord(value);
  return record.mintedSet instanceof Set && record.burnedSet instanceof Set;
};

export const buildUserPageAnalysisCreatedQuestions = (questionCreationInfo: unknown = []): UserPageUnknownRecord[] =>
  (Array.isArray(questionCreationInfo) ? (questionCreationInfo as UserPageAnalysisQuestionRecord[]) : []).map((q) => ({
    id: q.id,
    type: q.type,
    prompt: q.prompt,
  }));

export const buildUserPageAnalysisSbts = ({
  getSbtDisplayName = null,
  sbtList = [],
}: BuildUserPageAnalysisSbtsArgs = {}): UserPageUnknownRecord[] =>
  (Array.isArray(sbtList) ? sbtList : [])
    .map((item: UserPageAnalysisSbtEntry) => ({
      name: (typeof getSbtDisplayName === 'function' ? getSbtDisplayName(item?.sbtInfo) : '') || item?.name || '',
      address: item?.sbtInfo?.sbtAddress,
    }))
    .filter((s: UserPageUnknownRecord) => s && s.name && s.address);

export const buildUserPageSbtSection = ({
  aggregate = null,
  getSbtDisplayName = null,
  getShortenedAddress = null,
  translate = null,
  viewAddressLower = '',
}: BuildUserPageSbtSectionArgs = {}): UserPageSbtSectionResult => {
  const userSBTs: UserPageDerivedSbtListItem[] = [];
  const viewAddressKey = String(viewAddressLower || '').toLowerCase();
  const sbtAggregate = toAnalysisRecord(toAnalysisRecord(aggregate).sbtAggregate);
  const aggregateKeys = Object.keys(sbtAggregate);
  const translateSbt = (): unknown => (typeof translate === 'function' ? translate('sbt') : 'SBT');

  aggregateKeys.forEach((key: string) => {
    const entryRecord = toAnalysisRecord(sbtAggregate[key]);
    if (!isUserPageSbtAggregateEntry(entryRecord)) return;
    const sbtInfo = isPlainAnalysisObject(entryRecord.sbtInfo) ? entryRecord.sbtInfo : {};
    if (sbtInfo.unlisted === true) return;
    const mintedSet = entryRecord.mintedSet as Set<string>;
    const burnedSet = entryRecord.burnedSet as Set<string>;
    if (mintedSet.has(viewAddressKey) && !burnedSet.has(viewAddressKey)) {
      const sbtAddress = String(entryRecord.sbtAddress || key || sbtInfo.sbtAddress || '');
      const preferredName = String(
        (typeof getSbtDisplayName === 'function' ? getSbtDisplayName(sbtInfo) : '') || '',
      ).trim();
      const shortenedAddress =
        sbtAddress && sbtAddress.length > 10
          ? typeof getShortenedAddress === 'function'
            ? getShortenedAddress(sbtAddress, false)
            : sbtAddress
          : sbtAddress;
      const fallbackName = shortenedAddress ? `${translateSbt()} ${shortenedAddress}` : translateSbt();
      userSBTs.push({
        sbtInfo: {
          ...sbtInfo,
          name: preferredName || fallbackName,
          sbtAddress: sbtAddress || key,
        },
        slug: entryRecord.slug,
      });
    }
  });

  if (!aggregateKeys.length) {
    return {
      sbtList: userSBTs,
      badgesReceived: userSBTs.length,
      telemetry: null,
    };
  }

  const heldCandidateCount = aggregateKeys.filter((key: string) => {
    const entryRecord = toAnalysisRecord(sbtAggregate[key]);
    if (!isUserPageSbtAggregateEntry(entryRecord)) return false;
    const mintedSet = entryRecord.mintedSet as Set<string>;
    const burnedSet = entryRecord.burnedSet as Set<string>;
    return mintedSet.has(viewAddressKey) && !burnedSet.has(viewAddressKey);
  }).length;
  const signature = [
    viewAddressKey,
    String(aggregateKeys.length),
    String(heldCandidateCount),
    String(userSBTs.length),
  ].join('|');

  return {
    sbtList: userSBTs,
    badgesReceived: userSBTs.length,
    telemetry: {
      signature,
      payload: {
        viewAddress: viewAddressKey,
        aggregateSbtAddresses: aggregateKeys.length,
        heldAggregateSbtCount: heldCandidateCount,
        derivedSbtCount: userSBTs.length,
        derivedSbtSample: userSBTs
          .map((item) => String(item.sbtInfo.sbtAddress || '').toLowerCase())
          .filter(Boolean)
          .slice(0, 12),
      },
    },
  };
};

export const buildUserPageAnalysisQuestions = ({
  detailedQuestionResponses = {},
  questionResponseInfo = [],
}: BuildUserPageAnalysisQuestionsArgs = {}): UserPageUnknownRecord[] =>
  (Array.isArray(questionResponseInfo) ? questionResponseInfo : [])
    .map((q: UserPageAnalysisQuestionRecord) => {
      const resp =
        (detailedQuestionResponses as Record<string, UserPageUnknownRecord> | null | undefined)?.[q.id as string] || {};
      const ans = toAnalysisRecord(resp.answer).value;
      if (ans === '*' || ans === '' || ans == null) return null;
      return {
        id: q.id,
        type: q.type,
        prompt: q.prompt,
        answer: Array.isArray(ans) ? ans : ans,
        importance: extractUserPageAnalysisImportance(resp),
        additionalComment: extractUserPageAnalysisAdditionalComment(resp) || undefined,
      };
    })
    .filter(Boolean) as UserPageUnknownRecord[];

export const buildUserPageAnalysisSurveys = ({
  detailedSurveyResponses = {},
  surveyResponseInfo = [],
}: BuildUserPageAnalysisSurveysArgs = {}): UserPageUnknownRecord[] =>
  (Array.isArray(surveyResponseInfo) ? (surveyResponseInfo as UserPageAnalysisSurveyRecord[]) : []).map((s) => {
    const arr = (detailedSurveyResponses as Record<string, unknown> | null | undefined)?.[s.id as string] || [];
    const answered = (Array.isArray(arr) ? (arr as UserPageAnalysisSurveyResponseItem[]) : []).filter((it) => {
      const responseData = toAnalysisRecord(it?.responseData);
      const v = toAnalysisRecord(responseData.answer).value;
      return v && v !== '*';
    });

    const sample = answered.slice(0, 3).map((it) => {
      const questionData = toAnalysisRecord(it?.questionData);
      const responseData = toAnalysisRecord(it?.responseData);
      const v = toAnalysisRecord(responseData.answer).value;
      return {
        prompt: questionData.prompt,
        type: questionData.type || responseData.type || 'unknown',
        answer: Array.isArray(v) ? v : v,
        importance: extractUserPageAnalysisImportance(responseData),
        additionalComment: extractUserPageAnalysisAdditionalComment(responseData) || undefined,
      };
    });

    const additionalCommentsSample = answered
      .map((it) => extractUserPageAnalysisAdditionalComment(it?.responseData))
      .filter(Boolean)
      .slice(0, 3);

    return {
      surveyId: s.id,
      title: s.title,
      answeredCount: answered.length,
      sample,
      additionalCommentsSample: additionalCommentsSample.length > 0 ? additionalCommentsSample : undefined,
    };
  });

export const readUserPageDirectNetworkCacheBucket = (cacheObj: unknown, netKey: unknown): UserPageUnknownRecord => {
  if (!isPlainAnalysisObject(cacheObj) || !netKey) return {};
  const bucket = cacheObj[String(netKey)];
  return isPlainAnalysisObject(bucket) ? bucket : {};
};

export const buildUserPageAnalysisCreatedSurveys = ({
  networkID = '',
  questionsCache = {},
  surveyCreationInfo = [],
  surveysCache = {},
}: BuildUserPageAnalysisCreatedSurveysArgs = {}): UserPageUnknownRecord[] => {
  const netSurv = readUserPageDirectNetworkCacheBucket(surveysCache, networkID);
  const netQs = readUserPageDirectNetworkCacheBucket(questionsCache, networkID);
  const surveyBucket =
    netSurv.surveys && typeof netSurv.surveys === 'object' ? (netSurv.surveys as UserPageUnknownRecord) : {};
  const questionBucket =
    netQs.questions && typeof netQs.questions === 'object' ? (netQs.questions as UserPageUnknownRecord) : {};
  return (Array.isArray(surveyCreationInfo) ? (surveyCreationInfo as UserPageAnalysisSurveyRecord[]) : []).map((sv) => {
    const sData = toAnalysisRecord(surveyBucket[sv.id as string]);
    const qIds = Array.isArray(sData.questionIDs) ? sData.questionIDs : [];
    const sampleQuestions = (qIds.slice(0, 5) as string[]).map((qid) => {
      const qidLower = qid.toLowerCase();
      const qRaw = questionBucket[qidLower];
      const q = toAnalysisRecord(qRaw);
      return qRaw ? { id: q.id || qidLower, type: q.type, prompt: q.prompt } : { id: qidLower };
    });
    return {
      surveyId: sv.id,
      title: sv.title,
      questionsCount: sv.questionsCount,
      sampleQuestions,
    };
  });
};
