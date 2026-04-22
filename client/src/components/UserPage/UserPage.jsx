/** @file UserPage.jsx */
import React, { Component } from 'react';
import styles from './UserPage.module.scss';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCopy,
  faCheck,
  faExpand,
  faSpinner,
  faExternalLinkAlt,
  faBookmark,
  faChevronDown,
  faChevronUp,
  faExclamationTriangle,
  faSync,
  faPen
} from '@fortawesome/free-solid-svg-icons';


import proposalScripts from 'utilities/proposalScripts.js';
import StatsSection from './UserStats';
import CompareAddressSection from './CompareAddresses';
import SBTPage from '../SBTs/SBTPage';
import { Collapse, Modal, ModalHeader, ModalBody } from 'reactstrap';
import CETooltip from '../Shared/CETooltip';

// NEW IMPORT: for mini question display
import SingleQuestionResponse from '../SurveyTool/SingleQuestionResponse.jsx';

import { analyzeUserOpinions } from 'utilities/ai/aiScripts.js';

import { generateBlockieDataUrl } from 'utilities/ui/blockieAvatars.js';
import { createLogger } from 'utilities/logging.js';
import {
  getDemoSessionConfigBySlug,
  getSessionConfigBySlug,
  getSessionConfigBySlugOrDefault,
  normalizeSessionSlug,
} from '../../utilities/web3/contractScripts.js';
import {
  getAllowedSessionSlugs,
  readSessionScanScope,
  readSessionScanSlugs,
} from '../../utilities/session/sessionScanScope.js';
import { resolveActiveSessionSlug } from '../../utilities/session/sessionNaming.js';
import {
  hasNamespaceEntriesSync,
  listNamespaceSlugsSync,
  peekCacheSync,
  subscribeCacheUpdates,
  writeCache,
} from '../../utilities/cache/cacheScripts.js';
import { measureSync } from '../../utilities/ui/uiPerfStats.js';
import { checkSponsoredAccess } from '../../utilities/web3/sponsoredAccess.js';
import { isMaskedQuestionPayload } from '../../utilities/survey/questionRouting.js';
import { getGlobalLitHooks } from '../../utilities/crypto/litProtocol.js';
import { cryptoUtils } from '../../utilities/crypto/cryptography.js';
import { getSbtDisplayName } from '../../utilities/sbt/sbtDisplayNames.js';
import { notify } from '../../utilities/ui/notify.js';
import { t } from '../../utilities/ui/terminology.js';
import { buildExplorerAddressUrl } from '../../variables/chains.js';
import { ethers } from 'ethers';

const accountLog = createLogger('account');
const USERPAGE_GATE_UNKNOWN_RETRY_MS = 30 * 1000;
const USERPAGE_GATE_TERMINAL_RECHECK_MS = 60 * 1000;
const USERPAGE_RESPONSE_PARSE_MEMO_LIMIT = 300;
const PROFILE_SCAN_REPORT_EVENT = 'ce:profile-scan-report';






class UserPage extends Component {
  _isMounted = false;
  analysisTimer = null; // timer handle
  _profileScanRequestSeq = 0;
  constructor(props) {
    super(props);
    this.state = {
      viewAddress: '', // Set from props
      surveyResponseInfo: [],        // Basic info about responded-to surveys
      surveyCreationInfo: [],        // Basic info about created surveys
      questionCreationInfo: [],      // Basic info about created questions
      questionResponseInfo: [],      // Basic info about responded-to questions

      detailedSurveyResponses: {},   // { [surveyId]: [ array of { questionData, responseData } ] }
      detailedQuestionResponses: {}, // { [questionId]: responseObject }

      userStats: {
        surveysResponded: 0,
        surveysCreated: 0,
        questionsResponded: 0,
        questionsCreated: 0,
        mostUniqueIdea: ' ... ',
        badgesReceived: 0,
        worryScore: 'x%',
        enthusiasmScore: 'y%',
        topTags: ['#cybersecurity', '#ubi', '#mechinterp'],
      },
      copied: false,
      collapseOpen: false,
      username: '',
      usernameError: '',
      isEditingUsername: false, // NEW: state for username edit mode
      bookmarked: false,
      sbtList: [],
      loadingSBTs: true,
      loadingSurveys: true,
      loadingQuestions: true,
      showAnalysisModal: false,
      aiAnalysis: '',
      analysisName: '',
      analysisDetails: '',
      analysisError: '',
      analyzing: false,
      aiAvailable: null, // null = unchecked, true = available, false = unavailable
      // Added for elapsed timer + historical alignment
      analysisElapsedMs: 0,
      analysisHistoricalFigure: '',
      analysisHistoricalReasoning: '',
      showFullProfileModal: false,
      isSimulated: false,
      // Default: Questions tab
      selectedTab: 'questions',
      expandedSurveyResponses: {},
      expandedSurveysCreated: {},

      // NEW: section collapsibles
      showSectionSurveyResponsesOpen: true,
      showSectionSurveysCreatedOpen: true,
      showSectionQuestionResponsesOpen: true,
      showSectionQuestionsCreatedOpen: true,

      // NOTE: Analysis-result caching is temporarily disabled; no analysis cache stored.

      // NEW: nickname (inline, header actions; visible on any user page)
      nicknameInput: '',
      // NEW: inline edit toggle for nickname
      isEditingNickname: false,

      // NEW: Track deep search status to prevent "No Data" flash
      isDeepScanning: false,
      hasUncertainUserData: false,
      hasUncertainSbtData: false,
      hasUncertainGateAccess: false,
      deepScanProgressTick: 0,
      deepScanTooltipLines: null,
      deepScanProgressRows: null,
    };
    this._queuedCacheRefreshTimer = null;
    this._queuedCacheRefreshForce = false;
    this._queuedCacheRefreshLoading = false;
    this._queuedCacheRefreshBypassSignature = false;
    this._responseGateRetryTimer = null;
    this._responseGateRetryDueAt = 0;
    this._responseGateAccessStatusByKey = new Map();
    this._responseGateAccessInFlightByKey = new Map();
    this._responseGateAccessGeneration = 0;
    this._responseGateAccessStatusVersion = 0;
    this._lastCacheRefreshInputSignature = '';
    this._responsePayloadParseMemo = new Map();
    this._deepScanTooltipInputSignature = null;
    this._deepScanTooltipOutputSignature = '';
    this._profileTelemetrySeq = 0;
    this._lastProfileRefreshTelemetrySignature = '';
    this._lastProfileDeriveTelemetrySignature = '';
    this._lastNoSbtVisibleTelemetrySignature = '';
    this._lastProfileRefreshTelemetry = null;
    this._lastBackgroundDeepScanReportSignature = '';
    this._unifiedCacheAggregateMemoKey = '';
    this._unifiedCacheAggregateMemo = null;
    this._unsubscribeCacheUpdates = null;
    this._sectionDeriveMemo = {
      survey: null,
      question: null,
      sbt: null,
    };
  }

  getActiveSessionSlug = () => resolveActiveSessionSlug({
    activeSessionSlug: this.props.activeSessionSlug,
    sessionSlug: this.props.sessionSlug,
  }) || '';

  getBookmarksSlug = () => this.getActiveSessionSlug();

  getBookmarksCache = () => {
    const defaultCache = { surveys: [], questions: [], users: [], filters: [] };
    try {
      const slug = this.getBookmarksSlug();
      const parsed = peekCacheSync('bookmarksCache', slug, { clone: false });
      if (!parsed || typeof parsed !== 'object') return { ...defaultCache };
      const next = { ...defaultCache, ...parsed };
      next.surveys = Array.isArray(next.surveys) ? [...next.surveys] : [];
      next.questions = Array.isArray(next.questions) ? [...next.questions] : [];
      next.users = Array.isArray(next.users) ? [...next.users] : [];
      next.filters = Array.isArray(next.filters) ? [...next.filters] : [];
      return next;
    } catch (_) {
      return { ...defaultCache };
    }
  };

  persistBookmarksCache = (cacheObj, source = '') => {
    const slug = this.getBookmarksSlug();
    void writeCache('bookmarksCache', slug, cacheObj || {}).catch((error) => {
      accountLog.error('UserPage: Error saving bookmarksCache:', error);
    });
    try {
      window.dispatchEvent(
        new CustomEvent('bookmarksCacheUpdated', { detail: { source: source || 'userpage' } })
      );
    } catch (e) { accountLog.warn('UserPage: telemetry', e); }
  };

  stopSpinnerEventPropagation = (event) => {
    event?.stopPropagation?.();
  };

  handleManagedCacheUpdate = (event = null) => {
    if (!this._isMounted) return;
    const namespace = String(event?.namespace || '').trim();
    if (!namespace) return;

    if (namespace === 'bookmarksCache') {
      const eventSlug = String(event?.slug || '');
      if (eventSlug !== this.getBookmarksSlug()) return;
      this.checkIfBookmarked();
      this.loadNicknameFromCache();
      return;
    }

    if (!['surveysCache', 'questionsCache', 'sbtCache', 'userCache'].includes(namespace)) {
      return;
    }

    this._clearUnifiedCacheAggregateMemo();
    this._clearSectionDeriveMemo();
    this.queueCacheRefresh({ markLoading: false, bypassSignature: true });
  };

  _resolveQuestionPromptText = (questionData) => {
    if (!questionData || typeof questionData !== 'object') return '';
    const questionText = typeof questionData.question === 'string'
      ? questionData.question.trim()
      : '';
    if (questionText) return questionText;
    const promptText = typeof questionData.prompt === 'string'
      ? questionData.prompt.trim()
      : '';
    if (promptText) return promptText;
    return '';
  };

  _shortenQuestionId = (questionId) => {
    const fullId = String(questionId || '');
    if (fullId.length <= 20) return fullId;
    return `${fullId.slice(0, 8)}...${fullId.slice(-6)}`;
  };

  _deepScanProgressTimer = null;

  _buildDeepScanTooltipInputSignature = () => {
    const viewLower = String(this.props.viewAddress || '').toLowerCase();
    if (!viewLower) return '';
    const latestBlockRaw = this.props.latestBlockNumber;
    const latestBlockNum = Number.isFinite(Number(latestBlockRaw))
      ? Number(latestBlockRaw)
      : '';
    const currentChainId = this.props.network?.id != null
      ? Number(this.props.network.id)
      : '';
    const slugs = listNamespaceSlugsSync('userCache')
      .map((slug) => String(slug || '').trim())
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    const slugProgress = slugs
      .map((slug) => {
        const cacheEntry = peekCacheSync('userCache', slug, { clone: false });
        const userNode = cacheEntry?.[viewLower];
        if (!userNode || typeof userNode !== 'object') return `${slug}:`;
        const netParts = Object.keys(userNode)
          .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
          .map((netKey) => {
            const entry = userNode?.[netKey];
            const lastBlock = Number(entry?.lastBlockScanned);
            const lastScanTs = Number(entry?.lastScanTimestamp);
            const blockToken = Number.isFinite(lastBlock) ? String(lastBlock) : '';
            const tsToken = Number.isFinite(lastScanTs) ? String(lastScanTs) : '';
            return `${netKey}:${blockToken}:${tsToken}`;
          })
          .join(',');
        return `${slug}:${netParts}`;
      })
      .join(';');
    return [
      viewLower,
      String(currentChainId),
      String(latestBlockNum),
      slugProgress,
    ].join('|');
  };

  startDeepScanProgressTimer = () => {
    if (this._deepScanProgressTimer) return;
    this._deepScanTooltipInputSignature = null;
    this._deepScanTooltipOutputSignature = '';
    this._deepScanProgressTimer = setInterval(() => {
      if (!this._isMounted || !this.state.isDeepScanning) return;
      const nextInputSig = this._buildDeepScanTooltipInputSignature();
      if (nextInputSig === this._deepScanTooltipInputSignature) return;
      this._deepScanTooltipInputSignature = nextInputSig;
      const nextProgressSnapshot = this.computeDeepScanProgressSnapshot();
      const nextTooltipLines = nextProgressSnapshot?.lines || null;
      const nextProgressRows = nextProgressSnapshot?.rows || null;
      const prevTooltipSig = [
        Array.isArray(this.state.deepScanTooltipLines)
          ? this.state.deepScanTooltipLines.join('|')
          : '',
        this._buildDeepScanProgressRowsSignature(this.state.deepScanProgressRows),
      ].join('||');
      const nextTooltipSig = [
        Array.isArray(nextTooltipLines)
          ? nextTooltipLines.join('|')
          : '',
        this._buildDeepScanProgressRowsSignature(nextProgressRows),
      ].join('||');
      if (prevTooltipSig === nextTooltipSig) {
        this._deepScanTooltipOutputSignature = nextTooltipSig;
        return;
      }
      this._deepScanTooltipOutputSignature = nextTooltipSig;
      this.setState({
        deepScanProgressTick: Date.now(),
        deepScanTooltipLines: nextTooltipLines,
        deepScanProgressRows: nextProgressRows,
      });
    }, 2000);
  };

  stopDeepScanProgressTimer = () => {
    if (this._deepScanProgressTimer) {
      clearInterval(this._deepScanProgressTimer);
      this._deepScanProgressTimer = null;
    }
    this._deepScanTooltipInputSignature = null;
    this._deepScanTooltipOutputSignature = '';
  };

  buildDeepScanProgressTooltip = () => {
    const lines = this.state.deepScanTooltipLines;
    if (!Array.isArray(lines) || lines.length === 0) return null;
    return lines;
  };

  buildDeepScanProgressRows = () => {
    const rows = this.state.deepScanProgressRows;
    if (!Array.isArray(rows) || rows.length === 0) return null;
    return rows;
  };

  computeDeepScanProgressSnapshot = () => {
    const rows = this.computeDeepScanProgressRows();
    return {
      rows,
      lines: this._formatDeepScanTooltipLinesFromRows(rows),
    };
  };

  computeDeepScanTooltipLines = () => {
    const snapshot = this.computeDeepScanProgressSnapshot();
    return snapshot?.lines || null;
  };

  computeDeepScanProgressRows = () => {
    const viewLower = String(this.props.viewAddress || '').toLowerCase();
    if (!viewLower) return null;
    const latestBlockRaw = this.props.latestBlockNumber;
    const latestBlockNum = Number.isFinite(Number(latestBlockRaw))
      ? Number(latestBlockRaw)
      : null;
    const currentChainId = this.props.network?.id != null
      ? Number(this.props.network.id)
      : null;
    const userCaches = this._dgReadAll('userCache');
    return this._deriveDeepScanProgressRows(
      userCaches,
      viewLower,
      currentChainId,
      latestBlockNum
    );
  };

  _getDeepScanSessionDisplayConfig = (slugIn = '') => {
    const slug = normalizeSessionSlug(slugIn || '');
    if (!slug) {
      const cfg = getSessionConfigBySlugOrDefault('')
        || getDemoSessionConfigBySlug('', { allowDemoFallback: true });
      return (cfg && typeof cfg === 'object') ? cfg : null;
    }
    const cfg = getSessionConfigBySlug(slug)
      || getDemoSessionConfigBySlug(slug, { allowDemoFallback: true });
    return (cfg && typeof cfg === 'object') ? cfg : null;
  };

  _formatDeepScanBlockCount = (value) => {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return '0';
    return Math.max(0, Math.floor(numericValue)).toLocaleString();
  };

  _getDeepScanPrioritySlugs = () => {
    const activeSlug = normalizeSessionSlug(this.props.activeSessionSlug || '');
    const scope = readSessionScanScope();
    const shouldUseScopedOrder = (
      scope === 'list' ||
      scope === 'general' ||
      (scope === 'active' && !!activeSlug)
    );
    const scopedSlugs = shouldUseScopedOrder
      ? getAllowedSessionSlugs(scope, readSessionScanSlugs(), activeSlug)
      : [];
    const ordered = [];
    const seen = new Set();
    const push = (rawSlug) => {
      const slug = normalizeSessionSlug(rawSlug || '');
      if (seen.has(slug)) return;
      seen.add(slug);
      ordered.push(slug);
    };

    if (scope === 'list') {
      const normalizedScopeSlugs = scopedSlugs.map((slug) => normalizeSessionSlug(slug || ''));
      const activeInScope = !!(activeSlug && normalizedScopeSlugs.includes(activeSlug));
      if (activeSlug && !activeInScope) {
        push(activeSlug);
      }
      normalizedScopeSlugs.forEach((slug) => push(slug));
      return ordered;
    }

    if (activeSlug) {
      push(activeSlug);
    }
    scopedSlugs.forEach((slug) => push(slug));
    return ordered;
  };

  _sortDeepScanProgressRows = (rows) => {
    if (!Array.isArray(rows) || rows.length === 0) return null;
    const prioritySlugs = this._getDeepScanPrioritySlugs();
    const priorityBySlug = new Map();
    prioritySlugs.forEach((slug, index) => {
      priorityBySlug.set(normalizeSessionSlug(slug || ''), index);
    });

    return rows
      .map((row, index) => ({ ...row, __sourceIndex: index }))
      .sort((left, right) => {
        const leftSlug = normalizeSessionSlug(left?.slug || '');
        const rightSlug = normalizeSessionSlug(right?.slug || '');
        const leftPriority = priorityBySlug.has(leftSlug)
          ? priorityBySlug.get(leftSlug)
          : Number.MAX_SAFE_INTEGER;
        const rightPriority = priorityBySlug.has(rightSlug)
          ? priorityBySlug.get(rightSlug)
          : Number.MAX_SAFE_INTEGER;
        if (leftPriority !== rightPriority) return leftPriority - rightPriority;

        const leftNeedsAttention = left?.latestBlock == null || Number(left?.remainingBlocks || 0) > 0;
        const rightNeedsAttention = right?.latestBlock == null || Number(right?.remainingBlocks || 0) > 0;
        if (leftNeedsAttention !== rightNeedsAttention) {
          return leftNeedsAttention ? -1 : 1;
        }

        const leftLastBlock = Number(left?.lastBlockScanned || 0);
        const rightLastBlock = Number(right?.lastBlockScanned || 0);
        if (rightLastBlock !== leftLastBlock) return rightLastBlock - leftLastBlock;

        const leftLabel = String(left?.label || leftSlug || '');
        const rightLabel = String(right?.label || rightSlug || '');
        const labelCmp = leftLabel.localeCompare(rightLabel);
        if (labelCmp !== 0) return labelCmp;

        const leftChain = Number(left?.chainId || 0);
        const rightChain = Number(right?.chainId || 0);
        if (leftChain !== rightChain) return leftChain - rightChain;

        return Number(left.__sourceIndex || 0) - Number(right.__sourceIndex || 0);
      })
      .map(({ __sourceIndex, ...row }) => row);
  };

  _formatDeepScanTooltipLinesFromRows = (rows) => {
    if (!Array.isArray(rows) || rows.length === 0) return null;
    const lines = [];
    rows.forEach((row, index) => {
      lines.push(`Session: ${row.label}`);
      if (row.latestBlock != null) {
        if (Number(row.remainingBlocks || 0) <= 100) {
          lines.push('Up to date');
        } else {
          lines.push(`${this._formatDeepScanBlockCount(row.remainingBlocks)} blocks remaining`);
        }
      } else {
        lines.push(`${this._formatDeepScanBlockCount(row.lastBlockScanned)} scanned`);
      }
      if (index < rows.length - 1) lines.push('');
    });
    return lines;
  };

  _buildDeepScanProgressRowsSignature = (rows) => {
    if (!Array.isArray(rows) || rows.length === 0) return '';
    return rows
      .map((row) => [
        String(row?.slug || ''),
        String(row?.chainId ?? ''),
        String(row?.lastBlockScanned ?? ''),
        String(row?.latestBlock ?? ''),
        String(row?.remainingBlocks ?? ''),
        String(row?.percentComplete ?? ''),
        row?.isDeterminate ? '1' : '0',
        String(row?.label || ''),
      ].join(':'))
      .join('|');
  };

  _deriveDeepScanProgressRows = (userCaches, viewLower, currentChainId, latestBlockNum) => (
    measureSync('ce.userPage.deepScanTooltipRows', () => {
      if (!Array.isArray(userCaches) || userCaches.length === 0 || !viewLower) return null;
      const entries = [];
      const sessionConfigMemo = new Map();

      userCaches.forEach(({ slug, data }) => {
        const userNode = data?.[viewLower];
        if (!userNode || typeof userNode !== 'object') return;
        Object.keys(userNode).forEach((netKey) => {
          const chainEntry = userNode?.[netKey];
          const lastBlock = Number(chainEntry?.lastBlockScanned);
          if (!Number.isFinite(lastBlock) || lastBlock <= 0) return;

          let latestForPct = null;
          if (latestBlockNum != null && currentChainId != null && Number(netKey) === Number(currentChainId) && latestBlockNum > 0) {
            latestForPct = latestBlockNum;
          }

          const normalizedSlug = normalizeSessionSlug(slug || '');
          const sessionMemoKey = normalizedSlug || '__general__';
          let sessionConfig = null;
          if (sessionConfigMemo.has(sessionMemoKey)) {
            sessionConfig = sessionConfigMemo.get(sessionMemoKey);
          } else {
            sessionConfig = this._getDeepScanSessionDisplayConfig(normalizedSlug);
            sessionConfigMemo.set(sessionMemoKey, sessionConfig);
          }

          const startRaw = Number(sessionConfig?.blockLimits?.start);
          const startBlock = Number.isFinite(startRaw) && startRaw > 0
            ? Math.floor(startRaw)
            : null;

          entries.push({
            slug: slug || 'general',
            chainId: Number.isFinite(Number(netKey)) ? Number(netKey) : null,
            lastBlock,
            latestBlock: latestForPct,
            startBlock,
            sessionConfig,
          });
        });
      });

      if (entries.length === 0) return null;
      entries.sort((a, b) => b.lastBlock - a.lastBlock);
      const slugCounts = entries.reduce((counts, entry) => {
        counts.set(entry.slug, (counts.get(entry.slug) || 0) + 1);
        return counts;
      }, new Map());
      const rows = entries.map((entry) => {
        const slugHasMultipleNetworks = (slugCounts.get(entry.slug) || 0) > 1;
        const slugLabel = normalizeSessionSlug(entry.slug || '') || 'general';
        const sessionName = String(entry.sessionConfig?.sessionName || '').trim();
        const baseLabel = sessionName && sessionName.toLowerCase() !== slugLabel.toLowerCase()
          ? `${sessionName} (${slugLabel})`
          : (sessionName || entry.slug || 'General');
        const label = slugHasMultipleNetworks && entry.chainId != null
          ? `${baseLabel} (chain ${entry.chainId})`
          : baseLabel;
        const latestBlock = entry.latestBlock != null
          ? Math.max(0, Math.floor(Number(entry.latestBlock)))
          : null;
        const lastBlockScanned = Math.max(0, Math.floor(Number(entry.lastBlock)));
        const displayLastBlock = entry.startBlock != null
          ? Math.max(entry.startBlock, lastBlockScanned)
          : lastBlockScanned;
        const remainingBlocks = latestBlock != null
          ? Math.max(0, latestBlock - displayLastBlock)
          : null;
        let percentComplete = null;
        let isDeterminate = false;

        if (latestBlock != null && entry.startBlock != null) {
          const totalSpan = Math.max(0, latestBlock - entry.startBlock);
          const completedSpan = Math.max(0, displayLastBlock - entry.startBlock);
          percentComplete = totalSpan <= 0
            ? 100
            : Math.max(0, Math.min(100, Math.round((completedSpan / totalSpan) * 100)));
          isDeterminate = true;
        }

        return {
          slug: entry.slug,
          chainId: entry.chainId,
          lastBlockScanned,
          latestBlock,
          remainingBlocks,
          percentComplete,
          isDeterminate,
          label,
          startBlock: entry.startBlock,
          displayLastBlock,
        };
      });
      return this._sortDeepScanProgressRows(rows);
    })
  );

  _deriveDeepScanProgressTooltipFromCaches = (userCaches, viewLower, currentChainId, latestBlockNum) => (
    measureSync('ce.userPage.deepScanTooltip', () => {
      const rows = this._deriveDeepScanProgressRows(
        userCaches,
        viewLower,
        currentChainId,
        latestBlockNum
      );
      return this._formatDeepScanTooltipLinesFromRows(rows);
    })
  );

  renderDeepScanProgressPanel = (progressRows, options = {}) => {
    if (!Array.isArray(progressRows) || progressRows.length === 0) return null;
    const {
      headerText = 'Deep scan in progress',
      showScannedText = true,
    } = options;

    return (
      <div className={styles.deepScanProgressPanel}>
        {headerText ? (
          <div className={styles.deepScanProgressHeader}>{headerText}</div>
        ) : null}
        {progressRows.map((row, index) => {
          const rowKey = `${row.slug || 'general'}_${row.chainId || 'na'}_${index}`;
          const progressWidth = Number.isFinite(Number(row.percentComplete))
            ? `${Math.max(0, Math.min(100, Number(row.percentComplete)))}%`
            : '0%';
          const remainingText = Number(row.remainingBlocks || 0) <= 0
            ? 'Up to date'
            : `${this._formatDeepScanBlockCount(row.remainingBlocks)} blocks remaining`;
          const scannedText = row.latestBlock != null
            ? `${this._formatDeepScanBlockCount(row.displayLastBlock)} / ${this._formatDeepScanBlockCount(row.latestBlock)} scanned`
            : '';
          const indeterminateText = showScannedText
            ? `${this._formatDeepScanBlockCount(row.lastBlockScanned)} scanned`
            : 'Syncing... latest block pending';

          return (
            <div key={rowKey} className={styles.deepScanProgressRow}>
              <div className={styles.deepScanProgressLabel}>{row.label}</div>
              {row.isDeterminate ? (
                <>
                  <div className={styles.deepScanProgressBar}>
                    <div
                      className={styles.deepScanProgressFill}
                      style={{ width: progressWidth }}
                    />
                  </div>
                  <div className={styles.deepScanProgressStats}>{remainingText}</div>
                  {showScannedText && scannedText ? (
                    <div className={styles.deepScanProgressStats}>{scannedText}</div>
                  ) : null}
                </>
              ) : (
                <div className={styles.deepScanIndeterminate}>{indeterminateText}</div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  renderDeepScanTooltipContent = (tooltipLines, progressRows) => {
    if (Array.isArray(progressRows) && progressRows.length > 0) {
      return this.renderDeepScanProgressPanel(progressRows, {
        headerText: 'Deep scan in progress',
        showScannedText: true,
      });
    }

    if (!Array.isArray(tooltipLines) || tooltipLines.length === 0) return null;
    return tooltipLines.map((line, idx) => (
      <div key={`deepScanTextLine_${idx}`}>{line}</div>
    ));
  };

  renderDeepScanTooltip = (targetId, tooltipLines, progressRows) => {
    if ((!Array.isArray(tooltipLines) || tooltipLines.length === 0) &&
        (!Array.isArray(progressRows) || progressRows.length === 0)) return null;
    return (
      <CETooltip
        placement="right"
        target={targetId}
        className={styles.deepScanTooltip}
        innerClassName={styles.deepScanTooltipInner}
        trigger="hover focus click"
        autohide={false}
      >
        {this.renderDeepScanTooltipContent(tooltipLines, progressRows)}
      </CETooltip>
    );
  };

  renderDeepScanStatusIndicator = (targetId, tooltipLines, progressRows, titleText) => (
    <>
      <span
        className={styles.cornerLoadingStatus}
        onClick={this.stopSpinnerEventPropagation}
        onMouseDown={this.stopSpinnerEventPropagation}
      >
        <FontAwesomeIcon
          icon={faSpinner}
          spin
          className={styles.cornerSpinner}
          id={targetId}
          title={titleText || undefined}
          onClick={this.stopSpinnerEventPropagation}
          onMouseDown={this.stopSpinnerEventPropagation}
        />
      </span>
      {this.renderDeepScanTooltip(targetId, tooltipLines, progressRows)}
    </>
  );

  cloneParsedResponsePayload = (value) => {
    if (value == null || typeof value !== 'object') return value;
    if (Array.isArray(value)) {
      return value.map((item) => this.cloneParsedResponsePayload(item));
    }
    const clone = {};
    Object.keys(value).forEach((key) => {
      Object.defineProperty(clone, key, {
        value: this.cloneParsedResponsePayload(value[key]),
        enumerable: true,
        writable: true,
        configurable: true,
      });
    });
    return clone;
  };

  parseCachedResponsePayload = (rawValue) => {
    if (typeof rawValue !== 'string') return this.cloneParsedResponsePayload(rawValue);
    const memo = this._responsePayloadParseMemo;
    if (memo && memo.has(rawValue)) {
      return this.cloneParsedResponsePayload(memo.get(rawValue));
    }
    let parsed = null;
    try {
      parsed = JSON.parse(rawValue);
    } catch (_) {
      // Fail-open for malformed legacy payloads so UI can still surface a deterministic state.
      parsed = rawValue;
    }
    if (memo) {
      memo.set(rawValue, parsed);
      if (memo.size > USERPAGE_RESPONSE_PARSE_MEMO_LIMIT) {
        const oldestKey = memo.keys().next().value;
        if (oldestKey !== undefined) memo.delete(oldestKey);
      }
    }
    return this.cloneParsedResponsePayload(parsed);
  };

  _extractFirstDefinedValue = (...values) => {
    for (let i = 0; i < values.length; i += 1) {
      if (values[i] !== undefined) return values[i];
    }
    return undefined;
  };

  _normalizeResponseField = (rawField, fallbackValues = []) => {
    const base = (rawField && typeof rawField === 'object' && !Array.isArray(rawField))
      ? { ...rawField }
      : {};
    const scalarFallback = (rawField != null && typeof rawField !== 'object')
      ? rawField
      : undefined;
    const nextValue = this._extractFirstDefinedValue(
      base.value,
      scalarFallback,
      ...(Array.isArray(fallbackValues) ? fallbackValues : [])
    );
    if (nextValue !== undefined) base.value = nextValue;
    return base;
  };

  _normalizeSingleQuestionResponsePayload = (rawResponse = null) => {
    if (rawResponse == null) return null;

    if (typeof rawResponse !== 'object' || Array.isArray(rawResponse)) {
      return {
        answer: { value: rawResponse },
        additional: { value: '' },
      };
    }

    const nestedResponse = (
      rawResponse.response &&
      typeof rawResponse.response === 'object' &&
      !Array.isArray(rawResponse.response)
    ) ? rawResponse.response : null;
    const base = nestedResponse
      ? { ...rawResponse, ...nestedResponse }
      : { ...rawResponse };

    const answerFallback = this._extractFirstDefinedValue(
      base.answerValue,
      base.value,
      base.responseValue,
      base.answerText,
      base.responseText,
      (
        base.answer == null &&
        (typeof base.response === 'string' || typeof base.response === 'number' || typeof base.response === 'boolean')
      ) ? base.response : undefined
    );
    const additionalFallback = this._extractFirstDefinedValue(
      base.additionalComment,
      base.additionalComments,
      base.comment,
      base.comments,
      base.additionalText
    );

    const normalized = {
      ...base,
      answer: this._normalizeResponseField(base.answer, [answerFallback]),
      additional: this._normalizeResponseField(base.additional, [additionalFallback]),
    };

    const hasShapeHints = !!(
      base.answer !== undefined ||
      base.additional !== undefined ||
      answerFallback !== undefined ||
      additionalFallback !== undefined ||
      base.importance !== undefined ||
      base.conviction !== undefined ||
      base.blockNumber !== undefined ||
      base.transactionIndex !== undefined ||
      base.logIndex !== undefined ||
      base.timestamp !== undefined ||
      base.arweaveTxId ||
      base.transactionHash ||
      base.txHash
    );
    if (!hasShapeHints) {
      normalized.__ceMalformedPayload = true;
    }
    return normalized;
  };

  _isDisplayableResponseValue = (value) => {
    if (Array.isArray(value)) {
      return value.some((entry) => this._isDisplayableResponseValue(entry));
    }
    if (value && typeof value === 'object') {
      if (Object.prototype.hasOwnProperty.call(value, 'value')) {
        return this._isDisplayableResponseValue(value.value);
      }
      return Object.keys(value).length > 0;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed !== '' && trimmed !== '*';
    }
    return value !== undefined && value !== null && value !== '*';
  };

  _hasDisplayableResponsePayload = (responseObj = null) => {
    if (!responseObj || typeof responseObj !== 'object') return false;
    return (
      this._isDisplayableResponseValue(responseObj?.answer?.value) ||
      this._isDisplayableResponseValue(responseObj?.additional?.value)
    );
  };

  _hasResponseSubmissionHints = (value = null) => {
    if (value == null) return false;
    if (typeof value !== 'object') {
      return String(value).trim() !== '';
    }
    const src = value;
    return !!(
      src.__ceMalformedPayload === true ||
      Object.prototype.hasOwnProperty.call(src, 'answer') ||
      Object.prototype.hasOwnProperty.call(src, 'additional') ||
      src.questionId ||
      src.questionID ||
      src.arweaveTxId ||
      src.transactionHash ||
      src.txHash ||
      src.blockNumber !== undefined ||
      src.transactionIndex !== undefined ||
      src.logIndex !== undefined ||
      src.timestamp !== undefined
    );
  };

  _extractResponseRecency = (responseObj = null, recencyMeta = null) => {
    const meta = (recencyMeta && typeof recencyMeta === 'object') ? recencyMeta : {};
    const src = (responseObj && typeof responseObj === 'object') ? responseObj : {};
    return {
      bn: Number(meta.bn ?? meta.blockNumber ?? src.blockNumber ?? src.bn ?? 0) || 0,
      txi: Number(
        meta.txi ??
        meta.transactionIndex ??
        meta.txIndex ??
        src.txi ??
        src.transactionIndex ??
        src.txIndex ??
        0
      ) || 0,
      li: Number(meta.li ?? meta.logIndex ?? src.logIndex ?? src.li ?? 0) || 0,
      ts: Number(meta.ts ?? meta.timestamp ?? src.ts ?? src.timestamp ?? 0) || 0,
    };
  };

  _compareResponseRecency = (left, right) => {
    const a = this._extractResponseRecency(left);
    const b = this._extractResponseRecency(right);
    if (a.bn !== b.bn) return a.bn - b.bn;
    if (a.txi !== b.txi) return a.txi - b.txi;
    if (a.li !== b.li) return a.li - b.li;
    if (a.ts !== b.ts) return a.ts - b.ts;
    return 0;
  };

  _readBoolishTelemetryFlag = (raw, fallback = false) => {
    if (typeof raw === 'boolean') return raw;
    const val = (raw == null ? '' : String(raw)).trim().toLowerCase();
    if (val === '1' || val === 'true' || val === 'yes' || val === 'on') return true;
    if (val === '0' || val === 'false' || val === 'no' || val === 'off') return false;
    return !!fallback;
  };

  isDeepScanLoadingEnabledForSection = () => {
    try {
      if (typeof globalThis === 'undefined') return true;
      if (typeof globalThis.CE_USER_PROFILE_DEEP_SCAN_LOADING !== 'undefined') {
        const enabled = this._readBoolishTelemetryFlag(globalThis.CE_USER_PROFILE_DEEP_SCAN_LOADING, true);
        if (!enabled) return false;
      }
    } catch (e) { accountLog.warn('UserPage: telemetry', e); }
    return true;
  };

  isProfileTelemetryEnabled = () => {
    try {
      if (typeof globalThis === 'undefined') return false;
      if (typeof globalThis.CE_PROFILE_SCAN_TELEMETRY !== 'undefined') {
        return this._readBoolishTelemetryFlag(globalThis.CE_PROFILE_SCAN_TELEMETRY, true);
      }
      const pathname = String(globalThis.location?.pathname || '');
      return pathname.startsWith('/u/');
    } catch (_) {
      return false;
    }
  };

  emitProfileTelemetry = (event, payload = {}) => {
    if (!this.isProfileTelemetryEnabled()) return;
    try {
      const safeEvent = String(event || '').trim() || 'unknown';
      const safePayload = (payload && typeof payload === 'object')
        ? payload
        : { value: payload };
      const seq = Number(this._profileTelemetrySeq || 0) + 1;
      this._profileTelemetrySeq = seq;
      const entry = {
        ts: new Date().toISOString(),
        seq,
        source: 'UserPage',
        event: safeEvent,
        ...safePayload,
      };
      const key = '__CE_PROFILE_SCAN_TELEMETRY__';
      const bucket = Array.isArray(globalThis[key]) ? globalThis[key] : [];
      bucket.push(entry);
      if (bucket.length > 800) bucket.splice(0, bucket.length - 800);
      globalThis[key] = bucket;
      console.info(`[CE_PROFILE_SCAN][UserPage] ${safeEvent}`, entry);
    } catch (e) { accountLog.warn('UserPage: telemetry', e); }
  };

  isProfileColdDiagEnabled = () => {
    try {
      if (typeof globalThis === 'undefined') return false;
      if (typeof globalThis.CE_PROFILE_SCAN_COLD_DIAG !== 'undefined') {
        return this._readBoolishTelemetryFlag(globalThis.CE_PROFILE_SCAN_COLD_DIAG, false);
      }
    } catch (e) { accountLog.warn('UserPage: telemetry', e); }
    return false;
  };

  emitProfileColdDiag = (event, payload = {}) => {
    if (!this.isProfileColdDiagEnabled()) return;
    const name = String(event || '').trim().toLowerCase() || 'unknown';
    this.emitProfileTelemetry(`cold-diag:${name}`, payload);
  };

  emitNoSbtVisibleTelemetry = () => {
    if (!this.isProfileTelemetryEnabled()) return;
    const viewAddressLower = String(this.props.viewAddress || '').toLowerCase();
    const isSBTReady = !!this.props.isSBTCacheReady;
    const isSbtLoadingAny = !!(this.state.loadingSBTs || !isSBTReady || this.state.isDeepScanning);
    const sbtListCount = Array.isArray(this.state.sbtList) ? this.state.sbtList.length : 0;
    if (isSbtLoadingAny || sbtListCount > 0) return;

    const latestRefresh = this._lastProfileRefreshTelemetry || {};
    const sig = [
      viewAddressLower,
      String(this.props.network?.id || ''),
      String(this.state.loadingSBTs ? 1 : 0),
      String(isSBTReady ? 1 : 0),
      String(this.state.isDeepScanning ? 1 : 0),
      String(this.state.hasUncertainUserData ? 1 : 0),
      String(this.state.hasUncertainSbtData ? 1 : 0),
      String(this.state.hasUncertainGateAccess ? 1 : 0),
      String(sbtListCount),
      String(latestRefresh.aggregateSbtAddresses || 0),
      String(latestRefresh.heldAggregateSbtCount || 0),
      String(latestRefresh.derivedSbtCount ?? ''),
    ].join('|');
    if (sig === this._lastNoSbtVisibleTelemetrySignature) return;
    this._lastNoSbtVisibleTelemetrySignature = sig;

    this.emitProfileTelemetry('no-sbt-visible', {
      viewAddress: viewAddressLower,
      networkID: String(this.props.network?.id || ''),
      loadingSBTs: !!this.state.loadingSBTs,
      isSBTReady,
      isDeepScanning: !!this.state.isDeepScanning,
      hasUncertainUserData: !!this.state.hasUncertainUserData,
      hasUncertainSbtData: !!this.state.hasUncertainSbtData,
      hasUncertainGateAccess: !!this.state.hasUncertainGateAccess,
      sbtListCount,
      refreshSnapshot: latestRefresh,
    });
  };

  applyDeepScanReport = (scanReport) => {
    if (!this._isMounted) return;
    const viewAddressLower = String(this.props.viewAddress || '').toLowerCase();
    const reportTargetLower = String(scanReport?.targetAddress || '').toLowerCase();
    if (reportTargetLower && viewAddressLower && reportTargetLower !== viewAddressLower) return;
    const attemptedSlugs = Array.isArray(scanReport?.attemptedSlugs) ? [...scanReport.attemptedSlugs] : [];
    const scannedSlugs = Array.isArray(scanReport?.scannedSlugs) ? [...scanReport.scannedSlugs] : [];
    const skippedSlugs = Array.isArray(scanReport?.skippedSlugs) ? [...scanReport.skippedSlugs] : [];
    const failedSlugs = Array.isArray(scanReport?.failedSlugs) ? [...scanReport.failedSlugs] : [];
    const failedActivitySlugs = Array.isArray(scanReport?.failedActivitySlugs) ? [...scanReport.failedActivitySlugs] : [];
    const rawHadRpcErrors = !!(scanReport && scanReport.hadRpcErrors);
    const totalActivityFailure = (
      attemptedSlugs.length > 0 &&
      scannedSlugs.length === 0 &&
      failedActivitySlugs.length >= attemptedSlugs.length
    );
    const totalSbtFailure = (
      attemptedSlugs.length > 0 &&
      scannedSlugs.length === 0 &&
      failedSlugs.length >= attemptedSlugs.length
    );
    const totalSkippedScan = (
      attemptedSlugs.length > 0 &&
      scannedSlugs.length === 0 &&
      skippedSlugs.length >= attemptedSlugs.length
    );
    const hasCoverageGap = scanReport && Object.prototype.hasOwnProperty.call(scanReport, 'coverageComplete')
      ? scanReport.coverageComplete === false
      : false;
    const hasPartialRpcFailureEvidence = !!(
      rawHadRpcErrors &&
      !totalActivityFailure &&
      !totalSbtFailure &&
      !totalSkippedScan &&
      (
        failedSlugs.length > 0 ||
        failedActivitySlugs.length > 0 ||
        (attemptedSlugs.length > 0 && scannedSlugs.length < attemptedSlugs.length)
      )
    );
    const hasPartialSbtFailureEvidence = !!(
      rawHadRpcErrors &&
      failedSlugs.length > 0 &&
      !totalSbtFailure &&
      !totalSkippedScan
    );
    const hasUncertainUserData = !!(
      hasCoverageGap ||
      totalActivityFailure ||
      totalSbtFailure ||
      totalSkippedScan ||
      hasPartialRpcFailureEvidence
    );
    const hasUncertainSbtData = !!(
      totalSbtFailure ||
      totalSkippedScan ||
      hasPartialSbtFailureEvidence ||
      (hasCoverageGap && !totalActivityFailure && !totalSbtFailure && !totalSkippedScan)
    );
    this.emitProfileColdDiag('scan-report', {
      viewAddress: String(this.props.viewAddress || '').toLowerCase(),
      attemptedSlugs, scannedSlugs, skippedSlugs, failedSlugs, failedActivitySlugs,
      anyNewData: !!scanReport?.anyNewData,
      coverageComplete: scanReport?.coverageComplete,
      coverageReason: scanReport?.coverageReason,
      hasUncertainUserData,
      hasUncertainSbtData,
      totalActivityFailure, totalSbtFailure, totalSkippedScan, hasCoverageGap,
      totalSbtContractsFound: scanReport?.totalSbtContractsFound,
      totalCreatedSurveysFound: scanReport?.totalCreatedSurveysFound,
      totalCreatedQuestionsFound: scanReport?.totalCreatedQuestionsFound,
      totalSurveyResponsesFound: scanReport?.totalSurveyResponsesFound,
      totalQuestionResponsesFound: scanReport?.totalQuestionResponsesFound,
    });
    this.emitProfileTelemetry('deep-scan-report', {
      viewAddress: String(this.props.viewAddress || '').toLowerCase(),
      hadRpcErrors: rawHadRpcErrors,
      hasUncertainUserData,
      hasUncertainSbtData,
      totalActivityFailure,
      totalSbtFailure,
      totalSkippedScan,
      usedAllSessions: !!(scanReport && scanReport.usedAllSessions),
      coverageComplete: scanReport && Object.prototype.hasOwnProperty.call(scanReport, 'coverageComplete')
        ? !!scanReport.coverageComplete
        : null,
      coverageReason: String(scanReport?.coverageReason || ''),
      attemptedSlugs,
      scannedSlugs,
      skippedSlugs,
      failedSlugs,
      failedActivitySlugs,
      registryEntryCount: Number(scanReport?.registryEntryCount || 0),
      anyNewData: !!scanReport?.anyNewData,
      totalSbtContractsFound: Number(scanReport?.totalSbtContractsFound || 0),
      totalCreatedSurveysFound: Number(scanReport?.totalCreatedSurveysFound || 0),
      totalCreatedQuestionsFound: Number(scanReport?.totalCreatedQuestionsFound || 0),
      totalSurveyResponsesFound: Number(scanReport?.totalSurveyResponsesFound || 0),
      totalQuestionResponsesFound: Number(scanReport?.totalQuestionResponsesFound || 0),
      sampleSbtAddresses: Array.isArray(scanReport?.sampleSbtAddresses)
        ? scanReport.sampleSbtAddresses.slice(0, 12)
        : [],
      sampleCreatedSurveyIds: Array.isArray(scanReport?.sampleCreatedSurveyIds)
        ? scanReport.sampleCreatedSurveyIds.slice(0, 12)
        : [],
      sampleCreatedQuestionIds: Array.isArray(scanReport?.sampleCreatedQuestionIds)
        ? scanReport.sampleCreatedQuestionIds.slice(0, 12)
        : [],
      sampleSurveyResponseIds: Array.isArray(scanReport?.sampleSurveyResponseIds)
        ? scanReport.sampleSurveyResponseIds.slice(0, 12)
        : [],
      sampleQuestionResponseIds: Array.isArray(scanReport?.sampleQuestionResponseIds)
        ? scanReport.sampleQuestionResponseIds.slice(0, 12)
        : [],
    });
    this.setState(
      {
        isDeepScanning: false,
        hasUncertainUserData,
        hasUncertainSbtData,
        hasUncertainGateAccess: false,
      },
      () => {
        this.loadDataFromCache();
      }
    );
  };

  startProfileDeepScan = (phase = 'mount') => {
    const targetAddress = String(this.props.viewAddress || '').trim();
    if (!this._isMounted || !this.props.scanSpecificUserProfile || !targetAddress) return;

    const requestSeq = Number(this._profileScanRequestSeq || 0) + 1;
    this._profileScanRequestSeq = requestSeq;
    const targetLower = targetAddress.toLowerCase();

    this.emitProfileTelemetry('deep-scan-request', {
      viewAddress: targetLower,
      phase,
    });
    this.setState({
      isDeepScanning: true,
      hasUncertainUserData: false,
      hasUncertainSbtData: false,
      hasUncertainGateAccess: false,
    });

    this.props.scanSpecificUserProfile(targetAddress)
      .then((scanReport) => {
        if (!this._isMounted || requestSeq !== this._profileScanRequestSeq) return;
        const currentViewLower = String(this.props.viewAddress || '').toLowerCase();
        if (!currentViewLower || currentViewLower !== targetLower) return;
        const safeReport = (scanReport && typeof scanReport === 'object')
          ? { ...scanReport }
          : {};
        if (!safeReport.targetAddress) safeReport.targetAddress = targetAddress;
        this.applyDeepScanReport(safeReport);
      })
      .catch((err) => {
        accountLog.error(`[UserPage] Deep search failed${phase === 'update' ? ' on update' : ''}:`, err);
        if (!this._isMounted || requestSeq !== this._profileScanRequestSeq) return;
        const currentViewLower = String(this.props.viewAddress || '').toLowerCase();
        if (!currentViewLower || currentViewLower !== targetLower) return;
        this.emitProfileTelemetry('deep-scan-failed', {
          viewAddress: targetLower,
          phase,
          error: String(err?.message || err),
        });
        this.applyDeepScanReport({
          targetAddress,
          hadRpcErrors: true,
          coverageComplete: false,
          coverageReason: 'scan-exception',
        });
      });
  };

  handleBackgroundProfileScanReport = (event) => {
    if (!this._isMounted) return;
    const detail = event && typeof event === 'object' ? event.detail : null;
    const scanReport = detail && typeof detail === 'object'
      ? (detail.scanReport || null)
      : null;
    if (!scanReport || typeof scanReport !== 'object') return;
    const viewAddressLower = String(this.props.viewAddress || '').toLowerCase();
    const reportTargetLower = String(scanReport.targetAddress || '').toLowerCase();
    if (!viewAddressLower || !reportTargetLower || reportTargetLower !== viewAddressLower) return;

    const scannedSlugs = Array.isArray(scanReport.scannedSlugs)
      ? scanReport.scannedSlugs.join(',')
      : '';
    const attemptedSlugs = Array.isArray(scanReport.attemptedSlugs)
      ? scanReport.attemptedSlugs.join(',')
      : '';
    const skippedSlugs = Array.isArray(scanReport.skippedSlugs)
      ? scanReport.skippedSlugs.join(',')
      : '';
    const failedSlugs = Array.isArray(scanReport.failedSlugs)
      ? scanReport.failedSlugs.join(',')
      : '';
    const failedActivitySlugs = Array.isArray(scanReport.failedActivitySlugs)
      ? scanReport.failedActivitySlugs.join(',')
      : '';
    const coverageComplete = Object.prototype.hasOwnProperty.call(scanReport, 'coverageComplete')
      ? String(scanReport.coverageComplete === true ? 1 : 0)
      : '';
    const signature = [
      reportTargetLower,
      String(scanReport.hadRpcErrors ? 1 : 0),
      String(scanReport.coverageReason || ''),
      coverageComplete,
      attemptedSlugs,
      scannedSlugs,
      skippedSlugs,
      failedSlugs,
      failedActivitySlugs,
    ].join('|');
    if (signature === this._lastBackgroundDeepScanReportSignature) return;
    this._lastBackgroundDeepScanReportSignature = signature;

    this.applyDeepScanReport(scanReport);
  };


  componentDidMount() {
    this._isMounted = true;
    try {
      if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
        window.addEventListener(PROFILE_SCAN_REPORT_EVENT, this.handleBackgroundProfileScanReport);
      }
    } catch (e) { accountLog.warn('UserPage: fallback', e); }
    try {
      this._unsubscribeCacheUpdates = subscribeCacheUpdates(this.handleManagedCacheUpdate);
    } catch (e) { accountLog.warn('UserPage: fallback', e); }
    this.setState({ viewAddress: this.props.viewAddress }, () => {
      // Honor optional defaultTab prop (e.g., 'surveys')
      try {
        const dt = String(this.props.defaultTab || '').toLowerCase();
        if (dt === 'surveys' || dt === 'questions') {
          this.setState({ selectedTab: dt });
        }
      } catch (e) { accountLog.warn('UserPage: fallback', e); }

      this.loadPersistedUsername();
      this.loadDataFromCache();
      this.checkIfBookmarked();
      this.loadNicknameFromCache(); // NEW: prefill nickname if present in bookmarksCache (object-shaped)

      // Phase 2 Task: Trigger global light discovery to populate caches for all groups
      // This ensures the "universe" of known SBT addresses is populated, which is
      // a prerequisite for the deep scan to find what the user owns.
      if (this.props.ensureLightSbtUniverse) {
        accountLog.log("[UserPage] Triggering ensureLightSbtUniverse...");
        this.props.ensureLightSbtUniverse();
      }

      // ---------------------------------------------------------
      // NEW: Trigger "Fast Lane" Deep Search for this user
      // This populates local caches with this user's data from ALL groups
      // ---------------------------------------------------------
      this.startProfileDeepScan('mount');
    });
  }


  componentWillUnmount() {
    this._isMounted = false;
    this._profileScanRequestSeq += 1;
    try {
      if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
        window.removeEventListener(PROFILE_SCAN_REPORT_EVENT, this.handleBackgroundProfileScanReport);
      }
    } catch (e) { accountLog.warn('UserPage: cleanup', e); }
    try {
      if (typeof this._unsubscribeCacheUpdates === 'function') {
        this._unsubscribeCacheUpdates();
      }
    } catch (e) { accountLog.warn('UserPage: cleanup', e); }
    this._unsubscribeCacheUpdates = null;
    this.clearAnalysisTimer();
    this.stopDeepScanProgressTimer();
    this.clearQueuedCacheRefresh();
    this.clearResponseGateRetryTimer();
    this._resetResponseGateAccess();
    this._clearUnifiedCacheAggregateMemo();
    this._clearSectionDeriveMemo();
  }

  componentDidUpdate(prevProps, prevState) {
    // Fast-path: nonce changed → force immediate cache re-read (bypasses signature dedup)
    const responseNonceChanged = prevProps.questionResponsesNonce !== this.props.questionResponsesNonce;
    if (responseNonceChanged) {
      const viewAddrLower = String(this.props.viewAddress || '').toLowerCase();
      const connAddrLower = String(this.props.connectedAddress || this.props.account || '').toLowerCase();
      const isOwnProfile = !!(viewAddrLower && connAddrLower && viewAddrLower === connAddrLower);
      if (isOwnProfile) {
        // eslint-disable-next-line no-console
        console.debug('[UserPage] questionResponsesNonce changed, forcing cache refresh for own profile');
        this.queueCacheRefresh({ force: true, markLoading: false, bypassSignature: true });
      } else {
        this.queueCacheRefresh({ markLoading: false });
      }
    }

    // React to address or network changes
    if (prevProps.viewAddress !== this.props.viewAddress ||
        prevProps.network?.id !== this.props.network?.id) {
      if (this._isMounted) {
        this._lastBackgroundDeepScanReportSignature = '';
        this._responsePayloadParseMemo.clear();
        this._resetResponseGateAccess();
        this._lastCacheRefreshInputSignature = '';
        this._clearUnifiedCacheAggregateMemo();
        this._clearSectionDeriveMemo();
        this._deepScanTooltipInputSignature = null;
        this._deepScanTooltipOutputSignature = '';
        this.setState({
          // Reset data related to the previous user/network
          surveyResponseInfo: [],
          surveyCreationInfo: [],
          questionCreationInfo: [],
          questionResponseInfo: [],
          detailedSurveyResponses: {},
          detailedQuestionResponses: {},
          sbtList: [],
          userStats: { // Reset stats or ensure they are recalculated
            surveysResponded: 0,
            surveysCreated: 0,
            questionsResponded: 0,
            questionsCreated: 0,
            mostUniqueIdea: ' ... ',
            badgesReceived: 0,
            worryScore: 'x%',
            enthusiasmScore: 'y%',
            topTags: ['#cybersecurity', '#ubi', '#mechinterp'],
          },
          loadingSurveys: true,
          loadingQuestions: true,
          loadingSBTs: true,
          username: '', // Reset username for the new viewAddress
          usernameError: '',
          isEditingUsername: false, // Reset username edit mode
          bookmarked: false, // Re-check for new address
          expandedSurveyResponses: {}, // Reset expanded state for surveys
          expandedSurveysCreated: {},
          viewAddress: this.props.viewAddress, // Ensure viewAddress in state is also updated
          nicknameInput: '', // NEW: clear previous nickname input when switching addresses
          isEditingNickname: false, // NEW: exit edit mode on route/network change
          isDeepScanning: false, // Reset deep scan flag
          hasUncertainUserData: false,
          hasUncertainSbtData: false,
          hasUncertainGateAccess: false,
          deepScanTooltipLines: null,
          deepScanProgressRows: null,
        }, () => {
          this.loadPersistedUsername(); // Load username for the new context
          this.loadDataFromCache();     // Load all data from cache for the new context
          this.checkIfBookmarked();     // Check bookmark status for the new context
          this.loadNicknameFromCache(); // NEW: prefill nickname for the new context

          // ---------------------------------------------------------
          // NEW: Trigger Deep Search if address changed
          // ---------------------------------------------------------
          this.startProfileDeepScan('update');
        });
      }
    }

    if (prevState.isDeepScanning !== this.state.isDeepScanning) {
      if (this.state.isDeepScanning) {
        this.startDeepScanProgressTimer();
      } else {
        this.stopDeepScanProgressTimer();
      }
    }

    // NEW: Reactivity to MainSite cache updates (no contract calls here)
    const sbtRevisionChanged = prevProps.sbtCacheRevision !== this.props.sbtCacheRevision;
    const accountChanged = prevProps.account !== this.props.account;
    if (sbtRevisionChanged || accountChanged) {
      this._resetResponseGateAccess();
    }
    if (sbtRevisionChanged || accountChanged) {
      this.queueCacheRefresh({ markLoading: false });
    }

    // Check AI availability once all caches are ready
    const allCachesReady = !!(
      this.props.isSBTCacheReady &&
      this.props.isSurveyCacheReady &&
      this.props.isQuestionCacheReady &&
      this.props.isResponsesCacheReady
    );
    const prevAllCachesReady = !!(
      prevProps.isSBTCacheReady &&
      prevProps.isSurveyCacheReady &&
      prevProps.isQuestionCacheReady &&
      prevProps.isResponsesCacheReady
    );

    // Reset + re-check AI availability on context changes
    const contextChanged = (
      prevProps.account !== this.props.account ||
      prevProps.viewAddress !== this.props.viewAddress ||
      prevProps.network?.id !== this.props.network?.id
    );
    if (contextChanged) {
      // Reset and immediately re-check if caches are ready
      this.setState({ aiAvailable: null }, () => {
        if (allCachesReady) this._checkAiAvailability();
      });
    } else if (allCachesReady && !prevAllCachesReady) {
      // Caches just became ready — initial check
      this._checkAiAvailability();
    }

    this.emitNoSbtVisibleTelemetry();
  }


  handleNicknameKeyDown = (e) => {
    if (e.key === 'Enter') {
      this.saveNickname();
    } else if (e.key === 'Escape') {
      this.cancelNicknameEdit();
    }
  }

  onPenClick = () => {
    if (!this._isMounted) return;
    this.setState({ isEditingNickname: true }, () => {
      // focus the input when it shows (best-effort via microtask)
      setTimeout(() => {
        try {
          const el = document.querySelector('input[aria-label="Set nickname"]');
          if (el) { el.focus(); el.select(); }
        } catch (e) { accountLog.warn('UserPage: fallback', e); }
      }, 0);
    });
  }

  cancelNicknameEdit = () => {
    if (!this._isMounted) return;
    const rawAddr = this.props.viewAddress;
    const currentLower = String(rawAddr || '').toLowerCase();
    let cachedNick = '';
    try {
      const parsed = this.getBookmarksCache();
      const users = Array.isArray(parsed?.users) ? parsed.users : [];
      const obj = users.find(u =>
        u && typeof u === 'object' &&
        String(u.address || '').toLowerCase() === currentLower
      );
      if (obj && typeof obj.nickname === 'string' && obj.nickname.trim()) {
        cachedNick = obj.nickname.trim();
      }
    } catch (e) { accountLog.warn('UserPage: fallback', e); }
    this.setState({ isEditingNickname: false, nicknameInput: cachedNick || '' });
  }

  handleNicknameChange = (event) => {
    if (this._isMounted) {
      this.setState({ nicknameInput: event.target.value || '' });
    }
  }


  getOnchainUsername = (_address, _network) => {
    return null;
    // should go in contractScripts.js when enabled
  }

  saveNickname = () => {
    const rawAddr = this.props.viewAddress;
    if (!rawAddr || !this._isMounted) return;

    const addrLower = String(rawAddr).toLowerCase();
    const nickname = (this.state.nicknameInput || '').trim();
    const networkIdStr = this.props.network?.id != null ? String(this.props.network.id) : null;
    const onchainUsername = this.getOnchainUsername(rawAddr, this.props.network); // returns null for now

    let bookmarksCache = this.getBookmarksCache();

    // Heal arrays
    bookmarksCache.surveys = Array.isArray(bookmarksCache.surveys) ? bookmarksCache.surveys : [];
    bookmarksCache.questions = Array.isArray(bookmarksCache.questions) ? bookmarksCache.questions : [];
    bookmarksCache.users = Array.isArray(bookmarksCache.users) ? bookmarksCache.users : [];
    bookmarksCache.filters = Array.isArray(bookmarksCache.filters) ? bookmarksCache.filters : [];

    const users = bookmarksCache.users;
    const objIdx = users.findIndex(u =>
      u && typeof u === 'object' && String(u.address || '').toLowerCase() === addrLower
    );
    const strIdx = users.findIndex(u =>
      typeof u === 'string' && String(u).toLowerCase() === addrLower
    );

    const baseObj = { address: addrLower, ...(nickname ? { nickname } : {}) };
    if (onchainUsername) baseObj.username = onchainUsername;
    if (networkIdStr) baseObj.networkId = networkIdStr;

    if (objIdx > -1) {
      // Update existing object entry — preserve other fields
      const existing = users[objIdx] && typeof users[objIdx] === 'object' ? users[objIdx] : {};
      const merged = {
        ...existing,
        address: addrLower,
        ...(onchainUsername ? { username: onchainUsername } : {}),
        ...(networkIdStr ? { networkId: networkIdStr } : {})
      };
      if (nickname) {
        merged.nickname = nickname;
      } else {
        if ('nickname' in merged) delete merged.nickname; // clearing nickname
      }
      users[objIdx] = merged;
    } else if (strIdx > -1) {
      // Legacy string entry
      if (nickname) {
        users[strIdx] = baseObj; // upgrade only if setting non-empty nickname
      }
    } else {
      if (nickname) {
        users.push(baseObj); // auto-bookmark when setting a nickname
      }
    }

    this.persistBookmarksCache(bookmarksCache, 'saveNickname');
    if (this._isMounted) {
      const stillBookmarked = users.some(u =>
        (typeof u === 'string' && String(u).toLowerCase() === addrLower) ||
        (u && typeof u === 'object' && String(u.address || '').toLowerCase() === addrLower)
      );
      this.setState({
        nicknameInput: nickname,
        bookmarked: stillBookmarked,
        isEditingNickname: false
      });
    }
  }

  loadNicknameFromCache = () => {
    const rawAddr = this.props.viewAddress;
    if (!rawAddr || !this._isMounted) return;

    const addrLower = String(rawAddr).toLowerCase();
    const bookmarksCache = this.getBookmarksCache();

    const users = Array.isArray(bookmarksCache.users) ? bookmarksCache.users : [];
    const obj = users.find(u =>
      u && typeof u === 'object' && String(u.address || '').toLowerCase() === addrLower
    );

    if (this._isMounted) {
      this.setState({ nicknameInput: (obj && typeof obj.nickname === 'string') ? obj.nickname : '' });
    }
  }

  loadPersistedUsername = () => {
    const { viewAddress, account, network } = this.props;
    if (account && viewAddress && network?.id && account.toLowerCase() === viewAddress.toLowerCase()) {
        const networkID = network.id.toString();
        try {
            const storedUsername = localStorage.getItem(`userPageUsername_${networkID}_${viewAddress.toLowerCase()}`);
            if (storedUsername && this._isMounted) {
                this.setState({ username: storedUsername });
            }
        } catch (error) {
            accountLog.error("Error loading username from localStorage:", error);
        }
    }
  }

  loadDataFromCache = () => {
    if (!this._isMounted) return;
    const currentViewAddress = this.props.viewAddress;
    if (!currentViewAddress) {
      accountLog.warn("UserPage: viewAddress is not set, cannot load data from cache.");
      if (this._isMounted) {
        this.setState({
          loadingSurveys: false,
          loadingQuestions: false,
          loadingSBTs: false,
          hasUncertainGateAccess: false,
          deepScanTooltipLines: null,
          deepScanProgressRows: null,
        });
      }
      return;
    }
    this.queueCacheRefresh({ markLoading: true });
  }

  // --- helpers: group-aware multi-cache reads (union across all groups) ---
  _dgReadAll = (name) => {
    return listNamespaceSlugsSync(name)
      .map((slug) => String(slug || ''))
      .map((slug) => ({
        slug,
        data: peekCacheSync(name, slug, { clone: false }),
      }))
      .filter((entry) => entry && entry.data && typeof entry.data === 'object');
  };

  _dgHasAny = (name) => hasNamespaceEntriesSync(name);

  _readCacheSourcePresence = () => {
    const hasSurveysCache = this._dgHasAny('surveysCache');
    const hasQuestionsCache = this._dgHasAny('questionsCache');
    const hasSbtCache = this._dgHasAny('sbtCache');
    const hasUserCache = this._dgHasAny('userCache');
    return {
      hasSurveysCache,
      hasQuestionsCache,
      hasSbtCache,
      hasUserCache,
    };
  };

  _normalizeSourceSlugForSignature = (rawSlug) => {
    const normalized = this._normalizeGateSlug(rawSlug || '');
    return normalized || 'general';
  };

  _buildNamespaceSourceMembershipSignature = (namespace = '') => {
    const rawSlugs = listNamespaceSlugsSync(namespace);
    const slugs = (Array.isArray(rawSlugs) ? rawSlugs : [])
      .map((slug) => this._normalizeSourceSlugForSignature(slug))
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    return slugs.join(',');
  };

  _readCacheSourceSnapshot = () => {
    const presence = this._readCacheSourcePresence();
    const surveysNamespaceSignature = this._buildNamespaceSourceMembershipSignature('surveysCache');
    const questionsNamespaceSignature = this._buildNamespaceSourceMembershipSignature('questionsCache');
    const sbtNamespaceSignature = this._buildNamespaceSourceMembershipSignature('sbtCache');
    const userNamespaceSignature = this._buildNamespaceSourceMembershipSignature('userCache');
    const hasSurveySources = presence.hasSurveysCache || presence.hasQuestionsCache || presence.hasUserCache;
    const hasQuestionSources = presence.hasQuestionsCache || presence.hasUserCache;
    const hasSbtSources = presence.hasSbtCache || presence.hasUserCache;

    return {
      ...presence,
      hasSurveySources,
      hasQuestionSources,
      hasSbtSources,
      surveySourcesSignature: [surveysNamespaceSignature, questionsNamespaceSignature, userNamespaceSignature].join('|'),
      questionSourcesSignature: [questionsNamespaceSignature, userNamespaceSignature].join('|'),
      sbtSourcesSignature: [sbtNamespaceSignature, userNamespaceSignature].join('|'),
      membershipSignature: [
        surveysNamespaceSignature,
        questionsNamespaceSignature,
        sbtNamespaceSignature,
        userNamespaceSignature,
      ].join('||'),
    };
  };

  _clearUnifiedCacheAggregateMemo = () => {
    this._unifiedCacheAggregateMemoKey = '';
    this._unifiedCacheAggregateMemo = null;
  };

  _clearSectionDeriveMemo = () => {
    this._sectionDeriveMemo = {
      survey: null,
      question: null,
      sbt: null,
    };
  };

  _buildUnifiedCacheAggregateMemoKey = ({
    viewAddressLower = '',
    networkID = '',
    sourceMembershipSignature = '',
  } = {}) => (
    [
      String(viewAddressLower || ''),
      String(networkID || ''),
      String(this.props.questionResponsesNonce || 0),
      String(this.props.sbtCacheRevision || 0),
      String(sourceMembershipSignature || ''),
    ].join('|')
  );

  _buildSurveyDeriveSignature = ({
    viewAddressLower = '',
    networkID = '',
    sourceSignature = '',
  } = {}) => (
    [
      String(viewAddressLower || ''),
      String(networkID || ''),
      String(sourceSignature || ''),
      String(this.props.questionResponsesNonce || 0),
      String(this.props.account || '').trim().toLowerCase(),
      String(this._responseGateAccessGeneration || 0),
      String(this._responseGateAccessStatusVersion || 0),
    ].join('|')
  );

  _buildQuestionDeriveSignature = ({
    viewAddressLower = '',
    networkID = '',
    sourceSignature = '',
  } = {}) => (
    [
      String(viewAddressLower || ''),
      String(networkID || ''),
      String(sourceSignature || ''),
      String(this.props.questionResponsesNonce || 0),
      String(this.props.account || '').trim().toLowerCase(),
      String(this._responseGateAccessGeneration || 0),
      String(this._responseGateAccessStatusVersion || 0),
    ].join('|')
  );

  _buildSbtDeriveSignature = ({
    viewAddressLower = '',
    networkID = '',
    sourceSignature = '',
  } = {}) => (
    [
      String(viewAddressLower || ''),
      String(networkID || ''),
      String(sourceSignature || ''),
      String(this.props.sbtCacheRevision || 0),
    ].join('|')
  );

  clearQueuedCacheRefresh = () => {
    if (this._queuedCacheRefreshTimer) {
      clearTimeout(this._queuedCacheRefreshTimer);
      this._queuedCacheRefreshTimer = null;
    }
    this._queuedCacheRefreshForce = false;
    this._queuedCacheRefreshLoading = false;
    this._queuedCacheRefreshBypassSignature = false;
  };

  clearResponseGateRetryTimer = () => {
    if (this._responseGateRetryTimer) {
      clearTimeout(this._responseGateRetryTimer);
      this._responseGateRetryTimer = null;
    }
    this._responseGateRetryDueAt = 0;
  };

  scheduleResponseGateRetry = (delayMs = USERPAGE_GATE_UNKNOWN_RETRY_MS) => {
    if (!this._isMounted) return;
    const safeDelay = Math.max(1000, Number(delayMs) || USERPAGE_GATE_UNKNOWN_RETRY_MS);
    const nextDueAt = Date.now() + safeDelay;
    if (this._responseGateRetryTimer && this._responseGateRetryDueAt > 0) {
      if (this._responseGateRetryDueAt <= nextDueAt) {
        return;
      }
      this.clearResponseGateRetryTimer();
    }
    this._responseGateRetryDueAt = nextDueAt;
    this._responseGateRetryTimer = setTimeout(() => {
      this._responseGateRetryTimer = null;
      this._responseGateRetryDueAt = 0;
      if (!this._isMounted) return;
      this.queueCacheRefresh({ markLoading: false, bypassSignature: true });
    }, safeDelay);
  };

  queueCacheRefresh = ({ force = false, markLoading = false, bypassSignature = false } = {}) => {
    if (!this._isMounted) return;
    this._queuedCacheRefreshForce = this._queuedCacheRefreshForce || !!force;
    this._queuedCacheRefreshLoading = this._queuedCacheRefreshLoading || !!markLoading;
    this._queuedCacheRefreshBypassSignature = this._queuedCacheRefreshBypassSignature || !!bypassSignature;
    if (this._queuedCacheRefreshTimer) return;
    this._queuedCacheRefreshTimer = setTimeout(() => {
      this._queuedCacheRefreshTimer = null;
      this.flushQueuedCacheRefresh();
    }, 16);
  };

  flushQueuedCacheRefresh = () => {
    if (!this._isMounted) return;
    const force = this._queuedCacheRefreshForce;
    const markLoading = this._queuedCacheRefreshLoading;
    const bypassSignature = this._queuedCacheRefreshBypassSignature;
    this._queuedCacheRefreshForce = false;
    this._queuedCacheRefreshLoading = false;
    this._queuedCacheRefreshBypassSignature = false;
    const refreshOpts = { force, markLoading };
    if (bypassSignature) refreshOpts.bypassSignature = true;
    this._refreshAllDataFromCache(refreshOpts);
  };

  _readNetworkCache = (cacheObj, networkID) => {
    if (!cacheObj || typeof cacheObj !== 'object') return {};
    const mergeBucket = (target, bucket) => {
      if (!bucket || typeof bucket !== 'object') return;
      ['surveys', 'surveyResponses', 'questions', 'questionResponses', 'questionResponsesMeta']
        .forEach((key) => {
          const value = bucket[key];
          if (!value || typeof value !== 'object') return;
          target[key] = {
            ...(target[key] || {}),
            ...value,
          };
        });
    };

    const merged = {};
    Object.keys(cacheObj).forEach((key) => {
      mergeBucket(merged, cacheObj[key]);
    });
    if (networkID) {
      mergeBucket(merged, cacheObj[networkID]);
    }
    return merged;
  };

  _getPrioritizedNetworkCacheNodes = (cacheObj, networkID) => {
    if (!cacheObj || typeof cacheObj !== 'object') return [];
    const out = [];
    const seen = new Set();
    const push = (keyRaw) => {
      const key = String(keyRaw || '');
      if (!key || seen.has(key)) return;
      seen.add(key);
      const value = cacheObj[key];
      if (!value || typeof value !== 'object') return;
      out.push({ key, value });
    };

    if (networkID) {
      push(networkID);
    }
    Object.keys(cacheObj).forEach(push);
    return out;
  };

  _getActiveUserChainNode = (userNode, networkID) => {
    if (!userNode || typeof userNode !== 'object') return null;
    const orderedKeys = [];
    const seen = new Set();
    const pushKey = (keyRaw) => {
      const key = String(keyRaw || '');
      if (!key || seen.has(key)) return;
      seen.add(key);
      if (!userNode[key] || typeof userNode[key] !== 'object') return;
      orderedKeys.push(key);
    };
    if (networkID) {
      pushKey(networkID);
    }
    Object.keys(userNode).forEach(pushKey);

    const mergedData = orderedKeys.reduce((acc, chainKey) => {
      const chainObj = userNode[chainKey];
      if (!chainObj || !chainObj.data || typeof chainObj.data !== 'object') return acc;
      const data = chainObj.data;
      return {
        sbts: [...(acc.sbts || []), ...(Array.isArray(data.sbts) ? data.sbts : [])],
        createdSurveys: [
          ...(acc.createdSurveys || []),
          ...(Array.isArray(data.createdSurveys) ? data.createdSurveys : []),
        ],
        createdQuestions: [
          ...(acc.createdQuestions || []),
          ...(Array.isArray(data.createdQuestions) ? data.createdQuestions : []),
        ],
        surveyResponses: [
          ...(acc.surveyResponses || []),
          ...(Array.isArray(data.surveyResponses) ? data.surveyResponses : []),
        ],
        questionResponses: [
          ...(acc.questionResponses || []),
          ...(Array.isArray(data.questionResponses) ? data.questionResponses : []),
        ],
      };
    }, {});
    if (Object.keys(mergedData).length === 0) return null;
    return { data: mergedData };
  };

  _getPrioritizedUserChainNodes = (userNode, networkID) => {
    if (!userNode || typeof userNode !== 'object') return [];
    const out = [];
    const seen = new Set();
    const push = (keyRaw) => {
      const key = String(keyRaw || '');
      if (!key || seen.has(key)) return;
      seen.add(key);
      const node = userNode[key];
      if (!node || typeof node !== 'object') return;
      out.push({ chainKey: key, node });
    };

    if (networkID) {
      push(networkID);
    }
    Object.keys(userNode).forEach(push);
    return out;
  };

  _normalizeGateSlug = (slug) => {
    const raw = String(slug || '').trim().toLowerCase();
    return raw === 'general' ? '' : raw;
  };

  _buildGateAccessCacheKey = ({ slug = '', resourceKey = '' } = {}) => {
    const accountLower = String(this.props.account || '').trim().toLowerCase();
    const networkID = String(this.props.network?.id || '');
    const sbtRevision = String(this.props.sbtCacheRevision || 0);
    const normalizedSlug = this._normalizeGateSlug(slug);
    const normalizedResource = String(resourceKey || '').trim() || 'default';
    return [
      accountLower || 'anon',
      networkID,
      sbtRevision,
      normalizedSlug,
      normalizedResource,
    ].join('|');
  };

  _buildGatePendingKey = ({ slug = '', resourceKey = '' } = {}) => (
    `${this._normalizeGateSlug(slug)}::${String(resourceKey || '').trim() || 'default'}`
  );

  _setResponseGateAccessStatus = (cacheKey, status, ts = Date.now()) => {
    const key = String(cacheKey || '').trim();
    if (!key) return;
    const nextStatus = String(status || 'missing');
    const nowTs = Number.isFinite(Number(ts)) ? Number(ts) : Date.now();
    const prev = this._responseGateAccessStatusByKey.get(key);
    if (!prev || String(prev.status || '') !== nextStatus) {
      this._responseGateAccessStatusVersion += 1;
    }
    this._responseGateAccessStatusByKey.set(key, { status: nextStatus, ts: nowTs });
  };

  _buildCacheRefreshInputSignature = ({
    viewAddressLower = '',
    networkID = '',
    hasSurveySources = false,
    hasQuestionSources = false,
    hasSbtSources = false,
    sourceMembershipSignature = '',
  } = {}) => {
    const readinessSignature = [
      this.props.isSurveyCacheReady ? '1' : '0',
      this.props.isQuestionCacheReady ? '1' : '0',
      this.props.isResponsesCacheReady ? '1' : '0',
      this.props.isSBTCacheReady ? '1' : '0',
    ].join('');
    const sourceSignature = [
      hasSurveySources ? '1' : '0',
      hasQuestionSources ? '1' : '0',
      hasSbtSources ? '1' : '0',
    ].join('');
    const gateRecheckEpoch = this._responseGateAccessStatusByKey.size > 0
      ? Math.floor(Date.now() / USERPAGE_GATE_UNKNOWN_RETRY_MS)
      : 0;
    return [
      viewAddressLower,
      String(networkID || ''),
      String(this.props.account || '').trim().toLowerCase(),
      readinessSignature,
      sourceSignature,
      String(sourceMembershipSignature || ''),
      String(this.props.questionResponsesNonce || 0),
      String(this.props.sbtCacheRevision || 0),
      this.state.hasUncertainUserData ? '1' : '0',
      this.state.hasUncertainGateAccess ? '1' : '0',
      String(this._responseGateAccessGeneration || 0),
      String(this._responseGateAccessStatusVersion || 0),
      String(gateRecheckEpoch),
    ].join('|');
  };

  _getGateResourceKeysToCheck = (resourceKey = 'default') => {
    const normalized = String(resourceKey || '').trim() || 'default';
    if (normalized === 'default') return ['default'];
    return [normalized, 'default'];
  };

  _resetResponseGateAccess = () => {
    this._responseGateAccessGeneration += 1;
    this._responseGateAccessStatusVersion += 1;
    this._responseGateAccessStatusByKey.clear();
    this._responseGateAccessInFlightByKey.clear();
    this.clearResponseGateRetryTimer();
  };

  _getResponseGateAccessStatus = ({ slug = '', resourceKey = '' } = {}) => {
    const account = String(this.props.account || '').trim();
    if (!account) return 'needs-wallet';
    const key = this._buildGateAccessCacheKey({ slug, resourceKey });
    const cached = this._responseGateAccessStatusByKey.get(key);
    return cached?.status || 'missing';
  };

  _queueResponseGateAccessChecks = (pendingKeys = new Set()) => {
    const account = String(this.props.account || '').trim();
    if (!account || !pendingKeys || pendingKeys.size === 0) return;
    const generation = this._responseGateAccessGeneration;
    const now = Date.now();
    const terminalStatuses = new Set(['granted', 'denied', 'needs-wallet', 'no-gate', 'invalid-gate']);

    pendingKeys.forEach((pendingKey) => {
      const [slugRaw, resourceRaw] = String(pendingKey || '').split('::');
      const slug = this._normalizeGateSlug(slugRaw || '');
      const resourceKey = String(resourceRaw || '').trim() || 'default';
      const cacheKey = this._buildGateAccessCacheKey({ slug, resourceKey });
      const cached = this._responseGateAccessStatusByKey.get(cacheKey);
      const cachedTs = Number(cached?.ts || 0);
      const cachedAgeMs = Number.isFinite(cachedTs) && cachedTs > 0
        ? Math.max(0, now - cachedTs)
        : Number.POSITIVE_INFINITY;
      if (
        cached &&
        terminalStatuses.has(cached.status) &&
        cachedAgeMs < USERPAGE_GATE_TERMINAL_RECHECK_MS
      ) {
        return;
      }
      if (
        cached &&
        (cached.status === 'unknown' || cached.status === 'error' || cached.status === 'unresolved') &&
        cachedAgeMs < USERPAGE_GATE_UNKNOWN_RETRY_MS
      ) {
        this.scheduleResponseGateRetry(USERPAGE_GATE_UNKNOWN_RETRY_MS - cachedAgeMs);
        return;
      }
      if (this._responseGateAccessInFlightByKey.has(cacheKey)) return;

      const previousStatus = String(cached?.status || 'missing');
      const shouldPreserveStatusWhileRevalidating = !!(
        cached &&
        terminalStatuses.has(previousStatus) &&
        cachedAgeMs >= USERPAGE_GATE_TERMINAL_RECHECK_MS
      );
      if (!shouldPreserveStatusWhileRevalidating) {
        this._setResponseGateAccessStatus(cacheKey, 'checking', now);
      }
      const cfg = getSessionConfigBySlugOrDefault(slug) || {};
      let tracked = null;
      tracked = checkSponsoredAccess({
        sessionConfig: cfg,
        sessionSlug: slug,
        account,
        resourceKey,
      })
        .then((result) => {
          if (!this._isMounted || generation !== this._responseGateAccessGeneration) return;
          const nextStatus = String(result?.status || 'unknown');
          this._setResponseGateAccessStatus(cacheKey, nextStatus, Date.now());
          if (nextStatus === 'unknown' || nextStatus === 'error' || nextStatus === 'unresolved') {
            this.scheduleResponseGateRetry(USERPAGE_GATE_UNKNOWN_RETRY_MS);
          }
          if (nextStatus !== previousStatus || !shouldPreserveStatusWhileRevalidating) {
            this.queueCacheRefresh({ markLoading: false });
          }
        })
        .catch(() => {
          if (!this._isMounted || generation !== this._responseGateAccessGeneration) return;
          const nextStatus = 'unknown';
          this._setResponseGateAccessStatus(cacheKey, nextStatus, Date.now());
          this.scheduleResponseGateRetry(USERPAGE_GATE_UNKNOWN_RETRY_MS);
          if (nextStatus !== previousStatus || !shouldPreserveStatusWhileRevalidating) {
            this.queueCacheRefresh({ markLoading: false });
          }
        })
        .finally(() => {
          if (this._responseGateAccessInFlightByKey.get(cacheKey) === tracked) {
            this._responseGateAccessInFlightByKey.delete(cacheKey);
          }
        });

      this._responseGateAccessInFlightByKey.set(cacheKey, tracked);
    });
  };

  _isQuestionPayloadEncrypted = (questionObj = null) => {
    if (!questionObj || typeof questionObj !== 'object') return false;
    if (isMaskedQuestionPayload(questionObj)) return true;
    return !!(
      questionObj.promptEncrypted ||
      questionObj.encryptedPrompt ||
      questionObj.optionsEncrypted ||
      questionObj.encryptedOptions ||
      questionObj.tagsEncrypted ||
      questionObj.encryptedTags
    );
  };

  _isEncryptedResponseField = (fieldObj = null) => {
    if (!fieldObj || typeof fieldObj !== 'object') return false;
    return !!(
      fieldObj?.encrypted ||
      fieldObj?.encryptedPortion ||
      (fieldObj?.value === '*' && (fieldObj?.encryptionAudience || fieldObj?.encrypted || fieldObj?.encryptedPortion))
    );
  };

  _isAnswerFieldEncrypted = (responseObj = null) => {
    if (!responseObj || typeof responseObj !== 'object') return false;
    return this._isEncryptedResponseField(responseObj.answer || {});
  };

  _isAdditionalFieldEncrypted = (responseObj = null) => {
    if (!responseObj || typeof responseObj !== 'object') return false;
    return this._isEncryptedResponseField(responseObj.additional || {});
  };

  _isResponsePayloadEncrypted = (responseObj = null) => {
    return this._isAnswerFieldEncrypted(responseObj) || this._isAdditionalFieldEncrypted(responseObj);
  };

  _inferResponseFieldEncryptionAudience = (responseObj = null, fieldKey = 'answer', fallback = 'gate') => {
    const rawAudience = String(responseObj?.[fieldKey]?.encryptionAudience || '').trim().toLowerCase();
    if (rawAudience === 'gate' || rawAudience === 'self') return rawAudience;
    return String(fallback || 'gate').trim().toLowerCase() || 'gate';
  };

  _inferResponseEncryptionAudience = (responseObj = null, fallback = 'gate') => {
    const answerAudience = this._inferResponseFieldEncryptionAudience(responseObj, 'answer', fallback);
    const additionalAudience = this._inferResponseFieldEncryptionAudience(responseObj, 'additional', fallback);
    if (answerAudience === 'self' && additionalAudience === 'self') return 'self';
    if (answerAudience === 'gate' || additionalAudience === 'gate') return 'gate';
    if (answerAudience === 'self' || additionalAudience === 'self') return 'self';
    return String(fallback || 'gate').trim().toLowerCase() || 'gate';
  };

  buildDecryptableResponseField = (field = null) => {
    const safeField = field && typeof field === 'object' ? field : {};
    return {
      ...(safeField || {}),
      value: Object.prototype.hasOwnProperty.call(safeField, 'value')
        ? safeField.value
        : '',
      encrypted: !!(safeField.encrypted || safeField.encryptedPortion),
    };
  };

  applyDecryptedPatchToResponseField = (field = null, decryptedPatch = null) => {
    if (!decryptedPatch || !Object.prototype.hasOwnProperty.call(decryptedPatch, 'value')) {
      return field;
    }
    const nextField = {
      ...(field && typeof field === 'object' ? field : {}),
      value: decryptedPatch.value,
      encrypted: false,
    };
    if (Object.prototype.hasOwnProperty.call(decryptedPatch, 'zkSalt')) {
      nextField.zkSalt = decryptedPatch.zkSalt;
    }
    delete nextField.encryptedPortion;
    return nextField;
  };

  buildDecryptedResponsePatch = ({
    responseObj = null,
    questionId = '',
    fieldToDecrypt = 'both',
    decryptedResult = null,
  } = {}) => {
    const qid = String(questionId || '').trim().toLowerCase();
    if (!responseObj || typeof responseObj !== 'object' || !qid) return null;
    const decryptedAnswer = decryptedResult?.answers?.[qid] || null;
    const decryptedAdditional = decryptedResult?.additionalComments?.[qid] || null;
    const shouldPatchAnswer =
      (fieldToDecrypt === 'answer' || fieldToDecrypt === 'both') &&
      !!decryptedAnswer &&
      Object.prototype.hasOwnProperty.call(decryptedAnswer, 'value');
    const shouldPatchAdditional =
      (fieldToDecrypt === 'additional' || fieldToDecrypt === 'both') &&
      !!decryptedAdditional &&
      Object.prototype.hasOwnProperty.call(decryptedAdditional, 'value');

    if (!shouldPatchAnswer && !shouldPatchAdditional) return null;

    const nextResponse = {
      ...responseObj,
    };
    if (shouldPatchAnswer) {
      nextResponse.answer = this.applyDecryptedPatchToResponseField(
        responseObj.answer,
        decryptedAnswer
      );
    }
    if (shouldPatchAdditional) {
      nextResponse.additional = this.applyDecryptedPatchToResponseField(
        responseObj.additional,
        decryptedAdditional
      );
    }
    return nextResponse;
  };

  getResponseDecryptSurveyBindings = (questionId, responseOverride = null) => {
    const qid = String(questionId || '').trim().toLowerCase();
    const surveyIds = [];
    const seen = new Set();
    const pushSurveyId = (value) => {
      const normalized = String(value || '').trim().toLowerCase();
      if (!normalized || seen.has(normalized)) return;
      seen.add(normalized);
      surveyIds.push(normalized);
    };
    const addFromEntry = (entry) => {
      if (!entry || typeof entry !== 'object') return;
      pushSurveyId(entry.associatedSurveyId);
      pushSurveyId(entry.surveyId);
      pushSurveyId(entry.surveyID);
    };

    addFromEntry(responseOverride);

    const questionResponseInfo = Array.isArray(this.state.questionResponseInfo)
      ? this.state.questionResponseInfo
      : [];
    questionResponseInfo.forEach((entry) => {
      if (String(entry?.id || '').trim().toLowerCase() !== qid) return;
      addFromEntry(entry);
    });

    const detailedSurveyResponses = this.state.detailedSurveyResponses || {};
    Object.keys(detailedSurveyResponses).forEach((surveyId) => {
      const entries = Array.isArray(detailedSurveyResponses[surveyId])
        ? detailedSurveyResponses[surveyId]
        : [];
      entries.forEach((entry) => {
        if (!entry || typeof entry !== 'object') return;
        const responseData = entry.responseData;
        const entryQid = String(entry?.questionData?.id || entry?.questionData?.questionID || '').trim().toLowerCase();
        if (responseData !== responseOverride && entryQid !== qid) return;
        pushSurveyId(surveyId);
        addFromEntry(entry?.questionData);
        addFromEntry(responseData);
      });
    });

    pushSurveyId(ethers.constants.HashZero);
    return {
      surveyId: surveyIds[0] || ethers.constants.HashZero,
      acceptedSurveyIds: surveyIds,
    };
  };

  handleDecryptQuestionAnswer = async (questionId, fieldToDecrypt = 'both', responseOverride = null) => {
    const qid = String(questionId || '').trim().toLowerCase();
    const account = String(this.props.account || '').trim();
    if (!qid || !account) return false;
    if (!responseOverride || typeof responseOverride !== 'object') return false;

    const litHooks = getGlobalLitHooks();
    const lit = litHooks && typeof litHooks.getKey === 'function'
      ? { getKey: litHooks.getKey }
      : null;
    const chainId = Number(this.props.network?.id ?? this.props.networkChainId ?? 0) || 0;
    const {
      surveyId,
      acceptedSurveyIds,
    } = this.getResponseDecryptSurveyBindings(qid, responseOverride);

    const responseSlice = {
      answers: {
        [qid]: this.buildDecryptableResponseField(responseOverride.answer),
      },
      additionalComments: {
        [qid]: this.buildDecryptableResponseField(responseOverride.additional),
      },
      importance: {},
      conviction: {},
    };

    let decryptedResult = null;
    try {
      decryptedResult = await cryptoUtils.decryptSingleField(responseSlice, qid, fieldToDecrypt, {
        account,
        provider: this.props.provider,
        providerKind: this.props.provider,
        chainId,
        surveyId,
        acceptedSurveyIds,
        lit,
        throwOnError: true,
      });
    } catch (error) {
      accountLog.warn('[UserPage] Failed to decrypt viewed response:', error);
      return false;
    }

    const patchedResponse = this.buildDecryptedResponsePatch({
      responseObj: responseOverride,
      questionId: qid,
      fieldToDecrypt,
      decryptedResult,
    });
    if (!patchedResponse) return false;

    let didUpdate = false;
    this.setState((prevState) => {
      const prevDetailedQuestionResponses = prevState.detailedQuestionResponses || {};
      const prevDetailedSurveyResponses = prevState.detailedSurveyResponses || {};
      const nextDetailedQuestionResponses = { ...prevDetailedQuestionResponses };
      const nextDetailedSurveyResponses = { ...prevDetailedSurveyResponses };

      Object.keys(nextDetailedQuestionResponses).forEach((questionKey) => {
        if (nextDetailedQuestionResponses[questionKey] === responseOverride) {
          nextDetailedQuestionResponses[questionKey] = patchedResponse;
          didUpdate = true;
        }
      });

      if (
        !didUpdate &&
        Object.prototype.hasOwnProperty.call(nextDetailedQuestionResponses, qid)
      ) {
        nextDetailedQuestionResponses[qid] = patchedResponse;
        didUpdate = true;
      }

      Object.keys(nextDetailedSurveyResponses).forEach((surveyId) => {
        const surveyEntries = nextDetailedSurveyResponses[surveyId];
        if (!Array.isArray(surveyEntries)) return;
        let surveyEntriesChanged = false;
        const updatedEntries = surveyEntries.map((entry) => {
          if (!entry || typeof entry !== 'object') return entry;
          if (entry.responseData !== responseOverride) return entry;
          surveyEntriesChanged = true;
          return {
            ...entry,
            responseData: patchedResponse,
          };
        });
        if (surveyEntriesChanged) {
          nextDetailedSurveyResponses[surveyId] = updatedEntries;
          didUpdate = true;
        }
      });

      if (!didUpdate) return null;
      return {
        detailedQuestionResponses: nextDetailedQuestionResponses,
        detailedSurveyResponses: nextDetailedSurveyResponses,
      };
    });

    return didUpdate;
  };

  _createGateAccessContext = () => ({
    pendingKeys: new Set(),
    uncertainResources: new Set(),
  });

  _captureGateContextSnapshot = (gateContext = null) => ({
    pendingKeys: Array.from(gateContext?.pendingKeys || []),
    uncertainResources: Array.from(gateContext?.uncertainResources || []),
  });

  _mergeGateContextSnapshot = (targetContext, snapshot = null) => {
    if (!targetContext || !snapshot) return;
    (Array.isArray(snapshot.pendingKeys) ? snapshot.pendingKeys : []).forEach((item) => {
      targetContext.pendingKeys.add(item);
    });
    (Array.isArray(snapshot.uncertainResources) ? snapshot.uncertainResources : []).forEach((item) => {
      targetContext.uncertainResources.add(item);
    });
  };

  _evaluateEncryptedVisibility = ({
    resourceKey = 'default',
    slug = '',
    viewAddressLower = '',
    encryptionAudience = 'gate',
    gateContext = null,
  } = {}) => {
    const viewerAccountLower = String(this.props.account || '').trim().toLowerCase();
    const isOwnProfileViewer = !!viewerAccountLower && viewerAccountLower === String(viewAddressLower || '').toLowerCase();
    if (isOwnProfileViewer) {
      return { visible: true, canDecryptOtherResponses: true };
    }

    const normalizedAudience = String(encryptionAudience || '').trim().toLowerCase();
    if (normalizedAudience === 'self') {
      return { visible: false, canDecryptOtherResponses: false };
    }

    const resourceKeysToCheck = this._getGateResourceKeysToCheck(resourceKey);
    const statusByResource = resourceKeysToCheck.map((key) => ({
      resourceKey: key,
      status: this._getResponseGateAccessStatus({ slug, resourceKey: key }),
    }));
    if (gateContext && viewerAccountLower) {
      statusByResource.forEach((entry) => {
        gateContext.pendingKeys.add(this._buildGatePendingKey({ slug, resourceKey: entry.resourceKey }));
      });
    }
    if (statusByResource.some((entry) => entry.status === 'granted')) {
      return { visible: true, canDecryptOtherResponses: true };
    }
    const terminalDeniedStatuses = new Set(['denied', 'needs-wallet', 'no-gate', 'invalid-gate']);
    const hasUncertainStatus = statusByResource.some((entry) => !terminalDeniedStatuses.has(entry.status));
    if (!hasUncertainStatus) {
      return { visible: false, canDecryptOtherResponses: false };
    }

    if (gateContext) {
      gateContext.uncertainResources.add(String(resourceKey || '').trim() || 'default');
    }
    return { visible: false, canDecryptOtherResponses: false, uncertain: true };
  };

  _collectUnifiedCacheData = ({ networkID, viewAddressLower }) => measureSync('ce.userPage.aggregateCacheData', () => {
    const surveysCaches = this._dgReadAll('surveysCache');
    const questionsCaches = this._dgReadAll('questionsCache');
    const sbtCaches = this._dgReadAll('sbtCache');
    const userCaches = this._dgReadAll('userCache');

    const combinedSurveys = {};
    const combinedSurveyResponses = {};
    const combinedSurveyResponsesMeta = {};
    const combinedQuestions = {};
    const combinedQuestionResponses = {};
    const combinedQuestionResponsesMeta = {};
    const sbtAggregate = {};
    const surveySourceSlugById = {};
    const surveyResponseSourceSlugById = {};
    const surveyResponseSourceSlugByKey = {};
    const questionSourceSlugById = {};
    const questionResponseSourceSlugById = {};
    const questionResponseSourceSlugByKey = {};
    const setSourceSlug = (target, id, slug, opts = {}) => {
      const key = String(id || '').toLowerCase();
      if (!key) return;
      const replace = !!(opts && opts.replace);
      if (!replace && Object.prototype.hasOwnProperty.call(target, key)) return;
      target[key] = this._normalizeGateSlug(slug || '');
    };
    const setResponseSourceSlug = (target, id, responder, slug, opts = {}) => {
      const idKey = String(id || '').trim().toLowerCase();
      const responderKey = String(responder || '').trim().toLowerCase();
      if (!idKey || !responderKey) return;
      const responseKey = `${idKey}|${responderKey}`;
      const replace = !!(opts && opts.replace);
      if (!replace && Object.prototype.hasOwnProperty.call(target, responseKey)) return;
      target[responseKey] = this._normalizeGateSlug(slug || '');
    };
    const readResponseRecency = (metaValue = null, responseValue = null) => {
      const src = (metaValue && typeof metaValue === 'object') ? metaValue : {};
      const responseObj = (responseValue && typeof responseValue === 'object') ? responseValue : {};
      const bn = Number(src.bn ?? src.blockNumber ?? responseObj.blockNumber ?? responseObj.bn ?? 0) || 0;
      const txi = Number(
        src.txi ??
        src.transactionIndex ??
        src.txIndex ??
        responseObj.transactionIndex ??
        responseObj.txIndex ??
        0
      ) || 0;
      const li = Number(src.li ?? src.logIndex ?? responseObj.logIndex ?? responseObj.li ?? 0) || 0;
      const ts = Number(src.ts ?? src.timestamp ?? responseObj.timestamp ?? 0) || 0;
      return {
        bn,
        txi,
        li,
        ts,
        hasHints: (bn > 0) || (txi > 0) || (li > 0) || (ts > 0),
      };
    };
    const compareResponseRecency = (incoming, existing) => {
      if (incoming.bn > existing.bn) return 1;
      if (incoming.bn < existing.bn) return -1;
      if (incoming.txi > existing.txi) return 1;
      if (incoming.txi < existing.txi) return -1;
      if (incoming.li > existing.li) return 1;
      if (incoming.li < existing.li) return -1;
      if (incoming.ts > existing.ts) return 1;
      if (incoming.ts < existing.ts) return -1;
      return 0;
    };
    const upsertSurveyResponseByRecency = ({
      sid,
      responder,
      responseValue,
      metaValue = null,
      slug = '',
    }) => {
      const sidLower = String(sid || '').trim().toLowerCase();
      const responderLower = String(responder || '').trim().toLowerCase();
      if (!sidLower || !responderLower || responseValue == null) return;
      if (!combinedSurveyResponses[sidLower]) combinedSurveyResponses[sidLower] = {};
      if (!combinedSurveyResponsesMeta[sidLower]) combinedSurveyResponsesMeta[sidLower] = {};
      const existingResponse = combinedSurveyResponses[sidLower][responderLower];
      const existingRecency = readResponseRecency(
        combinedSurveyResponsesMeta[sidLower][responderLower],
        existingResponse
      );
      const incomingRecency = readResponseRecency(metaValue, responseValue);
      const hasExisting = Object.prototype.hasOwnProperty.call(combinedSurveyResponses[sidLower], responderLower);
      let shouldReplace = !hasExisting;
      if (!shouldReplace) {
        const cmp = compareResponseRecency(incomingRecency, existingRecency);
        shouldReplace = cmp > 0 || (cmp === 0 && incomingRecency.hasHints && !existingRecency.hasHints);
      }
      if (!shouldReplace) return;
      combinedSurveyResponses[sidLower][responderLower] = responseValue;
      combinedSurveyResponsesMeta[sidLower][responderLower] = incomingRecency;
      setSourceSlug(surveyResponseSourceSlugById, sidLower, slug, { replace: true });
      setResponseSourceSlug(surveyResponseSourceSlugByKey, sidLower, responderLower, slug, { replace: true });
    };
    const upsertQuestionResponseByRecency = ({
      qid,
      responder,
      responseValue,
      metaValue = null,
      slug = '',
    }) => {
      const qidLower = String(qid || '').trim().toLowerCase();
      const responderLower = String(responder || '').trim().toLowerCase();
      if (!qidLower || !responderLower || responseValue == null) return;
      if (!combinedQuestionResponses[qidLower]) combinedQuestionResponses[qidLower] = {};
      if (!combinedQuestionResponsesMeta[qidLower]) combinedQuestionResponsesMeta[qidLower] = {};
      const existingResponse = combinedQuestionResponses[qidLower][responderLower];
      const existingRecency = readResponseRecency(
        combinedQuestionResponsesMeta[qidLower][responderLower],
        existingResponse
      );
      const incomingRecency = readResponseRecency(metaValue, responseValue);
      const hasExisting = Object.prototype.hasOwnProperty.call(combinedQuestionResponses[qidLower], responderLower);
      let shouldReplace = !hasExisting;
      if (!shouldReplace) {
        const cmp = compareResponseRecency(incomingRecency, existingRecency);
        shouldReplace = cmp > 0 || (cmp === 0 && incomingRecency.hasHints && !existingRecency.hasHints);
      }
      if (!shouldReplace) return;
      combinedQuestionResponses[qidLower][responderLower] = responseValue;
      combinedQuestionResponsesMeta[qidLower][responderLower] = incomingRecency;
      setSourceSlug(questionResponseSourceSlugById, qidLower, slug, { replace: true });
      setResponseSourceSlug(questionResponseSourceSlugByKey, qidLower, responderLower, slug, { replace: true });
    };
    const getOwnershipCountMaps = (entry = {}) => {
      const mintedCountMap = (entry?.mintedCountByAddress && typeof entry.mintedCountByAddress === 'object')
        ? entry.mintedCountByAddress
        : null;
      const burnedCountMap = (entry?.burnedCountByAddress && typeof entry.burnedCountByAddress === 'object')
        ? entry.burnedCountByAddress
        : null;
      return { mintedCountMap, burnedCountMap };
    };
    const hasMeaningfulOwnershipCounts = (entry = {}, addressLower = '') => {
      const { mintedCountMap, burnedCountMap } = getOwnershipCountMaps(entry);
      if (!mintedCountMap && !burnedCountMap) return false;
      if (entry?.countsLoaded === true) return true;
      const normalizedAddress = String(addressLower || '').toLowerCase();
      if (!normalizedAddress) return false;
      return (
        Object.prototype.hasOwnProperty.call(mintedCountMap || {}, normalizedAddress) ||
        Object.prototype.hasOwnProperty.call(burnedCountMap || {}, normalizedAddress)
      );
    };
    const hasExplicitOwnershipCounts = (entry = {}, addressLower = '') => (
      hasMeaningfulOwnershipCounts(entry, addressLower)
    );
    const readOwnershipCount = (countMap, addressLower) => (
      countMap
        ? Math.max(0, Number(countMap[addressLower] || 0) || 0)
        : 0
    );
    const applyOwnershipSignal = (aggEntry, entry, addressLower) => {
      const { mintedCountMap, burnedCountMap } = getOwnershipCountMaps(entry);
      if (!mintedCountMap && !burnedCountMap) return;
      if (!hasMeaningfulOwnershipCounts(entry, addressLower)) return;

      const mintedCount = readOwnershipCount(mintedCountMap, addressLower);
      const burnedCount = readOwnershipCount(burnedCountMap, addressLower);
      // Regression guard (PRD 336): count maps decide the viewer's current ownership;
      // raw address sets remain bulk history for non-viewer aggregation.
      if (mintedCount > burnedCount) {
        aggEntry.mintedSet.add(addressLower);
        aggEntry.burnedSet.delete(addressLower);
      } else if (burnedCount > 0) {
        aggEntry.burnedSet.add(addressLower);
      }
    };

    surveysCaches.forEach(({ slug, data: cacheObj }) => {
      const netObj = this._readNetworkCache(cacheObj, networkID);
      const surveysMap = netObj.surveys || {};
      Object.keys(surveysMap).forEach((sidRaw) => {
        const sid = String(sidRaw || '').toLowerCase();
        if (!sid) return;
        if (!combinedSurveys[sid]) combinedSurveys[sid] = surveysMap[sidRaw] || surveysMap[sid] || {};
        setSourceSlug(surveySourceSlugById, sid, slug);
      });

      const responseMap = netObj.surveyResponses || {};
      Object.keys(responseMap).forEach((sidRaw) => {
        const sid = String(sidRaw || '').toLowerCase();
        if (!sid) return;
        const perSurvey = responseMap[sidRaw] || responseMap[sid] || {};
        Object.keys(perSurvey).forEach((resAddrRaw) => {
          const responder = String(resAddrRaw || '').toLowerCase();
          if (!responder) return;
          const responseValue = (
            Object.prototype.hasOwnProperty.call(perSurvey, resAddrRaw)
              ? perSurvey[resAddrRaw]
              : perSurvey[responder]
          );
          const responseMeta = (responseValue && typeof responseValue === 'object')
            ? responseValue
            : null;
          upsertSurveyResponseByRecency({
            sid,
            responder,
            responseValue,
            metaValue: responseMeta,
            slug,
          });
        });
      });
    });

    questionsCaches.forEach(({ slug, data: cacheObj }) => {
      const netObj = this._readNetworkCache(cacheObj, networkID);
      const questionsMap = netObj.questions || {};
      Object.keys(questionsMap).forEach((qidRaw) => {
        const qid = String(qidRaw || '').toLowerCase();
        if (!qid) return;
        if (!combinedQuestions[qid]) combinedQuestions[qid] = questionsMap[qidRaw] || questionsMap[qid] || {};
        setSourceSlug(questionSourceSlugById, qid, slug);
      });

      const responseMap = netObj.questionResponses || {};
      const responseMetaMap = netObj.questionResponsesMeta || {};
      Object.keys(responseMap).forEach((qidRaw) => {
        const qid = String(qidRaw || '').toLowerCase();
        if (!qid) return;
        const perQuestion = responseMap[qidRaw] || responseMap[qid] || {};
        const perQuestionMeta = (
          (responseMetaMap[qidRaw] && typeof responseMetaMap[qidRaw] === 'object')
            ? responseMetaMap[qidRaw]
            : (responseMetaMap[qid] && typeof responseMetaMap[qid] === 'object')
              ? responseMetaMap[qid]
              : {}
        );
        Object.keys(perQuestion).forEach((resAddrRaw) => {
          const responder = String(resAddrRaw || '').toLowerCase();
          if (!responder) return;
          const responseValue = (
            Object.prototype.hasOwnProperty.call(perQuestion, resAddrRaw)
              ? perQuestion[resAddrRaw]
              : perQuestion[responder]
          );
          const responseMeta = (
            perQuestionMeta[resAddrRaw] ??
            perQuestionMeta[responder] ??
            null
          );
          upsertQuestionResponseByRecency({
            qid,
            responder,
            responseValue,
            metaValue: responseMeta,
            slug,
          });
        });
      });
    });

    sbtCaches.forEach(({ slug, data: cacheObj }) => {
      const netEntries = this._getPrioritizedNetworkCacheNodes(cacheObj, networkID);
      netEntries.forEach(({ value: netObj }) => {
        const sbtList = netObj.sbtList || {};
        Object.keys(sbtList).forEach((addrLowerKey) => {
          const entry = sbtList[addrLowerKey] || {};
          const key = String(addrLowerKey || '').toLowerCase();
          if (!key) return;

          const aggEntry = sbtAggregate[key] || {
            sbtAddress: entry.sbtAddress || key,
            sbtInfo: null,
            mintedSet: new Set(),
            burnedSet: new Set(),
            viewerCountsAuthoritative: false,
            blockNumber: 0,
            slug: slug || '',
          };

          if (slug && !aggEntry.slug) aggEntry.slug = slug;
          if (!aggEntry.sbtInfo && entry.sbtInfo) aggEntry.sbtInfo = entry.sbtInfo;
          if (aggEntry.sbtInfo && entry.sbtInfo) aggEntry.sbtInfo = { ...aggEntry.sbtInfo, ...entry.sbtInfo };
          const hasExplicitCounts = hasExplicitOwnershipCounts(entry, viewAddressLower);
          if (hasExplicitCounts) {
            aggEntry.mintedSet.delete(viewAddressLower);
            aggEntry.burnedSet.delete(viewAddressLower);
            aggEntry.viewerCountsAuthoritative = true;
          }
          (Array.isArray(entry.mintedAddresses) ? entry.mintedAddresses : [])
            .forEach((address) => {
              const addressLower = String(address || '').toLowerCase();
              if (!addressLower) return;
              if ((hasExplicitCounts || aggEntry.viewerCountsAuthoritative) && addressLower === viewAddressLower) return;
              aggEntry.mintedSet.add(addressLower);
            });
          (Array.isArray(entry.burnedAddresses) ? entry.burnedAddresses : [])
            .forEach((address) => {
              const addressLower = String(address || '').toLowerCase();
              if (!addressLower) return;
              if ((hasExplicitCounts || aggEntry.viewerCountsAuthoritative) && addressLower === viewAddressLower) return;
              aggEntry.burnedSet.add(addressLower);
            });
          applyOwnershipSignal(aggEntry, entry, viewAddressLower);
          aggEntry.blockNumber = Math.max(aggEntry.blockNumber || 0, Number(entry.blockNumber || 0));
          if (entry.sbtAddress) aggEntry.sbtAddress = entry.sbtAddress;
          sbtAggregate[key] = aggEntry;
        });
      });
    });

    userCaches.forEach(({ slug, data: userCacheObj }) => {
      const userNode = userCacheObj?.[viewAddressLower];
      if (!userNode || typeof userNode !== 'object') return;
      const chainNode = this._getActiveUserChainNode(userNode, networkID);
      const payload = chainNode?.data;
      if (!payload || typeof payload !== 'object') return;

      (payload.createdSurveys || []).forEach((item) => {
        if (!item?.id || !item?.data) return;
        const sid = String(item.id || '').toLowerCase();
        if (!sid) return;
        if (!combinedSurveys[sid]) combinedSurveys[sid] = item.data;
        if (!combinedSurveys[sid].creator) combinedSurveys[sid].creator = viewAddressLower;
        setSourceSlug(surveySourceSlugById, sid, slug);
      });

      (payload.surveyResponses || []).forEach((item) => {
        if (!item?.surveyId || !item?.response) return;
        const sid = String(item.surveyId || '').toLowerCase();
        if (!sid) return;
        upsertSurveyResponseByRecency({
          sid,
          responder: String(item.responder || viewAddressLower).toLowerCase(),
          responseValue: item.response,
          metaValue: {
            bn: Number(item.blockNumber ?? item.bn ?? 0) || 0,
            txi: Number(item.transactionIndex ?? item.txIndex ?? item.txi ?? 0) || 0,
            li: Number(item.logIndex ?? item.li ?? 0) || 0,
            ts: Number(item.timestamp ?? item.ts ?? 0) || 0,
          },
          slug,
        });
      });

      (payload.createdQuestions || []).forEach((item) => {
        if (!item?.id || !item?.data) return;
        const qid = String(item.id || '').toLowerCase();
        if (!qid) return;
        if (!combinedQuestions[qid]) combinedQuestions[qid] = item.data;
        if (!combinedQuestions[qid].creator) combinedQuestions[qid].creator = viewAddressLower;
        setSourceSlug(questionSourceSlugById, qid, slug);
      });

      (payload.questionResponses || []).forEach((item) => {
        if (!item?.questionId || !item?.response) return;
        const qid = String(item.questionId || '').toLowerCase();
        if (!qid) return;
        upsertQuestionResponseByRecency({
          qid,
          responder: String(item.responder || viewAddressLower).toLowerCase(),
          responseValue: item.response,
          metaValue: {
            bn: Number(item.blockNumber ?? item.bn ?? 0) || 0,
            txi: Number(item.transactionIndex ?? item.txIndex ?? item.txi ?? 0) || 0,
            li: Number(item.logIndex ?? item.li ?? 0) || 0,
            ts: Number(item.timestamp ?? item.ts ?? 0) || 0,
          },
          slug,
        });
      });

      this._getPrioritizedUserChainNodes(userNode, networkID).forEach(({ node }) => {
        const chainPayload = node?.data;
        if (!chainPayload || typeof chainPayload !== 'object') return;
        (chainPayload.sbts || []).forEach((item) => {
          const key = String(item?.sbtAddress || '').toLowerCase();
          if (!key) return;
          const aggEntry = sbtAggregate[key] || {
            sbtAddress: item.sbtAddress || key,
            sbtInfo: null,
            mintedSet: new Set(),
            burnedSet: new Set(),
            blockNumber: 0,
            slug: slug || '',
          };
          if (slug && !aggEntry.slug) aggEntry.slug = slug;
          if (!aggEntry.sbtInfo && item.sbtInfo) aggEntry.sbtInfo = item.sbtInfo;
          if (aggEntry.sbtInfo && item.sbtInfo) aggEntry.sbtInfo = { ...aggEntry.sbtInfo, ...item.sbtInfo };
          const mintedCountMap = (item?.mintedCountByAddress && typeof item.mintedCountByAddress === 'object')
            ? item.mintedCountByAddress
            : null;
          const burnedCountMap = (item?.burnedCountByAddress && typeof item.burnedCountByAddress === 'object')
            ? item.burnedCountByAddress
            : null;
          const mintedCount = mintedCountMap
            ? Math.max(0, Number(mintedCountMap[viewAddressLower] || 0) || 0)
            : 0;
          const burnedCount = burnedCountMap
            ? Math.max(0, Number(burnedCountMap[viewAddressLower] || 0) || 0)
            : 0;
          const hasAggregateOwnershipSignal = (
            aggEntry.mintedSet.has(viewAddressLower) ||
            aggEntry.burnedSet.has(viewAddressLower)
          );
          const hasExplicitCounts = hasExplicitOwnershipCounts(item, viewAddressLower);
          if (hasExplicitCounts) {
            if (mintedCount > burnedCount) {
              aggEntry.mintedSet.add(viewAddressLower);
              aggEntry.burnedSet.delete(viewAddressLower);
            } else if (burnedCount > 0) {
              aggEntry.burnedSet.add(viewAddressLower);
            }
          } else if (!hasAggregateOwnershipSignal) {
            // userCache SBT rows are a fallback signal only; do not override fresher sbtCache burns.
            aggEntry.mintedSet.add(viewAddressLower);
          }
          sbtAggregate[key] = aggEntry;
        });
      });
    });

    return {
      combinedSurveys,
      combinedSurveyResponses,
      combinedSurveyResponsesMeta,
      combinedQuestions,
      combinedQuestionResponses,
      combinedQuestionResponsesMeta,
      surveySourceSlugById,
      surveyResponseSourceSlugById,
      surveyResponseSourceSlugByKey,
      questionSourceSlugById,
      questionResponseSourceSlugById,
      questionResponseSourceSlugByKey,
      sbtAggregate,
      userCaches,
    };
  })

  _deriveSurveySection = (aggregate, viewAddressLower, gateContext = null) => measureSync('ce.userPage.deriveSurveySection', () => {
    const userSurveyResponses = [];
    const userCreatedSurveys = [];
    const detailedResponses = {};
    const combinedSurveys = aggregate?.combinedSurveys || {};
    const combinedSurveyResponses = aggregate?.combinedSurveyResponses || {};
    const combinedQuestions = aggregate?.combinedQuestions || {};
    const surveySourceSlugById = aggregate?.surveySourceSlugById || {};
    const surveyResponseSourceSlugById = aggregate?.surveyResponseSourceSlugById || {};
    const surveyResponseSourceSlugByKey = aggregate?.surveyResponseSourceSlugByKey || {};

    Object.keys(combinedSurveyResponses).forEach((surveyIdLower) => {
      const surveyResponsesForThisSurvey = combinedSurveyResponses[surveyIdLower];
      if (!surveyResponsesForThisSurvey) return;
      const raw = surveyResponsesForThisSurvey[viewAddressLower];
      if (!raw) return;

      const userFullResponseObject = this.parseCachedResponsePayload(raw);
      if (!userFullResponseObject || !Array.isArray(userFullResponseObject.responses)) return;
      const surveyData = (
        combinedSurveys[surveyIdLower] &&
        typeof combinedSurveys[surveyIdLower] === 'object'
      ) ? combinedSurveys[surveyIdLower] : {};
      const responseSourceKey = `${surveyIdLower}|${viewAddressLower}`;
      const sourceSlug = (
        surveyResponseSourceSlugByKey[responseSourceKey] ||
        surveyResponseSourceSlugById[surveyIdLower] ||
        surveySourceSlugById[surveyIdLower] ||
        ''
      );

      const detailedQuestionArray = [];
      let hasNonBlank = false;
      userFullResponseObject.responses.forEach((resp) => {
        const normalizedResponse = this._normalizeSingleQuestionResponsePayload(resp);
        if (!normalizedResponse) return;
        const questionIDLower = normalizedResponse.questionID
          ? String(normalizedResponse.questionID).toLowerCase()
          : 'unknown_question_id';
        const qData = combinedQuestions[questionIDLower] || {
          id: normalizedResponse.questionID || 'unknown_question_id',
          type: normalizedResponse.type || 'unknown',
          prompt: normalizedResponse.prompt || 'Unknown Question',
        };
        const questionEncrypted = this._isQuestionPayloadEncrypted(qData);
        const answerEncrypted = this._isAnswerFieldEncrypted(normalizedResponse);
        const additionalEncrypted = this._isAdditionalFieldEncrypted(normalizedResponse);
        const responseEncrypted = this._isResponsePayloadEncrypted(normalizedResponse);
        let canDecryptOtherResponses = false;

        if (questionEncrypted || answerEncrypted) {
          const visibility = this._evaluateEncryptedVisibility({
            resourceKey: 'surveyResponses',
            slug: sourceSlug,
            viewAddressLower,
            encryptionAudience: answerEncrypted
              ? this._inferResponseFieldEncryptionAudience(normalizedResponse, 'answer', 'gate')
              : 'gate',
            gateContext,
          });
          if (!visibility.visible) return;
          canDecryptOtherResponses = !!visibility.canDecryptOtherResponses;
        } else if (additionalEncrypted) {
          const visibility = this._evaluateEncryptedVisibility({
            resourceKey: 'surveyResponses',
            slug: sourceSlug,
            viewAddressLower,
            encryptionAudience: this._inferResponseFieldEncryptionAudience(normalizedResponse, 'additional', 'gate'),
            gateContext,
          });
          canDecryptOtherResponses = !!(visibility.visible && visibility.canDecryptOtherResponses);
        }

        const nonBlank = this._hasDisplayableResponsePayload(normalizedResponse);
        if (nonBlank || responseEncrypted) hasNonBlank = true;

        detailedQuestionArray.push({
          questionData: qData,
          responseData: normalizedResponse,
          canDecryptOtherResponses,
          responseEncryption: {
            answerEncrypted,
            additionalEncrypted,
          },
        });
      });

      if (!hasNonBlank) return;
      const fallbackQuestionCount = detailedQuestionArray.length;
      const surveyQuestionCount = Array.isArray(surveyData?.questionIDs)
        ? surveyData.questionIDs.length
        : 0;
      userSurveyResponses.push({
        title: surveyData.title || 'Untitled Survey',
        questionsCount: surveyQuestionCount > 0 ? surveyQuestionCount : fallbackQuestionCount,
        id: surveyIdLower,
        tags: Array.isArray(surveyData?.tags) ? surveyData.tags : [],
        documentURLs: Array.isArray(surveyData?.documentURLs) ? surveyData.documentURLs : [],
        slug: sourceSlug,
      });
      detailedResponses[surveyIdLower] = detailedQuestionArray;
    });

    Object.keys(combinedSurveys).forEach((surveyIdLower) => {
      const surveyData = combinedSurveys[surveyIdLower];
      if (surveyData?.creator && String(surveyData.creator).toLowerCase() === viewAddressLower) {
        const questionIDs = Array.isArray(surveyData?.questionIDs) ? surveyData.questionIDs : [];
        const questionPreviews = questionIDs.map((qidRaw) => {
          const fullQuestionId = String(qidRaw || '');
          const qData = combinedQuestions[fullQuestionId.toLowerCase()] || {};
          return {
            id: fullQuestionId,
            text: this._resolveQuestionPromptText(qData),
          };
        });
        userCreatedSurveys.push({
          title: surveyData.title || 'Untitled Survey',
          questionsCount: questionIDs.length,
          id: surveyIdLower,
          tags: Array.isArray(surveyData?.tags) ? surveyData.tags : [],
          documentURLs: Array.isArray(surveyData?.documentURLs) ? surveyData.documentURLs : [],
          questionIDs,
          questionPreviews,
          slug: surveySourceSlugById[surveyIdLower] || '',
        });
      }
    });

    return {
      surveyResponseInfo: userSurveyResponses,
      surveyCreationInfo: userCreatedSurveys,
      detailedSurveyResponses: detailedResponses,
      surveysResponded: userSurveyResponses.length,
      surveysCreated: userCreatedSurveys.length,
    };
  })

  _deriveQuestionSection = (aggregate, viewAddressLower, gateContext = null) => measureSync('ce.userPage.deriveQuestionSection', () => {
    const userCreatedQuestions = [];
    const userQuestionResponsesInfo = [];
    const detailedSingleQuestionResponses = {};
    const combinedQuestions = aggregate?.combinedQuestions || {};
    const combinedQuestionResponses = aggregate?.combinedQuestionResponses || {};
    const combinedQuestionResponsesMeta = aggregate?.combinedQuestionResponsesMeta || {};
    const questionSourceSlugById = aggregate?.questionSourceSlugById || {};
    const questionResponseSourceSlugById = aggregate?.questionResponseSourceSlugById || {};
    const questionResponseSourceSlugByKey = aggregate?.questionResponseSourceSlugByKey || {};

    Object.keys(combinedQuestions).forEach((qid) => {
      const qData = combinedQuestions[qid];
      const sourceSlug = questionSourceSlugById[qid] || questionResponseSourceSlugById[qid] || '';
      if (qData?.creator && String(qData.creator).toLowerCase() === viewAddressLower) {
        if (this._isQuestionPayloadEncrypted(qData)) {
          const visibility = this._evaluateEncryptedVisibility({
            resourceKey: 'questionResponses',
            slug: sourceSlug,
            viewAddressLower,
            encryptionAudience: 'gate',
            gateContext,
          });
          if (!visibility.visible) return;
        }
        userCreatedQuestions.push({
          prompt: qData.prompt || 'Unknown Prompt',
          type: qData.type || 'unknown',
          id: qid,
        });
      }
    });

    Object.keys(combinedQuestionResponses).forEach((qid) => {
      const perQ = combinedQuestionResponses[qid] || {};
      const candidate = perQ[viewAddressLower];
      if (!candidate) return;
      const responseMeta = combinedQuestionResponsesMeta?.[qid]?.[viewAddressLower] || null;

      const parsedResponse = this.parseCachedResponsePayload(candidate);
      const normalizedInput = (
        parsedResponse && typeof parsedResponse === 'object' && !Array.isArray(parsedResponse)
      )
        ? {
          ...parsedResponse,
          ...(responseMeta && typeof responseMeta === 'object'
            ? {
              blockNumber: Number(
                parsedResponse.blockNumber ??
                responseMeta.bn ??
                responseMeta.blockNumber ??
                0
              ) || 0,
              transactionIndex: Number(
                parsedResponse.transactionIndex ??
                parsedResponse.txIndex ??
                responseMeta.txi ??
                responseMeta.transactionIndex ??
                responseMeta.txIndex ??
                0
              ) || 0,
              logIndex: Number(
                parsedResponse.logIndex ??
                responseMeta.li ??
                responseMeta.logIndex ??
                0
              ) || 0,
              timestamp: Number(
                parsedResponse.timestamp ??
                responseMeta.ts ??
                responseMeta.timestamp ??
                0
              ) || 0,
            }
            : {}),
        }
        : parsedResponse;
      const userResponseObject = this._normalizeSingleQuestionResponsePayload(normalizedInput);
      if (!userResponseObject) return;

      const qData = combinedQuestions[qid] || {
        id: qid,
        type: userResponseObject?.type || 'unknown',
        prompt: userResponseObject?.prompt || 'Unknown Prompt',
      };

      const responseSourceKey = `${qid}|${viewAddressLower}`;
      const sourceSlug = (
        questionResponseSourceSlugByKey[responseSourceKey] ||
        questionResponseSourceSlugById[qid] ||
        questionSourceSlugById[qid] ||
        ''
      );
      const questionEncrypted = this._isQuestionPayloadEncrypted(qData);
      const answerEncrypted = this._isAnswerFieldEncrypted(userResponseObject);
      const additionalEncrypted = this._isAdditionalFieldEncrypted(userResponseObject);
      const responseEncrypted = this._isResponsePayloadEncrypted(userResponseObject);
      let canDecryptOtherResponses = false;
      if (questionEncrypted || answerEncrypted) {
        const visibility = this._evaluateEncryptedVisibility({
          resourceKey: 'questionResponses',
          slug: sourceSlug,
          viewAddressLower,
          encryptionAudience: answerEncrypted
            ? this._inferResponseFieldEncryptionAudience(userResponseObject, 'answer', 'gate')
            : 'gate',
          gateContext,
        });
        if (!visibility.visible) return;
        canDecryptOtherResponses = !!visibility.canDecryptOtherResponses;
      } else if (additionalEncrypted) {
        const visibility = this._evaluateEncryptedVisibility({
          resourceKey: 'questionResponses',
          slug: sourceSlug,
          viewAddressLower,
          encryptionAudience: this._inferResponseFieldEncryptionAudience(userResponseObject, 'additional', 'gate'),
          gateContext,
        });
        canDecryptOtherResponses = !!(visibility.visible && visibility.canDecryptOtherResponses);
      }

      const nonBlank = this._hasDisplayableResponsePayload(userResponseObject);
      const hasSubmissionHints = (
        this._hasResponseSubmissionHints(userResponseObject) ||
        this._hasResponseSubmissionHints(parsedResponse) ||
        this._hasResponseSubmissionHints(candidate)
      );
      const hasDisplayableResponse = nonBlank || responseEncrypted || hasSubmissionHints;
      if (!hasDisplayableResponse) return;
      const responseRecency = this._extractResponseRecency(userResponseObject, responseMeta);

      userQuestionResponsesInfo.push({
        prompt: qData.prompt || 'Unknown Prompt',
        type: qData.type || 'unknown',
        id: qid,
        canDecryptOtherResponses,
        responseEncryption: {
          answerEncrypted,
          additionalEncrypted,
        },
        _responseRecency: responseRecency,
      });
      detailedSingleQuestionResponses[qid] = userResponseObject;
    });

    userQuestionResponsesInfo.sort((a, b) => {
      const cmp = this._compareResponseRecency(a?._responseRecency, b?._responseRecency);
      if (cmp !== 0) return cmp > 0 ? -1 : 1;
      const aId = String(a?.id || '');
      const bId = String(b?.id || '');
      if (aId < bId) return -1;
      if (aId > bId) return 1;
      return 0;
    });
    const normalizedQuestionResponseInfo = userQuestionResponsesInfo.map((entry) => {
      const next = { ...entry };
      delete next._responseRecency;
      return next;
    });

    return {
      questionCreationInfo: userCreatedQuestions,
      questionResponseInfo: normalizedQuestionResponseInfo,
      detailedQuestionResponses: detailedSingleQuestionResponses,
      questionsCreated: userCreatedQuestions.length,
      questionsResponded: normalizedQuestionResponseInfo.length,
    };
  })

  _deriveSbtSection = (aggregate, viewAddressLower) => measureSync('ce.userPage.deriveSbtSection', () => {
    const userSBTs = [];
    const sbtAggregate = aggregate?.sbtAggregate || {};
    Object.keys(sbtAggregate).forEach((key) => {
      const entry = sbtAggregate[key];
      const sbtInfo = (entry && entry.sbtInfo && typeof entry.sbtInfo === 'object')
        ? entry.sbtInfo
        : {};
      if (sbtInfo.unlisted === true) return;
      if (entry.mintedSet.has(viewAddressLower) && !entry.burnedSet.has(viewAddressLower)) {
        const sbtAddress = String(entry.sbtAddress || key || sbtInfo.sbtAddress || '');
        const preferredName = String(getSbtDisplayName(sbtInfo) || '').trim();
        const shortenedAddress = (sbtAddress && sbtAddress.length > 10)
          ? proposalScripts.getShortenedAddress(sbtAddress, false)
          : sbtAddress;
        const fallbackName = shortenedAddress ? `${t('sbt')} ${shortenedAddress}` : t('sbt');
        userSBTs.push({
          sbtInfo: {
            ...sbtInfo,
            name: preferredName || fallbackName,
            sbtAddress: sbtAddress || key,
          },
          slug: entry.slug,
        });
      }
    });
    const aggregateKeys = Object.keys(sbtAggregate);
    if (aggregateKeys.length > 0) {
      const heldCandidateCount = aggregateKeys.filter((key) => {
        const entry = sbtAggregate[key];
        return !!(entry && entry.mintedSet?.has(viewAddressLower) && !entry.burnedSet?.has(viewAddressLower));
      }).length;
      const deriveSig = [
        viewAddressLower,
        String(aggregateKeys.length),
        String(heldCandidateCount),
        String(userSBTs.length),
      ].join('|');
      if (deriveSig !== this._lastProfileDeriveTelemetrySignature) {
        this._lastProfileDeriveTelemetrySignature = deriveSig;
        this.emitProfileTelemetry('derive-sbt-section', {
          viewAddress: viewAddressLower,
          aggregateSbtAddresses: aggregateKeys.length,
          heldAggregateSbtCount: heldCandidateCount,
          derivedSbtCount: userSBTs.length,
          derivedSbtSample: userSBTs
            .map((item) => String(item?.sbtInfo?.sbtAddress || '').toLowerCase())
            .filter(Boolean)
            .slice(0, 12),
        });
      }
    }
    return {
      sbtList: userSBTs,
      badgesReceived: userSBTs.length,
    };
  })

  _refreshAllDataFromCache = ({ force = false, markLoading = false, bypassSignature = false } = {}) => {
    if (!this._isMounted) return;
    const viewAddress = this.props.viewAddress;
    const networkID = this.props.network?.id != null
      ? this.props.network.id.toString()
      : '';

    if (!viewAddress) {
      this._lastCacheRefreshInputSignature = '';
      this._clearUnifiedCacheAggregateMemo();
      this._clearSectionDeriveMemo();
      this.setState((prevState) => {
        if (
          prevState.loadingSurveys === false &&
          prevState.loadingQuestions === false &&
          prevState.loadingSBTs === false &&
          prevState.hasUncertainGateAccess === false &&
          prevState.deepScanTooltipLines == null &&
          prevState.deepScanProgressRows == null
        ) {
          return null;
        }
        return {
          loadingSurveys: false,
          loadingQuestions: false,
          loadingSBTs: false,
          hasUncertainGateAccess: false,
          deepScanTooltipLines: null,
          deepScanProgressRows: null,
        };
      });
      return;
    }

    const viewAddressLower = String(viewAddress || '').toLowerCase();
    const surveysReady = !!this.props.isSurveyCacheReady;
    const questionsReady = !!this.props.isQuestionCacheReady;
    const responsesReady = !!this.props.isResponsesCacheReady;
    const sbtReady = !!this.props.isSBTCacheReady;

    const sourceSnapshot = this._readCacheSourceSnapshot();
    const sourcePresence = {
      hasSurveysCache: sourceSnapshot.hasSurveysCache,
      hasQuestionsCache: sourceSnapshot.hasQuestionsCache,
      hasSbtCache: sourceSnapshot.hasSbtCache,
      hasUserCache: sourceSnapshot.hasUserCache,
    };
    const hasSurveySources = sourceSnapshot.hasSurveySources;
    const hasQuestionSources = sourceSnapshot.hasQuestionSources;
    const hasSbtSources = sourceSnapshot.hasSbtSources;

    const refreshInputSignature = this._buildCacheRefreshInputSignature({
      viewAddressLower,
      networkID,
      hasSurveySources,
      hasQuestionSources,
      hasSbtSources,
      sourceMembershipSignature: sourceSnapshot.membershipSignature,
    });
    if (
      !force &&
      !markLoading &&
      !bypassSignature &&
      refreshInputSignature === this._lastCacheRefreshInputSignature
    ) {
      return;
    }
    this._lastCacheRefreshInputSignature = refreshInputSignature;

    const holdSurveyLoading = !force && ((!surveysReady || !responsesReady) && !hasSurveySources);
    const holdQuestionLoading = !force && ((!questionsReady || !responsesReady) && !hasQuestionSources);
    const holdSbtLoading = !force && (!sbtReady && !hasSbtSources);

    this.emitProfileColdDiag('refresh', {
      viewAddress: viewAddressLower,
      force,
      markLoading,
      bypassSignature,
      surveysReady,
      questionsReady,
      responsesReady,
      sbtReady,
      hasSurveySources,
      hasQuestionSources,
      hasSbtSources,
      holdSurveyLoading,
      holdQuestionLoading,
      holdSbtLoading,
      isDeepScanning: this.state.isDeepScanning,
      hasUncertainUserData: this.state.hasUncertainUserData,
      questionResponsesNonce: this.props.questionResponsesNonce,
      sbtCacheRevision: this.props.sbtCacheRevision,
      sourceMembership: sourceSnapshot.membershipSignature,
    });

    let aggregate = null;
    let surveySection = null;
    let questionSection = null;
    let sbtSection = null;
    let deepScanTooltipLines = null;
    let deepScanProgressRows = null;
    const gateContext = this._createGateAccessContext();

    try {
      const aggregateMemoKey = this._buildUnifiedCacheAggregateMemoKey({
        viewAddressLower,
        networkID,
        sourceMembershipSignature: sourceSnapshot.membershipSignature,
      });
      const canReuseAggregate = !!(
        this._unifiedCacheAggregateMemo &&
        this._unifiedCacheAggregateMemoKey === aggregateMemoKey
      );
      if (canReuseAggregate) {
        aggregate = this._unifiedCacheAggregateMemo;
      } else {
        aggregate = this._collectUnifiedCacheData({ networkID, viewAddressLower });
        this._unifiedCacheAggregateMemo = aggregate;
        this._unifiedCacheAggregateMemoKey = aggregateMemoKey;
      }
      const latestBlockRaw = this.props.latestBlockNumber;
      const latestBlockNum = Number.isFinite(Number(latestBlockRaw)) ? Number(latestBlockRaw) : null;
      const currentChainId = this.props.network?.id != null ? Number(this.props.network.id) : null;
      deepScanProgressRows = this._deriveDeepScanProgressRows(
        aggregate.userCaches,
        viewAddressLower,
        currentChainId,
        latestBlockNum
      );
      deepScanTooltipLines = this._formatDeepScanTooltipLinesFromRows(deepScanProgressRows);

      if (!holdSurveyLoading) {
        const surveySignature = this._buildSurveyDeriveSignature({
          viewAddressLower,
          networkID,
          sourceSignature: sourceSnapshot.surveySourcesSignature,
        });
        const surveyMemo = this._sectionDeriveMemo?.survey;
        if (!force && surveyMemo && surveyMemo.signature === surveySignature) {
          surveySection = surveyMemo.result;
          this._mergeGateContextSnapshot(gateContext, surveyMemo.gateSnapshot);
        } else {
          const surveyGateContext = this._createGateAccessContext();
          surveySection = this._deriveSurveySection(aggregate, viewAddressLower, surveyGateContext);
          const surveyGateSnapshot = this._captureGateContextSnapshot(surveyGateContext);
          this._mergeGateContextSnapshot(gateContext, surveyGateSnapshot);
          this._sectionDeriveMemo.survey = {
            signature: surveySignature,
            result: surveySection,
            gateSnapshot: surveyGateSnapshot,
          };
        }
      }
      if (!holdQuestionLoading) {
        const questionSignature = this._buildQuestionDeriveSignature({
          viewAddressLower,
          networkID,
          sourceSignature: sourceSnapshot.questionSourcesSignature,
        });
        const questionMemo = this._sectionDeriveMemo?.question;
        if (!force && questionMemo && questionMemo.signature === questionSignature) {
          questionSection = questionMemo.result;
          this._mergeGateContextSnapshot(gateContext, questionMemo.gateSnapshot);
        } else {
          const questionGateContext = this._createGateAccessContext();
          questionSection = this._deriveQuestionSection(aggregate, viewAddressLower, questionGateContext);
          const questionGateSnapshot = this._captureGateContextSnapshot(questionGateContext);
          this._mergeGateContextSnapshot(gateContext, questionGateSnapshot);
          this._sectionDeriveMemo.question = {
            signature: questionSignature,
            result: questionSection,
            gateSnapshot: questionGateSnapshot,
          };
        }
      }
      if (!holdSbtLoading) {
        const sbtSignature = this._buildSbtDeriveSignature({
          viewAddressLower,
          networkID,
          sourceSignature: sourceSnapshot.sbtSourcesSignature,
        });
        const sbtMemo = this._sectionDeriveMemo?.sbt;
        if (!force && sbtMemo && sbtMemo.signature === sbtSignature) {
          sbtSection = sbtMemo.result;
        } else {
          sbtSection = this._deriveSbtSection(aggregate, viewAddressLower);
          this._sectionDeriveMemo.sbt = {
            signature: sbtSignature,
            result: sbtSection,
          };
        }
      }
    } catch (error) {
      accountLog.error('Error processing user data from cache:', error);
    }

    this.emitProfileColdDiag('derive', {
      aggregateBuilt: !!aggregate,
      combinedSurveys: aggregate ? Object.keys(aggregate.combinedSurveys || {}).length : 0,
      combinedQuestions: aggregate ? Object.keys(aggregate.combinedQuestions || {}).length : 0,
      combinedSurveyResponses: aggregate ? Object.keys(aggregate.combinedSurveyResponses || {}).length : 0,
      combinedQuestionResponses: aggregate ? Object.keys(aggregate.combinedQuestionResponses || {}).length : 0,
      sbtAggregateKeys: aggregate ? Object.keys(aggregate.sbtAggregate || {}).length : 0,
      surveySection: surveySection ? {
        responseCount: surveySection.surveyResponseInfo?.length,
        createdCount: surveySection.surveyCreationInfo?.length,
      } : null,
      questionSection: questionSection ? {
        responseCount: questionSection.questionResponseInfo?.length,
        createdCount: questionSection.questionCreationInfo?.length,
      } : null,
      sbtSection: sbtSection ? { sbtCount: sbtSection.sbtList?.length } : null,
    });

    const aggregateSbt = aggregate?.sbtAggregate || {};
    const aggregateSbtKeys = Object.keys(aggregateSbt);
    const heldAggregateSbtKeys = aggregateSbtKeys.filter((key) => {
      const entry = aggregateSbt[key];
      return !!(entry && entry.mintedSet?.has(viewAddressLower) && !entry.burnedSet?.has(viewAddressLower));
    });
    const aggregateSurveyMap = aggregate?.combinedSurveys || {};
    const aggregateQuestionMap = aggregate?.combinedQuestions || {};
    const aggregateSurveyResponseMap = aggregate?.combinedSurveyResponses || {};
    const aggregateQuestionResponseMap = aggregate?.combinedQuestionResponses || {};
    const aggregateSurveyResponseIds = Object.keys(aggregateSurveyResponseMap).filter((sidRaw) => {
      const sid = String(sidRaw || '').toLowerCase();
      if (!sid) return false;
      const row = aggregateSurveyResponseMap[sidRaw] || aggregateSurveyResponseMap[sid] || {};
      return !!(row && Object.prototype.hasOwnProperty.call(row, viewAddressLower));
    });
    const aggregateQuestionResponseIds = Object.keys(aggregateQuestionResponseMap).filter((qidRaw) => {
      const qid = String(qidRaw || '').toLowerCase();
      if (!qid) return false;
      const row = aggregateQuestionResponseMap[qidRaw] || aggregateQuestionResponseMap[qid] || {};
      return !!(row && Object.prototype.hasOwnProperty.call(row, viewAddressLower));
    });
    const refreshTelemetry = {
      viewAddress: viewAddressLower,
      networkID: String(networkID || ''),
      force: !!force,
      markLoading: !!markLoading,
      bypassSignature: !!bypassSignature,
      isDeepScanning: !!this.state.isDeepScanning,
      hasUncertainUserData: !!this.state.hasUncertainUserData,
      hasUncertainGateAccess: !!this.state.hasUncertainGateAccess,
      sbtReady,
      holdSbtLoading,
      hasSbtSources,
      aggregateSbtAddresses: aggregateSbtKeys.length,
      heldAggregateSbtCount: heldAggregateSbtKeys.length,
      heldAggregateSbtSample: heldAggregateSbtKeys.slice(0, 12),
      aggregateSurveyCount: Object.keys(aggregateSurveyMap).length,
      aggregateQuestionCount: Object.keys(aggregateQuestionMap).length,
      aggregateSurveyResponseCount: aggregateSurveyResponseIds.length,
      aggregateQuestionResponseCount: aggregateQuestionResponseIds.length,
      aggregateSurveyResponseSample: aggregateSurveyResponseIds.slice(0, 12),
      aggregateQuestionResponseSample: aggregateQuestionResponseIds.slice(0, 12),
      derivedSbtCount: Array.isArray(sbtSection?.sbtList) ? sbtSection.sbtList.length : null,
      sourcePresence,
      deepScanTooltipLines: Array.isArray(deepScanTooltipLines)
        ? deepScanTooltipLines.slice(0, 8)
        : [],
    };
    const refreshSig = [
      refreshTelemetry.viewAddress,
      refreshTelemetry.networkID,
      String(refreshTelemetry.isDeepScanning ? 1 : 0),
      String(refreshTelemetry.hasUncertainUserData ? 1 : 0),
      String(refreshTelemetry.sbtReady ? 1 : 0),
      String(refreshTelemetry.holdSbtLoading ? 1 : 0),
      String(refreshTelemetry.hasSbtSources ? 1 : 0),
      String(refreshTelemetry.aggregateSbtAddresses),
      String(refreshTelemetry.heldAggregateSbtCount),
      String(refreshTelemetry.aggregateSurveyCount || 0),
      String(refreshTelemetry.aggregateQuestionCount || 0),
      String(refreshTelemetry.aggregateSurveyResponseCount || 0),
      String(refreshTelemetry.aggregateQuestionResponseCount || 0),
      String(refreshTelemetry.derivedSbtCount ?? ''),
      refreshTelemetry.deepScanTooltipLines.join('|'),
    ].join('|');
    if (refreshSig !== this._lastProfileRefreshTelemetrySignature) {
      this._lastProfileRefreshTelemetrySignature = refreshSig;
      this._lastProfileRefreshTelemetry = refreshTelemetry;
      this.emitProfileTelemetry('refresh-cache-snapshot', refreshTelemetry);
    }

    const shouldRetryQuestionData = !!(
      this.state.hasUncertainUserData &&
      (
        holdQuestionLoading ||
        !questionSection ||
        !Array.isArray(questionSection.questionResponseInfo) ||
        questionSection.questionResponseInfo.length === 0
      )
    );
    this._queueResponseGateAccessChecks(gateContext.pendingKeys);
    if (gateContext.uncertainResources.size > 0 || shouldRetryQuestionData) {
      this.scheduleResponseGateRetry(USERPAGE_GATE_UNKNOWN_RETRY_MS);
    } else {
      this.clearResponseGateRetryTimer();
    }

    this.setState((prevState) => {
      const next = {};
      const userStatsPatch = {};
      const preserveUserDataUncertainty = !!prevState.hasUncertainUserData;
      const hasSurveyGateUncertainty = gateContext.uncertainResources.has('surveyResponses');
      const hasQuestionGateUncertainty = gateContext.uncertainResources.has('questionResponses');
      const hasGateUncertainty = hasSurveyGateUncertainty || hasQuestionGateUncertainty;
      const keepSurveyLoadingDuringDeepScan = this.isDeepScanLoadingEnabledForSection('surveys');
      const keepQuestionLoadingDuringDeepScan = this.isDeepScanLoadingEnabledForSection('questions');
      const keepSurveyLoadingFromUserUncertainty = preserveUserDataUncertainty && (
        prevState.isDeepScanning ||
        !hasSurveySources
      );
      const keepQuestionLoadingFromUserUncertainty = preserveUserDataUncertainty && (
        prevState.isDeepScanning ||
        !hasQuestionSources
      );
      const keepSbtLoadingFromUserUncertainty = preserveUserDataUncertainty && (
        prevState.isDeepScanning ||
        !hasSbtSources
      );
      next.hasUncertainGateAccess = hasGateUncertainty;

      if (surveySection) {
        next.surveyResponseInfo = surveySection.surveyResponseInfo;
        next.surveyCreationInfo = surveySection.surveyCreationInfo;
        next.detailedSurveyResponses = surveySection.detailedSurveyResponses;
        userStatsPatch.surveysResponded = surveySection.surveysResponded;
        userStatsPatch.surveysCreated = surveySection.surveysCreated;
        next.loadingSurveys = (
          keepSurveyLoadingFromUserUncertainty ||
          hasSurveyGateUncertainty ||
          (keepSurveyLoadingDuringDeepScan && prevState.isDeepScanning)
        ) && surveySection.surveyResponseInfo.length === 0;
      } else if (holdSurveyLoading || markLoading || !aggregate) {
        next.loadingSurveys = true;
      }

      if (questionSection) {
        next.questionCreationInfo = questionSection.questionCreationInfo;
        next.questionResponseInfo = questionSection.questionResponseInfo;
        next.detailedQuestionResponses = questionSection.detailedQuestionResponses;
        userStatsPatch.questionsCreated = questionSection.questionsCreated;
        userStatsPatch.questionsResponded = questionSection.questionsResponded;
        next.loadingQuestions = (
          keepQuestionLoadingFromUserUncertainty ||
          hasQuestionGateUncertainty ||
          (keepQuestionLoadingDuringDeepScan && prevState.isDeepScanning)
        ) && questionSection.questionResponseInfo.length === 0;
      } else if (holdQuestionLoading || markLoading || !aggregate) {
        next.loadingQuestions = true;
      }

      if (sbtSection) {
        next.sbtList = sbtSection.sbtList;
        userStatsPatch.badgesReceived = sbtSection.badgesReceived;
        next.loadingSBTs = keepSbtLoadingFromUserUncertainty && sbtSection.sbtList.length === 0;
      } else if (holdSbtLoading || markLoading || !aggregate) {
        next.loadingSBTs = true;
      }

      if (deepScanTooltipLines != null || (Array.isArray(prevState.deepScanTooltipLines) && prevState.deepScanTooltipLines.length > 0)) {
        next.deepScanTooltipLines = deepScanTooltipLines;
      }
      if (deepScanProgressRows != null || (Array.isArray(prevState.deepScanProgressRows) && prevState.deepScanProgressRows.length > 0)) {
        next.deepScanProgressRows = deepScanProgressRows;
      }

      if (Object.keys(userStatsPatch).length > 0) {
        next.userStats = { ...prevState.userStats, ...userStatsPatch };
      }

      this.emitProfileColdDiag('loading-flags', {
        prevIsDeepScanning: prevState.isDeepScanning,
        prevHasUncertainUserData: prevState.hasUncertainUserData,
        preserveUserDataUncertainty,
        keepSurveyLoadingDuringDeepScan,
        keepSurveyLoadingFromUserUncertainty,
        hasSurveyGateUncertainty,
        keepQuestionLoadingDuringDeepScan,
        keepQuestionLoadingFromUserUncertainty,
        hasQuestionGateUncertainty,
        loadingSurveys: next.loadingSurveys,
        loadingQuestions: next.loadingQuestions,
        loadingSBTs: next.loadingSBTs,
        surveyResponseCount: surveySection?.surveyResponseInfo?.length ?? 'N/A (held)',
        questionResponseCount: questionSection?.questionResponseInfo?.length ?? 'N/A (held)',
        sbtCount: sbtSection?.sbtList?.length ?? 'N/A (held)',
      });

      return Object.keys(next).length > 0 ? next : null;
    });
  }

  // -----------------------------------------------------------
  //                    SECTION REFRESH WRAPPERS
  // -----------------------------------------------------------
  getSurveyDataFromCache = () => {
    this.queueCacheRefresh({ markLoading: false });
  };

  getQuestionDataFromCache = () => {
    this.queueCacheRefresh({ markLoading: false });
  }

  getSBTsFromCache = () => {
    this.queueCacheRefresh({ markLoading: false });
  }



  // -----------------------------------------------------------
  //        COPY / BOOKMARK / COLLAPSE / USERNAME
  // -----------------------------------------------------------

  copyToClipboard = () => {
    navigator.clipboard.writeText(this.props.viewAddress).then(() => {
      notify.success('Copied to clipboard');
      if (this._isMounted) {
        this.setState({ copied: true }, () => {
          setTimeout(() => {
            if (this._isMounted) {
              this.setState({ copied: false });
            }
          }, 2500);
        });
      }
    });
  }

  toggleCollapse = () => {
    if (this._isMounted) {
        this.setState(prevState => ({
            collapseOpen: !prevState.collapseOpen
        }));
    }
  }

  openFullPage = () => {
    window.open(`/u/${this.props.viewAddress}`);
  }

  handleUsernameChange = (event) => {
    if (this._isMounted) {
        this.setState({ username: event.target.value, usernameError: '' });
    }
  }

  onUsernamePenClick = () => {
    if (!this._isMounted) return;
    this.setState({ isEditingUsername: true }, () => {
      // focus the input when it shows (best-effort via microtask)
      setTimeout(() => {
        try {
          const el = document.querySelector('input[aria-label="Set username"]');
          if (el) { el.focus(); el.select(); }
        } catch (e) { accountLog.warn('UserPage: fallback', e); }
      }, 0);
    });
  }

  cancelUsernameEdit = () => {
    if (!this._isMounted) return;
    this.setState({ isEditingUsername: false });
    this.loadPersistedUsername(); // Revert to saved value
  }

  handleUsernameKeyDown = (e) => {
    if (e.key === 'Enter') {
      this.setUsername();
    } else if (e.key === 'Escape') {
      this.cancelUsernameEdit();
    }
  }

  setUsername = () => {
    const newUsernameToSet = this.state.username;
    const { account, viewAddress, network } = this.props;

    if (account && viewAddress && account.toLowerCase() === viewAddress.toLowerCase()) {
      if (this._isMounted) {
        // Optimistically update and close edit mode
        this.setState({ username: newUsernameToSet, usernameError: '', isEditingUsername: false });
        if (network?.id) {
          const networkID = network.id.toString();
          try {
            localStorage.setItem(`userPageUsername_${networkID}_${viewAddress.toLowerCase()}`, newUsernameToSet);
          } catch (error) {
            accountLog.error("Error saving username to localStorage:", error);
            if (this._isMounted) {
                this.setState({ usernameError: 'Failed to save username locally.' });
            }
          }
        } else {
          if (this._isMounted) {
            this.setState({ usernameError: "Cannot persist username: network information is missing." });
          }
        }
      }
    } else {
      if (this._isMounted) {
        this.setState({ usernameError: "Can only set username for your own account." });
      }
    }
  }

  toggleBookmark = (optionalMeta = {}) => {
    if (!this.props.viewAddress) return;
    let bookmarksCache = this.getBookmarksCache();

    // Heal missing arrays (e.g., filters)
    if (!Array.isArray(bookmarksCache.filters)) bookmarksCache.filters = [];

    const addrRaw = this.props.viewAddress;
    const addrLower = String(addrRaw).toLowerCase();

    // Find entry (string or object) for this address
    const users = bookmarksCache.users;
    const idx = users.findIndex(u =>
      (typeof u === 'string' && String(u).toLowerCase() === addrLower) ||
      (u && typeof u === 'object' && String(u.address || '').toLowerCase() === addrLower)
    );

    let nextBookmarked = false;
    const nextState = {};
    if (idx > -1) {
        // Remove (match either shape)
        users.splice(idx, 1);
        nextBookmarked = false;
        nextState.isEditingNickname = false;
        nextState.nicknameInput = '';
    } else {
        // Add: object if meta present or nickname exists; otherwise keep legacy string for b/c
        const onchainUsername = this.getOnchainUsername(addrRaw, this.props.network);
        const shouldUseObject =
          (!!optionalMeta && (optionalMeta.nickname || optionalMeta.username)) ||
          !!this.state.nicknameInput ||
          !!onchainUsername;

        if (shouldUseObject) {
          const obj = {
            address: addrLower,
            ...(this.state.nicknameInput ? { nickname: this.state.nicknameInput } : {}),
            ...(onchainUsername ? { username: onchainUsername } : {}),
            ...(this.props.network?.id != null ? { networkId: String(this.props.network.id) } : {})
          };
          if (optionalMeta && typeof optionalMeta === 'object') {
            if (optionalMeta.nickname != null) obj.nickname = optionalMeta.nickname;
            if (optionalMeta.username != null) obj.username = optionalMeta.username;
          }
          users.push(obj);
        } else {
          // Legacy string entry keeps original-case address for maximum compatibility
          users.push(addrRaw);
        }
        nextBookmarked = true;

    }

    this.persistBookmarksCache(bookmarksCache, 'toggleBookmark');
    if (this._isMounted) {
      this.setState({
        bookmarked: nextBookmarked,
        ...nextState,
      });
    }
  }


  checkIfBookmarked = () => {
    if (!this.props.viewAddress) return;
    const bookmarksCache = this.getBookmarksCache();

    const users = Array.isArray(bookmarksCache.users) ? bookmarksCache.users : [];
    const addrLower = String(this.props.viewAddress).toLowerCase();

    let found = false;
    let objNickname = null;

    for (const u of users) {
      if (typeof u === 'string') {
        if (String(u).toLowerCase() === addrLower) {
          found = true;
        }
      } else if (u && typeof u === 'object') {
        const a = String(u.address || '').toLowerCase();
        if (a === addrLower) {
          found = true;
          if (typeof u.nickname === 'string' && u.nickname) {
            objNickname = u.nickname;
          }
        }
      }
      if (found && objNickname) break;
    }

    if (this._isMounted) {
      const nextState = {};
      if (this.state.bookmarked !== found) {
        nextState.bookmarked = found;
      }
      // If an object entry exists for this address, prefill nickname
      if (objNickname != null && this.state.nicknameInput !== objNickname) {
        nextState.nicknameInput = objNickname;
      }
      if (Object.keys(nextState).length > 0) {
        this.setState(nextState);
      }
    }
  }


  // ---- Analyze helpers (timer management) ----
  startAnalysisTimer = () => {
    this.clearAnalysisTimer();
    const startedAt = Date.now();
    this.analysisTimer = setInterval(() => {
      if (!this._isMounted) return;
      this.setState({ analysisElapsedMs: Date.now() - startedAt });
    }, 250);
  };

  clearAnalysisTimer = () => {
    if (this.analysisTimer) {
      clearInterval(this.analysisTimer);
      this.analysisTimer = null;
    }
  };

  _getAiSessionScopeContext = () => {
    const mode = String(globalThis?.CE_SESSION_SCAN_SCOPE || '').trim().toLowerCase();
    const activeSlug = normalizeSessionSlug(this.props.activeSessionSlug || '');
    const toList = (raw) => (
      Array.isArray(raw)
        ? Array.from(new Set(raw.map((item) => normalizeSessionSlug(item || ''))))
        : []
    );
    if (mode === 'general') {
      return { mode, strict: true, allowedSlugs: [''] };
    }
    if (mode === 'active') {
      return { mode, strict: !!activeSlug, allowedSlugs: activeSlug ? [activeSlug] : [] };
    }
    if (mode === 'list') {
      const list = toList(globalThis?.CE_SESSION_SCAN_SLUGS);
      return { mode, strict: list.length > 0, allowedSlugs: list };
    }
    return { mode: mode || 'all', strict: false, allowedSlugs: [] };
  };

  _getAiSessionSlugCandidates = () => {
    const ordered = [];
    const seen = new Set();
    const push = (rawSlug) => {
      const slug = normalizeSessionSlug(rawSlug || '');
      if (seen.has(slug)) return;
      seen.add(slug);
      ordered.push(slug);
    };

    const activeSlug = normalizeSessionSlug(this.props.activeSessionSlug || '');
    const scopeContext = this._getAiSessionScopeContext();
    // Intentionally keep the actively navigated session eligible even in strict list/general
    // scope so analysis can use the session the user is currently viewing (e.g. out-of-list
    // sessions where the user still has access/decryption rights).
    push(activeSlug);
    scopeContext.allowedSlugs.forEach((slug) => push(slug));
    ['userCache', 'surveysCache', 'questionsCache', 'sbtCache'].forEach((namespace) => {
      listNamespaceSlugsSync(namespace).forEach((slug) => push(slug));
    });
    (Array.isArray(this.state.sbtList) ? this.state.sbtList : []).forEach((item) => {
      push(item?.slug);
    });
    if (!ordered.length) push('');
    if (!scopeContext.strict) return ordered;

    const allowed = new Set(scopeContext.allowedSlugs);
    if (activeSlug) allowed.add(activeSlug);
    const filtered = ordered.filter((slug) => allowed.has(slug));
    return filtered.length > 0 ? filtered : ordered;
  };

  _getSessionConfigForSlugExact = (slugIn = '') => {
    const slug = normalizeSessionSlug(slugIn || '');
    if (!slug) {
      const cfg = getSessionConfigBySlugOrDefault('');
      return (cfg && typeof cfg === 'object') ? cfg : null;
    }
    // Strict lookup for non-general slugs: allow known alias keys/names, but block
    // unknown slugs from silently falling back to default/general config.
    const cfg = getSessionConfigBySlug(slug);
    return (cfg && typeof cfg === 'object') ? cfg : null;
  };

  resolveAnalysisSessionContext = async (excludeSlugs = []) => {
    const list = Array.isArray(excludeSlugs) ? excludeSlugs.filter((s) => s != null) : [];
    const excludeSet = new Set(list.map((s) => normalizeSessionSlug(s || '')));
    const activeSlug = normalizeSessionSlug(this.props.activeSessionSlug || '');
    const account = String(this.props.account || '').trim();
    const candidates = this._getAiSessionSlugCandidates();
    const scopeContext = this._getAiSessionScopeContext();
    const checked = [];
    let activeCandidate = null;
    let firstUsable = null;

    for (const slug of candidates) {
      if (excludeSet.has(slug)) continue;
      const sessionConfig = this._getSessionConfigForSlugExact(slug);
      if (!sessionConfig) continue;

      let status = 'unknown';
      try {
        const access = await checkSponsoredAccess({
          sessionConfig,
          sessionSlug: slug,
          account,
          resourceKey: 'ai',
        });
        status = String(access?.status || 'unknown').trim().toLowerCase() || 'unknown';
      } catch (_) {
        status = 'unknown';
      }

      const row = { slug, sessionConfig, status };
      checked.push(row);
      if (slug === activeSlug) activeCandidate = row;
      if (!firstUsable && status !== 'denied' && status !== 'invalid-gate') {
        firstUsable = row;
      }
      if (status === 'no-gate' || status === 'granted') {
        const reason = 'open-ai-gate';
        accountLog.log('[UserPage] analyze session selected', {
          activeSlug,
          selectedSlug: slug,
          status,
          reason,
          scopeMode: scopeContext.mode,
          candidates: checked.map((entry) => ({
            slug: entry.slug || 'general',
            status: entry.status,
          })),
        });
        return { ...row, reason };
      }
    }

    const fallback = activeCandidate || firstUsable || checked[0] || null;
    if (fallback) {
      const reason = fallback === activeCandidate
        ? 'fallback-active-session'
        : fallback === firstUsable
          ? 'fallback-first-usable-session'
          : 'fallback-first-checked-session';
      accountLog.log('[UserPage] analyze session fallback', {
        activeSlug,
        selectedSlug: fallback.slug,
        status: fallback.status,
        reason,
        scopeMode: scopeContext.mode,
        candidates: checked.map((entry) => ({
          slug: entry.slug || 'general',
          status: entry.status,
        })),
      });
      return { ...fallback, reason };
    }
    accountLog.warn('[UserPage] analyze session unavailable', {
      activeSlug,
      scopeMode: scopeContext.mode,
      candidateCount: candidates.length,
    });
    return null;
  };

  _aiCheckSeq = 0;

  _checkAiAvailability = async () => {
    if (!this._isMounted) return;
    const seq = ++this._aiCheckSeq;
    try {
      const session = await this.resolveAnalysisSessionContext();
      if (this._isMounted && seq === this._aiCheckSeq) {
        this.setState({ aiAvailable: session !== null });
      }
    } catch (_) {
      if (this._isMounted && seq === this._aiCheckSeq) {
        this.setState({ aiAvailable: false });
      }
    }
  };

  analyzeUser = async (forceRefresh = false) => {
    if (!this._isMounted) return;

    // Helper: pull a visible additional comment string from various possible shapes
    const extractAdditionalComment = (obj) => {
      if (!obj) return null;
      const candidates = [
        obj.additionalComment,
        obj.additionalComments,
        obj.comment,
        obj.comments
      ];
      for (const c of candidates) {
        if (c == null) continue;
        const val = typeof c === 'string' ? c : (c.value ?? c.text ?? null);
        const enc = typeof c === 'object' && c.encrypted === true;
        if (val && val !== '*' && !enc && String(val).trim() !== '*') return String(val);
      }
      return null;
    };

    const extractImportance = (obj) => {
      const cand =
        obj?.conviction ??
        obj?.importance ??
        obj?.meta?.conviction ??
        obj?.meta?.importance ??
        obj?.answer?.conviction ??
        obj?.answer?.importance;
      return (cand === '*' || (cand && cand.encrypted === true)) ? undefined : cand;
    };

    // --- Assemble inputs strictly from current state (already hydrated from other caches) ---
    const sbts = (this.state.sbtList || [])
      .map(item => ({
        name: getSbtDisplayName(item?.sbtInfo) || item?.name || '',
        address: item?.sbtInfo?.sbtAddress
      }))
      .filter(s => s && s.name && s.address);

    // Question-level responses (all types; only visible)
    const questions = (this.state.questionResponseInfo || [])
      .map(q => {
        const resp = this.state.detailedQuestionResponses?.[q.id] || {};
        const ans = resp?.answer?.value;
        if (ans === '*' || ans === '' || ans == null) return null; // skip encrypted/blank
        return {
          id: q.id,
          type: q.type,
          prompt: q.prompt,
          answer: Array.isArray(ans) ? ans : ans, // keep native type (bool/number/string/array)
          importance: extractImportance(resp),
          additionalComment: extractAdditionalComment(resp) || undefined
        };
      })
      .filter(Boolean);

    // Survey-level summaries + samples of answered items (with types & additional comments)
    const surveys = (this.state.surveyResponseInfo || []).map(s => {
      const arr = this.state.detailedSurveyResponses?.[s.id] || [];
      const answered = arr.filter(it => {
        const v = it?.responseData?.answer?.value;
        return v && v !== '*';
      });

      const sample = answered.slice(0, 3).map(it => {
        const v = it?.responseData?.answer?.value;
        return {
          prompt: it?.questionData?.prompt,
          type: it?.questionData?.type || it?.responseData?.type || 'unknown',
          answer: Array.isArray(v) ? v : v,
          importance: extractImportance(it?.responseData),
          additionalComment: extractAdditionalComment(it?.responseData) || undefined
        };
      });

      const additionalCommentsSample = answered
        .map(it => extractAdditionalComment(it?.responseData))
        .filter(Boolean)
        .slice(0, 3);

      return {
        surveyId: s.id,
        title: s.title,
        answeredCount: answered.length,
        sample,
        additionalCommentsSample: additionalCommentsSample.length > 0 ? additionalCommentsSample : undefined
      };
    });

    // Created content (counts + actual items)
    const questionsCreated = (this.state.questionCreationInfo || []).map(q => ({
      id: q.id,
      type: q.type,
      prompt: q.prompt
    }));

    // For surveys the user created, include title + a small sample of question prompts/types
    let surveysCreated = [];
    try {
      const networkID = this.props.network?.id?.toString();
      const slug = (this.props.activeSessionSlug == null ? '' : this.props.activeSessionSlug);
      const surveysCache = peekCacheSync('surveysCache', slug, { clone: false }) || {};
      const questionsCache = peekCacheSync('questionsCache', slug, { clone: false }) || {};
      const readNetCache = (cacheObj, netKey) => {
        if (!cacheObj || typeof cacheObj !== 'object' || !netKey) return {};
        return cacheObj[netKey] || {};
      };

      const netSurv = readNetCache(surveysCache, networkID);
      const netQs = readNetCache(questionsCache, networkID);

      surveysCreated = (this.state.surveyCreationInfo || []).map(sv => {
        const sData = netSurv?.surveys?.[sv.id];
        const qIds = Array.isArray(sData?.questionIDs) ? sData.questionIDs : [];
        const sampleQuestions = qIds.slice(0, 5).map(qid => {
          const q = netQs?.questions?.[qid.toLowerCase()];
          return q
            ? { id: (q.id || qid.toLowerCase()), type: q.type, prompt: q.prompt }
            : { id: qid.toLowerCase() };
        });
        return {
          surveyId: sv.id,
          title: sv.title,
          questionsCount: sv.questionsCount,
          sampleQuestions
        };
      });
    } catch (e) { accountLog.warn('UserPage: fallback', e); }

    const createdCounts = {
      questionsCreated: questionsCreated.length,
      surveysCreated: surveysCreated.length
    };

    const userData = {
      address: this.props.viewAddress,
      username: this.state.username || null,
      sbts,
      questions,
      surveys,
      // NEW: created content + explicit counts
      questionsCreated,
      surveysCreated,
      createdCounts
    };

    try {
      this.setState({
        showAnalysisModal: true,
        analyzing: true,
        analysisError: '',
        aiAnalysis: '',
        analysisDetails: '',
        analysisName: '',
        analysisElapsedMs: 0,
        analysisHistoricalFigure: '',
        analysisHistoricalReasoning: ''
      });
      this.startAnalysisTimer();

      const analysisSession = await this.resolveAnalysisSessionContext();
      if (!analysisSession?.sessionConfig) {
        throw new Error('No valid AI session configuration available for this profile context.');
      }
      const aiOptions = {
        sessionSlug: String(analysisSession.slug || ''),
        sessionConfig: analysisSession.sessionConfig,
        sessionSelection: {
          gateStatus: String(analysisSession.status || 'unknown'),
          reason: String(analysisSession.reason || 'unknown'),
        },
      };
      let result;
      try {
        result = await analyzeUserOpinions(userData, aiOptions);
      } catch (err) {
        const isGateUnavailable = /on-chain gate data unavailable/i.test(String(err?.message || ''));
        if (!isGateUnavailable) throw err;
        accountLog.warn('[UserPage] gate data unavailable for session, trying fallback', {
          failedSlug: analysisSession.slug,
          gateStatus: analysisSession.status,
        });
        const fallbackSession = await this.resolveAnalysisSessionContext([analysisSession.slug]);
        if (!fallbackSession?.sessionConfig) throw err;
        const fallbackOpts = {
          sessionSlug: String(fallbackSession.slug || ''),
          sessionConfig: fallbackSession.sessionConfig,
          sessionSelection: {
            gateStatus: String(fallbackSession.status || 'unknown'),
            reason: String(fallbackSession.reason || 'fallback-gate-unavailable'),
          },
        };
        result = await analyzeUserOpinions(userData, fallbackOpts);
      }
      if (!this._isMounted) return;

      // Update UI
      this.setState({
        aiAnalysis: result.summary || '',
        analysisDetails: result.details || '',
        analysisName: result.name || 'User Analysis',
        analysisHistoricalFigure: result?.historicalAlignment?.figure || '',
        analysisHistoricalReasoning: result?.historicalAlignment?.reasoning || '',
        analyzing: false
      });
      this.clearAnalysisTimer();
    } catch (e) {
      accountLog.error('[UserPage] analyzeUser failed:', e);
      if (!this._isMounted) return;
      this.setState({
        analyzing: false,
        analysisError: 'Unable to generate analysis right now. Please try again later.',
        showAnalysisModal: true
      });
      this.clearAnalysisTimer();
    }
  };


  getExplorerUrl = () => {
    const network = this.props.network;
    const address = String(this.props.viewAddress || '').trim();
    if (!address) return null;
    const chainIdForLink = Number(network?.chainId ?? network?.id ?? 0) || null;
    const explorerUrl = buildExplorerAddressUrl(chainIdForLink, address);
    if (!explorerUrl && chainIdForLink) {
      accountLog.warn(`UserPage: Unknown chain ID (${chainIdForLink}) for explorer link.`);
    }
    return explorerUrl;
  }

  toggleSurveyResponses = (surveyId) => {
    if (this._isMounted) {
        this.setState((prevState) => ({
        expandedSurveyResponses: {
            ...prevState.expandedSurveyResponses,
            [surveyId]: !prevState.expandedSurveyResponses[surveyId],
        },
        }));
    }
  };

  toggleSurveyCreated = (surveyId) => {
    this.setState((prevState) => ({
      expandedSurveysCreated: {
        ...prevState.expandedSurveysCreated,
        [surveyId]: !prevState.expandedSurveysCreated[surveyId],
      },
    }));
  };

  render() {
    const {
      surveyResponseInfo,
      surveyCreationInfo,
      questionCreationInfo,
      questionResponseInfo,
      userStats,
      copied,
      collapseOpen,
      username,
      usernameError,
      bookmarked,
      sbtList,
      loadingSBTs,
      loadingSurveys,
      loadingQuestions,
      showAnalysisModal,
      aiAnalysis,
      analysisDetails,
      analysisName,
      analysisError,
      analyzing,
      analysisElapsedMs,
      analysisHistoricalFigure,
      analysisHistoricalReasoning,
      showFullProfileModal,
      isSimulated,
      selectedTab,
      expandedSurveyResponses,
      expandedSurveysCreated,
      detailedSurveyResponses,
      detailedQuestionResponses,

      // NEW: section toggles
      showSectionSurveyResponsesOpen,
      showSectionSurveysCreatedOpen,
      showSectionQuestionResponsesOpen,
      showSectionQuestionsCreatedOpen,

      // NEW: Deep scan flag
      isDeepScanning,
    } = this.state;

    const { minimized, account, viewAddress: propViewAddress, provider, network, loginComplete } = this.props;

    // === Compute display label with nickname priority (scoped strictly to current viewAddress) ===
    const currentLower = String(propViewAddress || '').toLowerCase();
    let cachedNicknameForThis = '';
    try {
      const parsed = this.getBookmarksCache();
      const users = Array.isArray(parsed?.users) ? parsed.users : [];
      const obj = users.find(u =>
        u && typeof u === 'object' &&
        String(u.address || '').toLowerCase() === currentLower
      );
      if (obj && typeof obj.nickname === 'string' && obj.nickname.trim()) {
        cachedNicknameForThis = obj.nickname.trim();
      }
    } catch (e) { accountLog.warn('UserPage: fallback', e); }
    const pendingNick = (this.state.nicknameInput || '').trim();
    const stateViewLower = String(this.state.viewAddress || '').toLowerCase();
    const pendingForThis = (
      stateViewLower === currentLower &&
      (this.state.isEditingNickname || bookmarked)
    ) ? pendingNick : '';
    const nicknameToUse = cachedNicknameForThis || pendingForThis;

    const explorerUrl = this.getExplorerUrl();
    const profileUrl = propViewAddress ? `/u/${propViewAddress}` : '';
    const addressLabel = nicknameToUse
      ? nicknameToUse
      : (isSimulated && username)
        ? username
        : (username && !isSimulated)
          ? username
          : (propViewAddress ? proposalScripts.getShortenedAddress(propViewAddress, false) : '');
    const addressHref = minimized ? profileUrl : explorerUrl;
    const shouldLinkAddressLabel = !!addressHref;
    const addressDisplay = shouldLinkAddressLabel
      ? (
        <a
          href={addressHref}
          {...(!minimized ? {
            target: '_blank',
            rel: 'noopener noreferrer',
          } : {})}
          className={styles.addressLink}
        >
          {addressLabel}
        </a>
      )
      : addressLabel;

    // === Blockie seed & URL (deterministic across minimized/maximized) ===
    const blockieSeed =
      propViewAddress || (username ? username : 'contextengine-default-seed');
    const blockieUrl = generateBlockieDataUrl(blockieSeed, 8, 4);

    // --------- NEW: Readiness & spinner glue (defensive) ----------
    const isSBTReady       = !!this.props.isSBTCacheReady;
    const isSurveyReady    = !!this.props.isSurveyCacheReady;
    const isQuestionReady  = !!this.props.isQuestionCacheReady;
    const isResponsesReady = !!this.props.isResponsesCacheReady;

    // Gate Analyze/Compare until *all* user caches are ready (surveys incl. responses)
    const disabledByCache = !(isSBTReady && isSurveyReady && isQuestionReady && isResponsesReady);

    // --- Loading States Logic ---
    const surveyDeepScanLoadingActive = this.isDeepScanLoadingEnabledForSection('surveys') && isDeepScanning;
    const questionDeepScanLoadingActive = this.isDeepScanLoadingEnabledForSection('questions') && isDeepScanning;
    // 1. "Any" flags: Used for the Green Corner Spinner (shows if doing *anything*, initial or background)
    const isSbtLoadingAny = loadingSBTs || !isSBTReady || isDeepScanning;
    const isSurveyLoadingAny = loadingSurveys || !isSurveyReady || !isResponsesReady || surveyDeepScanLoadingActive;
    const isQuestionLoadingAny = loadingQuestions || !isQuestionReady || !isResponsesReady || questionDeepScanLoadingActive;

    // 2. "Empty" flags: Used to determine if we show the "No items" message.
    // NOTE: We suppress the large white body spinner in favor of the green corner spinner.
    const sbtSectionLoadingEmpty = isSbtLoadingAny && sbtList.length === 0;
    const surveyResponsesLoadingEmpty = isSurveyLoadingAny && surveyResponseInfo.length === 0;
    const surveysCreatedLoadingEmpty = (loadingSurveys || !isSurveyReady || surveyDeepScanLoadingActive) && surveyCreationInfo.length === 0;
    const questionResponsesLoadingEmpty = isQuestionLoadingAny && questionResponseInfo.length === 0;
    const questionsCreatedLoadingEmpty = (loadingQuestions || !isQuestionReady || questionDeepScanLoadingActive) && questionCreationInfo.length === 0;
    const questionResponsesEmptyText = this.state.hasUncertainUserData
      ? 'Question responses may be incomplete due scan/RPC issues. Try refresh.'
      : 'No question responses found.';
    const sbtEmptyText = this.state.hasUncertainSbtData
      ? `${t('sbt')} results may be incomplete due scan/RPC issues. Try refresh.`
      : `No ${t('sbtsLower')} found.`;

    // Old “tabs/breadcrumb” toggle is now in-section; keep reference but render nothing.
    const surveysQuestionsToggle = null;

    // Unique tooltip targets (wrapping spans) for disabled buttons.
    // Sanitize route-derived values to avoid invalid selector chars (e.g. "/")
    // in reactstrap tooltip `target` selectors.
    const rawAddrSeed = String(propViewAddress || 'addr');
    const sanitizedAddrSeed = rawAddrSeed.replace(/[^A-Za-z0-9_-]/g, '');
    const normalizedAddrSeed = sanitizedAddrSeed.toLowerCase();
    const addrFragment = (
      normalizedAddrSeed.startsWith('0x')
        ? normalizedAddrSeed.slice(2)
        : normalizedAddrSeed
    ).slice(0, 6) || 'addr';
    const analyzeBtnWrapId = `analyzeBtnWrap_${addrFragment}`;
    const compareBtnWrapId = `compareBtnWrap_${addrFragment}`;
    const deepScanTooltipLines = this.buildDeepScanProgressTooltip();
    const deepScanProgressRows = this.buildDeepScanProgressRows();
    const deepScanTooltipContent =
      isDeepScanning ||
      (Array.isArray(deepScanTooltipLines) && deepScanTooltipLines.length > 0) ||
      (Array.isArray(deepScanProgressRows) && deepScanProgressRows.length > 0)
        ? (deepScanTooltipLines || ['Deep scan in progress...'])
        : null;
    const deepScanTooltipText = Array.isArray(deepScanTooltipContent)
      ? deepScanTooltipContent
        .filter((line) => line && line.trim().length > 0)
        .join(' | ')
      : '';
    const deepScanTooltipTitle = deepScanTooltipText
      ? `Deep scan: ${deepScanTooltipText}`
      : '';
    const surveySpinnerId = `surveySpinner_${addrFragment}`;
    const surveysCreatedSpinnerId = `surveysCreatedSpinner_${addrFragment}`;
    const questionSpinnerId = `questionSpinner_${addrFragment}`;
    const questionsCreatedSpinnerId = `questionsCreatedSpinner_${addrFragment}`;
    const sbtSpinnerId = `sbtSpinner_${addrFragment}`;

    // --- NEW: pen/edit icon visibility rules ---
    const isOwner = account && propViewAddress && account.toLowerCase() === String(propViewAddress).toLowerCase();
    const notOwnPage = !isOwner;
    const hasNickForThis = Boolean(cachedNicknameForThis || pendingForThis);

    // Always show pen if it's not own page, so users can add a nickname even if none exists yet
    const showPen = !minimized && notOwnPage && !this.state.isEditingNickname;

    // Show username pen if owner, not minimized, and not currently editing
    const showUsernamePen = !minimized && isOwner && !this.state.isEditingUsername;

    return (
      <div className={`${styles.userPage} ${minimized ? styles.minimized : ''}`}>
        <div className={styles.header}>
          <div className={styles.addressAndActionsContainer}>
            <div className={styles.userInfo}>
              <div className={styles.avatarContainer}>
                {/* Use background-image on the existing avatar div to avoid structural changes */}
                <div
                  className={styles.avatar}
                  style={{
                    backgroundImage: `url(${blockieUrl})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center'
                  }}
                  aria-label="User avatar"
                  role="img"
                ></div>
              </div>
              <h1 id={styles.userPageAddress}>
                {addressDisplay}
                {/* Nickname Pen (for others) */}
                {showPen && (
                  <button
                    onClick={this.onPenClick}
                    className={styles.copyButton}
                    aria-label="Edit nickname"
                    title="Edit nickname"
                  >
                    <FontAwesomeIcon icon={faPen} />
                  </button>
                )}
                {/* Username Pen (for self) */}
                {showUsernamePen && (
                  <button
                    onClick={this.onUsernamePenClick}
                    className={styles.copyButton}
                    aria-label="Set username"
                    title="Set username"
                  >
                    <FontAwesomeIcon icon={faPen} />
                  </button>
                )}
                {isSimulated && (
                  <span className={styles.simulatedBadge} id="simulatedUserTooltip">
                    <FontAwesomeIcon icon={faExclamationTriangle} />
                  </span>
                )}
                {isSimulated && (
                  <CETooltip placement="right" target="simulatedUserTooltip">
                    This is a simulated user whose answers are generated based on documents.
                  </CETooltip>
                )}
                {!isSimulated && propViewAddress && (
                  <button onClick={this.copyToClipboard} className={styles.copyButton}>
                    <FontAwesomeIcon icon={faCheck} style={{ display: copied ? 'inline' : 'none' }} />
                    <FontAwesomeIcon icon={faCopy} style={{ display: copied ? 'none' : 'inline' }} />
                  </button>
                )}
                {minimized && explorerUrl && (
                  <a
                    href={explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.expandButton}
                    aria-label="View address on explorer"
                    title="View address on explorer"
                  >
                    <FontAwesomeIcon icon={faExternalLinkAlt} />
                  </a>
                )}

                {/* NEW: Bookmark Icon Logic */}
                {!isSimulated && propViewAddress && !isOwner && (
                  <button
                    onClick={this.toggleBookmark}
                    className={`${styles.bookmarkButton} ${styles.headerBookmark}`}
                    style={{ color: bookmarked ? 'yellow' : undefined }}
                    aria-label={bookmarked ? 'Remove bookmark' : 'Bookmark user'}
                    title={bookmarked ? 'Remove bookmark' : 'Bookmark user'}
                  >
                    <FontAwesomeIcon icon={faBookmark} />
                  </button>
                )}
              </h1>

              {/* My Bookmarks Link (Owner Only) - Moved here from headerActionsRight */}
              {isOwner && !minimized && (
                <a
                  href="/bookmarks"
                  className={`${styles.bookmarksLink} ${styles.bookmarksLinkInline}`}
                  style={{ marginLeft: '12px' }}
                >
                  My Bookmarks <FontAwesomeIcon icon={faExternalLinkAlt} />
                </a>
              )}

              {/* RELOCATED: Inline nickname field — shown only when editing */}
              {notOwnPage && this.state.isEditingNickname && (
                <div className={styles.usernameInline}>
                  <input
                    type="text"
                    value={this.state.nicknameInput || ''}
                    onChange={this.handleNicknameChange}
                    onBlur={this.saveNickname}
                    onKeyDown={this.handleNicknameKeyDown}
                    placeholder="set nickname"
                    aria-label="Set nickname"
                    // BUG FIX: Removed el.select() from render cycle.
                    // Focus/select is handled once in onPenClick.
                    ref={(el) => { if (el && this.state.isEditingNickname) { /* just render ref */ } }}
                    autoFocus
                  />
                  {(this.state.nicknameInput || '').length > 0 && (
                    <button
                      type="button"
                      className={styles.usernameCheck}
                      tabIndex={-1}
                      aria-hidden="true"
                      title="Nickname entered"
                      disabled
                    >
                      <FontAwesomeIcon icon={faCheck} />
                    </button>
                  )}
                </div>
              )}

              {/* NEW: Inline username field (for self) — mirroring nickname logic */}
              {isOwner && this.state.isEditingUsername && (
                <div className={styles.usernameInline}>
                  <input
                    type="text"
                    value={this.state.username}
                    onChange={this.handleUsernameChange}
                    onBlur={this.setUsername}
                    onKeyDown={this.handleUsernameKeyDown}
                    placeholder="set username"
                    aria-label="Set username"
                    autoFocus
                  />
                  {this.state.username && (
                    <button
                      type="button"
                      className={styles.usernameCheck}
                      tabIndex={-1}
                      aria-hidden="true"
                      title="Username entered"
                      disabled
                    >
                      <FontAwesomeIcon icon={faCheck} />
                    </button>
                  )}
                </div>
              )}
            </div>

            {!minimized && (
              <div className={styles.headerActionsRight}>
                {/* Nickname input moved to .userInfo above */}
                {/* Username input moved to .userInfo above */}
                {/* Bookmarks link moved to .userInfo above */}

                {this.state.usernameError && <span className={styles.error}>{this.state.usernameError}</span>}

                {/* Compare (gated until all caches are ready) */}
                <button
                  onClick={this.toggleCollapse}
                  className={styles.collapseButton}
                  disabled={
                    this.state.aiAvailable === false ||
                    !(!!this.props.isSBTCacheReady &&
                      !!this.props.isSurveyCacheReady &&
                      !!this.props.isQuestionCacheReady &&
                      !!this.props.isResponsesCacheReady)
                  }
                  title={
                    this.state.aiAvailable === false
                      ? `AI not available — connect a ${t('walletLower')} or use a session with sponsored AI`
                      : !(!!this.props.isSBTCacheReady &&
                          !!this.props.isSurveyCacheReady &&
                          !!this.props.isQuestionCacheReady &&
                          !!this.props.isResponsesCacheReady)
                        ? 'Available when the user page fully loads.'
                        : undefined
                  }
                >
                  Compare{' '}
                  {collapseOpen ? (
                    <FontAwesomeIcon icon={faChevronUp} />
                  ) : (
                    <FontAwesomeIcon icon={faChevronDown} />
                  )}
                </button>

                {/* Analyze (gated + shows spinner while running) */}
                <button
                  onClick={this.analyzeUser}
                  className={styles.analyzeButton}
                  disabled={
                    this.state.analyzing ||
                    this.state.aiAvailable === false ||
                    !(!!this.props.isSBTCacheReady &&
                      !!this.props.isSurveyCacheReady &&
                      !!this.props.isQuestionCacheReady &&
                      !!this.props.isResponsesCacheReady)
                  }
                  aria-busy={this.state.analyzing ? 'true' : 'false'}
                  title={
                    this.state.aiAvailable === false
                      ? `AI not available — connect a ${t('walletLower')} or use a session with sponsored AI`
                      : !(!!this.props.isSBTCacheReady &&
                          !!this.props.isSurveyCacheReady &&
                          !!this.props.isQuestionCacheReady &&
                          !!this.props.isResponsesCacheReady)
                        ? 'Available when the user page fully loads.'
                        : undefined
                  }
                >
                  {this.state.analyzing ? (
                    <>
                      <FontAwesomeIcon icon={faSpinner} spin />&nbsp;Analyzing
                    </>
                  ) : (
                    'Analyze'
                  )}
                </button>
              </div>
            )}

            {/* In minimized view, keep header actions WITHOUT nickname/username input */}
            {minimized && (
              <div className={styles.headerActionsRight}>
                 {/* Empty for now, but keeping container for layout stability if needed */}
                 {this.state.usernameError && <span className={styles.error}>{this.state.usernameError}</span>}
              </div>
            )}
          </div>

          {/* (Old) separate username bar removed; now integrated above */}

        </div>

        {/* Compare section collapses right under header */}
        {!minimized && (
          <Collapse isOpen={collapseOpen}>
            <CompareAddressSection
              firstAddress={propViewAddress}
              account={account}
              scanSpecificUserProfile={this.props.scanSpecificUserProfile}
            />
          </Collapse>
        )}

        {!minimized && (
          <div className={styles.content}>
            {selectedTab === 'surveys' && (
              <div className={styles.leftColumn}>
                {surveysQuestionsToggle}
                <div className={styles.surveySection}>
                  <h2
                    onClick={() => this.setState({ showSectionSurveyResponsesOpen: !this.state.showSectionSurveyResponsesOpen })}
                    className={styles.sectionHeader}
                  >
                    <FontAwesomeIcon icon={this.state.showSectionSurveyResponsesOpen ? faChevronUp : faChevronDown} className={styles.headerChevron} />{' '}
                    <span className={styles.sectionSwitcher}>
                      <button
                        type="button"
                        className={styles.switchWordInactive}
                        onClick={(e) => { e.stopPropagation(); if (this._isMounted) this.setState({ selectedTab: 'questions' }); }}
                        aria-label="Show Questions"
                      >
                        Questions
                      </button>
                      <span className={styles.switchDivider}>/</span>
                      <span className={styles.switchWordActive}>Survey Responses</span>
                    </span>
                    {/* Corner spinner (Green) for ANY loading activity */}
                    {isSurveyLoadingAny && (
                      this.renderDeepScanStatusIndicator(
                          surveySpinnerId,
                          deepScanTooltipContent,
                          deepScanProgressRows,
                          deepScanTooltipTitle
                        )
                    )}
                  </h2>
                  <Collapse isOpen={this.state.showSectionSurveyResponsesOpen}>
                    {surveyResponseInfo.length > 0 ? (
                      surveyResponseInfo.map((survey, index) => {
                        const isExpanded = expandedSurveyResponses[survey.id] || false;
                        const questionArray = detailedSurveyResponses[survey.id] || [];
                        const hasResponses = questionArray.length > 0;

                        return (
                          <div key={index} className={styles.surveyWrapper}>
                            <div
                              className={`${styles.surveyPreview} ${styles.surveyPreviewWithActions}`}
                              onClick={() => this.toggleSurveyResponses(survey.id)}
                              style={{ cursor: 'pointer' }}
                            >
                              <div className={styles.surveyTitle}>{survey.title}</div>
                              <div className={styles.surveyInfo}>
                                Questions: {survey.questionsCount}
                              </div>
                              {propViewAddress && (
                                <button
                                  type='button'
                                  className={styles.surveyExpandIcon}
                                  title='Open full survey page'
                                  aria-label='Open full survey page'
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const surveyUrlParams = new URLSearchParams();
                                    if (survey.slug) {
                                      surveyUrlParams.set('session', survey.slug);
                                    }
                                    surveyUrlParams.set('responder', String(propViewAddress));
                                    window.open(
                                      `/survey/${encodeURIComponent(String(survey.id))}${surveyUrlParams.toString() ? `?${surveyUrlParams.toString()}` : ''}`,
                                      '_blank',
                                      'noopener,noreferrer'
                                    );
                                  }}
                                >
                                  <FontAwesomeIcon icon={faExpand} />
                                </button>
                              )}
                              <div className={styles.chevronContainer}>
                                <FontAwesomeIcon
                                  icon={isExpanded ? faChevronUp : faChevronDown}
                                  className={styles.chevronIcon}
                                />
                              </div>
                            </div>

                            {isExpanded && hasResponses && (
                              <div className={styles.responsesContainer}>
                                {(Array.isArray(survey.tags) && survey.tags.length > 0) && (
                                  <div className={styles.surveyDetailRow}>
                                    <span className={styles.surveyDetailLabel}>Tags:</span>{' '}
                                    {survey.tags.map((tag, ti) => (
                                      <span key={ti} className={styles.surveyTag}>{tag}</span>
                                    ))}
                                  </div>
                                )}
                                {(Array.isArray(survey.documentURLs) && survey.documentURLs.length > 0) && (
                                  <div className={styles.surveyDetailRow}>
                                    <span className={styles.surveyDetailLabel}>Documents:</span>
                                    {survey.documentURLs.map((url, ui) => (
                                      <a key={ui} href={url} target='_blank' rel='noopener noreferrer' className={styles.surveyDocLink}>
                                        {url.length > 60 ? url.slice(0, 57) + '...' : url}
                                      </a>
                                    ))}
                                  </div>
                                )}
                                {questionArray.map((qObj, qIndex) => (
                                  <div key={qIndex} className={styles.responseItemWrapper}>
                                    <SingleQuestionResponse
                                      question={qObj.questionData}
                                      response={qObj.responseData}
                                      isOwnResponse={false}
                                      mode="mini"
                                      showImportance={true}
                                      compactEncryptedAnswerCta={true}
                                      stackCompactDecryptCta={true}
                                      onDecryptQuestion={this.handleDecryptQuestionAnswer}
                                      canDecryptOtherResponses={!!qObj?.canDecryptOtherResponses}
                                      responderAddress={propViewAddress}
                                      sessionSlug={survey.slug}
                                      questionResponsesNonce={this.props.questionResponsesNonce}
                                      sbtCacheRevision={this.props.sbtCacheRevision}
                                    />
                                  </div>
                                ))}
                              </div>
                            )}
                            {isExpanded && !hasResponses && (
                              <div className={styles.noResponsesMsg}>
                                No non-empty responses recorded for this survey.
                              </div>
                            )}
                          </div>
                        );
                      })
                    ) : (surveyResponsesLoadingEmpty) ? (
                      // Suppress white spinner; rely on green corner spinner
                      null
                    ) : (
                      <p>No survey responses found.</p>
                    )}
                  </Collapse>

                  <h2
                    onClick={() => this.setState({ showSectionSurveysCreatedOpen: !this.state.showSectionSurveysCreatedOpen })}
                    className={styles.sectionHeaderWithMargin}
                  >
                    <FontAwesomeIcon icon={this.state.showSectionSurveysCreatedOpen ? faChevronUp : faChevronDown} className={styles.headerChevron} />{' '}
                    <span className={styles.sectionSwitcher}>
                      <button
                        type="button"
                        className={styles.switchWordInactive}
                        onClick={(e) => { e.stopPropagation(); if (this._isMounted) this.setState({ selectedTab: 'questions' }); }}
                        aria-label="Show Questions"
                      >
                        Questions
                      </button>
                      <span className={styles.switchDivider}>/</span>
                      <span className={styles.switchWordActive}>Surveys Created</span>
                    </span>
                    {/* Corner spinner (Green) for ANY loading activity */}
                    {isSurveyLoadingAny && (
                      this.renderDeepScanStatusIndicator(
                          surveysCreatedSpinnerId,
                          deepScanTooltipContent,
                          deepScanProgressRows,
                          deepScanTooltipTitle
                        )
                    )}
                  </h2>
                  <Collapse isOpen={this.state.showSectionSurveysCreatedOpen}>
                    {surveyCreationInfo.length > 0 ? (
                      surveyCreationInfo.map((survey, index) => {
                        const isCreatedExpanded = expandedSurveysCreated[survey.id] || false;
                        const hasTags = Array.isArray(survey.tags) && survey.tags.length > 0;
                        const hasDocURLs = Array.isArray(survey.documentURLs) && survey.documentURLs.length > 0;
                        const hasQuestionIDs = Array.isArray(survey.questionIDs) && survey.questionIDs.length > 0;
                        const questionPreviewEntries = (
                          Array.isArray(survey.questionPreviews) && survey.questionPreviews.length > 0
                        )
                          ? survey.questionPreviews
                          : (survey.questionIDs || []).map((qid) => ({ id: String(qid || ''), text: '' }));
                        const hasExpandContent = hasTags || hasDocURLs || hasQuestionIDs;
                        const surveyLinkSlug = normalizeSessionSlug(survey.slug || '');

                        return (
                          <div key={index} className={styles.surveyWrapper}>
                            <div
                              className={`${styles.surveyPreview} ${styles.surveyPreviewWithActions}`}
                              onClick={() => hasExpandContent && this.toggleSurveyCreated(survey.id)}
                              style={{ cursor: hasExpandContent ? 'pointer' : 'default' }}
                            >
                              <a
                                href={`/survey/${encodeURIComponent(String(survey.id))}${surveyLinkSlug ? `?session=${encodeURIComponent(surveyLinkSlug)}` : ''}`}
                                target='_blank'
                                rel='noopener noreferrer'
                                className={styles.surveyTitleLink}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className={styles.surveyTitle}>{survey.title}</div>
                              </a>
                              <div
                                className={`${styles.surveyInfo} ${styles.surveyCountOnly}`}
                                aria-label={`${survey.questionsCount} questions`}
                                title={`${survey.questionsCount} questions`}
                              >
                                {survey.questionsCount}
                              </div>
                              {hasExpandContent && (
                                <div className={styles.chevronContainer}>
                                  <FontAwesomeIcon
                                    icon={isCreatedExpanded ? faChevronUp : faChevronDown}
                                    className={styles.chevronIcon}
                                  />
                                </div>
                              )}
                            </div>
                            {isCreatedExpanded && hasExpandContent && (
                              <div className={styles.responsesContainer}>
                                {hasTags && (
                                  <div className={styles.surveyDetailRow}>
                                    <span className={styles.surveyDetailLabel}>Tags:</span>{' '}
                                    {survey.tags.map((tag, ti) => (
                                      <span key={ti} className={styles.surveyTag}>{tag}</span>
                                    ))}
                                  </div>
                                )}
                                {hasDocURLs && (
                                  <div className={styles.surveyDetailRow}>
                                    <span className={styles.surveyDetailLabel}>Documents:</span>
                                    {survey.documentURLs.map((url, ui) => (
                                      <a key={ui} href={url} target='_blank' rel='noopener noreferrer' className={styles.surveyDocLink}>
                                        {url.length > 60 ? url.slice(0, 57) + '...' : url}
                                      </a>
                                    ))}
                                  </div>
                                )}
                                {hasQuestionIDs && (
                                  <div className={styles.surveyDetailRow}>
                                    <span className={styles.surveyDetailLabel}>Questions:</span>
                                    <ul className={styles.surveyQuestionList}>
                                      {questionPreviewEntries.map((entry, qi) => {
                                        const fullQuestionId = String(entry?.id || '');
                                        const resolvedText = String(entry?.text || '').trim();
                                        return (
                                          <li key={`${fullQuestionId}_${qi}`} className={styles.surveyQuestionItem}>
                                            {resolvedText ? resolvedText : (
                                              <span
                                                className={styles.surveyQuestionFallbackId}
                                                title={fullQuestionId}
                                              >
                                                {this._shortenQuestionId(fullQuestionId)}
                                              </span>
                                            )}
                                          </li>
                                        );
                                      })}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    ) : (surveysCreatedLoadingEmpty || (this.state.isDeepScanning && surveyCreationInfo.length === 0)) ? (
                      // Suppress white spinner; rely on green corner spinner
                      null
                    ) : (
                      <p>No surveys created.</p>
                    )}
                  </Collapse>
                </div>
              </div>
            )}

            {selectedTab === 'questions' && (
              <div className={styles.leftColumn}>
                {surveysQuestionsToggle}
                <div className={styles.questionSection}>
                  <h2
                    onClick={() => this.setState({ showSectionQuestionResponsesOpen: !this.state.showSectionQuestionResponsesOpen })}
                    className={styles.sectionHeader}
                  >
                    <FontAwesomeIcon icon={this.state.showSectionQuestionResponsesOpen ? faChevronUp : faChevronDown} className={styles.headerChevron} />{' '}
                    <span className={styles.sectionSwitcher}>
                      <button
                        type="button"
                        className={styles.switchWordInactive}
                        onClick={(e) => { e.stopPropagation(); if (this._isMounted) this.setState({ selectedTab: 'surveys' }); }}
                        aria-label="Show Surveys"
                      >
                        Survey
                      </button>
                      <span className={styles.switchDivider}>/</span>
                      <span className={styles.switchWordActive}>Question Responses</span>
                    </span>
                    {/* Corner spinner (Green) for ANY loading activity */}
                    {isQuestionLoadingAny && (
                      this.renderDeepScanStatusIndicator(
                          questionSpinnerId,
                          deepScanTooltipContent,
                          deepScanProgressRows,
                          deepScanTooltipTitle
                        )
                    )}
                  </h2>
                  <Collapse isOpen={this.state.showSectionQuestionResponsesOpen}>
                    {questionResponseInfo.length > 0 ? (
                      questionResponseInfo.map((question, index) => {
                        const userResp = detailedQuestionResponses[question.id];
                        if (!userResp) return null;
                        return (
                          <div key={index} className={styles.questionWrapper}>
                            <SingleQuestionResponse
                              question={question}
                              response={userResp}
                              isOwnResponse={false}
                              mode="mini"
                              showImportance={true}
                              compactEncryptedAnswerCta={true}
                              stackCompactDecryptCta={true}
                              onDecryptQuestion={this.handleDecryptQuestionAnswer}
                              canDecryptOtherResponses={!!question?.canDecryptOtherResponses}
                              responderAddress={propViewAddress}
                              network={network}
                              sessionSlug={this.props.activeSessionSlug}
                              questionResponsesNonce={this.props.questionResponsesNonce}
                              sbtCacheRevision={this.props.sbtCacheRevision}
                            />
                          </div>
                        );
                      })
                    ) : (questionResponsesLoadingEmpty) ? (
                      // Suppress white spinner; rely on green corner spinner
                      null
                    ) : (
                      <p>{questionResponsesEmptyText}</p>
                    )}
                  </Collapse>

                  <h2
                    onClick={() => this.setState({ showSectionQuestionsCreatedOpen: !this.state.showSectionQuestionsCreatedOpen })}
                    className={styles.sectionHeaderWithMargin}
                  >
                    <FontAwesomeIcon icon={this.state.showSectionQuestionsCreatedOpen ? faChevronUp : faChevronDown} className={styles.headerChevron} />{' '}
                    <span className={styles.sectionSwitcher}>
                      <button
                        type="button"
                        className={styles.switchWordInactive}
                        onClick={(e) => { e.stopPropagation(); if (this._isMounted) this.setState({ selectedTab: 'surveys' }); }}
                        aria-label="Show Surveys"
                      >
                        Surveys
                      </button>
                      <span className={styles.switchDivider}>/</span>
                      <span className={styles.switchWordActive}>Questions Created</span>
                    </span>
                    {/* Corner spinner (Green) for ANY loading activity */}
                    {isQuestionLoadingAny && (
                      this.renderDeepScanStatusIndicator(
                          questionsCreatedSpinnerId,
                          deepScanTooltipContent,
                          deepScanProgressRows,
                          deepScanTooltipTitle
                        )
                    )}
                  </h2>
                  <Collapse isOpen={this.state.showSectionQuestionsCreatedOpen}>
                    {questionCreationInfo.length > 0 ? (
                      questionCreationInfo.map((question, index) => (
                        <div key={index} className={`${styles.createdQuestionWrapper} ${styles.createdQuestionBolder}`}>
                          <SingleQuestionResponse
                            question={question}
                            response={null}
                            isOwnResponse={false}
                            mode="mini"
                            showImportance={false}
                            onDecryptQuestion={() => {}}
                            /* NEW: non-interactive render for created questions */
                            questionOnly={true}
                            network={network}
                            sessionSlug={this.props.activeSessionSlug}
                            questionResponsesNonce={this.props.questionResponsesNonce}
                            sbtCacheRevision={this.props.sbtCacheRevision}
                          />
                        </div>
                      ))
                    ) : (questionsCreatedLoadingEmpty) ? (
                      // Suppress white spinner; rely on green corner spinner
                      null
                    ) : (
                      <p>No questions created.</p>
                    )}
                  </Collapse>
                </div>
              </div>
            )}

            <div className={styles.rightColumn}>
              <div className={styles.sbtSection}>
                <h2>
                  {`${t('minted')} ${t('sbts')}:`}
                  {/* Corner spinner (Green) for ANY loading activity */}
                  {isSbtLoadingAny && (
                    this.renderDeepScanStatusIndicator(
                        sbtSpinnerId,
                        deepScanTooltipContent,
                        deepScanProgressRows,
                        deepScanTooltipTitle
                      )
                  )}
                </h2>
                {sbtList.length > 0 ? (
                  <div className={styles.sbtGrid}>
                    {sbtList.map((sbtItem, index) => (
                      <SBTPage
                        key={index}
                        SBTAddress={sbtItem.sbtInfo.sbtAddress}
                        account={account}
                        provider={provider}
                        network={network}
                        miniaturized={true}
                        loginComplete={loginComplete}
                        /* Use readiness passed from MainSite to control child spinners */
                        isSBTCacheReady={this.props.isSBTCacheReady}
                        /* NEW: mini cards are metadata-only, avoid any chain scans/persistence */
                        metadataOnly={true}
                        /* NEW: Pass the source slug to allow cross-group hydration */
                        sessionSlug={sbtItem.slug}
                        refreshSbtData={(addr) => this.props.refreshSbtData(addr, sbtItem.slug)}
                      />
                    ))}
                  </div>
                ) : (sbtSectionLoadingEmpty) ? (
                   // Suppress white spinner; rely on green corner spinner
                   null
                ) : (
                  <p>{sbtEmptyText}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {isSimulated && (
          <div className={styles.simulatedUserActions}>
            <button onClick={() => { if (this._isMounted) this.setState({ showFullProfileModal: true }); }}>
              View Simulated Responses
            </button>
          </div>
        )}

        <Modal
          isOpen={showAnalysisModal}
          toggle={() => { if (this._isMounted) { this.setState({ showAnalysisModal: false }); this.clearAnalysisTimer(); } }}
          className={styles.modalContent}
        >
          <ModalHeader
            toggle={() => { if (this._isMounted) { this.setState({ showAnalysisModal: false }); this.clearAnalysisTimer(); } }}
            className={styles.modalHeader}
          >
            {/* Close “X” is intentionally hidden via CSS; do not delete this feature. */}
            <div className={styles.modalTitleRow}>
              {analysisName || 'User Analysis'}
              {/* DO NOT DELETE THIS SECTION - button we will be used in the future
              <button
                type="button"
                className={styles.refreshIconButton}
                onClick={() => this.analyzeUser(true)}
                title="Refresh analysis"
                disabled={analyzing}
                aria-label="Refresh analysis"
              >
                <FontAwesomeIcon icon={faSync} spin={analyzing} id={styles.refreshAnalysisIcon} />
              </button> */}
            </div>
          </ModalHeader>
          <ModalBody className={styles.modalBody}>
            {analyzing && (
              <div className={styles.analyzingContainer}>
                <FontAwesomeIcon icon={faSpinner} spin />
                <span>
                  Generating insights… {(analysisElapsedMs / 1000).toFixed(1)}s
                </span>
              </div>
            )}
            {!analyzing && analysisError && (
              <p className={styles.placeholderNote}>{analysisError}</p>
            )}
            {!analyzing && !analysisError && (
              <>
                <p className={styles.placeholderNote}>{aiAnalysis}</p>
                {analysisDetails && <p className={styles.analysisDetails}>{analysisDetails}</p>}
                {(analysisHistoricalFigure || analysisHistoricalReasoning) && (
                  <div className={styles.historicalAlignment}>
                    <h4>Historical Alignment</h4>
                    {analysisHistoricalFigure && (
                      <p>{analysisHistoricalFigure}</p>
                    )}
                    {analysisHistoricalReasoning && (
                      <p className={styles.placeholderNote}>{analysisHistoricalReasoning}</p>
                    )}
                  </div>
                )}
              </>
            )}

          </ModalBody>
        </Modal>

        <Modal
          isOpen={showFullProfileModal}
          toggle={() => { if (this._isMounted) this.setState({ showFullProfileModal: false }); }}
          size="lg"
          className={styles.modalContent}
        >
          <ModalHeader
            toggle={() => { if (this._isMounted) this.setState({ showFullProfileModal: false }); }}
            className={styles.modalHeader}
          >
            Full User Profile
          </ModalHeader>
          <ModalBody className={styles.modalBody}>
            <div className={styles.modalSummary}>
              <h3>User Summary</h3>
              <p>{aiAnalysis || "Summary not available."}</p>
            </div>
            <StatsSection
              userStats={userStats}
              collapseOpen={collapseOpen}
              toggleCollapse={this.toggleCollapse}
            />
            <div className={styles.modalSurveys}>
              <h3>Survey Responses</h3>
              {surveyResponsesLoadingEmpty ? (
                // If loading empty, rely on spinner logic or show nothing
                <FontAwesomeIcon icon={faSpinner} spin id={styles.loadingIcon} />
              ) : surveyResponseInfo.length === 0 ? <p>No survey responses.</p> : (
                surveyResponseInfo.map((survey, index) => (
                  <div key={index} className={styles.surveyPreview}>
                    <div className={styles.surveyTitle}>{survey.title}</div>
                    <div className={styles.surveyInfo}>
                      Questions: {survey.questionsCount}
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className={styles.modalSBTs}>
              <h3>{`${t('minted')} ${t('sbts')}`}</h3>
              {/* In modal, we can keep the spinner since there's no header spinner here */}
              {(loadingSBTs || !this.props.isSBTCacheReady) ? (
                <FontAwesomeIcon icon={faSpinner} spin id={styles.loadingIcon} />
              ) : sbtList.length === 0 ? <p>{sbtEmptyText}</p> : (
                sbtList.map((sbtItem, index) => (
                  <SBTPage
                    key={index}
                    SBTAddress={sbtItem.sbtInfo.sbtAddress}
                    provider={provider}
                    network={network}
                    miniaturized={true}
                    loginComplete={loginComplete}
                    /* Use readiness passed from MainSite to control child spinners */
                    isSBTCacheReady={this.props.isSBTCacheReady}
                    /* NEW: mini cards are metadata-only, avoid any chain scans/persistence */
                    metadataOnly={true}
                    /* NEW: Pass source slug */
                    sessionSlug={sbtItem.slug}
                    refreshSbtData={(addr) => this.props.refreshSbtData(addr, sbtItem.slug)}
                  />
                ))
              )}
            </div>
            {!minimized && propViewAddress && explorerUrl && (
              <div className={styles.modalActions}>
                {account && propViewAddress && account.toLowerCase() === propViewAddress.toLowerCase() && (
                  <a href="/bookmarks" className={styles.bookmarksLink}>
                    My Bookmarks <FontAwesomeIcon icon={faExternalLinkAlt} />
                  </a>
                )}
                <a
                  href={explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.explorerLink}
                >
                  View on Explorer <FontAwesomeIcon icon={faExternalLinkAlt} />
                </a>
              </div>
            )}
          </ModalBody>
        </Modal>
      </div>
    );
  }
}

export default UserPage;
