import React, { useState, useEffect, useMemo, useRef } from 'react';
import { connect } from 'react-redux';
import {
  getAllSessionSlugs,
  getDemoSessionConfigBySlug,
  getSessionChainLabel,
  getSessionConfigBySlug,
  getSessionConfigBySlugOrDefault,
} from '../../domains/sessions/sessionConfig.js'; // smart contract info: addresses & content
import { seedGenPrompt } from '../../prompts/seedGenPrompt.js';
import { aiRewritePrompt } from '../../prompts/aiRewritePrompt.js';
import { audioSummaryPrompt } from '../../prompts/audioSummaryPrompt.js';
import buildClusterAnalysisPrompt, { CLUSTER_ANALYSIS_SYSTEM_PROMPT } from '../../prompts/clusterAnalysisPrompt.js';
import buildCompareToolkitPrompt from '../../prompts/compareToolkitPrompt.js';
import buildPhotoAnalysisPrompt from '../../prompts/photoAnalysisPrompt.js';
import { questionSelectionPrompt } from '../../prompts/questionSelectionPrompt.js';
import buildUserAnalysisPrompt from '../../prompts/userAnalysisPrompt.js';
// CSS
import styles from './DocsPage.module.scss';
//
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGithub } from '@fortawesome/free-brands-svg-icons';
import { faExpand, faCaretDown, faCaretUp, faCopy, faCheck } from '@fortawesome/free-solid-svg-icons';
import { notify } from '../../utilities/ui/notify.js';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { buildPublicRoute, stripPublicUrlBasePath } from '../../utilities/ui/publicUrl.js';
import { DEFAULT_CHAIN_ID } from '../../variables/appConfig.js';
import {
  resolveDocsPageActiveSession,
  resolveDocsPageReferrerSlug,
  resolveDocsPageSessionConfig,
} from './docsPageSessionResolution.js';
import ContractViewer, { type ContractViewerContract } from './ContractViewer';
import { normalizeContractKeyParam } from './contractMetadata.js';
import { buildContractViewerContracts } from './contractViewerUtils.js';
import { DOCS_PAGE_COPY, FAQ_ITEMS, GUIDE_TOPICS, QUICKSTART_STEPS } from './docsContent.js';
import { sbtsListPath, t } from '../../utilities/ui/terminology.js';
import { buildPublicContractSourceUrl, PUBLIC_REPO_URL } from '../../variables/publicRepoMetadata.js';
import { resolveSessionCapabilityProjection } from '../../utilities/session/sessionCapabilityProjection';
import { canonicalizeSessionSlug } from '../../utilities/session/canonicalSessionContext.js';

type DocsPageProps = {
  activeSessionSlug?: string;
  reduxActiveSessionSlug?: string;
};

type SessionContractEntry = {
  address?: string;
  contractAddress?: string;
  chainId?: number;
};

type SessionContractsMap = Record<string, SessionContractEntry>;

type PromptItem = {
  id: string;
  title: string;
  file: string;
  content: string;
};

type DocsSectionProps = {
  children: React.ReactNode;
  contentClassName?: string;
  defaultOpen?: boolean;
  id: string;
  title: string;
};

const DOCS_GENERAL_SESSION_SELECT_VALUE = '__general__';
const DOCS_GENERAL_SESSION_QUERY_VALUE = 'general';

const DocsSection = ({ children, contentClassName = '', defaultOpen = false, id, title }: DocsSectionProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const contentId = `docs-section-${id}`;

  return (
    <section className={styles.docsSection}>
      <button
        type="button"
        className={styles.docsSectionToggle}
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-controls={contentId}
      >
        <span className={styles.docsSectionToggleLabel}>{title}</span>
        <FontAwesomeIcon
          icon={isOpen ? faCaretUp : faCaretDown}
          className={styles.docsSectionToggleIcon}
          aria-hidden="true"
        />
      </button>
      {isOpen ? (
        <div id={contentId} className={`${styles.docsSectionContent} ${contentClassName}`.trim()}>
          {children}
        </div>
      ) : null}
    </section>
  );
};

const buildContractsForViewer = buildContractViewerContracts as (options?: {
  sessionContracts?: SessionContractsMap;
  chainId?: number;
  includeSessionRegistry?: boolean;
  includeAdvancedSourceTemplates?: boolean;
  includeCustomSBT?: boolean;
}) => ContractViewerContract[];

export const DocsPage = ({ activeSessionSlug, reduxActiveSessionSlug }: DocsPageProps) => {
  // Parse potential slug/key from URL: /docs/:slugOrKey (or the legacy /contracts alias).
  const path = stripPublicUrlBasePath((typeof window !== 'undefined' ? window.location.pathname : '') || '');
  const search = (typeof window !== 'undefined' ? window.location.search : '') || '';
  const parts = path.split('/').filter(Boolean);
  const urlSlugLike = (parts[0] === 'docs' || parts[0] === 'contracts') && parts.length > 1 ? parts[1] : undefined;
  const searchParams = new URLSearchParams(search);
  const hasExplicitSessionQuery = ['session', 'sessionSlug', 's'].some((key) => searchParams.has(key));
  const querySessionRaw = searchParams.has('session')
    ? searchParams.get('session') || ''
    : searchParams.get('sessionSlug') || searchParams.get('s') || undefined;
  const deepLinkedContractKey = normalizeContractKeyParam(searchParams.get('contract') || '');

  // Fallback: derive slug from referrer (covers full-page reload from /session/:slug)
  const referrerSlug = resolveDocsPageReferrerSlug((typeof document !== 'undefined' ? document.referrer : '') || '');

  // Resolve session by URL first, then ?session, then routed/Redux context, then referrer, else default "general"
  const activeSession = resolveDocsPageActiveSession({
    urlSlugLike,
    querySessionRaw,
    activeSessionSlug,
    reduxActiveSessionSlug,
    referrerSlug,
    resolveBySlug: getSessionConfigBySlug,
    resolveDemoBySlug: (slug: string) => getDemoSessionConfigBySlug(slug, { allowDemoFallback: true }),
    getDefaultSessionConfig: () => getSessionConfigBySlugOrDefault(''),
  });

  const hasExplicitContractSession = urlSlugLike !== undefined || hasExplicitSessionQuery;
  const explicitContractSessionRaw =
    urlSlugLike !== undefined ? urlSlugLike : hasExplicitSessionQuery ? querySessionRaw || '' : null;
  const explicitContractSessionConfig =
    explicitContractSessionRaw === null
      ? null
      : resolveDocsPageSessionConfig(explicitContractSessionRaw, {
          allowGeneral: true,
          resolveBySlug: getSessionConfigBySlug,
          resolveDemoBySlug: (slug: string) => getDemoSessionConfigBySlug(slug, { allowDemoFallback: true }),
          getDefaultSessionConfig: () => getSessionConfigBySlugOrDefault(''),
        });
  const explicitContractSessionSlug =
    explicitContractSessionRaw === null
      ? null
      : explicitContractSessionConfig?.slug !== undefined
        ? String(explicitContractSessionConfig.slug || '')
        : canonicalizeSessionSlug(explicitContractSessionRaw);
  const [selectedContractSessionSlug, setSelectedContractSessionSlug] = useState<string | null>(() =>
    hasExplicitContractSession ? explicitContractSessionSlug : null,
  );

  useEffect(() => {
    setSelectedContractSessionSlug(hasExplicitContractSession ? explicitContractSessionSlug : null);
  }, [explicitContractSessionSlug, hasExplicitContractSession]);

  const selectedSession = useMemo(
    () =>
      selectedContractSessionSlug === null
        ? null
        : resolveDocsPageSessionConfig(selectedContractSessionSlug, {
            allowGeneral: true,
            resolveBySlug: getSessionConfigBySlug,
            resolveDemoBySlug: (slug: string) => getDemoSessionConfigBySlug(slug, { allowDemoFallback: true }),
            getDefaultSessionConfig: () => getSessionConfigBySlugOrDefault(''),
          }),
    [selectedContractSessionSlug],
  );
  const sessionCapabilities = useMemo(() => resolveSessionCapabilityProjection(selectedSession), [selectedSession]);
  const contributesSessionContracts = sessionCapabilities.usesChainMetadata;

  const contractSessionOptions = useMemo(() => {
    const options = new Map<string, { label: string; slug: string; value: string }>();
    const pushOption = (slugIn: unknown = '') => {
      const slug = String(slugIn || '').trim();
      if (options.has(slug)) return;
      const config =
        getSessionConfigBySlug(slug) ||
        getDemoSessionConfigBySlug(slug, { allowDemoFallback: true }) ||
        (!slug ? getSessionConfigBySlugOrDefault('') : null);
      const sessionName = String(config?.sessionName || '').trim();
      const slugLabel = slug || 'General';
      const label =
        sessionName && sessionName.toLowerCase() !== slugLabel.toLowerCase()
          ? `${sessionName} (${slugLabel})`
          : sessionName || slugLabel;
      options.set(slug, {
        slug,
        label,
        value: slug || DOCS_GENERAL_SESSION_SELECT_VALUE,
      });
    };

    if (selectedContractSessionSlug !== null) pushOption(selectedContractSessionSlug);
    pushOption(activeSession?.slug);
    pushOption(activeSessionSlug);
    pushOption(reduxActiveSessionSlug);
    pushOption('');
    getAllSessionSlugs({ includeEmpty: true }).forEach(pushOption);
    return Array.from(options.values());
  }, [activeSession?.slug, activeSessionSlug, reduxActiveSessionSlug, selectedContractSessionSlug]);

  const selectedContractSessionValue =
    selectedContractSessionSlug === null
      ? ''
      : selectedContractSessionSlug || DOCS_GENERAL_SESSION_SELECT_VALUE;

  // Sync generic docs URLs to /docs?session= while preserving unrelated search params.
  useEffect(() => {
    if (typeof window === 'undefined' || urlSlugLike !== undefined) return;

    const nextUrl = new URL(window.location.href);
    let changed = false;

    const docsPath = buildPublicRoute('/docs');
    if (nextUrl.pathname !== docsPath) {
      nextUrl.pathname = docsPath;
      changed = true;
    }

    if (nextUrl.searchParams.has('sessionSlug')) {
      nextUrl.searchParams.delete('sessionSlug');
      changed = true;
    }
    if (nextUrl.searchParams.has('s')) {
      nextUrl.searchParams.delete('s');
      changed = true;
    }

    if (hasExplicitSessionQuery) {
      const sessionQueryValue = explicitContractSessionSlug || DOCS_GENERAL_SESSION_QUERY_VALUE;
      if (nextUrl.searchParams.get('session') !== sessionQueryValue) {
        nextUrl.searchParams.set('session', sessionQueryValue);
        changed = true;
      }
    }

    if (changed) {
      window.history.replaceState(null, '', `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
    }
  }, [urlSlugLike, explicitContractSessionSlug, hasExplicitSessionQuery]);

  const clusterAnalysisPromptDisplay = buildClusterAnalysisPrompt(
    {
      clusterIndex: '<ClusterIndex>',
      clusterSize: '<ClusterSize>',
      topStatements: '<TopStatements>',
    },
    {
      clusterCount: '<ClusterCount>',
      sizes: '<ClusterSizes>',
    },
  );

  const compareToolkitPromptDisplay = buildCompareToolkitPrompt({
    task: '<task>',
    users: '<users>',
    pointText: '<pointText>',
    type: '<type>',
  });

  const userAnalysisPromptDisplay = buildUserAnalysisPrompt({
    address: '<Address>',
    sbts: '<SBTs>',
    responses: '<Responses>',
    createdCounts: '<CreatedCounts>',
  });
  const photoAnalysisPromptDisplay = buildPhotoAnalysisPrompt('<SourceFilename>');

  const promptItems = useMemo<PromptItem[]>(
    () => [
      { id: 'seedGen', title: 'Question Generation', file: 'seedGenPrompt.js', content: seedGenPrompt },
      {
        id: 'questionSelection',
        title: 'Question Selection',
        file: 'questionSelectionPrompt.js',
        content: questionSelectionPrompt,
      },
      { id: 'audioSummary', title: 'Audio Summary', file: 'audioSummaryPrompt.js', content: audioSummaryPrompt },
      {
        id: 'photoAnalysis',
        title: 'Photo Analysis',
        file: 'photoAnalysisPrompt.js',
        content: photoAnalysisPromptDisplay,
      },
      {
        id: 'compareToolkit',
        title: 'Compare Toolkit',
        file: 'compareToolkitPrompt.js',
        content: compareToolkitPromptDisplay,
      },
      {
        id: 'clusterAnalysisSystem',
        title: 'Cluster Analysis (System)',
        file: 'clusterAnalysisPrompt.js',
        content: CLUSTER_ANALYSIS_SYSTEM_PROMPT,
      },
      {
        id: 'clusterAnalysis',
        title: 'Cluster Analysis (User)',
        file: 'clusterAnalysisPrompt.js',
        content: clusterAnalysisPromptDisplay,
      },
      { id: 'userAnalysis', title: 'User Analysis', file: 'userAnalysisPrompt.js', content: userAnalysisPromptDisplay },
      { id: 'aiRewrite', title: 'AI Rewrite', file: 'aiRewritePrompt.js', content: aiRewritePrompt },
    ],
    [clusterAnalysisPromptDisplay, compareToolkitPromptDisplay, photoAnalysisPromptDisplay, userAnalysisPromptDisplay],
  );

  const sessionContracts = useMemo<SessionContractsMap>(
    () =>
      contributesSessionContracts && selectedSession?.contracts && typeof selectedSession.contracts === 'object'
        ? (selectedSession.contracts as SessionContractsMap)
        : {},
    [contributesSessionContracts, selectedSession?.contracts],
  );
  const firstContract = Object.values(sessionContracts)[0] || null;
  const sessionNetworkChainId = contributesSessionContracts ? selectedSession?.networkChainId : undefined;
  const resolvedChainId =
    Number(sessionNetworkChainId || firstContract?.chainId || DEFAULT_CHAIN_ID) || Number(DEFAULT_CHAIN_ID);
  const resolvedChainLabel = contributesSessionContracts
    ? getSessionChainLabel(resolvedChainId)
    : 'Not used by this session';
  const sessionLabel = String(
    selectedSession?.sessionName || selectedContractSessionSlug || 'Default (general)',
  );
  const contracts = useMemo(() => {
    const chainId = Number(sessionNetworkChainId || firstContract?.chainId || 0) || undefined;
    return buildContractsForViewer({
      sessionContracts,
      chainId,
      includeSessionRegistry: contributesSessionContracts,
      includeCustomSBT: false,
    }).map((contract) =>
      contract.key === 'sbtFactory'
        ? {
            ...contract,
            extraAction: (
              <button
                onClick={() => (window.location.href = buildPublicRoute(sbtsListPath()))}
                className={styles.backButton}
              >
                <FontAwesomeIcon icon={faExpand} /> {`${t('sbts')} list`}
              </button>
            ),
          }
        : contract,
    );
  }, [contributesSessionContracts, firstContract?.chainId, sessionContracts, sessionNetworkChainId]);

  const [openPromptItems, setOpenPromptItems] = useState<Record<string, boolean>>({});
  const [copiedPromptKey, setCopiedPromptKey] = useState('');
  const copyResetTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(
    () => () => {
      copyResetTimersRef.current.forEach((timerId) => clearTimeout(timerId));
      copyResetTimersRef.current.clear();
    },
    [],
  );

  const scheduleCopyReset = (key: string, resetFn: () => void, delayMs = 1500) => {
    const timers = copyResetTimersRef.current;
    const existing = timers.get(key);
    if (existing) clearTimeout(existing);
    const timeoutId = setTimeout(
      () => {
        timers.delete(key);
        resetFn();
      },
      Math.max(0, Number(delayMs) || 0),
    );
    timers.set(key, timeoutId);
  };

  const handleCopyPrompt = (promptKey: string, content: string) => {
    if (!content || typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return;
    navigator.clipboard
      .writeText(content)
      .then(() => {
        notify.success('Copied to clipboard');
        setCopiedPromptKey(promptKey);
        scheduleCopyReset('copiedPromptKey', () => setCopiedPromptKey(''));
      })
      .catch((e) => {
        void e;
        notify.warn('Copy failed');
      });
  };

  const handlePromptToggle = (promptId: string) => {
    setOpenPromptItems((prev) => ({
      ...prev,
      [promptId]: !prev[promptId],
    }));
  };

  const handlePromptKeyDown = (event: React.KeyboardEvent<HTMLDivElement>, promptId: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handlePromptToggle(promptId);
    }
  };

  const highlightPromptVariables = (str: string): React.ReactNode => {
    if (!str) return null;
    const text = String(str);
    const re = /<([A-Za-z][A-Za-z0-9_]*)>/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = re.exec(text)) !== null) {
      if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
      parts.push(
        <span key={match.index} className={styles.promptVar}>
          {'<'}
          {match[1]}
          {'>'}
        </span>,
      );
      lastIndex = re.lastIndex;
    }

    if (lastIndex < text.length) parts.push(text.slice(lastIndex));
    return parts;
  };

  const renderDocsInlineCode = (str: string): React.ReactNode => {
    const text = String(str || '');
    const re = /`([^`\n]+)`/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = re.exec(text)) !== null) {
      if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
      parts.push(
        <code key={match.index} className={styles.docsInlineCode}>
          {match[1]}
        </code>,
      );
      lastIndex = re.lastIndex;
    }

    if (lastIndex < text.length) parts.push(text.slice(lastIndex));
    return parts;
  };

  return (
    <div className={styles.docsPage} data-testid={E2E_TESTIDS.PAGE_DOCS_ROOT}>
      <header className={styles.docsHeader}>
        <div className={styles.docsTitleRow}>
          <h1>{DOCS_PAGE_COPY.title}</h1>
          <a
            href={PUBLIC_REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.docsRepoLink}
            data-testid={E2E_TESTIDS.DOCS_GITHUB_LINK}
            aria-label="View Context Engine on GitHub"
            title="View Context Engine on GitHub"
          >
            <FontAwesomeIcon icon={faGithub} aria-hidden="true" />
          </a>
        </div>
        <p>{DOCS_PAGE_COPY.introduction}</p>
      </header>

      <DocsSection id="quickstart" title="Quickstart" defaultOpen>
        <ol className={styles.quickstartList}>
          {QUICKSTART_STEPS.map((step) => (
            <li key={step.id} className={styles.quickstartStep}>
              <h2>{step.title}</h2>
              <p>{renderDocsInlineCode(step.body)}</p>
              {step.links?.length ? (
                <div className={styles.docsInlineLinks}>
                  {step.links.map((link) => (
                    <a key={link.href} href={buildPublicRoute(link.href)} className={styles.docsInlineLink}>
                      {link.label}
                    </a>
                  ))}
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      </DocsSection>

      <DocsSection id="session-options" title="Session options guide">
        <div className={styles.guideTopics}>
          {GUIDE_TOPICS.map((topic) => (
            <article key={topic.id} className={styles.guideTopic}>
              <h2>{topic.title}</h2>
              <p>{renderDocsInlineCode(topic.summary)}</p>
              <ul>
                {topic.points.map((point) => (
                  <li key={point}>{renderDocsInlineCode(point)}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </DocsSection>

      <DocsSection id="prompts" title="Prompts" contentClassName={styles.promptsContent}>
        {promptItems.map((prompt) => {
          const isOpen = !!openPromptItems[prompt.id];
          return (
            <div key={prompt.id} className={`${styles.promptWindow} ${isOpen ? styles.promptWindowOpen : ''}`}>
              <div
                className={styles.promptHeader}
                role="button"
                tabIndex={0}
                onClick={() => handlePromptToggle(prompt.id)}
                onKeyDown={(event) => handlePromptKeyDown(event, prompt.id)}
                aria-expanded={isOpen}
                aria-controls={`prompt-${prompt.id}`}
              >
                <div className={styles.promptTitle}>
                  <span>{prompt.title}</span>
                  <span className={styles.promptFile}>{prompt.file}</span>
                </div>
                <div className={styles.promptHeaderActions}>
                  <button
                    type="button"
                    className={`${styles.copyButton} ${copiedPromptKey === prompt.id ? styles.copyButtonSuccess : ''}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      handleCopyPrompt(prompt.id, prompt.content);
                    }}
                    aria-label="Copy prompt"
                    title="Copy prompt"
                  >
                    <FontAwesomeIcon icon={copiedPromptKey === prompt.id ? faCheck : faCopy} />
                  </button>
                  <FontAwesomeIcon icon={isOpen ? faCaretUp : faCaretDown} className={styles.promptToggleIcon} />
                </div>
              </div>
              {isOpen ? (
                <pre id={`prompt-${prompt.id}`} className={styles.promptBlock}>
                  {highlightPromptVariables(prompt.content || '(Prompt unavailable)')}
                </pre>
              ) : null}
            </div>
          );
        })}
      </DocsSection>

      <DocsSection id="faq" title="FAQ">
        <div className={styles.faqItems}>
          {FAQ_ITEMS.map((item) => (
            <article key={item.id} className={styles.faqItem}>
              <h2>{item.question}</h2>
              <p>{item.answer}</p>
            </article>
          ))}
        </div>
      </DocsSection>

      <div className={styles.sessionContractsGroup} data-testid={E2E_TESTIDS.DOCS_SESSION_CONTRACTS_GROUP}>
        <div className={styles.sessionContext} data-testid={E2E_TESTIDS.DOCS_SESSION_CONTEXT}>
          <span>
            <strong>Session:</strong> {sessionLabel}
          </span>
          <span aria-hidden="true">{' · '}</span>
          <span>
            <strong>Chain:</strong> {getSessionChainLabel(resolvedChainId)}
          </span>
        </div>
        <ContractViewer
          contracts={contracts}
          autoOpenContractKey={deepLinkedContractKey}
          renderSourceHeaderActions={(contract) => {
            const sourceUrl = buildPublicContractSourceUrl(contract?.sourceFile || '');
            if (!sourceUrl) return null;

            return (
              <a
                href={sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.sourceActionLink}
                data-testid={`ce-contract-view-source-${contract.key}`}
              >
                View Source
              </a>
            );
          }}
        />
      </div>
    </div>
  );
};

const mapStateToProps = (state: { sessionState?: { activeSessionSlug?: string } }) => ({
  reduxActiveSessionSlug: state.sessionState?.activeSessionSlug || '',
});

export default connect(mapStateToProps)(DocsPage);
