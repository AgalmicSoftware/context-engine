import React, { useMemo } from 'react';
import { Button, Input, Label } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash } from '@fortawesome/free-solid-svg-icons';

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

export type SessionModeProfileSection = 'privacy' | 'worker' | 'publish';

export type SessionModeProfileSectionsProps = {
  section: SessionModeProfileSection;
  registryChainId?: number | null;
  value?: unknown;
  onChange: (profile: SessionModeProfile, compiled: { storageProfile: AnyRecord }) => void;
};

const RESULT_VISIBILITY_OPTIONS: Array<{ value: SessionModeResultsVisibility; label: string }> = [
  { value: 'private_admin', label: 'Admins only' },
  { value: 'participant_aggregate', label: 'Participants can see the combined summary' },
  { value: 'session_member_aggregate', label: 'Session members can see the combined summary' },
  { value: 'public_redacted_snapshot', label: 'Anyone can see a redacted summary' },
  { value: 'public_full_if_storage_public', label: 'Anyone can see the public stored results' },
];

const EXPORT_SCOPE_OPTIONS: Array<{ value: SessionModeExportScope; label: string }> = [
  { value: 'admin_raw', label: 'Admins can export raw results' },
  { value: 'all_session', label: 'Export the complete session' },
  { value: 'selected_surfaces', label: 'Export selected channels only' },
  { value: 'encrypted_envelopes_only', label: 'Export encrypted records only' },
];

const SURFACE_LABELS: Array<{ value: SessionModeSurface; label: string; fixed?: boolean }> = [
  { value: 'web', label: 'Website', fixed: true },
  { value: 'telegram', label: 'Telegram' },
  { value: 'miniApp', label: 'Mini App' },
  { value: 'agentHttp', label: 'Agent Session Wrapped' },
];

const DEFAULT_CUSTOM_ACCESS_CONDITIONS: SessionModeAccessConditionDocument = {
  match: 'any',
  conditions: [
    { kind: 'worker_role', role: 'admin' },
    { kind: 'agent_grant_scope', scope: 'storage' },
  ],
};

const isProfile = (value: unknown): value is SessionModeProfile =>
  !!value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  (value as { profileVersion?: unknown }).profileVersion === 1;

const cloneProfile = (profile: SessionModeProfile): SessionModeProfile => JSON.parse(JSON.stringify(profile));

const cloneAccessConditions = (value?: SessionModeAccessConditionDocument): SessionModeAccessConditionDocument =>
  value ? JSON.parse(JSON.stringify(value)) : { match: 'any', conditions: [] };

const defaultSbtChainId = (profile: SessionModeProfile, registryChainId: number | null): number =>
  Number(profile.evm.registryChainId || registryChainId || 11155420) || 11155420;

const chainName = (chainId: number): string => {
  if (chainId === 11155420) return 'OP Sepolia';
  if (chainId === 84532) return 'Base Sepolia';
  return `Chain ${chainId}`;
};

const setWorkerEnvelopeCondition = (profile: SessionModeProfile, conditions?: SessionModeAccessConditionDocument) => {
  profile.encryption = { ...profile.encryption };
  if (conditions?.conditions.length) profile.encryption.accessConditions = conditions;
  else delete profile.encryption.accessConditions;
};

const SessionModeProfileSections = ({
  section,
  registryChainId = null,
  value = null,
  onChange,
}: SessionModeProfileSectionsProps): React.ReactElement => {
  const profile = isProfile(value) ? value : null;
  const validation = useMemo(
    () => (profile ? validateSessionModeProfile(profile) : { valid: false, issues: [] }),
    [profile],
  );

  const updateProfile = (mutate: (draft: SessionModeProfile) => void) => {
    const base = profile
      ? cloneProfile(profile)
      : cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    base.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
    mutate(base);
    base.surfaces.web = true;
    const compiled = compileSessionModeProfile(base);
    onChange(base, { storageProfile: compiled.storageProfile });
  };

  if (!profile) {
    return (
      <div className={styles.modeSectionEmpty} role="status">
        Choose a hosting option before changing its settings.
      </div>
    );
  }

  if (section === 'worker') {
    return (
      <section className={styles.modeSection} aria-label="Participation channels">
        <div className={styles.modeSectionHeading}>
          <h3>Participation channels</h3>
          <p>The website is always available. Add only the channels this session needs.</p>
        </div>
        <div className={styles.modeCheckboxRow} role="group" aria-label="Session participation channels">
          {SURFACE_LABELS.map((surface) => (
            <Label key={surface.value} check className={styles.modeCheckboxLabel}>
              <Input
                type="checkbox"
                checked={profile.surfaces[surface.value]}
                disabled={surface.fixed}
                onChange={(event) =>
                  updateProfile((draft) => {
                    draft.surfaces[surface.value] = surface.fixed ? true : event.target.checked;
                    if (surface.value === 'telegram' && event.target.checked) draft.surfaces.miniApp = true;
                  })
                }
              />{' '}
              {surface.label}
            </Label>
          ))}
        </div>
        <p className={styles.helperText}>
          Agent Session Wrapped deploys an additional per-session Worker/Bridge. Telegram stays optional and is off by
          default.
        </p>
      </section>
    );
  }

  const selectedSurfaceFilter = new Set(profile.export.surfaceFilter || []);

  if (section === 'publish') {
    return (
      <section className={styles.modeSection} aria-label="Export settings">
        <div className={styles.modeSectionHeading}>
          <h3>Export policy</h3>
          <p>Choose what session administrators can download after deployment.</p>
        </div>
        <Label className={styles.modeFieldLabel} htmlFor="ce-new-export-policy">
          Export policy
        </Label>
        <Input
          id="ce-new-export-policy"
          type="select"
          value={profile.export.scope}
          onChange={(event) =>
            updateProfile((draft) => {
              draft.export.scope = event.target.value as SessionModeExportScope;
              if (draft.export.scope !== 'selected_surfaces') delete draft.export.surfaceFilter;
              else if (!draft.export.surfaceFilter?.length) draft.export.surfaceFilter = ['web'];
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
          <div className={styles.modeCheckboxRow} role="group" aria-label="Channels included in exports">
            {SURFACE_LABELS.map((surface) => (
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
        {!validation.valid ? (
          <div className={styles.modeValidationList} role="status">
            {validation.issues.map((issue) => (
              <div key={`${issue.path}:${issue.code}`}>{issue.message}</div>
            ))}
          </div>
        ) : null}
      </section>
    );
  }

  const hasRegistryChain = !!(profile.evm.registryChainId || registryChainId);
  const litDisabledReason = hasRegistryChain ? '' : 'Choose a registry network before enabling Lit.';
  const workerEnvelopeDisabledReason =
    profile.storage.backend === 'cloudflare'
      ? ''
      : 'Cloudflare encryption requires Cloudflare storage. Choose Lit to encrypt Arweave data.';
  const useSessionAccessRules = !profile.encryption.accessConditions?.conditions.length;

  return (
    <section className={styles.modeSection} aria-label="Hosting and privacy settings">
      <div className={styles.modeSectionHeading}>
        <h3>Hosting & privacy</h3>
        <p>These defaults come from the hosting choice above. Change only what this session needs.</p>
      </div>

      <FormRow label="Data storage">
        <SegmentedButtons
          ariaLabel="Data storage"
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
                if (draft.encryption.mode === 'worker_envelope') draft.encryption = { mode: 'none' };
                if (draft.export.scope === 'encrypted_envelopes_only' && draft.encryption.mode === 'none') {
                  draft.export.scope = 'admin_raw';
                }
              }
            })
          }
        />
      </FormRow>

      <FormRow label="Session encryption">
        <SegmentedButtons
          ariaLabel="Session encryption"
          options={[
            { value: 'none', label: 'None' },
            { value: 'lit', label: 'Lit', disabled: !!litDisabledReason, title: litDisabledReason },
            {
              value: 'worker_envelope',
              label: 'Cloudflare',
              disabled: !!workerEnvelopeDisabledReason,
              title: workerEnvelopeDisabledReason,
            },
          ]}
          value={profile.encryption.mode}
          onChange={(mode) =>
            updateProfile((draft) => {
              draft.encryption = { mode: mode as SessionModeEncryptionMode };
              if (mode === 'lit') draft.evm.registryChainId = draft.evm.registryChainId || registryChainId || 11155420;
              if (mode === 'worker_envelope') draft.encryption.keyProvider = 'worker_secret';
              if (mode === 'none' && draft.export.scope === 'encrypted_envelopes_only') {
                draft.export.scope = 'admin_raw';
              }
            })
          }
          dataTestIdPrefix="ce-new-encryption"
        />
        {litDisabledReason ? <div className={styles.helperText}>{litDisabledReason}</div> : null}
        {workerEnvelopeDisabledReason ? <div className={styles.helperText}>{workerEnvelopeDisabledReason}</div> : null}
        {profile.encryption.mode === 'worker_envelope' ? (
          <div className={styles.modeAdvancedNested}>
            <ul className={styles.modeSummaryList}>
              <li>Data is encrypted before Cloudflare stores it.</li>
              <li>The session worker decrypts it only after checking access.</li>
            </ul>
            <Label check className={styles.modeCheckboxLabel}>
              <Input
                type="checkbox"
                checked={useSessionAccessRules}
                onChange={(event) =>
                  updateProfile((draft) => {
                    if (event.target.checked) {
                      setWorkerEnvelopeCondition(draft);
                      return;
                    }
                    const configured = cloneAccessConditions(draft.storage.payloadAccessControl?.accessConditions);
                    setWorkerEnvelopeCondition(
                      draft,
                      configured.conditions.length
                        ? configured
                        : cloneAccessConditions(DEFAULT_CUSTOM_ACCESS_CONDITIONS),
                    );
                  })
                }
              />{' '}
              Use session access rules for decryption
            </Label>
            {useSessionAccessRules ? (
              <p className={styles.helperText}>
                The worker uses this session&apos;s access policy; no separate decryption rules are added.
              </p>
            ) : (
              <WorkerEnvelopeOptions
                profile={profile}
                registryChainId={registryChainId || null}
                updateProfile={updateProfile}
              />
            )}
          </div>
        ) : null}
      </FormRow>

      <FormRow label="Results">
        <Label className={styles.modeFieldLabel} htmlFor="ce-new-results-visibility">
          Who can see results
        </Label>
        <Input
          id="ce-new-results-visibility"
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
              disabled={option.value === 'public_full_if_storage_public' && profile.storage.backend === 'cloudflare'}
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
            Hide small groups in summaries
          </Label>
          {profile.results.exposure?.anonymizedGroupsEnabled ? (
            <Label className={styles.modeNumberLabel}>
              Minimum group size
              <Input
                type="number"
                min={2}
                value={profile.results.exposure?.minGroupSize || 2}
                onChange={(event) =>
                  updateProfile((draft) => {
                    draft.results.exposure = {
                      aggregateResultsEnabled: draft.results.exposure?.aggregateResultsEnabled !== false,
                      anonymizedGroupsEnabled: true,
                      minGroupSize: Math.max(2, Number(event.target.value || 2) || 2),
                    };
                  })
                }
              />
            </Label>
          ) : null}
        </div>
      </FormRow>
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

const RULE_LABELS: Record<SessionModeAccessConditionDocument['conditions'][number]['kind'], string> = {
  worker_role: 'Session role',
  sbt_onchain: 'SBT holders',
  agent_grant_scope: 'Authorized agents',
};

const WorkerEnvelopeOptions = ({
  profile,
  registryChainId,
  updateProfile,
}: WorkerEnvelopeOptionsProps): React.ReactElement => {
  const conditions = cloneAccessConditions(profile.encryption.accessConditions);

  const commitConditions = (next: SessionModeAccessConditionDocument) => {
    updateProfile((draft) => setWorkerEnvelopeCondition(draft, next));
  };

  const addCondition = (kind: SessionModeAccessConditionDocument['conditions'][number]['kind']) => {
    const next = cloneAccessConditions(profile.encryption.accessConditions);
    if (kind === 'worker_role') next.conditions.push({ kind, role: 'admin' });
    if (kind === 'agent_grant_scope') next.conditions.push({ kind, scope: 'storage' });
    if (kind === 'sbt_onchain') {
      const chainId = defaultSbtChainId(profile, registryChainId);
      next.conditions.push({ kind, chainId, contract: '', anyOrAll: 'any' });
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
    <div className={styles.modeRuleBuilder}>
      <Label className={styles.modeFieldLabel} htmlFor="ce-new-envelope-condition-match">
        Grant access when
      </Label>
      <Input
        id="ce-new-envelope-condition-match"
        type="select"
        value={conditions.match}
        onChange={(event) => {
          const next = cloneAccessConditions(profile.encryption.accessConditions);
          next.match = event.target.value === 'all' ? 'all' : 'any';
          commitConditions(next);
        }}
      >
        <option value="any">Any rule matches</option>
        <option value="all">All rules match</option>
      </Input>
      <div className={styles.inlineToggleRow} aria-label="Add a decryption rule">
        <Button
          type="button"
          size="sm"
          onClick={() => addCondition('worker_role')}
          data-testid="ce-new-envelope-add-worker-role"
        >
          Add session role
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() => addCondition('sbt_onchain')}
          data-testid="ce-new-envelope-add-sbt-onchain"
        >
          Add SBT holders
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() => addCondition('agent_grant_scope')}
          data-testid="ce-new-envelope-add-agent-scope"
        >
          Add authorized agents
        </Button>
      </div>
      {conditions.conditions.map((condition, index) => (
        <div key={`${condition.kind}-${index}`} className={styles.modeRuleCard}>
          <div className={styles.modeRuleHeader}>
            <strong>{RULE_LABELS[condition.kind]}</strong>
            <button
              type="button"
              className={styles.modeRuleRemove}
              aria-label={`Remove ${RULE_LABELS[condition.kind]} rule`}
              onClick={() => {
                const next = cloneAccessConditions(profile.encryption.accessConditions);
                next.conditions.splice(index, 1);
                commitConditions(next);
              }}
            >
              <FontAwesomeIcon icon={faTrash} />
            </button>
          </div>
          {condition.kind === 'worker_role' ? (
            <Input
              aria-label="Session role"
              value={condition.role}
              data-testid={`ce-new-envelope-worker-role-${index}`}
              onChange={(event) => updateCondition(index, () => ({ kind: 'worker_role', role: event.target.value }))}
            />
          ) : null}
          {condition.kind === 'agent_grant_scope' ? (
            <Input
              aria-label="Authorized agent scope"
              value={condition.scope}
              data-testid={`ce-new-envelope-agent-scope-${index}`}
              onChange={(event) =>
                updateCondition(index, () => ({ kind: 'agent_grant_scope', scope: event.target.value }))
              }
            />
          ) : null}
          {condition.kind === 'sbt_onchain' ? (
            <div className={styles.modeSbtRuleFields}>
              <Label className={styles.modeFieldLabel}>
                Network
                <Input
                  type="select"
                  aria-label="SBT network"
                  value={condition.chainId || ''}
                  data-testid={`ce-new-envelope-sbt-chain-${index}`}
                  onChange={(event) =>
                    updateCondition(index, () => ({ ...condition, chainId: Number(event.target.value || 0) || 0 }))
                  }
                >
                  {Array.from(new Set([condition.chainId, 11155420, 84532]))
                    .filter((chainId) => Number(chainId) > 0)
                    .map((chainId) => (
                      <option key={chainId} value={chainId}>
                        {chainName(chainId)}
                      </option>
                    ))}
                </Input>
              </Label>
              <Label className={styles.modeFieldLabel}>
                SBT contract
                <Input
                  aria-label="SBT contract address"
                  value={condition.contract}
                  placeholder="0x..."
                  data-testid={`ce-new-envelope-sbt-contract-${index}`}
                  onChange={(event) => updateCondition(index, () => ({ ...condition, contract: event.target.value }))}
                />
              </Label>
              <Label className={styles.modeFieldLabel}>
                Requirement
                <Input
                  type="select"
                  aria-label="SBT requirement"
                  value={condition.anyOrAll}
                  data-testid={`ce-new-envelope-sbt-match-${index}`}
                  onChange={(event) =>
                    updateCondition(index, () => ({
                      ...condition,
                      anyOrAll: event.target.value === 'all' ? 'all' : 'any',
                    }))
                  }
                >
                  <option value="any">Any SBT from this contract</option>
                  <option value="all">All required SBTs from this contract</option>
                </Input>
              </Label>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
};

export default SessionModeProfileSections;
