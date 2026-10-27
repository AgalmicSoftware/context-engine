import React, { useEffect, useMemo, useState } from 'react';
import { Button, Input, Label } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash } from '@fortawesome/free-solid-svg-icons';

import styles from './SessionWizard.module.scss';
import type { AnyRecord } from '../shellTypes';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import type { SessionWizardTooltipRenderOptions } from './SessionWizardInfoTooltip';
import {
  SESSION_MODE_PRESET_IDS,
  cloneSessionModePreset,
  compileSessionModeProfile,
  normalizeSessionModeProfileForWrite,
  validateSessionModeProfile,
  type SessionModeAccessConditionDocument,
  type SessionModeEncryptionMode,
  type SessionModeExportScope,
  type SessionModeProfile,
  type SessionModeProfileValidationIssue,
  type SessionModeResultsVisibility,
  type SessionModeSurface,
} from '../../utilities/session/sessionModeProfile';

export type SessionModeProfileSection = 'privacy' | 'worker' | 'publish';

export type SessionModeProfileSectionsProps = {
  section: SessionModeProfileSection;
  registryChainId?: number | null;
  value?: unknown;
  onChange: (profile: SessionModeProfile, compiled: { storageProfile: AnyRecord }) => void;
  renderInfoTooltip?: (options: SessionWizardTooltipRenderOptions) => React.ReactNode;
};

const CLOUDFLARE_STORAGE_TOOLTIP =
  'Cloudflare storage is mutable and not permanent. A future attestation layer could provide verifiable proofs of stored revisions, but it would not make the underlying storage permanent.';
const ARWEAVE_STORAGE_TOOLTIP =
  'Arweave provides permanent storage. Session data can be encrypted before upload, so permanent storage does not require publishing readable content.';
const NO_ENCRYPTION_TOOLTIP =
  'This setting adds no encryption layer: payload bytes are stored as provided. Access and visibility controls do not turn unencrypted payloads into encrypted data.';
const LIT_ENCRYPTION_TOOLTIP =
  'Lit encrypts data before upload, and a Lit Action releases the key only after on-chain access conditions (SBT ownership) pass. The key passes through the session worker, so the worker operator and Lit account administrators remain trusted. A scoped Lit usage key alone cannot authorize decryption; this is not end-to-end encryption. It requires a registry network, an RPC connection, and Lit credentials.';
const CLOUDFLARE_ENCRYPTION_TOOLTIP =
  'Cloudflare encryption protects data before storage with a key held by the session worker. The worker checks access before decrypting, but the operator and Cloudflare runtime can decrypt, so this is not end-to-end encryption.';
const DEFAULT_CLOUDFLARE_ACCESS_RULES_TOOLTIP =
  'Checked: use the default rules, allowing session admins and accounts with storage permission, including participants and agents, to access encrypted data. Unchecked: customize access below using session roles, authorized accounts, or SBT holders, and choose whether any or all rules must match.';
const HIDE_SMALL_GROUPS_TOOLTIP =
  'Checked: show anonymized group summaries only when a group meets the minimum size (at least 2 people). A minimum of 5 hides groups of 1–4. Unchecked: disable anonymized group summaries. Groups and responses are kept.';
const EXPORT_POLICY_TOOLTIP =
  'This choice is saved as an export preference. The current exporter does not enforce it; downloads follow the existing session access permissions. Exporting selected channels is not available yet.';

const RESULT_VISIBILITY_OPTIONS: Array<{ value: SessionModeResultsVisibility; label: string; available?: boolean }> = [
  { value: 'private_admin', label: 'Admins only (not available yet)', available: false },
  { value: 'participant_aggregate', label: 'Participants can read their own Cloudflare responses' },
  { value: 'session_member_aggregate', label: 'Session members can read their own Cloudflare responses' },
  {
    value: 'public_redacted_snapshot',
    label: 'Anyone can see a redacted summary (not available yet)',
    available: false,
  },
  { value: 'public_full_if_storage_public', label: 'Anyone can see the public stored results' },
];

const EXPORT_SCOPE_OPTIONS: Array<{ value: SessionModeExportScope; label: string; available?: boolean }> = [
  { value: 'admin_raw', label: 'Raw results (saved preference)' },
  { value: 'all_session', label: 'Complete session (saved preference)' },
  {
    value: 'selected_surfaces',
    label: 'Admins can export selected channels only (not available yet)',
    available: false,
  },
  { value: 'encrypted_envelopes_only', label: 'Encrypted records (saved preference)' },
];

const SURFACE_LABELS: Array<{
  value: SessionModeSurface;
  label: string;
  fixed?: boolean;
  tooltip: string;
  tooltipId: string;
}> = [
  {
    value: 'web',
    label: 'Website',
    fixed: true,
    tooltip: 'Use the session in a web browser, subject to its access rules. This channel is always enabled.',
    tooltipId: E2E_TESTIDS.WIZARD_SURFACE_WEB_INFO,
  },
  {
    value: 'agentHttp',
    label: 'Agents (HTTP API)',
    tooltip:
      'Let authorized agents use this session’s HTTP API through a scoped credential. Agent HTTP and Session Wrapped run in this session’s Worker. Session access rules and agent permissions still apply.',
    tooltipId: E2E_TESTIDS.WIZARD_SURFACE_AGENT_HTTP_INFO,
  },
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
  else {
    delete profile.encryption.accessConditions;
    profile.storage.payloadAccessControl = defaultCloudflarePayloadAccessFor(profile);
  }
};

const effectiveEnvelopeConditions = (profile: SessionModeProfile): SessionModeAccessConditionDocument =>
  cloneAccessConditions(profile.encryption.accessConditions || profile.storage.payloadAccessControl?.accessConditions);

const hasSbtOnchainCondition = (profile: SessionModeProfile): boolean =>
  [profile.encryption.accessConditions, profile.storage.payloadAccessControl?.accessConditions].some(
    (document) =>
      Array.isArray(document?.conditions) && document.conditions.some((condition) => condition.kind === 'sbt_onchain'),
  );

const PUBLIC_RESULTS: SessionModeResultsVisibility = 'public_full_if_storage_public';

const cloudflarePayloadEncryptionFor = (
  profile: SessionModeProfile,
): NonNullable<SessionModeProfile['storage']['payloadAccessControl']>['encryption'] =>
  profile.encryption.mode === 'worker_envelope'
    ? 'worker_envelope'
    : profile.encryption.mode === 'lit'
      ? 'lit'
      : 'none';

const defaultCloudflarePayloadAccessFor = (
  profile: SessionModeProfile,
): NonNullable<SessionModeProfile['storage']['payloadAccessControl']> => ({
  ...defaultCloudflarePayloadAccessControl(),
  encryption: cloudflarePayloadEncryptionFor(profile),
});

// Public results are offered whenever answers are stored unencrypted. On
// Cloudflare, choosing them also makes the stored payloads public-read.
const supportsWizardPublicResults = (profile: SessionModeProfile): boolean => profile.encryption.mode === 'none';

const hasPublicReadStorage = (profile: SessionModeProfile): boolean =>
  profile.storage.backend === 'arweave' ||
  (profile.storage.payloadAccessControl?.gate === 'none' && !profile.storage.payloadAccessControl.accessConditions);

const coerceUnavailablePublicResults = (profile: SessionModeProfile, previous: SessionModeProfile | null): void => {
  const leavingPublic =
    profile.results.visibility === PUBLIC_RESULTS &&
    (!supportsWizardPublicResults(profile) || !hasPublicReadStorage(profile));
  if (leavingPublic) profile.results.visibility = 'participant_aggregate';
  // Public-read Cloudflare storage exists only to back public results. A Lit
  // draft that was already Lit also compiles to gate none and keeps its own
  // rules, unless public results were just turned off.
  const access = profile.storage.payloadAccessControl;
  const keepsLitRules = profile.encryption.mode === 'lit' && previous?.encryption.mode === 'lit';
  if (
    profile.storage.backend === 'cloudflare' &&
    access?.gate === 'none' &&
    profile.results.visibility !== PUBLIC_RESULTS &&
    (leavingPublic || !keepsLitRules)
  ) {
    profile.storage.payloadAccessControl = {
      ...defaultCloudflarePayloadAccessFor(profile),
      ...(access.accessConditions ? { accessConditions: access.accessConditions } : {}),
    };
  }
};

// Hosted sessions keep a registry chain only for Lit or SBT rules.
const clearUnusedRegistryChain = (profile: SessionModeProfile): void => {
  if (
    profile.authority.mode === 'worker_canonical' &&
    profile.encryption.mode !== 'lit' &&
    !hasSbtOnchainCondition(profile)
  ) {
    profile.evm.registryChainId = null;
  }
};

const setResultsVisibility = (profile: SessionModeProfile, visibility: SessionModeResultsVisibility): void => {
  profile.results.visibility = visibility;
  if (
    visibility === PUBLIC_RESULTS &&
    profile.storage.backend === 'cloudflare' &&
    supportsWizardPublicResults(profile)
  ) {
    profile.storage.payloadAccessControl = { gate: 'none', encryption: 'none' };
  }
};

const SessionModeProfileSections = ({
  section,
  registryChainId = null,
  value = null,
  onChange,
  renderInfoTooltip,
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
      ? normalizeSessionModeProfileForWrite(profile)
      : cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    base.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
    mutate(base);
    base.surfaces.web = true;
    coerceUnavailablePublicResults(base, profile);
    clearUnusedRegistryChain(base);
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
    return (
      <section className={styles.modeSection} aria-label="Participation channels">
        <div className={styles.modeSectionHeading}>
          <h3>Participation channels</h3>
          <p>The website is always available. Add only the channels this session needs.</p>
        </div>
        <div className={styles.modeCheckboxRow} role="group" aria-label="Session participation channels">
          {SURFACE_LABELS.map((surface) => (
            <div key={surface.value} className={`${styles.modeCheckboxWithTooltip} ${styles.modeChannelOption}`}>
              <Label check className={styles.modeCheckboxLabel}>
                <Input
                  type="checkbox"
                  checked={profile.surfaces[surface.value]}
                  disabled={surface.fixed}
                  aria-describedby={surface.value === 'agentHttp' ? 'ce-wizard-agent-access-status' : undefined}
                  onChange={(event) =>
                    updateProfile((draft) => {
                      draft.surfaces[surface.value] = surface.fixed ? true : event.target.checked;
                    })
                  }
                />
                <span className={styles.modeCheckboxText}>{surface.label}</span>
              </Label>
              {renderInfoTooltip
                ? renderInfoTooltip({
                    id: surface.tooltipId,
                    testId: surface.tooltipId,
                    content: surface.tooltip,
                    ariaLabel: `About ${surface.label}`,
                    placement: 'top',
                  })
                : null}
            </div>
          ))}
        </div>
        <p id="ce-wizard-agent-access-status" role="status" className={styles.helperText}>
          <strong>Agent API access: {profile.surfaces.agentHttp ? 'On after deployment' : 'Off'}.</strong>{' '}
          {profile.surfaces.agentHttp
            ? 'Authorized agents can use this session through its HTTP API once the Session Worker’s agent capabilities are configured and verified.'
            : 'Enable Agents (HTTP API) for direct access by authorized agents.'}{' '}
          Access requires a scoped agent credential.
        </p>
        <ValidationIssues issues={sectionValidationIssues} />
      </section>
    );
  }

  if (section === 'publish') {
    return (
      <section className={styles.modeSection} aria-label="Export settings">
        <div className={styles.modeSectionHeading}>
          <h3>Export policy</h3>
          <p>
            Saved as a preference. The current exporter does not enforce this selection; downloads follow existing
            session access permissions.
          </p>
        </div>
        <div className={styles.modeCheckboxWithTooltip}>
          <Label className={styles.modeFieldLabel} htmlFor="ce-new-export-policy">
            Export policy
          </Label>
          {renderInfoTooltip
            ? renderInfoTooltip({
                id: 'ce-new-export-policy-info',
                content: EXPORT_POLICY_TOOLTIP,
                ariaLabel: 'About export policy',
                testId: 'ce-new-export-policy-info',
                placement: 'top',
              })
            : null}
        </div>
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
  const useDefaultCloudflareAccessRules =
    !profile.encryption.accessConditions?.conditions.length &&
    JSON.stringify(effectiveEnvelopeConditions(profile)) ===
      JSON.stringify(cloneAccessConditions(defaultCloudflarePayloadAccessControl().accessConditions));

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
            {
              value: 'cloudflare',
              label: 'Cloudflare',
              tooltip: {
                id: 'ce-new-storage-cloudflare-info',
                content: CLOUDFLARE_STORAGE_TOOLTIP,
                testId: E2E_TESTIDS.WIZARD_STORAGE_CLOUDFLARE_INFO,
                ariaLabel: 'About Cloudflare storage',
              },
            },
            {
              value: 'arweave',
              label: 'Arweave',
              tooltip: {
                id: 'ce-new-storage-arweave-info',
                content: ARWEAVE_STORAGE_TOOLTIP,
                testId: E2E_TESTIDS.WIZARD_STORAGE_ARWEAVE_INFO,
                ariaLabel: 'About Arweave storage',
              },
            },
          ]}
          value={profile.storage.backend}
          renderInfoTooltip={renderInfoTooltip}
          onChange={(backend) => {
            // Re-selecting the current storage keeps its settings.
            if (backend === profile.storage.backend) return;
            updateProfile((draft) => {
              draft.storage.backend = backend as SessionModeProfile['storage']['backend'];
              if (backend === 'cloudflare') {
                draft.authority.mode = 'worker_canonical';
                draft.identity = { default: 'passkey', enabled: ['passkey'] };
                draft.authorization = { mechanisms: ['worker_roles'] };
                draft.storage.payloadAccessControl = defaultCloudflarePayloadAccessFor(draft);
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
            });
          }}
        />
      </FormRow>

      <FormRow label="Session encryption">
        <SegmentedButtons
          ariaLabel="Session encryption"
          options={[
            {
              value: 'none',
              label: 'None',
              tooltip: {
                id: 'ce-new-encryption-none-info',
                content: NO_ENCRYPTION_TOOLTIP,
                testId: E2E_TESTIDS.WIZARD_ENCRYPTION_NONE_INFO,
                ariaLabel: 'About no encryption',
              },
            },
            {
              value: 'lit',
              label: 'Lit',
              disabled: !!litDisabledReason,
              title: litDisabledReason,
              tooltip: {
                id: 'ce-new-encryption-lit-info',
                content: LIT_ENCRYPTION_TOOLTIP,
                testId: E2E_TESTIDS.WIZARD_ENCRYPTION_LIT_INFO,
                ariaLabel: 'About Lit encryption',
              },
            },
            {
              value: 'worker_envelope',
              label: 'Cloudflare',
              disabled: !!workerEnvelopeDisabledReason,
              title: workerEnvelopeDisabledReason,
              describedBy: workerEnvelopeDisabledReason ? WORKER_ENVELOPE_DISABLED_HELP_ID : undefined,
              tooltip: {
                id: 'ce-new-encryption-cloudflare-info',
                content: CLOUDFLARE_ENCRYPTION_TOOLTIP,
                testId: E2E_TESTIDS.WIZARD_ENCRYPTION_CLOUDFLARE_INFO,
                ariaLabel: 'About Cloudflare encryption',
              },
            },
          ]}
          value={profile.encryption.mode}
          renderInfoTooltip={renderInfoTooltip}
          onChange={(mode) => {
            // Re-selecting the current encryption keeps its rules.
            if (mode === profile.encryption.mode) return;
            updateProfile((draft) => {
              draft.encryption = { mode: mode as SessionModeEncryptionMode };
              if (mode === 'lit') draft.evm.registryChainId = draft.evm.registryChainId || registryChainId || 11155420;
              if (mode === 'worker_envelope') draft.encryption.keyProvider = 'worker_secret';
              if (draft.storage.backend === 'cloudflare' && draft.storage.payloadAccessControl) {
                draft.storage.payloadAccessControl.encryption = cloudflarePayloadEncryptionFor(draft);
              }
              if (mode === 'none' && draft.export.scope === 'encrypted_envelopes_only') {
                draft.export.scope = 'admin_raw';
              }
            });
          }}
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
            <div className={styles.modeCheckboxWithTooltip}>
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
                />
                <span className={styles.modeCheckboxText}>Use default Cloudflare access rules</span>
              </Label>
              {renderInfoTooltip
                ? renderInfoTooltip({
                    id: 'ce-new-default-cloudflare-access-rules-info',
                    content: DEFAULT_CLOUDFLARE_ACCESS_RULES_TOOLTIP,
                    ariaLabel: 'About default Cloudflare access rules',
                    testId: 'ce-new-default-cloudflare-access-rules-info',
                  })
                : null}
            </div>
            {useDefaultCloudflareAccessRules ? (
              <p className={styles.helperText}>
                The worker grants storage access to configured admins and accounts with storage permission, including
                participants and agents.
              </p>
            ) : (
              <>
                <div className={styles.modeValidationList} data-testid="ce-new-hybrid-requirements">
                  Advanced hybrid access can add on-chain SBT checks. It requires an RPC URL; creating an SBT also
                  requires a wallet and testnet gas. Lit encryption additionally requires a Lit credential and the
                  Advanced manual bootstrap flow.
                </div>
                <p className={styles.helperText}>
                  These rules also control answer uploads. Participants who match no rule cannot submit answers.
                </p>
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
              setResultsVisibility(draft, event.target.value as SessionModeResultsVisibility);
            })
          }
        >
          {RESULT_VISIBILITY_OPTIONS.map((option) => (
            <option
              key={option.value}
              value={option.value}
              disabled={
                option.available === false || (option.value === PUBLIC_RESULTS && !supportsWizardPublicResults(profile))
              }
            >
              {option.label}
            </option>
          ))}
        </Input>
        {profile.results.visibility === PUBLIC_RESULTS && profile.storage.backend === 'cloudflare' ? (
          <p className={styles.helperText}>
            Answers, comments, and groups are stored unencrypted, and anyone can read them without signing in.
          </p>
        ) : null}
        {profile.results.visibility !== PUBLIC_RESULTS && profile.storage.backend === 'cloudflare' ? (
          <p className={styles.helperText}>
            Participants can read their own responses. Admins and authorized agents can access session-wide responses.
            Participant summaries are not available yet.
          </p>
        ) : null}
        {profile.storage.backend === 'arweave' ? (
          <p className={styles.helperText}>
            Unencrypted Arweave data is public. For encrypted data, Lit access rules control who can decrypt it.
          </p>
        ) : null}
        <div className={styles.modeCheckboxRow}>
          <div className={styles.modeCheckboxWithTooltip}>
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
              />
              <span className={styles.modeCheckboxText}>Hide small groups in summaries</span>
            </Label>
            {renderInfoTooltip
              ? renderInfoTooltip({
                  id: 'ce-new-hide-small-groups-info',
                  content: HIDE_SMALL_GROUPS_TOOLTIP,
                  ariaLabel: 'About hiding small groups in summaries',
                  testId: 'ce-new-hide-small-groups-info',
                })
              : null}
          </div>
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
  options: Array<{
    value: string;
    label: string;
    disabled?: boolean;
    title?: string;
    describedBy?: string;
    tooltip?: SessionWizardTooltipRenderOptions;
  }>;
  value: string;
  onChange: (value: string) => void;
  dataTestIdPrefix?: string;
  renderInfoTooltip?: SessionModeProfileSectionsProps['renderInfoTooltip'];
};

const SegmentedButtons = ({
  ariaLabel,
  options,
  value,
  onChange,
  dataTestIdPrefix = '',
  renderInfoTooltip,
}: SegmentedButtonsProps): React.ReactElement => {
  const enabledOptions = options.filter((option) => !option.disabled);
  const selectedEnabledIndex = enabledOptions.findIndex((option) => option.value === value);

  return (
    <div className={styles.inlineToggleRow} role="radiogroup" aria-label={ariaLabel}>
      {options.map((option) => {
        const enabledIndex = enabledOptions.findIndex((entry) => entry.value === option.value);
        const isSelected = value === option.value;
        return (
          <div key={option.value} className={styles.modeSegmentedOption}>
            <Button
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
                const enabledRadios = event.currentTarget
                  .closest('[role="radiogroup"]')
                  ?.querySelectorAll<HTMLButtonElement>('[role="radio"]:not(:disabled)');
                enabledRadios?.[nextIndex]?.focus();
                onChange(nextOption.value);
              }}
            >
              {option.label}
            </Button>
            {option.tooltip && renderInfoTooltip ? renderInfoTooltip(option.tooltip) : null}
          </div>
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
  agent_grant_scope: 'Authorized accounts',
};

const WorkerEnvelopeOptions = ({
  profile,
  registryChainId,
  updateProfile,
}: WorkerEnvelopeOptionsProps): React.ReactElement => {
  const conditions = effectiveEnvelopeConditions(profile);

  const commitConditions = (next: SessionModeAccessConditionDocument) => {
    updateProfile((draft) => setWorkerEnvelopeCondition(draft, next));
  };

  const addCondition = (kind: SessionModeAccessConditionDocument['conditions'][number]['kind']) => {
    const next = effectiveEnvelopeConditions(profile);
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
    const next = effectiveEnvelopeConditions(profile);
    const current = next.conditions[index];
    if (!current) return;
    next.conditions[index] = mutate(current);
    commitConditions(next);
  };

  const updateSbtConditionChain = (chainId: number) => {
    if (!Number.isSafeInteger(chainId) || chainId <= 0) return;
    const next = effectiveEnvelopeConditions(profile);
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
          const next = effectiveEnvelopeConditions(profile);
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
          Add authorized accounts
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
              data-ce-control-appearance="frameless"
              onClick={() => {
                const next = effectiveEnvelopeConditions(profile);
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
                Session network
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
              <p className={styles.helperText}>
                Changing this network updates the session and every SBT rule. Check each contract address on the
                selected network.
              </p>
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
