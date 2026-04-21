/** @file DebateMap.jsx */
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faThumbsUp, faChevronRight, faBookmark, faTimes, faComment, faLink, faCheck,
  faPlus, faNetworkWired, faArrowLeft, faFire, faSitemap, faCaretDown, faCaretUp,
  faArrowUp, faArrowDown, faList, faCircle, faExternalLinkAlt
} from '@fortawesome/free-solid-svg-icons';
import { useParams, useNavigate } from 'react-router-dom';
import { FormGroup, Label, Input } from 'reactstrap';
import treeData from '../../variables/demo/debate_map_demo_data.json';
import historicalData from '../../variables/demo/historical_figures_tree_qs_and_votes.json';
import loopholeHistoricalCases from '../../variables/demo/loophole_historical_cases.json';
import loopholeHistoricalFigurePrinciples from '../../variables/demo/loophole_historical_figure_principles.json';
import styles from './DebateMap.module.scss';
import { createLogger } from 'utilities/logging.js';
import {
  getHistoricalFigureAvatarOrBlockie,
  getHistoricalFigureBlockie,
} from 'utilities/ui/historicalFigureAvatars.js';
import { buildPublicRoute } from 'utilities/ui/publicUrl.js';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { notify } from '../../utilities/ui/notify.js';
import { buildTagHref } from '../SurveyTool/QuestionTagDropdown.jsx';

const { hierarchy: d3Hierarchy, pack: d3Pack } = require('d3');

const StandalonePoliticalCompass = React.lazy(() => (
  import('../DemoViews/DebateHUD/PoliticalCompassView.jsx').then((module) => ({
    default: module.StandalonePoliticalCompass,
  }))
));

const uiLog = createLogger('ui');

const cleanAtlasCategoryName = (name) => String(name || '').replace(/^\d+\.\s*/, '');

const findAtlasNodeById = (nodes, targetId) => {
  const normalizedTargetId = String(targetId || '').trim().toLowerCase();
  if (!normalizedTargetId || !Array.isArray(nodes)) return null;

  for (const node of nodes) {
    if (String(node?.id || '').trim().toLowerCase() === normalizedTargetId) {
      return node;
    }
    if (Array.isArray(node?.children) && node.children.length > 0) {
      const foundChild = findAtlasNodeById(node.children, normalizedTargetId);
      if (foundChild) return foundChild;
    }
  }

  return null;
};

const parseHistoricalVoteValue = (vote) => {
  if (vote === null || vote === undefined || vote === '') return null;
  if (vote === 'up') return 1;
  if (vote === 'down') return -1;

  const parsedVote = parseInt(vote, 10);
  return Number.isNaN(parsedVote) ? null : parsedVote;
};

const normalizeCompassVote = (value) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return 0.5;
  return Math.max(0, Math.min(1, (numericValue + 8) / 16));
};

const getNameHash = (value) => (
  Array.from(String(value || '')).reduce((sum, char) => sum + char.charCodeAt(0), 0)
);

const hslToHex = (h, s, l) => {
  s /= 100;
  l /= 100;

  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };

  return `#${f(0)}${f(8)}${f(4)}`;
};

const getHistoricalCompassColor = (name) => {
  const hue = (getNameHash(name) * 17) % 360;
  return hslToHex(hue, 72, 58);
};

const historicalFigureVoteMap = Object.entries(historicalData || {}).reduce((acc, [username, figure]) => {
  acc[username] = Object.entries(figure?.votes || {}).reduce((votes, [nodeId, vote]) => {
    const parsedVote = parseHistoricalVoteValue(vote);
    if (Number.isFinite(parsedVote)) {
      votes.push({ nodeId, value: parsedVote });
    }
    return votes;
  }, []);
  return acc;
}, {});

const historicalFigureCommentMap = Object.entries(historicalData || {}).reduce((acc, [username, figure]) => {
  acc[username] = Array.isArray(figure?.comments)
    ? figure.comments.reduce((comments, entry) => {
      if (entry?.id && typeof entry.comment === 'string') {
        comments[entry.id] = entry.comment;
      }
      return comments;
    }, {})
    : {};
  return acc;
}, {});

const historicalCaseMap = (Array.isArray(loopholeHistoricalCases) ? loopholeHistoricalCases : []).reduce((acc, entry) => {
  const issueIds = Array.isArray(entry?.debate_map_issues) ? entry.debate_map_issues : [];

  issueIds.forEach((issueId) => {
    if (!acc[issueId]) {
      acc[issueId] = [];
    }
    acc[issueId].push(entry);
  });

  return acc;
}, {});

const getHistoricalFigurePrinciples = (figureName) => {
  const principles = loopholeHistoricalFigurePrinciples?.[figureName];
  return Array.isArray(principles) ? principles.filter(Boolean) : [];
};

const normalizeHistoricalCaseText = (value) => {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (Array.isArray(value)) {
    return value
      .map((entry) => normalizeHistoricalCaseText(entry))
      .filter(Boolean)
      .join(', ');
  }
  return '';
};

const normalizeHistoricalCaseTextList = (values) => (
  Array.isArray(values)
    ? values
      .map((value) => normalizeHistoricalCaseText(value))
      .filter(Boolean)
    : []
);

const buildHistoricalCaseFieldRows = (source, fields) => {
  if (!source || typeof source !== 'object') return [];

  return fields.reduce((rows, field) => {
    const value = normalizeHistoricalCaseText(source?.[field.key]);
    if (!value) return rows;
    return rows.concat({ label: field.label, value });
  }, []);
};

const normalizeHistoricalDraftArticles = (draftLegalCode) => {
  const rawArticles = Array.isArray(draftLegalCode?.articles)
    ? draftLegalCode.articles
    : [];

  return rawArticles.reduce((articles, article, articleIndex) => {
    const fallbackLabel = `Article ${articleIndex + 1}`;
    let body = '';
    let label = '';

    if (article && typeof article === 'object' && !Array.isArray(article)) {
      label = normalizeHistoricalCaseText(
        article.label || article.title || article.article
      );
      body = normalizeHistoricalCaseText(
        article.body || article.text || article.content || article.summary
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

const resolveHistoricalPatchFigureLabel = (rawValue, authors) => {
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

const normalizeHistoricalPatchFavoredBy = (favoredBy, authors) => {
  const favoredValues = Array.isArray(favoredBy)
    ? favoredBy
    : [favoredBy];

  const rawTokens = favoredValues
    .flatMap((value) => {
      const normalizedValue = normalizeHistoricalCaseText(value);
      if (!normalizedValue) return [];
      if (/^\s*(figure a|figure b|both)\s*$/i.test(normalizedValue)) {
        return [normalizedValue];
      }
      return normalizedValue.split(/\s*(?:,|\/|&|\band\b)\s*/i).filter(Boolean);
    });

  return Array.from(new Set(
    rawTokens
      .flatMap((token) => resolveHistoricalPatchFigureLabel(token, authors))
      .filter(Boolean)
  ));
};

const normalizeHistoricalPatchOptions = (patchOptions, authors) => (
  Array.isArray(patchOptions)
    ? patchOptions.reduce((normalizedPatches, patch, patchIndex) => {
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
    : []
);

const buildHistoricalCasePanel = (title, tone, source, fields) => {
  const rows = buildHistoricalCaseFieldRows(source, fields);
  if (rows.length === 0) return null;

  return {
    title,
    tone,
    rows,
  };
};

export const buildHistoricalCaseBrief = (historicalCase, content = {}) => {
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
      principles: inlinePrinciplesList.length > 0
        ? inlinePrinciplesList
        : normalizeHistoricalCaseTextList(getHistoricalFigurePrinciples(authorName)),
    };
  });

  const authorText = authors.length > 0 ? authors.join(' and ') : 'the paired historical figures';
  const normalizedCategory = String(historicalCase?.category || '').trim().toLowerCase();
  const axisFragments = [xAxisLabel, yAxisLabel].filter(Boolean);
  const axisText = axisFragments.length > 0
    ? axisFragments.join(' and ')
    : nodeName;

  const draftArticles = normalizeHistoricalDraftArticles(historicalCase?.draft_legal_code);
  const attackPanels = [
    buildHistoricalCasePanel(
      'Loophole exploit',
      'primary',
      historicalCase?.loophole_exploit,
      [
        { key: 'institution', label: 'Institution' },
        { key: 'actor', label: 'Actor' },
        { key: 'action', label: 'Action' },
        { key: 'victims', label: 'Victims' },
        { key: 'why_legal', label: 'Why legal' },
        { key: 'why_immoral', label: 'Why immoral' },
      ]
    ),
    buildHistoricalCasePanel(
      'Overreach variant',
      'secondary',
      historicalCase?.overreach_variant,
      [
        { key: 'institution', label: 'Institution' },
        { key: 'actor', label: 'Actor' },
        { key: 'blocked_action', label: 'Blocked action' },
        { key: 'who_gets_harmed', label: 'Who gets harmed' },
        { key: 'why_illegal', label: 'Why illegal' },
        { key: 'why_moral', label: 'Why moral' },
      ]
    ),
  ].filter(Boolean);

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
    draftLegalCode: draftArticles.length > 0
      ? { articles: draftArticles }
      : draftLegalCodeText,
    adversarialAttack: attackPanels.length > 0
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

const getHistoricalCompassSpreadY = (name) => (
  ((getNameHash(name) * 37) % 1000) / 999
);

const getHistoricalCompassY = (name, currentNodeId) => {
  const voteSeries = historicalFigureVoteMap[name] || [];
  const alternateVote = voteSeries
    .filter(({ nodeId }) => nodeId !== currentNodeId)[1];

  if (alternateVote && Number.isFinite(alternateVote.value)) {
    return normalizeCompassVote(alternateVote.value);
  }

  return getHistoricalCompassSpreadY(name);
};

const getCompassQuadrantKey = ({ x, y }) => {
  const verticalKey = y > 0.5 ? 'top' : 'bottom';
  const horizontalKey = x > 0.5 ? 'right' : 'left';
  return `${verticalKey}-${horizontalKey}`;
};

const selectBalancedHistoricalCompassPoints = (points, limit = 20) => {
  const normalizedLimit = Math.max(0, parseInt(limit, 10) || 0);
  if (normalizedLimit === 0 || !Array.isArray(points) || points.length === 0) {
    return [];
  }

  const quadrantOrder = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
  const quadrantBuckets = quadrantOrder.reduce((acc, key) => {
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

  const selected = [];
  const selectedKeys = new Set();
  const pushPoint = (point) => {
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
    quadrantBuckets[quadrantKey]
      .slice(0, targetPerQuadrant)
      .forEach((point) => {
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
  voteEntries,
  fallbackPoints = [],
  currentNodeId,
  limit = 20
) => {
  if (!Array.isArray(voteEntries) || voteEntries.length === 0) {
    return Array.isArray(fallbackPoints) ? fallbackPoints : [];
  }

  const sortedPoints = voteEntries
    .filter((entry) => Number.isFinite(entry?.value))
    .sort((left, right) => (
      Math.abs(right.value) - Math.abs(left.value) ||
      String(left.username || '').localeCompare(String(right.username || ''))
    ))
    .map((entry) => ({
      name: entry.username,
      x: normalizeCompassVote(entry.value),
      y: getHistoricalCompassY(entry.username, currentNodeId),
      type: 'historical',
      color: getHistoricalCompassColor(entry.username),
      comment: typeof entry?.comment === 'string'
        ? entry.comment
        : (historicalFigureCommentMap[entry?.username]?.[currentNodeId] || ''),
    }));

  return selectBalancedHistoricalCompassPoints(sortedPoints, limit);
};

const buildAtlasTreeData = (demoMode) => {
  const updateNodeWithHistoricalData = (node) => {
    let demoUp = 0;
    let demoDown = 0;
    let demoQuestions = [];
    let demoComments = [];
    let demoHistoricalVotes = [];
    let demoHistoricalCases = [];

    if (demoMode) {
      Object.entries(historicalData || {}).forEach(([username, figure]) => {
        const voteValue = parseHistoricalVoteValue(figure?.votes ? figure.votes[node.id] : null);
        if (voteValue !== null) {
          demoHistoricalVotes = demoHistoricalVotes.concat({
            username,
            value: voteValue,
            comment: historicalFigureCommentMap[username]?.[node.id] || '',
          });
          if (voteValue > 0) demoUp += voteValue;
          else if (voteValue < 0) demoDown += Math.abs(voteValue);
        }

        if (Array.isArray(figure?.questions)) {
          const matchedQuestions = figure.questions
            .filter((question) => question.id === node.id)
            .map((question) => ({ ...question, username }));
          demoQuestions = demoQuestions.concat(matchedQuestions);
        }

        if (Array.isArray(figure?.comments)) {
          const matchedComments = figure.comments
            .filter((comment) => comment.id === node.id)
            .map((comment) => ({ ...comment, username }));
          demoComments = demoComments.concat(matchedComments);
        }
      });

      demoHistoricalCases = Array.isArray(historicalCaseMap[node.id])
        ? historicalCaseMap[node.id]
        : [];
    }

    const currentUp = parseInt(node?.votes?.up || 0, 10) || 0;
    const currentDown = parseInt(node?.votes?.down || 0, 10) || 0;
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
    const children = Array.isArray(node.children)
      ? node.children.map(updateNodeWithHistoricalData)
      : undefined;

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

    return nextNode;
  };

  return treeData.map((category) => ({
    ...updateNodeWithHistoricalData(category),
    name: cleanAtlasCategoryName(category.name),
  }));
};

const calculateNetUpvotes = (votes) => {
  if (!votes) return 0;
  const up = parseInt(votes.up || 0, 10);
  const down = parseInt(votes.down || 0, 10);
  return up - down;
};

const getAtlasVoteTotals = (node) => {
  const up = parseInt(node?.votes?.up || 0, 10) || 0;
  const down = parseInt(node?.votes?.down || 0, 10) || 0;
  return {
    up,
    down,
    total: up + down,
  };
};

const calculateHeat = (node) => {
  const { total } = getAtlasVoteTotals(node);
  const comments = (node.questions ? node.questions.length : 0) + (node.comments ? node.comments.length : 0);
  return total + (comments * 3);
};

const calculateDisagreementScore = (node) => {
  const { up, down } = getAtlasVoteTotals(node);
  // Use the smaller side of the split so popular but one-sided nodes do not
  // overwhelm more contested debates in atlas view.
  return Math.min(up, down);
};

const calculateAtlasNodeSize = (node, isMobile, disagreementRange) => {
  let baseSize = (node.depth === 0 ? 80 : (node.depth === 1 ? 40 : (node.depth === 2 ? 20 : 12)));
  if (node.isCenter) baseSize = 90;

  const score = Number(node?.disagreementScore) || 0;
  const minScore = Number(disagreementRange?.min) || 0;
  const maxScore = Number(disagreementRange?.max) || 0;
  let disagreementWeight = 0;

  if (maxScore > minScore) {
    disagreementWeight = (score - minScore) / (maxScore - minScore);
  } else if (score > 0) {
    disagreementWeight = 1;
  }

  const sizeBonus = node.isCenter
    ? 0
    : (node.depth === 0 ? 56 : (node.depth === 1 ? 34 : (node.depth === 2 ? 20 : 12))) * disagreementWeight;

  const totalSize = baseSize + sizeBonus;
  return isMobile ? totalSize * 0.7 : totalSize;
};

const DEFAULT_ATLAS_DIMENSIONS = Object.freeze({ w: 1000, h: 800 });
export const ATLAS_LAYOUT_MODES = Object.freeze({
  ORBITAL: 'orbital',
  PACKED: 'packed',
});
export const DEBATE_VISUAL_MODES = Object.freeze({
  CIRCLES: 'circles',
  ATLAS: 'atlas',
  TREE: 'tree',
  LIST: 'list',
});

const getInitialDebateVisualMode = (atlasLayoutMode) => (
  atlasLayoutMode === ATLAS_LAYOUT_MODES.ORBITAL
    ? DEBATE_VISUAL_MODES.ATLAS
    : DEBATE_VISUAL_MODES.CIRCLES
);

const getAtlasCommentCount = (node) => (
  (node.questions ? node.questions.length : 0) + (node.comments ? node.comments.length : 0)
);

const flattenAtlasNodes = (nodes = []) => {
  let res = [];
  nodes.forEach((node) => {
    res.push(node);
    if (Array.isArray(node?.children) && node.children.length > 0) {
      res = res.concat(flattenAtlasNodes(node.children));
    }
  });
  return res;
};

const getAtlasCenterNode = (atlasRoot, data) => (
  atlasRoot ? atlasRoot : { id: 'virtual-root', name: 'AI Policy Atlas', children: data, depth: -1 }
);

const measureAtlasContainer = (node, fallback = DEFAULT_ATLAS_DIMENSIONS) => {
  const width = Number(node?.offsetWidth) || 0;
  const height = Number(node?.offsetHeight) || 0;
  return {
    w: width > 0 ? width : fallback.w,
    h: height > 0 ? height : fallback.h,
  };
};

const normalizeAtlasDepthValue = (value, fallback = 0) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
};

const resolveAtlasVisualDepth = (atlasRoot, hierarchyDepth) => {
  if (atlasRoot) {
    return normalizeAtlasDepthValue(atlasRoot.depth, 0) + hierarchyDepth;
  }
  return hierarchyDepth - 1;
};

const getAtlasDepthClass = (visualDepth, isCenter = false) => (
  isCenter ? 'depthCenter' : `depth${Math.max(0, Math.min(visualDepth, 3))}`
);

const buildAtlasRenderNode = (node, atlasRoot, hierarchyDepth, options = {}) => {
  const { isCenter = false, x = 0, y = 0, r = null, ...restOptions } = options;
  const visualDepth = isCenter
    ? normalizeAtlasDepthValue(node?.depth, 0)
    : resolveAtlasVisualDepth(atlasRoot, hierarchyDepth);

  return {
    ...node,
    ...restOptions,
    x,
    y,
    r,
    isCenter,
    hierarchyDepth,
    depth: visualDepth,
    depthClass: getAtlasDepthClass(visualDepth, isCenter),
    heat: calculateHeat(node),
    disagreementScore: calculateDisagreementScore(node),
  };
};

const calculateAtlasPackValue = (node) => {
  if (Array.isArray(node?.children) && node.children.length > 0) {
    return 0;
  }
  return Math.max(calculateDisagreementScore(node), 1);
};

const shouldAlwaysShowPackedLabel = (node) => node.hierarchyDepth === 1;
const getPackedAtlasGroupId = (hierarchyNode) => {
  if (!hierarchyNode) return '';
  const lineage = [];
  let currentNode = hierarchyNode;
  while (currentNode) {
    lineage.unshift(currentNode);
    currentNode = currentNode.parent || null;
  }
  const groupNode = lineage[1] || lineage[0] || hierarchyNode;
  return String(groupNode?.data?.id || hierarchyNode?.data?.id || '').trim();
};

const useAtlasContainerDimensions = (measureKey) => {
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState(DEFAULT_ATLAS_DIMENSIONS);

  useEffect(() => {
    const measure = () => {
      setDimensions((prev) => measureAtlasContainer(containerRef.current, prev));
    };

    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measureKey]);

  return { containerRef, dimensions };
};

const useAtlasNavigationState = (data, onNodeClick) => {
  const [atlasRootId, setAtlasRootId] = useState(null);
  const [atlasHistoryIds, setAtlasHistoryIds] = useState([]);
  const [showActiveDebates, setShowActiveDebates] = useState(false);

  const atlasRoot = useMemo(() => (
    atlasRootId ? findAtlasNodeById(data, atlasRootId) : null
  ), [atlasRootId, data]);

  const topNodes = useMemo(() => (
    flattenAtlasNodes(data)
      .sort((a, b) => calculateHeat(b) - calculateHeat(a))
      .slice(0, 3)
  ), [data]);

  const handleAtlasNodeClick = useCallback((node) => {
    if (!node || node.id === 'virtual-root') return;

    if (node.isCenter || !Array.isArray(node.children) || node.children.length === 0) {
      onNodeClick(node);
      return;
    }

    setAtlasHistoryIds((prev) => [...prev, atlasRootId]);
    setAtlasRootId(node.id);
    setShowActiveDebates(false);
  }, [atlasRootId, onNodeClick]);

  const handleBack = useCallback((event) => {
    event?.stopPropagation?.();
    if (atlasHistoryIds.length === 0) return;
    const nextHistory = [...atlasHistoryIds];
    const prevRoot = nextHistory.pop();
    setAtlasHistoryIds(nextHistory);
    setAtlasRootId(prevRoot || null);
  }, [atlasHistoryIds]);

  return {
    atlasRoot,
    showActiveDebates,
    setShowActiveDebates,
    topNodes,
    handleAtlasNodeClick,
    handleBack,
  };
};

const AtlasChrome = ({
  atlasRoot,
  handleBack,
  onNodeClick,
  showActiveDebates,
  setShowActiveDebates,
  topNodes,
}) => (
  <>
    {atlasRoot && (
      <button type="button" className={styles.backArrow} onClick={handleBack}>
        <FontAwesomeIcon icon={faArrowLeft} /> Up Level
      </button>
    )}

    {!atlasRoot && (
      <button
        type="button"
        className={styles.hotDebatesBtn}
        onClick={() => setShowActiveDebates((prev) => !prev)}
      >
        <FontAwesomeIcon icon={faFire} /> Top Debates
      </button>
    )}

    <div className={`${styles.topNodesOverlay} ${showActiveDebates ? styles.visible : ''}`}>
      <h3>
        <span><FontAwesomeIcon icon={faFire} /> Active Debates</span>
        <button
          type="button"
          className={styles.minimizeBtn}
          aria-label="Minimize active debates"
          onClick={() => setShowActiveDebates(false)}
        >
          <FontAwesomeIcon icon={faTimes} />
        </button>
      </h3>
      {topNodes.map((node, index) => (
        <button
          key={`${node.id || node.name}-${index}`}
          type="button"
          className={styles.topNodeItem}
          onClick={(event) => {
            event.stopPropagation();
            onNodeClick(node);
          }}
        >
          <span className={styles.nodeTitle}>{node.name}</span>
          <div className={styles.nodeStats}>
            <span><FontAwesomeIcon icon={faThumbsUp} /> {calculateNetUpvotes(node.votes)}</span>
            <span><FontAwesomeIcon icon={faComment} /> {getAtlasCommentCount(node)}</span>
          </div>
        </button>
      ))}
    </div>
  </>
);

const OrbitalAtlasView = ({
  data,
  atlasRoot,
  containerRef,
  dimensions,
  handleAtlasNodeClick,
  handleBack,
  onNodeClick,
  showActiveDebates,
  setShowActiveDebates,
  topNodes,
}) => {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [startPan, setStartPan] = useState({ x: 0, y: 0 });
  const [hoveredNodeId, setHoveredNodeId] = useState(null);

  useEffect(() => {
    setOffset({ x: 0, y: 0 });
  }, [atlasRoot]);

  // --- Organic Layout Calculation ---
  const layout = useMemo(() => {
    const nodes = [];
    const links = [];

    // The "Virtual Root" is the global center point.
    const centerNode = getAtlasCenterNode(atlasRoot, data);

    nodes.push(buildAtlasRenderNode(centerNode, atlasRoot, 0, {
      isCenter: true,
      x: 0,
      y: 0,
    }));

    if (!centerNode.children) return { nodes, links };

    const isMobile = dimensions.w < 768;

    // LAYOUT CONFIGURATION
    // Fixed: Reduced desktop drill-down radius from 380 to 250 to prevent over-spreading
    const initialRadius = atlasRoot
        ? (isMobile ? 160 : 250)
        : (isMobile ? 110 : 150);

    const processRing = (parent, parentX, parentY, startAngle, endAngle, level) => {
       if (!parent.children || parent.children.length === 0) return;

       const count = parent.children.length;

       let availableAngle = endAngle - startAngle;
       let currentStartAngle = startAngle;

       if (level === 1) {
           availableAngle = Math.PI * 2;
           currentStartAngle = 0;
       }

       const angleStep = availableAngle / count;

       parent.children.forEach((child, i) => {
          let nodeX, nodeY, myAngle;

          if (level === 1) {
             myAngle = currentStartAngle + (i * angleStep) + (angleStep/2) - (Math.PI/2);
             nodeX = Math.cos(myAngle) * initialRadius;
             nodeY = Math.sin(myAngle) * initialRadius;
          } else {
             const angleFromParent = Math.atan2(parentY, parentX);
             let wedgeSize = (Math.PI * 0.8) / (level * 0.8);

             if (atlasRoot && !isMobile) {
                 wedgeSize = Math.PI / 1.5;
             }

             const wedgeStart = angleFromParent - (wedgeSize / 2);
             const wedgeStep = wedgeSize / (count + 1);

             myAngle = wedgeStart + (wedgeStep * (i + 1));

             const dist = isMobile ? 60 + (30/level) : 120;

             nodeX = parentX + Math.cos(myAngle) * dist;
             nodeY = parentY + Math.sin(myAngle) * dist;
          }

          const newNode = buildAtlasRenderNode(child, atlasRoot, level, {
            x: nodeX,
            y: nodeY,
          });
          nodes.push(newNode);

          if (parent.id !== 'virtual-root') {
              links.push({
                  source: { x: parentX, y: parentY },
                  target: { x: nodeX, y: nodeY }
              });
          }

          if (level < 3) {
             processRing(child, nodeX, nodeY, 0, 0, level + 1);
          }
       });
    };

    processRing(centerNode, 0, 0, 0, Math.PI * 2, 1);

    nodes.sort((a, b) => a.heat - b.heat);

    const disagreementScores = nodes
      .filter((node) => node.id !== 'virtual-root' && !node.isCenter)
      .map((node) => Number(node.disagreementScore) || 0);

    const disagreementRange = disagreementScores.length > 0
      ? {
        min: Math.min(...disagreementScores),
        max: Math.max(...disagreementScores),
      }
      : { min: 0, max: 0 };

    return { nodes, links, disagreementRange };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, atlasRoot, dimensions.w]);

  // Mouse/Touch Handlers
  const onMouseDown = (e) => { setIsDragging(true); setStartPan({ x: e.clientX - offset.x, y: e.clientY - offset.y }); };
  const onMouseMove = (e) => { if (!isDragging) return; setOffset({ x: e.clientX - startPan.x, y: e.clientY - startPan.y }); };
  const onMouseUp = () => setIsDragging(false);

  const onTouchStart = (e) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setStartPan({ x: e.touches[0].clientX - offset.x, y: e.touches[0].clientY - offset.y });
    }
  };
  const onTouchMove = (e) => {
    if (!isDragging) return;
    setOffset({ x: e.touches[0].clientX - startPan.x, y: e.touches[0].clientY - startPan.y });
  };
  const onTouchEnd = () => setIsDragging(false);

  const cx = dimensions.w / 2 + offset.x;
  const cy = dimensions.h / 2 + offset.y;
  const isMobile = dimensions.w < 768;

  return (
    <div
      ref={containerRef}
      className={styles.atlasViewContainer}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <AtlasChrome
        atlasRoot={atlasRoot}
        handleBack={handleBack}
        onNodeClick={onNodeClick}
        showActiveDebates={showActiveDebates}
        setShowActiveDebates={setShowActiveDebates}
        topNodes={topNodes}
      />

      <svg className={styles.atlasSvgLayer}>
        {layout.links.map((link, i) => (
          <line key={i} x1={cx + link.source.x} y1={cy + link.source.y} x2={cx + link.target.x} y2={cy + link.target.y} />
        ))}
      </svg>

      {layout.nodes.map((node, i) => {
        if (node.id === 'virtual-root') return null;

        const totalSize = calculateAtlasNodeSize(node, isMobile, layout.disagreementRange);

        const isHovered = hoveredNodeId === node.id;

        return (
          <div
            key={i}
            className={`${styles.atlasNode} ${styles[node.depthClass]} ${isHovered ? styles.hovered : ''}`}
            style={{
                left: cx + node.x,
                top: cy + node.y,
                zIndex: isHovered ? 200 : (node.isCenter ? 100 : undefined)
            }}
            data-testid={E2E_TESTIDS.ATLAS_NODE}
            data-ce-node-id={node.id}
            data-ce-node-layout={ATLAS_LAYOUT_MODES.ORBITAL}
            onClick={(e) => { e.stopPropagation(); handleAtlasNodeClick(node); }}
            onMouseEnter={() => setHoveredNodeId(node.id)}
            onMouseLeave={() => setHoveredNodeId(null)}
          >
            <div
              className={`${styles.nodeDot} ${node.heat > 10 ? styles.hot : ''}`}
              style={{ width: `${totalSize}px`, height: `${totalSize}px` }}
            >
               {(node.depth === 0 || node.isCenter) && <FontAwesomeIcon icon={faNetworkWired} />}
            </div>

            <div className={`${styles.nodeLabel} ${(node.depth === 0 || node.isCenter) ? styles.alwaysVisible : ''}`}>
                {node.name}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const PackedAtlasView = ({
  data,
  atlasRoot,
  containerRef,
  dimensions,
  handleAtlasNodeClick,
  handleBack,
  onNodeClick,
  showActiveDebates,
  setShowActiveDebates,
  topNodes,
}) => {
  const [hoveredNodeId, setHoveredNodeId] = useState(null);
  const [hoveredGroupId, setHoveredGroupId] = useState('');
  const isMobile = dimensions.w < 768;
  const packedTitle = atlasRoot ? String(atlasRoot?.name || '').trim() : '';
  const isTopLevelPackedView = !atlasRoot;

  const layout = useMemo(() => {
    const centerNode = atlasRoot
      ? {
        id: `${atlasRoot.id}::packed-inner-root`,
        name: atlasRoot.name,
        depth: atlasRoot.depth,
        children: Array.isArray(atlasRoot.children) ? atlasRoot.children : [],
      }
      : getAtlasCenterNode(atlasRoot, data);
    const inset = isMobile ? 12 : 18;
    const headerHeight = atlasRoot ? (isMobile ? 52 : 46) : 0;
    const packLayout = d3Pack()
      .size([
        Math.max(dimensions.w - (inset * 2), 1),
        Math.max(dimensions.h - (inset * 2) - headerHeight, 1),
      ])
      .padding(isMobile ? 4 : 8);

    // Only leaves contribute a direct size signal so parent circles scale from
    // their subtree instead of double-counting their own disagreement score.
    const hierarchy = d3Hierarchy(centerNode, (node) => (
      Array.isArray(node?.children) && node.children.length > 0 ? node.children : null
    ))
      .sum((node) => calculateAtlasPackValue(node))
      .sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0));

    const packedRoot = packLayout(hierarchy);

    const nodes = packedRoot.descendants()
      .filter((node) => node.depth > 0)
      .map((node) => buildAtlasRenderNode(node.data, atlasRoot, node.depth, {
        isCenter: false,
        x: node.x + inset,
        y: node.y + inset + headerHeight,
        r: node.r,
        groupId: getPackedAtlasGroupId(node),
      }))
      .sort((a, b) => {
        if (a.hierarchyDepth !== b.hierarchyDepth) return a.hierarchyDepth - b.hierarchyDepth;
        return Number(b.r || 0) - Number(a.r || 0);
      });

    return { nodes };
  }, [atlasRoot, data, dimensions.h, dimensions.w, isMobile]);

  return (
    <div ref={containerRef} className={`${styles.atlasViewContainer} ${styles.packedAtlasViewContainer}`}>
      <AtlasChrome
        atlasRoot={atlasRoot}
        handleBack={handleBack}
        onNodeClick={onNodeClick}
        showActiveDebates={showActiveDebates}
        setShowActiveDebates={setShowActiveDebates}
        topNodes={topNodes}
      />

      {packedTitle && (
        <div className={styles.packedAtlasTitleRow}>
          <button
            type="button"
            className={styles.packedAtlasTitleButton}
            data-testid={E2E_TESTIDS.ATLAS_TITLE_ACTION}
            data-ce-node-id={atlasRoot?.id || ''}
            aria-label={`Open ${packedTitle}`}
            title={`Open ${packedTitle}`}
            onClick={() => onNodeClick(atlasRoot)}
          >
            <span className={styles.packedAtlasTitle}>{packedTitle}</span>
            <FontAwesomeIcon icon={faExternalLinkAlt} className={styles.packedAtlasTitleIcon} />
          </button>
        </div>
      )}

      {layout.nodes.map((node) => {
        const diameter = Math.max((Number(node.r) || 0) * 2, 0);
        const isHovered = hoveredNodeId === node.id;
        const isTopLevelGroupNode = isTopLevelPackedView && node.hierarchyDepth === 1;
        const groupId = String(node.groupId || node.id || '').trim();
        const isHoveredGroup = Boolean(groupId) && hoveredGroupId === groupId;
        const showChildLabelsForGroup = isTopLevelPackedView
          && isHoveredGroup
          && hoveredNodeId !== groupId;
        const alwaysVisible = isTopLevelPackedView
          ? (
            isTopLevelGroupNode
              ? !showChildLabelsForGroup
              : node.hierarchyDepth === 2 && showChildLabelsForGroup
          )
          : shouldAlwaysShowPackedLabel(node);

        return (
          <div
            key={node.id}
            className={`${styles.atlasNode} ${styles.packedAtlasNode} ${styles[node.depthClass]} ${isHovered ? styles.hovered : ''}`}
            style={{
              left: node.x,
              top: node.y,
              zIndex: node.isCenter ? 120 : (isHovered ? 140 : 20 + node.hierarchyDepth),
            }}
            data-testid={E2E_TESTIDS.ATLAS_NODE}
            data-ce-node-id={node.id}
            data-ce-node-layout={ATLAS_LAYOUT_MODES.PACKED}
            onClick={(event) => {
              event.stopPropagation();
              handleAtlasNodeClick(node);
            }}
            onMouseEnter={() => {
              setHoveredNodeId(node.id);
              setHoveredGroupId(groupId);
            }}
            onMouseLeave={() => {
              setHoveredNodeId((currentValue) => (
                currentValue === node.id ? null : currentValue
              ));
              setHoveredGroupId((currentValue) => (
                currentValue === groupId ? '' : currentValue
              ));
            }}
          >
            <div
              className={`${styles.nodeDot} ${styles.packedNodeDot} ${node.heat > 10 ? styles.hot : ''}`}
              style={{ width: `${diameter}px`, height: `${diameter}px` }}
            >
              <div className={`${styles.nodeLabel} ${styles.packedNodeLabel} ${alwaysVisible ? styles.alwaysVisible : ''}`}>
                {node.name}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export const AtlasView = ({ data, onNodeClick, atlasLayoutMode = ATLAS_LAYOUT_MODES.ORBITAL }) => {
  const { containerRef, dimensions } = useAtlasContainerDimensions(atlasLayoutMode);
  const {
    atlasRoot,
    showActiveDebates,
    setShowActiveDebates,
    topNodes,
    handleAtlasNodeClick,
    handleBack,
  } = useAtlasNavigationState(data, onNodeClick);

  if (atlasLayoutMode === ATLAS_LAYOUT_MODES.PACKED) {
    return (
      <PackedAtlasView
        data={data}
        atlasRoot={atlasRoot}
        containerRef={containerRef}
        dimensions={dimensions}
        handleAtlasNodeClick={handleAtlasNodeClick}
        handleBack={handleBack}
        onNodeClick={onNodeClick}
        showActiveDebates={showActiveDebates}
        setShowActiveDebates={setShowActiveDebates}
        topNodes={topNodes}
      />
    );
  }

  return (
    <OrbitalAtlasView
      data={data}
      atlasRoot={atlasRoot}
      containerRef={containerRef}
      dimensions={dimensions}
      handleAtlasNodeClick={handleAtlasNodeClick}
      handleBack={handleBack}
      onNodeClick={onNodeClick}
      showActiveDebates={showActiveDebates}
      setShowActiveDebates={setShowActiveDebates}
      topNodes={topNodes}
    />
  );
};

// 2. Flat Node (Search/List View)
const FlatNode = ({ node, parentPath = [], onNodeClick, onBookmark, bookmarkedNodes }) => {
  const netUpvotes = calculateNetUpvotes(node.votes);
  const isBookmarked = bookmarkedNodes.includes(node.id);
  const commentCount = (node.questions ? node.questions.length : 0) + (node.comments ? node.comments.length : 0);

  return (
    <div className={styles.flatNodeContainer}>
      <div className={styles.pathContainer}>
        {parentPath.map((p, index) => (
          <React.Fragment key={p.id}>
             <button
               className={`${styles.pathButton} ${styles[`depth${index}`]}`}
               onClick={() => onNodeClick(p)}
             >
               {p.name}
             </button>
             <FontAwesomeIcon icon={faChevronRight} className={styles.pathSeparator} />
          </React.Fragment>
        ))}
        <button
           className={`${styles.pathButton} ${styles[`depth${parentPath.length}`]}`}
           onClick={() => onNodeClick(node)}
        >
           {node.name}
        </button>
      </div>

      <div className={styles.metaInfo}>
        <span className={styles.upvotes}><FontAwesomeIcon icon={faThumbsUp} /> {netUpvotes}</span>
        <span className={styles.comments}><FontAwesomeIcon icon={faComment} /> {commentCount}</span>
        <FontAwesomeIcon
          icon={faBookmark}
          className={`${styles.bookmark} ${isBookmarked ? styles.bookmarked : ''}`}
          onClick={(e) => { e.stopPropagation(); onBookmark(node.id); }}
        />
        <FontAwesomeIcon icon={faChevronRight} className={styles.expandIcon} onClick={() => onNodeClick(node)} />
      </div>
    </div>
  );
};

// 3. Detail Modal
const Modal = ({
  isOpen,
  onClose,
  content,
  onVote,
  copied,
  onCopy,
  onTagClick,
}) => {
  const [activeVoteType, setActiveVoteType] = useState(null); // 'up' | 'down' | null
  const [voteCount, setVoteCount] = useState("");
  const [showVoteBreakdown, setShowVoteBreakdown] = useState(false);
  const [compassOpen, setCompassOpen] = useState(true);
  const [argumentsOpen, setArgumentsOpen] = useState(true);
  const [historicalCasesOpen, setHistoricalCasesOpen] = useState(true);
  const [expandedHistoricalCaseId, setExpandedHistoricalCaseId] = useState('');
  const [questionsOpen, setQuestionsOpen] = useState(false);

  useEffect(() => {
    setCompassOpen(true);
    setArgumentsOpen(false);
    setHistoricalCasesOpen(true);
    setExpandedHistoricalCaseId('');
    setQuestionsOpen(false);
  }, [content?.id]);

  const getUserAvatar = (username) => (
    getHistoricalFigureAvatarOrBlockie(username, {
      preferBlockie: false,
      fallbackSeed: username || 'atlas-comment-user',
    })
  );
  const handleUserAvatarError = (event, username) => {
    const target = event?.currentTarget;
    if (!target) return;
    const fallbackSrc = getHistoricalFigureBlockie(username, {
      fallbackSeed: username || 'atlas-comment-user',
    });
    if (!fallbackSrc || target.src === fallbackSrc) return;
    target.src = fallbackSrc;
  };

  const handleCollapseHeaderKeyDown = (event, toggle) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggle();
    }
  };

  const normalizeQuestionType = (questionType) => {
    const normalized = String(questionType || '')
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, '');

    if (normalized === 'multiplechoice') return 'multichoice';
    if (normalized === 'openended' || normalized === 'textarea' || normalized === 'text') {
      return 'freeform';
    }
    return normalized || 'freeform';
  };

  const getQuestionTypeLabel = (questionType) => {
    switch (normalizeQuestionType(questionType)) {
      case 'binary':
        return 'Binary';
      case 'rating':
        return 'Rating';
      case 'multichoice':
        return 'Multiple Choice';
      case 'freeform':
        return 'Freeform';
      default:
        return 'Question';
    }
  };

  const getQuestionOptions = (question) => {
    const rawOptions = question?.options;

    const normalizeOptions = (options) => (
      options
        .map((option) => {
          if (typeof option === 'string') return option.trim();
          if (typeof option === 'number') return String(option);
          if (option && typeof option === 'object') {
            return String(option.label || option.text || option.value || option.option || '').trim();
          }
          return '';
        })
        .filter(Boolean)
    );

    if (Array.isArray(rawOptions)) {
      return normalizeOptions(rawOptions);
    }

    if (typeof rawOptions === 'string') {
      const trimmedOptions = rawOptions.trim();
      if (!trimmedOptions) return [];

      try {
        const parsed = JSON.parse(trimmedOptions);
        if (Array.isArray(parsed)) {
          return normalizeOptions(parsed);
        }

        return [];
      } catch {
        if (/^[[{]/.test(trimmedOptions)) {
          return [];
        }
      }

      return trimmedOptions
        .split(/\r?\n|,/)
        .map((option) => option.trim())
        .filter(Boolean);
    }

    return [];
  };

  const renderQuestionPreview = (question) => {
    const questionType = normalizeQuestionType(question?.questionType || question?.type);

    if (questionType === 'binary') {
      return (
        <div className={styles.binaryPills} aria-hidden="true">
          <span>Agree</span>
          <span>Unsure</span>
          <span>Disagree</span>
        </div>
      );
    }

    if (questionType === 'rating') {
      return (
        <div className={styles.ratingScale} aria-hidden="true">
          {Array.from({ length: 11 }, (_, value) => (
            <span key={value}>
              <span />
              <span>{value}</span>
            </span>
          ))}
        </div>
      );
    }

    if (questionType === 'multichoice') {
      const options = getQuestionOptions(question);
      if (options.length === 0) {
        return <div className={styles.optionsUnavailable}>Options unavailable</div>;
      }

      return (
        <div className={styles.multichoiceOptions} aria-hidden="true">
          {options.map((option, optionIndex) => (
            <div key={`${option}-${optionIndex}`}>
              <span />
              <span>{option}</span>
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className={styles.freeformArea} aria-hidden="true">
        <span>Type your response...</span>
      </div>
    );
  };

  const handleCastVotes = () => {
    if (!activeVoteType || !voteCount) return;
    onVote(content.id, activeVoteType, parseInt(voteCount) || 0);
    setVoteCount("");
    setActiveVoteType(null);
  };

  const compassData = useMemo(() => {
    if (!content?.compass) return null;

    return {
      ...content.compass,
      points: buildHistoricalCompassPoints(content.historicalVotes, content.compass.points, content.id),
    };
  }, [content]);

  if (!isOpen || !content) return null;

  const questions = Array.isArray(content.questions) ? content.questions : [];
  const argumentData = content?.arguments && typeof content.arguments === 'object'
    ? content.arguments
    : null;
  const proArguments = Array.isArray(argumentData?.pro) ? argumentData.pro : [];
  const conArguments = Array.isArray(argumentData?.con) ? argumentData.con : [];
  const argumentVotes = argumentData?.votes && typeof argumentData.votes === 'object'
    ? argumentData.votes
    : {};
  const hasArguments = Boolean(argumentData);
  const totalArgumentCount = proArguments.length + conArguments.length;
  const questionCount = questions.length;
  const historicalCases = Array.isArray(content.historicalCases) ? content.historicalCases : [];
  const historicalCaseCount = historicalCases.length;
  const compassTitle = content?.compass?.xAxis?.label || content?.name || 'Compass';

  // Logic for Depth Label and Styling
  const depthLabels = ["Category", "Sub-Category", "Topic", "Instance"];
  const depthIndex = content.depth !== undefined ? content.depth : (content.parentPath ? content.parentPath.length : 0);
  const depthLabel = depthLabels[Math.min(depthIndex, 3)] || "Node";
  const depthClass = `depth${Math.min(depthIndex, 3)}`; // used for color mapping

  const tags = ["AI Safety", "Policy"];

  // Calculate Counts from Content
  const upVotes = parseInt(content.votes?.up || 0);
  const downVotes = parseInt(content.votes?.down || 0);
  const netVotes = upVotes - downVotes;

  const renderVoterAvatars = (argumentId) => {
    const voters = Array.isArray(argumentVotes?.[argumentId])
      ? [...new Set(argumentVotes[argumentId].filter(Boolean))]
      : [];

    if (voters.length === 0) return null;

    const visibleVoters = voters.slice(0, 5);
    const overflowCount = Math.max(voters.length - visibleVoters.length, 0);
    const overflowLabel = overflowCount > 0
      ? voters.slice(visibleVoters.length).join(', ')
      : '';

    return (
      <div
        className={styles.voterAvatars}
        title={voters.join(', ')}
        aria-label={`Supported by ${voters.join(', ')}`}
      >
        {visibleVoters.map((voter, index) => (
          <img
            key={`${argumentId}-${voter}`}
            src={getUserAvatar(voter)}
            alt={`${voter} avatar`}
            title={voter}
            style={{ zIndex: visibleVoters.length - index }}
            onError={(event) => handleUserAvatarError(event, voter)}
          />
        ))}
        {overflowCount > 0 && (
          <span title={overflowLabel}>
            +{overflowCount}
          </span>
        )}
      </div>
    );
  };

  const renderArgumentCard = (argument, side, treeKey) => {
    if (!argument || typeof argument !== 'object') return null;

    const claim = String(argument.claim || '').trim();
    if (!claim) return null;

    const numericStrength = Number(argument.strength);
    const clampedStrength = Math.max(1, Math.min(10, Number.isFinite(numericStrength) ? numericStrength : 5));
    const strengthPercent = `${clampedStrength * 10}%`;
    const source = String(argument.source || '').trim();
    const children = Array.isArray(argument.children) ? argument.children : [];

    return (
      <div key={treeKey} className={styles.argumentCard} data-side={side}>
        <div className={styles.argumentClaim}>{claim}</div>
        <div
          className={styles.argumentStrength}
          title={`Strength ${clampedStrength}/10`}
          aria-label={`Strength ${clampedStrength} out of 10`}
        >
          <span style={{ width: strengthPercent }} />
        </div>
        {source && (
          <div className={styles.argumentSource}>
            {source}
          </div>
        )}
        {renderVoterAvatars(argument.id)}
        {children.length > 0 && (
          <div className={styles.argumentChildren}>
            {children.map((childArgument, childIndex) => (
              renderArgumentCard(
                childArgument,
                side,
                `${treeKey}-${childArgument?.id || childIndex}`
              )
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderHistoricalCaseFieldRows = (rows = []) => {
    if (!Array.isArray(rows) || rows.length === 0) return null;

    return (
      <div className={styles.historicalCaseFactList}>
        {rows.map((row, rowIndex) => (
          <div
            key={`${row.label}-${rowIndex}`}
            className={styles.historicalCaseFactRow}
          >
            <div className={styles.historicalCaseFactLabel}>{row.label}</div>
            <div className={styles.historicalCaseFactValue}>{row.value}</div>
          </div>
        ))}
      </div>
    );
  };

  const renderHistoricalCaseCard = (historicalCase, caseIndex) => {
    if (!historicalCase || typeof historicalCase !== 'object') return null;

    const title = String(historicalCase.title || historicalCase.id || '').trim();
    if (!title) return null;

    const authors = normalizeHistoricalCaseTextList(historicalCase.authors);
    const tagsList = Array.isArray(historicalCase.tags)
      ? historicalCase.tags.filter(Boolean)
      : [];
    const caseKey = historicalCase.id || `${title}-${caseIndex}`;
    const isExpanded = expandedHistoricalCaseId === caseKey;
    const detailPanelId = `historical-case-${caseKey}`;
    const brief = buildHistoricalCaseBrief(historicalCase, content);
    const metaBits = [
      historicalCase.category,
      authors.length > 0 ? authors.join(', ') : '',
      historicalCase.venue,
      historicalCase.year,
    ].filter(Boolean);
    const normalizedBestPatch = String(brief.bestPatch || '').trim().toLowerCase();
    const hasBestPatchCard = Boolean(normalizedBestPatch)
      && brief.patchOptions.some((patch) => String(patch?.name || '').trim().toLowerCase() === normalizedBestPatch);

    return (
      <div
        key={caseKey}
        className={styles.historicalCaseCard}
        data-testid={E2E_TESTIDS.ATLAS_HISTORICAL_CASE_CARD}
        data-ce-case-id={caseKey}
      >
        <div className={styles.historicalCaseHeader}>
          <div>
            <div className={styles.historicalCaseTitle}>{title}</div>
            {metaBits.length > 0 && (
              <div className={styles.historicalCaseMeta}>
                {metaBits.join(' • ')}
              </div>
            )}
          </div>
          <div className={styles.historicalCaseActions}>
            <button
              type="button"
              className={styles.historicalCaseExpandButton}
              aria-expanded={isExpanded}
              aria-controls={detailPanelId}
              data-testid={E2E_TESTIDS.ATLAS_HISTORICAL_CASE_EXPAND}
              data-ce-case-id={caseKey}
              onClick={() => setExpandedHistoricalCaseId((currentValue) => (
                currentValue === caseKey ? '' : caseKey
              ))}
            >
              {isExpanded ? 'Hide brief' : 'View full brief'}
            </button>
            {historicalCase.url ? (
              <a
                href={historicalCase.url}
                rel="noopener noreferrer"
                target="_blank"
                className={styles.historicalCaseSource}
              >
                {historicalCase.source_label || 'Source'}
              </a>
            ) : null}
          </div>
        </div>
        {historicalCase.summary ? (
          <div className={styles.historicalCaseSummary}>
            {historicalCase.summary}
          </div>
        ) : null}
        {isExpanded && (
          <div
            id={detailPanelId}
            className={styles.historicalCaseDetail}
            data-testid={E2E_TESTIDS.ATLAS_HISTORICAL_CASE_DETAIL}
            data-ce-case-id={caseKey}
          >
            <div className={styles.historicalCaseDetailBlock}>
              <div className={styles.historicalCaseDetailLabel}>Moral principles</div>
              {brief.figurePrinciples.length > 0 ? (
                <div className={styles.historicalCasePrinciplesGrid}>
                  {brief.figurePrinciples.map((figureEntry) => (
                    <div
                      key={`${caseKey}-${figureEntry.name}`}
                      className={styles.historicalCasePrinciplesCard}
                    >
                      <div className={styles.historicalCasePrinciplesName}>{figureEntry.name}</div>
                      {figureEntry.principles.length > 0 ? (
                        <ul className={styles.historicalCasePrinciplesList}>
                          {figureEntry.principles.map((principle, principleIndex) => (
                            <li key={`${figureEntry.name}-${principleIndex}`}>{principle}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className={styles.historicalCaseEmptyText}>
                          No figure-specific principles were attached to this case.
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className={styles.historicalCaseEmptyText}>
                  No figure-specific principles were attached to this case.
                </p>
              )}
            </div>
            <div className={styles.historicalCaseDetailBlock}>
              <div className={styles.historicalCaseDetailLabel}>Draft legal code</div>
              {brief.draftLegalCode && typeof brief.draftLegalCode === 'object' && Array.isArray(brief.draftLegalCode.articles) ? (
                <div className={styles.historicalCaseArticleList}>
                  {brief.draftLegalCode.articles.map((article, articleIndex) => (
                    <div
                      key={`${caseKey}-article-${articleIndex}`}
                      className={styles.historicalCaseArticleItem}
                    >
                      <div className={styles.historicalCaseArticleLabel}>{article.label}</div>
                      <div className={styles.historicalCaseArticleBody}>{article.body}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p>{typeof brief.draftLegalCode === 'string' ? brief.draftLegalCode : ''}</p>
              )}
            </div>
            <div className={styles.historicalCaseDetailBlock}>
              <div className={styles.historicalCaseDetailLabel}>Adversarial attack</div>
              {brief.adversarialAttack?.panels?.length > 0 ? (
                <div className={styles.historicalCaseExploitGrid}>
                  {brief.adversarialAttack.panels.map((panel) => (
                    <div
                      key={`${caseKey}-${panel.title}`}
                      className={`${styles.historicalCaseExploitSection} ${
                        panel.tone === 'secondary'
                          ? styles.historicalCaseExploitSecondary
                          : styles.historicalCaseExploitPrimary
                      }`}
                    >
                      <div className={styles.historicalCaseExploitHeading}>{panel.title}</div>
                      {renderHistoricalCaseFieldRows(panel.rows)}
                    </div>
                  ))}
                </div>
              ) : (
                <p>{brief.adversarialAttack?.fallbackText || ''}</p>
              )}
            </div>
            {brief.whyHard ? (
              <div className={`${styles.historicalCaseDetailBlock} ${styles.historicalCaseInsightBlock}`}>
                <div className={styles.historicalCaseDetailLabel}>Why this case is hard</div>
                <p>{brief.whyHard}</p>
              </div>
            ) : null}
            <div className={styles.historicalCaseDetailBlock}>
              <div className={styles.historicalCaseDetailLabel}>Judge tension</div>
              <p>{brief.judgeTension}</p>
            </div>
            {brief.precedentPressure.length > 0 ? (
              <div className={`${styles.historicalCaseDetailBlock} ${styles.historicalCasePrecedentBlock}`}>
                <div className={styles.historicalCaseDetailLabel}>Precedent pressure</div>
                {renderHistoricalCaseFieldRows(brief.precedentPressure)}
              </div>
            ) : null}
            {brief.patchOptions.length > 0 ? (
              <div className={`${styles.historicalCaseDetailBlock} ${styles.historicalCasePatchOptionsBlock}`}>
                <div className={styles.historicalCaseSectionHeader}>
                  <div className={styles.historicalCaseDetailLabel}>Patch options</div>
                  {brief.bestPatch ? (
                    <div className={styles.historicalCaseBestPatchPill}>
                      Best patch: {brief.bestPatch}
                    </div>
                  ) : null}
                </div>
                <div className={styles.historicalCasePatchGrid}>
                  {brief.patchOptions.map((patch, patchIndex) => (
                    <div
                      key={`${patch.id}-${patchIndex}`}
                      className={`${styles.historicalCasePatchCard} ${
                        normalizedBestPatch && patch.name.trim().toLowerCase() === normalizedBestPatch
                          ? styles.historicalCasePatchCardBest
                          : ''
                      }`}
                      data-testid={E2E_TESTIDS.ATLAS_HISTORICAL_CASE_PATCH_CARD}
                      data-ce-case-id={caseKey}
                      data-ce-patch-kind={
                        normalizedBestPatch && patch.name.trim().toLowerCase() === normalizedBestPatch
                          ? 'best'
                          : 'option'
                      }
                    >
                      {normalizedBestPatch && patch.name.trim().toLowerCase() === normalizedBestPatch ? (
                        <div className={styles.historicalCasePatchBadge}>Best patch</div>
                      ) : null}
                      <div className={styles.historicalCasePatchName}>{patch.name}</div>
                      {patch.summary ? <p>{patch.summary}</p> : null}
                      {patch.favoredBy.length > 0 ? (
                        <div className={styles.historicalCasePatchFavoredBy}>
                          <span>Favored by</span>
                          <div className={styles.historicalCasePatchFavoredByList}>
                            {patch.favoredBy.map((favoredByEntry, favoredByIndex) => (
                              <span key={`${patch.id}-favored-${favoredByIndex}`}>
                                {favoredByEntry}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {brief.bestPatch && !hasBestPatchCard ? (
              <div className={styles.historicalCaseDetailBlock}>
                <div className={styles.historicalCaseDetailLabel}>Best patch</div>
                <p>{brief.bestPatch}</p>
              </div>
            ) : null}
            {brief.whyOtherFails ? (
              <div className={styles.historicalCaseDetailBlock}>
                <div className={styles.historicalCaseDetailLabel}>Why the runner-up fails</div>
                <p>{brief.whyOtherFails}</p>
              </div>
            ) : null}
            <div className={`${styles.historicalCaseDetailBlock} ${styles.historicalCaseDecisionBlock}`}>
              <div className={styles.historicalCaseDetailLabel}>Open question</div>
              <p>{brief.decisionPrompt}</p>
            </div>
          </div>
        )}
        {tagsList.length > 0 ? (
          <div className={styles.historicalCaseTags}>
            {tagsList.map((tag, tagIndex) => (
              <span key={`${historicalCase.id || title}-${tag}-${tagIndex}`}>
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={e => e.stopPropagation()}>

        {/* --- HEADER --- */}
        <div className={styles.modalHeader}>
          {/* Left: Title + Link Button */}
          <div className={styles.titleSection}>
             <h2 className={styles.modalTitle}>{content.name}</h2>
             <button className={styles.linkButton} onClick={onCopy} title="Copy Deep Link URL">
                <FontAwesomeIcon icon={copied ? faCheck : faLink} />
             </button>
          </div>

          {/* Center: Compact Vote Controls */}
          <div className={styles.headerVoteSection}>
            {activeVoteType === null ? (
                <div className={styles.voteDisplay}>
                   <div
                      className={`${styles.voteArrow} ${styles.up}`}
                      onClick={() => setActiveVoteType('up')}
                      title="Cast Upvotes"
                   >
                     <FontAwesomeIcon icon={faArrowUp} />
                   </div>

                   <div
                      className={styles.netScoreContainer}
                      onMouseEnter={() => setShowVoteBreakdown(true)}
                      onMouseLeave={() => setShowVoteBreakdown(false)}
                      onClick={() => setShowVoteBreakdown(!showVoteBreakdown)}
                   >
                      <span className={styles.netScoreValue}>{netVotes}</span>

                      {/* Hover Breakdown Tooltip */}
                      <div className={`${styles.voteBreakdown} ${showVoteBreakdown ? styles.visible : ''}`}>
                          <span className={styles.breakdownUp}>+{upVotes}</span>
                          <span className={styles.breakdownDivider}>/</span>
                          <span className={styles.breakdownDown}>-{downVotes}</span>
                      </div>
                   </div>

                   <div
                      className={`${styles.voteArrow} ${styles.down}`}
                      onClick={() => setActiveVoteType('down')}
                      title="Cast Downvotes"
                   >
                     <FontAwesomeIcon icon={faArrowDown} />
                   </div>
                </div>
            ) : (
                <div className={`${styles.voteInputContainer} ${activeVoteType === 'up' ? styles.isUp : styles.isDown}`}>
                    <input
                      type="number"
                      autoFocus
                      className={styles.voteInput}
                      value={voteCount}
                      onChange={(e) => setVoteCount(e.target.value)}
                      placeholder="#"
                      min="0"
                      onKeyDown={(e) => e.key === 'Enter' && handleCastVotes()}
                    />
                    <button className={styles.confirmBtn} onClick={handleCastVotes}>
                        <FontAwesomeIcon icon={faCheck} />
                    </button>
                    <button
                      className={styles.cancelBtn}
                      onClick={() => { setActiveVoteType(null); setVoteCount(""); }}
                    >
                      <FontAwesomeIcon icon={faTimes} />
                    </button>
                </div>
            )}
          </div>

          {/* Right: Close Control Only */}
          <div className={styles.modalControls}>
             <button className={styles.closeIcon} onClick={onClose} title="Close">
                <FontAwesomeIcon icon={faTimes} />
             </button>
          </div>
        </div>

        {/* --- TAGS SECTION (Depth Label Moved Here) --- */}
        <div className={styles.modalTags}>
          {/* Depth Label First - Distinct Styling */}
          <span className={`${styles.depthTag} ${styles[depthClass]}`}>
            {depthLabel}
          </span>

          {/* Generic Tags */}
          {tags.map((t, i) => (
             <button
                key={i}
                className={`${styles.tag} ${styles.clickable}`}
                onClick={() => onTagClick && onTagClick(t)}
                title={`Go to ${t}`}
             >
               {t}
             </button>
          ))}
        </div>

        {compassData && (
          <div className={styles.collapseSection}>
            <div
              className={styles.collapseHeader}
              onClick={() => setCompassOpen(!compassOpen)}
              role="button"
              tabIndex={0}
              aria-expanded={compassOpen}
              onKeyDown={(event) => handleCollapseHeaderKeyDown(event, () => setCompassOpen(!compassOpen))}
            >
              <FontAwesomeIcon icon={compassOpen ? faCaretUp : faCaretDown} style={{ marginRight: 6 }} />
              <span>{compassTitle}</span>
              <span className={styles.collapseToggle}>{compassOpen ? 'Hide' : 'Show'}</span>
            </div>
            {compassOpen && (
              <div className={`${styles.collapseContent} ${styles.compassSection}`}>
                <div className={styles.compassContainer}>
                  <React.Suspense fallback={null}>
                    <StandalonePoliticalCompass compass={compassData} />
                  </React.Suspense>
                </div>
              </div>
            )}
          </div>
        )}

        {hasArguments && (
          <div className={styles.collapseSection}>
            <div
              className={styles.collapseHeader}
              onClick={() => setArgumentsOpen(!argumentsOpen)}
              role="button"
              tabIndex={0}
              aria-expanded={argumentsOpen}
              onKeyDown={(event) => handleCollapseHeaderKeyDown(event, () => setArgumentsOpen(!argumentsOpen))}
            >
              <FontAwesomeIcon icon={argumentsOpen ? faCaretUp : faCaretDown} style={{ marginRight: 6 }} />
              <span>Key Arguments</span>
              {totalArgumentCount ? <span className={styles.collapseCount}>({totalArgumentCount})</span> : null}
              <span className={styles.collapseToggle}>{argumentsOpen ? 'Hide' : 'Show'}</span>
            </div>
            {argumentsOpen && (
              <div className={`${styles.collapseContent} ${styles.argumentsSection}`}>
                <div className={styles.argumentColumns}>
                  <div className={styles.argumentColumn} data-side="pro">
                    <h4>For</h4>
                    {proArguments.map((argument, index) => (
                      renderArgumentCard(argument, 'pro', `pro-${argument?.id || index}`)
                    ))}
                  </div>
                  <div className={styles.argumentColumn} data-side="con">
                    <h4>Against</h4>
                    {conArguments.map((argument, index) => (
                      renderArgumentCard(argument, 'con', `con-${argument?.id || index}`)
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {historicalCaseCount > 0 && (
          <div className={styles.collapseSection}>
            <div
              className={styles.collapseHeader}
              onClick={() => setHistoricalCasesOpen(!historicalCasesOpen)}
              role="button"
              tabIndex={0}
              aria-expanded={historicalCasesOpen}
              onKeyDown={(event) => handleCollapseHeaderKeyDown(event, () => setHistoricalCasesOpen(!historicalCasesOpen))}
            >
              <FontAwesomeIcon icon={historicalCasesOpen ? faCaretUp : faCaretDown} style={{ marginRight: 6 }} />
              <span>Historical Cases</span>
              {historicalCaseCount ? <span className={styles.collapseCount}>({historicalCaseCount})</span> : null}
              <span className={styles.collapseToggle}>{historicalCasesOpen ? 'Hide' : 'Show'}</span>
            </div>
            {historicalCasesOpen && (
              <div className={`${styles.collapseContent} ${styles.historicalCasesSection}`}>
                {historicalCases.map((historicalCase, caseIndex) => (
                  renderHistoricalCaseCard(historicalCase, caseIndex)
                ))}
              </div>
            )}
          </div>
        )}

        {questionCount > 0 && (
          <div className={styles.collapseSection}>
            <div
              className={styles.collapseHeader}
              onClick={() => setQuestionsOpen(!questionsOpen)}
              role="button"
              tabIndex={0}
              aria-expanded={questionsOpen}
              onKeyDown={(event) => handleCollapseHeaderKeyDown(event, () => setQuestionsOpen(!questionsOpen))}
            >
              <FontAwesomeIcon icon={questionsOpen ? faCaretUp : faCaretDown} style={{ marginRight: 6 }} />
              <span>Questions</span>
              {questionCount ? <span className={styles.collapseCount}>({questionCount})</span> : null}
              <span className={styles.collapseToggle}>{questionsOpen ? 'Hide' : 'Show'}</span>
            </div>
            {!questionsOpen && (
              <div className={styles.collapseSearchText} aria-hidden="true">
                {questions.map((q, i) => (
                  <span key={`${q.id || 'question'}-search-${i}`}>
                    {q.question || q.prompt || 'Untitled question'}
                  </span>
                ))}
              </div>
            )}
            {questionsOpen && (
              <div className={`${styles.collapseContent} ${styles.questionsSection}`}>
                {questions.map((q, i) => {
                  const questionType = normalizeQuestionType(q.questionType || q.type);
                  const questionText = q.question || q.prompt || 'Untitled question';
                  const questionAuthor = q.username ? String(q.username).trim() : '';
                  const authorAvatar = questionAuthor ? getUserAvatar(questionAuthor) : '';

                  return (
                    <div key={`${q.id}-${i}`} className={styles.pileCard} data-type={questionType}>
                      <div className={styles.pileCardHeader}>
                        <div>
                          <div className={styles.questionText}>{questionText}</div>
                          {questionAuthor && (
                            <div className={styles.questionMeta}>
                              {authorAvatar ? (
                                <img
                                  src={authorAvatar}
                                  alt={`${questionAuthor} avatar`}
                                  onError={(event) => handleUserAvatarError(event, questionAuthor)}
                                />
                              ) : null}
                              <span>By {questionAuthor}</span>
                            </div>
                          )}
                        </div>
                        <div className={styles.typeBadge} data-type={questionType}>
                          {getQuestionTypeLabel(questionType)}
                        </div>
                      </div>
                      <div className={styles.pileCardBody}>
                        {renderQuestionPreview(q)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// 4. Suggest Node Modal
const SuggestNodeModal = ({ isOpen, onClose, parentNode, parentPath = [], onSubmit }) => {
  const [title, setTitle] = useState("");
  const handleSubmit = () => { onSubmit(parentNode, title); setTitle(""); onClose(); };

  if (!isOpen) return null;
  const lineage = [...parentPath, parentNode].filter(Boolean);

  return (
    <div className={styles.modalOverlay}>
      <div className={`${styles.modalContent} ${styles.suggestModalContainer}`}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Suggest New Topic</h2>
          <div className={styles.closeIcon} onClick={onClose}><FontAwesomeIcon icon={faTimes} /></div>
        </div>

        <div className={styles.lineageDisplay}>
            <span className={styles.lineageLabel}>Path:</span>
            {lineage.map((node, i) => (
                <span key={i} className={styles.lineageItem}>
                    {node.name} {i < lineage.length - 1 && <FontAwesomeIcon icon={faChevronRight} className={styles.separator} />}
                </span>
            ))}
        </div>

        <div className={styles.suggestNodeContent}>
          <FormGroup>
            <Label for="nodeTitle">New Topic Title</Label>
            <Input
                id="nodeTitle"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. AI Liability Standards..."
                autoFocus
                className={styles.glassInput}
            />
          </FormGroup>
          <div className={styles.modalActions}>
             <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
             <button className={styles.submitBtn} onClick={handleSubmit} disabled={!title.trim()}>Submit Proposal</button>
          </div>
        </div>
      </div>
    </div>
  );
};

// 5. Tree Node (With Collapsibility)
const TreeNode = ({ node, depth = 0, parentPath = [], onNodeClick, onBookmark, bookmarkedNodes, onSuggestNode }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const hasChildren = node.children && node.children.length > 0;
  const netUpvotes = calculateNetUpvotes(node.votes);
  const isBookmarked = bookmarkedNodes.includes(node.id);

  return (
    <div className={styles.orgNodeWrapper}>
      <div
        className={`
          ${styles.orgCard}
          ${styles[`depth${Math.min(depth, 3)}`]}
          ${hasChildren ? styles.hasChildren : ''}
          ${isCollapsed ? styles.collapsed : ''}
        `}
        onClick={() => onNodeClick(node)}
      >
         <div className={styles.cardHeader}>
             <span className={styles.nodeTitle}>{node.name}</span>
         </div>
         <div className={styles.cardStats}>
             <span><FontAwesomeIcon icon={faThumbsUp} /> {netUpvotes}</span>
             <FontAwesomeIcon
               icon={faBookmark}
               className={`${styles.bookmark} ${isBookmarked ? styles.bookmarked : ''}`}
               onClick={(e) => { e.stopPropagation(); onBookmark(node.id); }}
             />
         </div>

         <div
           className={styles.suggestBtn}
           onClick={(e) => { e.stopPropagation(); onSuggestNode(node, parentPath); }}
           title="Suggest sub-topic"
         >
           <FontAwesomeIcon icon={faPlus} />
         </div>

         {hasChildren && (
            <div
              className={styles.collapseBtn}
              onClick={(e) => { e.stopPropagation(); setIsCollapsed(!isCollapsed); }}
              title={isCollapsed ? "Expand Branch" : "Collapse Branch"}
            >
              <FontAwesomeIcon icon={isCollapsed ? faCaretDown : faCaretUp} />
            </div>
         )}
      </div>

      {hasChildren && !isCollapsed && (
        <div className={styles.orgChildrenContainer}>
           <div className={styles.orgChildrenRow}>
              {[...node.children].sort((a, b) => calculateNetUpvotes(b.votes) - calculateNetUpvotes(a.votes)).map((child, i) => (
                <TreeNode
                  key={i}
                  node={child}
                  depth={depth + 1}
                  parentPath={[...parentPath, node]}
                  onNodeClick={onNodeClick}
                  onBookmark={onBookmark}
                  bookmarkedNodes={bookmarkedNodes}
                  onSuggestNode={onSuggestNode}
                />
              ))}
           </div>
        </div>
      )}
    </div>
  );
};

// 6. Legend
const Legend = () => (
  <div className={styles.legendContainer}>
    <div className={styles.legendItem}><div className={`${styles.legendDot} ${styles.category}`}></div><span className={styles.legendText}>Category</span></div>
    <div className={styles.legendItem}><div className={`${styles.legendDot} ${styles.subcategory}`}></div><span className={styles.legendText}>Sub-Category</span></div>
    <div className={styles.legendItem}><div className={`${styles.legendDot} ${styles.topic}`}></div><span className={styles.legendText}>Topic</span></div>
    <div className={styles.legendItem}><div className={`${styles.legendDot} ${styles.instance}`}></div><span className={styles.legendText}>Instance</span></div>
  </div>
);

// --- MAIN PARENT ---
const DebateMap = ({
  activeSessionSlug = '',
  demoMode: externalDemoMode = false,
  embedded = false,
  requestedModalNodeId = null,
  onModalClose = null,
  atlasLayoutMode = ATLAS_LAYOUT_MODES.PACKED,
}) => {
  const externalDemoEnabled = externalDemoMode && typeof externalDemoMode === 'object'
    ? !!externalDemoMode.tools
    : !!externalDemoMode;
  const urlDemoParam = typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('demo') === '1';
  const initialDemoEnabled = externalDemoEnabled || urlDemoParam;
  const [visualMode, setVisualMode] = useState(() => getInitialDebateVisualMode(atlasLayoutMode));
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [modalNodeId, setModalNodeId] = useState(null);
  const [orderByUpvotes, setOrderByUpvotes] = useState(false);
  const [bookmarkedNodes, setBookmarkedNodes] = useState([]);
  const [demoMode, setDemoMode] = useState(() => initialDemoEnabled);
  const [treeDataState, setTreeDataState] = useState(() => buildAtlasTreeData(initialDemoEnabled));
  const [nodeTypeFilter, setNodeTypeFilter] = useState('all');
  const [copied, setCopied] = useState(false);

  // Suggest Modal State
  const [suggestNodeModalOpen, setSuggestNodeModalOpen] = useState(false);
  const [suggestNodeParent, setSuggestNodeParent] = useState(null);
  const [suggestNodePath, setSuggestNodePath] = useState([]);

  // Drag-to-Scroll State for Tree View
  const treeContainerRef = useRef(null);
  const [treeIsDragging, setTreeIsDragging] = useState(false);
  const [treeStartX, setTreeStartX] = useState(0);
  const [treeScrollLeft, setTreeScrollLeft] = useState(0);

  // Ref to track if we've already handled the deep link for the current ID
  const hasHandledDeepLink = useRef(false);

  // Routing Hooks
  const { nodeId: paramNodeId, tag: paramTag } = useParams();
  const navigate = useNavigate();

  // --- NODE ID PARSING (Fallback to manual URL check for wildcard routes) ---
  const effectiveNodeId = useMemo(() => {
    if (paramNodeId) return paramNodeId;
    const path = window.location.pathname;
    const match = path.match(/\/atlas\/(0x[a-fA-F0-9]+)/);
    return match ? match[1] : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramNodeId]);

  // Reset handled flag when the URL ID changes
  useEffect(() => {
    hasHandledDeepLink.current = false;
  }, [effectiveNodeId]);

  useEffect(() => {
    const saved = localStorage.getItem('bookmarkedNodes');
    if (saved) setBookmarkedNodes(JSON.parse(saved));
  }, []);

  useEffect(() => {
    setTreeDataState(buildAtlasTreeData(demoMode));
  }, [demoMode]);

  useEffect(() => {
    setDemoMode(initialDemoEnabled);
  }, [initialDemoEnabled]);

  useEffect(() => {
    setVisualMode(getInitialDebateVisualMode(atlasLayoutMode));
  }, [atlasLayoutMode]);

  useEffect(() => {
    if (!requestedModalNodeId) return;
    setModalNodeId(String(requestedModalNodeId).trim() || null);
  }, [requestedModalNodeId]);

  const selectedCategory = useMemo(() => (
    selectedCategoryId ? findAtlasNodeById(treeDataState, selectedCategoryId) : null
  ), [selectedCategoryId, treeDataState]);

  const modalContent = useMemo(() => {
    if (!modalNodeId) return null;
    return findAtlasNodeById(treeDataState, modalNodeId) || findAtlasNodeById(treeData, modalNodeId);
  }, [modalNodeId, treeDataState]);

  // --- DEEP LINK EFFECT: Open Modal if URL has Node ID ---
  useEffect(() => {
    // If we have an ID, data is ready, and we haven't already processed this exact deep link session
    if (effectiveNodeId && treeDataState && !hasHandledDeepLink.current) {
      // 1. Search in current state (which includes Demo Mode active/inactive state)
      let found = findAtlasNodeById(treeDataState, effectiveNodeId);

      // 2. Fallback: If not found in active state, check raw treeData.
      if (!found && treeDataState !== treeData) {
         found = findAtlasNodeById(treeData, effectiveNodeId);
      }

      if (found) {
          setModalNodeId(found.id);
          hasHandledDeepLink.current = true; // Mark as handled so it doesn't re-open on re-renders (like Demo toggle)
      }
    }
  }, [effectiveNodeId, treeDataState]);

  const handleNodeClick = useCallback((node) => setModalNodeId(node?.id || null), []);
  const closeModal = useCallback(() => {
    setModalNodeId(null);
    onModalClose?.();
  }, [onModalClose]);

  const handleBookmark = useCallback((id) => {
    setBookmarkedNodes(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      localStorage.setItem('bookmarkedNodes', JSON.stringify(next));
      return next;
    });
  }, []);

  // --- NEW: Copy Full URL for Deep Linking ---
  const copyToClipboard = useCallback(() => {
    if(modalContent) {
      const deepLink = new URL(buildPublicRoute(`/atlas/${modalContent.id}`), window.location.origin);
      if (demoMode) {
        deepLink.searchParams.set('demo', '1');
      }
      navigator.clipboard.writeText(deepLink.toString()).then(() => {
        notify.success('Copied to clipboard');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }).catch((e) => { void e; notify.warn('Copy failed'); });
    }
  }, [demoMode, modalContent]);

  // --- NEW: Handle Tag Clicks to route ---
  const handleTagClick = useCallback((tag) => {
    // Regression guard: when the atlas is opened from a session page, tag exploration
    // should stay pinned to that session instead of widening back out to global scope.
    navigate(buildTagHref(tag, '', activeSessionSlug));
  }, [activeSessionSlug, navigate]);

  const handleVote = useCallback((nodeId, voteType, count = 1) => {
    setTreeDataState(prev => {
      const update = (nodes) => nodes.map(node => {
         if (node.id === nodeId) {
           const current = node.votes || {};
           const val = parseInt(current[voteType] || 0);
           return { ...node, votes: { ...current, [voteType]: val + count }};
         }
         if (node.children) return { ...node, children: update(node.children) };
         return node;
      });
      return update(prev);
    });
  }, []);

  const handleSuggestNode = useCallback((parent, path = []) => {
      setSuggestNodeParent(parent);
      setSuggestNodePath(path);
      setSuggestNodeModalOpen(true);
  }, []);

  const handleSubmitSuggestedNode = useCallback((parent, title) => {
      uiLog.log("Suggestion submitted for", parent.name, ":", title);
  }, []);

  const handleCategoryClick = (cat) => setSelectedCategoryId(cat?.id || null);
  const handleVisualModeChange = useCallback((nextVisualMode) => {
    setVisualMode(nextVisualMode);
    if (nextVisualMode !== DEBATE_VISUAL_MODES.TREE) {
      setSelectedCategoryId(null);
    }
  }, []);

  const flattenTree = useCallback((node, parentPath = []) => {
    let res = [{ ...node, parentPath }];
    if (node.children) node.children.forEach(child => { res = res.concat(flattenTree(child, [...parentPath, node])); });
    return res;
  }, []);

  const sortedNodes = useMemo(() => {
    // Only process sorting if in LIST mode
    if (visualMode !== DEBATE_VISUAL_MODES.LIST) return [];

    return treeDataState.flatMap(c => flattenTree(c))
      .filter(n => {
         if (nodeTypeFilter === 'all') return true;
         if (nodeTypeFilter === 'category' && n.parentPath.length !== 0) return false;
         if (nodeTypeFilter === 'subcategory' && n.parentPath.length !== 1) return false;
         return true;
      })
      .sort((a,b) => orderByUpvotes ? (calculateNetUpvotes(b.votes) - calculateNetUpvotes(a.votes)) : 0);
  }, [treeDataState, orderByUpvotes, flattenTree, nodeTypeFilter, visualMode]);

  // -- Tree View Drag Scroll Handlers --
  const onTreeMouseDown = (e) => {
    if (!treeContainerRef.current) return;
    setTreeIsDragging(true);
    setTreeStartX(e.pageX - treeContainerRef.current.offsetLeft);
    setTreeScrollLeft(treeContainerRef.current.scrollLeft);
  };

  const onTreeMouseLeave = () => {
    setTreeIsDragging(false);
  };

  const onTreeMouseUp = () => {
    setTreeIsDragging(false);
  };

  const onTreeMouseMove = (e) => {
    if (!treeIsDragging || !treeContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - treeContainerRef.current.offsetLeft;
    const walk = (x - treeStartX) * 1.5; // Scroll-fast multiplier
    treeContainerRef.current.scrollLeft = treeScrollLeft - walk;
  };

  const wrapperClassName = [
    styles.debateMapWrapper,
    embedded ? styles.embeddedAtlas : styles.standaloneAtlas,
  ].filter(Boolean).join(' ');
  const atlasViewLayoutMode = visualMode === DEBATE_VISUAL_MODES.ATLAS
    ? ATLAS_LAYOUT_MODES.ORBITAL
    : ATLAS_LAYOUT_MODES.PACKED;
  const isAtlasVisualMode = visualMode === DEBATE_VISUAL_MODES.CIRCLES
    || visualMode === DEBATE_VISUAL_MODES.ATLAS;

  return (
    <div className={wrapperClassName}>
      <div className={styles.debateMap}>
        {!embedded && (
          <div className={styles.headerRow}>
            <h1 className={styles.title}>Debate Map</h1>
            <Legend />
          </div>
        )}

        <div className={styles.controls}>
          <div className={styles.primaryControls}>
            <div className={styles.viewModeSwitch}>
              <button
                type="button"
                data-testid={E2E_TESTIDS.DEBATE_VIEW_MODE}
                data-ce-view-mode={DEBATE_VISUAL_MODES.CIRCLES}
                className={visualMode === DEBATE_VISUAL_MODES.CIRCLES ? styles.active : ''}
                onClick={() => handleVisualModeChange(DEBATE_VISUAL_MODES.CIRCLES)}
              >
                <FontAwesomeIcon icon={faCircle} /> Circles
              </button>
              <button
                type="button"
                data-testid={E2E_TESTIDS.DEBATE_VIEW_MODE}
                data-ce-view-mode={DEBATE_VISUAL_MODES.ATLAS}
                className={visualMode === DEBATE_VISUAL_MODES.ATLAS ? styles.active : ''}
                onClick={() => handleVisualModeChange(DEBATE_VISUAL_MODES.ATLAS)}
              >
                <FontAwesomeIcon icon={faNetworkWired} /> Atlas
              </button>
              <button
                type="button"
                data-testid={E2E_TESTIDS.DEBATE_VIEW_MODE}
                data-ce-view-mode={DEBATE_VISUAL_MODES.TREE}
                className={visualMode === DEBATE_VISUAL_MODES.TREE ? styles.active : ''}
                onClick={() => handleVisualModeChange(DEBATE_VISUAL_MODES.TREE)}
              >
                <FontAwesomeIcon icon={faSitemap} /> Tree
              </button>
              <button
                type="button"
                data-testid={E2E_TESTIDS.DEBATE_VIEW_MODE}
                data-ce-view-mode={DEBATE_VISUAL_MODES.LIST}
                className={visualMode === DEBATE_VISUAL_MODES.LIST ? styles.active : ''}
                onClick={() => handleVisualModeChange(DEBATE_VISUAL_MODES.LIST)}
              >
                <FontAwesomeIcon icon={faList} /> List
              </button>
              {embedded && (
                <>
                  <span className={styles.viewModeSeparator} />
                  <span className={styles.inlineLegendItem}>
                    <span className={`${styles.legendDot} ${styles.category}`} />
                    <span>Category</span>
                  </span>
                  <span className={styles.inlineLegendItem}>
                    <span className={`${styles.legendDot} ${styles.subcategory}`} />
                    <span>Sub-Category</span>
                  </span>
                  <span className={styles.inlineLegendItem}>
                    <span className={`${styles.legendDot} ${styles.topic}`} />
                    <span>Topic</span>
                  </span>
                  <span className={styles.inlineLegendItem}>
                    <span className={`${styles.legendDot} ${styles.instance}`} />
                    <span>Instance</span>
                  </span>
                </>
              )}
            </div>
          </div>

          <div className={styles.secondaryControls}>
            <div className={styles.controlGroup}>
              {visualMode === DEBATE_VISUAL_MODES.LIST && (
                <label><input type="checkbox" checked={orderByUpvotes} onChange={e => setOrderByUpvotes(e.target.checked)} /> Order by Upvotes</label>
              )}
              <label><input type="checkbox" checked={demoMode} onChange={e => setDemoMode(e.target.checked)} /> Demo Mode</label>
            </div>

            {visualMode === DEBATE_VISUAL_MODES.LIST && (
              <div className={styles.filterGroup}>
                <span className={styles.filterLabel}>Filter Depth:</span>
                <select value={nodeTypeFilter} onChange={e => setNodeTypeFilter(e.target.value)}>
                  <option value="all">All</option>
                  <option value="category">Category</option>
                  <option value="subcategory">Sub-category</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {visualMode === DEBATE_VISUAL_MODES.TREE && (
          <div className={styles.categorySelector}>
             {treeDataState.map((cat, i) => (
               <button key={i} className={`${styles.categoryButton} ${selectedCategory?.id === cat.id ? styles.active : ''}`} onClick={() => handleCategoryClick(cat)}>{cat.name}</button>
             ))}
          </div>
        )}

        <div className={styles.nodesContainer}>
           {visualMode === DEBATE_VISUAL_MODES.LIST ? (
             <div className={styles.flatListContainer}>
                {sortedNodes.map((node, i) => (
                  <FlatNode key={i} node={node} parentPath={node.parentPath} onNodeClick={handleNodeClick} onBookmark={handleBookmark} bookmarkedNodes={bookmarkedNodes} />
                ))}
             </div>
           ) : isAtlasVisualMode ? (
             <AtlasView
               data={treeDataState}
               onNodeClick={handleNodeClick}
               atlasLayoutMode={atlasViewLayoutMode}
             />
           ) : (
             <div
               className={styles.orgChartContainer}
               ref={treeContainerRef}
               onMouseDown={onTreeMouseDown}
               onMouseLeave={onTreeMouseLeave}
               onMouseUp={onTreeMouseUp}
               onMouseMove={onTreeMouseMove}
               style={{ cursor: treeIsDragging ? 'grabbing' : 'grab' }}
             >
                {selectedCategory ? (
                   <div className={styles.orgChartRoot}>
                     <TreeNode
                        node={selectedCategory}
                        depth={0}
                        parentPath={[]}
                        onNodeClick={handleNodeClick}
                        onBookmark={handleBookmark}
                        bookmarkedNodes={bookmarkedNodes}
                        onSuggestNode={handleSuggestNode}
                     />
                   </div>
                ) : (
                   <div className={styles.emptyState}>Select a category above to view the Policy Org Chart</div>
                )}
             </div>
           )}
        </div>

        <Modal
            isOpen={!!modalContent}
            onClose={closeModal}
            content={modalContent}
            onVote={handleVote}
            onCopy={copyToClipboard}
            copied={copied}
            onTagClick={handleTagClick}
        />
        <SuggestNodeModal
            isOpen={suggestNodeModalOpen}
            onClose={() => setSuggestNodeModalOpen(false)}
            parentNode={suggestNodeParent}
            parentPath={suggestNodePath}
            onSubmit={handleSubmitSuggestedNode}
        />
      </div>
    </div>
  );
};

export default DebateMap;
