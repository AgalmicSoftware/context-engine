/** @file DebateMap.tsx */
import React, { useState, useCallback, useMemo, useEffect, useLayoutEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faThumbsUp,
  faChevronRight,
  faBookmark,
  faTimes,
  faComment,
  faLink,
  faCheck,
  faPlus,
  faNetworkWired,
  faArrowLeft,
  faFire,
  faSitemap,
  faCaretDown,
  faCaretUp,
  faArrowUp,
  faArrowDown,
  faList,
  faCircle,
  faExternalLinkAlt,
} from '@fortawesome/free-solid-svg-icons';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { FormGroup, Label, Input } from 'reactstrap';
import { hierarchy as d3Hierarchy, pack as d3Pack } from 'd3';
import styles from './DebateMap.module.scss';
import { createLogger } from 'utilities/logging.js';
import {
  getHistoricalFigureAvatarOrBlockie,
  getHistoricalFigureBlockie,
} from 'utilities/ui/historicalFigureAvatars.js';
import { buildPublicRoute, readSafeInternalReturnTo } from 'utilities/ui/publicUrl.js';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { notify } from '../../utilities/ui/notify.js';
import { buildTagHref } from '../SurveyTool/QuestionTagDropdown';
import {
  EMPTY_HISTORICAL_CASES,
  applyLocalVoteDeltasToTree,
  atlasTreeData,
  buildAtlasTreeData,
  buildExpandedHistoricalCaseBriefMap,
  buildHistoricalCaseBrief,
  buildHistoricalCompassPoints,
  calculateNetUpvotes,
  cleanAtlasCategoryName,
  findAtlasNodeById,
  getHistoricalCaseCardKey,
  normalizeHistoricalCaseTextList,
} from './debateMapHistoricalData';
import type {
  AtlasChromeProps,
  AtlasDimensions,
  AtlasLayoutMode,
  AtlasLayoutViewProps,
  AtlasLink,
  AtlasRenderNode,
  AtlasTopNodeCandidate,
  AtlasViewProps,
  CompassData,
  DebateArgument,
  DebateComment,
  DebateMapProps,
  DebateNode,
  DebateQuestion,
  DebateQuestionOption,
  DebateVoteTotals,
  DebateVisualMode,
  DisagreementRange,
  FlatNodeProps,
  FlattenedDebateNode,
  HistoricalCase,
  HistoricalCaseBrief,
  HistoricalCaseBriefBuilder,
  HistoricalCasePanel,
  HistoricalDraftArticle,
  HistoricalFieldDefinition,
  HistoricalFieldRow,
  HistoricalFigureRecord,
  HistoricalCompassPoint,
  HistoricalPatchOption,
  HistoricalVoteEntry,
  LocalVoteDeltas,
  ModalProps,
  PackedAtlasLayoutNode,
  SuggestNodeModalProps,
  TreeNodeProps,
  VoteDirection,
} from './debateMapTypes';

export { buildExpandedHistoricalCaseBriefMap, buildHistoricalCaseBrief, buildHistoricalCompassPoints };

const StandalonePoliticalCompass = React.lazy(() =>
  import('../DemoViews/DebateHUD/PoliticalCompassView').then((module) => ({
    default: module.StandalonePoliticalCompass,
  })),
);

const uiLog = createLogger('ui');

const parseBookmarkedNodeStorage = (saved: string | null): string[] => {
  if (!saved) return [];
  try {
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.trim())
      .filter(Boolean);
  } catch (e) {
    uiLog.warn('DebateMap: ignoring invalid bookmarkedNodes storage', e);
    return [];
  }
};

export const getDebateNodeStableKey = (
  node: Pick<DebateNode, 'id' | 'name' | 'parentPath'> | null | undefined,
  fallback: string,
): string => {
  const nodeId = String(node?.id || '').trim();
  if (nodeId) return nodeId;
  const nodeName = String(node?.name || '').trim();
  const parentPath = Array.isArray(node?.parentPath)
    ? node.parentPath
        .map((entry) => String(entry?.id || entry?.name || '').trim())
        .filter(Boolean)
        .join('/')
    : '';
  if (nodeName && parentPath) return `${parentPath}/${nodeName}`;
  if (nodeName) return nodeName;
  return fallback;
};

export const getDebateNodeListStableKeys = (
  nodes: Array<Pick<DebateNode, 'id' | 'name' | 'parentPath'> | null | undefined> = [],
  fallback: string,
): string[] => {
  const counts = new Map<string, number>();
  return (Array.isArray(nodes) ? nodes : []).map((node) => {
    const baseKey = getDebateNodeStableKey(node, fallback);
    const occurrence = (counts.get(baseKey) || 0) + 1;
    counts.set(baseKey, occurrence);
    return occurrence === 1 ? baseKey : `${baseKey}:${occurrence}`;
  });
};

export const getDebateQuestionStableKey = (
  question: Pick<DebateQuestion, 'id' | 'question' | 'prompt'> | null | undefined,
  fallback: string,
): string => {
  const questionId = String(question?.id || '').trim();
  if (questionId) return questionId;
  const questionText = String(question?.question || question?.prompt || '').trim();
  if (questionText) return `${fallback}:${questionText}`;
  return fallback;
};

export const getDebateQuestionListStableKeys = (
  questions: Array<Pick<DebateQuestion, 'id' | 'question' | 'prompt'> | null | undefined> = [],
  fallback: string,
): string[] => {
  const counts = new Map<string, number>();
  return (Array.isArray(questions) ? questions : []).map((question) => {
    const baseKey = getDebateQuestionStableKey(question, fallback);
    const occurrence = (counts.get(baseKey) || 0) + 1;
    counts.set(baseKey, occurrence);
    return occurrence === 1 ? baseKey : `${baseKey}:${occurrence}`;
  });
};

export const getDebateTagStableKeys = (tags: unknown[] = []): string[] => {
  const counts = new Map<string, number>();
  return (Array.isArray(tags) ? tags : []).map((tag) => {
    const label = String(tag ?? '').trim() || 'tag';
    const normalized = label.toLowerCase();
    const occurrence = (counts.get(normalized) || 0) + 1;
    counts.set(normalized, occurrence);
    return occurrence === 1 ? `tag:${label}` : `tag:${label}:${occurrence}`;
  });
};

const formatAtlasLinkCoordinate = (value: unknown): string => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue.toFixed(3) : '0.000';
};

export const getAtlasLinkStableKey = (link: AtlasLink, fallbackIndex: number): string => {
  const sourceId = String(link?.sourceId || '').trim();
  const targetId = String(link?.targetId || '').trim();
  if (sourceId || targetId) return `${sourceId || 'source'}->${targetId || 'target'}`;
  return [
    'coords',
    formatAtlasLinkCoordinate(link?.source?.x),
    formatAtlasLinkCoordinate(link?.source?.y),
    formatAtlasLinkCoordinate(link?.target?.x),
    formatAtlasLinkCoordinate(link?.target?.y),
    fallbackIndex,
  ].join(':');
};

const TREE_LABEL_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bPre-deployment\b/gi, 'Pre-deploy.'],
  [/\bEvaluations\b/gi, 'Evals'],
  [/\bEvaluation\b/gi, 'Eval'],
  [/\bBenchmarks\b/gi, 'Bench.'],
  [/\bInternational\b/gi, 'Intl.'],
  [/\bCoordination\b/gi, 'Coord.'],
  [/\bInterpretability\b/gi, 'Interp.'],
  [/\bMisinformation\b/gi, 'Misinfo.'],
  [/\bSurveillance\b/gi, 'Surveil.'],
  [/\bProductivity\b/gi, 'Prod.'],
  [/\bDisclosure\b/gi, 'Discl.'],
  [/\bDemocratization\b/gi, 'Democratiz.'],
  [/\bConcentration\b/gi, 'Concen.'],
];

export const getCompactTreeNodeLabel = (rawName: unknown): string => {
  let label = cleanAtlasCategoryName(rawName).replace(/\s+/g, ' ').trim();
  if (!label) return '';

  label = label.replace(/\s+and\s+/gi, ' & ');
  TREE_LABEL_REPLACEMENTS.forEach(([pattern, replacement]) => {
    label = label.replace(pattern, replacement);
  });

  return label;
};

export const getTreeChildColumnCount = (depth: number, childCount: number): number => {
  if (childCount <= 1) return childCount;
  if (depth === 0 && childCount === 2) return 2;
  return Math.min(2, childCount);
};

export const getTreeSubtreeSpan = (node: DebateNode | null | undefined): number => {
  const children = Array.isArray(node?.children) ? node.children : [];
  if (children.length === 0) return 1;

  return children.reduce((sum, child) => sum + getTreeSubtreeSpan(child), 0);
};

export const getTreeChildStaggerPx = (depth: number, index: number, columnCount: number): number => {
  if (index <= 0) return 0;

  const safeColumns = Math.max(1, columnCount);
  const rowIndex = Math.floor(index / safeColumns);
  const columnIndex = index % safeColumns;
  const depthBias = Math.min(depth, 3) * 3;

  return rowIndex * 10 + columnIndex * (12 + depthBias);
};

export const getTreeViewportFitScale = (
  viewportWidth: number,
  contentWidth: number,
  horizontalPadding = 32,
): number => {
  const safeViewportWidth = Number(viewportWidth) || 0;
  const safeContentWidth = Number(contentWidth) || 0;
  if (safeViewportWidth <= 0 || safeContentWidth <= 0) return 1;

  const availableWidth = Math.max(0, safeViewportWidth - horizontalPadding);
  if (availableWidth <= 0) return 1;

  return Math.min(1, availableWidth / safeContentWidth);
};

export const getTreeViewportFitHeight = (contentHeight: number, scale: number): number => {
  const safeHeight = Number(contentHeight) || 0;
  const safeScale = Number(scale) || 1;
  if (safeHeight <= 0) return 0;
  return Math.max(0, safeHeight * safeScale);
};

const getAtlasVoteTotals = (node: DebateNode) => {
  const up = parseInt(String(node?.votes?.up || 0), 10) || 0;
  const down = parseInt(String(node?.votes?.down || 0), 10) || 0;
  return {
    up,
    down,
    total: up + down,
  };
};

const calculateHeat = (node: DebateNode): number => {
  const { total } = getAtlasVoteTotals(node);
  const comments = (node.questions ? node.questions.length : 0) + (node.comments ? node.comments.length : 0);
  return total + comments * 3;
};

const calculateDisagreementScore = (node: DebateNode): number => {
  const { up, down } = getAtlasVoteTotals(node);
  // Use the smaller side of the split so popular but one-sided nodes do not
  // overwhelm more contested debates in atlas view.
  return Math.min(up, down);
};

const calculateAtlasNodeSize = (
  node: AtlasRenderNode,
  isMobile: boolean,
  disagreementRange: DisagreementRange,
): number => {
  let baseSize = node.depth === 0 ? 80 : node.depth === 1 ? 40 : node.depth === 2 ? 20 : 12;
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
    : (node.depth === 0 ? 56 : node.depth === 1 ? 34 : node.depth === 2 ? 20 : 12) * disagreementWeight;

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

const getInitialDebateVisualMode = (atlasLayoutMode: AtlasLayoutMode): DebateVisualMode =>
  atlasLayoutMode === ATLAS_LAYOUT_MODES.ORBITAL ? DEBATE_VISUAL_MODES.ATLAS : DEBATE_VISUAL_MODES.CIRCLES;

const getAtlasCommentCount = (node: DebateNode): number =>
  (node.questions ? node.questions.length : 0) + (node.comments ? node.comments.length : 0);

export const getTopAtlasNodesByHeat = (nodes: DebateNode[] = [], limit = 3): DebateNode[] => {
  const maxNodes = Math.max(0, Math.floor(Number(limit) || 0));
  if (maxNodes === 0) return [];

  const topCandidates: AtlasTopNodeCandidate[] = [];
  let visitOrder = 0;

  const remember = (node: DebateNode) => {
    topCandidates.push({
      node,
      heat: calculateHeat(node),
      order: visitOrder,
    });
    topCandidates.sort((a, b) => b.heat - a.heat || a.order - b.order);
    if (topCandidates.length > maxNodes) {
      topCandidates.length = maxNodes;
    }
  };

  const visit = (items: DebateNode[] = []) => {
    items.forEach((node) => {
      remember(node);
      visitOrder += 1;

      if (Array.isArray(node?.children) && node.children.length > 0) {
        visit(node.children);
      }
    });
  };

  visit(nodes);

  return topCandidates.map((candidate) => candidate.node);
};

const getAtlasCenterNode = (atlasRoot: DebateNode | null, data: DebateNode[]): DebateNode =>
  atlasRoot ? atlasRoot : { id: 'virtual-root', name: 'AI Policy Atlas', children: data, depth: -1 };

const measureAtlasContainer = (
  node: HTMLElement | null,
  fallback: AtlasDimensions = DEFAULT_ATLAS_DIMENSIONS,
): AtlasDimensions => {
  const width = Number(node?.offsetWidth) || 0;
  const height = Number(node?.offsetHeight) || 0;
  return {
    w: width > 0 ? width : fallback.w,
    h: height > 0 ? height : fallback.h,
  };
};

const normalizeAtlasDepthValue = (value: unknown, fallback = 0): number => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
};

const resolveAtlasVisualDepth = (atlasRoot: DebateNode | null, hierarchyDepth: number): number => {
  if (atlasRoot) {
    return normalizeAtlasDepthValue(atlasRoot.depth, 0) + hierarchyDepth;
  }
  return hierarchyDepth - 1;
};

const getAtlasDepthClass = (visualDepth: number, isCenter = false): string =>
  isCenter ? 'depthCenter' : `depth${Math.max(0, Math.min(visualDepth, 3))}`;

const buildAtlasRenderNode = (
  node: DebateNode,
  atlasRoot: DebateNode | null,
  hierarchyDepth: number,
  options: Partial<AtlasRenderNode> = {},
): AtlasRenderNode => {
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

const calculateAtlasPackValue = (node: DebateNode): number => {
  if (Array.isArray(node?.children) && node.children.length > 0) {
    return 0;
  }
  return Math.max(calculateDisagreementScore(node), 1);
};

const shouldAlwaysShowPackedLabel = (node: AtlasRenderNode): boolean => node.hierarchyDepth === 1;
export const getPackedAtlasLabelFontSizePx = (
  node: Pick<AtlasRenderNode, 'hierarchyDepth' | 'isCenter'>,
  diameter: number,
  alwaysVisible = false,
): number => {
  const normalizedDiameter = Math.max(0, Number(diameter) || 0);
  const hierarchyDepth = Math.max(0, Number(node?.hierarchyDepth) || 0);

  let ratio = 0.038;
  let minSize = 9;
  let maxSize = 15;

  if (node?.isCenter) {
    ratio = 0.058;
    minSize = 18;
    maxSize = 30;
  } else if (hierarchyDepth <= 1) {
    ratio = 0.066;
    minSize = 22;
    maxSize = 34;
  } else if (hierarchyDepth === 2) {
    ratio = 0.05;
    minSize = 12;
    maxSize = 20;
  }

  const boostedSize = normalizedDiameter * ratio * (alwaysVisible ? 1.08 : 1);
  return Math.max(minSize, Math.min(maxSize, Math.round(boostedSize * 10) / 10));
};

export const getPackedAtlasVerticalLiftPx = (nodes: PackedAtlasLayoutNode[] = [], desiredTopGutter = 10): number => {
  if (!Array.isArray(nodes) || nodes.length === 0) return 0;

  const minVisibleTop = nodes.reduce((currentMin, node) => {
    const y = Number(node?.y) || 0;
    const radius = Math.max(0, Number(node?.r) || 0);
    return Math.min(currentMin, y - radius);
  }, Number.POSITIVE_INFINITY);

  if (!Number.isFinite(minVisibleTop)) return 0;
  return Math.max(0, minVisibleTop - Math.max(0, Number(desiredTopGutter) || 0));
};

export const getPackedAtlasClickTarget = (
  node: AtlasRenderNode | null | undefined,
  nodesById: Map<string, AtlasRenderNode> = new Map(),
): AtlasRenderNode | null => {
  if (!node) return null;
  if (Number(node.hierarchyDepth || 0) <= 1) return node;

  const directChildId = String(node.groupId || '').trim();
  if (!directChildId) return node;
  return nodesById.get(directChildId) || node;
};

const getPackedAtlasGroupId = (hierarchyNode: any): string => {
  if (!hierarchyNode) return '';
  const lineage: any[] = [];
  let currentNode = hierarchyNode;
  while (currentNode) {
    lineage.unshift(currentNode);
    currentNode = currentNode.parent || null;
  }
  const groupNode = lineage[1] || lineage[0] || hierarchyNode;
  return String(groupNode?.data?.id || hierarchyNode?.data?.id || '').trim();
};

const useAtlasContainerDimensions = (measureKey: AtlasLayoutMode) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dimensions, setDimensions] = useState<AtlasDimensions>(DEFAULT_ATLAS_DIMENSIONS);

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

const useAtlasNavigationState = (data: DebateNode[], onNodeClick: (node: DebateNode) => void) => {
  const [atlasRootId, setAtlasRootId] = useState<string | null>(null);
  const [atlasHistoryIds, setAtlasHistoryIds] = useState<Array<string | null>>([]);
  const [showActiveDebates, setShowActiveDebates] = useState(false);

  const atlasRoot = useMemo(() => (atlasRootId ? findAtlasNodeById(data, atlasRootId) : null), [atlasRootId, data]);

  const topNodes = useMemo(() => getTopAtlasNodesByHeat(data, 3), [data]);

  const handleAtlasNodeClick = useCallback(
    (node: AtlasRenderNode | DebateNode) => {
      if (!node || node.id === 'virtual-root') return;

      if (node.isCenter || !Array.isArray(node.children) || node.children.length === 0) {
        onNodeClick(node);
        return;
      }

      setAtlasHistoryIds((prev) => [...prev, atlasRootId]);
      setAtlasRootId(String(node.id || '').trim() || null);
      setShowActiveDebates(false);
    },
    [atlasRootId, onNodeClick],
  );

  const handleBack = useCallback(
    (event?: React.SyntheticEvent) => {
      event?.stopPropagation?.();
      if (atlasHistoryIds.length === 0) return;
      const nextHistory = [...atlasHistoryIds];
      const prevRoot = nextHistory.pop();
      setAtlasHistoryIds(nextHistory);
      setAtlasRootId(prevRoot || null);
    },
    [atlasHistoryIds],
  );

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
}: AtlasChromeProps) => (
  <>
    {atlasRoot && (
      <button type="button" className={styles.backArrow} onClick={handleBack}>
        <FontAwesomeIcon icon={faArrowLeft} /> Up Level
      </button>
    )}

    {!atlasRoot && (
      <button type="button" className={styles.hotDebatesBtn} onClick={() => setShowActiveDebates((prev) => !prev)}>
        <FontAwesomeIcon icon={faFire} /> Top Debates
      </button>
    )}

    <div className={`${styles.topNodesOverlay} ${showActiveDebates ? styles.visible : ''}`}>
      <h3>
        <span>
          <FontAwesomeIcon icon={faFire} /> Active Debates
        </span>
        <button
          type="button"
          className={styles.minimizeBtn}
          aria-label="Minimize active debates"
          onClick={() => setShowActiveDebates(false)}
        >
          <FontAwesomeIcon icon={faTimes} />
        </button>
      </h3>
      {topNodes.map((node, index, list) => (
        <button
          key={getDebateNodeListStableKeys(list, 'top-node')[index] || getDebateNodeStableKey(node, 'top-node')}
          type="button"
          className={styles.topNodeItem}
          onClick={(event) => {
            event.stopPropagation();
            onNodeClick(node);
          }}
        >
          <span className={styles.nodeTitle}>{node.name}</span>
          <div className={styles.nodeStats}>
            <span>
              <FontAwesomeIcon icon={faThumbsUp} /> {calculateNetUpvotes(node.votes)}
            </span>
            <span>
              <FontAwesomeIcon icon={faComment} /> {getAtlasCommentCount(node)}
            </span>
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
}: AtlasLayoutViewProps) => {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [startPan, setStartPan] = useState({ x: 0, y: 0 });
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  useEffect(() => {
    setOffset({ x: 0, y: 0 });
  }, [atlasRoot]);

  // --- Organic Layout Calculation ---
  const layout = useMemo(() => {
    const nodes: AtlasRenderNode[] = [];
    const links: AtlasLink[] = [];

    // The "Virtual Root" is the global center point.
    const centerNode = getAtlasCenterNode(atlasRoot, data);

    nodes.push(
      buildAtlasRenderNode(centerNode, atlasRoot, 0, {
        isCenter: true,
        x: 0,
        y: 0,
      }),
    );

    if (!centerNode.children) {
      return { nodes, links, disagreementRange: { min: 0, max: 0 } };
    }

    const isMobile = dimensions.w < 768;

    // LAYOUT CONFIGURATION
    // Fixed: Reduced desktop drill-down radius from 380 to 250 to prevent over-spreading
    const initialRadius = atlasRoot ? (isMobile ? 160 : 250) : isMobile ? 110 : 150;

    const processRing = (
      parent: DebateNode,
      parentX: number,
      parentY: number,
      startAngle: number,
      endAngle: number,
      level: number,
    ) => {
      if (!parent.children || parent.children.length === 0) return;

      const count = parent.children.length;

      let availableAngle = endAngle - startAngle;
      let currentStartAngle = startAngle;

      if (level === 1) {
        availableAngle = Math.PI * 2;
        currentStartAngle = 0;
      }

      const angleStep = availableAngle / count;

      parent.children.forEach((child: DebateNode, i: number) => {
        let nodeX, nodeY, myAngle;

        if (level === 1) {
          myAngle = currentStartAngle + i * angleStep + angleStep / 2 - Math.PI / 2;
          nodeX = Math.cos(myAngle) * initialRadius;
          nodeY = Math.sin(myAngle) * initialRadius;
        } else {
          const angleFromParent = Math.atan2(parentY, parentX);
          let wedgeSize = (Math.PI * 0.8) / (level * 0.8);

          if (atlasRoot && !isMobile) {
            wedgeSize = Math.PI / 1.5;
          }

          const wedgeStart = angleFromParent - wedgeSize / 2;
          const wedgeStep = wedgeSize / (count + 1);

          myAngle = wedgeStart + wedgeStep * (i + 1);

          const dist = isMobile ? 60 + 30 / level : 120;

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
            target: { x: nodeX, y: nodeY },
            sourceId: String(parent.id || '').trim(),
            targetId: String(child.id || '').trim(),
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

    const disagreementRange =
      disagreementScores.length > 0
        ? {
            min: Math.min(...disagreementScores),
            max: Math.max(...disagreementScores),
          }
        : { min: 0, max: 0 };

    return { nodes, links, disagreementRange };
  }, [data, atlasRoot, dimensions.w]);

  // Mouse/Touch Handlers
  const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDragging(true);
    setStartPan({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };
  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setOffset({ x: e.clientX - startPan.x, y: e.clientY - startPan.y });
  };
  const onMouseUp = () => setIsDragging(false);

  const onTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setStartPan({ x: e.touches[0].clientX - offset.x, y: e.touches[0].clientY - offset.y });
    }
  };
  const onTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
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
          <line
            key={getAtlasLinkStableKey(link, i)}
            x1={cx + link.source.x}
            y1={cy + link.source.y}
            x2={cx + link.target.x}
            y2={cy + link.target.y}
          />
        ))}
      </svg>

      {layout.nodes.map((node, i) => {
        if (node.id === 'virtual-root') return null;

        const totalSize = calculateAtlasNodeSize(node, isMobile, layout.disagreementRange);

        const isHovered = hoveredNodeId === node.id;

        return (
          <div
            key={getDebateNodeStableKey(node, `atlas-node-${i}`)}
            className={`${styles.atlasNode} ${styles[node.depthClass]} ${isHovered ? styles.hovered : ''}`}
            style={{
              left: cx + node.x,
              top: cy + node.y,
              zIndex: isHovered ? 200 : node.isCenter ? 100 : undefined,
            }}
            data-testid={E2E_TESTIDS.ATLAS_NODE}
            data-ce-node-id={node.id}
            data-ce-node-layout={ATLAS_LAYOUT_MODES.ORBITAL}
            onClick={(e) => {
              e.stopPropagation();
              handleAtlasNodeClick(node);
            }}
            onMouseEnter={() => setHoveredNodeId(String(node.id || '').trim() || null)}
            onMouseLeave={() => setHoveredNodeId(null)}
          >
            <div
              className={`${styles.nodeDot} ${node.heat > 10 ? styles.hot : ''}`}
              style={{ width: `${totalSize}px`, height: `${totalSize}px` }}
            >
              {(node.depth === 0 || node.isCenter) && <FontAwesomeIcon icon={faNetworkWired} />}
            </div>

            <div className={`${styles.nodeLabel} ${node.depth === 0 || node.isCenter ? styles.alwaysVisible : ''}`}>
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
}: AtlasLayoutViewProps) => {
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
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
    const headerHeight = atlasRoot ? (isMobile ? 34 : 28) : 0;
    const desiredTopGutter = atlasRoot ? (isMobile ? 10 : 8) : isMobile ? 14 : 18;
    const packLayout = d3Pack()
      .size([Math.max(dimensions.w - inset * 2, 1), Math.max(dimensions.h - inset * 2 - headerHeight, 1)])
      .padding(isMobile ? 4 : 8);

    // Only leaves contribute a direct size signal so parent circles scale from
    // their subtree instead of double-counting their own disagreement score.
    const hierarchy = d3Hierarchy(centerNode, (node: any) =>
      Array.isArray(node?.children) && node.children.length > 0 ? node.children : null,
    )
      .sum((node: any) => calculateAtlasPackValue(node))
      .sort((a: any, b: any) => (Number(b.value) || 0) - (Number(a.value) || 0));

    const packedRoot = packLayout(hierarchy);

    const layoutNodes = packedRoot.descendants().filter((node: any) => node.depth > 0);
    const verticalLift = getPackedAtlasVerticalLiftPx(layoutNodes, desiredTopGutter);

    const nodes: AtlasRenderNode[] = layoutNodes
      .map((node: any) =>
        buildAtlasRenderNode(node.data, atlasRoot, node.depth, {
          isCenter: false,
          x: node.x + inset,
          y: node.y + inset + headerHeight - verticalLift,
          r: node.r,
          groupId: getPackedAtlasGroupId(node),
        }),
      )
      .sort((a: AtlasRenderNode, b: AtlasRenderNode) => {
        if (a.hierarchyDepth !== b.hierarchyDepth) return a.hierarchyDepth - b.hierarchyDepth;
        return Number(b.r || 0) - Number(a.r || 0);
      });

    return { nodes };
  }, [atlasRoot, data, dimensions.h, dimensions.w, isMobile]);
  const layoutNodeMap = useMemo(
    () => new Map(layout.nodes.map((node) => [String(node.id || '').trim(), node])),
    [layout.nodes],
  );

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
            onClick={() => {
              if (atlasRoot) onNodeClick(atlasRoot);
            }}
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
        const showChildLabelsForGroup = isTopLevelPackedView && isHoveredGroup && hoveredNodeId !== groupId;
        const alwaysVisible = isTopLevelPackedView
          ? isTopLevelGroupNode
            ? !showChildLabelsForGroup
            : node.hierarchyDepth === 2 && showChildLabelsForGroup
          : shouldAlwaysShowPackedLabel(node);
        const labelFontSizePx = getPackedAtlasLabelFontSizePx(node, diameter, alwaysVisible);

        return (
          <div
            key={node.id}
            className={`${styles.atlasNode} ${styles.packedAtlasNode} ${styles[node.depthClass]} ${isHovered ? styles.hovered : ''}`}
            style={{
              left: node.x,
              top: node.y,
              zIndex: node.isCenter ? 120 : isHovered ? 140 : 20 + node.hierarchyDepth,
            }}
            data-testid={E2E_TESTIDS.ATLAS_NODE}
            data-ce-node-id={node.id}
            data-ce-node-layout={ATLAS_LAYOUT_MODES.PACKED}
            onClick={(event) => {
              event.stopPropagation();
              const clickTarget = getPackedAtlasClickTarget(node, layoutNodeMap);
              if (!clickTarget) return;
              handleAtlasNodeClick(clickTarget);
            }}
            onMouseEnter={() => {
              setHoveredNodeId(String(node.id || '').trim() || null);
              setHoveredGroupId(groupId);
            }}
            onMouseLeave={() => {
              setHoveredNodeId((currentValue) => (currentValue === String(node.id || '').trim() ? null : currentValue));
              setHoveredGroupId((currentValue) => (currentValue === groupId ? '' : currentValue));
            }}
          >
            <div
              className={`${styles.nodeDot} ${styles.packedNodeDot} ${node.heat > 10 ? styles.hot : ''}`}
              style={{ width: `${diameter}px`, height: `${diameter}px` }}
            >
              <div
                className={`${styles.nodeLabel} ${styles.packedNodeLabel} ${alwaysVisible ? styles.alwaysVisible : ''}`}
                style={{ fontSize: `${labelFontSizePx}px` }}
              >
                {node.name}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export const AtlasView = ({ data, onNodeClick, atlasLayoutMode = ATLAS_LAYOUT_MODES.ORBITAL }: AtlasViewProps) => {
  const { containerRef, dimensions } = useAtlasContainerDimensions(atlasLayoutMode);
  const { atlasRoot, showActiveDebates, setShowActiveDebates, topNodes, handleAtlasNodeClick, handleBack } =
    useAtlasNavigationState(data, onNodeClick);

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
const FlatNode = ({ node, parentPath = [], onNodeClick, onBookmark, bookmarkedNodes }: FlatNodeProps) => {
  const netUpvotes = calculateNetUpvotes(node.votes);
  const nodeId = String(node.id || '').trim();
  const isBookmarked = nodeId ? bookmarkedNodes.includes(nodeId) : false;
  const commentCount = (node.questions ? node.questions.length : 0) + (node.comments ? node.comments.length : 0);

  return (
    <div className={styles.flatNodeContainer}>
      <div className={styles.pathContainer}>
        {parentPath.map((p, index) => (
          <React.Fragment key={p.id}>
            <button className={`${styles.pathButton} ${styles[`depth${index}`]}`} onClick={() => onNodeClick(p)}>
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
        <span className={styles.upvotes}>
          <FontAwesomeIcon icon={faThumbsUp} /> {netUpvotes}
        </span>
        <span className={styles.comments}>
          <FontAwesomeIcon icon={faComment} /> {commentCount}
        </span>
        <FontAwesomeIcon
          icon={faBookmark}
          className={`${styles.bookmark} ${isBookmarked ? styles.bookmarked : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            if (nodeId) onBookmark(nodeId);
          }}
        />
        <FontAwesomeIcon icon={faChevronRight} className={styles.expandIcon} onClick={() => onNodeClick(node)} />
      </div>
    </div>
  );
};

// 3. Detail Modal
const Modal = ({ isOpen, onClose, content, onVote, copied, onCopy, onTagClick }: ModalProps) => {
  const modalContentRef = useRef<HTMLDivElement | null>(null);
  const defaultArgumentData = content?.arguments && typeof content.arguments === 'object' ? content.arguments : null;
  const hasDefaultArguments = Boolean(defaultArgumentData);
  const [activeVoteType, setActiveVoteType] = useState<VoteDirection | null>(null);
  const [voteCount, setVoteCount] = useState('');
  const [showVoteBreakdown, setShowVoteBreakdown] = useState(false);
  const [compassOpen, setCompassOpen] = useState(true);
  const [argumentsOpen, setArgumentsOpen] = useState(hasDefaultArguments);
  const [historicalCasesOpen, setHistoricalCasesOpen] = useState(false);
  const [expandedHistoricalCaseId, setExpandedHistoricalCaseId] = useState('');
  const [questionsOpen, setQuestionsOpen] = useState(false);

  useEffect(() => {
    if (modalContentRef.current) {
      modalContentRef.current.scrollTop = 0;
      modalContentRef.current.scrollLeft = 0;
    }
    setCompassOpen(true);
    setArgumentsOpen(hasDefaultArguments);
    setHistoricalCasesOpen(false);
    setExpandedHistoricalCaseId('');
    setQuestionsOpen(false);
  }, [content?.id, hasDefaultArguments]);

  const getUserAvatar = (username: string) =>
    getHistoricalFigureAvatarOrBlockie(username, {
      preferBlockie: false,
      fallbackSeed: username || 'atlas-comment-user',
    });
  const handleUserAvatarError = (event: React.SyntheticEvent<HTMLImageElement>, username: string) => {
    const target = event?.currentTarget;
    if (!target) return;
    const fallbackSrc = getHistoricalFigureBlockie(username, {
      fallbackSeed: username || 'atlas-comment-user',
    });
    if (!fallbackSrc || target.src === fallbackSrc) return;
    target.src = fallbackSrc;
  };

  const handleCollapseHeaderKeyDown = (event: React.KeyboardEvent<HTMLElement>, toggle: () => void) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggle();
    }
  };

  const normalizeQuestionType = (questionType: unknown): string => {
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

  const getQuestionTypeLabel = (questionType: unknown): string => {
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

  const getQuestionOptions = (question: DebateQuestion): string[] => {
    const rawOptions = question?.options;

    const normalizeOptions = (options: Array<string | number | DebateQuestionOption>) =>
      options
        .map((option) => {
          if (typeof option === 'string') return option.trim();
          if (typeof option === 'number') return String(option);
          if (option && typeof option === 'object') {
            return String(option.label || option.text || option.value || option.option || '').trim();
          }
          return '';
        })
        .filter(Boolean);

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

  const renderQuestionPreview = (question: DebateQuestion) => {
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
    if (!content?.id || !activeVoteType || !voteCount) return;
    onVote(content.id, activeVoteType, parseInt(voteCount, 10) || 0);
    setVoteCount('');
    setActiveVoteType(null);
  };

  const compassData = useMemo<CompassData | null>(() => {
    if (!content?.compass) return null;

    return {
      ...content.compass,
      points: buildHistoricalCompassPoints(content.historicalVotes, content.compass.points, content.id),
    };
  }, [content]);

  const historicalCases = Array.isArray(content?.historicalCases) ? content.historicalCases : EMPTY_HISTORICAL_CASES;
  const historicalCaseBriefContent = useMemo<DebateNode>(
    () => ({
      id: content?.id,
      name: content?.name,
      compass: content?.compass,
    }),
    [content?.id, content?.name, content?.compass],
  );
  const expandedHistoricalCaseBriefs = useMemo(
    () => buildExpandedHistoricalCaseBriefMap(historicalCases, historicalCaseBriefContent, expandedHistoricalCaseId),
    [expandedHistoricalCaseId, historicalCaseBriefContent, historicalCases],
  );

  if (!isOpen || !content) return null;

  const questions = Array.isArray(content.questions) ? content.questions : [];
  const questionSearchKeys = getDebateQuestionListStableKeys(questions, 'question-search');
  const questionCardKeys = getDebateQuestionListStableKeys(questions, 'question-card');
  const argumentData = content?.arguments && typeof content.arguments === 'object' ? content.arguments : null;
  const proArguments = Array.isArray(argumentData?.pro) ? argumentData.pro : [];
  const conArguments = Array.isArray(argumentData?.con) ? argumentData.con : [];
  const argumentVotes = argumentData?.votes && typeof argumentData.votes === 'object' ? argumentData.votes : {};
  const hasArguments = Boolean(argumentData);
  const totalArgumentCount = proArguments.length + conArguments.length;
  const questionCount = questions.length;
  const historicalCaseCount = historicalCases.length;
  const compassTitle = content?.compass?.xAxis?.label || content?.name || 'Compass';

  // Logic for Depth Label and Styling
  const depthLabels = ['Category', 'Sub-Category', 'Topic', 'Instance'];
  const depthIndex = content.depth !== undefined ? content.depth : content.parentPath ? content.parentPath.length : 0;
  const depthLabel = depthLabels[Math.min(depthIndex, 3)] || 'Node';
  const depthClass = `depth${Math.min(depthIndex, 3)}`; // used for color mapping

  const tags = ['AI Safety', 'Policy'];
  const tagStableKeys = getDebateTagStableKeys(tags);

  // Calculate Counts from Content
  const upVotes = parseInt(String(content.votes?.up || 0), 10);
  const downVotes = parseInt(String(content.votes?.down || 0), 10);
  const netVotes = upVotes - downVotes;

  const renderVoterAvatars = (argumentId: string) => {
    const voters = Array.isArray(argumentVotes?.[argumentId])
      ? [...new Set(argumentVotes[argumentId].filter(Boolean))]
      : [];

    if (voters.length === 0) return null;

    const visibleVoters = voters.slice(0, 5);
    const overflowCount = Math.max(voters.length - visibleVoters.length, 0);
    const overflowLabel = overflowCount > 0 ? voters.slice(visibleVoters.length).join(', ') : '';

    return (
      <div className={styles.voterAvatars} title={voters.join(', ')} aria-label={`Supported by ${voters.join(', ')}`}>
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
        {overflowCount > 0 && <span title={overflowLabel}>+{overflowCount}</span>}
      </div>
    );
  };

  const renderArgumentCard = (argument: DebateArgument, side: 'pro' | 'con', treeKey: string) => {
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
        {source && <div className={styles.argumentSource}>{source}</div>}
        {argument.id ? renderVoterAvatars(argument.id) : null}
        {children.length > 0 && (
          <div className={styles.argumentChildren}>
            {children.map((childArgument, childIndex) =>
              renderArgumentCard(childArgument, side, `${treeKey}-${childArgument?.id || childIndex}`),
            )}
          </div>
        )}
      </div>
    );
  };

  const renderHistoricalCaseFieldRows = (rows: HistoricalFieldRow[] = []) => {
    if (!Array.isArray(rows) || rows.length === 0) return null;

    return (
      <div className={styles.historicalCaseFactList}>
        {rows.map((row, rowIndex) => (
          <div key={`${row.label}-${rowIndex}`} className={styles.historicalCaseFactRow}>
            <div className={styles.historicalCaseFactLabel}>{row.label}</div>
            <div className={styles.historicalCaseFactValue}>{row.value}</div>
          </div>
        ))}
      </div>
    );
  };

  const renderHistoricalCaseCard = (historicalCase: HistoricalCase, caseIndex: number) => {
    if (!historicalCase || typeof historicalCase !== 'object') return null;

    const title = String(historicalCase.title || historicalCase.id || '').trim();
    if (!title) return null;

    const authors = normalizeHistoricalCaseTextList(historicalCase.authors);
    const tagsList = Array.isArray(historicalCase.tags) ? historicalCase.tags.filter(Boolean) : [];
    const caseKey = getHistoricalCaseCardKey(historicalCase, caseIndex);
    const isExpanded = expandedHistoricalCaseId === caseKey;
    const detailPanelId = `historical-case-${caseKey}`;
    const brief = isExpanded ? expandedHistoricalCaseBriefs.get(caseKey) : null;
    const metaBits = [
      historicalCase.category,
      authors.length > 0 ? authors.join(', ') : '',
      historicalCase.venue,
      historicalCase.year,
    ].filter(Boolean);
    const normalizedBestPatch = brief
      ? String(brief.bestPatch || '')
          .trim()
          .toLowerCase()
      : '';
    const hasBestPatchCard =
      Boolean(normalizedBestPatch) &&
      Boolean(
        brief?.patchOptions.some(
          (patch) =>
            String(patch?.name || '')
              .trim()
              .toLowerCase() === normalizedBestPatch,
        ),
      );

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
            {metaBits.length > 0 && <div className={styles.historicalCaseMeta}>{metaBits.join(' • ')}</div>}
          </div>
          <div className={styles.historicalCaseActions}>
            <button
              type="button"
              className={styles.historicalCaseExpandButton}
              aria-expanded={isExpanded}
              aria-controls={detailPanelId}
              data-testid={E2E_TESTIDS.ATLAS_HISTORICAL_CASE_EXPAND}
              data-ce-case-id={caseKey}
              onClick={() => setExpandedHistoricalCaseId((currentValue) => (currentValue === caseKey ? '' : caseKey))}
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
        {historicalCase.summary ? <div className={styles.historicalCaseSummary}>{historicalCase.summary}</div> : null}
        {isExpanded && brief && (
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
                    <div key={`${caseKey}-${figureEntry.name}`} className={styles.historicalCasePrinciplesCard}>
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
              {brief.draftLegalCode &&
              typeof brief.draftLegalCode === 'object' &&
              Array.isArray(brief.draftLegalCode.articles) ? (
                <div className={styles.historicalCaseArticleList}>
                  {brief.draftLegalCode.articles.map((article, articleIndex) => (
                    <div key={`${caseKey}-article-${articleIndex}`} className={styles.historicalCaseArticleItem}>
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
                    <div className={styles.historicalCaseBestPatchPill}>Best patch: {brief.bestPatch}</div>
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
                              <span key={`${patch.id}-favored-${favoredByIndex}`}>{favoredByEntry}</span>
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
              <span key={`${historicalCase.id || title}-${tag}-${tagIndex}`}>{tag}</span>
            ))}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div ref={modalContentRef} className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
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
                  onClick={() => {
                    setActiveVoteType(null);
                    setVoteCount('');
                  }}
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
          <span className={`${styles.depthTag} ${styles[depthClass]}`}>{depthLabel}</span>

          {/* Generic Tags */}
          {tags.map((t, i) => (
            <button
              key={tagStableKeys[i] || `tag:${String(t)}`}
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
                    <StandalonePoliticalCompass compass={compassData as any} />
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
                    {proArguments.map((argument, index) =>
                      renderArgumentCard(argument, 'pro', `pro-${argument?.id || index}`),
                    )}
                  </div>
                  <div className={styles.argumentColumn} data-side="con">
                    <h4>Against</h4>
                    {conArguments.map((argument, index) =>
                      renderArgumentCard(argument, 'con', `con-${argument?.id || index}`),
                    )}
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
              onKeyDown={(event) =>
                handleCollapseHeaderKeyDown(event, () => setHistoricalCasesOpen(!historicalCasesOpen))
              }
            >
              <FontAwesomeIcon icon={historicalCasesOpen ? faCaretUp : faCaretDown} style={{ marginRight: 6 }} />
              <span>Historical Cases</span>
              {historicalCaseCount ? <span className={styles.collapseCount}>({historicalCaseCount})</span> : null}
              <span className={styles.collapseToggle}>{historicalCasesOpen ? 'Hide' : 'Show'}</span>
            </div>
            {historicalCasesOpen && (
              <div className={`${styles.collapseContent} ${styles.historicalCasesSection}`}>
                {historicalCases.map((historicalCase, caseIndex) =>
                  renderHistoricalCaseCard(historicalCase, caseIndex),
                )}
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
                  <span key={questionSearchKeys[i] || getDebateQuestionStableKey(q, 'question-search')}>
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
                    <div
                      key={questionCardKeys[i] || getDebateQuestionStableKey(q, 'question-card')}
                      className={styles.pileCard}
                      data-type={questionType}
                    >
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
                      <div className={styles.pileCardBody}>{renderQuestionPreview(q)}</div>
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
const SuggestNodeModal = ({ isOpen, onClose, parentNode, parentPath = [], onSubmit }: SuggestNodeModalProps) => {
  const [title, setTitle] = useState('');
  const handleSubmit = () => {
    onSubmit(parentNode, title);
    setTitle('');
    onClose();
  };

  if (!isOpen) return null;
  const lineage = [...parentPath, parentNode].filter((node): node is DebateNode => Boolean(node));

  return (
    <div className={styles.modalOverlay}>
      <div className={`${styles.modalContent} ${styles.suggestModalContainer}`}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Suggest New Topic</h2>
          <div className={styles.closeIcon} onClick={onClose}>
            <FontAwesomeIcon icon={faTimes} />
          </div>
        </div>

        <div className={styles.lineageDisplay}>
          <span className={styles.lineageLabel}>Path:</span>
          {lineage.map((node, i) => (
            <span key={getDebateNodeStableKey(node, `lineage-${i}`)} className={styles.lineageItem}>
              {node.name}{' '}
              {i < lineage.length - 1 && <FontAwesomeIcon icon={faChevronRight} className={styles.separator} />}
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
            <button className={styles.cancelBtn} onClick={onClose}>
              Cancel
            </button>
            <button className={styles.submitBtn} onClick={handleSubmit} disabled={!title.trim()}>
              Submit Proposal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// 5. Tree Node (With Collapsibility)
const TreeNode = ({
  node,
  depth = 0,
  parentPath = [],
  onNodeClick,
  onBookmark,
  bookmarkedNodes,
  onSuggestNode,
  staggerOffsetPx = 0,
  branchSpan = 1,
}: TreeNodeProps) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const hasChildren = node.children && node.children.length > 0;
  const netUpvotes = calculateNetUpvotes(node.votes);
  const nodeId = String(node.id || '').trim();
  const isBookmarked = nodeId ? bookmarkedNodes.includes(nodeId) : false;
  const fullLabel = cleanAtlasCategoryName(node.name);
  const compactLabel = getCompactTreeNodeLabel(node.name);
  const sortedChildren = hasChildren
    ? [...(node.children || [])].sort((a, b) => calculateNetUpvotes(b.votes) - calculateNetUpvotes(a.votes))
    : [];
  const childColumns = getTreeChildColumnCount(depth, sortedChildren.length);
  const childBranchSpans = sortedChildren.map((child) => getTreeSubtreeSpan(child));
  const totalChildColumns = childBranchSpans.reduce((sum, span) => sum + span, 0);
  const wrapperStyle = {
    '--ce-tree-node-stagger': `${staggerOffsetPx}px`,
    '--ce-tree-branch-span': String(branchSpan),
  } as React.CSSProperties;
  const childrenRowStyle = {
    '--ce-org-total-columns': String(totalChildColumns || 1),
  } as React.CSSProperties;

  return (
    <div
      className={styles.orgNodeWrapper}
      style={wrapperStyle}
      data-ce-tree-depth={depth}
      data-ce-tree-stagger={staggerOffsetPx}
    >
      <div
        className={`
          ${styles.orgCard}
          ${styles[`depth${Math.min(depth, 3)}`]}
          ${hasChildren ? styles.hasChildren : ''}
          ${isCollapsed ? styles.collapsed : ''}
        `}
        onClick={() => onNodeClick(node)}
        title={fullLabel || undefined}
      >
        <div className={styles.cardHeader}>
          <span className={styles.nodeTitle}>{compactLabel || fullLabel}</span>
        </div>
        <div className={styles.cardStats}>
          <span>
            <FontAwesomeIcon icon={faThumbsUp} /> {netUpvotes}
          </span>
          <FontAwesomeIcon
            icon={faBookmark}
            className={`${styles.bookmark} ${isBookmarked ? styles.bookmarked : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              if (nodeId) onBookmark(nodeId);
            }}
          />
        </div>

        <div
          className={styles.suggestBtn}
          onClick={(e) => {
            e.stopPropagation();
            onSuggestNode(node, parentPath);
          }}
          title="Suggest sub-topic"
        >
          <FontAwesomeIcon icon={faPlus} />
        </div>

        {hasChildren && (
          <div
            className={styles.collapseBtn}
            onClick={(e) => {
              e.stopPropagation();
              setIsCollapsed(!isCollapsed);
            }}
            title={isCollapsed ? 'Expand Branch' : 'Collapse Branch'}
          >
            <FontAwesomeIcon icon={isCollapsed ? faCaretDown : faCaretUp} />
          </div>
        )}
      </div>

      {hasChildren && !isCollapsed && (
        <div className={styles.orgChildrenContainer}>
          <div
            className={styles.orgChildrenRow}
            style={childrenRowStyle}
            data-ce-org-total-columns={totalChildColumns || 1}
          >
            {sortedChildren.map((child: DebateNode, i: number) => (
              <TreeNode
                key={getDebateNodeStableKey(child, `tree-child-${i}`)}
                node={child}
                depth={depth + 1}
                parentPath={[...parentPath, node]}
                onNodeClick={onNodeClick}
                onBookmark={onBookmark}
                bookmarkedNodes={bookmarkedNodes}
                onSuggestNode={onSuggestNode}
                staggerOffsetPx={getTreeChildStaggerPx(depth + 1, i, childColumns)}
                branchSpan={childBranchSpans[i] || 1}
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
    <div className={styles.legendItem}>
      <div className={`${styles.legendDot} ${styles.category}`}></div>
      <span className={styles.legendText}>Category</span>
    </div>
    <div className={styles.legendItem}>
      <div className={`${styles.legendDot} ${styles.subcategory}`}></div>
      <span className={styles.legendText}>Sub-Category</span>
    </div>
    <div className={styles.legendItem}>
      <div className={`${styles.legendDot} ${styles.topic}`}></div>
      <span className={styles.legendText}>Topic</span>
    </div>
    <div className={styles.legendItem}>
      <div className={`${styles.legendDot} ${styles.instance}`}></div>
      <span className={styles.legendText}>Instance</span>
    </div>
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
}: DebateMapProps) => {
  const externalDemoEnabled =
    externalDemoMode && typeof externalDemoMode === 'object' ? !!externalDemoMode.tools : !!externalDemoMode;
  // Routing Hooks
  const { nodeId: paramNodeId } = useParams<{ nodeId?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const urlDemoParam = new URLSearchParams(location.search || '').get('demo') === '1';
  const initialDemoEnabled = externalDemoEnabled || urlDemoParam;
  const [visualMode, setVisualMode] = useState<DebateVisualMode>(() => getInitialDebateVisualMode(atlasLayoutMode));
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [modalNodeId, setModalNodeId] = useState<string | null>(null);
  const [orderByUpvotes, setOrderByUpvotes] = useState(false);
  const [bookmarkedNodes, setBookmarkedNodes] = useState<string[]>([]);
  const [demoMode, setDemoMode] = useState(() => initialDemoEnabled);
  const [treeDataState, setTreeDataState] = useState<DebateNode[]>(() => buildAtlasTreeData(initialDemoEnabled));
  const [localVoteDeltas, setLocalVoteDeltas] = useState<LocalVoteDeltas>({});
  const [nodeTypeFilter, setNodeTypeFilter] = useState('all');
  const [copied, setCopied] = useState(false);

  // Suggest Modal State
  const [suggestNodeModalOpen, setSuggestNodeModalOpen] = useState(false);
  const [suggestNodeParent, setSuggestNodeParent] = useState<DebateNode | null>(null);
  const [suggestNodePath, setSuggestNodePath] = useState<DebateNode[]>([]);

  // Tree viewport fit state
  const treeContainerRef = useRef<HTMLDivElement | null>(null);
  const treeContentRef = useRef<HTMLDivElement | null>(null);
  const [treeFitScale, setTreeFitScale] = useState(1);
  const [treeFitHeight, setTreeFitHeight] = useState<number | null>(null);

  // Ref to track if we've already handled the deep link for the current ID
  const hasHandledDeepLink = useRef(false);
  const localVoteDeltasRef = useRef<LocalVoteDeltas>({});

  useEffect(() => {
    localVoteDeltasRef.current = localVoteDeltas;
  }, [localVoteDeltas]);

  // --- NODE ID PARSING (Fallback to manual URL check for wildcard routes) ---
  const effectiveNodeId = useMemo(() => {
    if (paramNodeId) return paramNodeId;
    const path = window.location.pathname;
    const match = path.match(/\/atlas\/(0x[a-fA-F0-9]+)/);
    return match ? match[1] : null;
  }, [paramNodeId]);

  // Reset handled flag when the URL ID changes
  useEffect(() => {
    hasHandledDeepLink.current = false;
  }, [effectiveNodeId]);

  useEffect(() => {
    const saved = localStorage.getItem('bookmarkedNodes');
    setBookmarkedNodes(parseBookmarkedNodeStorage(saved));
  }, []);

  useEffect(() => {
    setTreeDataState(applyLocalVoteDeltasToTree(buildAtlasTreeData(demoMode), localVoteDeltasRef.current));
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

  const modalReturnTo = useMemo(() => {
    if (embedded || typeof window === 'undefined') return '';
    const params = new URLSearchParams(location.search || '');
    return readSafeInternalReturnTo(params.get('returnTo') || '', window);
  }, [embedded, location.search]);

  const selectedCategory = useMemo(
    () => (selectedCategoryId ? findAtlasNodeById(treeDataState, selectedCategoryId) : null),
    [selectedCategoryId, treeDataState],
  );

  const modalContent = useMemo(() => {
    if (!modalNodeId) return null;
    return findAtlasNodeById(treeDataState, modalNodeId) || findAtlasNodeById(atlasTreeData, modalNodeId);
  }, [modalNodeId, treeDataState]);

  // --- DEEP LINK EFFECT: Open Modal if URL has Node ID ---
  useEffect(() => {
    // If we have an ID, data is ready, and we haven't already processed this exact deep link session
    if (effectiveNodeId && treeDataState && !hasHandledDeepLink.current) {
      // 1. Search in current state (which includes Demo Mode active/inactive state)
      let found = findAtlasNodeById(treeDataState, effectiveNodeId);

      // 2. Fallback: If not found in active state, check raw treeData.
      if (!found && treeDataState !== atlasTreeData) {
        found = findAtlasNodeById(atlasTreeData, effectiveNodeId);
      }

      if (found) {
        setModalNodeId(String(found.id || '').trim() || null);
        hasHandledDeepLink.current = true; // Mark as handled so it doesn't re-open on re-renders (like Demo toggle)
      }
    }
  }, [effectiveNodeId, treeDataState]);

  const handleNodeClick = useCallback((node: DebateNode) => setModalNodeId(String(node?.id || '').trim() || null), []);
  const closeModal = useCallback(() => {
    setModalNodeId(null);
    if (typeof onModalClose === 'function') {
      onModalClose();
      return;
    }
    navigate(modalReturnTo || buildPublicRoute('/atlas'), { replace: true });
  }, [modalReturnTo, navigate, onModalClose]);

  const handleBookmark = useCallback((id: string) => {
    setBookmarkedNodes((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      localStorage.setItem('bookmarkedNodes', JSON.stringify(next));
      return next;
    });
  }, []);

  // --- NEW: Copy Full URL for Deep Linking ---
  const copyToClipboard = useCallback(() => {
    const modalContentId = String(modalContent?.id || '').trim();
    if (modalContent && modalContentId) {
      const deepLink = new URL(buildPublicRoute(`/atlas/${modalContentId}`), window.location.origin);
      if (demoMode) {
        deepLink.searchParams.set('demo', '1');
      }
      navigator.clipboard
        .writeText(deepLink.toString())
        .then(() => {
          notify.success('Copied to clipboard');
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        })
        .catch((e) => {
          void e;
          notify.warn('Copy failed');
        });
    }
  }, [demoMode, modalContent]);

  // --- NEW: Handle Tag Clicks to route ---
  const handleTagClick = useCallback(
    (tag: string) => {
      // Regression guard: when the atlas is opened from a session page, tag exploration
      // should stay pinned to that session instead of widening back out to global scope.
      navigate(buildTagHref(tag, '', activeSessionSlug));
    },
    [activeSessionSlug, navigate],
  );

  const handleVote = useCallback((nodeId: string, voteType: VoteDirection, count = 1) => {
    const normalizedNodeId = String(nodeId || '').trim();
    if (!normalizedNodeId) return;

    setLocalVoteDeltas((prev) => {
      const existing = prev[normalizedNodeId] || { up: 0, down: 0 };
      const next = {
        ...prev,
        [normalizedNodeId]: {
          ...existing,
          [voteType]: (existing[voteType] || 0) + count,
        },
      };
      localVoteDeltasRef.current = next;
      return next;
    });

    setTreeDataState((prev) => {
      const update = (nodes: DebateNode[]): DebateNode[] =>
        nodes.map((node) => {
          if (String(node.id || '').trim() === normalizedNodeId) {
            const current = node.votes || {};
            const val = parseInt(String(current[voteType] || 0), 10);
            return { ...node, votes: { ...current, [voteType]: val + count } };
          }
          if (node.children) return { ...node, children: update(node.children) };
          return node;
        });
      return update(prev);
    });
  }, []);

  const handleSuggestNode = useCallback((parent: DebateNode, path: DebateNode[] = []) => {
    setSuggestNodeParent(parent);
    setSuggestNodePath(path);
    setSuggestNodeModalOpen(true);
  }, []);

  const handleSubmitSuggestedNode = useCallback((parent: DebateNode | null, title: string) => {
    uiLog.log('Suggestion submitted for', parent?.name || 'unknown node', ':', title);
  }, []);

  const handleCategoryClick = (cat: DebateNode) => setSelectedCategoryId(String(cat?.id || '').trim() || null);
  const handleVisualModeChange = useCallback((nextVisualMode: DebateVisualMode) => {
    setVisualMode(nextVisualMode);
    if (nextVisualMode !== DEBATE_VISUAL_MODES.TREE) {
      setSelectedCategoryId(null);
    }
  }, []);

  const flattenTree = useCallback((node: DebateNode, parentPath: DebateNode[] = []): FlattenedDebateNode[] => {
    let res: FlattenedDebateNode[] = [{ ...node, parentPath }];
    if (node.children)
      node.children.forEach((child: DebateNode) => {
        res = res.concat(flattenTree(child, [...parentPath, node]));
      });
    return res;
  }, []);

  const sortedNodes = useMemo(() => {
    // Only process sorting if in LIST mode
    if (visualMode !== DEBATE_VISUAL_MODES.LIST) return [];

    return treeDataState
      .flatMap((c) => flattenTree(c))
      .filter((n) => {
        if (nodeTypeFilter === 'all') return true;
        if (nodeTypeFilter === 'category' && n.parentPath.length !== 0) return false;
        if (nodeTypeFilter === 'subcategory' && n.parentPath.length !== 1) return false;
        return true;
      })
      .sort((a, b) => (orderByUpvotes ? calculateNetUpvotes(b.votes) - calculateNetUpvotes(a.votes) : 0));
  }, [treeDataState, orderByUpvotes, flattenTree, nodeTypeFilter, visualMode]);

  const updateTreeFit = useCallback(() => {
    if (visualMode !== DEBATE_VISUAL_MODES.TREE || !selectedCategory) {
      setTreeFitScale(1);
      setTreeFitHeight(null);
      return;
    }

    const viewportWidth = treeContainerRef.current?.clientWidth || 0;
    const contentWidth = treeContentRef.current?.scrollWidth || treeContentRef.current?.offsetWidth || 0;
    const contentHeight = treeContentRef.current?.offsetHeight || 0;

    const nextScale = getTreeViewportFitScale(viewportWidth, contentWidth);
    const nextHeight = getTreeViewportFitHeight(contentHeight, nextScale);

    setTreeFitScale((prev) => (Math.abs(prev - nextScale) < 0.001 ? prev : nextScale));
    setTreeFitHeight(nextHeight > 0 ? nextHeight : null);
  }, [selectedCategory, visualMode]);

  useLayoutEffect(() => {
    updateTreeFit();
  }, [updateTreeFit]);

  useEffect(() => {
    if (visualMode !== DEBATE_VISUAL_MODES.TREE || !selectedCategory) return undefined;

    const handleResize = () => {
      if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(updateTreeFit);
        return;
      }
      updateTreeFit();
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(handleResize);
      if (treeContainerRef.current) resizeObserver.observe(treeContainerRef.current);
      if (treeContentRef.current) resizeObserver.observe(treeContentRef.current);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver?.disconnect();
    };
  }, [selectedCategory, updateTreeFit, visualMode]);

  const wrapperClassName = [styles.debateMapWrapper, embedded ? styles.embeddedAtlas : styles.standaloneAtlas]
    .filter(Boolean)
    .join(' ');
  const atlasViewLayoutMode =
    visualMode === DEBATE_VISUAL_MODES.ATLAS ? ATLAS_LAYOUT_MODES.ORBITAL : ATLAS_LAYOUT_MODES.PACKED;
  const isAtlasVisualMode = visualMode === DEBATE_VISUAL_MODES.CIRCLES || visualMode === DEBATE_VISUAL_MODES.ATLAS;
  const treeRootClassName = [styles.orgChartRoot, treeFitScale < 0.86 ? styles.compactTreeFit : '']
    .filter(Boolean)
    .join(' ');
  const treeRootStyle = {
    transform: `scale(${treeFitScale})`,
  } as React.CSSProperties;

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
                <label>
                  <input
                    type="checkbox"
                    checked={orderByUpvotes}
                    onChange={(e) => setOrderByUpvotes(e.target.checked)}
                  />{' '}
                  Order by Upvotes
                </label>
              )}
              <label>
                <input type="checkbox" checked={demoMode} onChange={(e) => setDemoMode(e.target.checked)} /> Demo Mode
              </label>
            </div>

            {visualMode === DEBATE_VISUAL_MODES.LIST && (
              <div className={styles.filterGroup}>
                <span className={styles.filterLabel}>Filter Depth:</span>
                <select value={nodeTypeFilter} onChange={(e) => setNodeTypeFilter(e.target.value)}>
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
              <button
                key={getDebateNodeStableKey(cat, `category-${i}`)}
                className={`${styles.categoryButton} ${selectedCategory?.id === cat.id ? styles.active : ''}`}
                onClick={() => handleCategoryClick(cat)}
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}

        <div className={styles.nodesContainer}>
          {visualMode === DEBATE_VISUAL_MODES.LIST ? (
            <div className={styles.flatListContainer}>
              {sortedNodes.map((node, i) => (
                <FlatNode
                  key={getDebateNodeStableKey(node, `list-node-${i}`)}
                  node={node}
                  parentPath={node.parentPath}
                  onNodeClick={handleNodeClick}
                  onBookmark={handleBookmark}
                  bookmarkedNodes={bookmarkedNodes}
                />
              ))}
            </div>
          ) : isAtlasVisualMode ? (
            <AtlasView data={treeDataState} onNodeClick={handleNodeClick} atlasLayoutMode={atlasViewLayoutMode} />
          ) : (
            <div className={styles.orgChartContainer} ref={treeContainerRef}>
              {selectedCategory ? (
                <div className={styles.orgChartFitStage} style={treeFitHeight ? { height: treeFitHeight } : undefined}>
                  <div
                    ref={treeContentRef}
                    className={treeRootClassName}
                    style={treeRootStyle}
                    data-ce-tree-scale={treeFitScale.toFixed(3)}
                  >
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
