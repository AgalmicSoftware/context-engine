import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, faChevronUp, faQuestionCircle } from '@fortawesome/free-solid-svg-icons';

import CETooltip from '../Shared/CETooltip';
import styles from './SBTPage.module.scss';
import SbtPageHolderStatusDisplay from './SbtPageHolderStatusDisplay';
import type { SbtPageHolderCountStatus, SbtPageHolderScanProgressDisplay } from './SbtPageHolderStatusDisplay';

type SbtPageStatsSectionProps = {
  adminAddressDisplay: React.ReactNode;
  burnLabel: string;
  creatorAddressDisplay: React.ReactNode;
  isOpen: boolean;
  holderCountStatus: SbtPageHolderCountStatus;
  holderScanProgressDisplay: SbtPageHolderScanProgressDisplay;
  mintEndDisplay?: React.ReactNode;
  networkLabel: React.ReactNode;
  onOpenMintedModal: React.MouseEventHandler<HTMLButtonElement>;
  onToggle: React.MouseEventHandler<HTMLHeadingElement>;
  questionIconStyle?: React.CSSProperties;
  sectionHeaderClassName: string;
  shouldRenderClosedIcon: boolean;
  shouldRenderOpenIcon: boolean;
};

const SbtPageStatsSection = ({
  adminAddressDisplay,
  burnLabel,
  creatorAddressDisplay,
  isOpen,
  holderCountStatus,
  holderScanProgressDisplay,
  mintEndDisplay,
  networkLabel,
  onOpenMintedModal,
  onToggle,
  questionIconStyle,
  sectionHeaderClassName,
  shouldRenderClosedIcon,
  shouldRenderOpenIcon,
}: SbtPageStatsSectionProps): React.ReactElement => (
  <div className={styles.statsSection}>
    <h2 className={sectionHeaderClassName} onClick={onToggle}>
      STATS {shouldRenderOpenIcon && <FontAwesomeIcon icon={faChevronUp} />}
      {shouldRenderClosedIcon && <FontAwesomeIcon icon={faChevronDown} />}
    </h2>
    {isOpen && (
      <div className={styles.stats}>
        <SbtPageHolderStatusDisplay
          countStatus={holderCountStatus}
          onOpenMintedModal={onOpenMintedModal}
          scanProgressDisplay={holderScanProgressDisplay}
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
          <span className={styles.label}>Network:</span> {networkLabel}
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
