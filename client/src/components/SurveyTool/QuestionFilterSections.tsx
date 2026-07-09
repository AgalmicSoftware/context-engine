import React from 'react';
import { Button, FormGroup, Input, Label } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBookmark,
  faCheck,
  faChevronDown,
  faClipboard,
  faFilter,
  faQuestionCircle,
  faRobot,
  faSpinner,
  faStar,
  faTimes,
} from '@fortawesome/free-solid-svg-icons';

import GateTooltip from '../Gates/GateTooltip';
import SBTFilter from '../SBTs/SBTFilter';
import AudioInput from '../Shared/AudioInput/AudioInput';
import CETooltip from '../Shared/CETooltip';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import {
  QUESTION_FILTER_ACTIONS_STYLE,
  QUESTION_FILTER_BOOKMARK_FEEDBACK_STYLE,
  QUESTION_FILTER_DISABLED_TEXT_SPACING_STYLE,
  QUESTION_FILTER_SBT_SPINNER_STYLE,
  buildQuestionFilterAiCombineRowClassName,
  buildQuestionFilterSectionIconClassName,
  buildQuestionFilterTagBubbleClassName,
  buildQuestionFilterTypeButtonClassName,
  buildQuestionFilterTypePillClassName,
  resolveQuestionFilterBookmarkIconStyle,
  resolveQuestionFilterClearIconStyle,
  resolveQuestionFilterCopyIconStyle,
  resolveQuestionFilterSectionBodyStyle,
  resolveQuestionFilterSectionHeaderStyle,
} from './questionFilterDisplayHelpers';

import styles from './QuestionFilter.module.scss';

type FilterSummaryItem = {
  label: string;
  onRemove: () => void;
  type: string;
};

type FilterInputChangeEvent = {
  target: {
    value: unknown;
  };
};

type CollapsibleSectionProps = {
  title: React.ReactNode;
  sectionKey: string;
  icon: React.ComponentProps<typeof FontAwesomeIcon>['icon'];
  content: React.ReactNode;
  expandedSections: Record<string, unknown>;
  onToggleSection: (section: string) => void;
  disabled?: boolean;
  headerTestId?: string;
};

export function QuestionFilterCollapsibleSection({
  title,
  sectionKey,
  icon,
  content,
  expandedSections,
  onToggleSection,
  disabled = false,
  headerTestId = '',
}: CollapsibleSectionProps): JSX.Element {
  const isOpen = !!expandedSections[sectionKey];
  const clickable = !disabled;

  return (
    <div className={styles.filterSection}>
      <div
        className={styles.sectionHeader}
        data-testid={headerTestId || undefined}
        onClick={() => {
          if (clickable) {
            onToggleSection(sectionKey);
          }
        }}
        style={resolveQuestionFilterSectionHeaderStyle({ clickable, disabled })}
      >
        <h3>
          <FontAwesomeIcon icon={icon} className="me-2" />
          {title}
        </h3>
        <FontAwesomeIcon icon={faChevronDown} className={buildQuestionFilterSectionIconClassName(styles, isOpen)} />
      </div>
      <div style={resolveQuestionFilterSectionBodyStyle(isOpen, disabled)}>
        <div className={styles.sectionContent}>{content}</div>
      </div>
    </div>
  );
}

type TopQuestionsSectionProps = {
  expandedSections: Record<string, unknown>;
  pendingShowTopQuestions: boolean;
  pendingShowTopQuestionsByResponses: boolean;
  pendingTopQuestionsCount: string | number | readonly string[] | undefined;
  onToggleSection: (section: string) => void;
  onToggleShowTopQuestions: (byResponses?: boolean) => void;
  onTopQuestionsCountChange: (value: unknown) => void;
};

export function QuestionFilterTopQuestionsSection({
  expandedSections,
  pendingShowTopQuestions,
  pendingShowTopQuestionsByResponses,
  pendingTopQuestionsCount,
  onToggleSection,
  onToggleShowTopQuestions,
  onTopQuestionsCountChange,
}: TopQuestionsSectionProps): JSX.Element {
  const countDisabled = !pendingShowTopQuestions && !pendingShowTopQuestionsByResponses;

  return (
    <QuestionFilterCollapsibleSection
      title="Most Popular"
      sectionKey="popular"
      icon={faStar}
      expandedSections={expandedSections}
      onToggleSection={onToggleSection}
      content={
        <div>
          <FormGroup>
            <Label className={styles.filterOption}>
              <Input
                type="checkbox"
                checked={pendingShowTopQuestions}
                onChange={() => onToggleShowTopQuestions(false)}
                disabled={false}
              />
              Show top
              <Input
                type="number"
                min="1"
                value={pendingTopQuestionsCount}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) => onTopQuestionsCountChange(event.target.value)}
                disabled={countDisabled}
                id={styles.topQuestionsCountInput}
              />
              questions (by total conviction)
            </Label>
          </FormGroup>

          <FormGroup>
            <Label className={styles.filterOption}>
              <Input
                type="checkbox"
                checked={pendingShowTopQuestionsByResponses}
                onChange={() => onToggleShowTopQuestions(true)}
              />
              Show top
              <Input
                type="number"
                min="1"
                value={pendingTopQuestionsCount}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) => onTopQuestionsCountChange(event.target.value)}
                disabled={countDisabled}
                id={styles.topQuestionsCountInput}
              />
              questions (by # of responses)
            </Label>
          </FormGroup>
          {(pendingShowTopQuestions || pendingShowTopQuestionsByResponses) && (
            <small className="text-muted">This overrides other filters (type, tag, etc.)</small>
          )}
        </div>
      }
    />
  );
}

type TagsSectionProps = {
  allTagsCount: number;
  disabled: boolean;
  disabledReason: string;
  expandedSections: Record<string, unknown>;
  onTagSelection: (tag: string) => void;
  onToggleSection: (section: string) => void;
  onToggleShowAllTags: () => void;
  selectedTags: string[];
  showAllTags: boolean;
  tagsToDisplay: string[];
  tooltipId: string;
};

export function QuestionFilterTagsSection({
  allTagsCount,
  disabled,
  disabledReason,
  expandedSections,
  onTagSelection,
  onToggleSection,
  onToggleShowAllTags,
  selectedTags,
  showAllTags,
  tagsToDisplay,
  tooltipId,
}: TagsSectionProps): JSX.Element {
  return (
    <QuestionFilterCollapsibleSection
      title={
        <>
          Tags
          <FontAwesomeIcon
            icon={faQuestionCircle}
            className={styles.tooltip}
            id={tooltipId}
            onClick={(event: React.MouseEvent<SVGSVGElement>) => event.stopPropagation()}
          />
          <CETooltip placement="right" trigger="hover focus click" target={tooltipId} className={styles.tooltipBubble}>
            Tags are for user filtering/search. Session default tag suggestions are fed into the AI tagger and do not
            hide questions.
          </CETooltip>
        </>
      }
      sectionKey="tags"
      icon={faFilter}
      expandedSections={expandedSections}
      onToggleSection={onToggleSection}
      disabled={disabled}
      content={
        disabled ? (
          <p className={styles.disabledText}>{disabledReason}</p>
        ) : tagsToDisplay.length ? (
          <>
            <div className={styles.tagsContainer}>
              {tagsToDisplay.map((tag) => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <div
                    key={tag}
                    className={buildQuestionFilterTagBubbleClassName(styles, isSelected)}
                    onClick={() => onTagSelection(tag)}
                  >
                    #{tag}
                  </div>
                );
              })}
            </div>
            {allTagsCount > 10 && (
              <Button color="link" onClick={onToggleShowAllTags} className={styles.showMoreTagsButton}>
                {showAllTags ? 'Show Less' : 'Show More'}
              </Button>
            )}
          </>
        ) : (
          <p>No tags found in current questions.</p>
        )
      }
    />
  );
}

type QuestionTypeSectionProps = {
  disabled: boolean;
  expandedSections: Record<string, unknown>;
  onToggleSection: (section: string) => void;
  onTypeSelection: (type: string) => void;
  pendingSelectedTypes: unknown[];
};

export function QuestionFilterQuestionTypesSection({
  disabled,
  expandedSections,
  onToggleSection,
  onTypeSelection,
  pendingSelectedTypes,
}: QuestionTypeSectionProps): JSX.Element {
  return (
    <QuestionFilterCollapsibleSection
      title="Question Types"
      sectionKey="types"
      icon={faFilter}
      expandedSections={expandedSections}
      onToggleSection={onToggleSection}
      disabled={disabled}
      content={
        <div className={styles.questionTypeGrid}>
          <button
            type="button"
            className={buildQuestionFilterTypeButtonClassName(styles, pendingSelectedTypes.includes('binary'))}
            onClick={() => onTypeSelection('binary')}
            disabled={disabled}
            aria-pressed={pendingSelectedTypes.includes('binary')}
          >
            <div className={styles.typeTitle}>Binary</div>
            <div className={styles.typePreviewRow}>
              <span className={buildQuestionFilterTypePillClassName(styles, 'agree')}>Agree</span>
              <span className={buildQuestionFilterTypePillClassName(styles, 'unsure')}>Unsure</span>
              <span className={buildQuestionFilterTypePillClassName(styles, 'disagree')}>Disagree</span>
            </div>
          </button>

          <button
            type="button"
            className={buildQuestionFilterTypeButtonClassName(styles, pendingSelectedTypes.includes('multichoice'))}
            onClick={() => onTypeSelection('multichoice')}
            disabled={disabled}
            aria-pressed={pendingSelectedTypes.includes('multichoice')}
          >
            <div className={styles.typeTitle}>Multichoice</div>
            <div className={styles.typePreviewRow}>
              <span className={styles.typePill}>Opt 1</span>
              <span className={styles.typePill}>Opt 2</span>
              <span className={styles.typePill}>Opt 3</span>
            </div>
          </button>

          <button
            type="button"
            className={buildQuestionFilterTypeButtonClassName(styles, pendingSelectedTypes.includes('rating'))}
            onClick={() => onTypeSelection('rating')}
            disabled={disabled}
            aria-pressed={pendingSelectedTypes.includes('rating')}
          >
            <div className={styles.typeTitle}>Rating</div>
            <div className={styles.ratingPreviewWrap}>
              <div className={styles.ratingPreviewFill} />
              <div className={styles.ratingPreviewHandle} />
            </div>
          </button>

          <button
            type="button"
            className={buildQuestionFilterTypeButtonClassName(styles, pendingSelectedTypes.includes('freeform'))}
            onClick={() => onTypeSelection('freeform')}
            disabled={disabled}
            aria-pressed={pendingSelectedTypes.includes('freeform')}
          >
            <div className={styles.typeTitle}>Freeform</div>
            <div className={styles.freeformPreview}>...</div>
          </button>
        </div>
      }
    />
  );
}

type ResponseStatusSectionProps = {
  disabled: boolean;
  expandedSections: Record<string, unknown>;
  hasConnectedAccount: boolean;
  onRespondedToggle: () => void;
  onNotRespondedToggle: () => void;
  onToggleSection: (section: string) => void;
  filterByResponded: boolean;
  filterByNotResponded: boolean;
};

export function QuestionFilterResponseStatusSection({
  disabled,
  expandedSections,
  hasConnectedAccount,
  onRespondedToggle,
  onNotRespondedToggle,
  onToggleSection,
  filterByResponded,
  filterByNotResponded,
}: ResponseStatusSectionProps): JSX.Element | null {
  if (!hasConnectedAccount) return null;

  return (
    <QuestionFilterCollapsibleSection
      title="Response Status"
      sectionKey="responseStatus"
      icon={faCheck}
      expandedSections={expandedSections}
      onToggleSection={onToggleSection}
      disabled={disabled}
      content={
        <FormGroup>
          <Label className={styles.filterOption}>
            <Input type="checkbox" checked={filterByResponded} onChange={onRespondedToggle} disabled={disabled} />
            Responded
          </Label>
          <Label className={styles.filterOption}>
            <Input type="checkbox" checked={filterByNotResponded} onChange={onNotRespondedToggle} disabled={disabled} />
            Not responded
          </Label>
        </FormGroup>
      }
    />
  );
}

type SbtSectionProps = {
  creatorAndResponderMode?: unknown;
  defaultFeaturedSBTs?: unknown;
  disabled: boolean;
  disabledReason: string;
  ensureLightSbtUniverse?: unknown;
  expandedSections: Record<string, unknown>;
  isQuestionCacheReady?: unknown;
  isSBTCacheReady?: unknown;
  isSurveyCacheReady?: unknown;
  items: unknown;
  network?: unknown;
  onFilter: (filtered: unknown, newSbtFilterLocalState: unknown) => void;
  onToggleSection: (section: string) => void;
  provider?: unknown;
  sbtCacheRevision?: unknown;
  sbtFilterLocalState: unknown;
  sessionConfig: unknown;
  sessionSlug: string;
  setFilterLoading: (loading: unknown) => void;
};

export function QuestionFilterSbtSection({
  creatorAndResponderMode,
  defaultFeaturedSBTs,
  disabled,
  disabledReason,
  ensureLightSbtUniverse,
  expandedSections,
  isQuestionCacheReady,
  isSBTCacheReady,
  isSurveyCacheReady,
  items,
  network,
  onFilter,
  onToggleSection,
  provider,
  sbtCacheRevision,
  sbtFilterLocalState,
  sessionConfig,
  sessionSlug,
  setFilterLoading,
}: SbtSectionProps): JSX.Element {
  return (
    <QuestionFilterCollapsibleSection
      title={
        <>
          {creatorAndResponderMode ? 'Group(s) of Question Creator / Responder' : 'Group(s) of Question Creator'}
          {!isSBTCacheReady && (
            <span className={styles.sbtSectionLoadingStatus}>
              <FontAwesomeIcon icon={faSpinner} spin style={QUESTION_FILTER_SBT_SPINNER_STYLE} />
              <span>Loading groups</span>
            </span>
          )}
        </>
      }
      sectionKey="sbts"
      icon={faStar}
      expandedSections={expandedSections}
      onToggleSection={onToggleSection}
      disabled={disabled || !isSBTCacheReady}
      headerTestId={E2E_TESTIDS.QUESTION_FILTER_SECTION_SBT}
      content={
        disabled ? (
          <p className={styles.disabledText}>{disabledReason}</p>
        ) : (
          <SBTFilter
            items={items}
            provider={provider}
            network={network}
            mode={creatorAndResponderMode ? 'creatorAndResponder' : 'creator'}
            onFilter={onFilter}
            setFilterLoading={setFilterLoading}
            autoExpand={true}
            externalSBTFilterState={sbtFilterLocalState}
            defaultFeaturedSBTs={defaultFeaturedSBTs}
            isQuestionCacheReady={isQuestionCacheReady}
            isSurveyCacheReady={isSurveyCacheReady}
            isSBTCacheReady={isSBTCacheReady}
            sbtCacheRevision={sbtCacheRevision}
            sessionSlug={sessionSlug}
            activeSessionSlug={sessionSlug}
            sessionConfig={sessionConfig}
            ensureLightSbtUniverse={ensureLightSbtUniverse}
          />
        )
      }
    />
  );
}

type AiSectionProps = {
  activeAiTopN: number;
  aiAccessEnabled: boolean;
  aiApplyButtonLabel: string;
  aiApplyError: string;
  aiApplying: boolean;
  aiCombineWithOtherFilters: boolean;
  aiControlsDisabled: boolean;
  aiDraftQuery: string | number | null | undefined;
  aiRankingCount: string | number | readonly string[] | undefined;
  aiSearchQuery: string;
  aiSectionDisabled: boolean;
  expandedSections: Record<string, unknown>;
  isAiFilterApplied: boolean;
  isTopQuestionsModeActive: boolean;
  onAiCombineWithFiltersChange: (event: { target?: { checked?: unknown } | null }) => void;
  onAiDraftQueryChange: (nextValue: unknown) => void;
  onAiTopNChange: (event: { target?: { value?: unknown } | null }) => void;
  onApplyAiFilter: () => void;
  onToggleSection: (section: string) => void;
};

export function QuestionFilterAiSection({
  activeAiTopN,
  aiAccessEnabled,
  aiApplyButtonLabel,
  aiApplyError,
  aiApplying,
  aiCombineWithOtherFilters,
  aiControlsDisabled,
  aiDraftQuery,
  aiRankingCount,
  aiSearchQuery,
  aiSectionDisabled,
  expandedSections,
  isAiFilterApplied,
  isTopQuestionsModeActive,
  onAiCombineWithFiltersChange,
  onAiDraftQueryChange,
  onAiTopNChange,
  onApplyAiFilter,
  onToggleSection,
}: AiSectionProps): JSX.Element {
  const hasAiSearchQuery = aiSearchQuery.trim() !== '';

  return (
    <QuestionFilterCollapsibleSection
      title="AI Filter"
      sectionKey="ai"
      icon={faRobot}
      expandedSections={expandedSections}
      onToggleSection={onToggleSection}
      disabled={aiSectionDisabled}
      headerTestId={E2E_TESTIDS.QUESTION_FILTER_SECTION_AI}
      content={
        <FormGroup>
          {!aiAccessEnabled && (
            <p className={styles.disabledText} style={QUESTION_FILTER_DISABLED_TEXT_SPACING_STYLE}>
              AI filter unavailable. Requires an AI sponsored gate in this session or a local API key.
            </p>
          )}
          {isTopQuestionsModeActive && (
            <p className={styles.disabledText} style={QUESTION_FILTER_DISABLED_TEXT_SPACING_STYLE}>
              Disabled by “Top X questions” selection.
            </p>
          )}
          <div className={styles.aiFilterInputWrap}>
            <AudioInput
              hideEncryption={true}
              disableEncryption={true}
              enableAiRewrite={false}
              placeholder="Describe what you want to find..."
              value={aiDraftQuery}
              updateFunction={onAiDraftQueryChange}
              dataTestId={E2E_TESTIDS.QUESTION_FILTER_AI_QUERY}
              disabled={aiControlsDisabled}
            />
            <div className={styles.aiActionCard}>
              <div className={styles.aiActionRow}>
                <div className={styles.aiCountControl}>
                  <Label className={styles.aiCountLabel} for={E2E_TESTIDS.QUESTION_FILTER_AI_TOP_N}>
                    Questions
                  </Label>
                  <Input
                    id={E2E_TESTIDS.QUESTION_FILTER_AI_TOP_N}
                    className={styles.aiCountInput}
                    type="number"
                    data-testid={E2E_TESTIDS.QUESTION_FILTER_AI_TOP_N}
                    min="1"
                    value={aiRankingCount}
                    onChange={onAiTopNChange}
                    disabled={aiControlsDisabled}
                  />
                </div>
                <Button
                  color="info"
                  className={styles.aiApplyButton}
                  data-testid={E2E_TESTIDS.QUESTION_FILTER_AI_APPLY}
                  disabled={aiControlsDisabled}
                  onClick={onApplyAiFilter}
                >
                  {aiApplying && <FontAwesomeIcon icon={faSpinner} spin className={styles.aiApplySpinner} />}
                  <span>{aiApplyButtonLabel}</span>
                </Button>
                <FormGroup check className={styles.aiCombineGroup}>
                  <Label check className={buildQuestionFilterAiCombineRowClassName(styles)}>
                    <Input
                      type="checkbox"
                      checked={aiCombineWithOtherFilters}
                      onChange={onAiCombineWithFiltersChange}
                      disabled={aiControlsDisabled}
                    />
                    Combine with other filters
                  </Label>
                </FormGroup>
              </div>
              {isAiFilterApplied && hasAiSearchQuery && !aiApplyError && (
                <p className={styles.aiStatusText}>
                  Active: &quot;{aiSearchQuery}&quot; • Top {activeAiTopN} •{' '}
                  {aiCombineWithOtherFilters ? 'Combined' : 'Override'}
                </p>
              )}
              {isAiFilterApplied && hasAiSearchQuery && !aiCombineWithOtherFilters && !aiApplyError && (
                <p className={styles.aiHintText}>
                  AI Top-N override mode is active. Enable &quot;Combine with other filters&quot; to intersect with
                  type/tag/SBT filters.
                </p>
              )}
              {!!aiApplyError && <p className={styles.aiErrorText}>{aiApplyError}</p>}
            </div>
          </div>
        </FormGroup>
      }
    />
  );
}

type FilterActionsProps = {
  copiedUrlSuccess: boolean;
  filterBookmarkedFeedback: boolean;
  isCurrentFilterBookmarked: boolean;
  isDefault: boolean;
  onBookmarkCurrentFilter: () => void;
  onClearFilters: () => void;
  onCopyFilterUrl: () => void;
};

function QuestionFilterActionIcons({
  copiedUrlSuccess,
  filterBookmarkedFeedback,
  isCurrentFilterBookmarked,
  isDefault,
  onBookmarkCurrentFilter,
  onClearFilters,
  onCopyFilterUrl,
}: FilterActionsProps): JSX.Element {
  return (
    <span style={QUESTION_FILTER_ACTIONS_STYLE}>
      <FontAwesomeIcon
        icon={faTimes}
        data-testid={E2E_TESTIDS.QUESTION_FILTER_CLEAR_ALL}
        onClick={!isDefault ? onClearFilters : undefined}
        className={styles.clearFilterIcon}
        title={isDefault ? 'No filters to clear' : 'Clear current filters'}
        style={resolveQuestionFilterClearIconStyle(isDefault)}
      />
      <FontAwesomeIcon
        icon={copiedUrlSuccess ? faCheck : faClipboard}
        onClick={!isDefault && !copiedUrlSuccess ? onCopyFilterUrl : undefined}
        style={resolveQuestionFilterCopyIconStyle(isDefault, copiedUrlSuccess)}
        title={isDefault ? 'No custom filters to copy' : copiedUrlSuccess ? 'URL Copied!' : 'Copy Filter URL'}
      />
      <FontAwesomeIcon
        icon={faBookmark}
        onClick={!isDefault ? onBookmarkCurrentFilter : undefined}
        style={resolveQuestionFilterBookmarkIconStyle(isDefault, isCurrentFilterBookmarked, filterBookmarkedFeedback)}
        title={isDefault ? 'No custom filters to bookmark' : 'Bookmark Current Filter'}
      />
      {filterBookmarkedFeedback && !copiedUrlSuccess && (
        <span style={QUESTION_FILTER_BOOKMARK_FEEDBACK_STYLE}>Filter Bookmarked!</span>
      )}
    </span>
  );
}

type LoadFilterControlsProps = {
  filterUrlInput: string;
  onFilterUrlInputChange: (event: FilterInputChangeEvent) => void;
  onLoadFilter: () => void;
};

export function QuestionFilterLoadFilterControls({
  filterUrlInput,
  onFilterUrlInputChange,
  onLoadFilter,
}: LoadFilterControlsProps): JSX.Element {
  return (
    <div className={styles.filterControlsRow}>
      <div className={styles.loadFilterContainer}>
        <Input
          type="text"
          bsSize="sm"
          value={filterUrlInput}
          onChange={onFilterUrlInputChange}
          placeholder="Load filter from URL/string..."
          className={styles.loadFilterInput}
        />
        <Button size="sm" onClick={onLoadFilter} disabled={!filterUrlInput} className={styles.loadFilterButton}>
          Load
        </Button>
      </div>
    </div>
  );
}

type FilterSummaryControlsProps = FilterActionsProps &
  LoadFilterControlsProps & {
    showLoadInput: boolean;
    summaryItems: FilterSummaryItem[];
  };

export function QuestionFilterSummaryControls({
  copiedUrlSuccess,
  filterBookmarkedFeedback,
  filterUrlInput,
  isCurrentFilterBookmarked,
  isDefault,
  onBookmarkCurrentFilter,
  onClearFilters,
  onCopyFilterUrl,
  onFilterUrlInputChange,
  onLoadFilter,
  showLoadInput,
  summaryItems,
}: FilterSummaryControlsProps): JSX.Element {
  return (
    <div className={styles.filterSummaryContainer}>
      <div className={styles.filterSummaryLabel}>
        <span>Current Filters:</span>
        <div className={styles.filterSummaryActions}>
          <QuestionFilterActionIcons
            copiedUrlSuccess={copiedUrlSuccess}
            filterBookmarkedFeedback={filterBookmarkedFeedback}
            isCurrentFilterBookmarked={isCurrentFilterBookmarked}
            isDefault={isDefault}
            onBookmarkCurrentFilter={onBookmarkCurrentFilter}
            onClearFilters={onClearFilters}
            onCopyFilterUrl={onCopyFilterUrl}
          />
        </div>
      </div>

      <div className={styles.summaryItemsRow}>
        {summaryItems.map((item, index) => (
          <div key={index} className={styles.filterBubble} onClick={item.onRemove}>
            <span>{item.label}</span>
            <FontAwesomeIcon icon={faTimes} className={styles.removeIcon} />
          </div>
        ))}
      </div>

      {showLoadInput && (
        <QuestionFilterLoadFilterControls
          filterUrlInput={filterUrlInput}
          onFilterUrlInputChange={onFilterUrlInputChange}
          onLoadFilter={onLoadFilter}
        />
      )}
    </div>
  );
}
