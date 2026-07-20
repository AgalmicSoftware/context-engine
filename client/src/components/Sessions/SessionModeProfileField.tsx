import React from 'react';
import { Button } from 'reactstrap';

import styles from './SessionWizard.module.scss';
import type { AnyRecord } from '../shellTypes';
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
  entryOnly?: boolean;
  showContinue?: boolean;
};

const HOSTING_PRESETS = [
  {
    id: SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE,
    label: 'Cloudflare',
    ariaLabel: 'Cloudflare (recommended)',
    recommended: true,
  },
  {
    id: SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED,
    label: 'Decentralized',
    ariaLabel: 'Decentralized',
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

  return (
    <section className={styles.modeProfilePanel} aria-label="Session hosting">
      <span className={styles.modeProfileCompactLabel}>Hosting</span>
      <div className={styles.modePresetToggle} role="radiogroup" aria-label="Session hosting profile">
        {HOSTING_PRESETS.map((preset) => {
          const selected = selectedPreset === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={preset.ariaLabel}
              className={`${styles.modePresetButton} ${selected ? styles.modePresetButtonSelected : ''}`}
              data-testid={`ce-new-preset-${preset.id}`}
              onClick={() => selectPreset(preset.id)}
            >
              <span>{preset.label}</span>
              {preset.recommended ? <span className={styles.modePresetBadge}>Recommended</span> : null}
            </button>
          );
        })}
        <button
          type="button"
          role="radio"
          aria-label="Corporate (coming later)"
          aria-checked="false"
          className={`${styles.modePresetButton} ${styles.modePresetButtonDisabled}`}
          title="Corporate hosting is coming later"
          disabled
        >
          <span>Corporate</span>
          <span className={styles.modePresetSoon}>Later</span>
        </button>
      </div>

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
