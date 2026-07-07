import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCog } from '@fortawesome/free-solid-svg-icons';
import styles from './Account.module.scss';

type LoginSettingsOverview = {
  activeSession: unknown;
  cryptoTerminology: boolean;
  showWalletNetwork: boolean;
  targetNetworkName: string;
  walletNetworkName: string;
};

type LoginPreLoginSettingsDisplayProps = {
  overview: LoginSettingsOverview;
  preLoginConfigOpen: boolean;
  preLoginSettingsOpen: boolean;
  renderInlineNetworkSummary: (args: Record<string, unknown>) => React.ReactNode;
  renderPreLoginConfigPanel: () => React.ReactNode;
  renderSettingsControlRow: (args: Record<string, unknown>) => React.ReactNode;
  renderSettingsOverviewPanel: (args: Record<string, unknown>) => React.ReactNode;
  renderStaticSettingsSection: (args: { children: React.ReactNode; summary: string; title: string }) => React.ReactNode;
  togglePreLoginConfigPanel: () => void;
  togglePreLoginSettingsPanel: () => void;
};

const LoginPreLoginSettingsDisplay = ({
  overview,
  preLoginConfigOpen,
  preLoginSettingsOpen,
  renderInlineNetworkSummary,
  renderPreLoginConfigPanel,
  renderSettingsControlRow,
  renderSettingsOverviewPanel,
  renderStaticSettingsSection,
  togglePreLoginConfigPanel,
  togglePreLoginSettingsPanel,
}: LoginPreLoginSettingsDisplayProps) => {
  const { activeSession, cryptoTerminology } = overview;

  return (
    <div className={styles.preLoginSettingsShell}>
      <div className={styles.preLoginSettingsTopRow}>
        <button
          type="button"
          aria-label="Toggle pre-login settings"
          className={styles.preLoginSettingsGear}
          onClick={togglePreLoginSettingsPanel}
          aria-expanded={preLoginSettingsOpen}
        >
          <FontAwesomeIcon icon={faCog} />
        </button>
      </div>
      {preLoginSettingsOpen ? (
        <div className={styles.preLoginSettingsPanel} data-testid="ce-prelogin-settings-panel">
          {renderSettingsControlRow({
            activeSession,
            configOpen: preLoginConfigOpen,
            onToggleConfig: togglePreLoginConfigPanel,
            configTestId: 'ce-prelogin-config-toggle',
            betweenSessionAndTooltips: cryptoTerminology
              ? renderInlineNetworkSummary({
                  targetNetworkName: overview.targetNetworkName,
                  walletNetworkName: overview.walletNetworkName,
                  showWalletNetwork: overview.showWalletNetwork,
                  tooltipId: 'preLoginNetworkInfoTooltipInline',
                })
              : null,
            tooltipsInfoId: 'preLoginTooltipsToggleTooltip',
            tooltipPlacement: 'right',
            containerClassName: styles.preLoginSettingsSummaryContainer,
          })}
          {renderSettingsOverviewPanel({
            overview,
            networkTooltipId: 'preLoginNetworkInfoTooltipPanel',
            extraContent: preLoginConfigOpen
              ? renderStaticSettingsSection({
                  title: 'Config',
                  summary: 'Session selection and local AI overrides',
                  children: renderPreLoginConfigPanel(),
                })
              : null,
          })}
        </div>
      ) : null}
    </div>
  );
};

export default LoginPreLoginSettingsDisplay;
