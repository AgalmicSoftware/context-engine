import React from 'react';
import { Button } from 'reactstrap';

import styles from './SessionWizard.module.scss';
import type { AnyRecord } from '../shellTypes';
import {
  SESSION_MODE_DEFAULT_REGISTRY_CHAIN_ID,
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
  entryOnly?: boolean;
  showContinue?: boolean;
};

const HOSTING_PRESETS = [
  {
    id: SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE,
    label: 'Cloudflare',
    ariaLabel: 'Cloudflare (recommended)',
    entryLabel: 'Fast & Cheap',
    entryProvider: 'Cloudflare',
    entryDescription: 'Launch a dedicated Session Worker without an on-chain publish step.',
    entryRequirements: 'Cloudflare login / AI API Key',
    recommended: true,
  },
  {
    id: SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED,
    label: 'Decentralized',
    ariaLabel: 'Decentralized',
    entryLabel: 'Trustless & Public',
    entryProvider: 'Decentralized',
    entryDescription: 'Publish session authority on-chain and store public data with Arweave.',
    entryRequirements: 'AI API Key / Arweave wallet / RPC URL / testnet gas',
    recommended: false,
  },
] as const;

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
    if (registryChainId !== SESSION_MODE_DEFAULT_REGISTRY_CHAIN_ID) {
      profile.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
    }
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
      !window.confirm('Switch preset and replace incompatible advanced settings?')
    ) {
      return;
    }
    const compiled = compileSessionModeProfile(nextProfile);
    onChange(nextProfile, { storageProfile: compiled.storageProfile });
    if (entryOnly && typeof onContinue === 'function') onContinue();
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
              {preset.recommended ? <span className={styles.modePresetCardBadge}>Recommended</span> : null}
            </span>
            <span className={styles.modePresetCardDescription}>{preset.entryDescription}</span>
            <span className={styles.modePresetCardRequirements}>
              <span className={styles.modePresetCardRequirementsLabel}>What you&apos;ll need</span>
              <span className={styles.modePresetCardRequirementsValue}>{preset.entryRequirements}</span>
            </span>
          </>
        ) : (
          <>
            <span>{preset.label}</span>
            {preset.recommended ? <span className={styles.modePresetBadge}>Recommended</span> : null}
          </>
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
            <span className={styles.modeProfileEntryEyebrow}>Choose a setup</span>
            <h2>How should this session run?</h2>
            <p>Select the infrastructure path that matches the inputs you have available.</p>
          </div>
          <div className={styles.modePresetCards} role="radiogroup" aria-label="Session hosting profile">
            {HOSTING_PRESETS.map((preset, index) => renderPreset(preset, index, true))}
          </div>
        </>
      ) : (
        <>
          <span className={styles.modeProfileCompactLabel}>Hosting</span>
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
        </>
      )}

      {entryOnly && profile ? (
        <div className={`${styles.modeSavedProfile} ${styles.modeSavedProfileEntry}`}>
          <span>Saved {profile.preset === SESSION_MODE_PRESET_IDS.CUSTOM ? 'custom' : 'hosting'} settings</span>
          <Button type="button" color="primary" onClick={onContinue}>
            Continue with saved settings
          </Button>
        </div>
      ) : null}

      {!entryOnly ? (
        <button
          type="button"
          className={styles.moreOptionsToggle}
          onClick={onCustomize}
          aria-label="Customize hosting (advanced options)"
        >
          Customize
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
