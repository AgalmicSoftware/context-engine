import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons';
import { Button } from 'reactstrap';

import styles from './SessionWizard.module.scss';
import type { AnyRecord } from '../shellTypes';
import { PUBLIC_GITHUB_BRANCH, PUBLIC_REPO_URL } from '../../variables/publicRepoMetadata.js';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import {
  SESSION_MODE_PRESET_IDS,
  cloneSessionModePreset,
  compileSessionModeProfile,
  type SessionModeProfile,
} from '../../utilities/session/sessionModeProfile';

export type SessionModeProfileFieldProps = {
  registryChainId?: number | null;
  value?: unknown;
  onChange: (profile: SessionModeProfile, compiled: { storageProfile: AnyRecord }) => void;
  onContinue?: () => void;
  onCustomize?: () => void;
  onSelectPreset?: () => void;
  customizing?: boolean;
  entryOnly?: boolean;
  showContinue?: boolean;
};

const HOSTING_PRESETS = [
  {
    id: SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE,
    label: 'Cloudflare',
    ariaLabel: 'Cloudflare',
    entryLabel: 'Fast & Cheap',
    entryProvider: 'Cloudflare',
    entryDescription: 'Launch a dedicated Session Worker without an on-chain publish step.',
    entryRequirements: 'Cloudflare login / AI API Key',
  },
  {
    id: SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED,
    label: 'Decentralized',
    ariaLabel: 'Decentralized',
    entryLabel: 'Trustless & Public',
    entryProvider: 'Decentralized',
    entryDescription: 'Use a Session Worker for the web runtime while the EVM registry and Arweave stay canonical.',
    entryRequirements: 'Compatible Session Worker / AI API Key / Arweave wallet / RPC URL / EVM testnet gas',
  },
] as const;

const ARCHITECTURE_README_URL = `${PUBLIC_REPO_URL}/blob/${PUBLIC_GITHUB_BRANCH}/README.md#architecture-at-a-glance`;

const isProfile = (value: unknown): value is SessionModeProfile =>
  !!value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  (value as { profileVersion?: unknown }).profileVersion === 1;

const presetForChain = (
  presetId: Exclude<(typeof SESSION_MODE_PRESET_IDS)[keyof typeof SESSION_MODE_PRESET_IDS], 'custom'>,
  registryChainId: number | null,
): SessionModeProfile => {
  const profile = cloneSessionModePreset(presetId);
  if (presetId === SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED && registryChainId) {
    profile.evm.registryChainId = registryChainId;
  }
  return profile;
};

const profilesDiffer = (left: SessionModeProfile, right: SessionModeProfile): boolean =>
  JSON.stringify(left) !== JSON.stringify(right);

const SessionModeProfileField = ({
  registryChainId = null,
  value = null,
  onChange,
  onContinue,
  onCustomize,
  onSelectPreset,
  customizing = false,
  entryOnly = false,
  showContinue = true,
}: SessionModeProfileFieldProps): React.ReactElement => {
  const profile = isProfile(value) ? value : null;
  const selectedPreset = profile?.preset && profile.preset !== SESSION_MODE_PRESET_IDS.CUSTOM ? profile.preset : '';

  const selectPreset = (
    presetId: Exclude<(typeof SESSION_MODE_PRESET_IDS)[keyof typeof SESSION_MODE_PRESET_IDS], 'custom'>,
  ) => {
    const nextProfile = presetForChain(presetId, registryChainId || null);
    if (
      profile &&
      profilesDiffer(profile, nextProfile) &&
      typeof window !== 'undefined' &&
      typeof window.confirm === 'function' &&
      !window.confirm('Switch preset and replace incompatible custom settings?')
    ) {
      return;
    }
    const compiled = compileSessionModeProfile(nextProfile);
    onChange(nextProfile, { storageProfile: compiled.storageProfile });
    if (entryOnly && typeof onContinue === 'function') {
      onContinue();
    } else {
      onSelectPreset?.();
    }
  };

  const handlePresetKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    const direction = ['ArrowRight', 'ArrowDown'].includes(event.key)
      ? 1
      : ['ArrowLeft', 'ArrowUp'].includes(event.key)
        ? -1
        : 0;
    if (!direction) return;
    event.preventDefault();
    const nextIndex = (currentIndex + direction + HOSTING_PRESETS.length) % HOSTING_PRESETS.length;
    const nextPreset = HOSTING_PRESETS[nextIndex];
    const enabledRadios = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
      '[role="radio"]:not(:disabled)',
    );
    enabledRadios?.[nextIndex]?.focus();
    selectPreset(nextPreset.id);
  };

  const renderPreset = (preset: (typeof HOSTING_PRESETS)[number], index: number, entryCard: boolean) => {
    const selected = selectedPreset === preset.id;
    return (
      <button
        key={preset.id}
        type="button"
        role="radio"
        aria-checked={selected}
        aria-label={entryCard ? `${preset.entryLabel} (${preset.entryProvider})` : preset.ariaLabel}
        className={
          entryCard
            ? `${styles.modePresetCard} ${selected ? styles.modePresetCardSelected : ''}`
            : `${styles.modePresetButton} ${selected ? styles.modePresetButtonSelected : ''}`
        }
        data-testid={`ce-new-preset-${preset.id}`}
        tabIndex={selected || (!selectedPreset && index === 0) ? 0 : -1}
        onClick={() => selectPreset(preset.id)}
        onKeyDown={(event) => handlePresetKeyDown(event, index)}
      >
        {entryCard ? (
          <>
            <span className={styles.modePresetCardHeader}>
              <span>
                <span className={styles.modePresetCardTitle}>{preset.entryLabel}</span>
                <span className={styles.modePresetCardProvider}>{preset.entryProvider}</span>
              </span>
            </span>
            <span className={styles.modePresetCardDescription}>{preset.entryDescription}</span>
            <span className={styles.modePresetCardRequirements}>
              <span className={styles.modePresetCardRequirementsLabel}>What you&apos;ll need</span>
              <span className={styles.modePresetCardRequirementsValue}>{preset.entryRequirements}</span>
            </span>
          </>
        ) : (
          <span>{preset.label}</span>
        )}
      </button>
    );
  };

  return (
    <section
      className={`${styles.modeProfilePanel} ${entryOnly ? styles.modeProfileEntryPanel : ''}`}
      aria-label="Session hosting"
    >
      {entryOnly ? (
        <>
          <div className={styles.modeProfileEntryIntro}>
            <span className={styles.modeProfileEntryPrompt}>
              <span className={styles.modeProfileEntryEyebrow}>Choose a setup</span>
              <a
                className={styles.modeProfileArchitectureLink}
                href={ARCHITECTURE_README_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="View the deployment architecture diagram on GitHub"
                title="View the deployment architecture diagram on GitHub"
              >
                <FontAwesomeIcon icon={faQuestionCircle} aria-hidden="true" />
              </a>
            </span>
          </div>
          <div className={styles.modePresetCards} role="radiogroup" aria-label="Session hosting profile">
            {HOSTING_PRESETS.map((preset, index) => renderPreset(preset, index, true))}
          </div>
        </>
      ) : (
        <div className={styles.modePresetToggle} role="radiogroup" aria-label="Session hosting profile">
          {HOSTING_PRESETS.map((preset, index) => renderPreset(preset, index, false))}
          <button
            type="button"
            role="radio"
            aria-label="Corporate (coming later)"
            aria-checked="false"
            className={`${styles.modePresetButton} ${styles.modePresetButtonDisabled}`}
            title="Corporate hosting is coming later"
            disabled
            tabIndex={-1}
          >
            <span>Corporate</span>
            <span className={styles.modePresetSoon}>Later</span>
          </button>
        </div>
      )}

      {entryOnly && profile ? (
        <div className={styles.modeSavedProfile}>
          <span>Saved {profile.preset === SESSION_MODE_PRESET_IDS.CUSTOM ? 'custom' : 'hosting'} settings</span>
          <Button type="button" color="primary" onClick={onContinue}>
            Continue with saved settings
          </Button>
        </div>
      ) : null}

      {!entryOnly ? (
        <button
          type="button"
          className={`${styles.moreOptionsToggle} ${customizing ? styles.moreOptionsToggleActive : ''}`}
          onClick={onCustomize}
          aria-label={customizing ? 'Finish customizing session settings' : 'Customize session settings'}
          aria-pressed={customizing}
          data-testid={E2E_TESTIDS.WIZARD_MODE_ADVANCED}
        >
          {customizing ? 'Done' : 'Customize'}
        </button>
      ) : null}

      {showContinue && !entryOnly ? (
        <Button
          type="button"
          color="primary"
          disabled={!profile}
          data-testid="ce-new-preset-continue"
          onClick={onContinue}
        >
          Continue
        </Button>
      ) : null}
    </section>
  );
};

export default SessionModeProfileField;
