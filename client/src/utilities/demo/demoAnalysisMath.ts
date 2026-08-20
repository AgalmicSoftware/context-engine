type UnknownRecord = Record<string, unknown>;

type SegmentDescriptor = {
  category: string;
  value: string;
};

export type ComparisonGroup = {
  id?: unknown;
  name?: unknown;
  segmentKey?: unknown;
  type?: unknown;
  filters?: Array<{ type: string; value: string }>;
};

type DemoAnalysisQuestion = UnknownRecord & {
  id?: unknown;
  text?: unknown;
  category?: unknown;
};

type DemoFlatResponse = UnknownRecord & {
  questionId?: unknown;
  responseText?: unknown;
  segmentKey?: unknown;
  rate?: unknown;
};

type DemoDemographicRow = UnknownRecord & {
  value?: unknown;
};

type ResponseAggregate = {
  questionId: string;
  responseText: string;
  ratesBySegment: Map<string, number>;
};

type ComparisonReportGroupRate = {
  groupName: string;
  segmentKey: string;
  rate: number;
};

export type ComparisonReportRow = {
  questionId: string;
  questionText: unknown;
  responseText: string;
  consensus: number | null;
  divergence: number;
  divisiveness: number | null;
  groupRates: ComparisonReportGroupRate[];
  tags: unknown[];
};

type BuildComparisonReportRowsOptions = {
  flatResponses?: DemoFlatResponse[];
  questions?: DemoAnalysisQuestion[];
  comparisonGroups?: ComparisonGroup[];
  questionTagsData?: Record<string, unknown[]>;
};

export type DivergentPairResult = {
  pair: string[];
  score: number;
  questionId: string;
  questionText: unknown;
};

type FindMostDivergentPairsOptions = {
  demographics?: Record<string, DemoDemographicRow[]>;
  flatResponses?: DemoFlatResponse[];
  segmentCounts?: Record<string, Record<string, number>>;
  questions?: DemoAnalysisQuestion[];
  topN?: number;
  allowedSegmentKeys?: string[];
};

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

export const parseSegmentKey = (segmentKey: unknown = ''): SegmentDescriptor => {
  const normalized = String(segmentKey || '').trim();
  if (!normalized || normalized === 'All') {
    return { category: 'All', value: 'All' };
  }
  const separatorIndex = normalized.indexOf(':');
  if (separatorIndex === -1) {
    return { category: normalized, value: normalized };
  }
  return {
    category: normalized.slice(0, separatorIndex),
    value: normalized.slice(separatorIndex + 1),
  };
};

export const getSegmentDisplayName = (segmentKey: unknown = ''): string => {
  const { category, value } = parseSegmentKey(segmentKey);
  return category === 'All' ? 'Overall' : `${category}: ${value}`;
};

export const buildComparisonGroup = (segmentKey: unknown = ''): ComparisonGroup => {
  const { category, value } = parseSegmentKey(segmentKey);
  return {
    id: segmentKey,
    name: getSegmentDisplayName(segmentKey),
    segmentKey,
    type: 'single',
    filters: [{ type: category, value }],
  };
};

export const calculateConsensus = (
  ratesBySegment: Map<string, number> = new Map(),
  selectedSegmentKeys: string[] = [],
): number | null => {
  const availableRates = selectedSegmentKeys
    .map((segmentKey) => ratesBySegment.get(segmentKey))
    .filter((rate): rate is number => Number.isFinite(rate));
  if (availableRates.length < 2) return null;
  return Math.min(...availableRates);
};

export const calculateDivergence = (
  ratesBySegment: Map<string, number> = new Map(),
  selectedSegmentKeys: string[] = [],
): number | null => {
  const availableRates = selectedSegmentKeys
    .map((segmentKey) => ratesBySegment.get(segmentKey))
    .filter((rate): rate is number => Number.isFinite(rate));
  if (availableRates.length < 2) return null;
  const mean = availableRates.reduce((sum, rate) => sum + rate, 0) / availableRates.length;
  const variance = availableRates.reduce((sum, rate) => sum + (rate - mean) ** 2, 0) / availableRates.length;
  return Math.sqrt(variance);
};

export const calculateDivisiveness = (
  ratesBySegment: Map<string, number> = new Map(),
  selectedSegmentKeys: string[] = [],
): number | null => {
  const divergence = calculateDivergence(ratesBySegment, selectedSegmentKeys);
  if (divergence == null || !Number.isFinite(divergence)) return null;
  return Math.max(0, Math.min(divergence / 0.5, 1));
};

export const buildQuestionMap = (questions: DemoAnalysisQuestion[] = []): Map<string, DemoAnalysisQuestion> =>
  new Map((Array.isArray(questions) ? questions : []).map((question) => [String(question?.id || ''), question]));

export const buildResponsesByQuestionResponse = (
  flatResponses: DemoFlatResponse[] = [],
): Map<string, ResponseAggregate> => {
  const responseMap = new Map<string, ResponseAggregate>();
  (Array.isArray(flatResponses) ? flatResponses : []).forEach((row) => {
    const questionId = String(row?.questionId || '').trim();
    const responseText = String(row?.responseText || '').trim();
    const segmentKey = String(row?.segmentKey || '').trim();
    if (!questionId || !responseText || !segmentKey) return;
    const mapKey = `${questionId}::${responseText}`;
    let aggregate = responseMap.get(mapKey);
    if (!aggregate) {
      aggregate = {
        questionId,
        responseText,
        ratesBySegment: new Map<string, number>(),
      };
      responseMap.set(mapKey, aggregate);
    }
    aggregate.ratesBySegment.set(segmentKey, Number(row?.rate || 0));
  });
  return responseMap;
};

export const buildComparisonReportRows = ({
  flatResponses = [],
  questions = [],
  comparisonGroups = [],
  questionTagsData = {},
}: BuildComparisonReportRowsOptions = {}): ComparisonReportRow[] => {
  const selectedSegmentKeys = (Array.isArray(comparisonGroups) ? comparisonGroups : [])
    .map((group) => String(group?.segmentKey || '').trim())
    .filter(Boolean);
  if (selectedSegmentKeys.length < 2) return [];

  const questionMap = buildQuestionMap(questions);
  const responseMap = buildResponsesByQuestionResponse(flatResponses);
  const rows: ComparisonReportRow[] = [];

  responseMap.forEach(({ questionId, responseText, ratesBySegment }) => {
    const question = questionMap.get(questionId);
    if (!question) return;
    const consensus = calculateConsensus(ratesBySegment, selectedSegmentKeys);
    const divergence = calculateDivergence(ratesBySegment, selectedSegmentKeys);
    const divisiveness = calculateDivisiveness(ratesBySegment, selectedSegmentKeys);
    if (divergence == null || !Number.isFinite(divergence)) return;
    const groupRates = comparisonGroups
      .map((group) => {
        const segmentKey = String(group?.segmentKey || '');
        return {
          groupName: String(group?.name || getSegmentDisplayName(segmentKey)),
          segmentKey,
          rate: ratesBySegment.get(segmentKey),
        };
      })
      .filter((entry): entry is ComparisonReportGroupRate => isFiniteNumber(entry.rate));
    if (groupRates.length < 2) return;
    rows.push({
      questionId,
      questionText: question.text,
      responseText,
      consensus,
      divergence,
      divisiveness,
      groupRates,
      tags: Array.isArray(questionTagsData?.[questionId]) ? questionTagsData[questionId] : [],
    });
  });

  return rows.sort((left, right) => right.divergence - left.divergence);
};

export const findMostDivergentPairs = ({
  demographics = {},
  flatResponses = [],
  segmentCounts = {},
  questions = [],
  topN = 6,
  allowedSegmentKeys = [],
}: FindMostDivergentPairsOptions = {}): DivergentPairResult[] => {
  const questionMap = buildQuestionMap(questions);
  const allSegmentKeys = Object.entries(demographics || {}).reduce<string[]>((acc, [category, rows]) => {
    (Array.isArray(rows) ? rows : []).forEach((row) => {
      const value = String(row?.value || '').trim();
      if (value) {
        acc.push(`${category}:${value}`);
      }
    });
    return acc;
  }, []);

  const responseMap = buildResponsesByQuestionResponse(flatResponses);
  const pairResults: DivergentPairResult[] = [];
  const allowedSet = new Set<string>((Array.isArray(allowedSegmentKeys) ? allowedSegmentKeys : []).filter(Boolean));
  const allowPairsTouchingSingleSegment = allowedSet.size === 1;

  for (let leftIndex = 0; leftIndex < allSegmentKeys.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < allSegmentKeys.length; rightIndex += 1) {
      const leftSegment = allSegmentKeys[leftIndex];
      const rightSegment = allSegmentKeys[rightIndex];
      if (allowedSet.size > 0) {
        const leftAllowed = allowedSet.has(leftSegment);
        const rightAllowed = allowedSet.has(rightSegment);
        if (
          (allowPairsTouchingSingleSegment && !leftAllowed && !rightAllowed) ||
          (!allowPairsTouchingSingleSegment && (!leftAllowed || !rightAllowed))
        ) {
          continue;
        }
      }

      let bestResult: DivergentPairResult | null = null;
      responseMap.forEach(({ questionId, ratesBySegment }) => {
        const leftRateCandidate = ratesBySegment.get(leftSegment);
        const rightRateCandidate = ratesBySegment.get(rightSegment);
        if (!isFiniteNumber(leftRateCandidate) || !isFiniteNumber(rightRateCandidate)) return;
        const leftRate = leftRateCandidate;
        const rightRate = rightRateCandidate;

        const leftCount = Number(segmentCounts?.[questionId]?.[leftSegment] || 0);
        const rightCount = Number(segmentCounts?.[questionId]?.[rightSegment] || 0);
        if (leftCount < 1 || rightCount < 1) return;

        const divergence = Math.abs(leftRate - rightRate);
        const participationWeight = Math.log1p(Math.min(leftCount, rightCount));
        const balanceWeight = Math.sqrt(Math.max(leftRate * (1 - leftRate) * rightRate * (1 - rightRate), 0));
        // Keep 0% vs 100% splits eligible instead of collapsing them to zero.
        const score = divergence * participationWeight * (0.5 + balanceWeight);
        if (!bestResult || score > bestResult.score) {
          bestResult = {
            pair: [leftSegment, rightSegment],
            score,
            questionId,
            questionText: questionMap.get(questionId)?.text || 'Unknown question',
          };
        }
      });

      if (bestResult) {
        pairResults.push(bestResult);
      }
    }
  }

  return pairResults.sort((left, right) => right.score - left.score).slice(0, topN);
};
