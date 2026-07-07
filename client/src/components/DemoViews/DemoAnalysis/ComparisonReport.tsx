import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCaretDown, faCaretUp, faInfoCircle, faTags } from '@fortawesome/free-solid-svg-icons';
import { beeswarmByExtremity, buildComparisonReportRows } from '../../../utilities/demo/demoAnalysisMath.js';
import styles from './ComparisonReport.module.scss';

type ComparisonGroup = {
  segmentKey?: string;
  name: string;
};

type Question = {
  id: string | number;
  text: string;
};

type FlatResponse = {
  questionId: string | number;
  responseText: string;
  segmentKey: string;
  rate?: number;
  totalVotes?: number;
  participantCount?: number;
};

type QuestionTag = {
  tagID: string;
  tagName: string;
};

type GroupRate = {
  groupName: string;
  segmentKey?: string;
  rate: number;
  color?: string;
};

type AnalysisRow = {
  questionId: string;
  questionText: string;
  responseText: string;
  consensus: number | null;
  divergence: number | null;
  divisiveness: number | null;
  groupRates: GroupRate[];
  tags: QuestionTag[];
};

type BeeswarmPoint = AnalysisRow & {
  index: number;
  extremity: number | null;
  primaryTag: QuestionTag | null;
  x: number;
  y: number;
};

type QuestionTagsById = Record<string, QuestionTag[]>;

type ColorScale = (value: string | number) => string;

type CollapseProps = {
  isOpen: boolean;
  children: React.ReactNode;
};

type ComparisonLegendProps = {
  groups: ComparisonGroup[];
  colorScale: ColorScale;
};

type TagLegendProps = {
  selectedTags: QuestionTag[];
  colorScale: ColorScale;
};

type DistributionDataset = {
  groupName: string;
  segmentKey?: string;
  meta: string;
  rows: Array<{
    responseText: string;
    rate: number;
  }>;
};

type BinaryResponseTone = 'agree' | 'unsure' | 'disagree';

type ComparisonReportProps = {
  flatResponses?: FlatResponse[];
  questions?: Question[];
  comparisonGroups?: ComparisonGroup[];
  questionTagsData?: QuestionTagsById;
  selectedTagIDs?: string[];
  onSelectedTagIDsChange?: (tagIDs: string[]) => void;
};

const Collapse = ({ isOpen, children }: CollapseProps) => (isOpen ? <div>{children}</div> : null);

const BINARY_RESPONSE_TONE_BY_LABEL: Record<string, BinaryResponseTone> = {
  agree: 'agree',
  unsure: 'unsure',
  disagree: 'disagree',
};

const RESPONSE_ORDER = ['Agree', 'Unsure', 'Disagree'];

const getBinaryResponseTone = (responseText = ''): BinaryResponseTone | null => {
  const normalized = String(responseText || '')
    .trim()
    .toLowerCase();
  return BINARY_RESPONSE_TONE_BY_LABEL[normalized] || null;
};

const getResponsePillToneClassName = (tone: BinaryResponseTone) => {
  if (tone === 'agree') return styles.responsePillAgree;
  if (tone === 'disagree') return styles.responsePillDisagree;
  return styles.responsePillUnsure;
};

const getCandlestickSegmentClassName = (responseText = '') => {
  const tone = getBinaryResponseTone(responseText);
  if (tone === 'agree') return styles.analysisCandleSegmentAgree;
  if (tone === 'disagree') return styles.analysisCandleSegmentDisagree;
  if (tone === 'unsure') return styles.analysisCandleSegmentUnsure;
  return styles.analysisCandleSegmentOther;
};

const getOrderedResponseTexts = (rows: FlatResponse[] = [], preferredResponseText = '') => {
  const responseSet = new Set(rows.map((row) => String(row?.responseText || '').trim()).filter(Boolean));
  const preferred = String(preferredResponseText || '').trim();
  if (preferred) responseSet.add(preferred);

  return [
    ...RESPONSE_ORDER.filter((responseText) => responseSet.has(responseText)),
    ...Array.from(responseSet)
      .filter((responseText) => !RESPONSE_ORDER.includes(responseText))
      .sort((left, right) => left.localeCompare(right)),
  ];
};

const formatDistributionMeta = (rows: FlatResponse[] = []) => {
  const modeledResponseCount = rows.reduce((max, row) => Math.max(max, Number(row?.totalVotes || 0)), 0);
  const participantCount = rows.reduce(
    (max, row) => Math.max(max, Number(row?.participantCount || 0)),
    modeledResponseCount,
  );

  if (modeledResponseCount > 0 && participantCount > 0) {
    return `${participantCount} ${participantCount === 1 ? 'persona' : 'personas'} · ${modeledResponseCount} modeled responses`;
  }
  if (modeledResponseCount > 0) {
    return `${modeledResponseCount} ${modeledResponseCount === 1 ? 'modeled response' : 'modeled responses'}`;
  }
  if (participantCount > 0) {
    return `${participantCount} ${participantCount === 1 ? 'response' : 'responses'}`;
  }
  return '';
};

const dedupeAnalysisItemsByQuestion = (items: AnalysisRow[] = []) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const questionId = String(item?.questionId || '');
    if (!questionId || seen.has(questionId)) return false;
    seen.add(questionId);
    return true;
  });
};

type ResponseLineProps = {
  responseText: string;
  context?: 'card' | 'tooltip';
};

const ResponseLine = ({ responseText, context = 'card' }: ResponseLineProps) => {
  const tone = getBinaryResponseTone(responseText);
  const Wrapper = context === 'tooltip' ? 'p' : 'div';
  const baseClassName = context === 'tooltip' ? styles.tooltipResponse : styles.responseText;

  if (!tone) {
    return <Wrapper className={baseClassName}>Response: &quot;{responseText}&quot;</Wrapper>;
  }

  return (
    <Wrapper className={`${baseClassName} ${styles.responseTextPillRow}`}>
      <span className={styles.responseTextPillLabel}>Response:</span>
      <span
        className={`${styles.responsePill} ${getResponsePillToneClassName(tone)}`}
        data-testid={`ce-demo-analysis-response-pill-${context}-${tone}`}
      >
        {responseText}
      </span>
    </Wrapper>
  );
};

const ComparisonLegend = ({ groups, colorScale }: ComparisonLegendProps) => (
  <div className={styles.legendContainer}>
    <span className={styles.legendTitle}>Comparing Groups:</span>
    <div className={styles.legendPills}>
      {groups.map((group, index) => (
        <span
          key={group.segmentKey || group.name}
          className={styles.legendPill}
          style={{ backgroundColor: colorScale(index) }}
        >
          {group.name}
        </span>
      ))}
    </div>
  </div>
);

const TagLegend = ({ selectedTags, colorScale }: TagLegendProps) => {
  if (!selectedTags || selectedTags.length === 0) {
    return null;
  }

  return (
    <div className={styles.tagLegendContainer}>
      <span className={styles.legendTitle}>Filtering by Tags:</span>
      <div className={styles.legendPills}>
        {selectedTags.map((tag) => (
          <span key={tag.tagID} className={styles.legendPill} style={{ backgroundColor: colorScale(tag.tagID) }}>
            {tag.tagName}
          </span>
        ))}
      </div>
    </div>
  );
};

const DistributionCandlesticks = ({ datasets }: { datasets: DistributionDataset[] }) => (
  <div className={styles.analysisDistributionList}>
    {datasets.map((dataset) => (
      <div key={dataset.segmentKey || dataset.groupName} className={styles.analysisDistributionDataset}>
        <div className={styles.analysisDistributionHeader}>
          <span className={styles.analysisDistributionTitle}>{dataset.groupName}</span>
          {dataset.meta ? <span className={styles.analysisDistributionMeta}>{dataset.meta}</span> : null}
        </div>
        <div
          className={styles.analysisCandlestick}
          data-testid={`ce-demo-analysis-card-candlestick-${dataset.segmentKey || dataset.groupName}`}
          aria-label={`${dataset.groupName} response distribution: ${dataset.rows.map((row) => `${row.responseText} ${(row.rate * 100).toFixed(0)}%`).join(', ')}.`}
        >
          {dataset.rows.map((row) => (
            <span
              key={`${dataset.segmentKey || dataset.groupName}:${row.responseText}`}
              className={`${styles.analysisCandleSegment} ${getCandlestickSegmentClassName(row.responseText)}`}
              style={{ width: `${Math.max(0, Math.min(100, row.rate * 100))}%` }}
              title={`${row.responseText}: ${(row.rate * 100).toFixed(0)}%`}
            />
          ))}
        </div>
        <div className={styles.analysisDistributionLegend}>
          {dataset.rows.map((row) => (
            <span
              key={`${dataset.segmentKey || dataset.groupName}:${row.responseText}:legend`}
              className={styles.analysisDistributionLegendItem}
            >
              <span
                className={`${styles.analysisDistributionDot} ${getCandlestickSegmentClassName(row.responseText)}`}
              />
              {row.responseText} {(row.rate * 100).toFixed(0)}%
            </span>
          ))}
        </div>
      </div>
    ))}
  </div>
);

const ComparisonReport = ({
  flatResponses = [],
  questions = [],
  comparisonGroups = [],
  questionTagsData = {},
  selectedTagIDs: selectedTagIDsProp,
  onSelectedTagIDsChange,
}: ComparisonReportProps) => {
  const [consensusOpen, setConsensusOpen] = useState(true);
  const [divergenceOpen, setDivergenceOpen] = useState(true);
  const [beeswarmOpen, setBeeswarmOpen] = useState(true);
  const [reportOpen, setReportOpen] = useState(true);
  const [showAllTags, setShowAllTags] = useState(false);
  const [internalSelectedTagIDs, setInternalSelectedTagIDs] = useState<Set<string>>(new Set());
  const [hoveredContent, setHoveredContent] = useState<React.ReactNode | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [swarmWidth, setSwarmWidth] = useState(700);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const swarmContainerRef = useRef<HTMLDivElement | null>(null);

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setTooltipPos({
      x: event.clientX - rect.left + 15,
      y: event.clientY - rect.top + 15,
    });
  };

  const analysisRows = useMemo<AnalysisRow[]>(
    () =>
      (
        buildComparisonReportRows as (input: {
          flatResponses: FlatResponse[];
          questions: Question[];
          comparisonGroups: ComparisonGroup[];
          questionTagsData: QuestionTagsById;
        }) => AnalysisRow[]
      )({
        flatResponses,
        questions,
        comparisonGroups,
        questionTagsData,
      }),
    [comparisonGroups, flatResponses, questionTagsData, questions],
  );

  const tagInfo = useMemo(() => {
    const tagCounts: Record<string, number> = {};
    const uniqueTags = new Map<string, QuestionTag>();
    analysisRows.forEach((row) => {
      row.tags.forEach((tag) => {
        if (!tag?.tagID) return;
        if (!uniqueTags.has(tag.tagID)) {
          uniqueTags.set(tag.tagID, tag);
        }
        tagCounts[tag.tagID] = Number(tagCounts[tag.tagID] || 0) + 1;
      });
    });

    const displayTags = Array.from(uniqueTags.values())
      .filter((tag) => tagCounts[tag.tagID] > 0)
      .sort((left, right) => tagCounts[right.tagID] - tagCounts[left.tagID]);

    return { tagCounts, displayTags };
  }, [analysisRows]);

  const groupColorScale = useMemo<ColorScale>(() => d3.scaleOrdinal<string | number, string>(d3.schemeCategory10), []);
  const tagColorScale = useMemo(() => {
    const tagIDs = tagInfo.displayTags.map((tag) => tag.tagID);
    return d3.scaleOrdinal<string | number, string>(d3.schemeTableau10).domain(tagIDs);
  }, [tagInfo.displayTags]);

  const selectedTagIDs = useMemo(
    () => new Set(Array.isArray(selectedTagIDsProp) ? selectedTagIDsProp : Array.from(internalSelectedTagIDs)),
    [internalSelectedTagIDs, selectedTagIDsProp],
  );

  const filteredRows = useMemo(() => {
    if (selectedTagIDs.size === 0) return analysisRows;
    return analysisRows.filter((row) => row.tags.some((tag) => selectedTagIDs.has(tag.tagID)));
  }, [analysisRows, selectedTagIDs]);

  const analysisResults = useMemo(
    () => ({
      topConsensus: filteredRows
        .filter((row) => row.consensus !== null)
        .sort((left, right) => Number(right.consensus || 0) - Number(left.consensus || 0))
        .slice(0, 20),
      topDivergence: filteredRows
        .filter((row) => row.divergence !== null)
        .sort((left, right) => Number(right.divergence || 0) - Number(left.divergence || 0))
        .slice(0, 20),
      beeswarmData: filteredRows
        .filter((row) => row.divisiveness !== null)
        .map((row, index) => ({
          ...row,
          index,
          extremity: row.divisiveness,
          primaryTag: row.tags.length > 0 ? row.tags[0] : null,
        })),
    }),
    [filteredRows],
  );

  const swarmedData = useMemo(() => {
    if (!analysisResults.beeswarmData || analysisResults.beeswarmData.length === 0 || swarmWidth <= 0) {
      return [];
    }
    const plotPadding = { left: 20, right: 20, top: 18, bottom: 52 };
    return beeswarmByExtremity(
      analysisResults.beeswarmData,
      Math.max(0, swarmWidth - plotPadding.left - plotPadding.right),
      160,
      plotPadding,
    ) as BeeswarmPoint[];
  }, [analysisResults.beeswarmData, swarmWidth]);

  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return undefined;
    const currentRef = swarmContainerRef.current;
    if (!currentRef) return undefined;

    const observer = new ResizeObserver((entries) => {
      if (entries[0]) {
        setSwarmWidth(entries[0].contentRect.width > 0 ? entries[0].contentRect.width : 700);
      }
    });
    observer.observe(currentRef);
    return () => observer.disconnect();
  }, []);

  const selectedTagsForLegend = useMemo(
    () => tagInfo.displayTags.filter((tag) => selectedTagIDs.has(tag.tagID)),
    [selectedTagIDs, tagInfo.displayTags],
  );

  const handleTagChange = (tagID: string) => {
    const next = new Set(selectedTagIDs);
    if (next.has(tagID)) {
      next.delete(tagID);
    } else {
      next.add(tagID);
    }

    if (onSelectedTagIDsChange) {
      onSelectedTagIDsChange(Array.from(next));
      return;
    }

    setInternalSelectedTagIDs(next);
  };

  const renderBeeswarmPlot = () => {
    if (comparisonGroups.length < 2) {
      return <p className={styles.noData}>Please select at least two demographic groups to compare.</p>;
    }
    if (!swarmedData || swarmedData.length === 0) {
      return <p className={styles.noData}>No data available to generate a beeswarm plot for the current filter.</p>;
    }

    const tooltipForPoint = (point: BeeswarmPoint) => (
      <div className={styles.tooltipContent}>
        <p className={styles.tooltipQuestion}>{point.questionText}</p>
        <ResponseLine responseText={point.responseText} context="tooltip" />
        {point.tags.length > 0 && (
          <p className={styles.tooltipTags}>Tags: {point.tags.map((tag) => tag.tagName).join(', ')}</p>
        )}
        <ul className={styles.tooltipBreakdown}>
          {point.groupRates.map((group, index) => (
            <li key={group.groupName}>
              <span className={styles.tooltipDot} style={{ backgroundColor: groupColorScale(index) }} />
              <span className={styles.tooltipGroupName}>{group.groupName}</span>
              <span className={styles.tooltipGroupRate}>{(group.rate * 100).toFixed(0)}%</span>
            </li>
          ))}
        </ul>
      </div>
    );

    return (
      <div className={styles.swarmLayoutContainer} ref={swarmContainerRef}>
        <svg width={swarmWidth} height={220} className={styles.beeswarmSvg}>
          <line x1={20} y1={176} x2={Math.max(20, swarmWidth - 20)} y2={176} stroke="#aaa" />
          <text x={20} y={206} fontSize="12" fill="#555" textAnchor="start">
            More Similarity
          </text>
          <text x={Math.max(20, swarmWidth - 20)} y={206} fontSize="12" fill="#555" textAnchor="end">
            More Difference
          </text>
          {swarmedData.map((point) => {
            const isFiltered = selectedTagIDs.size > 0;
            const circleFill = isFiltered && point.primaryTag ? tagColorScale(point.primaryTag.tagID) : null;
            return (
              <circle
                key={`${point.questionId}:${point.responseText}:${point.index}`}
                cx={point.x}
                cy={point.y}
                r={5}
                className={styles.beeswarmCircle}
                style={circleFill ? { fill: circleFill } : {}}
                onMouseEnter={() => setHoveredContent(tooltipForPoint(point))}
                onMouseLeave={() => setHoveredContent(null)}
              />
            );
          })}
        </svg>
      </div>
    );
  };

  const renderAnalysisList = (items: AnalysisRow[], type: 'Consensus' | 'Divergence') => {
    if (comparisonGroups.length < 2) {
      return <p className={styles.noData}>Please select at least two demographic groups to compare.</p>;
    }
    if (items.length === 0) {
      return <p className={styles.noData}>No significant items found for this selection.</p>;
    }

    return (
      <ul className={styles.analysisList}>
        {items.map((item) => {
          const colorizedGroupRates = item.groupRates.map((groupRate, index) => ({
            ...groupRate,
            color: groupColorScale(index),
          }));
          const scoreElement = type === 'Consensus'
            ? <ConsensusVisualizer groupRates={colorizedGroupRates} colorScale={groupColorScale} />
            : <DivergenceVisualizer groupRates={colorizedGroupRates} colorScale={groupColorScale} />;

          return (
            <li key={`${type}:${item.questionId}:${item.responseText}`} className={styles.analysisListItem}>
              <div className={styles.reportAnalysisContent}>
                <div className={styles.questionText}>{item.questionText}</div>
                <ResponseLine responseText={item.responseText} />
                <div className={styles.scoreVisualizerContainer}>{scoreElement}</div>
              </div>
            </li>
          );
        })}
      </ul>
    );
  };

  if (comparisonGroups.length < 2) {
    return (
      <div className={styles.polisReportContainer} data-testid="demo-analysis-empty-state">
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <FontAwesomeIcon icon={faInfoCircle} size="2x" style={{ color: '#6c757d', marginBottom: '1rem' }} />
          <h4 style={{ color: '#343a40' }}>Comparison Report</h4>
          <p className={styles.noData}>
            Select two or more demographic groups from the filters above to see a detailed comparison report.
          </p>
        </div>
      </div>
    );
  }

  const tagsToDisplay = showAllTags ? tagInfo.displayTags : tagInfo.displayTags.slice(0, 10);
  const comparisonSummary = `Comparing ${comparisonGroups.map((group) => group.name).join(', ')}`;

  return (
    <div
      className={styles.polisReportContainer}
      data-testid="demo-analysis-comparison-report"
      ref={containerRef}
      onMouseMove={handleMouseMove}
    >
      <button
        type="button"
        className={styles.reportCollapseHeader}
        aria-expanded={reportOpen}
        aria-controls="demo-analysis-comparison-report-body"
        data-testid="demo-analysis-comparison-report-toggle"
        onClick={() => setReportOpen((value) => !value)}
      >
        <span className={styles.reportCollapseCopy}>
          <span className={styles.mainReportTitle}>Comparison Report</span>
          <span className={styles.reportSummaryText} data-testid="demo-analysis-report-summary">
            {comparisonSummary}
          </span>
        </span>
        <FontAwesomeIcon className={styles.reportCollapseIcon} icon={reportOpen ? faCaretUp : faCaretDown} />
      </button>

      <Collapse isOpen={reportOpen}>
        <div
          id="demo-analysis-comparison-report-body"
          className={styles.reportCollapseBody}
          data-testid="demo-analysis-comparison-report-body"
        >
          <ComparisonLegend groups={comparisonGroups} colorScale={groupColorScale} />
          <TagLegend selectedTags={selectedTagsForLegend} colorScale={tagColorScale} />

          <div className={styles.sectionCollapse}>
            <div className={styles.sectionHeaderRow} onClick={() => setBeeswarmOpen((value) => !value)}>
              <h5 className={styles.sectionTitle}>
                <FontAwesomeIcon icon={beeswarmOpen ? faCaretUp : faCaretDown} />
                Similarity & Difference Spectrum
              </h5>
            </div>
            <Collapse isOpen={beeswarmOpen}>
              {tagInfo.displayTags.length > 0 && (
                <div className={styles.reportTagFilter}>
                  <h6 className={styles.reportTagFilterHeader}>
                    <FontAwesomeIcon icon={faTags} />
                    Filter by Tag
                  </h6>
                  <div className={styles.reportTagFilterCheckboxes}>
                    {tagsToDisplay.map((tag) => (
                      <label key={tag.tagID} className={styles.reportTagFilterCheckboxItem}>
                        <input
                          type="checkbox"
                          checked={selectedTagIDs.has(tag.tagID)}
                          onChange={() => handleTagChange(tag.tagID)}
                        />
                        {tag.tagName} ({tagInfo.tagCounts[tag.tagID]})
                      </label>
                    ))}
                  </div>
                  {tagInfo.displayTags.length > 10 && (
                    <div className={styles.viewMoreContainer}>
                      <button
                        type="button"
                        onClick={() => setShowAllTags((value) => !value)}
                        className={styles.viewMoreButton}
                      >
                        {showAllTags ? 'Show Less' : `Show ${tagInfo.displayTags.length - 10} More Tags`}
                      </button>
                    </div>
                  )}
                </div>
              )}
              {renderBeeswarmPlot()}
            </Collapse>
          </div>

          <div className={styles.sectionCollapse}>
            <div className={styles.sectionHeaderRow} onClick={() => setConsensusOpen((value) => !value)}>
              <h5 className={styles.sectionTitle}>
                <FontAwesomeIcon icon={consensusOpen ? faCaretUp : faCaretDown} />
                Top Similar Items
              </h5>
            </div>
            <Collapse isOpen={consensusOpen}>
              {renderAnalysisList(analysisResults.topConsensus.slice(0, 5), 'Consensus')}
            </Collapse>
          </div>

          <div className={styles.sectionCollapse}>
            <div className={styles.sectionHeaderRow} onClick={() => setDivergenceOpen((value) => !value)}>
              <h5 className={styles.sectionTitle}>
                <FontAwesomeIcon icon={divergenceOpen ? faCaretUp : faCaretDown} />
                Top Divergent Items
              </h5>
            </div>
            <Collapse isOpen={divergenceOpen}>
              {renderAnalysisList(analysisResults.topDivergence.slice(0, 5), 'Divergence')}
            </Collapse>
          </div>

          {hoveredContent && (
            <div
              className={styles.beeTooltip}
              data-testid="demo-analysis-beeswarm-tooltip"
              style={{ left: tooltipPos.x, top: tooltipPos.y }}
            >
              {hoveredContent}
            </div>
          )}
        </div>
      </Collapse>
    </div>
  );
};

export default ComparisonReport;
