import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChevronDown,
  faChevronUp,
  faQuestionCircle,
  faSpinner,
  faUser,
} from '@fortawesome/free-solid-svg-icons';

import CETooltip from '../Shared/CETooltip';
import styles from './SBTPage.module.scss';
import SbtPageStatsScanProgressDisplay from './SbtPageStatsScanProgressDisplay';

type SbtPageStatsSectionProps = {
  adminAddressDisplay: React.ReactNode;
  burnLabel: string;
  creatorAddressDisplay: React.ReactNode;
  isInitialLoading: boolean;
  isOpen: boolean;
  isRefreshing: boolean;
  maxTokensDisplay: string | number;
  mintedCountTitle?: string;
  mintedLabel: string;
  mintEndDisplay?: React.ReactNode;
  netMinted: string | number;
  networkLabel: React.ReactNode;
  onOpenMintedModal: React.MouseEventHandler<HTMLButtonElement>;
  onToggle: React.MouseEventHandler<HTMLHeadingElement>;
  questionIconStyle?: React.CSSProperties;
  refreshIndicatorStyle?: React.CSSProperties;
  scanProgressFillStyle?: React.CSSProperties;
  scanProgressPct: number;
  scanProgressSessionText?: string | null;
  scanProgressText?: string | null;
  sectionHeaderClassName: string;
  shouldRenderClosedIcon: boolean;
  shouldRenderOpenIcon: boolean;
  showScanProgress: boolean;
};

const SbtPageStatsSection = ({
  adminAddressDisplay,
  burnLabel,
  creatorAddressDisplay,
  isInitialLoading,
  isOpen,
  isRefreshing,
  maxTokensDisplay,
  mintedCountTitle,
  mintedLabel,
  mintEndDisplay,
  netMinted,
  networkLabel,
  onOpenMintedModal,
  onToggle,
  questionIconStyle,
  refreshIndicatorStyle,
  scanProgressFillStyle,
  scanProgressPct,
  scanProgressSessionText = null,
  scanProgressText = '',
  sectionHeaderClassName,
  shouldRenderClosedIcon,
  shouldRenderOpenIcon,
  showScanProgress,
}: SbtPageStatsSectionProps): React.ReactElement => (
  <div className={styles.statsSection}>
    <h2 className={sectionHeaderClassName} onClick={onToggle}>
      STATS{' '}
      {shouldRenderOpenIcon && <FontAwesomeIcon icon={faChevronUp} />}
      {shouldRenderClosedIcon && <FontAwesomeIcon icon={faChevronDown} />}
    </h2>
    {isOpen && (
      <div className={styles.stats}>
        <p>
          <span className={styles.label}>{`${mintedLabel}:`}</span>
          {isInitialLoading ? (
            <FontAwesomeIcon icon={faSpinner} spin />
          ) : (
            <span title={mintedCountTitle}>
              {`${netMinted} / ${maxTokensDisplay}`}
            </span>
          )}
          {isRefreshing && (
            <span style={refreshIndicatorStyle} title="Refreshing...">
              <FontAwesomeIcon icon={faSpinner} spin />
            </span>
          )}

          <button onClick={onOpenMintedModal} className={styles.expandButton}>
            <FontAwesomeIcon icon={faUser} />
          </button>
        </p>
        <SbtPageStatsScanProgressDisplay
          scanProgressFillStyle={scanProgressFillStyle}
          scanProgressPct={scanProgressPct}
          scanProgressSessionText={scanProgressSessionText}
          scanProgressText={scanProgressText}
          showScanProgress={showScanProgress}
        />
        {mintEndDisplay}
        <p>
          <span className={styles.label}>Burnable by:</span> {burnLabel}
          <FontAwesomeIcon
            icon={faQuestionCircle}
            className={styles.tooltip}
            id="burnAuthQuestionMark"
            style={questionIconStyle}
          />
          <CETooltip
            placement="right"
            target="burnAuthQuestionMark"
            delay={{ show: 0, hide: 2500 }}
            className={styles.tooltipBubble}
            innerClassName={styles.tooltipInner}
          >
            Specify who can burn the token: Admin Only, Owner Only, Both, or Neither.
          </CETooltip>
        </p>
        <p>
          <span className={styles.label}>Network:</span>{' '}
          {networkLabel}
        </p>

        <p>
          <span className={styles.label}>Admin:</span> {adminAddressDisplay}
        </p>
        <p>
          <span className={styles.label}>Creator:</span> {creatorAddressDisplay}
        </p>
      </div>
    )}
  </div>
);

export default SbtPageStatsSection;
