import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Input } from 'reactstrap';

import wizardStyles from '../SessionWizard.module.scss';
import styles from '../setup/SessionSetup.module.scss';
import ContextSourcesPanel from '../setup/ContextSourcesPanel';
import { normalizeSessionContext } from '@ce-shared/sessionContext.mjs';
import { templateContextFiles, type ContextSource } from '../../../utilities/docLibrary/contextSources';
import { SessionTemplateActions, SetupQuestionsPublisher } from '../setup/SessionTemplateTools';
import { sessionTemplateFromDraft } from '@ce-shared/sessionTemplate.mjs';
import {
  SetupBasicsSection,
  SetupContextSection,
  SetupParticipationSection,
  SetupQuestionsSection,
  readSetupQuestions,
  withoutPublishedQuestions,
} from '../setup/SetupContentSections';
import { SetupAccessSection, SetupHostingSection, SetupResultsSection } from '../setup/SetupPolicySections';
import { SetupField, type SetupSectionKey } from '../setup/SetupPrimitives';
import { editSessionSetupProfile } from '../setup/sessionSetupProfile';
import type { SetupDraft } from '../setup/setupSectionTypes';
import {
  buildGroupRecorderLink,
  buildSessionWizardAdminUrl,
  buildSessionWizardSessionUrl,
} from '../sessionWizardUrlSupport';
import { canonicalizeSessionWizardJson } from '../sessionWizardCanonicalJson';
import { setValueAtPath } from '../sessionWizardGateUtils';
import { buildTxExplorerUrl } from '../../Admin/adminPageHelpers';
import { E2E_TESTIDS } from '../../../utilities/e2eTestIds.js';
import { notify } from '../../../utilities/ui/notify.js';
import { toStr } from '../../../utilities/shared/primitives.js';
import { resolveSessionCapabilityProjection } from '../../../utilities/session/sessionCapabilityProjection';
import {
  fetchWorkerCanonicalSessionBootstrap,
  resolveWorkerCanonicalSessionIdHex,
} from '../../../utilities/session/sessionWorkerDiscovery';
import { upsertWorkerCanonicalSessionBootstrap } from '../../../utilities/session/sessionWorkerConfigCache';
import { describeWorkerModeError, listSessionModeConflicts } from '../../../utilities/session/sessionModeRuleMessages';
import { readWorkerReleaseLabel } from '../../../domains/worker/workerRelease';
import {
  applyTemplateToSessionSettingsDraft,
  buildSessionSettingsDraft,
  buildSessionSettingsSave,
  describeSessionSettingsPath,
  rebaseSessionSettingsDraft,
  usesSbtDefaults,
  workerMergesAi,
  workerShowsMemberResults,
  workerTakesResultsAdmins,
  type SessionSettingsSave,
} from './sessionSettingsEdits';
import { contractsNeedChecking, describeChain, readRegistryFacts } from './sessionSettingsChain';
import {
  ON_CHAIN_SAVE_STEPS,
  saveOnChainSessionSettings,
  saveSessionSettings,
  syncOnChainSessionWorker,
  type OnChainSaveStep,
  type OnChainSaveStepState,
  type OnChainWorkerSync,
} from './sessionSettingsSave';
import { SettingsAiSection } from './SettingsAiSection';
import { SettingsChainFacts, SettingsChainFields } from './SettingsChainFields';
import { SettingsQuestionListFields, SettingsSbtFields } from './SettingsListFields';
import SettingsResultsAdminsField from './SettingsResultsAdminsField';

type SessionSettingsPageProps = {
  account?: string;
  provider?: unknown;
  network?: { id?: number | string } | null;
  loginComplete?: boolean;
  toggleLoginModal?: (open?: boolean) => void;
  sessionSlug: string;
  sessionConfig: Record<string, unknown> | null;
  workerOrigin?: string;
  /** Overrides the network read, for tests. */
  fetchImpl?: typeof fetch;
};

const CLOSED: Record<SetupSectionKey, boolean> = {
  basics: true,
  context: false,
  questions: false,
  participation: false,
  results: false,
  access: false,
  hosting: false,
  ai: false,
};

const AI_LOCKED_REASON =
  'They are read-only here: this Session Worker is older and would drop the AI settings this page can’t see. Update the Worker to edit them.';
const LISTS_LOCKED_REASON =
  'The ID lists are read-only here: this Session Worker is older and refuses them. Update the Worker to edit them.';

const lower = (value: unknown) => toStr(value).trim().toLowerCase();
const sameJson = (left: unknown, right: unknown) =>
  JSON.stringify(canonicalizeSessionWizardJson(left ?? null)) ===
  JSON.stringify(canonicalizeSessionWizardJson(right ?? null));

/** An on-chain session's admin is the registry's; a Worker-hosted session lists its own. */
export const isSessionAdmin = (config: unknown, account: unknown): boolean => {
  const source = config && typeof config === 'object' ? (config as Record<string, unknown>) : {};
  const admins = resolveSessionCapabilityProjection(source).isRegistryCanonical
    ? [readRegistryFacts(source).adminAddress]
    : [source.adminAddress, ...(Array.isArray(source.adminAddresses) ? source.adminAddresses : [])];
  return !!lower(account) && admins.map(lower).filter(Boolean).includes(lower(account));
};

const ChangeList = ({ title, paths, testId }: { title: string; paths: string[]; testId: string }) =>
  paths.length ? (
    <div data-testid={testId}>
      <p className={styles.fieldLabel}>{title}</p>
      <ul className={styles.hint}>
        {[...new Set(paths.map(describeSessionSettingsPath))].map((label) => (
          <li key={label}>{label}</li>
        ))}
      </ul>
    </div>
  ) : null;

type StepView = { step: OnChainSaveStep; state: OnChainSaveStepState | 'waiting'; detail?: string };
const STATE_LABELS: Record<StepView['state'], string> = {
  waiting: 'Waiting',
  running: 'Running…',
  done: 'Done',
  failed: 'Failed',
  skipped: 'Skipped',
};

// /session/<slug>/settings: a published session's settings in the setup
// page's sections. A Worker-hosted session saves the changed fields its
// Worker's set-config accepts; an on-chain session saves new metadata to the
// SessionRegistry. Either way the page says beforehand which edits sign
// participants out.
const SessionSettingsPage = ({
  account = '',
  provider,
  network,
  loginComplete = false,
  toggleLoginModal,
  sessionSlug,
  sessionConfig,
  workerOrigin: workerOriginProp = '',
  fetchImpl,
}: SessionSettingsPageProps): React.ReactElement => {
  const capabilities = resolveSessionCapabilityProjection(sessionConfig);
  const onChain = capabilities.isRegistryCanonical;
  const workerOrigin = toStr(workerOriginProp || sessionConfig?.corsWorkerUrl).trim();
  const [saved, setSaved] = useState<Record<string, unknown> | null>(sessionConfig);
  const savedRef = useRef(saved);
  const [draft, setDraft] = useState<SetupDraft>(() => buildSessionSettingsDraft(sessionConfig));
  const [openSections, setOpenSections] = useState(CLOSED);
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [steps, setSteps] = useState<StepView[]>([]);
  const [txUrl, setTxUrl] = useState('');
  // A failed Worker sync after an on-chain save, kept for a retry.
  const [retrySync, setRetrySync] = useState<OnChainWorkerSync | null>(null);
  // The session's files, listed by name in an exported template.
  const [contextSources, setContextSources] = useState<ContextSource[]>([]);

  // A fresh copy replaces the "before" every edit is compared with. Unless
  // the edits were just saved, the admin's edits are kept on top of it.
  const adopt = useCallback((fresh: Record<string, unknown> | null, keepEdits: boolean) => {
    const base = savedRef.current;
    savedRef.current = fresh;
    setSaved(fresh);
    setDraft((prev) => (keepEdits ? rebaseSessionSettingsDraft(prev, base, fresh) : buildSessionSettingsDraft(fresh)));
  }, []);

  // The Worker's own copy is the "before" for a Worker-hosted session. A copy
  // that arrives after the page moved to another session is dropped.
  const refresh = useCallback(
    async (keepEdits = true, stale: () => boolean = () => false) => {
      if (!capabilities.isWorkerCanonical || !workerOrigin) return null;
      const bootstrap = await fetchWorkerCanonicalSessionBootstrap({
        sessionSlug,
        workerQueryValue: workerOrigin,
        ...(fetchImpl ? { fetchImpl } : {}),
      });
      if (stale()) return null;
      upsertWorkerCanonicalSessionBootstrap({
        slug: bootstrap.sessionSlug,
        sessionIdHex: bootstrap.sessionId,
        workerOrigin: bootstrap.workerOrigin,
        configRevision: bootstrap.configRevision,
        config: bootstrap.config,
      });
      adopt(bootstrap.config, keepEdits);
      return bootstrap.config;
    },
    [adopt, capabilities.isWorkerCanonical, fetchImpl, sessionSlug, workerOrigin],
  );

  useEffect(() => {
    let stale = false;
    refresh(true, () => stale).catch(() => {
      if (!stale) setStatus('Couldn’t load the latest settings from the Session Worker.');
    });
    return () => {
      stale = true;
    };
  }, [refresh]);

  // Which release the Session Worker runs; Workers before 0.9.3 don't say.
  const [workerRelease, setWorkerRelease] = useState('');
  useEffect(() => {
    let stale = false;
    setWorkerRelease('');
    void readWorkerReleaseLabel(workerOrigin, sessionSlug, fetchImpl).then((release) => {
      if (!stale) setWorkerRelease(release);
    });
    return () => {
      stale = true;
    };
  }, [fetchImpl, sessionSlug, workerOrigin]);

  // An on-chain session's config arrives through the registry cache.
  useEffect(() => {
    if (onChain && sessionConfig && !sameJson(sessionConfig, savedRef.current)) adopt(sessionConfig, true);
  }, [adopt, onChain, sessionConfig]);

  const conflicts = useMemo(() => listSessionModeConflicts(draft.sessionModeProfile), [draft.sessionModeProfile]);
  const pending = useMemo(() => {
    try {
      return { save: buildSessionSettingsSave(saved, draft, { onChain }), error: '' };
    } catch (error) {
      return { save: null, error: error instanceof Error ? error.message : 'Check the settings.' };
    }
  }, [draft, saved, onChain]);
  const facts = readRegistryFacts(saved);
  const needsContractCheck = onChain && contractsNeedChecking(saved, draft);
  const chainBlocker = !onChain
    ? ''
    : !facts.registryChainId
      ? 'This session’s registry network is unknown, so it can’t be saved here.'
      : needsContractCheck
        ? 'Correct the contract addresses or confirm them before saving.'
        : '';

  const updateDraft = (path: string[], value: unknown) =>
    setDraft((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      setValueAtPath(next, path, value);
      return next;
    });
  const editProfile = (mutate: Parameters<typeof editSessionSetupProfile>[1]) =>
    setDraft((prev) => ({
      ...prev,
      sessionModeProfile: editSessionSetupProfile(prev.sessionModeProfile, mutate).profile,
    }));
  const section = (key: SetupSectionKey) => ({
    draft,
    onChange: updateDraft,
    mode: 'edit' as const,
    open: openSections[key],
    onToggle: () => setOpenSections((prev) => ({ ...prev, [key]: !prev[key] })),
    conflicts,
  });

  // An on-chain session's link needs no Worker pin; the registry names its Worker.
  const linkWorker = onChain ? '' : workerOrigin;
  const sessionUrl = buildSessionWizardSessionUrl({ slug: sessionSlug, workerOrigin: linkWorker });
  const groupRecorderLink = buildGroupRecorderLink(sessionUrl);
  const copyGroupRecorderLink = async () => {
    try {
      await navigator.clipboard.writeText(groupRecorderLink);
      notify.success('Copied to clipboard');
      setStatus('Group recorder link copied.');
    } catch {
      setStatus(`Copy failed. The link is ${groupRecorderLink}`);
    }
  };

  const saveToWorker = async (patch: Record<string, unknown>) => {
    setStatus('Saving…');
    await saveSessionSettings({
      workerOrigin,
      sessionSlug,
      sessionIdHex: resolveWorkerCanonicalSessionIdHex(saved),
      patch,
      account,
      provider,
      chainId: Number(network?.id || 1) || 1,
    });
    await refresh(false);
    setStatus('Settings saved.');
  };

  const showStep = (step: OnChainSaveStep, state: OnChainSaveStepState, detail?: string) =>
    setSteps((prev) => prev.map((entry) => (entry.step === step ? { step, state, detail } : entry)));

  const saveOnChain = async ({ patch, after }: SessionSettingsSave) => {
    setTxUrl('');
    setRetrySync(null);
    setSteps(ON_CHAIN_SAVE_STEPS.map((step) => ({ step, state: 'waiting' })));
    setStatus('Saving on chain…');
    const result = await saveOnChainSessionSettings({
      before: saved || {},
      after,
      patch,
      sessionSlug,
      account,
      provider,
      workerOrigin,
      authorityMode: capabilities.authorityMode,
      onStep: showStep,
    });
    adopt(result.nextConfig, false);
    setTxUrl(buildTxExplorerUrl(result.txHash, facts.registryChainId));
    if (result.workerError) setRetrySync(result.workerSync);
    setStatus(
      result.workerError ? `Saved on chain. The Session Worker didn’t sync: ${result.workerError}` : 'Saved on chain.',
    );
  };

  // The on-chain update stands; only the Worker's copy is sent again.
  const retryWorkerSync = async () => {
    if (!retrySync || saving) return;
    setSaving(true);
    showStep('worker', 'running');
    try {
      await syncOnChainSessionWorker(retrySync);
      showStep('worker', 'done');
      setRetrySync(null);
      setStatus('Saved on chain. The Session Worker is synced now.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The Session Worker sync failed.';
      showStep('worker', 'failed', message);
      setStatus(`Saved on chain. The Session Worker still didn’t sync: ${message}`);
    } finally {
      setSaving(false);
    }
  };

  const save = async () => {
    const result = pending.save;
    if (saving || !result || !Object.keys(result.patch).length || conflicts.length || chainBlocker) return;
    setSaving(true);
    try {
      await (onChain ? saveOnChain(result) : saveToWorker(result.patch));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Saving failed.';
      setStatus(describeWorkerModeError(message, draft.sessionModeProfile) || message);
    } finally {
      setSaving(false);
    }
  };

  const importTemplate = (template: Record<string, unknown>) => {
    const { draft: next, keptHosting } = applyTemplateToSessionSettingsDraft(draft, template);
    // An on-chain session's questions are published from its session page.
    if (onChain) next.questions = draft.questions;
    setDraft(next);
    setStatus(
      keptHosting
        ? 'Template applied. Its hosting differs from this session’s, which is fixed, so the session keeps its own.'
        : 'Template applied. Review the changes, then save.',
    );
  };
  const editable = capabilities.isWorkerCanonical || onChain;
  const header = (
    <header className={styles.pageHeader}>
      <h1 className={styles.pageTitle}>Session settings</h1>
      {editable && isSessionAdmin(saved, account) ? (
        <SessionTemplateActions
          buildTemplate={() =>
            sessionTemplateFromDraft({
              ...draft,
              contextFiles: templateContextFiles(contextSources),
            })
          }
          onImport={importTemplate}
          fromLink={false}
          fileName={sessionSlug}
          linkBase={`${typeof window === 'undefined' ? '' : window.location.origin}/new`}
        />
      ) : null}
    </header>
  );

  if (!editable) {
    return (
      <div className={wizardStyles.groupWizard} data-testid={E2E_TESTIDS.SESSION_SETTINGS_PAGE}>
        <div className={styles.page}>
          {header}
          <p className={styles.hint} data-testid="ce-settings-unsupported">
            This session’s mode profile is missing or not supported, so its settings can’t be edited here.
          </p>
        </div>
      </div>
    );
  }

  if (!isSessionAdmin(saved, account)) {
    const signedIn = loginComplete && !!account;
    const registryAdmin = onChain && facts.adminAddress ? `, ${facts.adminAddress},` : '';
    return (
      <div className={wizardStyles.groupWizard} data-testid={E2E_TESTIDS.SESSION_SETTINGS_PAGE}>
        <div className={styles.page}>
          {header}
          <p className={styles.hint} data-testid="ce-settings-admin-only">
            {signedIn ? (
              `${
                onChain
                  ? `Only this session’s registry admin${registryAdmin} can change its settings.`
                  : 'Only this session’s admins can change its settings.'
              } You’re signed in as ${account}.`
            ) : (
              <>
                <button
                  type="button"
                  className={`${styles.button} ${styles.primaryButton} ${styles.inlineButton}`}
                  onClick={() => toggleLoginModal?.(true)}
                >
                  Sign in
                </button>{' '}
                {onChain
                  ? `with the session’s registry admin wallet${registryAdmin} to change its settings.`
                  : 'as a session admin to change its settings.'}
              </>
            )}
          </p>
        </div>
      </div>
    );
  }

  const changes = pending.save?.classification;
  const hasChanges = !!pending.save && Object.keys(pending.save.patch).length > 0;
  const registryChain = describeChain(facts.registryChainId);
  const stepLabel = (step: OnChainSaveStep) =>
    ({
      wallet: `Check the wallet: the registry admin, on ${registryChain}`,
      upload: 'Upload the new metadata to Arweave',
      registry: `Update the SessionRegistry on ${registryChain}`,
      cache: 'Update this browser’s copy',
      worker: 'Sync the Session Worker',
    })[step];

  return (
    <div className={wizardStyles.groupWizard} data-testid={E2E_TESTIDS.SESSION_SETTINGS_PAGE}>
      <div className={styles.page}>
        {header}
        <div className={styles.buttonRow}>
          <a className={styles.button} data-ce-control-appearance="raised" href={sessionUrl}>
            Open the session
          </a>
          <button
            type="button"
            className={styles.button}
            data-testid={E2E_TESTIDS.SESSION_SETTINGS_GROUP_RECORDER_LINK}
            onClick={() => void copyGroupRecorderLink()}
          >
            Copy group recorder link
          </button>
        </div>
        <SetupBasicsSection
          draft={draft}
          onChange={updateDraft}
          link={
            <p className={styles.hint}>
              Link: <span className={styles.readOnlyValue}>{sessionUrl}</span>
              {workerRelease ? (
                <>
                  <br />
                  Session Worker release:{' '}
                  <span className={styles.readOnlyValue} data-testid="ce-settings-worker-release">
                    {workerRelease}
                  </span>
                </>
              ) : null}
            </p>
          }
        />
        <SetupContextSection
          {...section('context')}
          sources={
            <>
              <SetupField
                id="ce-setting-context-addition"
                label="Who can add files"
                help="Each file shows who added it, and admins can remove any of them. Only admins add links."
              >
                <Input
                  id="ce-setting-context-addition"
                  type="select"
                  value={draft.contextAdditionPolicy === 'admin_only' ? 'admin_only' : 'participants'}
                  data-testid="ce-setting-context-addition"
                  onChange={(event) => updateDraft(['contextAdditionPolicy'], event.target.value)}
                >
                  <option value="participants">Anyone in the session</option>
                  <option value="admin_only">Admins only</option>
                </Input>
              </SetupField>
              <ContextSourcesPanel
                sessionSlug={sessionSlug}
                sessionConfig={saved}
                account={account}
                pageLinks={normalizeSessionContext(saved?.sessionContext).links}
                onSourcesChange={setContextSources}
              />
            </>
          }
        />
        <SetupQuestionsSection
          {...section('questions')}
          publisher={
            <>
              {onChain ? (
                <p className={styles.hint}>
                  An on-chain session’s questions are added and edited on its <a href={sessionUrl}>session page</a>.
                </p>
              ) : (
                <>
                  <SetupQuestionsPublisher
                    questions={readSetupQuestions(draft)}
                    sessionConfig={saved}
                    sessionSlug={sessionSlug}
                    account={account}
                    provider={provider}
                    onPublished={(published) =>
                      setDraft((prev) => ({
                        ...prev,
                        questions: withoutPublishedQuestions(prev.questions, published),
                      }))
                    }
                  />
                  <p className={styles.hint}>
                    Questions already in the session are edited on the <a href={sessionUrl}>session page</a>.
                  </p>
                </>
              )}
              {openSections.questions ? (
                <SettingsQuestionListFields
                  draft={draft}
                  onChange={updateDraft}
                  listsLockedReason={onChain || workerMergesAi(saved) ? '' : LISTS_LOCKED_REASON}
                />
              ) : null}
            </>
          }
        />
        <SetupParticipationSection {...section('participation')} workerHosted={!onChain} />
        <SetupResultsSection
          {...section('results')}
          editProfile={editProfile}
          registryChainId={facts.registryChainId || null}
          memberResultsSupported={workerShowsMemberResults(saved)}
          admins={
            !onChain && workerTakesResultsAdmins(saved) ? (
              <SettingsResultsAdminsField
                value={Array.isArray(draft.resultsAdminAddresses) ? (draft.resultsAdminAddresses as string[]) : []}
                onChange={(next) => updateDraft(['resultsAdminAddresses'], next)}
              />
            ) : null
          }
        />
        <SetupAccessSection
          {...section('access')}
          editProfile={editProfile}
          registryChainId={facts.registryChainId || null}
          gates={
            onChain || usesSbtDefaults(draft) ? (
              <SettingsSbtFields draft={draft} onChange={updateDraft} onChain={onChain} />
            ) : null
          }
        />
        <SetupHostingSection
          {...section('hosting')}
          editProfile={editProfile}
          registryChainId={facts.registryChainId || null}
          locked={
            onChain ? (
              <SettingsChainFacts config={saved} sessionSlug={sessionSlug} workerOrigin={workerOrigin} />
            ) : (
              <dl className={styles.hint} data-testid="ce-settings-locked">
                <dt>Link name</dt>
                <dd className={styles.readOnlyValue}>{sessionSlug}</dd>
                <dt>Session ID</dt>
                <dd className={styles.readOnlyValue}>{resolveWorkerCanonicalSessionIdHex(saved)}</dd>
                <dt>Session Worker</dt>
                <dd className={styles.readOnlyValue}>{workerOrigin}</dd>
                <dt>Runs on</dt>
                <dd className={styles.readOnlyValue}>Session Worker (fixed once published)</dd>
              </dl>
            )
          }
          deployment={
            onChain ? (
              <SettingsChainFields
                config={saved}
                draft={draft}
                onChange={updateDraft}
                needsContractCheck={needsContractCheck}
              />
            ) : null
          }
        />
        <SettingsAiSection
          draft={draft}
          onChange={updateDraft}
          open={openSections.ai}
          onToggle={() => setOpenSections((prev) => ({ ...prev, ai: !prev.ai }))}
          lockedReason={onChain || workerMergesAi(saved) ? '' : AI_LOCKED_REASON}
          keys={
            <p className={styles.hint}>
              API keys live on the Session Worker. Change them in{' '}
              <a href={buildSessionWizardAdminUrl({ sessionSlug, workerOrigin })}>Admin</a>.
            </p>
          }
        />
        <section className={styles.section} aria-labelledby="ce-settings-save-title" data-testid="ce-settings-save">
          <h2 id="ce-settings-save-title" className={styles.sectionTitle}>
            Save
          </h2>
          {pending.error ? <p className={styles.errorText}>{pending.error}</p> : null}
          {conflicts.length ? <p className={styles.conflict}>Resolve the conflicts above before saving.</p> : null}
          {chainBlocker ? <p className={styles.conflict}>{chainBlocker}</p> : null}
          {hasChanges && changes ? (
            <>
              <ChangeList
                title="Keeps everyone signed in"
                paths={changes.content}
                testId={E2E_TESTIDS.SESSION_SETTINGS_CONTENT_CHANGES}
              />
              <ChangeList
                title="Signs participants out: they sign in again"
                paths={changes.authority}
                testId={E2E_TESTIDS.SESSION_SETTINGS_AUTHORITY_CHANGES}
              />
            </>
          ) : (
            <p className={styles.hint}>No changes yet.</p>
          )}
          {onChain ? (
            <p className={styles.hint} data-testid="ce-settings-chain-needs">
              Saving uploads new metadata to Arweave, then asks the registry admin’s wallet to sign a transaction on{' '}
              {registryChain}.
            </p>
          ) : null}
          <div className={styles.buttonRow}>
            <button
              type="button"
              className={`${styles.button} ${styles.primaryButton}`}
              disabled={!hasChanges || conflicts.length > 0 || !!chainBlocker || saving}
              data-testid={E2E_TESTIDS.SESSION_SETTINGS_SAVE}
              onClick={() => void save()}
            >
              {saving ? 'Saving…' : changes?.signsParticipantsOut ? 'Save and sign participants out' : 'Save'}
            </button>
            {retrySync ? (
              <button
                type="button"
                className={styles.button}
                disabled={saving}
                data-testid="ce-settings-retry-sync"
                onClick={() => void retryWorkerSync()}
              >
                Retry the Worker sync
              </button>
            ) : null}
          </div>
          {steps.length ? (
            <ol className={styles.hint} data-testid="ce-settings-chain-steps">
              {steps.map(({ step, state, detail }) => (
                <li key={step} data-state={state}>
                  {stepLabel(step)}: {STATE_LABELS[state]}
                  {step === 'registry' && state === 'running' ? ' Confirm in your wallet.' : ''}
                  {detail ? ` ${detail}` : ''}
                </li>
              ))}
            </ol>
          ) : null}
          {status ? (
            <p className={styles.statusText} role="status" data-testid={E2E_TESTIDS.SESSION_SETTINGS_STATUS}>
              {status}
              {txUrl ? (
                <>
                  {' '}
                  <a href={txUrl} target="_blank" rel="noreferrer" data-testid="ce-settings-chain-tx">
                    View the transaction
                  </a>
                </>
              ) : null}
            </p>
          ) : null}
        </section>
      </div>
    </div>
  );
};

export default SessionSettingsPage;
