import type * as React from 'react';

export type AtlasLayoutMode = 'orbital' | 'packed';
export type DebateVisualMode = 'circles' | 'atlas' | 'tree' | 'list';
export type VoteDirection = 'up' | 'down';
export type DemoModeProp = boolean | { tools?: unknown; [key: string]: unknown };
export type LocalVoteDeltas = Record<string, Record<VoteDirection, number>>;

export interface DebateVoteTotals {
  up?: number | string;
  down?: number | string;
  [key: string]: number | string | undefined;
}

export interface DebateQuestionOption {
  label?: string;
  text?: string;
  value?: string | number;
  option?: string | number;
  [key: string]: unknown;
}

export interface DebateQuestion {
  id?: string;
  username?: string;
  questionType?: string;
  type?: string;
  question?: string;
  prompt?: string;
  options?: unknown;
  [key: string]: any;
}

export interface DebateComment {
  id?: string;
  comment?: string;
  username?: string;
  [key: string]: any;
}

export interface HistoricalVoteEntry {
  username: string;
  value: number;
  comment?: string;
  nodeId?: string;
  [key: string]: unknown;
}

export interface DebateArgument {
  id?: string;
  claim?: string;
  strength?: number | string;
  source?: string;
  children?: DebateArgument[];
  [key: string]: any;
}

export interface DebateArguments {
  pro?: DebateArgument[];
  con?: DebateArgument[];
  votes?: Record<string, string[]>;
  [key: string]: any;
}

export interface CompassAxis {
  label?: string;
  [key: string]: unknown;
}

export interface HistoricalCompassPoint {
  name: string;
  x: number;
  y: number;
  type?: string;
  color?: string;
  comment?: string;
  [key: string]: unknown;
}

export interface CompassData {
  xAxis?: CompassAxis;
  yAxis?: CompassAxis;
  points?: HistoricalCompassPoint[];
  [key: string]: any;
}

export interface HistoricalFieldRow {
  label: string;
  value: string;
}

export interface HistoricalFieldDefinition {
  key: string;
  label: string;
}

export interface HistoricalDraftArticle {
  label: string;
  body: string;
}

export interface HistoricalCasePanel {
  title: string;
  tone: 'primary' | 'secondary';
  rows: HistoricalFieldRow[];
}

export interface HistoricalPatchOption {
  id: string;
  name: string;
  summary: string;
  favoredBy: string[];
}

export interface HistoricalFigurePrincipleEntry {
  name: string;
  principles: string[];
}

export interface HistoricalCaseBrief {
  figurePrinciples: HistoricalFigurePrincipleEntry[];
  draftLegalCode: { articles: HistoricalDraftArticle[] } | string;
  adversarialAttack: {
    panels: HistoricalCasePanel[];
    fallbackText: string | null;
  };
  judgeTension: string;
  whyHard: string | null;
  decisionPrompt: string;
  patchOptions: HistoricalPatchOption[];
  bestPatch: string | null;
  whyOtherFails: string | null;
  precedentPressure: HistoricalFieldRow[];
}

export type HistoricalCaseBriefBuilder = (historicalCase: HistoricalCase, content?: DebateNode) => HistoricalCaseBrief;

export interface HistoricalCase {
  id?: string;
  title?: string;
  summary?: string;
  authors?: unknown;
  category?: string;
  venue?: string | number;
  year?: string | number;
  tags?: string[];
  url?: string;
  source_label?: string;
  principles_by_figure?: Record<string, unknown>;
  draft_legal_code?: {
    articles?: unknown[];
    [key: string]: unknown;
  };
  loophole_exploit?: Record<string, unknown>;
  overreach_variant?: Record<string, unknown>;
  judge_tension?: unknown;
  why_the_case_is_hard?: unknown;
  best_patch?: unknown;
  why_other_patch_fails?: unknown;
  open_question?: unknown;
  concrete_patch_options?: unknown;
  precedent_pressure?: Record<string, unknown>;
  [key: string]: any;
}

export interface DebateNode {
  id?: string;
  name?: string;
  depth?: number;
  parentPath?: DebateNode[];
  children?: DebateNode[];
  votes?: DebateVoteTotals;
  questions?: DebateQuestion[];
  comments?: DebateComment[];
  historicalVotes?: HistoricalVoteEntry[];
  historicalCases?: HistoricalCase[];
  scenarioVisualizations?: unknown[];
  compass?: CompassData;
  arguments?: DebateArguments;
  isCenter?: boolean;
  heat?: number;
  disagreementScore?: number;
  hierarchyDepth?: number;
  depthClass?: string;
  x?: number;
  y?: number;
  r?: number | null;
  groupId?: string;
  [key: string]: any;
}

export interface HistoricalFigureRecord {
  votes?: Record<string, string | number | null | undefined>;
  comments?: DebateComment[];
  questions?: DebateQuestion[];
  [key: string]: any;
}

export interface AtlasDimensions {
  w: number;
  h: number;
}

export interface DisagreementRange {
  min: number;
  max: number;
}

export interface AtlasLink {
  source: { x: number; y: number };
  target: { x: number; y: number };
  sourceId?: string;
  targetId?: string;
}

export interface AtlasRenderNode extends DebateNode {
  x: number;
  y: number;
  r: number | null;
  isCenter: boolean;
  hierarchyDepth: number;
  depth: number;
  depthClass: string;
  heat: number;
  disagreementScore: number;
}

export interface PackedAtlasLayoutNode {
  y: number;
  r: number | null;
}

export interface FlattenedDebateNode extends DebateNode {
  parentPath: DebateNode[];
}

export interface AtlasTopNodeCandidate {
  node: DebateNode;
  heat: number;
  order: number;
}

export interface AtlasViewProps {
  data: DebateNode[];
  onNodeClick: (node: DebateNode) => void;
  atlasLayoutMode?: AtlasLayoutMode;
}

export interface DebateMapProps {
  activeSessionSlug?: string;
  demoMode?: DemoModeProp;
  embedded?: boolean;
  requestedModalNodeId?: string | null;
  onModalClose?: (() => void) | null;
  atlasLayoutMode?: AtlasLayoutMode;
}

export interface AtlasChromeProps {
  atlasRoot: DebateNode | null;
  handleBack: (event?: React.SyntheticEvent) => void;
  onNodeClick: (node: DebateNode) => void;
  showActiveDebates: boolean;
  setShowActiveDebates: React.Dispatch<React.SetStateAction<boolean>>;
  topNodes: DebateNode[];
}

export interface AtlasLayoutViewProps {
  data: DebateNode[];
  atlasRoot: DebateNode | null;
  containerRef: React.RefObject<HTMLDivElement>;
  dimensions: AtlasDimensions;
  handleAtlasNodeClick: (node: AtlasRenderNode | DebateNode) => void;
  handleBack: (event?: React.SyntheticEvent) => void;
  onNodeClick: (node: DebateNode) => void;
  showActiveDebates: boolean;
  setShowActiveDebates: React.Dispatch<React.SetStateAction<boolean>>;
  topNodes: DebateNode[];
}

export interface FlatNodeProps {
  node: FlattenedDebateNode;
  parentPath?: DebateNode[];
  onNodeClick: (node: DebateNode) => void;
  onBookmark: (nodeId: string) => void;
  bookmarkedNodes: string[];
}

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: DebateNode | null;
  onVote: (nodeId: string, voteType: VoteDirection, count?: number) => void;
  copied: boolean;
  onCopy: () => void;
  onTagClick?: ((tag: string) => void) | null;
}

export interface SuggestNodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  parentNode: DebateNode | null;
  parentPath?: DebateNode[];
  onSubmit: (parentNode: DebateNode | null, title: string) => void;
}

export interface TreeNodeProps {
  node: DebateNode;
  depth?: number;
  parentPath?: DebateNode[];
  onNodeClick: (node: DebateNode) => void;
  onBookmark: (nodeId: string) => void;
  bookmarkedNodes: string[];
  onSuggestNode: (node: DebateNode, parentPath: DebateNode[]) => void;
  staggerOffsetPx?: number;
  branchSpan?: number;
}
