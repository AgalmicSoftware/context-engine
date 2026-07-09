import React from 'react';
import { Button } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons';

import CETooltip from '../Shared/CETooltip';
import styles from './Account.module.scss';

type TargetNetwork = {
  name?: string;
} | null;

type NetworkSummaryProps = {
  showWalletNetwork?: boolean;
  targetNetworkName?: string;
  tooltipId?: string;
  walletNetworkName?: string;
};

const buildNetworkDetail = (targetNetworkName: string): string =>
  `The active session targets ${targetNetworkName}. If your wallet shows a different chain, switch before submitting.`;

export const LoginSettingsInlineNetworkSummary = ({
  targetNetworkName = 'not configured',
  walletNetworkName = 'not connected',
  showWalletNetwork = false,
  tooltipId = 'networkInfoTooltipInline',
}: NetworkSummaryProps): React.ReactElement => {
  const detail = buildNetworkDetail(targetNetworkName);

  return (
    <div className={styles.networkInfo}>
      <span className={styles.networkLabel}>network:</span>
      <span className={styles.networkValue}>{targetNetworkName}</span>
      {showWalletNetwork && (
        <>
          <span className={styles.networkLabel}>wallet:</span>
          <span className={styles.networkValue}>{walletNetworkName}</span>
        </>
      )}
      <FontAwesomeIcon icon={faQuestionCircle} className={styles.infoIcon} id={tooltipId} />
      <CETooltip
        placement="right"
        target={tooltipId}
        delay={0}
        trigger="hover click focus"
        autohide={false}
        className={styles.networkTooltip}
      >
        <div style={{ padding: '10px' }}>{detail}</div>
      </CETooltip>
    </div>
  );
};

export const LoginSettingsPanelNetworkSummary = ({
  targetNetwork = null,
  targetNetworkName = 'not configured',
  walletNetworkName = 'not connected',
  showWalletNetwork = false,
  needsNetworkSwitch = false,
  tooltipId = 'networkInfoTooltipPanel',
  onSwitchNetwork,
}: NetworkSummaryProps & {
  needsNetworkSwitch?: boolean;
  onSwitchNetwork?: () => void;
  targetNetwork?: TargetNetwork;
}): React.ReactElement => {
  const detail = buildNetworkDetail(targetNetworkName);

  return (
    <>
      <div className={styles.aiSettingsSummaryStrip}>
        <div className={styles.aiSettingsSummaryCard}>
          <div className={styles.aiSettingsSummaryLabelRow}>
            <span className={styles.aiSettingsSummaryLabel}>Network</span>
            <FontAwesomeIcon
              icon={faQuestionCircle}
              className={`${styles.infoIcon} ${styles.aiSettingsSummaryInfoIcon}`}
              id={tooltipId}
            />
          </div>
          <div className={styles.aiSettingsSummaryValue}>{targetNetworkName}</div>
          <div className={styles.aiSettingsSummaryDetail}>{detail}</div>
          <CETooltip
            placement="right"
            target={tooltipId}
            delay={0}
            trigger="hover click focus"
            autohide={false}
            className={styles.networkTooltip}
          >
            <div style={{ padding: '10px' }}>{detail}</div>
          </CETooltip>
        </div>
        {showWalletNetwork && (
          <div className={styles.aiSettingsSummaryCard}>
            <div className={styles.aiSettingsSummaryLabel}>Wallet</div>
            <div className={styles.aiSettingsSummaryValue}>{walletNetworkName}</div>
            <div className={styles.aiSettingsSummaryDetail}>Switch before submitting to match the session network.</div>
          </div>
        )}
      </div>
      {needsNetworkSwitch && targetNetwork?.name ? (
        <div className={styles.aiSettingsActions}>
          <Button onClick={onSwitchNetwork} className={`${styles.networkSwitchButton} ${styles.glow}`}>
            Switch to {targetNetwork.name}
          </Button>
        </div>
      ) : null}
    </>
  );
};
