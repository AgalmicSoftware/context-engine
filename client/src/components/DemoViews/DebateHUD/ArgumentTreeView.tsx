import React, { useState } from 'react';

import { Avatar } from './CharacterSVG';
import { debateData, sourceLinks } from '../../../variables/demo/debateData.js';
import { darkTheme as T, soften, useTheme } from './debateHudTheme';

type DebateSideKey = 'A' | 'B';

type DebateFigure = {
  name: string;
};

type ArgumentNode = {
  id: string;
  claim: string;
  type: string;
  side: DebateSideKey;
  source: string;
  strength: number;
  children?: ArgumentNode[];
};

type DebateSide = {
  color: string;
  figure: DebateFigure;
  tree: ArgumentNode;
};

type Debate = {
  id: number;
  sideA: DebateSide;
  sideB: DebateSide;
};

type ExpandedNodeSet = Set<string>;

type NodeIconProps = {
  type: string;
};

type TreeNodeProps = {
  node: ArgumentNode;
  debate: Debate;
  onNodeClick?: (node: ArgumentNode) => void;
  expandedNodes: ExpandedNodeSet;
  setExpandedNodes: React.Dispatch<React.SetStateAction<ExpandedNodeSet>>;
};

type PointCounterpointProps = {
  nodeA?: ArgumentNode | null;
  nodeB?: ArgumentNode | null;
  debate: Debate;
  expandedNodes: ExpandedNodeSet;
  setExpandedNodes: React.Dispatch<React.SetStateAction<ExpandedNodeSet>>;
  depth?: number;
};

type ArgumentTreeViewProps = {
  selectedDebateId?: number;
};

const sourceLinkMap = sourceLinks as Record<string, string>;

export const NodeIcon = ({ type }: NodeIconProps) => {
  const icons: Record<string, string> = {
    core: '●',
    sub: '◯',
  };
  return <span style={{ fontWeight: 600, opacity: 0.6 }}>{icons[type] || '•'}</span>;
};

export const TreeNode = ({ node, debate, onNodeClick, expandedNodes, setExpandedNodes }: TreeNodeProps) => {
  useTheme();

  const figure = node.side === 'A' ? debate.sideA.figure : debate.sideB.figure;
  const color = node.side === 'A' ? debate.sideA.color : debate.sideB.color;
  const isExpanded = expandedNodes.has(node.id);
  const hasChildren = node.children && node.children.length > 0;
  const [strength, setStrength] = useState(node.strength);

  return (
    <div style={{ marginLeft: node.side === 'B' ? 0 : 20, marginBottom: 12 }}>
      <div
        onClick={() => {
          if (hasChildren) {
            const newExpanded = new Set(expandedNodes);
            if (isExpanded) newExpanded.delete(node.id);
            else newExpanded.add(node.id);
            setExpandedNodes(newExpanded);
          }
        }}
        style={{
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: T.radiusSm,
          padding: '12px 14px',
          cursor: hasChildren ? 'pointer' : 'default',
          transition: 'all 0.15s ease',
          borderLeft: `3px solid ${color}`,
          marginBottom: 8,
          boxShadow: T.shadow,
        }}
        onMouseEnter={(e) => {
          if (hasChildren) {
            e.currentTarget.style.background = T.surfaceHover;
            e.currentTarget.style.boxShadow = T.shadowHover;
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = T.surface;
          e.currentTarget.style.boxShadow = T.shadow;
        }}
      >
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 2, flexShrink: 0 }}>
            <Avatar name={figure.name} color={color} size={20} />
            <NodeIcon type={node.type} />
            {hasChildren && (
              <div
                style={{
                  width: 16,
                  height: 16,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'transform 0.2s ease',
                  transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                }}
              >
                ▸
              </div>
            )}
          </div>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: 13,
                lineHeight: 1.5,
                color: T.text,
                fontStyle: 'italic',
                marginBottom: 6,
              }}
            >
              {node.claim}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {sourceLinkMap[node.source] ? (
                <a
                  href={sourceLinkMap[node.source]}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: 11,
                    background: soften(color, 0.08),
                    color,
                    padding: '2px 8px',
                    borderRadius: 4,
                    fontWeight: 500,
                    textDecoration: 'none',
                    cursor: 'pointer',
                    borderBottom: `1px dashed ${soften(color, 0.4)}`,
                  }}
                >
                  {node.source} ↗
                </a>
              ) : (
                <span
                  style={{
                    fontSize: 11,
                    background: soften(color, 0.08),
                    color,
                    padding: '2px 8px',
                    borderRadius: 4,
                    fontWeight: 500,
                  }}
                >
                  {node.source}
                </span>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    fontSize: 11,
                    color: T.textLight,
                  }}
                >
                  Strength: {strength}/10
                </span>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={strength}
                  onChange={(e) => setStrength(parseInt(e.target.value, 10))}
                  style={{
                    width: 60,
                    height: 4,
                    cursor: 'pointer',
                    accentColor: color,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {isExpanded && hasChildren && (
        <div style={{ marginLeft: 12, paddingLeft: 8, borderLeft: `1px dashed ${T.borderLight}` }}>
          {(node.children || []).map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              debate={debate}
              onNodeClick={onNodeClick}
              expandedNodes={expandedNodes}
              setExpandedNodes={setExpandedNodes}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const PointCounterpoint = ({
  nodeA,
  nodeB,
  debate,
  expandedNodes,
  setExpandedNodes,
  depth = 0,
}: PointCounterpointProps) => {
  useTheme();

  const isExpanded = expandedNodes.has(`pc-${nodeA?.id}-${nodeB?.id}`);
  const pairId = `pc-${nodeA?.id}-${nodeB?.id}`;
  const hasChildren = (nodeA?.children?.length || 0) > 0 || (nodeB?.children?.length || 0) > 0;
  const childrenA = nodeA?.children || [];
  const childrenB = nodeB?.children || [];
  const maxChildren = Math.max(childrenA.length, childrenB.length);

  const toggle = () => {
    const next = new Set(expandedNodes);
    if (isExpanded) next.delete(pairId);
    else next.add(pairId);
    setExpandedNodes(next);
  };

  return (
    <div style={{ marginBottom: depth === 0 ? 20 : 12, marginLeft: depth > 0 ? 16 : 0 }}>
      <div
        onClick={hasChildren ? toggle : undefined}
        style={{
          display: 'flex',
          gap: 0,
          cursor: hasChildren ? 'pointer' : 'default',
          borderRadius: T.radius,
          overflow: 'hidden',
          boxShadow: T.shadow,
          border: `1px solid ${T.border}`,
          marginBottom: 4,
        }}
      >
        {nodeA && (
          <div
            style={{
              flex: 1,
              padding: '12px 14px',
              background: soften(debate.sideA.color, 0.04),
              borderLeft: `4px solid ${debate.sideA.color}`,
            }}
          >
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
              <Avatar name={debate.sideA.figure.name} color={debate.sideA.color} size={18} />
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: debate.sideA.color,
                  textTransform: 'uppercase',
                  letterSpacing: '0.03em',
                }}
              >
                {depth === 0 ? 'Position' : 'Point'}
              </span>
              {hasChildren && (
                <span
                  style={{
                    fontSize: 11,
                    color: T.textLight,
                    transition: 'transform 0.2s ease',
                    display: 'inline-block',
                    transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                  }}
                >
                  ▸
                </span>
              )}
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.5, color: T.text, fontStyle: 'italic', marginBottom: 6 }}>
              {nodeA.claim}
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              {sourceLinkMap[nodeA.source] ? (
                <a
                  href={sourceLinkMap[nodeA.source]}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    fontSize: 10,
                    background: soften(debate.sideA.color, 0.08),
                    color: debate.sideA.color,
                    padding: '2px 6px',
                    borderRadius: 3,
                    fontWeight: 500,
                    textDecoration: 'none',
                    borderBottom: `1px dashed ${soften(debate.sideA.color, 0.4)}`,
                  }}
                >
                  {nodeA.source} ↗
                </a>
              ) : (
                <span
                  style={{
                    fontSize: 10,
                    background: soften(debate.sideA.color, 0.08),
                    color: debate.sideA.color,
                    padding: '2px 6px',
                    borderRadius: 3,
                    fontWeight: 500,
                  }}
                >
                  {nodeA.source}
                </span>
              )}
              <span style={{ fontSize: 10, color: T.textLight }}>Str: {nodeA.strength}/10</span>
            </div>
          </div>
        )}

        <div style={{ width: 2, background: T.border, flexShrink: 0 }} />

        {nodeB && (
          <div
            style={{
              flex: 1,
              padding: '12px 14px',
              background: soften(debate.sideB.color, 0.04),
              borderRight: `4px solid ${debate.sideB.color}`,
            }}
          >
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
              <Avatar name={debate.sideB.figure.name} color={debate.sideB.color} size={18} />
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: debate.sideB.color,
                  textTransform: 'uppercase',
                  letterSpacing: '0.03em',
                }}
              >
                {depth === 0 ? 'Counter-Position' : 'Counterpoint'}
              </span>
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.5, color: T.text, fontStyle: 'italic', marginBottom: 6 }}>
              {nodeB.claim}
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              {sourceLinkMap[nodeB.source] ? (
                <a
                  href={sourceLinkMap[nodeB.source]}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    fontSize: 10,
                    background: soften(debate.sideB.color, 0.08),
                    color: debate.sideB.color,
                    padding: '2px 6px',
                    borderRadius: 3,
                    fontWeight: 500,
                    textDecoration: 'none',
                    borderBottom: `1px dashed ${soften(debate.sideB.color, 0.4)}`,
                  }}
                >
                  {nodeB.source} ↗
                </a>
              ) : (
                <span
                  style={{
                    fontSize: 10,
                    background: soften(debate.sideB.color, 0.08),
                    color: debate.sideB.color,
                    padding: '2px 6px',
                    borderRadius: 3,
                    fontWeight: 500,
                  }}
                >
                  {nodeB.source}
                </span>
              )}
              <span style={{ fontSize: 10, color: T.textLight }}>Str: {nodeB.strength}/10</span>
            </div>
          </div>
        )}
      </div>

      {isExpanded && hasChildren && (
        <div style={{ paddingLeft: 8, borderLeft: `2px dashed ${T.borderLight}`, marginTop: 8 }}>
          {Array.from({ length: maxChildren }).map((_, i) => (
            <PointCounterpoint
              key={i}
              nodeA={childrenA[i] || null}
              nodeB={childrenB[i] || null}
              debate={debate}
              expandedNodes={expandedNodes}
              setExpandedNodes={setExpandedNodes}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const ArgumentTreeView = ({ selectedDebateId }: ArgumentTreeViewProps) => {
  useTheme();

  const [expandedNodes, setExpandedNodes] = useState<ExpandedNodeSet>(new Set());
  const debate =
    (debateData as Debate[]).find((item) => item.id === selectedDebateId) || (debateData[0] as Debate | undefined);

  if (!debate) return null;

  return (
    <div style={{ maxWidth: 1000 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
          padding: '0 4px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 4, height: 16, background: debate.sideA.color, borderRadius: 2 }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: debate.sideA.color }}>{debate.sideA.figure.name}</span>
        </div>
        <span style={{ fontSize: 11, color: T.textMuted, fontStyle: 'italic' }}>
          Click to expand point / counterpoint
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: debate.sideB.color }}>{debate.sideB.figure.name}</span>
          <div style={{ width: 4, height: 16, background: debate.sideB.color, borderRadius: 2 }} />
        </div>
      </div>
      <PointCounterpoint
        nodeA={debate.sideA.tree}
        nodeB={debate.sideB.tree}
        debate={debate}
        expandedNodes={expandedNodes}
        setExpandedNodes={setExpandedNodes}
      />
    </div>
  );
};

export default ArgumentTreeView;
