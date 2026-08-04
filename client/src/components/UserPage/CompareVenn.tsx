import React, { useId, useState } from 'react';

import { normalizeArweaveUrl } from '../../utilities/arweave/arweaveUrls.js';
import { QuestionStanceCard } from '../Shared/QuestionStanceCard';
import pageStyles from './UserPage.module.scss';
import styles from './CompareVenn.module.scss';
import {
  resolveCompareVennNoteStyle,
  resolveCompareVennSbtImageStyle,
  resolveCompareVennSbtRowStyle,
  resolveCompareVennTooltipListStyle,
  resolveCompareVennTooltipStyle,
  resolveCompareVennWrapStyle,
} from './compareAddressStyles';
import {
  buildCompareVennModel,
  shortenCompareQuestionId,
  type BuildCompareVennModelOptions,
  type CompareVennDimension,
  type CompareVennModel,
  type CompareVennRegion,
  type CompareVennRegionKey,
} from './compareVennModel';

type RegionPosition = {
  x: number;
  y: number;
};

type VennGeometry = {
  width: number;
  height: number;
  circles: Array<{ cx: number; cy: number; radius: number; fill: string }>;
  labels: Array<{ x: number; y: number; anchor?: 'start' | 'middle' | 'end' }>;
  regions: Record<CompareVennRegionKey, RegionPosition>;
};

const VENN_GEOMETRY: Record<CompareVennDimension, VennGeometry> = {
  2: {
    width: 360,
    height: 200,
    circles: [
      { cx: 140, cy: 100, radius: 80, fill: 'rgba(255,255,255,0.12)' },
      { cx: 220, cy: 100, radius: 80, fill: 'rgba(200,200,255,0.12)' },
    ],
    labels: [
      { x: 70, y: 14 },
      { x: 290, y: 14, anchor: 'end' },
    ],
    regions: {
      a: { x: 100, y: 100 },
      b: { x: 260, y: 100 },
      c: { x: 180, y: 170 },
      ab: { x: 180, y: 100 },
      ac: { x: 150, y: 135 },
      bc: { x: 210, y: 135 },
      abc: { x: 180, y: 130 },
    },
  },
  3: {
    width: 360,
    height: 280,
    circles: [
      { cx: 130, cy: 110, radius: 80, fill: 'rgba(255,255,255,0.12)' },
      { cx: 230, cy: 110, radius: 80, fill: 'rgba(200,200,255,0.12)' },
      { cx: 180, cy: 170, radius: 80, fill: 'rgba(200,255,200,0.12)' },
    ],
    labels: [
      { x: 50, y: 24 },
      { x: 286, y: 24, anchor: 'end' },
      { x: 180, y: 268, anchor: 'middle' },
    ],
    regions: {
      a: { x: 95, y: 110 },
      b: { x: 265, y: 110 },
      c: { x: 180, y: 180 },
      ab: { x: 180, y: 102 },
      ac: { x: 150, y: 149 },
      bc: { x: 210, y: 149 },
      abc: { x: 180, y: 132 },
    },
  },
};

const resolveActiveRegion = (
  model: CompareVennModel,
  activeKey: CompareVennRegionKey | null,
): CompareVennRegion | null => model.regions.find((region) => region.key === activeKey) || null;

export type CompareVennProps = BuildCompareVennModelOptions;

export default function CompareVenn(props: CompareVennProps) {
  const model = buildCompareVennModel(props);
  const [activeKey, setActiveKey] = useState<CompareVennRegionKey | null>(null);
  const [pinnedKey, setPinnedKey] = useState<CompareVennRegionKey | null>(null);
  const detailsId = `compare-venn-details-${useId().replace(/:/g, '')}`;

  if (!model) return null;

  const geometry = VENN_GEOMETRY[model.dimension];
  const activeRegion = resolveActiveRegion(model, activeKey);
  const effectivePinnedKey = resolveActiveRegion(model, pinnedKey)?.key || null;
  const activePosition = activeRegion ? geometry.regions[activeRegion.key] : null;

  const previewRegion = (key: CompareVennRegionKey) => {
    if (effectivePinnedKey) return;
    setActiveKey(key);
  };
  const clearPreview = () => {
    if (!effectivePinnedKey) setActiveKey(null);
  };
  const pinRegion = (key: CompareVennRegionKey) => {
    setPinnedKey(key);
    setActiveKey(key);
  };
  const closeDetails = () => {
    setPinnedKey(null);
    setActiveKey(null);
  };

  return (
    <div style={resolveCompareVennWrapStyle()} data-testid={`ce-compare-venn-${model.dimension}`}>
      <svg
        width={geometry.width}
        height={geometry.height}
        role="group"
        aria-label={`${model.dimension}-participant comparison Venn diagram`}
      >
        <defs>
          <style>{`.vennText{font:12px system-ui, -apple-system, Segoe UI, Roboto, sans-serif; fill:#fff}`}</style>
        </defs>
        {geometry.circles.map((circle, index) => (
          <circle
            key={`circle-${index}`}
            cx={circle.cx}
            cy={circle.cy}
            r={circle.radius}
            fill={circle.fill}
            aria-hidden="true"
          />
        ))}
        {model.labels.map((label, index) => {
          const position = geometry.labels[index];
          return (
            <text
              key={`label-${index}`}
              className="vennText"
              x={position.x}
              y={position.y}
              textAnchor={position.anchor}
            >
              {label}
            </text>
          );
        })}
        {model.regions.map((region) => {
          const position = geometry.regions[region.key];
          const active = activeKey === region.key;
          const pinned = effectivePinnedKey === region.key;
          return (
            <text
              key={region.key}
              className={pageStyles.vennCount}
              x={position.x}
              y={position.y}
              textAnchor="middle"
              tabIndex={0}
              role="button"
              data-region={region.key}
              aria-controls={active ? detailsId : undefined}
              aria-expanded={active}
              aria-pressed={pinned}
              aria-label={`${region.label}: ${region.count}. ${
                region.items.length > 0 ? 'Focus or press Enter to pin details.' : 'No details available.'
              }`}
              onMouseEnter={() => previewRegion(region.key)}
              onMouseLeave={clearPreview}
              onFocus={() => pinRegion(region.key)}
              onClick={() => pinRegion(region.key)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  pinRegion(region.key);
                } else if (event.key === 'Escape') {
                  event.preventDefault();
                  closeDetails();
                }
              }}
            >
              {region.count}
            </text>
          );
        })}
      </svg>

      {activeRegion && activePosition ? (
        <div
          id={detailsId}
          role="region"
          aria-label={`${activeRegion.label} details`}
          aria-live="polite"
          className={pageStyles.vennTooltip}
          style={resolveCompareVennTooltipStyle({
            clientWidth: geometry.width,
            x: activePosition.x,
            y: activePosition.y,
          })}
          onMouseEnter={() => previewRegion(activeRegion.key)}
          onMouseLeave={clearPreview}
          onKeyDown={(event) => {
            if (event.key === 'Escape') closeDetails();
          }}
        >
          <div className={styles.detailsHeader}>
            <span>{activeRegion.label} details</span>
            {effectivePinnedKey ? (
              <button type="button" className={styles.closeButton} onClick={closeDetails} aria-label="Close Venn details">
                ×
              </button>
            ) : null}
          </div>
          {activeRegion.items.length === 0 ? (
            <div className={styles.empty}>No question or membership details in this region.</div>
          ) : (
            <ul style={resolveCompareVennTooltipListStyle()}>
              {activeRegion.items.map((item) => {
                if (item.type === 'membership') {
                  return (
                    <li key={`membership-${item.kind}-${item.name}`}>
                      <div style={resolveCompareVennSbtRowStyle()}>
                        {item.image ? (
                          <img
                            src={normalizeArweaveUrl(item.image, { contextLabel: 'compare_membership_image' })}
                            alt={`${item.name} membership`}
                            width="32"
                            height="32"
                            style={resolveCompareVennSbtImageStyle()}
                          />
                        ) : null}
                        <span>
                          <span>{item.name}</span>
                          <br />
                          <span className={styles.membershipKind}>On-chain SBT</span>
                        </span>
                      </div>
                    </li>
                  );
                }
                return (
                  <li key={`question-${item.id}-${item.option || ''}`}>
                    <QuestionStanceCard
                      label={`Q ${shortenCompareQuestionId(item.id)}`}
                      prompt={item.prompt}
                      votes={item.votes}
                      metaLabel={item.optionLabel ? `Option: ${item.optionLabel}` : ''}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}

      <div style={resolveCompareVennNoteStyle()}>{model.semantics}</div>
    </div>
  );
}
