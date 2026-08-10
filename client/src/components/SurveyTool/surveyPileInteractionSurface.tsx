import React from 'react';
import { Button } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCheck,
  faTimes,
  faSpinner,
  faFilter,
  faChevronLeft,
  faChevronRight,
  faPlus,
  faMinus,
  faCaretDown,
  faBars,
  faRobot,
  faMicrophone,
} from '@fortawesome/free-solid-svg-icons';

import PileHologramAssistant from './PileHologramAssistant';
import styles from './SurveyTool.module.scss';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { SHOW_PILE_HOLOGRAM_TOGGLE } from './surveyToolRuntimeSupport.js';

const ACTIVE_GREEN = 'var(--ce-status-success)';

type VoidHandler = () => void;

export type PileQuestionLike = {
  id: React.Key;
  prompt?: React.ReactNode;
  [key: string]: unknown;
};

export type PileScanDisplayLike = {
  metaLeftText: string;
  metaRightText: string;
};

type PileNavControlsProps = {
  pileQuestions: PileQuestionLike[];
  activePileIndex: number;
  navCounterVisible: boolean;
  handlePrev: VoidHandler;
  handleNext: VoidHandler;
};

type PileActionControlsProps = {
  collapseActionsIntoMenu?: boolean;
  isFilterActive: boolean;
  toggleFilterModal: VoidHandler;
  showCreate: boolean;
  toggleCreate: VoidHandler;
  showListeningPanel?: boolean;
  toggleListeningPanel?: VoidHandler;
  onViewAllClick?: VoidHandler | null;
  handleViewAllFromPile: VoidHandler;
};

type PileFooterControlsProps = {
  pileTopRailVisible: boolean;
  showSuccessBadgeLink: boolean;
  pileSubmitResponderHref: string;
  showSuccessBadgeStatus: boolean;
  showSubmitButton: boolean;
  handlePileSubmitClick: VoidHandler;
  hasPendingPileChanges: boolean;
  shouldHidePileSubmitButton: boolean;
  isSubmitting: boolean;
  activePromptMasked: boolean;
  finalSubmitText: string;
  showClearPendingButton: boolean;
  handleRevertPendingChanges: VoidHandler;
};

type PileDeckWindowProps = {
  pileQuestions: PileQuestionLike[];
  activePileIndex: number;
  renderActiveQuestion: (question: PileQuestionLike) => React.ReactNode;
};

type PileEmptyStateProps = {
  hasTerminalScanError: boolean;
  scanErrorMessage: string;
  hasError: boolean;
  isStillLoading: boolean;
  loadingElapsedSec: number;
  hydrateDone: number;
  hydrateDiscovered: number;
  isHydrating: boolean;
  showLongLoading: boolean;
  scanTotalBlocks: number;
  pileScanDisplay: PileScanDisplayLike;
  scanPercent: number;
  showFilteredEmptyState: boolean;
  showGatedEmptyState: boolean;
  gatedEmptyPanel: React.ReactNode;
};

export type PileInteractionSurfaceProps = {
  showHologramAssistant: boolean;
  toggleHologramAssistant: VoidHandler;
  showMiniBackgroundSpinner: boolean;
  priorResponsesHydrating: boolean;
  showLongLoading: boolean;
  loadingElapsedSec: number;
  pileQuestions: PileQuestionLike[];
  activePileIndex: number;
  renderActiveQuestion: (question: PileQuestionLike) => React.ReactNode;
  hasTerminalScanError: boolean;
  scanErrorMessage: string;
  hasError: boolean;
  isStillLoading: boolean;
  hydrateDone: number;
  hydrateDiscovered: number;
  isHydrating: boolean;
  scanTotalBlocks: number;
  pileScanDisplay: PileScanDisplayLike;
  scanPercent: number;
  showFilteredEmptyState: boolean;
  showGatedEmptyState: boolean;
  gatedEmptyPanel: React.ReactNode;
  isFilterActive: boolean;
  toggleFilterModal: VoidHandler;
  showCreate: boolean;
  toggleCreate: VoidHandler;
  showListeningPanel?: boolean;
  toggleListeningPanel?: VoidHandler;
  onViewAllClick?: VoidHandler | null;
  handleViewAllFromPile: VoidHandler;
  pileTopRailVisible: boolean;
  showSuccessBadgeLink: boolean;
  pileSubmitResponderHref: string;
  showSuccessBadgeStatus: boolean;
  showSubmitButton: boolean;
  handlePileSubmitClick: VoidHandler;
  hasPendingPileChanges: boolean;
  shouldHidePileSubmitButton: boolean;
  isSubmitting: boolean;
  activePromptMasked: boolean;
  finalSubmitText: string;
  showClearPendingButton: boolean;
  handleRevertPendingChanges: VoidHandler;
  navCounterVisible: boolean;
  handlePrev: VoidHandler;
  handleNext: VoidHandler;
};

export const PILE_SCAN_ERROR_DETAIL_STYLE: React.CSSProperties = {
  opacity: 0.8,
  marginTop: 8,
};

export const PILE_LOADING_ICON_WRAP_STYLE: React.CSSProperties = {
  fontSize: '2.5rem',
  display: 'flex',
  alignItems: 'center',
  gap: '15px',
};

export const resolvePileNavCounterStyle = (navCounterVisible: unknown): React.CSSProperties => ({
  opacity: navCounterVisible ? 0.8 : 0,
  transition: 'opacity 0.5s ease-in-out',
});

export const resolvePileFilterButtonStyle = (isFilterActive: unknown): React.CSSProperties =>
  isFilterActive ? { color: ACTIVE_GREEN, borderColor: ACTIVE_GREEN, opacity: 0.75 } : {};

export const resolvePileFilterIconStyle = (isFilterActive: unknown): React.CSSProperties =>
  isFilterActive ? { color: ACTIVE_GREEN } : {};

export const buildPileFilterButtonClassName = (styleMap: Record<string, string>, isFilterActive: unknown) =>
  [styleMap.actionButton, isFilterActive ? styleMap.actionButtonActive : ''].filter(Boolean).join(' ');

export const buildPileFooterClassName = (styleMap: Record<string, string>, pileTopRailVisible: unknown) =>
  `${styleMap.pileFooter}${pileTopRailVisible ? '' : ` ${styleMap.pileFooterHidden}`}`;

export const buildPileActionsClassName = (styleMap: Record<string, string>, collapseActionsIntoMenu: unknown) =>
  [styleMap.pileActions, collapseActionsIntoMenu ? styleMap.pileActionsMenuEligible : ''].filter(Boolean).join(' ');

export const buildPileSubmitButtonClassName = (
  styleMap: Record<string, string>,
  hasPendingPileChanges: unknown,
  shouldHidePileSubmitButton: unknown,
) =>
  `${styleMap.pileSubmitButton}${hasPendingPileChanges ? ` ${styleMap.submitGlow}` : ''}${shouldHidePileSubmitButton ? ` ${styleMap.pileSubmitButtonInactive}` : ''}`;

export const shouldCollapsePileActionsIntoMenu = ({
  pileTopRailVisible,
  showSubmitButton,
  hasPendingPileChanges,
  isSubmitting,
  shouldHidePileSubmitButton,
}: {
  pileTopRailVisible: unknown;
  showSubmitButton: unknown;
  hasPendingPileChanges: unknown;
  isSubmitting: unknown;
  shouldHidePileSubmitButton: unknown;
}): boolean =>
  !!pileTopRailVisible &&
  !!showSubmitButton &&
  (!!hasPendingPileChanges || !!isSubmitting) &&
  !shouldHidePileSubmitButton;

export const resolvePileCardStatusClassName = (styleMap: Record<string, string>, offset: number) => {
  if (offset === 0) return styleMap.pileCardActive;
  if (offset === 1) return styleMap.pileCardNext;
  if (offset === -1) return styleMap.pileCardPrev;
  if (offset > 1) return styleMap.pileCardAfter;
  return styleMap.pileCardBefore;
};

export const buildPileCardClassName = (styleMap: Record<string, string>, statusClassName: string) =>
  `${styleMap.pileCard} ${statusClassName}`;

export const resolvePileLoadingProgressFillStyle = ({
  isHydrating,
  hydrateDone,
  hydrateDiscovered,
  scanPercent,
}: {
  isHydrating: boolean;
  hydrateDone: number;
  hydrateDiscovered: number;
  scanPercent: number;
}): React.CSSProperties => ({
  width: `${
    isHydrating
      ? hydrateDiscovered > 0
        ? Math.round((Math.min(hydrateDone, hydrateDiscovered) / hydrateDiscovered) * 100)
        : 0
      : scanPercent
  }%`,
});

export const buildPileHologramToggleClassName = (styleMap: Record<string, string>, showHologramAssistant: unknown) =>
  `${styleMap.pileHologramToggle}${showHologramAssistant ? ` ${styleMap.pileHologramToggleActive}` : ''}`;

export const resolvePileMiniLoaderStyle = (priorResponsesHydrating: unknown): React.CSSProperties => ({
  opacity: priorResponsesHydrating ? 0.5 : 1,
});

const renderPileNavControls = ({
  pileQuestions,
  activePileIndex,
  navCounterVisible,
  handlePrev,
  handleNext,
}: PileNavControlsProps): React.ReactElement => (
  <div className={styles.pileNav}>
    <button
      onClick={handlePrev}
      disabled={pileQuestions.length === 0 || activePileIndex === 0}
      className={styles.pileNavArrow}
      aria-label="Previous Question"
    >
      <FontAwesomeIcon icon={faChevronLeft} />
    </button>
    <span className={styles.pileNavCounterText} style={resolvePileNavCounterStyle(navCounterVisible)}>
      {pileQuestions.length === 0 ? 0 : activePileIndex + 1} / {pileQuestions.length}
    </span>
    <button
      onClick={handleNext}
      disabled={pileQuestions.length === 0 || activePileIndex === pileQuestions.length - 1}
      className={styles.pileNavArrow}
      aria-label="Next Question"
    >
      <FontAwesomeIcon icon={faChevronRight} />
    </button>
  </div>
);

const renderPileActionControls = ({
  collapseActionsIntoMenu = false,
  isFilterActive,
  toggleFilterModal,
  showCreate,
  toggleCreate,
  showListeningPanel = false,
  toggleListeningPanel = () => {},
  onViewAllClick,
  handleViewAllFromPile,
}: PileActionControlsProps): React.ReactElement => {
  const filterButtonStyle = resolvePileFilterButtonStyle(isFilterActive);
  const filterIconStyle = resolvePileFilterIconStyle(isFilterActive);

  return (
    <div className={buildPileActionsClassName(styles, collapseActionsIntoMenu)}>
      <button
        type="button"
        className={`${styles.actionButton} ${styles.pileActionMenuToggle}`}
        title="Question actions"
        aria-label="Question actions"
        aria-haspopup="menu"
      >
        <FontAwesomeIcon icon={faBars} />
      </button>

      <div className={styles.pileActionButtonGroup}>
        <button
          onClick={toggleFilterModal}
          className={buildPileFilterButtonClassName(styles, isFilterActive)}
          style={filterButtonStyle}
          title="Filter Questions"
          data-testid={E2E_TESTIDS.SURVEY_FILTER_TOGGLE}
        >
          <FontAwesomeIcon icon={faFilter} style={filterIconStyle} />
        </button>

        <button
          onClick={toggleCreate}
          className={styles.actionButton}
          title={showCreate ? 'Close Create Interface' : 'Create New Question'}
          data-testid={E2E_TESTIDS.SURVEY_CREATE_TOGGLE_PILE}
        >
          <FontAwesomeIcon icon={showCreate ? faMinus : faPlus} />
        </button>

        <button
          onClick={toggleListeningPanel}
          className={`${styles.actionButton} ${showListeningPanel ? styles.actionButtonActive : ''}`}
          title={showListeningPanel ? 'Close listening' : 'Open listening'}
          aria-pressed={showListeningPanel}
          data-testid={E2E_TESTIDS.SESSION_LISTENING_TOGGLE}
        >
          <FontAwesomeIcon icon={faMicrophone} />
        </button>

        {onViewAllClick && (
          <button
            onClick={handleViewAllFromPile}
            className={styles.actionButton}
            title="View All Questions"
            data-testid={E2E_TESTIDS.SURVEY_VIEW_ALL}
          >
            <FontAwesomeIcon icon={faCaretDown} />
          </button>
        )}
      </div>
    </div>
  );
};

const renderPileFooterControls = ({
  pileTopRailVisible,
  showSuccessBadgeLink,
  pileSubmitResponderHref,
  showSuccessBadgeStatus,
  showSubmitButton,
  handlePileSubmitClick,
  hasPendingPileChanges,
  shouldHidePileSubmitButton,
  isSubmitting,
  activePromptMasked,
  finalSubmitText,
  showClearPendingButton,
  handleRevertPendingChanges,
}: PileFooterControlsProps): React.ReactElement => (
  <div className={buildPileFooterClassName(styles, pileTopRailVisible)}>
    {showSuccessBadgeLink ? (
      <a
        href={pileSubmitResponderHref}
        className={styles.pileSubmitSuccessBadge}
        data-testid={E2E_TESTIDS.SURVEY_SUBMITTED_INDICATOR}
        aria-label="View your submitted responses"
        title="View your submitted responses"
      >
        <FontAwesomeIcon icon={faCheck} className={styles.pileSubmitSuccessIcon} />
      </a>
    ) : showSuccessBadgeStatus ? (
      <div
        className={styles.pileSubmitSuccessBadge}
        data-testid={E2E_TESTIDS.SURVEY_SUBMITTED_INDICATOR}
        role="status"
        aria-label="Submitted"
        title="Submitted"
      >
        <FontAwesomeIcon icon={faCheck} className={styles.pileSubmitSuccessIcon} />
      </div>
    ) : showSubmitButton ? (
      <Button
        onClick={handlePileSubmitClick}
        data-testid={E2E_TESTIDS.SURVEY_SUBMIT}
        className={buildPileSubmitButtonClassName(styles, hasPendingPileChanges, shouldHidePileSubmitButton)}
        disabled={isSubmitting || activePromptMasked}
      >
        {isSubmitting ? (
          <FontAwesomeIcon icon={faSpinner} spin />
        ) : (
          <span className={styles.pileSubmitButtonContent}>
            <span className={styles.pileSubmitButtonLabel}>{finalSubmitText}</span>
            <span className={styles.pileSubmitButtonTrail} aria-hidden="true">
              <FontAwesomeIcon icon={faChevronRight} className={styles.pileSubmitButtonTrailIcon} />
              <FontAwesomeIcon icon={faChevronRight} className={styles.pileSubmitButtonTrailIcon} />
              <FontAwesomeIcon icon={faChevronRight} className={styles.pileSubmitButtonTrailIcon} />
            </span>
          </span>
        )}
      </Button>
    ) : null}

    {showClearPendingButton && (
      <button
        type="button"
        className={styles.pileIconButton}
        onClick={handleRevertPendingChanges}
        title="Clear changes"
        aria-label="Clear pending changes"
      >
        <FontAwesomeIcon icon={faTimes} />
      </button>
    )}
  </div>
);

const renderPileDeckWindow = ({
  pileQuestions,
  activePileIndex,
  renderActiveQuestion,
}: PileDeckWindowProps): React.ReactNode[] => {
  const startIdx = Math.max(0, activePileIndex - 2);
  const endIdx = Math.min(pileQuestions.length, activePileIndex + 3);

  return pileQuestions.slice(startIdx, endIdx).map((q, sliceIdx) => {
    const idx = startIdx + sliceIdx;
    const offset = idx - activePileIndex;

    const status = resolvePileCardStatusClassName(styles, offset);

    return (
      <div key={q.id} className={buildPileCardClassName(styles, status)}>
        {offset === 0 ? renderActiveQuestion(q) : <div className={styles.pileCardInner}></div>}
      </div>
    );
  });
};

const renderPileEmptyState = ({
  hasTerminalScanError,
  scanErrorMessage,
  hasError,
  isStillLoading,
  loadingElapsedSec,
  hydrateDone,
  hydrateDiscovered,
  isHydrating,
  showLongLoading,
  scanTotalBlocks,
  pileScanDisplay,
  scanPercent,
  showFilteredEmptyState,
  showGatedEmptyState,
  gatedEmptyPanel,
}: PileEmptyStateProps): React.ReactNode => {
  if (hasTerminalScanError) {
    return <div>{scanErrorMessage}</div>;
  }

  if (hasError) {
    return (
      <>
        <div>Cache initialization error (RPC or metadata fetch failed).</div>
        <div style={PILE_SCAN_ERROR_DETAIL_STYLE}>Try refreshing questions/responses or reloading the page.</div>
      </>
    );
  }

  if (isStillLoading) {
    return (
      <>
        <div style={PILE_LOADING_ICON_WRAP_STYLE}>
          <FontAwesomeIcon icon={faSpinner} spin size="1x" />
        </div>
        <div className={styles.pileLoadingHeadline}>Loading... {Math.max(0, Number(loadingElapsedSec || 0))}s</div>
        <div className={styles.pileLoadingSubhead}>
          {isHydrating
            ? `Loading Metadata (${Math.min(hydrateDone, hydrateDiscovered)} / ${hydrateDiscovered})`
            : showLongLoading
              ? ''
              : ''}
        </div>
        {(scanTotalBlocks > 0 || isHydrating) && (
          <div className={styles.pileLoadingProgressWrap}>
            <div className={styles.pileLoadingProgressMeta}>
              <span>
                {isHydrating
                  ? `${Math.max(0, hydrateDiscovered - Math.min(hydrateDone, hydrateDiscovered))} items left`
                  : pileScanDisplay.metaLeftText}
              </span>
              <span>
                {isHydrating
                  ? `${Math.min(hydrateDone, hydrateDiscovered)} / ${hydrateDiscovered}`
                  : pileScanDisplay.metaRightText}
              </span>
            </div>
            <div className={styles.pileLoadingProgressBar}>
              <div
                className={styles.pileLoadingProgressFill}
                style={resolvePileLoadingProgressFillStyle({
                  isHydrating,
                  hydrateDone,
                  hydrateDiscovered,
                  scanPercent,
                })}
              />
            </div>
          </div>
        )}
      </>
    );
  }

  if (showFilteredEmptyState) {
    return 'No questions match current filters.';
  }

  if (showGatedEmptyState) {
    return gatedEmptyPanel;
  }

  return 'No questions available.';
};

export const renderPileInteractionSurface = ({
  showHologramAssistant,
  toggleHologramAssistant,
  showMiniBackgroundSpinner,
  priorResponsesHydrating,
  showLongLoading,
  loadingElapsedSec,
  pileQuestions,
  activePileIndex,
  renderActiveQuestion,
  hasTerminalScanError,
  scanErrorMessage,
  hasError,
  isStillLoading,
  hydrateDone,
  hydrateDiscovered,
  isHydrating,
  scanTotalBlocks,
  pileScanDisplay,
  scanPercent,
  showFilteredEmptyState,
  showGatedEmptyState,
  gatedEmptyPanel,
  isFilterActive,
  toggleFilterModal,
  showCreate,
  toggleCreate,
  showListeningPanel,
  toggleListeningPanel,
  onViewAllClick,
  handleViewAllFromPile,
  pileTopRailVisible,
  showSuccessBadgeLink,
  pileSubmitResponderHref,
  showSuccessBadgeStatus,
  showSubmitButton,
  handlePileSubmitClick,
  hasPendingPileChanges,
  shouldHidePileSubmitButton,
  isSubmitting,
  activePromptMasked,
  finalSubmitText,
  showClearPendingButton,
  handleRevertPendingChanges,
  navCounterVisible,
  handlePrev,
  handleNext,
}: PileInteractionSurfaceProps): React.ReactElement => (
  <div className={styles.pileInteractionUnit}>
    {SHOW_PILE_HOLOGRAM_TOGGLE && (
      <button
        type="button"
        className={buildPileHologramToggleClassName(styles, showHologramAssistant)}
        onClick={toggleHologramAssistant}
        aria-label={showHologramAssistant ? 'Hide holographic guide' : 'Show holographic guide'}
        aria-pressed={showHologramAssistant}
        title={showHologramAssistant ? 'Hide holographic guide' : 'Show holographic guide'}
        data-testid={E2E_TESTIDS.SURVEY_PILE_HOLOGRAM_TOGGLE}
      >
        <FontAwesomeIcon icon={faRobot} />
      </button>
    )}

    {showMiniBackgroundSpinner && !showHologramAssistant && (
      <div className={styles.miniSpinnerWrapper}>
        <FontAwesomeIcon
          icon={faSpinner}
          spin
          className={styles.miniLoaderIcon}
          style={resolvePileMiniLoaderStyle(priorResponsesHydrating)}
          title={
            priorResponsesHydrating
              ? 'Loading your previous responses...'
              : showLongLoading
                ? 'Still scanning... checking network'
                : 'Background refresh active'
          }
        />
      </div>
    )}

    <div className={styles.pileCardContainer}>
      {showHologramAssistant ? (
        <PileHologramAssistant />
      ) : pileQuestions.length === 0 ? (
        <div className={styles.pileEmptyState}>
          {renderPileEmptyState({
            hasTerminalScanError,
            scanErrorMessage,
            hasError,
            isStillLoading,
            loadingElapsedSec,
            hydrateDone,
            hydrateDiscovered,
            isHydrating,
            showLongLoading,
            scanTotalBlocks,
            pileScanDisplay,
            scanPercent,
            showFilteredEmptyState,
            showGatedEmptyState,
            gatedEmptyPanel,
          })}
        </div>
      ) : (
        renderPileDeckWindow({
          pileQuestions,
          activePileIndex,
          renderActiveQuestion,
        })
      )}
    </div>

    {!showHologramAssistant && (
      <div className={styles.pileControls}>
        {renderPileActionControls({
          collapseActionsIntoMenu: shouldCollapsePileActionsIntoMenu({
            pileTopRailVisible,
            showSubmitButton,
            hasPendingPileChanges,
            isSubmitting,
            shouldHidePileSubmitButton,
          }),
          isFilterActive,
          toggleFilterModal,
          showCreate,
          toggleCreate,
          showListeningPanel,
          toggleListeningPanel,
          onViewAllClick,
          handleViewAllFromPile,
        })}
        {renderPileFooterControls({
          pileTopRailVisible,
          showSuccessBadgeLink,
          pileSubmitResponderHref,
          showSuccessBadgeStatus,
          showSubmitButton,
          handlePileSubmitClick,
          hasPendingPileChanges,
          shouldHidePileSubmitButton,
          isSubmitting,
          activePromptMasked,
          finalSubmitText,
          showClearPendingButton,
          handleRevertPendingChanges,
        })}
        {renderPileNavControls({
          pileQuestions,
          activePileIndex,
          navCounterVisible,
          handlePrev,
          handleNext,
        })}
      </div>
    )}
  </div>
);
