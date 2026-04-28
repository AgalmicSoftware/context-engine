// @ts-nocheck

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
  faRobot,
} from '@fortawesome/free-solid-svg-icons';

import PileHologramAssistant from './PileHologramAssistant';
import styles from './SurveyTool.module.scss';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { SHOW_PILE_HOLOGRAM_TOGGLE } from './surveyToolRuntimeSupport.js';

const ACTIVE_GREEN = '#4cd964';

const renderPileNavControls = ({
  pileQuestions,
  activePileIndex,
  navCounterVisible,
  handlePrev,
  handleNext,
}) => (
  <div className={styles.pileNav}>
    <button
      onClick={handlePrev}
      disabled={pileQuestions.length === 0 || activePileIndex === 0}
      className={styles.pileNavArrow}
      aria-label="Previous Question"
    >
      <FontAwesomeIcon icon={faChevronLeft} />
    </button>
    <span
      className={styles.pileNavCounterText}
      style={{
        opacity: navCounterVisible ? 0.8 : 0,
        transition: 'opacity 0.5s ease-in-out',
      }}
    >
      {pileQuestions.length === 0 ? 0 : activePileIndex + 1} / {pileQuestions.length}
    </span>
    <button
      onClick={handleNext}
      disabled={
        pileQuestions.length === 0 ||
        activePileIndex === pileQuestions.length - 1
      }
      className={styles.pileNavArrow}
      aria-label="Next Question"
    >
      <FontAwesomeIcon icon={faChevronRight} />
    </button>
  </div>
);

const renderPileActionControls = ({
  isFilterActive,
  toggleFilterModal,
  showCreate,
  toggleCreate,
  onViewAllClick,
  handleViewAllFromPile,
}) => {
  const filterButtonStyle = isFilterActive
    ? { color: ACTIVE_GREEN, borderColor: ACTIVE_GREEN, opacity: 0.75 }
    : {};
  const filterIconStyle = isFilterActive ? { color: ACTIVE_GREEN } : {};

  return (
    <div className={styles.pileActions}>
      <button
        onClick={toggleFilterModal}
        className={`${styles.actionButton} ${isFilterActive ? styles.actionButtonActive : ''}`.trim()}
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
}) => (
  <div className={`${styles.pileFooter}${pileTopRailVisible ? '' : ` ${styles.pileFooterHidden}`}`}>
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
        className={`${styles.pileSubmitButton}${hasPendingPileChanges ? ` ${styles.submitGlow}` : ''}${shouldHidePileSubmitButton ? ` ${styles.pileSubmitButtonInactive}` : ''}`}
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
}) => {
  const startIdx = Math.max(0, activePileIndex - 2);
  const endIdx = Math.min(pileQuestions.length, activePileIndex + 3);

  return pileQuestions.slice(startIdx, endIdx).map((q, sliceIdx) => {
    const idx = startIdx + sliceIdx;
    const offset = idx - activePileIndex;

    let status = '';
    if (offset === 0) status = styles.pileCardActive;
    else if (offset === 1) status = styles.pileCardNext;
    else if (offset === -1) status = styles.pileCardPrev;
    else if (offset > 1) status = styles.pileCardAfter;
    else status = styles.pileCardBefore;

    return (
      <div key={q.id} className={`${styles.pileCard} ${status}`}>
        {offset === 0 ? (
          renderActiveQuestion(q)
        ) : (
          <div className={styles.pileCardInner}></div>
        )}
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
}) => {
  if (hasTerminalScanError) {
    return <div>{scanErrorMessage}</div>;
  }

  if (hasError) {
    return (
      <>
        <div>Cache initialization error (RPC or metadata fetch failed).</div>
        <div style={{ opacity: 0.8, marginTop: 8 }}>
          Try refreshing questions/responses or reloading the page.
        </div>
      </>
    );
  }

  if (isStillLoading) {
    return (
      <>
        <div style={{ fontSize: '2.5rem', display: 'flex', alignItems: 'center', gap: '15px' }}>
          <FontAwesomeIcon icon={faSpinner} spin size="1x" />
        </div>
        <div className={styles.pileLoadingHeadline}>
          Loading... {Math.max(0, Number(loadingElapsedSec || 0))}s
        </div>
        <div className={styles.pileLoadingSubhead}>
          {isHydrating
            ? `Loading Metadata (${Math.min(hydrateDone, hydrateDiscovered)} / ${hydrateDiscovered})`
            : (showLongLoading ? '' : '')}
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
                style={{
                  width: `${isHydrating
                    ? (hydrateDiscovered > 0
                      ? Math.round((Math.min(hydrateDone, hydrateDiscovered) / hydrateDiscovered) * 100)
                      : 0)
                    : scanPercent}%`,
                }}
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
}) => (
  <div className={styles.pileInteractionUnit}>
    {SHOW_PILE_HOLOGRAM_TOGGLE && (
      <button
        type="button"
        className={`${styles.pileHologramToggle}${showHologramAssistant ? ` ${styles.pileHologramToggleActive}` : ''}`}
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
          style={{ opacity: priorResponsesHydrating ? 0.5 : 1 }}
          title={
            priorResponsesHydrating
              ? 'Loading your previous responses...'
              : (showLongLoading ? 'Still scanning... checking network' : 'Background refresh active')
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
          isFilterActive,
          toggleFilterModal,
          showCreate,
          toggleCreate,
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
