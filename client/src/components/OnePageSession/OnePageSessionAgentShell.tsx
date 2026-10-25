import React, { Suspense } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSignOutAlt, faSyncAlt } from '@fortawesome/free-solid-svg-icons';
import { Alert } from 'reactstrap';
import type { AgentClientLoginEnvelope } from '../../utilities/session/agentClientLogin';
import type { AgentSessionMeta } from '../../utilities/session/sessionBackendKind';
import {
  envelopeAllowsSubmit,
  loadGroups as loadAgentGroups,
  type AgentAnswerInput,
  type AgentResultsDataset,
} from '../../utilities/session/agentSessionBackend';
import type { AgentQuestion } from '../../utilities/session/agentSessionData';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import LazyFallback from '../Shared/LazyFallback';
import WorkerGroupMembershipPanel from './WorkerGroupMembershipPanel';
import styles from './OnePageSession.module.scss';

const PolisReport = React.lazy(() => import('../PolisReport/PolisReport'));
const PolisReportCompat = PolisReport as React.ComponentType<Record<string, unknown>>;
const AgentQuestionPile = React.lazy(() => import('./agent/AgentQuestionPile'));
const AgentBucketCards = React.lazy(() => import('./agent/AgentBucketCards'));
const AgentDebateMapPanel = React.lazy(() => import('./agent/AgentDebateMapPanel'));

type AgentResultsMode = 'polis' | 'debateAtlas';

export type OnePageSessionAgentShellProps = {
  resultsSectionRef?: React.Ref<HTMLElement>;
  account: unknown;
  blockLimits: unknown;
  contracts: unknown;
  defaultTags: unknown;
  disclaimersActive: boolean;
  displaySessionSlug: string;
  filterState: unknown;
  loginComplete: boolean;
  network: unknown;
  networkChainId: unknown;
  provider: unknown;
  questionResponsesNonce: unknown;
  questionScanProgress: unknown;
  resultsViewMode: string;
  sessionHeader: unknown;
  sessionInfo: React.ReactNode;
  sessionName: unknown;
  agentQuestions: AgentQuestion[];
  agentQuestionsStatus: string;
  agentResults: AgentResultsDataset | null;
  agentResultsStatus: string;
  agentClientEnvelope: AgentClientLoginEnvelope | null;
  agentPolisDataset: AgentResultsDataset['polisDataset'] | null;
  agentQuestionPileIndex: number;
  agentQuestionSubmitError: string;
  agentSessionMeta: AgentSessionMeta | null;
  agentSubmittedQuestionIds: string[];
  agentSubmittingQuestionId: string;
  workerGroupSessionId: string;
  workerGroupWorkerUrl: string;
  titleText: string;
  onLogout: () => void;
  onOpenLoginModal: () => void;
  onQuestionPileIndexChange: (agentQuestionPileIndex: number) => void;
  onRefresh: () => void;
  onResultsModeChange: (mode: AgentResultsMode) => void;
  onSubmitAnswer: (question: AgentQuestion, answer: AgentAnswerInput) => void | Promise<void>;
};

const normalizeResultsMode = (resultsViewMode: string): AgentResultsMode =>
  resultsViewMode === 'debateAtlas' ? 'debateAtlas' : 'polis';

const OnePageSessionAgentShell = ({
  resultsSectionRef,
  account,
  blockLimits,
  contracts,
  defaultTags,
  disclaimersActive,
  displaySessionSlug,
  filterState,
  loginComplete,
  network,
  networkChainId,
  provider,
  questionResponsesNonce,
  questionScanProgress,
  resultsViewMode,
  sessionHeader,
  sessionInfo,
  sessionName,
  agentQuestions,
  agentQuestionsStatus,
  agentResults,
  agentResultsStatus,
  agentClientEnvelope,
  agentPolisDataset,
  agentQuestionPileIndex,
  agentQuestionSubmitError,
  agentSessionMeta,
  agentSubmittedQuestionIds,
  agentSubmittingQuestionId,
  workerGroupSessionId,
  workerGroupWorkerUrl,
  titleText,
  onLogout,
  onOpenLoginModal,
  onQuestionPileIndexChange,
  onRefresh,
  onResultsModeChange,
  onSubmitAnswer,
}: OnePageSessionAgentShellProps) => {
  if (!agentClientEnvelope) {
    return (
      <div className={styles.onePageDemoContainer}>
        <div className={styles.agentOnlyShell}>
          <div className={styles.agentHeaderText}>
            <h2 className={styles.agentHeaderTitle}>{titleText}</h2>
            {sessionInfo ? <p className={styles.agentHeaderSubtitle}>{sessionInfo}</p> : null}
          </div>
          <Alert
            color="info"
            className={styles.agentOnlyNotice}
            data-testid={E2E_TESTIDS.SESSION_AGENT_SIGN_IN_NOTICE}
            fade={false}
          >
            <strong>Agent-enabled session</strong>
            <span>
              Sign in with a Context Engine agent token to view questions, access groups, and participant-visible
              results in the web client.
            </span>
            <button
              type="button"
              className={styles.agentPrimaryButton}
              data-testid="ce-session-agent-login-open"
              onClick={onOpenLoginModal}
            >
              Log in with agent token
            </button>
          </Alert>
        </div>
      </div>
    );
  }

  const mode = normalizeResultsMode(resultsViewMode);

  return (
    <div className={styles.onePageDemoContainer}>
      <div className={styles.agentShell}>
        <header className={styles.agentHeader}>
          <div className={styles.agentHeaderText}>
            <h2 className={styles.agentHeaderTitle}>{titleText}</h2>
            {sessionInfo ? <p className={styles.agentHeaderSubtitle}>{sessionInfo}</p> : null}
          </div>
          <button
            type="button"
            className={styles.agentSecondaryButton}
            onClick={onRefresh}
            data-testid="ce-session-agent-refresh"
          >
            <FontAwesomeIcon icon={faSyncAlt} />
            <span>Refresh</span>
          </button>
        </header>
        <div className={styles.agentAuthBar}>
          <span className={styles.agentAuthIndicator}>Signed in with an agent credential</span>
          <button
            type="button"
            className={styles.agentLogoutButton}
            data-testid="ce-session-agent-logout"
            onClick={onLogout}
          >
            <FontAwesomeIcon icon={faSignOutAlt} />
            <span>Logout</span>
          </button>
        </div>
        <div className={styles.agentGrid}>
          <Suspense fallback={<LazyFallback label="Loading agent questions..." minHeight="20vh" />}>
            <AgentQuestionPile
              activeIndex={agentQuestionPileIndex}
              canSubmit={envelopeAllowsSubmit(agentClientEnvelope, agentSessionMeta)}
              disabledReason="Submitting from the client is not enabled for this deployment yet."
              questions={agentQuestions}
              status={agentQuestionsStatus}
              submittedQuestionIds={agentSubmittedQuestionIds}
              submittingQuestionId={agentSubmittingQuestionId}
              submitError={agentQuestionSubmitError}
              onActiveIndexChange={onQuestionPileIndexChange}
              onSubmitAnswer={onSubmitAnswer}
            />
          </Suspense>
          <Suspense fallback={<LazyFallback label="Loading agent groups..." minHeight="20vh" />}>
            <AgentBucketCards cards={loadAgentGroups(agentClientEnvelope)} onReconnect={onOpenLoginModal} />
          </Suspense>
          <WorkerGroupMembershipPanel
            envelope={agentClientEnvelope}
            sessionId={workerGroupSessionId}
            sessionSlug={displaySessionSlug}
            workerUrl={workerGroupWorkerUrl}
          />
          <section
            id="report"
            ref={resultsSectionRef}
            className={styles.agentListPanel}
            data-testid="ce-session-agent-results"
          >
            <div className={styles.agentListHeader}>
              <span>Results</span>
              <div className={styles.agentTabs}>
                <button
                  type="button"
                  className={`${styles.agentTabButton} ${mode === 'polis' ? styles.agentTabButtonActive : ''}`}
                  aria-pressed={mode === 'polis'}
                  onClick={() => onResultsModeChange('polis')}
                >
                  Report
                </button>
                <button
                  type="button"
                  className={`${styles.agentTabButton} ${mode === 'debateAtlas' ? styles.agentTabButtonActive : ''}`}
                  aria-pressed={mode === 'debateAtlas'}
                  onClick={() => onResultsModeChange('debateAtlas')}
                >
                  Debate Map
                </button>
              </div>
            </div>
            <div className={styles.agentListEmpty} data-testid="ce-session-agent-generated-results-unsupported">
              AI-generated Circles, Breakdown, and Risk Matrix views are not available in the agent web shell yet. Use a
              standard session page with admin Worker access to generate those private drafts.
            </div>
            {agentResultsStatus === 'loading' ? <div className={styles.agentListEmpty}>Loading results...</div> : null}
            {mode === 'polis' && agentPolisDataset ? (
              <>
                {agentPolisDataset.synthesized ? (
                  <p className={styles.agentReportApprox} data-testid="ce-session-agent-report-approx">
                    Approximate report: raw participant vectors are not available yet, so this view synthesizes a
                    deterministic aggregate dataset.
                  </p>
                ) : null}
                <Suspense fallback={<LazyFallback label="Loading Polis report..." minHeight="20vh" />}>
                  <PolisReportCompat
                    onePageDemo={true}
                    miniMode={true}
                    account={account}
                    provider={provider}
                    network={network}
                    loginComplete={loginComplete}
                    questionResponses={agentPolisDataset.aggregator}
                    disclaimersActive={disclaimersActive}
                    filterState={filterState}
                    sessionName={sessionName}
                    sessionHeader={sessionHeader}
                    sessionInfo={sessionInfo}
                    defaultTags={defaultTags}
                    isQuestionCacheReady={true}
                    isResponsesCacheReady={true}
                    questionScanProgress={questionScanProgress}
                    questionResponsesNonce={questionResponsesNonce}
                    sessionSlug={displaySessionSlug}
                    demoDataFirstLoad={false}
                    contracts={contracts}
                    blockLimits={blockLimits}
                    networkChainId={networkChainId}
                  />
                </Suspense>
              </>
            ) : null}
            {mode === 'polis' && !agentPolisDataset && agentResultsStatus !== 'loading' ? (
              <div className={styles.agentListEmpty}>No participant-visible results are available yet.</div>
            ) : null}
            {mode === 'debateAtlas' ? (
              <Suspense fallback={<LazyFallback label="Loading debate map prompt..." minHeight="20vh" />}>
                <AgentDebateMapPanel questions={agentQuestions} results={agentResults} />
              </Suspense>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
};

export default OnePageSessionAgentShell;
