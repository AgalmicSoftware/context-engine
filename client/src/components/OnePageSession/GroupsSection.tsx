import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCaretDown, faCaretUp, faExpand, faPlus, faQuestionCircle } from '@fortawesome/free-solid-svg-icons';
import { resolveAdminCapabilities } from '../Admin/adminPageHelpers';
import SBTsPage from '../SBTs/SBTsPage';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { isCryptoMode, t } from '../../utilities/ui/terminology.js';
import styles from './OnePageSession.module.scss';
import WorkerSessionGroupsPanel from './WorkerSessionGroupsPanel';

const SBT_TOOLTIP_LABEL = isCryptoMode() ? 'Soulbound tokens (SBTs)' : `${t('sbtFull')}s`;

export type GroupsSectionProps = {
  account: unknown;
  autoMintingMode: boolean;
  blockLimits: Record<string, unknown> | null;
  contracts: Record<string, unknown> | null;
  defaultFeaturedSBTs: unknown;
  defaultSbtTags: unknown;
  embeddedGroupsSessionConfig: unknown;
  embeddedGroupsSessionSlug: string;
  ensureLightSbtDiscovery?: unknown;
  ensureLightSbtUniverse?: unknown;
  isSBTCacheReady: unknown;
  loginComplete: unknown;
  network: Record<string, unknown> | null;
  networkChainId: string | number | null;
  provider: unknown;
  refreshSbtData: unknown;
  resolvedSessionConfig: unknown;
  sbtRealtimeCoverageBySlug: unknown;
  sbtScanProgressBySlug: unknown;
  sessionInfo: React.ReactNode;
  sessionName: unknown;
  showEmbeddedCreateGroup: boolean;
  showGroups: boolean;
  toggleLoginModal: unknown;
  onGroupsViewAll: (event: React.MouseEvent<HTMLElement>) => void;
  onToggleEmbeddedCreateGroup: (event?: React.MouseEvent<HTMLElement>) => void;
  onToggleGroups: () => void;
};

const renderSectionHeading = (title: React.ReactNode, subtitle: React.ReactNode) => (
  <span className={styles.sectionHeaderText}>
    <span className={styles.sectionHeaderTitle}>{title}</span>
    <span className={styles.sectionHeaderSubtitle}>{subtitle}</span>
  </span>
);

const OnePageSessionGroupsSection = ({
  account,
  autoMintingMode,
  blockLimits,
  contracts,
  defaultFeaturedSBTs,
  defaultSbtTags,
  embeddedGroupsSessionConfig,
  embeddedGroupsSessionSlug,
  ensureLightSbtDiscovery,
  ensureLightSbtUniverse,
  isSBTCacheReady,
  loginComplete,
  network,
  networkChainId,
  provider,
  refreshSbtData,
  resolvedSessionConfig,
  sbtRealtimeCoverageBySlug,
  sbtScanProgressBySlug,
  sessionInfo,
  sessionName,
  showEmbeddedCreateGroup,
  showGroups,
  toggleLoginModal,
  onGroupsViewAll,
  onToggleEmbeddedCreateGroup,
  onToggleGroups,
}: GroupsSectionProps) => {
  const groupAdminCapabilities = resolveAdminCapabilities({
    account,
    sessionConfig:
      resolvedSessionConfig && typeof resolvedSessionConfig === 'object'
        ? (resolvedSessionConfig as Record<string, unknown>)
        : null,
  });
  const usesWorkerNativeGroups = groupAdminCapabilities.isWorkerCanonicalSession;
  const canAttemptWorkerGroupCreate =
    groupAdminCapabilities.canAdminWorker || !groupAdminCapabilities.workerAdminAddress;

  return (
    <div className={`${styles.sectionContainer} ${showGroups ? styles.sectionExpanded : ''}`}>
      <div className={styles.sectionHeaderRow}>
        <h2 onClick={onToggleGroups} className={styles.sectionHeader}>
          {showGroups ? (
            <FontAwesomeIcon icon={faCaretUp} className={styles.sectionToggleIcon} />
          ) : (
            <FontAwesomeIcon icon={faCaretDown} className={styles.sectionToggleIcon} />
          )}
          {renderSectionHeading(t('sbts'), 'Join or Create')}
          {showGroups ? (
            <div
              className={`${styles.tooltip} ${styles.sectionHeaderTooltip}`}
              onClick={(event: React.MouseEvent<HTMLElement>) => event.stopPropagation()}
            >
              <FontAwesomeIcon icon={faQuestionCircle} />
              <span className={styles.tooltiptext}>
                {usesWorkerNativeGroups
                  ? 'These session-native groups store membership and permissions in the Cloudflare worker, without deploying a contract.'
                  : `${SBT_TOOLTIP_LABEL} enable groups to organize membership, roles, and permissions on-chain.`}
                {' They unlock private coordination, community-governed tools, and shared AI training.'}
              </span>
            </div>
          ) : null}
        </h2>

        {showGroups ? (
          <div className={styles.sectionHeaderActionsScroller}>
            <div className={styles.sectionHeaderActions}>
              {!usesWorkerNativeGroups ? (
                <button type="button" onClick={onGroupsViewAll} className={styles.sectionHeaderActionButton}>
                  <FontAwesomeIcon icon={faExpand} />
                  View All
                </button>
              ) : null}
              {!usesWorkerNativeGroups || canAttemptWorkerGroupCreate ? (
                <button
                  type="button"
                  onClick={onToggleEmbeddedCreateGroup}
                  className={styles.sectionHeaderActionButton}
                  data-testid={E2E_TESTIDS.SBTS_CREATE_TOGGLE}
                >
                  <FontAwesomeIcon icon={faPlus} />
                  {showEmbeddedCreateGroup ? 'Exit' : 'Create'}
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {showGroups ? (
        <div className={styles.miniSectionContent}>
          {usesWorkerNativeGroups ? (
            <WorkerSessionGroupsPanel
              account={account}
              provider={provider}
              networkChainId={networkChainId}
              sessionConfig={resolvedSessionConfig}
              sessionSlug={embeddedGroupsSessionSlug}
              showCreate={showEmbeddedCreateGroup}
              toggleLoginModal={toggleLoginModal as ((open: boolean) => void) | undefined}
            />
          ) : (
            <SBTsPage
              key={`sbtspage:${embeddedGroupsSessionSlug || 'general'}`}
              provider={provider}
              network={network}
              account={account}
              loginComplete={loginComplete}
              toggleLoginModal={toggleLoginModal}
              miniaturized={true}
              hideMiniActionRow={true}
              sessionName={sessionName}
              sessionInfo={sessionInfo}
              defaultFeaturedSBTs={defaultFeaturedSBTs}
              defaultSbtTags={defaultSbtTags}
              isSBTCacheReady={isSBTCacheReady}
              autoMintingMode={autoMintingMode}
              showCreateGroupAboveFeatured={true}
              showCreateGroupExternal={showEmbeddedCreateGroup}
              onCreateGroupToggleExternal={onToggleEmbeddedCreateGroup}
              preferCacheBackedFeaturedCards={true}
              requireExplicitAutoFeatureSessionSlug={true}
              refreshSbtData={refreshSbtData}
              sessionSlug={embeddedGroupsSessionSlug}
              contracts={contracts}
              blockLimits={blockLimits}
              networkChainId={networkChainId}
              sessionConfig={embeddedGroupsSessionConfig}
              sbtScanProgressBySlug={sbtScanProgressBySlug}
              sbtRealtimeCoverageBySlug={sbtRealtimeCoverageBySlug}
              ensureLightSbtDiscovery={ensureLightSbtDiscovery}
              ensureLightSbtUniverse={ensureLightSbtUniverse}
            />
          )}
        </div>
      ) : null}
    </div>
  );
};

export default OnePageSessionGroupsSection;
