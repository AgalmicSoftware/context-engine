import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCaretDown,
  faCaretUp,
  faExpand,
  faPlus,
  faQuestionCircle,
  faSyncAlt,
} from '@fortawesome/free-solid-svg-icons';
import { resolveAdminCapabilities } from '../Admin/adminPageHelpers';
import SBTsPage from '../SBTs/SBTsPage';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { resolveSessionCapabilityProjection } from '../../utilities/session/sessionCapabilityProjection.js';
import { isCryptoMode, t } from '../../utilities/ui/terminology.js';
import {
  GROUP_CREATION_POLICIES,
  LEGACY_GROUP_CREATION_POLICY,
  resolveGroupCreationPolicy,
} from '../../utilities/session/groupCreationPolicy';
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

type ConfiguredOnChainCondition = {
  chainId: number;
  contract: string;
  anyOrAll: 'any' | 'all';
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const readConfiguredOnChainConditions = (sessionConfig: unknown): ConfiguredOnChainCondition[] => {
  const config = asRecord(sessionConfig);
  const profile = asRecord(config.sessionModeProfile);
  const storage = asRecord(profile.storage);
  const payloadAccessControl = asRecord(storage.payloadAccessControl);
  const encryption = asRecord(profile.encryption);
  const documents = [payloadAccessControl.accessConditions, encryption.accessConditions];
  const seen = new Set<string>();
  const conditions: ConfiguredOnChainCondition[] = [];

  documents.forEach((document) => {
    const source = asRecord(document);
    const rows = Array.isArray(source.conditions) ? source.conditions : [];
    rows.forEach((row) => {
      const condition = asRecord(row);
      if (String(condition.kind || '').trim() !== 'sbt_onchain') return;
      const chainId = Number(condition.chainId || 0);
      const contract = String(condition.contract || '').trim();
      if (!Number.isSafeInteger(chainId) || chainId <= 0 || !contract) return;
      const anyOrAll = String(condition.anyOrAll || '').trim() === 'all' ? 'all' : 'any';
      const key = `${chainId}:${contract.toLowerCase()}:${anyOrAll}`;
      if (seen.has(key)) return;
      seen.add(key);
      conditions.push({ chainId, contract, anyOrAll });
    });
  });

  return conditions;
};

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
  const [workerGroupsRefreshNonce, setWorkerGroupsRefreshNonce] = useState(0);
  const sessionConfigForGroups =
    embeddedGroupsSessionConfig && typeof embeddedGroupsSessionConfig === 'object'
      ? embeddedGroupsSessionConfig
      : resolvedSessionConfig;
  const groupCapabilities = resolveSessionCapabilityProjection(sessionConfigForGroups);
  const usesWorkerNativeGroups =
    groupCapabilities.source === 'profile' && groupCapabilities.profileValid && groupCapabilities.isWorkerCanonical;
  const usesRegistryGroups =
    (groupCapabilities.source === 'profile' &&
      groupCapabilities.profileValid &&
      groupCapabilities.isRegistryCanonical) ||
    (groupCapabilities.source === 'legacy_registry' && groupCapabilities.isRegistryCanonical);
  const usesConfiguredOnChainGates = usesWorkerNativeGroups && groupCapabilities.usesOnChainSbt;
  const configuredOnChainConditions = usesConfiguredOnChainGates
    ? readConfiguredOnChainConditions(sessionConfigForGroups)
    : [];
  const groupAdminCapabilities = resolveAdminCapabilities({
    account,
    sessionConfig:
      sessionConfigForGroups && typeof sessionConfigForGroups === 'object'
        ? (sessionConfigForGroups as Record<string, unknown>)
        : null,
  });
  const canAttemptWorkerGroupCreate =
    groupAdminCapabilities.canAdminWorker || !groupAdminCapabilities.workerAdminAddress;
  const groupCreationPolicy = resolveGroupCreationPolicy(
    sessionConfigForGroups,
    usesRegistryGroups ? GROUP_CREATION_POLICIES.PARTICIPANTS : LEGACY_GROUP_CREATION_POLICY,
  );
  const participantGroupCreationEnabled = groupCreationPolicy === GROUP_CREATION_POLICIES.PARTICIPANTS;
  const canCreateGroup =
    (usesRegistryGroups && (participantGroupCreationEnabled || groupAdminCapabilities.canAdminRegistry)) ||
    (usesWorkerNativeGroups && (participantGroupCreationEnabled || canAttemptWorkerGroupCreate));

  return (
    <div className={`${styles.sectionContainer} ${showGroups ? styles.sectionExpanded : ''}`}>
      <div className={styles.sectionHeaderRow}>
        <h2 onClick={onToggleGroups} className={styles.sectionHeader} data-testid={E2E_TESTIDS.SESSION_GROUPS_TOGGLE}>
          {showGroups ? (
            <FontAwesomeIcon icon={faCaretUp} className={styles.sectionToggleIcon} />
          ) : (
            <FontAwesomeIcon icon={faCaretDown} className={styles.sectionToggleIcon} />
          )}
          {renderSectionHeading(usesRegistryGroups ? t('sbts') : 'Groups', 'Join or Create')}
          {showGroups ? (
            <div
              className={`${styles.tooltip} ${styles.sectionHeaderTooltip}`}
              onClick={(event: React.MouseEvent<HTMLElement>) => event.stopPropagation()}
            >
              <FontAwesomeIcon icon={faQuestionCircle} />
              <span className={styles.tooltiptext}>
                {usesWorkerNativeGroups
                  ? 'These session-native groups store membership and permissions in the Cloudflare worker, without deploying a contract.'
                  : usesRegistryGroups
                    ? `${SBT_TOOLTIP_LABEL} enable groups to organize membership, roles, and permissions on-chain.`
                    : 'Groups are unavailable because this session does not have a valid Groups authority profile.'}
                {' They unlock private coordination, community-governed tools, and shared AI training.'}
              </span>
            </div>
          ) : null}
        </h2>

        {showGroups ? (
          <div className={styles.sectionHeaderActionsScroller}>
            <div className={styles.sectionHeaderActions}>
              {usesRegistryGroups ? (
                <button type="button" onClick={onGroupsViewAll} className={styles.sectionHeaderActionButton}>
                  <FontAwesomeIcon icon={faExpand} />
                  View All
                </button>
              ) : null}
              {canCreateGroup ? (
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
              {usesWorkerNativeGroups ? (
                <button
                  type="button"
                  onClick={() => setWorkerGroupsRefreshNonce((nonce) => nonce + 1)}
                  className={`${styles.sectionHeaderActionButton} ${styles.sectionHeaderIconButton}`}
                  aria-label="Refresh groups"
                  title="Refresh groups"
                >
                  <FontAwesomeIcon icon={faSyncAlt} />
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {showGroups ? (
        <div className={styles.miniSectionContent}>
          {usesWorkerNativeGroups ? (
            <>
              <WorkerSessionGroupsPanel
                account={account}
                provider={provider}
                networkChainId={networkChainId}
                sessionConfig={sessionConfigForGroups}
                sessionName={String(sessionName || '')}
                sessionSlug={embeddedGroupsSessionSlug}
                showCreate={showEmbeddedCreateGroup}
                refreshNonce={workerGroupsRefreshNonce}
                showGroupDescriptions={false}
                showMembershipListHeader={false}
                toggleLoginModal={toggleLoginModal as ((open: boolean) => void) | undefined}
              />
              {usesConfiguredOnChainGates ? (
                <section
                  className={styles.workerGroupsPanel}
                  data-testid={E2E_TESTIDS.SESSION_ADVANCED_ONCHAIN_ACCESS_GATES}
                  aria-label="Advanced on-chain access gates"
                >
                  <h3>Advanced on-chain access gates</h3>
                  <p className={styles.workerGroupNotice}>
                    These external conditions are configured in this session profile. Native Groups remain Worker-owned.
                  </p>
                  {configuredOnChainConditions.length ? (
                    configuredOnChainConditions.map((condition) => (
                      <div
                        key={`${condition.chainId}:${condition.contract.toLowerCase()}:${condition.anyOrAll}`}
                        className={styles.workerGroupNotice}
                      >
                        <strong>{condition.contract}</strong>
                        <span>
                          Chain {condition.chainId} · match {condition.anyOrAll}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className={styles.workerGroupNotice}>
                      No explicit on-chain access conditions are configured.
                    </div>
                  )}
                </section>
              ) : null}
            </>
          ) : usesRegistryGroups ? (
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
          ) : (
            <div className={styles.workerGroupNotice} data-testid={E2E_TESTIDS.SESSION_GROUPS_UNAVAILABLE}>
              Groups are unavailable because this session has no valid Worker or registry Groups authority.
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};

export default OnePageSessionGroupsSection;
