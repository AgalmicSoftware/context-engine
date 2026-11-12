import React, { useEffect, useState } from 'react';
import { E2E_TESTIDS } from '../../../utilities/e2eTestIds.js';
import { Input } from 'reactstrap';

import ResultsAnalysisSettingsFields from '../ResultsAnalysisSettingsFields';
import {
  getBackgroundResultsAnalysisUnsupportedReason,
  supportsBackgroundResultsAnalysis,
} from '../resultsAnalysisSettingsSupport';
import { conflictsAt } from '../../../utilities/session/sessionModeRuleMessages';
import type {
  SessionModeAccessConditionDocument,
  SessionModeExportScope,
  SessionModeProfile,
  SessionModeResultsVisibility,
} from '../../../utilities/session/sessionModeProfile';
import { SetupCheck, SetupConflicts, SetupField, SetupSection, SetupToggle, setupHelpId } from './SetupPrimitives';
import {
  DEFAULT_REGISTRY_CHAIN_ID,
  MEMBER_RESULTS,
  PUBLIC_RESULTS,
  defaultCloudflarePayloadAccess,
  effectiveEnvelopeConditions,
  isSessionModeProfile,
  setEncryptionMode,
  setEnvelopeConditions,
  setHosting,
  setResultsVisibility,
  supportsMemberResults,
  supportsPublicResults,
  usesDefaultEnvelopeRules,
} from './sessionSetupProfile';
import { asRecord, text, type SetupProfileEditor, type SetupSectionProps } from './setupSectionTypes';
import styles from './SessionSetup.module.scss';

type PolicyProps = SetupSectionProps & {
  editProfile: SetupProfileEditor;
  registryChainId: number | null;
};

const profileOf = (draft: SetupSectionProps['draft']): SessionModeProfile | null =>
  isSessionModeProfile(draft.sessionModeProfile) ? draft.sessionModeProfile : null;

const VISIBILITY_LABELS: Partial<Record<SessionModeResultsVisibility, string>> = {
  [MEMBER_RESULTS]: 'Session members see all answers',
  participant_aggregate: 'Each person sees their own answers',
  session_member_aggregate: 'Own answers; agents need a group',
  [PUBLIC_RESULTS]: 'Anyone can see all answers',
};

const VISIBILITY_HELP = [
  'Session members: everyone signed in to the session sees every answer and the AI Views; signed-out visitors see none. Needs the Session Worker; an older one must be redeployed first.',
  'Each person: people see only their own answers.',
  'Own answers; agents need a group: as Each person, and agents get summaries only for accounts in a group at least the smallest group size.',
  'Anyone: everyone sees every answer, signed in or not. Needs answers stored unencrypted.',
  'Admins always see every answer.',
].join(' ');

const visibilityUnavailable = (profile: SessionModeProfile, value: string, memberResultsSupported: boolean): boolean =>
  (value === PUBLIC_RESULTS && !supportsPublicResults(profile)) ||
  (value === MEMBER_RESULTS && !(memberResultsSupported && supportsMemberResults(profile)));

const EXPORT_LABELS: Partial<Record<SessionModeExportScope, string>> = {
  admin_raw: 'Raw results',
  all_session: 'Whole session',
  encrypted_envelopes_only: 'Encrypted records',
};

const ENCRYPTION_LABELS: Record<string, string> = {
  none: 'None',
  worker_envelope: 'Session Worker',
  lit: 'Lit',
};

const CHAINS = [
  { value: 11155420, label: 'OP Sepolia' },
  { value: 84532, label: 'Base Sepolia' },
];
const chainLabel = (chainId: number | null | undefined) =>
  CHAINS.find((chain) => chain.value === chainId)?.label || (chainId ? `Chain ${chainId}` : 'none');

export const summarizeResults = (draft: SetupSectionProps['draft']): string => {
  const profile = profileOf(draft);
  const analysis = text(asRecord(draft.resultsAnalysis).generationMode) || 'manual';
  const visibility = profile ? VISIBILITY_LABELS[profile.results.visibility] || profile.results.visibility : '';
  return [visibility, `analysis ${analysis === 'both' ? 'manual and automatic' : analysis}`]
    .filter(Boolean)
    .join(' · ');
};

const MinGroupSizeInput = ({
  profile,
  editProfile,
}: {
  profile: SessionModeProfile;
  editProfile: SetupProfileEditor;
}) => {
  const committed = Math.max(2, Math.floor(Number(profile.results.exposure?.minGroupSize || 2) || 2));
  const [value, setValue] = useState(String(committed));
  useEffect(() => setValue(String(committed)), [committed]);
  return (
    <SetupField id="ce-setup-min-group" label="Smallest group shown">
      <Input
        id="ce-setup-min-group"
        type="number"
        min={2}
        inputMode="numeric"
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          const next = Number(event.target.value);
          if (!/^\d+$/.test(event.target.value) || next < 2) return;
          editProfile((draft) => {
            draft.results.exposure = {
              aggregateResultsEnabled: draft.results.exposure?.aggregateResultsEnabled !== false,
              anonymizedGroupsEnabled: true,
              minGroupSize: Math.floor(next),
            };
          });
        }}
        onBlur={() => setValue(String(committed))}
      />
    </SetupField>
  );
};

export const SetupResultsSection = ({
  draft,
  onChange,
  open,
  onToggle,
  conflicts,
  editProfile,
  admins = null,
  memberResultsSupported = true,
}: PolicyProps & {
  admins?: React.ReactNode;
  /** False when the session's Worker predates members-only results. */
  memberResultsSupported?: boolean;
}) => {
  const profile = profileOf(draft);
  const sectionConflicts = conflicts.filter((conflict) => conflict.section === 'results');
  const visibilityConflicts = conflictsAt(sectionConflicts, ['results.visibility']);
  return (
    <SetupSection
      sectionKey="results"
      title="Results visibility"
      summary={summarizeResults(draft)}
      open={open || sectionConflicts.length > 0}
      onToggle={onToggle}
      conflictCount={sectionConflicts.length}
    >
      {profile ? (
        <>
          <SetupField id="ce-setup-results-visibility" label="Who sees results" help={VISIBILITY_HELP}>
            <Input
              id="ce-setup-results-visibility"
              type="select"
              value={profile.results.visibility}
              aria-describedby={setupHelpId('ce-setup-results-visibility')}
              data-testid={E2E_TESTIDS.SETUP_RESULTS_VISIBILITY}
              onChange={(event) =>
                editProfile((next) => setResultsVisibility(next, event.target.value as SessionModeResultsVisibility))
              }
            >
              {Object.entries(VISIBILITY_LABELS).map(([value, label]) => (
                <option
                  key={value}
                  value={value}
                  disabled={visibilityUnavailable(profile, value, memberResultsSupported)}
                >
                  {label}
                </option>
              ))}
              {VISIBILITY_LABELS[profile.results.visibility] ? null : (
                <option value={profile.results.visibility}>{profile.results.visibility}</option>
              )}
            </Input>
          </SetupField>
          <SetupConflicts conflicts={visibilityConflicts} />
          <SetupCheck
            id="ce-setup-hide-small-groups"
            label="Hide small groups in summaries"
            help="Group summaries show only groups with at least the smallest size below."
            checked={profile.results.exposure?.anonymizedGroupsEnabled === true}
            onChange={(checked) =>
              editProfile((next) => {
                next.results.exposure = {
                  aggregateResultsEnabled: next.results.exposure?.aggregateResultsEnabled !== false,
                  anonymizedGroupsEnabled: checked,
                  minGroupSize: Math.max(2, Number(next.results.exposure?.minGroupSize || 2) || 2),
                };
              })
            }
          />
          {profile.results.exposure?.anonymizedGroupsEnabled ? (
            <MinGroupSizeInput profile={profile} editProfile={editProfile} />
          ) : null}
          <SetupConflicts conflicts={sectionConflicts.filter((conflict) => !visibilityConflicts.includes(conflict))} />
        </>
      ) : null}
      <ResultsAnalysisSettingsFields
        value={draft.resultsAnalysis}
        onChange={(value) => onChange(['resultsAnalysis'], value)}
        backgroundAutoSupported={supportsBackgroundResultsAnalysis(draft)}
        unsupportedReason={getBackgroundResultsAnalysisUnsupportedReason(draft)}
      />
      {admins}
    </SetupSection>
  );
};

export const summarizeAccess = (draft: SetupSectionProps['draft']): string => {
  const profile = profileOf(draft);
  if (!profile) return '';
  const signIn =
    profile.identity.enabled.length > 1
      ? `${profile.identity.default === 'wallet' ? 'Wallet' : 'Passkey'} or ${profile.identity.default === 'wallet' ? 'passkey' : 'wallet'} sign-in`
      : `${profile.identity.default === 'wallet' ? 'Wallet' : 'Passkey'} sign-in`;
  const encryption =
    profile.encryption.mode === 'none' ? 'not encrypted' : `encrypted by ${ENCRYPTION_LABELS[profile.encryption.mode]}`;
  return `${signIn} · ${encryption}`;
};

const RULE_LABELS: Record<SessionModeAccessConditionDocument['conditions'][number]['kind'], string> = {
  worker_role: 'Session role',
  sbt_onchain: 'SBT holders',
  agent_grant_scope: 'Authorized accounts',
};

const EnvelopeRules = ({
  profile,
  registryChainId,
  editProfile,
}: {
  profile: SessionModeProfile;
  registryChainId: number | null;
  editProfile: SetupProfileEditor;
}) => {
  const conditions = effectiveEnvelopeConditions(profile);
  const commit = (next: SessionModeAccessConditionDocument) =>
    editProfile((draft) => setEnvelopeConditions(draft, next));
  const updateRule = (
    index: number,
    patch: (
      rule: SessionModeAccessConditionDocument['conditions'][number],
    ) => SessionModeAccessConditionDocument['conditions'][number],
  ) => {
    const next = effectiveEnvelopeConditions(profile);
    if (!next.conditions[index]) return;
    next.conditions[index] = patch(next.conditions[index]);
    commit(next);
  };
  const add = (kind: SessionModeAccessConditionDocument['conditions'][number]['kind']) => {
    const next = effectiveEnvelopeConditions(profile);
    if (kind === 'worker_role') next.conditions.push({ kind, role: 'admin' });
    if (kind === 'agent_grant_scope') next.conditions.push({ kind, scope: 'storage' });
    if (kind === 'sbt_onchain') {
      const chainId = Number(profile.evm.registryChainId || registryChainId || DEFAULT_REGISTRY_CHAIN_ID);
      next.conditions.push({ kind, chainId, contract: '', anyOrAll: 'any' });
      editProfile((draft) => {
        draft.evm.registryChainId = draft.evm.registryChainId || chainId;
        setEnvelopeConditions(draft, next);
      });
      return;
    }
    commit(next);
  };
  return (
    <>
      <SetupField id="ce-setup-rule-match" label="Give access when">
        <Input
          id="ce-setup-rule-match"
          type="select"
          value={conditions.match}
          onChange={(event) => commit({ ...conditions, match: event.target.value === 'all' ? 'all' : 'any' })}
        >
          <option value="any">Any rule matches</option>
          <option value="all">All rules match</option>
        </Input>
      </SetupField>
      {conditions.conditions.map((rule, index) => (
        <div key={`${rule.kind}-${index}`} className={styles.listRow}>
          <div className={styles.listRowBody}>
            <span className={styles.questionType}>{RULE_LABELS[rule.kind]}</span>
            {rule.kind === 'worker_role' ? (
              <Input
                aria-label="Session role"
                value={rule.role}
                onChange={(event) => updateRule(index, () => ({ kind: 'worker_role', role: event.target.value }))}
              />
            ) : null}
            {rule.kind === 'agent_grant_scope' ? (
              <Input
                aria-label="Permission scope"
                value={rule.scope}
                onChange={(event) =>
                  updateRule(index, () => ({ kind: 'agent_grant_scope', scope: event.target.value }))
                }
              />
            ) : null}
            {rule.kind === 'sbt_onchain' ? (
              <>
                <Input
                  aria-label="SBT contract address"
                  placeholder="0x…"
                  value={rule.contract}
                  onChange={(event) =>
                    updateRule(index, (current) => ({ ...current, contract: event.target.value }) as typeof current)
                  }
                />
                <Input
                  type="select"
                  aria-label="SBT requirement"
                  value={rule.anyOrAll}
                  onChange={(event) =>
                    updateRule(
                      index,
                      (current) =>
                        ({ ...current, anyOrAll: event.target.value === 'all' ? 'all' : 'any' }) as typeof current,
                    )
                  }
                >
                  <option value="any">Any SBT from this contract</option>
                  <option value="all">All SBTs from this contract</option>
                </Input>
              </>
            ) : null}
          </div>
          <button
            type="button"
            className={styles.button}
            aria-label={`Remove ${RULE_LABELS[rule.kind]} rule`}
            onClick={() =>
              commit({ ...conditions, conditions: conditions.conditions.filter((_rule, at) => at !== index) })
            }
          >
            Remove
          </button>
        </div>
      ))}
      <div className={styles.buttonRow}>
        <button type="button" className={styles.button} onClick={() => add('worker_role')}>
          Add session role
        </button>
        <button type="button" className={styles.button} onClick={() => add('agent_grant_scope')}>
          Add authorized accounts
        </button>
        <button type="button" className={styles.button} onClick={() => add('sbt_onchain')}>
          Add SBT holders
        </button>
      </div>
    </>
  );
};

type AccessProps = PolicyProps & {
  /** On-chain sessions: the SBT gates panel. */
  gates?: React.ReactNode;
};

export const SetupAccessSection = ({
  draft,
  open,
  onToggle,
  conflicts,
  editProfile,
  registryChainId,
  gates = null,
}: AccessProps) => {
  const profile = profileOf(draft);
  const sectionConflicts = conflicts.filter((conflict) => conflict.section === 'access');
  if (!profile) return null;
  const otherMethod = profile.identity.default === 'wallet' ? 'passkey' : 'wallet';
  const hasRegistryChain = !!(profile.evm.registryChainId || registryChainId);
  return (
    <SetupSection
      sectionKey="access"
      title="Access and identity"
      summary={summarizeAccess(draft)}
      open={open || sectionConflicts.length > 0}
      onToggle={onToggle}
      conflictCount={sectionConflicts.length}
    >
      <SetupField
        id="ce-setup-sign-in"
        label="Sign-in"
        help="Worker-hosted sessions use passkeys; on-chain sessions use a wallet."
      >
        <Input
          id="ce-setup-sign-in"
          type="select"
          value={profile.identity.default}
          aria-describedby={setupHelpId('ce-setup-sign-in')}
          onChange={(event) =>
            editProfile((next) => {
              const method = event.target.value as SessionModeProfile['identity']['default'];
              next.identity = {
                default: method,
                enabled: next.identity.enabled.includes(method)
                  ? next.identity.enabled
                  : [method, ...next.identity.enabled],
              };
            })
          }
        >
          <option value="passkey">Passkey</option>
          <option value="wallet">Wallet</option>
        </Input>
      </SetupField>
      <SetupCheck
        id="ce-setup-sign-in-other"
        label={`Also allow ${otherMethod}`}
        checked={profile.identity.enabled.includes(otherMethod)}
        onChange={(checked) =>
          editProfile((next) => {
            const others = next.identity.enabled.filter((method) => method !== otherMethod);
            next.identity = { ...next.identity, enabled: checked ? [...others, otherMethod] : others };
          })
        }
      />
      <SetupConflicts conflicts={conflictsAt(sectionConflicts, ['identity'])} />
      <SetupCheck
        id="ce-setup-permission-roles"
        label="Session roles grant permissions"
        checked={profile.authorization.mechanisms.includes('worker_roles')}
        onChange={(checked) =>
          editProfile((next) => {
            const others = next.authorization.mechanisms.filter((mechanism) => mechanism !== 'worker_roles');
            next.authorization = { mechanisms: checked ? ['worker_roles', ...others] : others };
          })
        }
      />
      <SetupCheck
        id="ce-setup-permission-sbt"
        label="SBTs grant permissions"
        checked={profile.authorization.mechanisms.includes('sbt_onchain')}
        onChange={(checked) =>
          editProfile((next) => {
            const others = next.authorization.mechanisms.filter((mechanism) => mechanism !== 'sbt_onchain');
            next.authorization = { mechanisms: checked ? [...others, 'sbt_onchain'] : others };
          })
        }
      />
      <SetupConflicts conflicts={conflictsAt(sectionConflicts, ['authorization'])} />
      <SetupField
        id="ce-setup-encryption"
        label="Encryption"
        help="Session Worker: the Worker encrypts answers before Cloudflare stores them and checks access before decrypting. Lit: on-chain rules release the key."
      >
        <Input
          id="ce-setup-encryption"
          type="select"
          value={profile.encryption.mode}
          aria-describedby={setupHelpId('ce-setup-encryption')}
          data-testid={E2E_TESTIDS.SETUP_ENCRYPTION}
          onChange={(event) => editProfile((next) => setEncryptionMode(next, event.target.value, registryChainId))}
        >
          <option value="worker_envelope">{ENCRYPTION_LABELS.worker_envelope}</option>
          <option value="lit" disabled={!hasRegistryChain && profile.encryption.mode !== 'lit'}>
            {ENCRYPTION_LABELS.lit}
          </option>
          <option value="none">{ENCRYPTION_LABELS.none}</option>
        </Input>
      </SetupField>
      {profile.encryption.mode === 'worker_envelope' ? (
        <>
          <SetupCheck
            id="ce-setup-default-rules"
            label="Default access rules"
            help="Admins and accounts with storage permission, including participants and agents, can read encrypted data."
            checked={usesDefaultEnvelopeRules(profile)}
            onChange={(checked) =>
              editProfile((next) =>
                setEnvelopeConditions(
                  next,
                  checked
                    ? undefined
                    : {
                        match: 'any',
                        conditions: [
                          { kind: 'worker_role', role: 'admin' },
                          { kind: 'agent_grant_scope', scope: 'storage' },
                        ],
                      },
                ),
              )
            }
          />
          {usesDefaultEnvelopeRules(profile) ? null : (
            <EnvelopeRules profile={profile} registryChainId={registryChainId} editProfile={editProfile} />
          )}
        </>
      ) : null}
      <SetupConflicts conflicts={conflictsAt(sectionConflicts, ['encryption'])} />
      {gates}
    </SetupSection>
  );
};

const RUNS_ON_HELP =
  'Centralized: a Session Worker in your own Cloudflare account runs the session and keeps its data in Cloudflare storage. Decentralized: the session is registered on a public chain by wallet transactions, and its data is stored permanently and publicly on Arweave unless encrypted with Lit; it needs a wallet with gas, an Arweave key and an RPC URL. Hosting and storage lists what each needs.';

/** /new: where the session runs, the choice the rest of the page follows. */
export const SetupRunsOn = ({
  draft,
  editProfile,
  registryChainId,
}: Pick<PolicyProps, 'draft' | 'editProfile' | 'registryChainId'>) => {
  const profile = profileOf(draft);
  if (!profile) return null;
  return (
    <SetupToggle
      id="ce-setup-authority"
      label="Runs on"
      help={RUNS_ON_HELP}
      value={profile.authority.mode}
      options={[
        { value: 'worker_canonical', label: 'Centralized' },
        { value: 'evm_registry_canonical', label: 'Decentralized' },
      ]}
      testId={E2E_TESTIDS.SETUP_AUTHORITY}
      onChange={(mode) => editProfile((next) => setHosting(next, mode, registryChainId))}
    />
  );
};

export const summarizeHosting = (draft: SetupSectionProps['draft'], status = ''): string => {
  const profile = profileOf(draft);
  if (!profile) return status;
  const where =
    profile.authority.mode === 'worker_canonical'
      ? `Session Worker on ${profile.storage.backend === 'cloudflare' ? 'Cloudflare' : profile.storage.backend}`
      : `On-chain registry (${chainLabel(profile.evm.registryChainId)}) with ${profile.storage.backend === 'arweave' ? 'Arweave' : profile.storage.backend}`;
  return [where, status].filter(Boolean).join(' · ');
};

type HostingProps = PolicyProps & {
  /** The deploy status in a few words, shown in the summary. */
  status?: string;
  quick?: React.ReactNode;
  /** Read-only facts that can't change after publishing (edit page). */
  locked?: React.ReactNode;
  /** /new's Worker deployment, dashboard handoff and other hosting controls. */
  deployment?: React.ReactNode;
  onRegistryChainChange?: (chainId: number) => void;
};

export const SetupHostingSection = ({
  draft,
  mode,
  open,
  onToggle,
  conflicts,
  editProfile,
  registryChainId,
  status = '',
  quick = null,
  locked = null,
  deployment = null,
  onRegistryChainChange,
}: HostingProps) => {
  const profile = profileOf(draft);
  const sectionConflicts = conflicts.filter((conflict) => conflict.section === 'hosting');
  if (!profile) return null;
  const chainRelevant =
    profile.authority.mode === 'evm_registry_canonical' ||
    profile.encryption.mode === 'lit' ||
    [profile.encryption.accessConditions, profile.storage.payloadAccessControl?.accessConditions].some((document) =>
      document?.conditions?.some((rule) => rule.kind === 'sbt_onchain'),
    );
  const placedPaths = ['authority', 'storage', 'evm', 'surfaces', 'export'];
  const unplaced = sectionConflicts.filter((conflict) => !conflictsAt([conflict], placedPaths).length);
  return (
    <SetupSection
      sectionKey="hosting"
      title="Hosting and storage"
      summary={summarizeHosting(draft, status)}
      open={open || sectionConflicts.length > 0}
      onToggle={onToggle}
      conflictCount={sectionConflicts.length}
      quick={quick}
    >
      {locked}
      {mode === 'create' ? (
        <>
          <SetupField id="ce-setup-storage" label="Storage">
            <Input
              id="ce-setup-storage"
              type="select"
              value={profile.storage.backend}
              data-testid={E2E_TESTIDS.SETUP_STORAGE}
              onChange={(event) =>
                editProfile((next) => {
                  if (event.target.value === next.storage.backend) return;
                  next.storage =
                    event.target.value === 'cloudflare'
                      ? { backend: 'cloudflare', payloadAccessControl: defaultCloudflarePayloadAccess(next) }
                      : { backend: 'arweave' };
                })
              }
            >
              <option value="cloudflare">Cloudflare</option>
              <option value="arweave">Arweave</option>
            </Input>
          </SetupField>
        </>
      ) : null}
      <SetupConflicts conflicts={conflictsAt(sectionConflicts, ['authority', 'storage'])} />
      {chainRelevant && mode === 'create' ? (
        <SetupField id="ce-setup-chain" label="Registry network">
          <Input
            id="ce-setup-chain"
            type="select"
            value={String(profile.evm.registryChainId || registryChainId || DEFAULT_REGISTRY_CHAIN_ID)}
            onChange={(event) => {
              const chainId = Number(event.target.value);
              onRegistryChainChange?.(chainId);
              editProfile((next) => {
                next.evm.registryChainId = chainId;
              });
            }}
          >
            {CHAINS.map((chain) => (
              <option key={chain.value} value={chain.value}>
                {chain.label}
              </option>
            ))}
          </Input>
        </SetupField>
      ) : null}
      <SetupConflicts conflicts={conflictsAt(sectionConflicts, ['evm'])} />
      {profile.authority.mode === 'worker_canonical' ? (
        <SetupCheck
          id="ce-setup-agent-http"
          label="Agents (HTTP API)"
          help="Authorized agents can use this session through its Worker’s HTTP API with a scoped credential."
          checked={profile.surfaces.agentHttp}
          disabled={mode === 'edit'}
          onChange={(checked) =>
            editProfile((next) => {
              next.surfaces.agentHttp = checked;
            })
          }
        />
      ) : null}
      <SetupConflicts conflicts={conflictsAt(sectionConflicts, ['surfaces'])} />
      <SetupField
        id="ce-setup-export"
        label="Export"
        help="Saved as a preference; downloads follow the session’s access rules."
      >
        <Input
          id="ce-setup-export"
          type="select"
          value={profile.export.scope}
          aria-describedby={setupHelpId('ce-setup-export')}
          onChange={(event) =>
            editProfile((next) => {
              next.export = { scope: event.target.value as SessionModeExportScope };
            })
          }
        >
          {Object.entries(EXPORT_LABELS).map(([value, label]) => (
            <option
              key={value}
              value={value}
              disabled={value === 'encrypted_envelopes_only' && profile.encryption.mode === 'none'}
            >
              {label}
            </option>
          ))}
          {EXPORT_LABELS[profile.export.scope] ? null : (
            <option value={profile.export.scope}>{profile.export.scope}</option>
          )}
        </Input>
      </SetupField>
      <SetupConflicts conflicts={conflictsAt(sectionConflicts, ['export'])} />
      <SetupConflicts conflicts={unplaced} />
      {deployment}
    </SetupSection>
  );
};
