import React, { useMemo, useState } from 'react';

import {
  getAllSessionSlugs,
  getSessionConfigBySlug,
  getSessionConfigBySlugOrDefault,
  normalizeSessionSlug,
} from '../../utilities/web3/contractScripts.js';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { toStr } from '../../utilities/shared/primitives.js';
import styles from './TelegramDemoSetupPage.module.scss';
import {
  buildAgentBridgeTokenTemplateUrl,
  buildGeneratedAgentBridgeSecrets,
  buildTelegramDemoSetupPlan,
  deriveWorkersDevPublicUrl,
  normalizeAdditionalRpcUrl,
  normalizeAgentBridgeWorkerName,
  normalizeWorkersSubdomain,
  resolveSessionDefaultChainId,
  resolveSessionDefaultRpcUrl,
  resolveSessionWorkerBaseUrl,
  validateTelegramDemoSetup,
  DEFAULT_AGENT_BRIDGE_WORKER_NAME,
} from './telegramDemoSetupHelpers';

type SessionOption = {
  slug: string;
  label: string;
  config: Record<string, unknown>;
};

type Props = {
  activeSessionSlug?: string;
  sessionOptionsOverride?: SessionOption[];
};

const readSessionOptions = (): SessionOption[] => {
  const slugs = Array.from(new Set([
    ...((getAllSessionSlugs() || []) as string[]),
    normalizeSessionSlug('') || '',
  ]));
  const options = slugs
    .map((slug) => {
      const normalizedSlug = normalizeSessionSlug(slug || '') || '';
      const config = (
        normalizedSlug
          ? getSessionConfigBySlug(normalizedSlug)
          : getSessionConfigBySlugOrDefault('')
      ) as Record<string, unknown> | null;
      const sessionName = toStr(config?.sessionName || config?.name || normalizedSlug || 'General').trim();
      return {
        slug: normalizedSlug,
        label: sessionName || normalizedSlug || 'General',
        config: config || {},
      };
    })
    .filter((option, index, list) => (
      list.findIndex((entry) => entry.slug === option.slug) === index
    ));
  return options.length
    ? options
    : [{ slug: '', label: 'General', config: (getSessionConfigBySlugOrDefault('') as Record<string, unknown>) || {} }];
};

export default function TelegramDemoSetupPage({ activeSessionSlug = '', sessionOptionsOverride }: Props) {
  const sessionOptions = useMemo(
    () => (Array.isArray(sessionOptionsOverride) && sessionOptionsOverride.length ? sessionOptionsOverride : readSessionOptions()),
    [sessionOptionsOverride]
  );
  const initialSlug = normalizeSessionSlug(activeSessionSlug || '') || sessionOptions[0]?.slug || '';
  const [selectedSlug, setSelectedSlug] = useState(initialSlug);
  const [telegramBotToken, setTelegramBotToken] = useState('');
  const [telegramBotUsername, setTelegramBotUsername] = useState('');
  const [cloudflareApiToken, setCloudflareApiToken] = useState('');
  const [workerName, setWorkerName] = useState(DEFAULT_AGENT_BRIDGE_WORKER_NAME);
  const [workersSubdomain, setWorkersSubdomain] = useState('');
  const [additionalRpcUrl, setAdditionalRpcUrl] = useState('');
  const [includeWorkersDevSubdomainSetup, setIncludeWorkersDevSubdomainSetup] = useState(false);
  const [generatedSecrets, setGeneratedSecrets] = useState(() => buildGeneratedAgentBridgeSecrets());
  const [showPlan, setShowPlan] = useState(false);

  const selectedSession = sessionOptions.find((option) => option.slug === selectedSlug) || sessionOptions[0] || {
    slug: '',
    label: 'General',
    config: {},
  };
  const selectedConfig = selectedSession.config || {};
  const sessionWorkerBaseUrl = resolveSessionWorkerBaseUrl(selectedConfig);
  const defaultChainId = resolveSessionDefaultChainId(selectedConfig);
  const defaultRpcUrl = resolveSessionDefaultRpcUrl(selectedConfig);
  const normalizedExtraRpc = normalizeAdditionalRpcUrl(additionalRpcUrl, defaultRpcUrl);
  const normalizedWorkerName = normalizeAgentBridgeWorkerName(workerName);
  const normalizedWorkersSubdomain = normalizeWorkersSubdomain(workersSubdomain);
  const publicUrl = deriveWorkersDevPublicUrl({
    workerName: normalizedWorkerName,
    workersSubdomain: normalizedWorkersSubdomain,
  });
  const tokenTemplateUrl = buildAgentBridgeTokenTemplateUrl({
    sessionSlug: selectedSession.slug || 'general',
    includeWorkersDevSubdomainSetup,
  });
  const plan = buildTelegramDemoSetupPlan({
    sessionSlug: selectedSession.slug || 'general',
    sessionWorkerBaseUrl,
    telegramBotToken,
    telegramBotUsername,
    cloudflareApiToken,
    workerName: normalizedWorkerName,
    workersSubdomain: normalizedWorkersSubdomain,
    defaultChainId,
    defaultRpcUrl,
    additionalRpcUrl: normalizedExtraRpc,
    generatedSecrets,
  });
  const validation = validateTelegramDemoSetup(plan);

  const statusClass = validation.ok ? styles.statusReady : styles.statusBlocked;
  const statusText = validation.ok
    ? 'Plan is ready for mocked deploy/test. Live deploy remains disabled until credentials are pasted and deploy is explicitly enabled.'
    : `Missing: ${validation.missing.join(', ')}`;

  const regenerateSecrets = () => {
    setGeneratedSecrets(buildGeneratedAgentBridgeSecrets());
    setShowPlan(false);
  };

  const field = (
    id: string,
    label: string,
    value: string,
    setValue: (next: string) => void,
    {
      type = 'text',
      placeholder = '',
      wide = false,
    }: {
      type?: string;
      placeholder?: string;
      wide?: boolean;
    } = {}
  ) => (
    <label className={`${styles.field} ${wide ? styles.fieldWide : ''}`}>
      <span className={styles.label}>{label}</span>
      <input
        className={styles.input}
        data-testid={id}
        type={type}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(event) => {
          setValue(event.target.value);
          setShowPlan(false);
        }}
      />
    </label>
  );

  return (
    <main className={styles.page} data-testid={E2E_TESTIDS.PAGE_TELEGRAM_DEMO_SETUP_ROOT}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>Private demo setup</p>
          <h1 className={styles.title}>Telegram Demo Setup</h1>
          <p className={styles.subtitle}>
            Configure the private agent bridge for Telegram preferences, drafts, opaque actions,
            event logs, webhook acknowledgement, and managed demo account state.
          </p>
        </header>

        <div className={styles.grid}>
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Select CE Session</h2>
              <span className={styles.sectionStatus}>Session worker remains canonical</span>
            </div>
            <label className={styles.field}>
              <span className={styles.label}>Session</span>
              <select
                className={styles.select}
                data-testid={E2E_TESTIDS.TELEGRAM_DEMO_SESSION_SELECT}
                value={selectedSession.slug}
                onChange={(event) => {
                  setSelectedSlug(event.target.value);
                  setShowPlan(false);
                }}
              >
                {sessionOptions.map((option) => (
                  <option key={option.slug || 'general'} value={option.slug}>
                    {option.label} {option.slug ? `(${option.slug})` : '(general)'}
                  </option>
                ))}
              </select>
            </label>
            <div className={styles.field}>
              <span className={styles.label}>CE_SESSION_WORKER_BASE_URL</span>
              <div className={styles.readonly}>{sessionWorkerBaseUrl || 'Missing from selected session'}</div>
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Telegram Bot Credentials</h2>
              <span className={styles.sectionStatus}>Paste later from BotFather</span>
            </div>
            <div className={styles.fieldGrid}>
              {field(
                E2E_TESTIDS.TELEGRAM_DEMO_BOT_TOKEN,
                'TELEGRAM_BOT_TOKEN',
                telegramBotToken,
                setTelegramBotToken,
                { type: 'password', placeholder: '123456:example-token', wide: true }
              )}
              {field(
                E2E_TESTIDS.TELEGRAM_DEMO_BOT_USERNAME,
                'TELEGRAM_BOT_USERNAME',
                telegramBotUsername,
                setTelegramBotUsername,
                { placeholder: 'ce_demo_bot', wide: true }
              )}
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Cloudflare Deployment Token</h2>
              <span className={styles.sectionStatus}>Account ID is derived</span>
            </div>
            {field(
              E2E_TESTIDS.TELEGRAM_DEMO_CLOUDFLARE_API_TOKEN,
              'CLOUDFLARE_API_TOKEN',
              cloudflareApiToken,
              setCloudflareApiToken,
              { type: 'password', placeholder: 'Paste deploy token', wide: true }
            )}
            <label className={styles.secretRow}>
              <span>Include Account Settings: Edit</span>
              <input
                type="checkbox"
                checked={includeWorkersDevSubdomainSetup}
                onChange={(event) => {
                  setIncludeWorkersDevSubdomainSetup(event.target.checked);
                  setShowPlan(false);
                }}
              />
            </label>
            <a className={styles.tokenLink} href={tokenTemplateUrl} target="_blank" rel="noreferrer">
              Open scoped token template
            </a>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Worker URL / Deploy Plan</h2>
              <span className={styles.sectionStatus}>Workers.dev first demo</span>
            </div>
            <div className={styles.fieldGrid}>
              {field(E2E_TESTIDS.TELEGRAM_DEMO_WORKER_NAME, 'Worker name', workerName, setWorkerName)}
              {field(E2E_TESTIDS.TELEGRAM_DEMO_WORKERS_SUBDOMAIN, 'Workers subdomain', workersSubdomain, setWorkersSubdomain)}
              <div className={`${styles.field} ${styles.fieldWide}`}>
                <span className={styles.label}>AGENT_BRIDGE_PUBLIC_URL</span>
                <div className={styles.readonly} data-testid={E2E_TESTIDS.TELEGRAM_DEMO_PUBLIC_URL}>
                  {publicUrl}
                </div>
              </div>
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>RPC Settings</h2>
              <span className={styles.sectionStatus}>Default POKT preserved</span>
            </div>
            <div className={styles.fieldGrid}>
              <div className={styles.field}>
                <span className={styles.label}>DEFAULT_CHAIN_ID</span>
                <div className={styles.readonly}>{String(defaultChainId)}</div>
              </div>
              <div className={`${styles.field} ${styles.fieldWide}`}>
                <span className={styles.label}>DEFAULT_RPC_URL</span>
                <div className={styles.readonly} data-testid={E2E_TESTIDS.TELEGRAM_DEMO_DEFAULT_RPC_URL}>
                  {defaultRpcUrl}
                </div>
              </div>
              {field(
                E2E_TESTIDS.TELEGRAM_DEMO_ADDITIONAL_RPC_URL,
                'Additional RPC URL',
                additionalRpcUrl,
                setAdditionalRpcUrl,
                { placeholder: 'https://optional-fallback.example/rpc', wide: true }
              )}
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Generated Secrets</h2>
              <span className={styles.sectionStatus}>Uploaded as Worker secrets</span>
            </div>
            <div data-testid={E2E_TESTIDS.TELEGRAM_DEMO_GENERATED_SECRETS}>
              <div className={styles.secretRow}>
                <span>TELEGRAM_WEBHOOK_SECRET</span>
                <span className={styles.pill}>generated</span>
              </div>
              <div className={styles.secretRow}>
                <span>DEMO_SIGNER_ROOT_SECRET</span>
                <span className={styles.pill}>generated</span>
              </div>
            </div>
            <button type="button" className={styles.secondaryButton} onClick={regenerateSecrets}>
              Regenerate secrets
            </button>
          </section>

          <section className={`${styles.section} ${styles.sectionWide}`}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Deploy / Test Checklist</h2>
              <span className={styles.sectionStatus}>Network calls mocked here</span>
            </div>
            {[
              'Derive one Cloudflare account from token',
              'Create or reuse KV and Durable Object binding',
              'Add R2/D1 only when doc storage is explicitly enabled',
              'Upload worker vars and redacted secrets',
              'Enable Workers.dev route and set Telegram webhook',
              'Smoke /start, /join, /questions, /docs, /me',
            ].map((item) => (
              <div key={item} className={styles.checkRow}>
                <span>{item}</span>
                <span className={styles.pill}>plan</span>
              </div>
            ))}
            <div className={styles.buttonRow}>
              <button
                type="button"
                className={styles.button}
                data-testid={E2E_TESTIDS.TELEGRAM_DEMO_BUILD_PLAN}
                onClick={() => setShowPlan(true)}
              >
                Build deploy plan
              </button>
              <div
                className={`${styles.status} ${statusClass}`}
                data-testid={E2E_TESTIDS.TELEGRAM_DEMO_STATUS}
              >
                {statusText}
              </div>
            </div>
            {showPlan && (
              <pre className={styles.plan}>
                {JSON.stringify({ validation, plan }, null, 2)}
              </pre>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
