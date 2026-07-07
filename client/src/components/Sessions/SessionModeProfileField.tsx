import React, { useMemo, useState } from 'react';
import { Button, Input, Label, UncontrolledTooltip } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCaretDown, faCaretUp, faCheck, faQuestionCircle } from '@fortawesome/free-solid-svg-icons';

import styles from './SessionWizard.module.scss';
import type { AnyRecord } from '../shellTypes';
import {
  SESSION_MODE_PRESET_IDS,
  cloneSessionModePreset,
  compileSessionModeProfile,
  validateSessionModeProfile,
  type SessionModeAccessConditionDocument,
  type SessionModeEncryptionMode,
  type SessionModeExportScope,
  type SessionModeProfile,
  type SessionModeResultsVisibility,
  type SessionModeSurface,
} from '../../utilities/session/sessionModeProfile';

type SessionModeProfileFieldProps = {
  registryChainId?: number | null;
  value?: unknown;
  onChange: (profile: SessionModeProfile, compiled: { storageProfile: AnyRecord }) => void;
};

const PRESET_CARDS = [
  {
    id: SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE,
    title: 'Fast & Cheap (Cloudflare)',
    badge: 'Recommended',
    copy: 'Hosted on Cloudflare. Session-scoped by default. Not permanent. Can be publicly anchored later.',
    keys: ['Cloudflare API token', 'AI provider key', 'Arweave JWK', 'RPC URL/key', 'Lit key only for Lit encryption'],
  },
  {
    id: SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED,
    title: 'Trustless & Public (Decentralized)',
    badge: '',
    copy: 'Published publicly and permanently unless you enable encryption. Slower and more expensive to set up.',
    keys: ['Arweave wallet/JWK', 'RPC URL/key', 'AI provider key', 'Lit API key if encryption is enabled'],
  },
] as const;

const RESULT_VISIBILITY_OPTIONS: Array<{ value: SessionModeResultsVisibility; label: string }> = [
  { value: 'private_admin', label: 'Admin only' },
  { value: 'participant_aggregate', label: 'Participant aggregate' },
  { value: 'session_member_aggregate', label: 'Session member aggregate' },
  { value: 'public_redacted_snapshot', label: 'Public redacted snapshot' },
  { value: 'public_full_if_storage_public', label: 'Public storage view' },
];

const EXPORT_SCOPE_OPTIONS: Array<{ value: SessionModeExportScope; label: string }> = [
  { value: 'admin_raw', label: 'Admin raw export' },
  { value: 'all_session', label: 'All session surfaces' },
  { value: 'selected_surfaces', label: 'Selected surfaces' },
  { value: 'encrypted_envelopes_only', label: 'Encrypted envelopes only' },
];

const SURFACE_LABELS: Array<{ value: SessionModeSurface; label: string; rendered: boolean; fixed?: boolean }> = [
  { value: 'web', label: 'Web', rendered: true, fixed: true },
  { value: 'telegram', label: 'Telegram', rendered: true },
  { value: 'miniApp', label: 'Mini App', rendered: true },
  { value: 'agentHttp', label: 'Agent HTTP', rendered: true },
  { value: 'mcp', label: 'MCP', rendered: false },
  { value: 'ceCc', label: 'CE-CC', rendered: false },
];

const isProfile = (value: unknown): value is SessionModeProfile =>
  !!value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  (value as { profileVersion?: unknown }).profileVersion === 1;

const cloneProfile = (profile: SessionModeProfile): SessionModeProfile => JSON.parse(JSON.stringify(profile));

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

const cloneAccessConditions = (value?: SessionModeAccessConditionDocument): SessionModeAccessConditionDocument =>
  value ? JSON.parse(JSON.stringify(value)) : { match: 'any', conditions: [] };

const defaultSbtChainId = (profile: SessionModeProfile, registryChainId: number | null): number =>
  Number(profile.evm.registryChainId || registryChainId || 11155420) || 11155420;

const setWorkerEnvelopeCondition = (profile: SessionModeProfile, conditions: SessionModeAccessConditionDocument) => {
  profile.encryption = {
    ...profile.encryption,
    accessConditions: conditions.conditions.length ? conditions : undefined,
  };
};

const SessionModeProfileField = ({
  registryChainId = null,
  value = null,
  onChange,
}: SessionModeProfileFieldProps): React.ReactElement => {
  const profile = isProfile(value) ? value : null;
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const selectedPreset = profile?.preset && profile.preset !== SESSION_MODE_PRESET_IDS.CUSTOM ? profile.preset : '';
  const validation = useMemo(
    () => (profile ? validateSessionModeProfile(profile) : { valid: false, issues: [] }),
    [profile],
  );

  const commitProfile = (nextProfile: SessionModeProfile) => {
    const compiled = compileSessionModeProfile(nextProfile);
    onChange(nextProfile, { storageProfile: compiled.storageProfile });
  };

  const selectPreset = (
    presetId: Exclude<(typeof SESSION_MODE_PRESET_IDS)[keyof typeof SESSION_MODE_PRESET_IDS], 'custom'>,
  ) => {
    const nextProfile = presetForChain(presetId, registryChainId || null);
    if (
      profile &&
      profilesDiffer(profile, nextProfile) &&
      typeof window !== 'undefined' &&
      typeof window.confirm === 'function'
    ) {
      const confirmed = window.confirm('Switch preset and replace incompatible advanced settings?');
      if (!confirmed) return;
    }
    commitProfile(nextProfile);
  };

  const updateProfile = (mutate: (draft: SessionModeProfile) => void) => {
    const base = profile
      ? cloneProfile(profile)
      : presetForChain(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE, registryChainId || null);
    base.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
    mutate(base);
    base.surfaces.web = true;
    commitProfile(base);
  };

  const selectedSurfaceFilter = new Set(profile?.export.surfaceFilter || []);
  const hasRegistryChain = !!(profile?.evm.registryChainId || registryChainId);
  const litDisabledReason = hasRegistryChain ? '' : 'Choose a registry chain before enabling Lit.';
  const workerEnvelopeDisabledReason =
    profile?.storage.backend === 'cloudflare'
      ? ''
      : 'Worker envelope encryption is available only with Cloudflare storage. Use Lit for encrypted Arweave artifacts.';

  return (
    <section className={styles.modeProfilePanel} aria-label="Session mode">
      <div className={styles.modeProfileHeader}>
        <div>
          <h2 className={styles.modeProfileTitle}>Choose session mode</h2>
          {profile?.preset === SESSION_MODE_PRESET_IDS.CUSTOM ? (
            <span className={styles.modeProfileChip}>Custom</span>
          ) : null}
        </div>
        <Button
          type="button"
          color="primary"
          disabled={!profile}
          data-testid="ce-new-preset-continue"
        >
          Continue
        </Button>
      </div>

      <div className={styles.modePresetGrid} role="radiogroup" aria-label="Session mode presets">
        {PRESET_CARDS.map((preset) => {
          const selected = selectedPreset === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              role="radio"
              aria-checked={selected}
              className={`${styles.modePresetCard} ${selected ? styles.modePresetCardSelected : ''}`}
              data-testid={`ce-new-preset-${preset.id}`}
              onClick={() => selectPreset(preset.id)}
            >
              <span className={styles.modePresetTitleRow}>
                <span className={styles.modePresetTitle}>{preset.title}</span>
                {preset.badge ? <span className={styles.modePresetBadge}>{preset.badge}</span> : null}
                {selected ? <FontAwesomeIcon icon={faCheck} className={styles.modePresetCheck} /> : null}
              </span>
              <span className={styles.modePresetCopy}>{preset.copy}</span>
            </button>
          );
        })}
      </div>

      {!entryOnly ? (
        <button
          type="button"
          className={styles.moreOptionsToggle}
          onClick={() => setAdvancedOpen((prev) => !prev)}
          aria-expanded={advancedOpen}
        >
          Advanced options <FontAwesomeIcon icon={advancedOpen ? faCaretUp : faCaretDown} style={{ marginLeft: 6 }} />
        </button>
      ) : null}

      {advancedOpen ? (
        <div className={styles.modeAdvancedGrid}>
          {!profile ? (
            <div className={styles.helperText}>Choose a preset before editing per-axis options.</div>
          ) : (
            <>
              <FormRow label="Storage backend">
                <SegmentedButtons
                  ariaLabel="Storage backend"
                  options={[
                    { value: 'cloudflare', label: 'Cloudflare' },
                    { value: 'arweave', label: 'Arweave' },
                  ]}
                  value={profile.storage.backend}
                  onChange={(backend) =>
                    updateProfile((draft) => {
                      draft.storage.backend = backend as SessionModeProfile['storage']['backend'];
                      if (backend === 'cloudflare') {
                        draft.authority.mode = 'worker_canonical';
                        if (draft.results.visibility === 'public_full_if_storage_public') {
                          draft.results.visibility = 'participant_aggregate';
                        }
                      } else {
                        draft.authority.mode = 'evm_registry_canonical';
                        draft.evm.registryChainId = draft.evm.registryChainId || registryChainId || 11155420;
                        if (draft.encryption.mode === 'worker_envelope') {
                          draft.encryption = { mode: 'none' };
                        }
                        if (draft.export.scope === 'encrypted_envelopes_only' && draft.encryption.mode === 'none') {
                          draft.export.scope = 'admin_raw';
                        }
                      }
                    })
                  }
                />
              </FormRow>

              <FormRow label="Encryption">
                <SegmentedButtons
                  ariaLabel="Encryption"
                  options={[
                    { value: 'none', label: 'None' },
                    { value: 'lit', label: 'Lit', disabled: !!litDisabledReason, title: litDisabledReason },
                    {
                      value: 'worker_envelope',
                      label: 'Worker envelope',
                      disabled: !!workerEnvelopeDisabledReason,
                      title: workerEnvelopeDisabledReason,
                    },
                  ]}
                  value={profile.encryption.mode}
                  onChange={(mode) =>
                    updateProfile((draft) => {
                      draft.encryption = { mode: mode as SessionModeEncryptionMode };
                      if (mode === 'lit') {
                        draft.evm.registryChainId = draft.evm.registryChainId || registryChainId || 11155420;
                      }
                      if (mode === 'worker_envelope') {
                        draft.encryption.keyProvider = 'worker_secret';
                      }
                      if (mode === 'none' && draft.export.scope === 'encrypted_envelopes_only') {
                        draft.export.scope = 'admin_raw';
                      }
                    })
                  }
                  dataTestIdPrefix="ce-new-encryption"
                />
                {litDisabledReason ? <div className={styles.helperText}>{litDisabledReason}</div> : null}
                {workerEnvelopeDisabledReason ? (
                  <div className={styles.helperText}>{workerEnvelopeDisabledReason}</div>
                ) : null}
                {profile.encryption.mode === 'worker_envelope' ? (
                  <WorkerEnvelopeOptions
                    profile={profile}
                    registryChainId={registryChainId || null}
                    updateProfile={updateProfile}
                  />
                ) : null}
              </FormRow>

              <FormRow label="Surfaces">
                <div className={styles.modeCheckboxRow}>
                  {SURFACE_LABELS.filter((surface) => surface.rendered).map((surface) => (
                    <Label key={surface.value} check className={styles.modeCheckboxLabel}>
                      <Input
                        type="checkbox"
                        checked={profile.surfaces[surface.value]}
                        disabled={surface.fixed}
                        onChange={(event) =>
                          updateProfile((draft) => {
                            draft.surfaces[surface.value] = surface.fixed ? true : event.target.checked;
                            if (surface.value === 'telegram' && event.target.checked) {
                              draft.surfaces.miniApp = true;
                            }
                          })
                        }
                      />{' '}
                      {surface.label}
                    </Label>
                  ))}
                </div>
              </FormRow>

              <FormRow label="Results visibility">
                <Input
                  type="select"
                  value={profile.results.visibility}
                  onChange={(event) =>
                    updateProfile((draft) => {
                      draft.results.visibility = event.target.value as SessionModeResultsVisibility;
                    })
                  }
                >
                  {RESULT_VISIBILITY_OPTIONS.map((option) => (
                    <option
                      key={option.value}
                      value={option.value}
                      disabled={
                        option.value === 'public_full_if_storage_public' && profile.storage.backend === 'cloudflare'
                      }
                    >
                      {option.label}
                    </option>
                  ))}
                </Input>
                <div className={styles.modeCheckboxRow}>
                  <Label check className={styles.modeCheckboxLabel}>
                    <Input
                      type="checkbox"
                      checked={profile.results.exposure?.anonymizedGroupsEnabled === true}
                      onChange={(event) =>
                        updateProfile((draft) => {
                          draft.results.exposure = {
                            aggregateResultsEnabled: draft.results.exposure?.aggregateResultsEnabled !== false,
                            anonymizedGroupsEnabled: event.target.checked,
                            minGroupSize: Math.max(2, Number(draft.results.exposure?.minGroupSize || 2) || 2),
                          };
                        })
                      }
                    />{' '}
                    Anonymized groups
                  </Label>
                  <Label className={styles.modeNumberLabel}>
                    Min group size
                    <Input
                      type="number"
                      min={2}
                      value={profile.results.exposure?.minGroupSize || 2}
                      onChange={(event) =>
                        updateProfile((draft) => {
                          draft.results.exposure = {
                            aggregateResultsEnabled: draft.results.exposure?.aggregateResultsEnabled !== false,
                            anonymizedGroupsEnabled: draft.results.exposure?.anonymizedGroupsEnabled === true,
                            minGroupSize: Math.max(2, Number(event.target.value || 2) || 2),
                          };
                        })
                      }
                    />
                  </Label>
                </div>
              </FormRow>

              <FormRow label="Export scope">
                <Input
                  type="select"
                  value={profile.export.scope}
                  onChange={(event) =>
                    updateProfile((draft) => {
                      draft.export.scope = event.target.value as SessionModeExportScope;
                      if (draft.export.scope !== 'selected_surfaces') {
                        delete draft.export.surfaceFilter;
                      } else if (!draft.export.surfaceFilter?.length) {
                        draft.export.surfaceFilter = ['web'];
                      }
                    })
                  }
                >
                  {EXPORT_SCOPE_OPTIONS.map((option) => (
                    <option
                      key={option.value}
                      value={option.value}
                      disabled={option.value === 'encrypted_envelopes_only' && profile.encryption.mode === 'none'}
                    >
                      {option.label}
                    </option>
                  ))}
                </Input>
                {profile.export.scope === 'selected_surfaces' ? (
                  <div className={styles.modeCheckboxRow}>
                    {SURFACE_LABELS.filter((surface) => surface.rendered).map((surface) => (
                      <Label key={surface.value} check className={styles.modeCheckboxLabel}>
                        <Input
                          type="checkbox"
                          checked={selectedSurfaceFilter.has(surface.value)}
                          onChange={(event) =>
                            updateProfile((draft) => {
                              const next = new Set(draft.export.surfaceFilter || []);
                              if (event.target.checked) next.add(surface.value);
                              else next.delete(surface.value);
                              draft.export.surfaceFilter = Array.from(next);
                            })
                          }
                        />{' '}
                        {surface.label}
                      </Label>
                    ))}
                  </div>
                ) : null}
              </FormRow>

              {!validation.valid ? (
                <div className={styles.modeValidationList} role="status">
                  {validation.issues.map((issue) => (
                    <div key={`${issue.path}:${issue.code}`}>{issue.message}</div>
                  ))}
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </section>
  );
};

type FormRowProps = {
  label: string;
  children: React.ReactNode;
};

const FormRow = ({ label, children }: FormRowProps): React.ReactElement => (
  <div className={styles.modeAdvancedRow}>
    <div className={styles.modeAdvancedLabel}>{label}</div>
    <div className={styles.modeAdvancedControl}>{children}</div>
  </div>
);

type SegmentedButtonsProps = {
  ariaLabel: string;
  options: Array<{ value: string; label: string; disabled?: boolean; title?: string }>;
  value: string;
  onChange: (value: string) => void;
  dataTestIdPrefix?: string;
};

const SegmentedButtons = ({
  ariaLabel,
  options,
  value,
  onChange,
  dataTestIdPrefix = '',
}: SegmentedButtonsProps): React.ReactElement => (
  <div className={styles.inlineToggleRow} role="radiogroup" aria-label={ariaLabel}>
    {options.map((option) => (
      <Button
        key={option.value}
        type="button"
        role="radio"
        aria-checked={value === option.value}
        disabled={option.disabled}
        title={option.title}
        data-testid={dataTestIdPrefix ? `${dataTestIdPrefix}-${option.value}` : undefined}
        className={`${styles.workerModePill} ${value === option.value ? styles.workerModePillActive : ''}`}
        onClick={() => onChange(option.value)}
      >
        {option.label}
      </Button>
    ))}
  </div>
);

type WorkerEnvelopeOptionsProps = {
  profile: SessionModeProfile;
  registryChainId: number | null;
  updateProfile: (mutate: (draft: SessionModeProfile) => void) => void;
};

const WorkerEnvelopeOptions = ({
  profile,
  registryChainId,
  updateProfile,
}: WorkerEnvelopeOptionsProps): React.ReactElement => {
  const conditions = cloneAccessConditions(profile.encryption.accessConditions);

  const commitConditions = (next: SessionModeAccessConditionDocument) => {
    updateProfile((draft) => {
      setWorkerEnvelopeCondition(draft, next);
    });
  };

  const addCondition = (kind: SessionModeAccessConditionDocument['conditions'][number]['kind']) => {
    const next = cloneAccessConditions(profile.encryption.accessConditions);
    if (kind === 'worker_role') next.conditions.push({ kind, role: 'admin' });
    if (kind === 'agent_grant_scope') next.conditions.push({ kind, scope: 'storage' });
    if (kind === 'sbt_onchain') {
      const chainId = defaultSbtChainId(profile, registryChainId);
      next.conditions.push({
        kind,
        chainId,
        contract: '',
        anyOrAll: 'any',
      });
      updateProfile((draft) => {
        draft.evm.registryChainId = draft.evm.registryChainId || chainId;
        setWorkerEnvelopeCondition(draft, next);
      });
      return;
    }
    commitConditions(next);
  };

  const updateCondition = (
    index: number,
    mutate: (
      condition: SessionModeAccessConditionDocument['conditions'][number],
    ) => SessionModeAccessConditionDocument['conditions'][number],
  ) => {
    const next = cloneAccessConditions(profile.encryption.accessConditions);
    const current = next.conditions[index];
    if (!current) return;
    next.conditions[index] = mutate(current);
    commitConditions(next);
  };

  return (
    <div className={styles.modeAdvancedNested}>
      <div className={styles.helperText}>
        Encrypted at rest. Keys are held by the session worker; decryption is gated by session conditions. Key provider:{' '}
        <strong>worker_secret</strong>{' '}
        <span id="ce-worker-envelope-copy-tooltip" tabIndex={0}>
          <FontAwesomeIcon icon={faQuestionCircle} />
        </span>
        <UncontrolledTooltip target="ce-worker-envelope-copy-tooltip" placement="right">
          The operator and Cloudflare runtime can decrypt. This protects storage-layer dumps, not operator trust.
        </UncontrolledTooltip>
      </div>
      <Label className={styles.modeNumberLabel}>
        Condition match
        <Input
          type="select"
          value={conditions.match}
          data-testid="ce-new-envelope-condition-match"
          onChange={(event) => {
            const next = cloneAccessConditions(profile.encryption.accessConditions);
            next.match = event.target.value === 'all' ? 'all' : 'any';
            commitConditions(next);
          }}
        >
          <option value="any">Any condition</option>
          <option value="all">All conditions</option>
        </Input>
      </Label>
      <div className={styles.inlineToggleRow}>
        <Button
          type="button"
          size="sm"
          onClick={() => addCondition('worker_role')}
          data-testid="ce-new-envelope-add-worker-role"
        >
          Add worker role
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() => addCondition('sbt_onchain')}
          data-testid="ce-new-envelope-add-sbt-onchain"
        >
          Add SBT
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() => addCondition('agent_grant_scope')}
          data-testid="ce-new-envelope-add-agent-scope"
        >
          Add agent scope
        </Button>
      </div>
      {!conditions.conditions.length ? (
        <div className={styles.helperText}>No default conditions; the worker falls back to the configured gate.</div>
      ) : null}
      {conditions.conditions.map((condition, index) => (
        <div key={`${condition.kind}-${index}`} className={styles.modeAdvancedRow}>
          <div className={styles.modeAdvancedLabel}>{condition.kind.replace(/_/g, ' ')}</div>
          <div className={styles.modeAdvancedControl}>
            {condition.kind === 'worker_role' ? (
              <Input
                value={condition.role}
                data-testid={`ce-new-envelope-worker-role-${index}`}
                onChange={(event) => updateCondition(index, () => ({ kind: 'worker_role', role: event.target.value }))}
              />
            ) : null}
            {condition.kind === 'agent_grant_scope' ? (
              <Input
                value={condition.scope}
                data-testid={`ce-new-envelope-agent-scope-${index}`}
                onChange={(event) =>
                  updateCondition(index, () => ({ kind: 'agent_grant_scope', scope: event.target.value }))
                }
              />
            ) : null}
            {condition.kind === 'sbt_onchain' ? (
              <div className={styles.modeCheckboxRow}>
                <Input
                  type="number"
                  value={condition.chainId || ''}
                  data-testid={`ce-new-envelope-sbt-chain-${index}`}
                  onChange={(event) =>
                    updateCondition(index, () => ({
                      ...condition,
                      chainId: Number(event.target.value || 0) || 0,
                    }))
                  }
                />
                <Input
                  value={condition.contract}
                  placeholder="0x..."
                  data-testid={`ce-new-envelope-sbt-contract-${index}`}
                  onChange={(event) =>
                    updateCondition(index, () => ({
                      ...condition,
                      contract: event.target.value,
                    }))
                  }
                />
                <Input
                  type="select"
                  value={condition.anyOrAll}
                  data-testid={`ce-new-envelope-sbt-match-${index}`}
                  onChange={(event) =>
                    updateCondition(index, () => ({
                      ...condition,
                      anyOrAll: event.target.value === 'all' ? 'all' : 'any',
                    }))
                  }
                >
                  <option value="any">Any token</option>
                  <option value="all">All tokens</option>
                </Input>
              </div>
            ) : null}
            <Button
              type="button"
              size="sm"
              color="secondary"
              onClick={() => {
                const next = cloneAccessConditions(profile.encryption.accessConditions);
                next.conditions.splice(index, 1);
                commitConditions(next);
              }}
            >
              Remove
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default SessionModeProfileField;
