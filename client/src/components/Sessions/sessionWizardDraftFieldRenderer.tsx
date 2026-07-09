import { type MutableRefObject, type ReactNode } from 'react';
import { Button, FormGroup, Input, Label } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCaretDown,
  faCaretUp,
  faCheck,
  faExclamationCircle,
  faImage,
  faSpinner,
} from '@fortawesome/free-solid-svg-icons';
import styles from './SessionWizard.module.scss';
import { renderAiOrGateSelect, type RenderAiOrGateSelectParams } from './AiFieldSelect';
import LockableFieldFrame, { type LockableFieldFrameProps } from './LockableFieldFrame';
import BlockLimitsField, { type BlockLimitsFieldProps } from './BlockLimitsField';
import SessionHeaderField, { type SessionHeaderFieldProps } from './SessionHeaderField';
import FeaturedSbtField, { type FeaturedSbtFieldProps } from './FeaturedSbtField';
import CollapsibleFieldGroup from './CollapsibleFieldGroup';
import SessionWizardContractsField from './SessionWizardContractsField';
import SessionWizardStorageProfileMetadataField from './SessionWizardStorageProfileMetadataField';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { seedGenPrompt } from '../../prompts/seedGenPrompt.js';
import { t } from '../../utilities/ui/terminology.js';
import { toStr } from '../../utilities/shared/primitives.js';
import type { UnknownRecord } from '../../utilities/session/sessionTypes.js';
import { getSessionSlugValidationError } from './sessionWizardSlugValidation';
import { getSessionWizardContractDefaults, getVisibleSessionWizardContractKeys } from './sessionWizardContracts.js';
import {
  getSessionWizardFieldLabel,
  getSessionWizardFieldTooltip,
  shouldHideSessionWizardField,
  type SessionWizardRenderFieldOptions,
} from './sessionWizardFieldDescriptors';
import { applyStorageProfileChangeToModeDraft } from './sessionWizardModeProfileDraftController';
import { normalizeSbtSelection, serializeDefaultFeaturedSbtSelections } from './sessionWizardSbtSelections';
import { getChainName } from './sessionWizardCoreUtils';
import { isSecretFieldPath, isStringArray, shouldLockable } from './sessionWizardGateUtils';
import type { MetadataObjectCollapsedState } from './hooks/useSessionWizardChromeState';
import type { ChainIdLike, NetworkLike, SessionConfigLike, SessionContractsLike } from '../shellTypes';
import type { WorkerPanelProps } from './WorkerPanel';

type DraftState = UnknownRecord &
  NonNullable<WorkerPanelProps['draft']> & {
    sessionHeader?: string;
  };

type GateOption = {
  id: unknown;
  label?: unknown;
  color?: unknown;
};

type EncryptionGateState = UnknownRecord & {
  id: string;
  label?: string;
  color?: string;
};

type StateUpdater<T> = (nextValueOrUpdater: T | ((prev: T) => T)) => void;

export type SessionWizardDraftFieldRenderer = (
  key: string,
  value: unknown,
  path: string[],
  opts?: SessionWizardRenderFieldOptions,
) => ReactNode;

type SessionWizardDraftFieldRendererOptions = {
  blockLimitDuration: number | string;
  blockLimitUnit: string;
  compactSessionHeaderInputRef: MutableRefObject<HTMLInputElement | null>;
  compactSessionHeaderMode: SessionHeaderFieldProps['compactSessionHeaderMode'];
  defaultGateId: string;
  draft: DraftState;
  draftRef: MutableRefObject<DraftState>;
  encryptedFieldGates: UnknownRecord;
  encryptionGates: EncryptionGateState[];
  ensureLightSbtUniverse: FeaturedSbtFieldProps['ensureLightSbtUniverse'];
  fieldErrors: Record<string, string>;
  gateOptions: GateOption[];
  getGateById: (gateId: unknown) => EncryptionGateState | null;
  handleClearSessionHeaderPreview: () => void;
  handlePasteSessionHeaderFromClipboard: SessionHeaderFieldProps['onPaste'];
  handleRemoveDefaultFeaturedSbt: (address: unknown) => void;
  latestBlockStatus: ReactNode;
  latestChainBlock: BlockLimitsFieldProps['latestChainBlock'];
  launchCreateSbtModal: (options: { targetType: string }) => void;
  markBlockStartManual: () => void;
  metadataObjectCollapsed: MetadataObjectCollapsedState;
  network: NetworkLike | undefined;
  openContractViewerModal: (contractKey: string) => void;
  openLockKey: string;
  pendingSbtSelectorOptions: FeaturedSbtFieldProps['additionalSBTOptions'];
  privateSlugMode: boolean;
  registryChainId: ChainIdLike | undefined;
  renderSessionWizardInfoTooltip: (options?: {
    id?: string;
    content?: ReactNode;
    placement?: LockableFieldFrameProps['tooltipPlacement'];
    testId?: string;
    ariaLabel?: string;
  }) => ReactNode;
  resolvedActiveSessionSlug: string;
  sbtCacheRevision: unknown;
  selectorSourceChainId: ChainIdLike | null;
  selectorSourceSessionConfig: SessionConfigLike | null | undefined;
  sessionHeaderMode: SessionHeaderFieldProps['sessionHeaderMode'];
  sessionHeaderPreviewSrc: SessionHeaderFieldProps['sessionHeaderPreviewSrc'];
  sessionHeaderUploadStatus: SessionHeaderFieldProps['sessionHeaderUploadStatus'];
  sessionHeaderUploadStatusTone: SessionHeaderFieldProps['sessionHeaderUploadStatusTone'];
  sessionWizardTooltipsEnabled: boolean;
  showPromptPreview: boolean;
  slugAvailability: { status?: string };
  slugPinnedByPendingSbtDrafts: boolean;
  togglePrivateSlugMode: () => void;
  updateArrayValue: (path: string[], raw: string, asJson?: boolean) => void;
  updateDraftValue: (path: string[], value: unknown) => void;
  workerSecretsEnabled: boolean;
  wizardMode: string;
  normalizeGateIds: (value: unknown) => string[];
  setBlockLimitDuration: (value: string) => void;
  setBlockLimitUnit: (value: string) => void;
  setCompactSessionHeaderMode: StateUpdater<string>;
  setDefaultGateId: (gateId: string) => void;
  setDraft: (updater: (prev: DraftState) => DraftState) => void;
  setEncryptedFieldGates: StateUpdater<UnknownRecord>;
  setMetadataObjectCollapsed: (updater: (prev: MetadataObjectCollapsedState) => MetadataObjectCollapsedState) => void;
  setOpenLockKey: StateUpdater<string>;
  setSessionHeaderFile: (file: File | null) => void;
  setSessionHeaderMode: StateUpdater<string>;
  setSessionHeaderPreviewModalOpen: (open: boolean) => void;
  setSessionHeaderStatus: (message: string) => void;
  setShowPromptPreview: StateUpdater<boolean>;
  setWorkerUrlAutoFilled: (value: boolean) => void;
};

const pathKey = (path: string[]): string => path.join('.');

export const buildSessionWizardDraftFieldRenderer = ({
  blockLimitDuration,
  blockLimitUnit,
  compactSessionHeaderInputRef,
  compactSessionHeaderMode,
  defaultGateId,
  draft,
  draftRef,
  encryptedFieldGates,
  encryptionGates,
  ensureLightSbtUniverse,
  fieldErrors,
  gateOptions,
  getGateById,
  handleClearSessionHeaderPreview,
  handlePasteSessionHeaderFromClipboard,
  handleRemoveDefaultFeaturedSbt,
  latestBlockStatus,
  latestChainBlock,
  launchCreateSbtModal,
  markBlockStartManual,
  metadataObjectCollapsed,
  network,
  normalizeGateIds,
  openContractViewerModal,
  openLockKey,
  pendingSbtSelectorOptions,
  privateSlugMode,
  registryChainId,
  renderSessionWizardInfoTooltip,
  resolvedActiveSessionSlug,
  sbtCacheRevision,
  selectorSourceChainId,
  selectorSourceSessionConfig,
  sessionHeaderMode,
  sessionHeaderPreviewSrc,
  sessionHeaderUploadStatus,
  sessionHeaderUploadStatusTone,
  sessionWizardTooltipsEnabled,
  setBlockLimitDuration,
  setBlockLimitUnit,
  setCompactSessionHeaderMode,
  setDefaultGateId,
  setDraft,
  setEncryptedFieldGates,
  setMetadataObjectCollapsed,
  setOpenLockKey,
  setSessionHeaderFile,
  setSessionHeaderMode,
  setSessionHeaderPreviewModalOpen,
  setSessionHeaderStatus,
  setShowPromptPreview,
  setWorkerUrlAutoFilled,
  showPromptPreview,
  slugAvailability,
  slugPinnedByPendingSbtDrafts,
  togglePrivateSlugMode,
  updateArrayValue,
  updateDraftValue,
  workerSecretsEnabled,
  wizardMode,
}: SessionWizardDraftFieldRendererOptions): SessionWizardDraftFieldRenderer => {
  const renderField: SessionWizardDraftFieldRenderer = (
    key,
    value,
    path,
    opts: SessionWizardRenderFieldOptions = {},
  ) => {
    const forceShow = !!opts.forceShow;
    const currentPath = [...path, key];
    if (
      shouldHideSessionWizardField({
        forceShow,
        key,
        path,
        currentPath,
        wizardMode,
      })
    ) {
      return null;
    }
    const keyString = pathKey(currentPath);
    const isSlugField = keyString === 'slug';
    const isNormalMode = wizardMode !== 'advanced';
    const displayLabel = getSessionWizardFieldLabel(keyString, key);
    const isSecretPath = isSecretFieldPath(currentPath);
    const canLock = shouldLockable(value) && (!isSecretPath || !workerSecretsEnabled);
    if (!forceShow && isSecretPath && workerSecretsEnabled) return null;
    const isDefaultFilterState = keyString === 'defaultFilterState';
    const isQuestionsPrompt = keyString === 'questionsGenPrompt';
    const isSessionHeaderField = keyString === 'sessionHeader';
    const isCorsWorkerField = keyString === 'corsWorkerUrl';
    const isNetworkChainField = keyString === 'networkChainId';
    if (path.length === 0 && key === 'sessionModeProfile') return null;
    const e2eTestId = (() => {
      if (keyString === 'sessionName') return E2E_TESTIDS.WIZARD_SESSION_NAME;
      if (keyString === 'sessionInfo') return E2E_TESTIDS.WIZARD_SESSION_INFO;
      if (keyString === 'slug') return E2E_TESTIDS.WIZARD_SLUG;
      if (keyString === 'corsWorkerUrl') return E2E_TESTIDS.WIZARD_WORKER_URL;
      return '';
    })();
    const gateIds = gateOptions.map((opt) => toStr(opt.id).trim()).filter(Boolean);
    const selectedGateIds = !isSlugField
      ? normalizeGateIds(encryptedFieldGates[keyString]).filter((id) => gateIds.includes(id))
      : [];
    const primaryGate = selectedGateIds.length === 1 ? getGateById(selectedGateIds[0]) : null;
    const primaryGateLabel = toStr(primaryGate?.label).trim();
    const primaryGateColor = toStr(primaryGate?.color).trim();
    const locked = selectedGateIds.length > 0;
    const lockActive = isSlugField ? privateSlugMode : locked;
    const defaultLockLabel = isNormalMode ? '' : t('sbt');
    const lockBadgeLabel: ReactNode = isSlugField
      ? 'ID'
      : selectedGateIds.length === 0
        ? defaultLockLabel
        : selectedGateIds.length === 1
          ? primaryGateLabel || selectedGateIds[0] || defaultLockLabel
          : `${selectedGateIds.length} ${t('gatesLower')}`;
    const showLockBadge = !!lockBadgeLabel;
    const lockBadgeStyle =
      !isSlugField && selectedGateIds.length === 1 && primaryGateColor
        ? { borderColor: primaryGateColor, color: primaryGateColor }
        : undefined;
    const lockTitle = isSlugField
      ? slugPinnedByPendingSbtDrafts
        ? `Queued ${t('sbt')} drafts pinned this session URL. Remove them before changing the slug.`
        : privateSlugMode
          ? 'Private URL mode enabled (uses session ID). Click to restore manual URL.'
          : 'Use session ID as the URL (private mode). This does not encrypt the URL.'
      : locked
        ? selectedGateIds.length === 1
          ? `Locked with ${primaryGateLabel || selectedGateIds[0]}. Click to edit or unlock.`
          : `Locked with ${selectedGateIds.length} ${t('gatesLower')}. Click to edit or unlock.`
        : `Click to lock with a ${t('gateLower')}.`;
    const lockIconStyle =
      !isSlugField && selectedGateIds.length === 1 && primaryGateColor ? { color: primaryGateColor } : undefined;
    const handleLockClick = () => {
      if (isSlugField) {
        if (slugPinnedByPendingSbtDrafts) return;
        togglePrivateSlugMode();
      }
    };
    const tooltipId = `gw-tip-${keyString.replace(/[^a-z0-9_-]/gi, '-')}`;
    const tooltipText = getSessionWizardFieldTooltip(currentPath, value);
    const chainName = /chainid$/i.test(keyString) ? getChainName(value as ChainIdLike) : '';
    const displayLabelText = chainName ? `${displayLabel} (${chainName})` : displayLabel;
    const fieldTooltipPlacement: LockableFieldFrameProps['tooltipPlacement'] = 'right';
    const fieldTooltipControl = renderSessionWizardInfoTooltip({
      id: tooltipId,
      content: tooltipText,
      placement: fieldTooltipPlacement,
      ariaLabel: `${displayLabelText} info`,
    });
    const slugValidationError = isSlugField ? getSessionSlugValidationError(value) : '';
    const fieldGateLockProps = !isSlugField
      ? {
          gateOptions,
          selectedGateIds,
          onChangeSelectedGateIds: (nextIds: unknown) => {
            const filtered = normalizeGateIds(nextIds).filter((id) => gateIds.includes(id));
            setEncryptedFieldGates((prev) => {
              const next = { ...(prev || {}) };
              if (!filtered.length) {
                delete next[keyString];
                return next;
              }
              next[keyString] = filtered.length === 1 ? filtered[0] : filtered;
              return next;
            });
            if (!filtered.length) setOpenLockKey('');
          },
          open: openLockKey === keyString,
          onToggleOpen: (nextOpen: boolean) => setOpenLockKey(nextOpen ? keyString : ''),
          disabled: !gateIds.length,
          showDots: true,
        }
      : null;
    const fieldFrameProps: LockableFieldFrameProps = {
      label: displayLabelText,
      tooltipText,
      tooltipId,
      tooltipPlacement: fieldTooltipPlacement,
      tooltipAriaLabel: `${displayLabelText} info`,
      tooltipsEnabled: sessionWizardTooltipsEnabled,
      canLock,
      isLocked: lockActive,
      onLockToggle: handleLockClick,
      lockTitle,
      lockBadgeLabel: showLockBadge ? lockBadgeLabel : '',
      lockBadgeStyle,
      lockIconStyle,
      gateLockProps: fieldGateLockProps,
    };

    const aiOrGateSelect = renderAiOrGateSelect({
      keyString,
      value,
      currentPath,
      displayLabelText,
      fieldTooltipControl,
      onUpdateDraftValue: updateDraftValue,
      draft: draft as RenderAiOrGateSelectParams['draft'],
      encryptionGates,
      defaultGateId,
      onSetDefaultGateId: setDefaultGateId,
    });
    if (aiOrGateSelect) return aiOrGateSelect;

    if (keyString === 'defaultFeaturedSBTs') {
      const selections = normalizeSbtSelection(value);
      const uniqueSelections = selections.filter((sbt, idx, arr) => {
        const addr = toStr(sbt.address).toLowerCase();
        return addr && arr.findIndex((other) => toStr(other.address).toLowerCase() === addr) === idx;
      });
      return (
        <FeaturedSbtField
          key={keyString}
          label={displayLabelText}
          tooltipControl={fieldTooltipControl}
          createButtonLabel={`Create ${t('sbt')}`}
          onCreateSbt={() => launchCreateSbtModal({ targetType: 'defaultFeaturedSBTs' })}
          selectedSBTs={uniqueSelections}
          onSelectionsChange={(next) => {
            updateDraftValue(['defaultFeaturedSBTs'], serializeDefaultFeaturedSbtSelections(next));
          }}
          onRemove={(address) => handleRemoveDefaultFeaturedSbt(address)}
          selectorLabel={`Choose ${t('sbts')} to feature by default`}
          network={network}
          additionalSBTOptions={pendingSbtSelectorOptions}
          chainId={selectorSourceChainId}
          sessionSlug={selectorSourceSessionConfig?.slug || resolvedActiveSessionSlug || ''}
          sessionConfig={selectorSourceSessionConfig}
          sbtCacheRevision={sbtCacheRevision}
          ensureLightSbtUniverse={ensureLightSbtUniverse}
        />
      );
    }

    if (path.length === 0 && key === 'contracts') {
      const contracts: SessionContractsLike =
        value && typeof value === 'object' && !Array.isArray(value) ? (value as SessionContractsLike) : {};
      const defaults = getSessionWizardContractDefaults(registryChainId);
      const visibleKeys = getVisibleSessionWizardContractKeys(contracts, defaults);
      const isCollapsed = metadataObjectCollapsed.contracts;
      return (
        <SessionWizardContractsField
          key={keyString}
          title={displayLabel}
          contracts={contracts}
          defaults={defaults}
          visibleKeys={visibleKeys}
          isCollapsed={isCollapsed}
          onToggleCollapsed={() => setMetadataObjectCollapsed((prev) => ({ ...prev, contracts: !prev.contracts }))}
          onAddressChange={(contractKey, address) => updateDraftValue(['contracts', contractKey, 'address'], address)}
          onOpenContractViewer={openContractViewerModal}
          renderInfoTooltip={renderSessionWizardInfoTooltip}
        />
      );
    }

    if (path.length === 0 && key === 'faucet') {
      const faucet = value && typeof value === 'object' ? value : {};
      const isCollapsed = metadataObjectCollapsed.faucet;
      return (
        <CollapsibleFieldGroup
          key={keyString}
          title={displayLabel}
          isCollapsed={isCollapsed}
          toggleAriaLabel={`${displayLabel} ${isCollapsed ? 'expand' : 'collapse'}`}
          onToggleCollapsed={() => setMetadataObjectCollapsed((prev) => ({ ...prev, faucet: !prev.faucet }))}
        >
          {!isCollapsed &&
            Object.entries(faucet).map(([childKey, childValue]) => renderField(childKey, childValue, currentPath))}
        </CollapsibleFieldGroup>
      );
    }

    if (path.length === 0 && key === 'ai') {
      const ai = value && typeof value === 'object' ? value : {};
      const isCollapsed = metadataObjectCollapsed.ai;
      return (
        <CollapsibleFieldGroup
          key={keyString}
          title={displayLabel}
          isCollapsed={isCollapsed}
          toggleAriaLabel={`${displayLabel} ${isCollapsed ? 'expand' : 'collapse'}`}
          onToggleCollapsed={() => setMetadataObjectCollapsed((prev) => ({ ...prev, ai: !prev.ai }))}
        >
          {!isCollapsed &&
            Object.entries(ai).map(([childKey, childValue]) => renderField(childKey, childValue, currentPath))}
        </CollapsibleFieldGroup>
      );
    }

    if (path.length === 0 && key === 'lit') {
      if (wizardMode !== 'advanced') return null;
      const lit = value && typeof value === 'object' ? value : {};
      const isCollapsed = metadataObjectCollapsed.lit;
      return (
        <CollapsibleFieldGroup
          key={keyString}
          title={displayLabel}
          isCollapsed={isCollapsed}
          toggleAriaLabel={`${displayLabel} ${isCollapsed ? 'expand' : 'collapse'}`}
          onToggleCollapsed={() => setMetadataObjectCollapsed((prev) => ({ ...prev, lit: !prev.lit }))}
        >
          {!isCollapsed &&
            Object.entries(lit).map(([childKey, childValue]) => renderField(childKey, childValue, currentPath))}
        </CollapsibleFieldGroup>
      );
    }

    if (path.length === 0 && key === 'storageProfile') {
      if (wizardMode !== 'advanced') return null;
      const isCollapsed = metadataObjectCollapsed.storageProfile;
      return (
        <SessionWizardStorageProfileMetadataField
          key={keyString}
          title={displayLabel}
          value={value}
          isCollapsed={isCollapsed}
          onToggleCollapsed={() =>
            setMetadataObjectCollapsed((prev) => ({ ...prev, storageProfile: !prev.storageProfile }))
          }
          onStorageProfileChange={(nextProfile) => {
            setDraft((prev) => {
              const next = applyStorageProfileChangeToModeDraft(prev, nextProfile);
              draftRef.current = next;
              return next;
            });
          }}
        />
      );
    }

    if (path.length === 0 && key === 'blockLimits') {
      return (
        <BlockLimitsField
          key={keyString}
          blockLimits={value as BlockLimitsFieldProps['blockLimits']}
          onStartChange={(raw) => {
            markBlockStartManual();
            updateDraftValue(['blockLimits', 'start'], raw === '' ? null : Number(raw));
          }}
          blockLimitDuration={blockLimitDuration}
          blockLimitUnit={blockLimitUnit}
          onDurationChange={setBlockLimitDuration}
          onUnitChange={setBlockLimitUnit}
          latestChainBlock={latestChainBlock}
          latestBlockStatus={latestBlockStatus}
          label={displayLabelText}
          tooltipControl={fieldTooltipControl}
        />
      );
    }

    if (Array.isArray(value)) {
      const isFlat = isStringArray(value);
      const display = isFlat ? value.join('\n') : JSON.stringify(value, null, 2);
      return (
        <LockableFieldFrame key={keyString} {...fieldFrameProps} fieldError={fieldErrors[keyString]}>
          <Input
            type="textarea"
            rows="4"
            value={display}
            onChange={(e) => updateArrayValue(currentPath, e.target.value, !isFlat)}
            className={styles.textarea}
          />
        </LockableFieldFrame>
      );
    }

    if (value && typeof value === 'object') {
      const childNodes = Object.entries(value)
        .map(([childKey, childValue]) => renderField(childKey, childValue, currentPath))
        .filter(Boolean);
      return (
        <div key={keyString} className={styles.objectGroup}>
          <div className={styles.objectHeader}>
            <div className={styles.objectTitle}>{displayLabel}</div>
          </div>
          <div className={styles.objectBody}>
            {childNodes.length ? (
              childNodes
            ) : (
              <div className={styles.helperText}>
                {key === 'arweave' && workerSecretsEnabled
                  ? 'Arweave keys are stored in worker secrets.'
                  : 'No editable fields in this section yet.'}
              </div>
            )}
          </div>
        </div>
      );
    }

    const isBool = typeof value === 'boolean';
    const isNumber = typeof value === 'number';
    if (isBool) {
      const checkboxClass = keyString === 'autoFeatureSBTsBySessionSlug' ? styles.checkboxOffset : '';
      return (
        <LockableFieldFrame
          key={keyString}
          {...fieldFrameProps}
          labelInlineControl={
            <Input
              type="checkbox"
              checked={!!value}
              onChange={(e) => updateDraftValue(currentPath, !!e.target.checked)}
              disabled={isDefaultFilterState || isNetworkChainField}
              className={`${styles.inlineCheckbox} ${checkboxClass}`}
            />
          }
        />
      );
    }
    if (isSessionHeaderField) {
      if (isNormalMode) {
        return (
          <LockableFieldFrame
            key={keyString}
            {...fieldFrameProps}
            label="Image"
            labelPrefix={<FontAwesomeIcon icon={faImage} className={styles.compactSessionHeaderIcon} />}
          >
            <SessionHeaderField
              compact
              value={draft?.sessionHeader}
              sessionHeaderMode={sessionHeaderMode}
              compactSessionHeaderMode={compactSessionHeaderMode}
              sessionHeaderPreviewSrc={sessionHeaderPreviewSrc}
              sessionHeaderUploadStatus={sessionHeaderUploadStatus}
              sessionHeaderUploadStatusTone={sessionHeaderUploadStatusTone}
              compactSessionHeaderInputRef={compactSessionHeaderInputRef}
              onCompactUrlChange={(event) => {
                updateDraftValue(['sessionHeader'], event.target.value);
                setSessionHeaderStatus('');
              }}
              onToggleCompactUrlMode={() => {
                setCompactSessionHeaderMode((prev) => (prev === 'url' ? 'idle' : 'url'));
                setSessionHeaderMode('url');
                setSessionHeaderFile(null);
                setSessionHeaderStatus('');
              }}
              onPaste={handlePasteSessionHeaderFromClipboard}
              onCompactUploadClick={() => {
                setCompactSessionHeaderMode('idle');
                setSessionHeaderMode('upload');
                setSessionHeaderStatus('');
                if (compactSessionHeaderInputRef.current) {
                  compactSessionHeaderInputRef.current.click();
                }
              }}
              onCompactFileChange={(event) => {
                setSessionHeaderMode('upload');
                setSessionHeaderFile(event.target.files?.[0] || null);
                setSessionHeaderStatus('');
              }}
              onClear={handleClearSessionHeaderPreview}
            />
          </LockableFieldFrame>
        );
      }
      return (
        <LockableFieldFrame key={keyString} {...fieldFrameProps}>
          <SessionHeaderField
            value={value == null ? null : toStr(value)}
            sessionHeaderMode={sessionHeaderMode}
            compactSessionHeaderMode={compactSessionHeaderMode}
            sessionHeaderPreviewSrc={sessionHeaderPreviewSrc}
            sessionHeaderUploadStatus={sessionHeaderUploadStatus}
            sessionHeaderUploadStatusTone={sessionHeaderUploadStatusTone}
            onUrlChange={(e) => updateDraftValue(currentPath, e.target.value)}
            onUseUrlMode={() => {
              setSessionHeaderMode('url');
              setSessionHeaderFile(null);
              setSessionHeaderStatus('');
            }}
            onUseUploadMode={() => {
              setSessionHeaderMode('upload');
              setSessionHeaderStatus('');
            }}
            onAdvancedFileChange={(e) => setSessionHeaderFile(e.target.files?.[0] || null)}
            onClear={handleClearSessionHeaderPreview}
            onExpandPreview={() => setSessionHeaderPreviewModalOpen(true)}
          />
        </LockableFieldFrame>
      );
    }

    if (isQuestionsPrompt) {
      const promptPreview = seedGenPrompt.replace('<GroupCustomInstructions>', toStr(value || ''));
      return (
        <FormGroup key={keyString} className={styles.fieldGroup}>
          <div className={styles.fieldHeader}>
            <div className={styles.fieldLabelRow}>
              <Label>{displayLabelText}</Label>
              {fieldTooltipControl}
            </div>
            <Button
              type="button"
              className={styles.secondaryButton}
              onClick={() => setShowPromptPreview((prev) => !prev)}
            >
              Preview prompt{' '}
              <FontAwesomeIcon icon={showPromptPreview ? faCaretUp : faCaretDown} style={{ marginLeft: 6 }} />
            </Button>
          </div>
          <Input
            type="textarea"
            rows="4"
            value={toStr(value)}
            onChange={(e) => updateDraftValue(currentPath, e.target.value)}
            className={styles.textarea}
          />
          {showPromptPreview && (
            <div className={styles.promptPreview}>
              <pre className={styles.promptPreviewText}>{promptPreview}</pre>
            </div>
          )}
        </FormGroup>
      );
    }
    return (
      <LockableFieldFrame
        key={keyString}
        {...fieldFrameProps}
        lockTrailingContent={
          isSlugField ? (
            <>
              {!privateSlugMode && slugAvailability.status === 'checking' && (
                <FontAwesomeIcon
                  icon={faSpinner}
                  spin
                  style={{ marginLeft: 6, opacity: 0.5, fontSize: 12 }}
                  title="Checking availability…"
                />
              )}
              {!privateSlugMode && slugAvailability.status === 'available' && (
                <FontAwesomeIcon
                  icon={faCheck}
                  style={{ marginLeft: 6, color: '#4dffa4', fontSize: 12 }}
                  title="Slug available"
                  data-testid={E2E_TESTIDS.WIZARD_SLUG_AVAILABLE}
                />
              )}
              {!privateSlugMode && slugAvailability.status === 'taken' && (
                <FontAwesomeIcon
                  icon={faExclamationCircle}
                  style={{ marginLeft: 6, color: '#ffcc7b', fontSize: 12 }}
                  title="Slug already taken"
                  data-testid={E2E_TESTIDS.WIZARD_SLUG_TAKEN}
                />
              )}
            </>
          ) : null
        }
        fieldError={slugValidationError}
      >
        <Input
          type={isNumber ? 'number' : 'text'}
          value={value == null ? '' : typeof value === 'number' ? value : toStr(value)}
          disabled={
            isDefaultFilterState ||
            isNetworkChainField ||
            (isSlugField && (privateSlugMode || slugPinnedByPendingSbtDrafts))
          }
          data-testid={e2eTestId || undefined}
          onChange={(e) => {
            const raw = e.target.value;
            if (isCorsWorkerField) setWorkerUrlAutoFilled(false);
            updateDraftValue(currentPath, isNumber ? Number(raw) : raw);
          }}
        />
        {isSlugField && slugPinnedByPendingSbtDrafts && (
          <div className={styles.helperText}>
            {`Queued ${t('sbt')} drafts pinned this slug so their uploaded metadata stays aligned with the final session URL.`}
          </div>
        )}
      </LockableFieldFrame>
    );
  };

  return renderField;
};
