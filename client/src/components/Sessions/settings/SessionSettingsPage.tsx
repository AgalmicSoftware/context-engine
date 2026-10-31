import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import wizardStyles from '../SessionWizard.module.scss';
import styles from '../setup/SessionSetup.module.scss';
import ContextSourcesPanel from '../setup/ContextSourcesPanel';
import { normalizeSessionContext } from '@ce-shared/sessionContext.mjs';
import type { ContextSource } from '../../../utilities/docLibrary/contextSources';
import { SessionTemplateActions, SetupQuestionsPublisher } from '../setup/SessionTemplateTools';
import { sessionTemplateFromDraft } from '@ce-shared/sessionTemplate.mjs';
import {
  SetupBasicsSection,
  SetupContextSection,
  SetupParticipationSection,
  SetupQuestionsSection,
  readSetupQuestions,
} from '../setup/SetupContentSections';
import { SetupAccessSection, SetupHostingSection, SetupResultsSection } from '../setup/SetupPolicySections';
import type { SetupSectionKey } from '../setup/SetupPrimitives';
import { editSessionSetupProfile } from '../setup/sessionSetupProfile';
import type { SetupDraft } from '../setup/setupSectionTypes';
import { buildSessionWizardAdminUrl, buildSessionWizardSessionUrl } from '../sessionWizardUrlSupport';
import { setValueAtPath } from '../sessionWizardGateUtils';
import { buildSessionVoiceModeSearch } from '../../SurveyTool/sessionInterview';
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
import {
  applyTemplateToSessionSettingsDraft,
  buildSessionSettingsDraft,
  buildSessionSettingsSave,
  describeSessionSettingsPath,
  rebaseSessionSettingsDraft,
  usesSbtDefaults,
  workerMergesAi,
} from './sessionSettingsEdits';
import { saveSessionSettings } from './sessionSettingsSave';
import { SettingsAiSection } from './SettingsAiSection';
import { SettingsQuestionListFields, SettingsSbtFields } from './SettingsListFields';

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

const lower = (value: unknown) => toStr(value).trim().toLowerCase();

export const isSessionAdmin = (config: unknown, account: unknown): boolean => {
  const source = config && typeof config === 'object' ? (config as Record<string, unknown>) : {};
  const admins = [source.adminAddress, ...(Array.isArray(source.adminAddresses) ? source.adminAddresses : [])]
    .map(lower)
    .filter(Boolean);
  return !!lower(account) && admins.includes(lower(account));
};

// The session link with ?mode=groupRecording, which opens the group recorder.
export const buildGroupRecorderLink = (slug: string, workerOrigin: string, origin?: string): string => {
  const sessionUrl = buildSessionWizardSessionUrl({ slug, workerOrigin, origin });
  if (!sessionUrl) return '';
  const [base, query = ''] = sessionUrl.split('?');
  return `${base}${buildSessionVoiceModeSearch(query ? `?${query}` : '', 'recordGroup')}`;
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

// /session/<slug>/settings: a published session's settings in the setup
// page's sections. Only fields the Worker's set-config accepts are sent, and
// the page says beforehand which edits sign participants out.
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
  const workerOrigin = toStr(workerOriginProp || sessionConfig?.corsWorkerUrl).trim();
  const [saved, setSaved] = useState<Record<string, unknown> | null>(sessionConfig);
  const savedRef = useRef(saved);
  const [draft, setDraft] = useState<SetupDraft>(() => buildSessionSettingsDraft(sessionConfig));
  const [openSections, setOpenSections] = useState(CLOSED);
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);
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

  // The Worker's own copy is the "before" for a Worker-hosted session.
  const refresh = useCallback(
    async (keepEdits = true) => {
      if (!capabilities.isWorkerCanonical || !workerOrigin) return null;
      const bootstrap = await fetchWorkerCanonicalSessionBootstrap({
        sessionSlug,
        workerQueryValue: workerOrigin,
        ...(fetchImpl ? { fetchImpl } : {}),
      });
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
    refresh().catch(() => setStatus('Couldn’t load the latest settings from the Session Worker.'));
  }, [refresh]);

  const conflicts = useMemo(() => listSessionModeConflicts(draft.sessionModeProfile), [draft.sessionModeProfile]);
  const pending = useMemo(() => {
    try {
      return { save: buildSessionSettingsSave(saved, draft), error: '' };
    } catch (error) {
      return { save: null, error: error instanceof Error ? error.message : 'Check the settings.' };
    }
  }, [draft, saved]);

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

  const groupRecorderLink = buildGroupRecorderLink(sessionSlug, workerOrigin);
  const copyGroupRecorderLink = async () => {
    try {
      await navigator.clipboard.writeText(groupRecorderLink);
      notify.success('Copied to clipboard');
      setStatus('Group recorder link copied.');
    } catch {
      setStatus(`Copy failed. The link is ${groupRecorderLink}`);
    }
  };

  const save = async () => {
    const patch = pending.save?.patch || {};
    if (saving || !Object.keys(patch).length || conflicts.length) return;
    setSaving(true);
    setStatus('Saving…');
    try {
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
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Saving failed.';
      setStatus(describeWorkerModeError(message, draft.sessionModeProfile) || message);
    } finally {
      setSaving(false);
    }
  };

  const importTemplate = (template: Record<string, unknown>) => {
    const { draft: next, keptHosting } = applyTemplateToSessionSettingsDraft(draft, template);
    setDraft(next);
    setStatus(
      keptHosting
        ? 'Template applied. Its hosting differs from this session’s, which is fixed, so the session keeps its own.'
        : 'Template applied. Review the changes, then save.',
    );
  };
  const header = (
    <header className={styles.pageHeader}>
      <h1 className={styles.pageTitle}>Session settings</h1>
      {capabilities.isWorkerCanonical && isSessionAdmin(saved, account) ? (
        <SessionTemplateActions
          buildTemplate={() =>
            sessionTemplateFromDraft({
              ...draft,
              contextFiles: contextSources
                .filter((source) => source.kind === 'file')
                .map((source) => ({ name: source.title, adminsOnly: source.adminsOnly })),
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

  if (!capabilities.isWorkerCanonical) {
    return (
      <div className={wizardStyles.groupWizard} data-testid={E2E_TESTIDS.SESSION_SETTINGS_PAGE}>
        <div className={styles.page}>
          {header}
          <p className={styles.hint} data-testid="ce-settings-unsupported">
            This page edits sessions hosted on a Session Worker. This session is registered on chain.
          </p>
        </div>
      </div>
    );
  }

  if (!isSessionAdmin(saved, account)) {
    return (
      <div className={wizardStyles.groupWizard} data-testid={E2E_TESTIDS.SESSION_SETTINGS_PAGE}>
        <div className={styles.page}>
          {header}
          <p className={styles.hint} data-testid="ce-settings-admin-only">
            {loginComplete && account
              ? 'Only this session’s admins can change its settings.'
              : 'Sign in as a session admin to change its settings.'}
          </p>
          {!(loginComplete && account) ? (
            <div className={styles.buttonRow}>
              <button type="button" className={styles.button} onClick={() => toggleLoginModal?.(true)}>
                Sign in
              </button>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  const changes = pending.save?.classification;
  const hasChanges = !!pending.save && Object.keys(pending.save.patch).length > 0;
  const sessionUrl = buildSessionWizardSessionUrl({ slug: sessionSlug, workerOrigin });

  return (
    <div className={wizardStyles.groupWizard} data-testid={E2E_TESTIDS.SESSION_SETTINGS_PAGE}>
      <div className={styles.page}>
        {header}
        <div className={styles.buttonRow}>
          <a className={styles.button} href={sessionUrl}>
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
            </p>
          }
        />
        <SetupContextSection
          {...section('context')}
          sources={
            <ContextSourcesPanel
              sessionSlug={sessionSlug}
              sessionConfig={saved}
              account={account}
              pageLinks={normalizeSessionContext(saved?.sessionContext).links}
              onSourcesChange={setContextSources}
            />
          }
        />
        <SetupQuestionsSection
          {...section('questions')}
          publisher={
            <>
              <SetupQuestionsPublisher
                questions={readSetupQuestions(draft)}
                sessionConfig={saved}
                sessionSlug={sessionSlug}
                account={account}
                provider={provider}
                onPublished={() => updateDraft(['questions'], [])}
              />
              <p className={styles.hint}>
                Questions already in the session are edited on the <a href={sessionUrl}>session page</a>.
              </p>
              {openSections.questions ? <SettingsQuestionListFields draft={draft} onChange={updateDraft} /> : null}
            </>
          }
        />
        <SetupParticipationSection {...section('participation')} supportsEndTime />
        <SetupResultsSection {...section('results')} editProfile={editProfile} registryChainId={null} />
        <SetupAccessSection
          {...section('access')}
          editProfile={editProfile}
          registryChainId={null}
          gates={usesSbtDefaults(draft) ? <SettingsSbtFields draft={draft} onChange={updateDraft} /> : null}
        />
        <SetupHostingSection
          {...section('hosting')}
          editProfile={editProfile}
          registryChainId={null}
          locked={
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
          }
        />
        <SettingsAiSection
          draft={draft}
          onChange={updateDraft}
          open={openSections.ai}
          onToggle={() => setOpenSections((prev) => ({ ...prev, ai: !prev.ai }))}
          lockedReason={workerMergesAi(saved) ? '' : AI_LOCKED_REASON}
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
          <div className={styles.buttonRow}>
            <button
              type="button"
              className={`${styles.button} ${styles.primaryButton}`}
              disabled={!hasChanges || conflicts.length > 0 || saving}
              data-testid={E2E_TESTIDS.SESSION_SETTINGS_SAVE}
              onClick={() => void save()}
            >
              {saving ? 'Saving…' : changes?.signsParticipantsOut ? 'Save and sign participants out' : 'Save'}
            </button>
          </div>
          {status ? (
            <p className={styles.statusText} role="status" data-testid={E2E_TESTIDS.SESSION_SETTINGS_STATUS}>
              {status}
            </p>
          ) : null}
        </section>
      </div>
    </div>
  );
};

export default SessionSettingsPage;
