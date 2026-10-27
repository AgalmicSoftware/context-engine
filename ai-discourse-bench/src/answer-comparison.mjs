// Compares models' answers (from `answer`) with people's (a Results export):
// how close each model is to each group of people, and for each question the
// statistics suited to its type. Each model counts as one respondent, as in
// the stance benchmark, so its repeats are summarized into one answer first.
import {
  answerSimilarity,
  collectSessionFidelityData,
  normalizeFidelityAnswer,
  normalizeFidelityQuestion,
  resultsResponseRows,
} from '../../shared/agentFidelity.mjs';
import { bootstrapDifferenceInterval, newcombeDifferenceInterval } from './statistics.mjs';

export const ANSWER_COMPARISON_METHOD = 'aidb-answer-comparison-v1';
const BINARY_ORDER = ['Disagree', 'Unsure', 'Agree'];
const EVERYONE = 'everyone';

const isRecord = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value) => (typeof value === 'string' ? value.trim() : '');
const lower = (value) => text(value).toLowerCase();
const mean = (values) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null);
const round = (value, digits = 4) => (Number.isFinite(value) ? Number(value.toFixed(digits)) : null);
const median = (values) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
const key = (value) => JSON.stringify(value);
const counts = (values) => {
  const map = new Map();
  values.forEach((value) => map.set(key(value), (map.get(key(value)) ?? 0) + 1));
  return map;
};
const share = (values, value) => (values.length ? values.filter((entry) => key(entry) === key(value)).length / values.length : null);

// ---------------------------------------------------------------------------
// One answer per model

// The model's most common answer; ties go to the question's own order.
const modal = (values, order) => {
  const tally = counts(values);
  const ranked = [...tally.entries()].sort((a, b) => b[1] - a[1] || order.indexOf(a[0]) - order.indexOf(b[0]));
  return ranked.length ? JSON.parse(ranked[0][0]) : null;
};
const optionOrder = (question) => (question.options || []).map((option) => key([option]));

/**
 * One answer standing for all of a model's replies to a question: the most
 * common choice, the options picked in at least half its replies, the median
 * rating, or the mean allocation. `stability` is the share of replies that
 * agree with it exactly.
 */
export const summarizeModelAnswers = (question, values) => {
  if (!values.length) return null;
  let answer;
  switch (question.type) {
    case 'binary': {
      const tally = counts(values);
      const [agree, disagree] = [tally.get(key('Agree')) ?? 0, tally.get(key('Disagree')) ?? 0];
      // A model split evenly between agreeing and disagreeing hasn't settled.
      answer =
        agree === disagree && agree >= (tally.get(key('Unsure')) ?? 0)
          ? 'Unsure'
          : modal(values, ['Unsure', 'Agree', 'Disagree'].map((value) => key(value)));
      break;
    }
    case 'multichoice':
      if (question.singleSelect) {
        answer = modal(values, optionOrder(question));
      } else {
        const picked = question.options.filter(
          (option) => values.filter((value) => value.includes(option)).length * 2 >= values.length,
        );
        answer = picked.length ? picked : modal(values, []);
      }
      break;
    case 'rating':
      answer = median(values);
      break;
    case 'quadratic':
      answer = question.options.map((_, index) => mean(values.map((votes) => votes[index])));
      break;
    default:
      return { answer: null, replies: values.length, stability: null };
  }
  return { answer, replies: values.length, stability: round(share(values, answer) ?? 0) };
};

// ---------------------------------------------------------------------------
// Statistics

const jaccard = (a, b) => {
  const union = new Set([...a, ...b]);
  return union.size ? a.filter((item) => b.includes(item)).length / union.size : 1;
};
const cosine = (a, b) => {
  const dot = a.reduce((sum, value, index) => sum + value * b[index], 0);
  const norms = Math.sqrt(a.reduce((sum, value) => sum + value * value, 0)) * Math.sqrt(b.reduce((sum, value) => sum + value * value, 0));
  return norms ? dot / norms : null;
};
// Share of the group below the value, counting ties as half.
const percentile = (value, group) =>
  (group.filter((entry) => entry < value).length + 0.5 * group.filter((entry) => entry === value).length) / group.length;
// Earth mover's distance between two samples on a number line.
const earthMovers = (a, b) => {
  const points = [...new Set([...a, ...b])].sort((x, y) => x - y);
  let distance = 0;
  for (let index = 0; index < points.length - 1; index += 1) {
    const cdfA = a.filter((value) => value <= points[index]).length / a.length;
    const cdfB = b.filter((value) => value <= points[index]).length / b.length;
    distance += Math.abs(cdfA - cdfB) * (points[index + 1] - points[index]);
  }
  return distance;
};
const distribution = (values, support) => support.map((value) => share(values, value) ?? 0);
const totalVariation = (p, q) => p.reduce((sum, value, index) => sum + Math.abs(value - q[index]), 0) / 2;
const jensenShannon = (p, q) => {
  const m = p.map((value, index) => (value + q[index]) / 2);
  const kl = (x) => x.reduce((sum, value, index) => (value > 0 ? sum + value * Math.log2(value / m[index]) : sum), 0);
  return Math.sqrt(Math.max(0, (kl(p) + kl(q)) / 2));
};
const topOption = (votes) => {
  const best = Math.max(...votes);
  const tops = votes.flatMap((vote, index) => (vote === best ? [index] : []));
  return best > 0 && tops.length === 1 ? tops[0] : null;
};

/** How one model's answer sits within a group of people's answers, by question type. */
export const compareModelWithGroup = (question, answer, group) => {
  const similarities = group.map((member) => answerSimilarity(question, answer, member)).filter(Number.isFinite);
  const result = { similarity: round(mean(similarities)) };
  switch (question.type) {
    case 'binary':
      return { ...result, sameAnswerShare: round(share(group, answer)) };
    case 'multichoice':
      return question.singleSelect
        ? { ...result, sameAnswerShare: round(share(group, answer)) }
        : { ...result, meanJaccard: round(mean(group.map((member) => jaccard(answer, member)))) };
    case 'rating':
      return { ...result, percentile: round(percentile(answer, group)), fromMedian: round(answer - median(group)) };
    case 'quadratic': {
      const groupMean = question.options.map((_, index) => mean(group.map((votes) => votes[index])));
      return { ...result, cosineToMean: round(cosine(answer, groupMean)) };
    }
    default:
      return result;
  }
};

/** Models (one answer each) against a group of people, by question type. */
export const compareDistributions = (question, models, group, { seed, bootstrapSamples }) => {
  const options = question.options || [];
  switch (question.type) {
    case 'binary': {
      const agreeA = models.filter((answer) => answer === 'Agree').length;
      const agreeB = group.filter((answer) => answer === 'Agree').length;
      const position = (answer) => BINARY_ORDER.indexOf(answer) - 1;
      return {
        agreeShare: { models: round(agreeA / models.length), people: round(agreeB / group.length) },
        agreeDifference: round(agreeA / models.length - agreeB / group.length),
        agreeDifferenceInterval: newcombeDifferenceInterval(agreeA, models.length, agreeB, group.length),
        // In steps of the Disagree–Unsure–Agree scale, so 0 to 2.
        earthMovers: round(earthMovers(models.map(position), group.map(position))),
      };
    }
    case 'multichoice': {
      if (question.singleSelect) {
        const support = options.map((option) => [option]);
        const [p, q] = [distribution(models, support), distribution(group, support)];
        return { totalVariation: round(totalVariation(p, q)), jensenShannon: round(jensenShannon(p, q)) };
      }
      return {
        inclusion: options.map((option) => {
          const hitsA = models.filter((answer) => answer.includes(option)).length;
          const hitsB = group.filter((answer) => answer.includes(option)).length;
          return {
            option,
            models: round(hitsA / models.length),
            people: round(hitsB / group.length),
            difference: round(hitsA / models.length - hitsB / group.length),
            interval: newcombeDifferenceInterval(hitsA, models.length, hitsB, group.length),
          };
        }),
      };
    }
    case 'rating':
      return {
        earthMovers: round(earthMovers(models, group)),
        medianDifference: round(median(models) - median(group)),
        medianDifferenceInterval: bootstrapDifferenceInterval(models, group, median, { seed, iterations: bootstrapSamples }),
      };
    case 'quadratic':
      return {
        byOption: options.map((option, index) => {
          const votesA = models.map((votes) => votes[index]);
          const votesB = group.map((votes) => votes[index]);
          return {
            option,
            meanVotes: { models: round(mean(votesA)), people: round(mean(votesB)) },
            difference: round(mean(votesA) - mean(votesB)),
            interval: bootstrapDifferenceInterval(votesA, votesB, mean, { seed: `${seed}:${index}`, iterations: bootstrapSamples }),
            topOptionShare: {
              models: round(models.filter((votes) => topOption(votes) === index).length / models.length),
              people: round(group.filter((votes) => topOption(votes) === index).length / group.length),
            },
          };
        }),
      };
    default:
      return null;
  }
};

// ---------------------------------------------------------------------------
// Report

const readGroups = (input) => {
  const entries = Array.isArray(input)
    ? input.map((entry) => [entry?.address, entry?.groups ?? entry?.group])
    : Object.entries(isRecord(input) ? input : {});
  return new Map(
    entries
      .map(([address, groups]) => [lower(address), (Array.isArray(groups) ? groups : [groups]).map(text).filter(Boolean)])
      .filter(([address, groups]) => address && groups.length),
  );
};

/**
 * Compares an `answer` file with a Results export. People are grouped by
 * `groups` (address to group ids) or else by the link they arrived through;
 * groups, and any question, with fewer than `minPeople` people are withheld.
 */
export const compareAnswers = ({
  answersFile,
  resultsExport,
  groups = null,
  minPeople = 5,
  bootstrapSamples = 1000,
  seed = ANSWER_COMPARISON_METHOD,
}) => {
  const exportQuestions = Array.isArray(resultsExport?.filteredQuestions) ? resultsExport.filteredQuestions : [];
  const questions = [...exportQuestions, ...(answersFile?.questions || [])]
    .map(normalizeFidelityQuestion)
    .filter(Boolean)
    .filter((question, index, list) => list.findIndex((other) => other.id === question.id) === index);
  const questionMap = new Map(questions.map((question) => [question.id, question]));
  const promptOf = new Map(
    [...exportQuestions, ...(answersFile?.questions || [])].map((question) => [lower(question?.id), text(question?.prompt)]),
  );

  const { answers } = collectSessionFidelityData({ questions: exportQuestions, payloads: resultsResponseRows(resultsExport) });
  const people = answers.filter((answer) => !answer.isAgent);
  // Listed groups win; otherwise the link a person arrived through.
  const listed = groups ? readGroups(groups) : null;
  const groupsById = new Map();
  for (const answer of people) {
    if (!groupsById.has(answer.participantId)) groupsById.set(answer.participantId, []);
    if (!listed && answer.source && !groupsById.get(answer.participantId).length) {
      groupsById.set(answer.participantId, [answer.source]);
    }
  }
  if (listed) listed.forEach((ids, participantId) => groupsById.has(participantId) && groupsById.set(participantId, ids));
  const groupsOf = (participantId) => groupsById.get(participantId) ?? [];
  const answersByQuestion = new Map();
  for (const answer of people) {
    if (!answersByQuestion.has(answer.questionId)) answersByQuestion.set(answer.questionId, []);
    answersByQuestion.get(answer.questionId).push(answer);
  }
  const participants = [...groupsById.keys()];
  const groupSizes = new Map();
  participants.forEach((participantId) =>
    groupsOf(participantId).forEach((group) => groupSizes.set(group, (groupSizes.get(group) ?? 0) + 1)),
  );
  const reported = [...groupSizes].filter(([, size]) => size >= minPeople).map(([group]) => group).sort();
  const groupList = [{ id: EVERYONE, people: participants.length }, ...reported.map((id) => ({ id, people: groupSizes.get(id) }))];

  const modelIds = [...new Set((answersFile?.rows || []).map((row) => row.modelId))].sort();
  const repliesBy = new Map();
  for (const row of answersFile?.rows || []) {
    const question = questionMap.get(lower(row.questionId));
    const value = question ? normalizeFidelityAnswer(question, row.answer) : null;
    if (value === null) continue;
    const id = `${row.modelId}|${question.id}`;
    if (!repliesBy.has(id)) repliesBy.set(id, []);
    repliesBy.get(id).push(value);
  }

  const results = questions.map((question) => {
    const modelSummaries = Object.fromEntries(
      modelIds.map((modelId) => [modelId, summarizeModelAnswers(question, repliesBy.get(`${modelId}|${question.id}`) || [])]),
    );
    const base = { id: question.id, type: question.type, prompt: promptOf.get(question.id) || '', models: modelSummaries };
    if (question.type === 'freeform') {
      return { ...base, notCompared: 'Freeform answers need theme coding by a judge model against a human-checked codebook.' };
    }
    const answered = modelIds.filter((modelId) => modelSummaries[modelId]?.answer !== null && modelSummaries[modelId]?.answer !== undefined);
    const comparisons = Object.fromEntries(
      groupList.map(({ id: groupId }) => {
        const values = (answersByQuestion.get(question.id) || [])
          .filter((answer) => groupId === EVERYONE || groupsOf(answer.participantId).includes(groupId))
          .map((answer) => answer.value);
        if (values.length < minPeople) return [groupId, { people: values.length, suppressed: true }];
        return [
          groupId,
          {
            people: values.length,
            byModel: Object.fromEntries(
              answered.map((modelId) => [modelId, compareModelWithGroup(question, modelSummaries[modelId].answer, values)]),
            ),
            models: answered.length
              ? compareDistributions(
                  question,
                  answered.map((modelId) => modelSummaries[modelId].answer),
                  values,
                  { seed: `${seed}:${question.id}:${groupId}`, bootstrapSamples },
                )
              : null,
          },
        ];
      }),
    );
    return { ...base, comparisons };
  });

  // Headline: each model's mean similarity to each group, over the questions compared.
  const closeness = Object.fromEntries(
    groupList.map(({ id: groupId }) => [
      groupId,
      Object.fromEntries(
        modelIds.map((modelId) => {
          const values = results
            .map((result) => result.comparisons?.[groupId]?.byModel?.[modelId]?.similarity)
            .filter(Number.isFinite);
          return [modelId, { similarity: round(mean(values)), questions: values.length }];
        }),
      ),
    ]),
  );

  return {
    kind: 'ai_discourse_bench_answer_comparison',
    method: ANSWER_COMPARISON_METHOD,
    setId: answersFile?.setId || '',
    generatedAt: new Date().toISOString(),
    options: { minPeople, bootstrapSamples, seed },
    groups: groupList,
    groupsWithheld: groupSizes.size - reported.length,
    models: modelIds,
    closeness,
    questions: results,
  };
};

const cell = (value) => (value === null || value === undefined ? '–' : String(value));
const range = (interval) => (interval ? `${interval[0]} to ${interval[1]}` : '–');

/** A readable summary: the closeness table per group, then each question's statistics. */
export const renderComparisonMarkdown = (report) => {
  const lines = [
    '# Models compared with people',
    '',
    `Method \`${report.method}\`. ${report.models.length} models; groups of fewer than ${report.options.minPeople} people are withheld` +
      (report.groupsWithheld ? ` (${report.groupsWithheld} withheld)` : '') +
      '. Each model counts once: its replies are summarized as its most common answer, the median rating or the mean allocation.',
    '',
    '## How close each model is to each group',
    '',
    'Mean similarity (0 to 1) of the model’s answer to each person’s, averaged over the questions compared.',
    '',
    `| Model | ${report.groups.map((group) => `${group.id} (${group.people})`).join(' | ')} |`,
    `| --- | ${report.groups.map(() => '---').join(' | ')} |`,
    ...report.models.map(
      (modelId) => `| ${modelId} | ${report.groups.map((group) => cell(report.closeness[group.id]?.[modelId]?.similarity)).join(' | ')} |`,
    ),
    '',
    '## Questions',
  ];
  for (const question of report.questions) {
    lines.push('', `### ${question.prompt || question.id}`, '', `\`${question.id}\` · ${question.type}`);
    if (question.notCompared) {
      lines.push('', question.notCompared);
      continue;
    }
    for (const [groupId, comparison] of Object.entries(question.comparisons)) {
      if (comparison.suppressed) {
        lines.push('', `**${groupId}**: withheld, ${comparison.people} people answered.`);
        continue;
      }
      lines.push('', `**${groupId}** (${comparison.people} people)`, '');
      const statKeys = [...new Set(Object.values(comparison.byModel).flatMap((stats) => Object.keys(stats)))];
      lines.push(`| Model | ${statKeys.join(' | ')} |`, `| --- | ${statKeys.map(() => '---').join(' | ')} |`);
      for (const [modelId, stats] of Object.entries(comparison.byModel)) {
        lines.push(`| ${modelId} | ${statKeys.map((statKey) => cell(stats[statKey])).join(' | ')} |`);
      }
      const models = comparison.models;
      if (!models) continue;
      if ('agreeDifference' in models) {
        lines.push('', `Agree: models ${models.agreeShare.models}, people ${models.agreeShare.people}; difference ${models.agreeDifference} (${range(models.agreeDifferenceInterval)}); earth mover's distance ${models.earthMovers}.`);
      } else if ('totalVariation' in models) {
        lines.push('', `Total variation distance ${models.totalVariation}; Jensen–Shannon distance ${models.jensenShannon}.`);
      } else if (models.inclusion) {
        lines.push('', ...models.inclusion.map((row) => `- ${row.option}: models ${row.models}, people ${row.people}, difference ${row.difference} (${range(row.interval)})`));
      } else if ('medianDifference' in models) {
        lines.push('', `Median difference ${models.medianDifference} (${range(models.medianDifferenceInterval)}); earth mover's distance ${models.earthMovers}.`);
      } else if (models.byOption) {
        lines.push(
          '',
          ...models.byOption.map(
            (row) =>
              `- ${row.option}: mean votes models ${row.meanVotes.models}, people ${row.meanVotes.people}, difference ${row.difference} (${range(row.interval)}); top choice of ${row.topOptionShare.models} of models and ${row.topOptionShare.people} of people`,
          ),
        );
      }
    }
  }
  return `${lines.join('\n')}\n`;
};
