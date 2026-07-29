/** @file EncryptionPanel.tsx */
import React from 'react';
import { Input } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCaretDown, faCaretUp, faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';
import styles from './SessionWizard.module.scss';
import SBTSelector from '../SBTs/SBTSelector';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { toStr } from '../../utilities/shared/primitives.js';
import type { SessionWizardTooltipRenderOptions } from './SessionWizardInfoTooltip';

type EncryptionGate = {
  id: string;
  label?: string;
  mode?: string;
  color?: string;
  sbts?: unknown[];
};

type PendingSbtDraft = {
  id?: string;
  displayName?: React.ReactNode;
  predictedAddress?: string;
  deployed?: boolean;
};

type SessionConfig = {
  slug?: string;
  [key: string]: unknown;
};

export type EncryptionPanelProps = {
  isNormalMode: boolean;
  t?: (key: string) => string;
  renderSessionWizardInfoTooltip?: (props: {
    id?: string;
    content?: React.ReactNode;
    placement?: SessionWizardTooltipRenderOptions['placement'];
    testId?: string;
    ariaLabel?: string;
  }) => React.ReactNode;
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
  launchCreateSbtModal: (payload: { targetType: string; gateId: string }) => void;
  activeCreateSbtTargetGateId: string;
  activeCreateSbtTargetGate?: EncryptionGate | null;
  encryptionGates?: EncryptionGate[];
  focusCreateSbtTargetGate: (gateId: string) => void;
  updateEncryptionGate: (gateId: string, patch: Partial<EncryptionGate>) => void;
  removeEncryptionGate: (gateId: string) => void;
  normalizeSbtSelection?: (value: unknown[]) => unknown[];
  handleGateAddSbt: (gateId: string, sbt: unknown) => void;
  handleGateRemoveSbt: (gateId: string, address: string) => void;
  network?: unknown;
  pendingSbtSelectorOptions?: unknown[];
  selectorSourceChainId?: number | string | null;
  selectorSourceSessionConfig?: SessionConfig | null;
  resolvedActiveSessionSlug?: string;
  sbtCacheRevision?: unknown;
  ensureLightSbtUniverse?: (() => unknown) | null;
  addEncryptionGate: () => void;
  pendingSbtDrafts?: PendingSbtDraft[];
  removePendingSbtDraft: (address?: string) => void;
  isWorkerCanonical?: boolean;
  showOnChainGateControls?: boolean;
};

const EncryptionPanel = ({
  isNormalMode,
  t,
  renderSessionWizardInfoTooltip,
  isCollapsed,
  onToggleCollapsed,
  launchCreateSbtModal,
  activeCreateSbtTargetGateId,
  activeCreateSbtTargetGate,
  encryptionGates,
  focusCreateSbtTargetGate,
  updateEncryptionGate,
  removeEncryptionGate,
  normalizeSbtSelection,
  handleGateAddSbt,
  handleGateRemoveSbt,
  network,
  pendingSbtSelectorOptions,
  selectorSourceChainId,
  selectorSourceSessionConfig,
  resolvedActiveSessionSlug,
  sbtCacheRevision,
  ensureLightSbtUniverse,
  addEncryptionGate,
  pendingSbtDrafts,
  removePendingSbtDraft,
  isWorkerCanonical = false,
  showOnChainGateControls = true,
}: EncryptionPanelProps) => {
  const translate = typeof t === 'function' ? t : (key: string) => key;
  const gates = Array.isArray(encryptionGates) ? encryptionGates : [];
  const pendingDrafts = Array.isArray(pendingSbtDrafts) ? pendingSbtDrafts : [];
  const renderInfoTooltip =
    typeof renderSessionWizardInfoTooltip === 'function' ? renderSessionWizardInfoTooltip : () => null;
  const normalizeSelection: (value: unknown[]) => unknown[] =
    typeof normalizeSbtSelection === 'function' ? normalizeSbtSelection : (value: unknown[]) => value;

  return (
    <section id="session-wizard-section-encryption" className={`${styles.panel} ${styles.encryptionPanel}`}>
      <div className={styles.panelHeaderRow}>
        <button type="button" className={styles.panelHeader} onClick={onToggleCollapsed}>
          <span className={styles.panelTitle}>
            {isWorkerCanonical
              ? showOnChainGateControls
                ? 'Session Access · Advanced hybrid'
                : 'Session Access'
              : isNormalMode
                ? 'Privacy & Access'
                : `${translate('sbts')} allowed to decrypt locked fields`}
            {renderInfoTooltip({
              id: 'gw-encryption-visibility',
              content:
                isWorkerCanonical && !showOnChainGateControls
                  ? 'The Session Worker authenticates passkeys and applies its configured roles and Groups. No chain, contract, RPC, Lit credential, wallet, faucet, or gas is required.'
                  : `${translate('gates')} control who can decrypt locked fields and access sponsored AI and other protected resources. Leave this open for a public link, or attach ${translate('sbtLower')} ${translate('gatesLower')} for members-only access.`,
              placement: 'right',
              testId: 'ce-wizard-tooltip-gw-encryption-visibility',
              ariaLabel: 'Encryption visibility info',
            })}
          </span>
          <FontAwesomeIcon icon={isCollapsed ? faCaretDown : faCaretUp} />
        </button>
        {showOnChainGateControls ? (
          <button
            type="button"
            className={`${styles.inlineLinkButton} ${styles.createSbtButton}`}
            onClick={() => launchCreateSbtModal({ targetType: 'gate', gateId: activeCreateSbtTargetGateId })}
            data-testid={E2E_TESTIDS.WIZARD_CREATE_SBT}
            data-ce-sbt-target={activeCreateSbtTargetGateId}
            title={
              activeCreateSbtTargetGate
                ? `Create ${translate('sbt')} for ${activeCreateSbtTargetGate.label || activeCreateSbtTargetGate.id}`
                : `Create ${translate('sbt')}`
            }
          >
            {`Create ${translate('sbt')}`}
          </button>
        ) : null}
      </div>
      {!isCollapsed && (
        <div className={styles.panelBody}>
          {isWorkerCanonical && !showOnChainGateControls ? (
            <div className={styles.modeSummaryList} data-testid="ce-new-worker-native-access-summary">
              Passkey identity, Session Worker roles, and Worker-native Groups control access. Optional SBT/Lit
              conditions are available only in Advanced hybrid settings.
            </div>
          ) : null}
          {showOnChainGateControls ? (
            <>
              <div className={styles.encryptionGateList}>
                {gates.map((gate, idx) => (
                  <div
                    key={gate.id}
                    className={styles.encryptionGateCard}
                    onMouseDownCapture={() => focusCreateSbtTargetGate(gate.id)}
                    onFocusCapture={() => focusCreateSbtTargetGate(gate.id)}
                  >
                    <div className={styles.encryptionGateHeader}>
                      <div className={styles.encryptionGateTitleRow}>
                        <span className={styles.gateColor} style={{ background: gate.color }} />
                        <Input
                          value={gate.label}
                          onChange={(e) => updateEncryptionGate(gate.id, { label: e.target.value })}
                          className={styles.gateLabelInput}
                        />
                      </div>
                      <div className={styles.encryptionGateMode}>
                        <button
                          type="button"
                          className={`${styles.gateModeWord} ${gate.mode === 'any' ? styles.gateModeActive : ''}`}
                          onClick={() => updateEncryptionGate(gate.id, { mode: 'any' })}
                        >
                          ANY
                        </button>
                        <span className={styles.gateModeSeparator}>/</span>
                        <button
                          type="button"
                          className={`${styles.gateModeWord} ${gate.mode === 'all' ? styles.gateModeActive : ''}`}
                          onClick={() => updateEncryptionGate(gate.id, { mode: 'all' })}
                        >
                          ALL
                        </button>
                        {renderInfoTooltip({
                          id: `gw-encrypt-mode-${gate.id}`,
                          content: `ANY means someone only needs one of these ${translate('sbtsLower')}. ALL means they need every ${translate('sbtLower')} listed.`,
                          placement: 'right',
                          testId: `ce-wizard-tooltip-gw-encrypt-mode-${gate.id}`,
                          ariaLabel: `${gate.label || gate.id} mode info`,
                        })}
                      </div>
                      {idx > 0 && (
                        <button
                          type="button"
                          className={styles.gateRemoveButton}
                          onClick={() => removeEncryptionGate(gate.id)}
                          title={`Remove ${translate('gateLower')}`}
                        >
                          <FontAwesomeIcon icon={faTrash} />
                        </button>
                      )}
                    </div>
                    <div className={styles.gateRow}>
                      <SBTSelector
                        id={`encryption-gate-${gate.id}`}
                        // label="SBTs allowed to decrypt locked fields"
                        label=""
                        selectedSBTs={normalizeSelection(gate.sbts || [])}
                        onAddSBT={(sbt: unknown) => handleGateAddSbt(gate.id, sbt)}
                        onRemoveSBT={(address: string) => handleGateRemoveSbt(gate.id, address)}
                        network={network}
                        additionalSBTOptions={pendingSbtSelectorOptions}
                        chainId={selectorSourceChainId}
                        sessionSlug={selectorSourceSessionConfig?.slug || resolvedActiveSessionSlug || ''}
                        sessionConfig={selectorSourceSessionConfig}
                        sbtCacheRevision={sbtCacheRevision}
                        ensureLightSbtUniverse={ensureLightSbtUniverse}
                        variant="admin"
                      />
                    </div>
                  </div>
                ))}
                {gates.length === 1 && (
                  <button
                    type="button"
                    className={styles.ghostGateCard}
                    onClick={addEncryptionGate}
                    aria-label={`Add ${translate('gateLower')}`}
                    data-testid={E2E_TESTIDS.WIZARD_ADD_GATE}
                    data-ce-gate-add-kind="ghost"
                  >
                    <FontAwesomeIcon icon={faPlus} />
                  </button>
                )}
              </div>
              {pendingDrafts.length > 0 && (
                <div className={styles.pendingSbtList}>
                  {pendingDrafts.map((entry) => (
                    <div
                      key={entry.id || entry.predictedAddress}
                      className={styles.pendingSbtCard}
                      data-testid={E2E_TESTIDS.WIZARD_PENDING_SBT}
                      data-ce-sbt-address={toStr(entry.predictedAddress).trim().toLowerCase() || undefined}
                    >
                      <div className={styles.pendingSbtContent}>
                        <strong>{entry.displayName}</strong>
                        <code>{entry.predictedAddress}</code>
                        <span className={styles.pendingSbtStatus}>
                          {entry.deployed ? 'Deployed' : 'Deploys during Publish'}
                        </span>
                      </div>
                      <button
                        type="button"
                        className={styles.gateRemoveButton}
                        onClick={() => removePendingSbtDraft(entry.predictedAddress)}
                        title={`Remove pending ${translate('sbt')}`}
                      >
                        <FontAwesomeIcon icon={faTrash} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {gates.length >= 2 && (
                <button
                  type="button"
                  className={styles.addGateRailButton}
                  onClick={addEncryptionGate}
                  aria-label={`Add ${translate('gate')}`}
                  data-testid={E2E_TESTIDS.WIZARD_ADD_GATE}
                  data-ce-gate-add-kind="rail"
                >
                  <FontAwesomeIcon icon={faPlus} />
                </button>
              )}
            </>
          ) : null}
        </div>
      )}
    </section>
  );
};

export default EncryptionPanel;
