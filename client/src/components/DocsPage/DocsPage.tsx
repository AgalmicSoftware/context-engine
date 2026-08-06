import React, { useState, useEffect, useMemo, useRef } from 'react';
import { connect } from 'react-redux';
import {
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
import { faExpand, faCaretDown, faCaretUp, faCopy, faCheck } from '@fortawesome/free-solid-svg-icons';
import { notify } from '../../utilities/ui/notify.js';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { buildPublicRoute, stripPublicUrlBasePath } from '../../utilities/ui/publicUrl.js';
import { DEFAULT_CHAIN_ID } from '../../variables/appConfig.js';
import { resolveDocsPageActiveSession, resolveDocsPageReferrerSlug } from './docsPageSessionResolution.js';
import ContractViewer, { type ContractViewerContract } from './ContractViewer';
import { normalizeContractKeyParam } from './contractMetadata.js';
import { buildContractViewerContracts } from './contractViewerUtils.js';
import { DOCS_PAGE_COPY, FAQ_ITEMS, GUIDE_TOPICS, QUICKSTART_STEPS } from './docsContent.js';
import { sbtsListPath, t } from '../../utilities/ui/terminology.js';
import { buildPublicContractSourceUrl } from '../../variables/publicRepoMetadata.js';
import { resolveSessionCapabilityProjection } from '../../utilities/session/sessionCapabilityProjection';

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

  const canonicalSlug = activeSession?.slug || ''; // '' means general
  const sessionCapabilities = useMemo(() => resolveSessionCapabilityProjection(activeSession), [activeSession]);
  const contributesSessionContracts = sessionCapabilities.usesChainMetadata;

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

    if (hasExplicitSessionQuery && canonicalSlug) {
      if (nextUrl.searchParams.get('session') !== canonicalSlug) {
        nextUrl.searchParams.set('session', canonicalSlug);
        changed = true;
      }
    } else if (hasExplicitSessionQuery && nextUrl.searchParams.has('session')) {
      nextUrl.searchParams.delete('session');
      changed = true;
    }

    if (changed) {
      window.history.replaceState(null, '', `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
    }
  }, [urlSlugLike, canonicalSlug, hasExplicitSessionQuery]);

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
      contributesSessionContracts && activeSession?.contracts && typeof activeSession.contracts === 'object'
        ? (activeSession.contracts as SessionContractsMap)
        : {},
    [activeSession?.contracts, contributesSessionContracts],
  );
  const firstContract = Object.values(sessionContracts)[0] || null;
  const sessionNetworkChainId = contributesSessionContracts ? activeSession?.networkChainId : undefined;
  const resolvedChainId =
    Number(sessionNetworkChainId || firstContract?.chainId || DEFAULT_CHAIN_ID) || Number(DEFAULT_CHAIN_ID);
  const sessionLabel = String(activeSession?.sessionName || canonicalSlug || 'Default (general)');
  const contracts = useMemo(() => {
    const chainId = Number(sessionNetworkChainId || firstContract?.chainId || 0) || undefined;
    return buildContractsForViewer({
      sessionContracts,
      chainId,
      includeSessionRegistry: contributesSessionContracts,
      includeCustomSBT: true,
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

  return (
    <div className={styles.docsPage} data-testid={E2E_TESTIDS.PAGE_DOCS_ROOT}>
      <header className={styles.docsHeader}>
        <h1>{DOCS_PAGE_COPY.title}</h1>
        <p>{DOCS_PAGE_COPY.introduction}</p>
      </header>

      <DocsSection id="quickstart" title="Quickstart" defaultOpen>
        <ol className={styles.quickstartList}>
          {QUICKSTART_STEPS.map((step) => (
            <li key={step.id} className={styles.quickstartStep}>
              <h2>{step.title}</h2>
              <p>{step.body}</p>
              {step.linkHref ? (
                <a href={buildPublicRoute(step.linkHref)} className={styles.docsInlineLink}>
                  Open {step.linkHref}
                </a>
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
              <p>{topic.summary}</p>
              <ul>
                {topic.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
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

      {!contributesSessionContracts ? (
        <aside
          className={styles.advancedExternalNotice}
          data-testid={E2E_TESTIDS.CONTRACTS_ADVANCED_EXTERNAL_NOTICE}
          aria-label="Advanced external on-chain tools"
        >
          <strong>Advanced/external on-chain tools</strong>
          {sessionCapabilities.usesWorkerGroups ? (
            <span>
              These global contract references are optional and are not part of this session&apos;s Worker-native Groups
              or authority.
            </span>
          ) : (
            <span>
              These global contract references are optional and are not inferred as part of this session&apos;s
              authority.
            </span>
          )}
        </aside>
      ) : null}
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
    </div>
  );
};

const mapStateToProps = (state: { sessionState?: { activeSessionSlug?: string } }) => ({
  reduxActiveSessionSlug: state.sessionState?.activeSessionSlug || '',
});

export default connect(mapStateToProps)(DocsPage);
