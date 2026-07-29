import React, { useEffect, useMemo, useState } from 'react';
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
  type SessionModeProfileValidationIssue,
  type SessionModeResultsVisibility,
  type SessionModeSurface,
} from '../../utilities/session/sessionModeProfile';
import {
  DEFAULT_NEW_SESSION_GROUP_CREATION_POLICY,
  normalizeGroupCreationPolicy,
  GROUP_CREATION_POLICIES,
  type GroupCreationPolicy,
} from '../../utilities/session/groupCreationPolicy';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';

export type SessionModeProfileSection = 'privacy' | 'worker' | 'publish';

export type SessionModeProfileSectionsProps = {
  section: SessionModeProfileSection;
  registryChainId?: number | null;
  value?: unknown;
  onChange: (profile: SessionModeProfile, compiled: { storageProfile: AnyRecord }) => void;
  groupCreationPolicy?: unknown;
  onGroupCreationPolicyChange?: (policy: GroupCreationPolicy) => void;
};

const RESULT_VISIBILITY_OPTIONS: Array<{ value: SessionModeResultsVisibility; label: string; available?: boolean }> = [
  { value: 'private_admin', label: 'Admins only (not available yet)', available: false },
  { value: 'participant_aggregate', label: 'Participants can see the combined summary' },
  { value: 'session_member_aggregate', label: 'Session members can see the combined summary' },
  {
    value: 'public_redacted_snapshot',
    label: 'Anyone can see a redacted summary (not available yet)',
    available: false,
  },
  { value: 'public_full_if_storage_public', label: 'Anyone can see the public stored results' },
];

const EXPORT_SCOPE_OPTIONS: Array<{ value: SessionModeExportScope; label: string; available?: boolean }> = [
  { value: 'admin_raw', label: 'Admins can export raw results' },
  { value: 'all_session', label: 'Export the complete session' },
  { value: 'selected_surfaces', label: 'Export selected channels only (not available yet)', available: false },
  { value: 'encrypted_envelopes_only', label: 'Export encrypted records only' },
];

const SURFACE_LABELS: Array<{ value: SessionModeSurface; label: string; fixed?: boolean }> = [
  { value: 'web', label: 'Website', fixed: true },
  { value: 'telegram', label: 'Telegram' },
  { value: 'miniApp', label: 'Telegram Mini App' },
  { value: 'agentHttp', label: 'Agent Session Wrapped' },
];

const DEFAULT_CUSTOM_ACCESS_CONDITIONS: SessionModeAccessConditionDocument = {
  match: 'any',
  conditions: [
    { kind: 'worker_role', role: 'admin' },
    { kind: 'agent_grant_scope', scope: 'storage' },
  ],
};

const WORKER_ENVELOPE_DISABLED_HELP_ID = 'ce-new-encryption-worker-envelope-help';

const defaultCloudflarePayloadAccessControl = (): NonNullable<SessionModeProfile['storage']['payloadAccessControl']> =>
  JSON.parse(
    JSON.stringify(cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE).storage.payloadAccessControl),
  );

const validationIssueBelongsToSection = (path: string, section: SessionModeProfileSection): boolean => {
  if (section === 'publish') return path.startsWith('export.');
  if (section === 'worker') return path.startsWith('surfaces.') || path.startsWith('identity.');
  return !path.startsWith('export.') && !path.startsWith('surfaces.') && !path.startsWith('identity.');
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

const hasSbtOnchainCondition = (profile: SessionModeProfile): boolean =>
  [profile.encryption.accessConditions, profile.storage.payloadAccessControl?.accessConditions].some(
    (document) =>
      Array.isArray(document?.conditions) && document.conditions.some((condition) => condition.kind === 'sbt_onchain'),
  );

const supportsWizardPublicResults = (profile: SessionModeProfile): boolean =>
  profile.storage.backend === 'arweave' && profile.encryption.mode === 'none';

const coerceUnavailablePublicResults = (profile: SessionModeProfile): void => {
  if (profile.results.visibility === 'public_full_if_storage_public' && !supportsWizardPublicResults(profile)) {
    profile.results.visibility = 'participant_aggregate';
  }
};

const SessionModeProfileSections = ({
  section,
  registryChainId = null,
  value = null,
  onChange,
  groupCreationPolicy: groupCreationPolicyValue = null,
  onGroupCreationPolicyChange,
}: SessionModeProfileSectionsProps): React.ReactElement => {
  const profile = isProfile(value) ? value : null;
  const validation = useMemo(
    () => (profile ? validateSessionModeProfile(profile) : { valid: false, issues: [] }),
    [profile],
  );
  const sectionValidationIssues = useMemo(
    () => validation.issues.filter((issue) => validationIssueBelongsToSection(issue.path, section)),
    [section, validation.issues],
  );

  const updateProfile = (mutate: (draft: SessionModeProfile) => void) => {
    const base = profile
      ? cloneProfile(profile)
      : cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    base.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
    mutate(base);
    base.surfaces.web = true;
    const compileSource = validateSessionModeProfile(base).valid
      ? base
      : profile && validateSessionModeProfile(profile).valid
        ? profile
        : cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    const compiled = compileSessionModeProfile(compileSource);
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
    const groupCreationPolicy = normalizeGroupCreationPolicy(
      groupCreationPolicyValue,
      DEFAULT_NEW_SESSION_GROUP_CREATION_POLICY,
    );
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
                    if (surface.value === 'telegram' && !event.target.checked) draft.surfaces.miniApp = false;
                    if (surface.value === 'miniApp' && event.target.checked) draft.surfaces.telegram = true;
                  })
                }
              />
              <span className={styles.modeCheckboxText}>{surface.label}</span>
            </Label>
          ))}
        </div>
        <p className={styles.helperText}>
          Agent Session Wrapped deploys an additional per-session Worker/Bridge. Telegram stays optional and is off by
          default.
        </p>
        <FormRow label="Who can create groups?">
          <div>
            <SegmentedButtons
              ariaLabel="Who can create groups?"
              options={[
                { value: GROUP_CREATION_POLICIES.ADMIN_ONLY, label: 'Admins only' },
                { value: GROUP_CREATION_POLICIES.PARTICIPANTS, label: 'All participants' },
              ]}
              value={groupCreationPolicy}
              onChange={(policy) => onGroupCreationPolicyChange?.(policy as GroupCreationPolicy)}
              dataTestIdPrefix={E2E_TESTIDS.WIZARD_GROUP_CREATION_POLICY}
            />
            <p className={styles.helperText}>
              {profile.authority.mode === 'worker_canonical'
                ? 'Participant-created groups are open to session participants. Updating groups and managing membership remain admin-only.'
                : 'This controls group creation in Context Engine. Public SBT factories remain callable directly on-chain, so “Admins only” cannot block independent contract deployments.'}
            </p>
          </div>
        </FormRow>
        <ValidationIssues issues={sectionValidationIssues} />
      </section>
    );
  }

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
              disabled={
                option.available === false ||
                (option.value === 'encrypted_envelopes_only' && profile.encryption.mode === 'none')
              }
            >
              {option.label}
            </option>
          ))}
        </Input>
        <ValidationIssues issues={sectionValidationIssues} />
      </section>
    );
  }

  const hasRegistryChain = !!(profile.evm.registryChainId || registryChainId);
  const litDisabledReason = hasRegistryChain ? '' : 'Choose a registry network before enabling Lit.';
  const workerEnvelopeDisabledReason =
    profile.storage.backend === 'cloudflare'
      ? ''
      : 'Cloudflare encryption requires Cloudflare storage. Choose Lit to encrypt Arweave data.';
  const useDefaultCloudflareAccessRules = !profile.encryption.accessConditions?.conditions.length;

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
                draft.identity = { default: 'passkey', enabled: ['passkey'] };
                draft.authorization = { mechanisms: ['worker_roles'] };
                const defaultAccess = defaultCloudflarePayloadAccessControl();
                draft.storage.payloadAccessControl = {
                  ...defaultAccess,
                  encryption:
                    draft.encryption.mode === 'worker_envelope'
                      ? 'worker_envelope'
                      : draft.encryption.mode === 'lit'
                        ? 'lit'
                        : 'none',
                };
                if (draft.encryption.mode !== 'lit' && !hasSbtOnchainCondition(draft)) {
                  draft.evm.registryChainId = null;
                }
              } else {
                draft.authority.mode = 'evm_registry_canonical';
                draft.identity = { default: 'wallet', enabled: ['wallet', 'passkey'] };
                draft.authorization = { mechanisms: ['sbt_onchain'] };
                draft.evm.registryChainId = draft.evm.registryChainId || registryChainId || 11155420;
                delete draft.storage.payloadAccessControl;
                if (draft.encryption.mode === 'worker_envelope') draft.encryption = { mode: 'none' };
                if (draft.export.scope === 'encrypted_envelopes_only' && draft.encryption.mode === 'none') {
                  draft.export.scope = 'admin_raw';
                }
              }
              coerceUnavailablePublicResults(draft);
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
              describedBy: workerEnvelopeDisabledReason ? WORKER_ENVELOPE_DISABLED_HELP_ID : undefined,
            },
          ]}
          value={profile.encryption.mode}
          onChange={(mode) =>
            updateProfile((draft) => {
              draft.encryption = { mode: mode as SessionModeEncryptionMode };
              if (mode === 'lit') draft.evm.registryChainId = draft.evm.registryChainId || registryChainId || 11155420;
              if (mode === 'worker_envelope') draft.encryption.keyProvider = 'worker_secret';
              if (draft.storage.backend === 'cloudflare' && draft.storage.payloadAccessControl) {
                draft.storage.payloadAccessControl.encryption =
                  mode === 'worker_envelope' ? 'worker_envelope' : mode === 'lit' ? 'lit' : 'none';
              }
              if (mode === 'none' && draft.export.scope === 'encrypted_envelopes_only') {
                draft.export.scope = 'admin_raw';
              }
              coerceUnavailablePublicResults(draft);
            })
          }
          dataTestIdPrefix="ce-new-encryption"
        />
        {litDisabledReason ? <div className={styles.helperText}>{litDisabledReason}</div> : null}
        {workerEnvelopeDisabledReason ? (
          <div id={WORKER_ENVELOPE_DISABLED_HELP_ID} className={styles.helperText}>
            {workerEnvelopeDisabledReason}
          </div>
        ) : null}
        {profile.encryption.mode === 'worker_envelope' ? (
          <div className={styles.modeAdvancedNested}>
            <ul className={styles.modeSummaryList}>
              <li>Data is encrypted before Cloudflare stores it.</li>
              <li>The session worker decrypts it only after checking access.</li>
            </ul>
            <Label check className={styles.modeCheckboxLabel}>
              <Input
                type="checkbox"
                checked={useDefaultCloudflareAccessRules}
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
              Use default Cloudflare access rules
            </Label>
            {useDefaultCloudflareAccessRules ? (
              <p className={styles.helperText}>
                The worker grants storage access to configured admins and agents granted the storage scope.
              </p>
            ) : (
              <>
                <div className={styles.modeValidationList} data-testid="ce-new-hybrid-requirements">
                  Advanced hybrid access can add on-chain SBT checks. It requires an RPC URL; creating an SBT also
                  requires a wallet and testnet gas. Lit encryption additionally requires a Lit credential and the
                  Advanced manual bootstrap flow.
                </div>
                <WorkerEnvelopeOptions
                  profile={profile}
                  registryChainId={registryChainId || null}
                  updateProfile={updateProfile}
                />
              </>
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
              disabled={
                option.available === false ||
                (option.value === 'public_full_if_storage_public' && !supportsWizardPublicResults(profile))
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
            Hide small groups in summaries
          </Label>
          {profile.results.exposure?.anonymizedGroupsEnabled ? (
            <MinGroupSizeInput profile={profile} updateProfile={updateProfile} />
          ) : null}
        </div>
      </FormRow>
      <ValidationIssues issues={sectionValidationIssues} />
    </section>
  );
};

const ValidationIssues = ({ issues }: { issues: SessionModeProfileValidationIssue[] }): React.ReactElement | null =>
  issues.length ? (
    <div className={styles.modeValidationList} role="status">
      {issues.map((issue) => (
        <div key={`${issue.path}:${issue.code}`}>{issue.message}</div>
      ))}
    </div>
  ) : null;

type MinGroupSizeInputProps = {
  profile: SessionModeProfile;
  updateProfile: (mutate: (draft: SessionModeProfile) => void) => void;
};

const MinGroupSizeInput = ({ profile, updateProfile }: MinGroupSizeInputProps): React.ReactElement => {
  const committedValue = Math.max(2, Math.floor(Number(profile.results.exposure?.minGroupSize || 2) || 2));
  const [inputValue, setInputValue] = useState(String(committedValue));

  useEffect(() => {
    setInputValue(String(committedValue));
  }, [committedValue]);

  const commitValue = (value: string) => {
    if (!/^\d+$/.test(value)) return;
    const nextValue = Math.floor(Number(value));
    if (!Number.isFinite(nextValue) || nextValue < 2) return;
    updateProfile((draft) => {
      draft.results.exposure = {
        aggregateResultsEnabled: draft.results.exposure?.aggregateResultsEnabled !== false,
        anonymizedGroupsEnabled: true,
        minGroupSize: nextValue,
      };
    });
  };

  return (
    <Label className={styles.modeNumberLabel}>
      Minimum group size
      <Input
        type="number"
        min={2}
        inputMode="numeric"
        value={inputValue}
        onChange={(event) => {
          setInputValue(event.target.value);
          commitValue(event.target.value);
        }}
        onBlur={() => setInputValue(String(committedValue))}
      />
    </Label>
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
  options: Array<{ value: string; label: string; disabled?: boolean; title?: string; describedBy?: string }>;
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
}: SegmentedButtonsProps): React.ReactElement => {
  const enabledOptions = options.filter((option) => !option.disabled);
  const selectedEnabledIndex = enabledOptions.findIndex((option) => option.value === value);

  return (
    <div className={styles.inlineToggleRow} role="radiogroup" aria-label={ariaLabel}>
      {options.map((option) => {
        const enabledIndex = enabledOptions.findIndex((entry) => entry.value === option.value);
        const isSelected = value === option.value;
        return (
          <Button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-describedby={option.describedBy}
            disabled={option.disabled}
            title={option.title}
            tabIndex={option.disabled || (!isSelected && !(selectedEnabledIndex < 0 && enabledIndex === 0)) ? -1 : 0}
            data-testid={dataTestIdPrefix ? `${dataTestIdPrefix}-${option.value}` : undefined}
            className={`${styles.workerModePill} ${isSelected ? styles.workerModePillActive : ''}`}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => {
              const direction = ['ArrowRight', 'ArrowDown'].includes(event.key)
                ? 1
                : ['ArrowLeft', 'ArrowUp'].includes(event.key)
                  ? -1
                  : 0;
              if (!direction || enabledIndex < 0 || enabledOptions.length < 2) return;
              event.preventDefault();
              const nextIndex = (enabledIndex + direction + enabledOptions.length) % enabledOptions.length;
              const nextOption = enabledOptions[nextIndex];
              const enabledRadios = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
                '[role="radio"]:not(:disabled)',
              );
              enabledRadios?.[nextIndex]?.focus();
              onChange(nextOption.value);
            }}
          >
            {option.label}
          </Button>
        );
      })}
    </div>
  );
};

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

  const updateSbtConditionChain = (chainId: number) => {
    if (!Number.isSafeInteger(chainId) || chainId <= 0) return;
    const next = cloneAccessConditions(profile.encryption.accessConditions);
    next.conditions = next.conditions.map((condition) =>
      condition.kind === 'sbt_onchain' ? { ...condition, chainId } : condition,
    );
    updateProfile((draft) => {
      draft.evm.registryChainId = chainId;
      const storedConditions = draft.storage.payloadAccessControl?.accessConditions;
      if (storedConditions) {
        storedConditions.conditions = storedConditions.conditions.map((condition) =>
          condition.kind === 'sbt_onchain' ? { ...condition, chainId } : condition,
        );
      }
      setWorkerEnvelopeCondition(draft, next);
    });
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
          Add SBT holders (Advanced hybrid)
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
                  onChange={(event) => updateSbtConditionChain(Number(event.target.value || 0) || 0)}
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
