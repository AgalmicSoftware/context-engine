import treeData from '../../variables/demo/debate_map_demo_data.json';
import historicalData from '../../variables/demo/historical_figures_tree_qs_and_votes.json';
import loopholeHistoricalCases from '../../variables/demo/loophole_historical_cases.json';
import loopholeHistoricalFigurePrinciples from '../../variables/demo/loophole_historical_figure_principles.json';
import { getRiskMatrixAtlasScenariosForAtlasNode } from '../../variables/demo/riskMatrixAtlasScenarioData';
import type {
  DebateComment,
  DebateNode,
  DebateQuestion,
  DebateVoteTotals,
  HistoricalCase,
  HistoricalCaseBrief,
  HistoricalCaseBriefBuilder,
  HistoricalCasePanel,
  HistoricalCompassPoint,
  HistoricalDraftArticle,
  HistoricalFieldDefinition,
  HistoricalFieldRow,
  HistoricalFigureRecord,
  HistoricalPatchOption,
  HistoricalVoteEntry,
  LocalVoteDeltas,
} from './debateMapTypes';

export const EMPTY_HISTORICAL_CASES: HistoricalCase[] = [];

export const atlasTreeData = treeData as DebateNode[];
const historicalFigureData = historicalData as Record<string, HistoricalFigureRecord>;
const historicalCaseEntries = Array.isArray(loopholeHistoricalCases)
  ? (loopholeHistoricalCases as HistoricalCase[])
  : [];
const historicalFigurePrincipleMap = loopholeHistoricalFigurePrinciples as Record<string, unknown>;

export const cleanAtlasCategoryName = (name: unknown): string => String(name || '').replace(/^\d+\.\s*/, '');

export const findAtlasNodeById = (nodes: DebateNode[] | undefined, targetId: unknown): DebateNode | null => {
  const normalizedTargetId = String(targetId || '')
    .trim()
    .toLowerCase();
  if (!normalizedTargetId || !Array.isArray(nodes)) return null;

  for (const node of nodes) {
    if (
      String(node?.id || '')
        .trim()
        .toLowerCase() === normalizedTargetId
    ) {
      return node;
    }
    if (Array.isArray(node?.children) && node.children.length > 0) {
      const foundChild = findAtlasNodeById(node.children, normalizedTargetId);
      if (foundChild) return foundChild;
    }
  }

  return null;
};

const parseHistoricalVoteValue = (vote: unknown): number | null => {
  if (vote === null || vote === undefined || vote === '') return null;
  if (vote === 'up') return 1;
  if (vote === 'down') return -1;

  const parsedVote = parseInt(String(vote), 10);
  return Number.isNaN(parsedVote) ? null : parsedVote;
};

const normalizeCompassVote = (value: unknown): number => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return 0.5;
  return Math.max(0, Math.min(1, (numericValue + 8) / 16));
};

const getNameHash = (value: unknown): number =>
  Array.from(String(value || '')).reduce((sum, char) => sum + char.charCodeAt(0), 0);

const hslToHex = (h: number, s: number, l: number): string => {
  s /= 100;
  l /= 100;

  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0');
  };

  return `#${f(0)}${f(8)}${f(4)}`;
};

const getHistoricalCompassColor = (name: unknown): string => {
  const hue = (getNameHash(name) * 17) % 360;
  return hslToHex(hue, 72, 58);
};

const historicalFigureVoteMap = Object.entries(historicalFigureData || {}).reduce<
  Record<string, HistoricalVoteEntry[]>
>((acc, [username, figure]) => {
  acc[username] = Object.entries(figure?.votes || {}).reduce<HistoricalVoteEntry[]>((votes, [nodeId, vote]) => {
    const parsedVote = parseHistoricalVoteValue(vote);
    if (parsedVote !== null) {
      votes.push({ username, nodeId, value: parsedVote });
    }
    return votes;
  }, []);
  return acc;
}, {});

const historicalFigureCommentMap = Object.entries(historicalFigureData || {}).reduce<
  Record<string, Record<string, string>>
>((acc, [username, figure]) => {
  acc[username] = Array.isArray(figure?.comments)
    ? figure.comments.reduce<Record<string, string>>((comments, entry) => {
        if (entry?.id && typeof entry.comment === 'string') {
          comments[entry.id] = entry.comment;
        }
        return comments;
      }, {})
    : {};
  return acc;
}, {});

const historicalCaseMap = historicalCaseEntries.reduce<Record<string, HistoricalCase[]>>((acc, entry) => {
  const issueIds = Array.isArray(entry?.debate_map_issues) ? entry.debate_map_issues : [];

  issueIds.forEach((issueId) => {
    const normalizedIssueId = String(issueId || '').trim();
    if (!normalizedIssueId) return;
    if (!acc[normalizedIssueId]) {
      acc[normalizedIssueId] = [];
    }
    acc[normalizedIssueId].push(entry);
  });

  return acc;
}, {});

const getHistoricalFigurePrinciples = (figureName: string): string[] => {
  const principles = historicalFigurePrincipleMap?.[figureName];
  return Array.isArray(principles) ? principles.filter(Boolean) : [];
};

const normalizeHistoricalCaseText = (value: unknown): string => {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (Array.isArray(value)) {
    return value
      .map((entry: unknown) => normalizeHistoricalCaseText(entry))
      .filter(Boolean)
      .join(', ');
  }
  return '';
};

export const normalizeHistoricalCaseTextList = (values: unknown): string[] =>
  Array.isArray(values) ? values.map((value: unknown) => normalizeHistoricalCaseText(value)).filter(Boolean) : [];

const buildHistoricalCaseFieldRows = (
  source: Record<string, unknown> | null | undefined,
  fields: HistoricalFieldDefinition[],
): HistoricalFieldRow[] => {
  if (!source || typeof source !== 'object') return [];

  return fields.reduce<HistoricalFieldRow[]>((rows, field) => {
    const value = normalizeHistoricalCaseText(source?.[field.key]);
    if (!value) return rows;
    return rows.concat({ label: field.label, value });
  }, []);
};

const normalizeHistoricalDraftArticles = (
  draftLegalCode: { articles?: unknown[] } | null | undefined,
): HistoricalDraftArticle[] => {
  const rawArticles = Array.isArray(draftLegalCode?.articles) ? draftLegalCode.articles : [];

  return rawArticles.reduce<HistoricalDraftArticle[]>((articles, article, articleIndex) => {
    const fallbackLabel = `Article ${articleIndex + 1}`;
    let body = '';
    let label = '';

    if (article && typeof article === 'object' && !Array.isArray(article)) {
      const articleRecord = article as Record<string, unknown>;
      label = normalizeHistoricalCaseText(articleRecord.label || articleRecord.title || articleRecord.article);
      body = normalizeHistoricalCaseText(
        articleRecord.body || articleRecord.text || articleRecord.content || articleRecord.summary,
      );
    } else {
      body = normalizeHistoricalCaseText(article);
    }

    if (!body) return articles;

    if (!label) {
      const labelMatch = body.match(/^(Article|Art\.?)\s*([A-Za-z0-9]+)[\s.:_-]*(.*)$/i);
      if (labelMatch) {
        label = `Article ${labelMatch[2]}`;
        body = normalizeHistoricalCaseText(labelMatch[3]) || body;
      }
    }

    return articles.concat({
      label: label || fallbackLabel,
      body,
    });
  }, []);
};

const resolveHistoricalPatchFigureLabel = (rawValue: unknown, authors: string[]): string[] => {
  const normalizedValue = normalizeHistoricalCaseText(rawValue);
  const normalizedKey = normalizedValue.toLowerCase();

  if (!normalizedKey) return [];
  if (normalizedKey === 'both' || normalizedKey === 'figure a + figure b') {
    return normalizeHistoricalCaseTextList(authors);
  }
  if (normalizedKey === 'figure a') {
    return [normalizeHistoricalCaseText(authors?.[0]) || 'Figure A'];
  }
  if (normalizedKey === 'figure b') {
    return [normalizeHistoricalCaseText(authors?.[1]) || 'Figure B'];
  }

  return [normalizedValue];
};

const normalizeHistoricalPatchFavoredBy = (favoredBy: unknown, authors: string[]): string[] => {
  const favoredValues = Array.isArray(favoredBy) ? favoredBy : [favoredBy];

  const rawTokens = favoredValues.flatMap((value: unknown) => {
    const normalizedValue = normalizeHistoricalCaseText(value);
    if (!normalizedValue) return [];
    if (/^\s*(figure a|figure b|both)\s*$/i.test(normalizedValue)) {
      return [normalizedValue];
    }
    return normalizedValue.split(/\s*(?:,|\/|&|\band\b)\s*/i).filter(Boolean);
  });

  return Array.from(
    new Set(rawTokens.flatMap((token) => resolveHistoricalPatchFigureLabel(token, authors)).filter(Boolean)),
  );
};

const normalizeHistoricalPatchOptions = (patchOptions: unknown, authors: string[]): HistoricalPatchOption[] =>
  Array.isArray(patchOptions)
    ? patchOptions.reduce<HistoricalPatchOption[]>((normalizedPatches, patch, patchIndex) => {
        if (!patch || typeof patch !== 'object') return normalizedPatches;

        const name = normalizeHistoricalCaseText(patch.name);
        const summary = normalizeHistoricalCaseText(patch.summary);
        const favoredBy = normalizeHistoricalPatchFavoredBy(patch.favored_by, authors);

        if (!name && !summary && favoredBy.length === 0) {
          return normalizedPatches;
        }

        return normalizedPatches.concat({
          id: name || `patch-${patchIndex}`,
          name: name || `Patch option ${patchIndex + 1}`,
          summary,
          favoredBy,
        });
      }, [])
    : [];

const buildHistoricalCasePanel = (
  title: string,
  tone: 'primary' | 'secondary',
  source: Record<string, unknown> | null | undefined,
  fields: HistoricalFieldDefinition[],
): HistoricalCasePanel | null => {
  const rows = buildHistoricalCaseFieldRows(source, fields);
  if (rows.length === 0) return null;

  return {
    title,
    tone,
    rows,
  };
};

export const buildHistoricalCaseBrief = (
  historicalCase: HistoricalCase,
  content: DebateNode = {},
): HistoricalCaseBrief => {
  const nodeName = String(content?.name || 'this issue').trim();
  const xAxisLabel = String(content?.compass?.xAxis?.label || '').trim();
  const yAxisLabel = String(content?.compass?.yAxis?.label || '').trim();
  const summaryText = String(historicalCase?.summary || '').trim();
  const authors = normalizeHistoricalCaseTextList(historicalCase?.authors);

  const inlinePrinciples = historicalCase?.principles_by_figure || {};
  const figurePrinciples = authors.map((authorName) => {
    const inlinePrinciplesList = normalizeHistoricalCaseTextList(inlinePrinciples?.[authorName]);
    return {
      name: authorName,
      principles:
        inlinePrinciplesList.length > 0
          ? inlinePrinciplesList
          : normalizeHistoricalCaseTextList(getHistoricalFigurePrinciples(authorName)),
    };
  });

  const authorText = authors.length > 0 ? authors.join(' and ') : 'the paired historical figures';
  const normalizedCategory = String(historicalCase?.category || '')
    .trim()
    .toLowerCase();
  const axisFragments = [xAxisLabel, yAxisLabel].filter(Boolean);
  const axisText = axisFragments.length > 0 ? axisFragments.join(' and ') : nodeName;

  const draftArticles = normalizeHistoricalDraftArticles(historicalCase?.draft_legal_code);
  const attackPanels = [
    buildHistoricalCasePanel('Loophole exploit', 'primary', historicalCase?.loophole_exploit, [
      { key: 'institution', label: 'Institution' },
      { key: 'actor', label: 'Actor' },
      { key: 'action', label: 'Action' },
      { key: 'victims', label: 'Victims' },
      { key: 'why_legal', label: 'Why legal' },
      { key: 'why_immoral', label: 'Why immoral' },
    ]),
    buildHistoricalCasePanel('Overreach variant', 'secondary', historicalCase?.overreach_variant, [
      { key: 'institution', label: 'Institution' },
      { key: 'actor', label: 'Actor' },
      { key: 'blocked_action', label: 'Blocked action' },
      { key: 'who_gets_harmed', label: 'Who gets harmed' },
      { key: 'why_illegal', label: 'Why illegal' },
      { key: 'why_moral', label: 'Why moral' },
    ]),
  ].filter((panel): panel is HistoricalCasePanel => Boolean(panel));

  const richJudgeTension = normalizeHistoricalCaseText(historicalCase?.judge_tension);
  const richWhyHard = normalizeHistoricalCaseText(historicalCase?.why_the_case_is_hard);
  const richBestPatch = normalizeHistoricalCaseText(historicalCase?.best_patch);
  const richWhyOtherFails = normalizeHistoricalCaseText(historicalCase?.why_other_patch_fails);
  const richOpenQuestion = normalizeHistoricalCaseText(historicalCase?.open_question);

  let draftLegalCodeText = `A legislator starting from these principles would try to write a rule for ${nodeName} that is specific enough to draft from and broad enough to survive the next edge case. On this node, that means taking a clear position on ${axisText}.`;
  let adversarialAttackText = `The adversarial move is to translate the abstract debate into a concrete case where the current rule starts producing consequences its authors may not have intended. ${summaryText}`;
  let judgeTensionText = `The repo guidance says good principles should be specific enough to draft from, broad enough to create real tension, and honest enough to expose conflict. This case is difficult because ${authorText} bring draftable principles that do not collapse into a single obvious patch once ${nodeName} is under pressure.`;
  let decisionPromptText = `What ruling would you adopt here, and what precedent would that create for the next version of the code?`;

  if (normalizedCategory.includes('loophole')) {
    draftLegalCodeText = `A legislator starting from these principles would likely write a strong protective rule around ${nodeName}, then add a narrow operational exception so the system can still function in practice. That draft is the sort of code Loophole is meant to stress-test.`;
    adversarialAttackText = `This is a Loophole Finder case: the action stays technically inside the rule while violating the moral objective that justified the rule in the first place. ${summaryText}`;
    judgeTensionText = `The judge's problem is to close the exploit without breaking legitimate use. A patch that simply removes discretion may satisfy one figure's principles while violating the other figure's tolerable exceptions or state-capacity concerns.`;
    decisionPromptText = `What patch closes the exploit in ${nodeName} without blocking the legitimate use that made the rule attractive in the first place?`;
  } else if (normalizedCategory.includes('overreach')) {
    draftLegalCodeText = `A legislator starting from these principles would likely draft a rule that aggressively protects against the obvious abuse tied to ${nodeName}. The danger is that the code becomes too rigid once it meets emergencies, edge cases, or justified discretion.`;
    adversarialAttackText = `This is an Overreach Finder case: the attack is to show that the current rule forbids conduct many people would still treat as morally acceptable or even required. ${summaryText}`;
    judgeTensionText = `The judge cannot just carve out a broad exception, because that may reopen the original abuse path. The hard part is writing a narrower refinement that respects both figures' principles without turning the rule into swiss cheese.`;
    decisionPromptText = `What exception or refinement preserves justified action here without reopening the abuse path that the original rule was trying to close?`;
  } else if (normalizedCategory.includes('judge')) {
    draftLegalCodeText = `A legislator starting from these principles would already have some code on the books for ${nodeName}. This case matters because the next revision has to fit the growing precedent set, not start over from clean philosophical premises.`;
    adversarialAttackText = `This is a precedent-building case: the real stress test is not just whether the present situation is difficult, but whether the next patch will collide with earlier commitments elsewhere in the code. ${summaryText}`;
    judgeTensionText = `The judge has to preserve coherence across rounds. A patch that looks sensible for this dispute may undermine prior rulings, loosen future enforcement, or quietly privilege one figure's principles as the hidden default for every later case.`;
    decisionPromptText = `If this becomes binding precedent for ${nodeName}, what future edge cases would it settle well, and which ones might it quietly break?`;
  } else if (normalizedCategory.includes('escalated')) {
    draftLegalCodeText = `A legislator starting from these principles could still write real code for ${nodeName}, but the rule would encode a live philosophical disagreement rather than a settled consensus. That is why the case is already in escalation territory.`;
    adversarialAttackText = `This is an escalated case in the Loophole sense: the system has found a dilemma where any clean answer seems to betray one serious principle in order to preserve another. ${summaryText}`;
    judgeTensionText = `The judge cannot auto-resolve this without choosing which principle should dominate. That choice belongs to the human because it reveals a genuine fracture in the moral framework rather than a drafting oversight.`;
    decisionPromptText = `If this becomes binding precedent for ${nodeName}, what future edge cases would it settle well, and which ones might it quietly break?`;
  }

  return {
    figurePrinciples,
    draftLegalCode: draftArticles.length > 0 ? { articles: draftArticles } : draftLegalCodeText,
    adversarialAttack:
      attackPanels.length > 0
        ? { panels: attackPanels, fallbackText: null }
        : { panels: [], fallbackText: adversarialAttackText },
    judgeTension: richJudgeTension || judgeTensionText,
    whyHard: richWhyHard || null,
    decisionPrompt: richOpenQuestion || decisionPromptText,
    patchOptions: normalizeHistoricalPatchOptions(historicalCase?.concrete_patch_options, authors),
    bestPatch: richBestPatch || null,
    whyOtherFails: richWhyOtherFails || null,
    precedentPressure: buildHistoricalCaseFieldRows(historicalCase?.precedent_pressure, [
      { key: 'prior_ruling', label: 'Prior ruling' },
      { key: 'future_case_at_risk', label: 'Future case at risk' },
    ]),
  };
};

export const getHistoricalCaseCardKey = (historicalCase: HistoricalCase, caseIndex: number): string => {
  const title = String(historicalCase?.title || historicalCase?.id || '').trim();
  return String(historicalCase?.id || `${title}-${caseIndex}`);
};

export const buildExpandedHistoricalCaseBriefMap = (
  historicalCases: HistoricalCase[] = EMPTY_HISTORICAL_CASES,
  content: DebateNode = {},
  expandedCaseKey = '',
  buildBrief: HistoricalCaseBriefBuilder = buildHistoricalCaseBrief,
): Map<string, HistoricalCaseBrief> => {
  const normalizedExpandedKey = String(expandedCaseKey || '').trim();
  const briefMap = new Map<string, HistoricalCaseBrief>();
  if (!normalizedExpandedKey) return briefMap;

  historicalCases.forEach((historicalCase, caseIndex) => {
    if (!historicalCase || typeof historicalCase !== 'object') return;

    const title = String(historicalCase.title || historicalCase.id || '').trim();
    if (!title) return;

    const caseKey = getHistoricalCaseCardKey(historicalCase, caseIndex);
    if (caseKey !== normalizedExpandedKey) return;

    briefMap.set(caseKey, buildBrief(historicalCase, content));
  });

  return briefMap;
};

const getHistoricalCompassSpreadY = (name: string): number => ((getNameHash(name) * 37) % 1000) / 999;

const getHistoricalCompassY = (name: string, currentNodeId: string | null | undefined): number => {
  const voteSeries = historicalFigureVoteMap[name] || [];
  const alternateVote = voteSeries.filter(({ nodeId }) => nodeId !== currentNodeId)[1];

  if (alternateVote && Number.isFinite(alternateVote.value)) {
    return normalizeCompassVote(alternateVote.value);
  }

  return getHistoricalCompassSpreadY(name);
};

const getCompassQuadrantKey = ({ x, y }: Pick<HistoricalCompassPoint, 'x' | 'y'>): string => {
  const verticalKey = y > 0.5 ? 'top' : 'bottom';
  const horizontalKey = x > 0.5 ? 'right' : 'left';
  return `${verticalKey}-${horizontalKey}`;
};

const selectBalancedHistoricalCompassPoints = (
  points: HistoricalCompassPoint[],
  limit = 20,
): HistoricalCompassPoint[] => {
  const normalizedLimit = Math.max(0, Number(limit) || 0);
  if (normalizedLimit === 0 || !Array.isArray(points) || points.length === 0) {
    return [];
  }

  const quadrantOrder = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
  const quadrantBuckets = quadrantOrder.reduce<Record<string, HistoricalCompassPoint[]>>((acc, key) => {
    acc[key] = [];
    return acc;
  }, {});

  points.forEach((point) => {
    quadrantBuckets[getCompassQuadrantKey(point)].push(point);
  });

  const populatedQuadrants = quadrantOrder.filter((key) => quadrantBuckets[key].length > 0);
  if (populatedQuadrants.length <= 1 || points.length <= normalizedLimit) {
    return points.slice(0, normalizedLimit);
  }

  const selected: HistoricalCompassPoint[] = [];
  const selectedKeys = new Set();
  const pushPoint = (point: HistoricalCompassPoint) => {
    const pointKey = `${point.name}:${point.x}:${point.y}`;
    if (selectedKeys.has(pointKey)) return false;
    selected.push(point);
    selectedKeys.add(pointKey);
    return true;
  };

  const targetPerQuadrant = Math.max(1, Math.floor(normalizedLimit / populatedQuadrants.length));

  // Reserve space across populated quadrants so heavily one-sided charts still show
  // the historical figures occupying the opposing quadrants when the data exists.
  populatedQuadrants.forEach((quadrantKey) => {
    quadrantBuckets[quadrantKey].slice(0, targetPerQuadrant).forEach((point) => {
      if (selected.length < normalizedLimit) pushPoint(point);
    });
  });

  if (selected.length < normalizedLimit) {
    let cursor = 0;
    const remainderBuckets = populatedQuadrants.map((quadrantKey) => ({
      quadrantKey,
      points: quadrantBuckets[quadrantKey].slice(targetPerQuadrant),
    }));

    while (selected.length < normalizedLimit) {
      const currentBucket = remainderBuckets[cursor % remainderBuckets.length];
      const nextPoint = currentBucket?.points?.shift();

      if (nextPoint) {
        pushPoint(nextPoint);
      } else if (remainderBuckets.every((bucket) => bucket.points.length === 0)) {
        break;
      }

      cursor += 1;
    }
  }

  return selected.slice(0, normalizedLimit);
};

export const buildHistoricalCompassPoints = (
  voteEntries: HistoricalVoteEntry[] | null | undefined,
  fallbackPoints: HistoricalCompassPoint[] = [],
  currentNodeId: string | null | undefined,
  limit = 20,
): HistoricalCompassPoint[] => {
  if (!Array.isArray(voteEntries) || voteEntries.length === 0) {
    return Array.isArray(fallbackPoints) ? fallbackPoints : [];
  }

  const sortedPoints = voteEntries
    .filter((entry) => Number.isFinite(entry?.value))
    .sort(
      (left, right) =>
        Math.abs(right.value) - Math.abs(left.value) ||
        String(left.username || '').localeCompare(String(right.username || '')),
    )
    .map((entry) => ({
      name: entry.username,
      x: normalizeCompassVote(entry.value),
      y: getHistoricalCompassY(entry.username, currentNodeId),
      type: 'historical',
      color: getHistoricalCompassColor(entry.username),
      comment:
        typeof entry?.comment === 'string'
          ? entry.comment
          : currentNodeId
            ? historicalFigureCommentMap[entry.username]?.[currentNodeId] || ''
            : '',
    }));

  return selectBalancedHistoricalCompassPoints(sortedPoints, limit);
};

export const buildAtlasTreeData = (demoMode: boolean): DebateNode[] => {
  const updateNodeWithHistoricalData = (node: DebateNode): DebateNode => {
    const nodeId = String(node.id || '').trim();
    let demoUp = 0;
    let demoDown = 0;
    let demoQuestions: DebateQuestion[] = [];
    let demoComments: DebateComment[] = [];
    let demoHistoricalVotes: HistoricalVoteEntry[] = [];
    let demoHistoricalCases: HistoricalCase[] = [];
    let demoScenarioVisualizations: unknown[] = [];

    if (demoMode) {
      Object.entries(historicalFigureData || {}).forEach(([username, figure]) => {
        const voteValue = parseHistoricalVoteValue(nodeId ? figure?.votes?.[nodeId] : null);
        if (voteValue !== null) {
          demoHistoricalVotes = demoHistoricalVotes.concat({
            username,
            value: voteValue,
            comment: nodeId ? historicalFigureCommentMap[username]?.[nodeId] || '' : '',
          });
          if (voteValue > 0) demoUp += voteValue;
          else if (voteValue < 0) demoDown += Math.abs(voteValue);
        }

        if (Array.isArray(figure?.questions)) {
          const matchedQuestions = figure.questions
            .filter((question) => question.id === nodeId)
            .map((question) => ({ ...question, username }));
          demoQuestions = demoQuestions.concat(matchedQuestions);
        }

        if (Array.isArray(figure?.comments)) {
          const matchedComments = figure.comments
            .filter((comment) => comment.id === nodeId)
            .map((comment) => ({ ...comment, username }));
          demoComments = demoComments.concat(matchedComments);
        }
      });

      demoHistoricalCases = nodeId && Array.isArray(historicalCaseMap[nodeId]) ? historicalCaseMap[nodeId] : [];
      demoScenarioVisualizations = nodeId ? getRiskMatrixAtlasScenariosForAtlasNode(nodeId) : [];
    }

    const currentUp = parseInt(String(node?.votes?.up || 0), 10) || 0;
    const currentDown = parseInt(String(node?.votes?.down || 0), 10) || 0;
    const mergedQuestions = [...(node.questions || []), ...demoQuestions];
    const mergedComments = [...(node.comments || []), ...demoComments];
    const mergedHistoricalVotes = [
      ...(Array.isArray(node.historicalVotes) ? node.historicalVotes : []),
      ...demoHistoricalVotes,
    ];
    const mergedHistoricalCases = [
      ...(Array.isArray(node.historicalCases) ? node.historicalCases : []),
      ...demoHistoricalCases,
    ];
    const mergedScenarioVisualizations = [
      ...(Array.isArray(node.scenarioVisualizations) ? node.scenarioVisualizations : []),
      ...demoScenarioVisualizations,
    ];
    const children = Array.isArray(node.children) ? node.children.map(updateNodeWithHistoricalData) : undefined;

    const nextNode = {
      ...node,
      children,
    };

    if (node.votes || demoUp > 0 || demoDown > 0) {
      nextNode.votes = {
        up: currentUp + demoUp,
        down: currentDown + demoDown,
      };
    } else {
      delete nextNode.votes;
    }

    if (mergedQuestions.length > 0) nextNode.questions = mergedQuestions;
    else delete nextNode.questions;

    if (mergedComments.length > 0) nextNode.comments = mergedComments;
    else delete nextNode.comments;

    if (mergedHistoricalVotes.length > 0) nextNode.historicalVotes = mergedHistoricalVotes;
    else delete nextNode.historicalVotes;

    if (mergedHistoricalCases.length > 0) nextNode.historicalCases = mergedHistoricalCases;
    else delete nextNode.historicalCases;

    if (mergedScenarioVisualizations.length > 0) nextNode.scenarioVisualizations = mergedScenarioVisualizations;
    else delete nextNode.scenarioVisualizations;

    return nextNode;
  };

  return atlasTreeData.map((category) => ({
    ...updateNodeWithHistoricalData(category),
    name: cleanAtlasCategoryName(category.name),
  }));
};

export const calculateNetUpvotes = (votes?: DebateVoteTotals | null): number => {
  if (!votes) return 0;
  const up = parseInt(String(votes.up || 0), 10);
  const down = parseInt(String(votes.down || 0), 10);
  return up - down;
};

export const applyLocalVoteDeltasToTree = (nodes: DebateNode[], deltas: LocalVoteDeltas): DebateNode[] => {
  if (!deltas || Object.keys(deltas).length === 0) return nodes;

  return nodes.map((node) => {
    const nodeId = String(node?.id || '').trim();
    const delta = nodeId ? deltas[nodeId] : undefined;
    const nextChildren = Array.isArray(node.children)
      ? applyLocalVoteDeltasToTree(node.children, deltas)
      : node.children;

    if (!delta) {
      return nextChildren === node.children ? node : { ...node, children: nextChildren };
    }

    const current = node.votes || {};
    const currentUp = parseInt(String(current.up || 0), 10) || 0;
    const currentDown = parseInt(String(current.down || 0), 10) || 0;

    return {
      ...node,
      children: nextChildren,
      votes: {
        ...current,
        up: currentUp + (delta.up || 0),
        down: currentDown + (delta.down || 0),
      },
    };
  });
};
