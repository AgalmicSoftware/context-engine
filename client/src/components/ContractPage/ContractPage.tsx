import React, { useState, useEffect, useMemo, useRef } from 'react';
import { connect } from 'react-redux';
import {
  base64urlToBase64,
  base64urlToHex,
  hexToBase64url,
} from '../../domains/storage/arweaveEncoding.js';
import {
  getDemoSessionConfigBySlug,
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
import styles from './ContractPage.module.scss';
//
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExpand, faCaretDown, faCaretUp, faCopy, faCheck } from '@fortawesome/free-solid-svg-icons';
import { deserializeFilterState } from '../../utilities/survey/filterStateUtils.js'; // Added import
import { notify } from '../../utilities/ui/notify.js';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import {
  buildPublicRoute,
  stripPublicUrlBasePath,
} from '../../utilities/ui/publicUrl.js';
import {
  resolveContractPageActiveSession,
  resolveContractPageReferrerSlug,
} from './contractPageSessionResolution.js';
import ContractViewer, { type ContractViewerContract } from './ContractViewer';
import { normalizeContractKeyParam } from './contractMetadata.js';
import { buildContractViewerContracts } from './contractViewerUtils.js';
import { sbtsListPath, t } from '../../utilities/ui/terminology.js';
import { buildPublicContractSourceUrl } from '../../variables/publicRepoMetadata.js';

type ContractPageProps = {
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

const buildContractsForViewer = buildContractViewerContracts as (options?: {
  sessionContracts?: SessionContractsMap;
  chainId?: number;
  includeSessionRegistry?: boolean;
  includeCustomSBT?: boolean;
}) => ContractViewerContract[];

export const ContractPage = ({ activeSessionSlug, reduxActiveSessionSlug }: ContractPageProps) => {
  // Parse potential slug/key from URL: /contracts/:slugOrKey
  const path = stripPublicUrlBasePath((typeof window !== 'undefined' ? window.location.pathname : '') || '');
  const search = (typeof window !== 'undefined' ? window.location.search : '') || '';
  const parts = path.split('/').filter(Boolean);
  const urlSlugLike = parts[0] === 'contracts' && parts.length > 1 ? parts[1] : undefined;
  const searchParams = new URLSearchParams(search);
  const querySessionRaw = searchParams.get('session') || undefined;
  const deepLinkedContractKey = normalizeContractKeyParam(searchParams.get('contract') || '');

  // Fallback: derive slug from referrer (covers full-page reload from /session/:slug)
  const referrerSlug = resolveContractPageReferrerSlug(
    (typeof document !== 'undefined' ? document.referrer : '') || ''
  );

  // Resolve session by URL first, then ?session, then routed/Redux context, then referrer, else default "general"
  const activeSession = resolveContractPageActiveSession({
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

  // Sync generic /contracts URLs to ?session= while preserving unrelated search params.
  useEffect(() => {
    if (typeof window === 'undefined' || urlSlugLike !== undefined) return;

    const nextUrl = new URL(window.location.href);
    let changed = false;

    const contractsPath = buildPublicRoute('/contracts');
    if (nextUrl.pathname !== contractsPath) {
      nextUrl.pathname = contractsPath;
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

    if (canonicalSlug) {
      if (nextUrl.searchParams.get('session') !== canonicalSlug) {
        nextUrl.searchParams.set('session', canonicalSlug);
        changed = true;
      }
    } else if (nextUrl.searchParams.has('session')) {
      nextUrl.searchParams.delete('session');
      changed = true;
    }

    if (changed) {
      window.history.replaceState(null, '', `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
    }
  }, [urlSlugLike, canonicalSlug]);

  const clusterAnalysisPromptDisplay = buildClusterAnalysisPrompt(
    {
      clusterIndex: '<ClusterIndex>',
      clusterSize: '<ClusterSize>',
      topStatements: '<TopStatements>',
    },
    {
      clusterCount: '<ClusterCount>',
      sizes: '<ClusterSizes>',
    }
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

  const promptItems = useMemo<PromptItem[]>(() => ([
    { id: 'seedGen', title: 'Question Generation', file: 'seedGenPrompt.js', content: seedGenPrompt },
    { id: 'questionSelection', title: 'Question Selection', file: 'questionSelectionPrompt.js', content: questionSelectionPrompt },
    { id: 'audioSummary', title: 'Audio Summary', file: 'audioSummaryPrompt.js', content: audioSummaryPrompt },
    { id: 'photoAnalysis', title: 'Photo Analysis', file: 'photoAnalysisPrompt.js', content: photoAnalysisPromptDisplay },
    { id: 'compareToolkit', title: 'Compare Toolkit', file: 'compareToolkitPrompt.js', content: compareToolkitPromptDisplay },
    { id: 'clusterAnalysisSystem', title: 'Cluster Analysis (System)', file: 'clusterAnalysisPrompt.js', content: CLUSTER_ANALYSIS_SYSTEM_PROMPT },
    { id: 'clusterAnalysis', title: 'Cluster Analysis (User)', file: 'clusterAnalysisPrompt.js', content: clusterAnalysisPromptDisplay },
    { id: 'userAnalysis', title: 'User Analysis', file: 'userAnalysisPrompt.js', content: userAnalysisPromptDisplay },
    { id: 'aiRewrite', title: 'AI Rewrite', file: 'aiRewritePrompt.js', content: aiRewritePrompt },
  ]), [clusterAnalysisPromptDisplay, compareToolkitPromptDisplay, photoAnalysisPromptDisplay, userAnalysisPromptDisplay]);

  const sessionNetworkChainId = activeSession?.networkChainId;
  const contracts = useMemo(() => {
    const sessionContracts = (
      activeSession?.contracts &&
      typeof activeSession.contracts === 'object'
        ? activeSession.contracts as SessionContractsMap
        : {}
    );
    const firstContract = Object.values(sessionContracts)[0] || null;
    const chainId = Number(sessionNetworkChainId || firstContract?.chainId || 0) || undefined;
    return buildContractsForViewer({
      sessionContracts,
      chainId,
      includeSessionRegistry: true,
      includeCustomSBT: true,
    }).map((contract) => (
      contract.key === 'sbtFactory'
        ? {
            ...contract,
            extraAction: (
              <button onClick={() => (window.location.href = buildPublicRoute(sbtsListPath()))} className={styles.backButton}>
                <FontAwesomeIcon icon={faExpand} /> {`${t('sbts')} list`}
              </button>
            ),
          }
        : contract
    ));
  }, [activeSession?.contracts, sessionNetworkChainId]);

  const [bytes32Input, setBytes32Input] = useState('');
  const [base64urlInput, setBase64urlInput] = useState('');
  const [base64urlOutput, setBase64urlOutput] = useState('');
  const [bytes32Output, setBytes32Output] = useState('');
  const [base64Output, setBase64Output] = useState('');
  const [utilsOpen, setUtilsOpen] = useState(true);
  const [promptsOpen, setPromptsOpen] = useState(false);
  const [jsonOpen, setJsonOpen] = useState(false);
  const [openPromptItems, setOpenPromptItems] = useState<Record<string, boolean>>({});
  const [copiedPromptKey, setCopiedPromptKey] = useState('');
  const [copiedJson, setCopiedJson] = useState(false);
  const copyResetTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // New state variables for filter deserialization utility
  const [filterUrlInput, setFilterUrlInput] = useState('');
  const [deserializedFilterObjectOutput, setDeserializedFilterObjectOutput] = useState('');

  useEffect(() => () => {
    copyResetTimersRef.current.forEach((timerId) => clearTimeout(timerId));
    copyResetTimersRef.current.clear();
  }, []);

  const scheduleCopyReset = (key: string, resetFn: () => void, delayMs = 1500) => {
    const timers = copyResetTimersRef.current;
    const existing = timers.get(key);
    if (existing) clearTimeout(existing);
    const timeoutId = setTimeout(() => {
      timers.delete(key);
      resetFn();
    }, Math.max(0, Number(delayMs) || 0));
    timers.set(key, timeoutId);
  };

  const handleBytes32ToBase64url = () => {
    setBase64urlOutput(hexToBase64url(bytes32Input));
  };

  const handleBase64urlToBytes32 = () => {
    setBytes32Output(base64urlToHex(base64urlInput));
  };

  const handleBase64urlToBase64 = () => {
    setBase64Output(base64urlToBase64(base64urlInput));
  };

  // New handler function for deserializing filter URL/param
  const handleDeserializeFilterUrl = () => {
    let serializedParam = filterUrlInput;
    if (filterUrlInput.includes('/results/')) {
      const parts = filterUrlInput.split('/results/');
      serializedParam = parts.pop() || ''; // Get the last part, or empty string if pop returns undefined
    }
    // Remove query parameters if present
    if (serializedParam.includes('?')) {
      serializedParam = serializedParam.split('?')[0];
    }

    const deserializedObject = deserializeFilterState(serializedParam);
    const jsonOutput = JSON.stringify(deserializedObject, null, 2);
    setDeserializedFilterObjectOutput(jsonOutput);
  };

  const handleCopyPrompt = (promptKey: string, content: string) => {
    if (!content || typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return;
    navigator.clipboard.writeText(content)
      .then(() => {
        notify.success('Copied to clipboard');
        setCopiedPromptKey(promptKey);
        scheduleCopyReset('copiedPromptKey', () => setCopiedPromptKey(''));
      })
      .catch((e) => { void e; notify.warn('Copy failed'); });
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
          {'<'}{match[1]}{'>'}
        </span>
      );
      lastIndex = re.lastIndex;
    }

    if (lastIndex < text.length) parts.push(text.slice(lastIndex));
    return parts;
  };

  const jsonBundleText = useMemo(() => JSON.stringify({
    contracts: contracts
      .filter((contract) => contract.source)
      .map((contract) => ({
        key: contract.key,
        name: contract.name,
        file: contract.sourceFile || '',
        source: contract.source || '',
      })),
    prompts: promptItems.map((prompt) => ({
      id: prompt.id,
      title: prompt.title,
      file: prompt.file,
      content: prompt.content || '',
    })),
  }, null, 2), [contracts, promptItems]);

  const handleCopyJsonBundle = () => {
    if (!jsonBundleText || typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return;
    navigator.clipboard.writeText(jsonBundleText)
      .then(() => {
        notify.success('Copied to clipboard');
        setCopiedJson(true);
        scheduleCopyReset('copiedJsonBundle', () => setCopiedJson(false));
      })
      .catch((e) => { void e; notify.warn('Copy failed'); });
  };

  return (
    <div className={styles.contractPage} data-testid={E2E_TESTIDS.PAGE_CONTRACTS_ROOT}>
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
      <div className={styles.promptsSection}>
        <button
          type="button"
          className={styles.promptsToggle}
          onClick={() => setPromptsOpen((prev) => !prev)}
          aria-expanded={promptsOpen}
          aria-controls="contract-prompts"
        >
          <span className={styles.promptsToggleLabel}>Prompts</span>
          <span className={styles.promptsToggleIcon}>
            <FontAwesomeIcon icon={promptsOpen ? faCaretUp : faCaretDown} />
          </span>
        </button>
        {promptsOpen && (
          <div id="contract-prompts" className={styles.promptsContent}>
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
                      <FontAwesomeIcon
                        icon={isOpen ? faCaretUp : faCaretDown}
                        className={styles.promptToggleIcon}
                      />
                    </div>
                  </div>
                  {isOpen && (
                    <pre
                      id={`prompt-${prompt.id}`}
                      className={styles.promptBlock}
                    >
                      {highlightPromptVariables(prompt.content || '(Prompt unavailable)')}
                    </pre>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div className={styles.jsonSection}>
        <button
          type="button"
          className={styles.jsonToggle}
          onClick={() => setJsonOpen((prev) => !prev)}
          aria-expanded={jsonOpen}
          aria-controls="contracts-json"
        >
          <span className={styles.jsonToggleLabel}>.json Bundle</span>
          <span className={styles.jsonToggleIcon}>
            <FontAwesomeIcon icon={jsonOpen ? faCaretUp : faCaretDown} />
          </span>
        </button>
        {jsonOpen && (
          <div id="contracts-json" className={styles.jsonContent}>
            <div className={styles.jsonHeader}>
              <span>Prompts + Smart Contracts</span>
              <button
                type="button"
                className={`${styles.copyButton} ${copiedJson ? styles.copyButtonSuccess : ''}`}
                onClick={handleCopyJsonBundle}
                aria-label="Copy JSON bundle"
                title="Copy JSON bundle"
              >
                <FontAwesomeIcon icon={copiedJson ? faCheck : faCopy} />
              </button>
            </div>
            <pre className={styles.jsonBlock}>{jsonBundleText}</pre>
          </div>
        )}
      </div>
      <div className={styles.converterSection}>
        <button
          type="button"
          className={styles.utilsToggle}
          onClick={() => setUtilsOpen((prev) => !prev)}
          aria-expanded={utilsOpen}
          aria-controls="contract-utils"
        >
          <span className={styles.utilsToggleLabel}>Utils</span>
          <span className={styles.utilsToggleIcon}>
            <FontAwesomeIcon icon={utilsOpen ? faCaretUp : faCaretDown} />
          </span>
        </button>
        {utilsOpen && (
          <div id="contract-utils" className={styles.utilsContent}>
            <div className={styles.converterSectionUtil}>
              <div className={styles.converterRow}>
                <input
                  type="text"
                  value={base64urlInput}
                  onChange={(e) => setBase64urlInput(e.target.value)}
                  placeholder="Enter Base64url"
                />
                <button onClick={handleBase64urlToBytes32}>Convert to Bytes32</button>
              </div>
              <div className={styles.utilsOutputLine}>Output: {bytes32Output}</div>
            </div>
            <div className={styles.converterSectionUtil}>
              <div className={styles.converterRow}>
                <input
                  type="text"
                  value={bytes32Input}
                  onChange={(e) => setBytes32Input(e.target.value)}
                  placeholder="Enter bytes32"
                />
                <button onClick={handleBytes32ToBase64url}>Convert to Base64url</button>
              </div>
              <div className={styles.utilsOutputLine}>Output: {base64urlOutput}</div>
            </div>
            <div className={styles.converterSectionUtil}>
              <div className={styles.converterRow}>
                <input
                  type="text"
                  value={base64urlInput} // Re-using base64urlInput for this example, consider renaming if it's confusing
                  onChange={(e) => setBase64urlInput(e.target.value)}
                  placeholder="Enter Base64url"
                />
                <button onClick={handleBase64urlToBase64}>Convert to Base64</button>
              </div>
              <div className={styles.utilsOutputLine}>Output: {base64Output}</div>
            </div>
            {/* New utility section for deserializing filter URL/param */}
            <div className={styles.converterSectionUtil}>
              <div className={styles.converterRow}>
                <input
                  type="text"
                  value={filterUrlInput}
                  onChange={(e) => setFilterUrlInput(e.target.value)}
                  placeholder="Enter Filter URL or Serialized Parameter"
                />
                <button onClick={handleDeserializeFilterUrl}>Deserialize Filter State</button>
              </div>
              <pre className={styles.utilsOutput}>{deserializedFilterObjectOutput}</pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const mapStateToProps = (state: { sessionState?: { activeSessionSlug?: string } }) => ({
  reduxActiveSessionSlug: state.sessionState?.activeSessionSlug || '',
});

export default connect(mapStateToProps)(ContractPage);
