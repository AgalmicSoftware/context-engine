export const parseSegmentKey = (segmentKey = '') => {
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

export const getSegmentDisplayName = (segmentKey = '') => {
  const { category, value } = parseSegmentKey(segmentKey);
  return category === 'All' ? 'Overall' : `${category}: ${value}`;
};

export const buildComparisonGroup = (segmentKey = '') => {
  const { category, value } = parseSegmentKey(segmentKey);
  return {
    id: segmentKey,
    name: getSegmentDisplayName(segmentKey),
    segmentKey,
    type: 'single',
    filters: [{ type: category, value }],
  };
};

export const calculateConsensus = (ratesBySegment = new Map(), selectedSegmentKeys = []) => {
  const availableRates = selectedSegmentKeys
    .map((segmentKey) => ratesBySegment.get(segmentKey))
    .filter((rate) => Number.isFinite(rate));
  if (availableRates.length < 2) return null;
  return Math.min(...availableRates);
};

export const calculateDivergence = (ratesBySegment = new Map(), selectedSegmentKeys = []) => {
  const availableRates = selectedSegmentKeys
    .map((segmentKey) => ratesBySegment.get(segmentKey))
    .filter((rate) => Number.isFinite(rate));
  if (availableRates.length < 2) return null;
  const mean = availableRates.reduce((sum, rate) => sum + rate, 0) / availableRates.length;
  const variance = availableRates.reduce((sum, rate) => sum + ((rate - mean) ** 2), 0) / availableRates.length;
  return Math.sqrt(variance);
};

export const calculateDivisiveness = (ratesBySegment = new Map(), selectedSegmentKeys = []) => {
  const divergence = calculateDivergence(ratesBySegment, selectedSegmentKeys);
  if (!Number.isFinite(divergence)) return null;
  return Math.max(0, Math.min(divergence / 0.5, 1));
};

export const getMinMaxAgreement = (groupRates = []) => {
  if (!Array.isArray(groupRates) || groupRates.length === 0) {
    return { min: { rate: 0, groupName: 'N/A' }, max: { rate: 0, groupName: 'N/A' } };
  }

  let min = groupRates[0];
  let max = groupRates[0];

  for (let index = 1; index < groupRates.length; index += 1) {
    if (groupRates[index].rate < min.rate) {
      min = groupRates[index];
    }
    if (groupRates[index].rate > max.rate) {
      max = groupRates[index];
    }
  }

  return { min, max };
};

export const beeswarmByExtremity = (points = [], innerWidth = 0, innerHeight = 0, padding = {}) => {
  if (!Array.isArray(points) || points.length === 0) return [];

  const radius = 6;
  const baseY = Number(padding.top || 0) + innerHeight / 2;
  const minY = Number(padding.top || 0) + radius;
  const maxY = Number(padding.top || 0) + innerHeight - radius;
  const placed = [];

  return points
    .map((point) => ({
      ...point,
      x: Number(padding.left || 0) + Number(point.extremity || 0) * innerWidth,
      y: baseY,
    }))
    .sort((left, right) => left.x - right.x)
    .map((point) => {
      let candidateY = baseY;
      let layer = 0;

      const collides = (x, y) => placed.some((existing) => (
        Math.hypot(existing.x - x, existing.y - y) < radius * 2
      ));

      while (collides(point.x, candidateY)) {
        layer += 1;
        const direction = layer % 2 === 0 ? -1 : 1;
        const offset = Math.ceil(layer / 2) * radius * 1.7;
        candidateY = Math.max(minY, Math.min(maxY, baseY + direction * offset));
        if (layer > 40) break;
      }

      const nextPoint = {
        ...point,
        y: candidateY,
      };
      placed.push(nextPoint);
      return nextPoint;
    });
};

export const buildQuestionMap = (questions = []) => new Map(
  (Array.isArray(questions) ? questions : []).map((question) => [String(question?.id || ''), question])
);

export const buildResponsesByQuestionResponse = (flatResponses = []) => {
  const responseMap = new Map();
  (Array.isArray(flatResponses) ? flatResponses : []).forEach((row) => {
    const questionId = String(row?.questionId || '').trim();
    const responseText = String(row?.responseText || '').trim();
    const segmentKey = String(row?.segmentKey || '').trim();
    if (!questionId || !responseText || !segmentKey) return;
    const mapKey = `${questionId}::${responseText}`;
    if (!responseMap.has(mapKey)) {
      responseMap.set(mapKey, {
        questionId,
        responseText,
        ratesBySegment: new Map(),
      });
    }
    responseMap.get(mapKey).ratesBySegment.set(segmentKey, Number(row?.rate || 0));
  });
  return responseMap;
};

export const buildComparisonReportRows = ({
  flatResponses = [],
  questions = [],
  comparisonGroups = [],
  questionTagsData = {},
}) => {
  const selectedSegmentKeys = (Array.isArray(comparisonGroups) ? comparisonGroups : [])
    .map((group) => String(group?.segmentKey || '').trim())
    .filter(Boolean);
  if (selectedSegmentKeys.length < 2) return [];

  const questionMap = buildQuestionMap(questions);
  const responseMap = buildResponsesByQuestionResponse(flatResponses);
  const rows = [];

  responseMap.forEach(({ questionId, responseText, ratesBySegment }) => {
    const question = questionMap.get(questionId);
    if (!question) return;
    const consensus = calculateConsensus(ratesBySegment, selectedSegmentKeys);
    const divergence = calculateDivergence(ratesBySegment, selectedSegmentKeys);
    const divisiveness = calculateDivisiveness(ratesBySegment, selectedSegmentKeys);
    if (!Number.isFinite(divergence)) return;
    const groupRates = comparisonGroups
      .map((group) => ({
        groupName: group?.name || getSegmentDisplayName(group?.segmentKey),
        segmentKey: group?.segmentKey,
        rate: ratesBySegment.get(group?.segmentKey),
      }))
      .filter((entry) => Number.isFinite(entry.rate));
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
}) => {
  const questionMap = buildQuestionMap(questions);
  const allSegmentKeys = Object.entries(demographics || {}).reduce((acc, [category, rows]) => {
    (Array.isArray(rows) ? rows : []).forEach((row) => {
      const value = String(row?.value || '').trim();
      if (value) {
        acc.push(`${category}:${value}`);
      }
    });
    return acc;
  }, []);

  const responseMap = buildResponsesByQuestionResponse(flatResponses);
  const pairResults = [];
  const allowedSet = new Set((Array.isArray(allowedSegmentKeys) ? allowedSegmentKeys : []).filter(Boolean));
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

      let bestResult = null;
      responseMap.forEach(({ questionId, ratesBySegment }) => {
        const leftRate = ratesBySegment.get(leftSegment);
        const rightRate = ratesBySegment.get(rightSegment);
        if (!Number.isFinite(leftRate) || !Number.isFinite(rightRate)) return;

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

  return pairResults
    .sort((left, right) => right.score - left.score)
    .slice(0, topN);
};

export const buildIndicatorHeatmapData = ({
  questions = [],
  flatResponses = [],
  selectedSegmentKey = 'All',
}) => {
  const categoryQuestionIds = new Map();
  (Array.isArray(questions) ? questions : []).forEach((question) => {
    const category = String(question?.category || '').trim();
    const questionId = String(question?.id || '').trim();
    if (!category || !questionId) return;
    if (!categoryQuestionIds.has(category)) {
      categoryQuestionIds.set(category, []);
    }
    categoryQuestionIds.get(category).push(questionId);
  });

  const columnLabels = ['Agree', 'Unsure', 'Disagree'];
  const rowLabels = Array.from(categoryQuestionIds.keys());
  const pivotData = rowLabels.map((category) => {
    const questionIds = categoryQuestionIds.get(category) || [];
    return columnLabels.map((responseText) => {
      const rows = (Array.isArray(flatResponses) ? flatResponses : []).filter((row) => (
        row?.segmentKey === selectedSegmentKey &&
        row?.responseText === responseText &&
        questionIds.includes(String(row?.questionId || ''))
      ));
      if (rows.length === 0) return null;
      const averageRate = rows.reduce((sum, row) => sum + Number(row?.rate || 0), 0) / rows.length;
      return averageRate;
    });
  });

  return {
    title: `${getSegmentDisplayName(selectedSegmentKey)} Topic Heatmap`,
    rowLabels,
    columnLabels,
    pivotData,
  };
};
