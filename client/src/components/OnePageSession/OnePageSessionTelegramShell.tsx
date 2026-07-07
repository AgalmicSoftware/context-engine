import React, { Suspense } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSignOutAlt, faSyncAlt } from '@fortawesome/free-solid-svg-icons';
import { Alert } from 'reactstrap';
import type { AgentClientLoginEnvelope } from '../../utilities/session/agentClientLogin';
import type { TelegramSessionMeta } from '../../utilities/session/sessionBackendKind';
import {
  envelopeAllowsSubmit,
  loadGroups as loadTelegramGroups,
  type TelegramAnswerInput,
  type TelegramResultsDataset,
} from '../../utilities/session/telegramSessionBackend';
import type { TelegramAgentQuestion } from '../../utilities/session/telegramAgentData';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import LazyFallback from '../Shared/LazyFallback';
import WorkerGroupMembershipPanel from './WorkerGroupMembershipPanel';
import styles from './OnePageSession.module.scss';

const PolisReport = React.lazy(() => import('../PolisReport/PolisReport'));
const PolisReportCompat = PolisReport as React.ComponentType<Record<string, unknown>>;
const TelegramQuestionPile = React.lazy(() => import('./telegram/TelegramQuestionPile'));
const TelegramBucketCards = React.lazy(() => import('./telegram/TelegramBucketCards'));
const TelegramDebateMapPanel = React.lazy(() => import('./telegram/TelegramDebateMapPanel'));

type TelegramResultsMode = 'polis' | 'debateAtlas';

export type OnePageSessionTelegramShellProps = {
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
  telegramAgentQuestions: TelegramAgentQuestion[];
  telegramAgentQuestionsStatus: string;
  telegramAgentResults: TelegramResultsDataset | null;
  telegramAgentResultsStatus: string;
  telegramClientEnvelope: AgentClientLoginEnvelope | null;
  telegramPolisDataset: TelegramResultsDataset['polisDataset'] | null;
  telegramQuestionPileIndex: number;
  telegramQuestionSubmitError: string;
  telegramSessionMeta: TelegramSessionMeta | null;
  telegramSubmittedQuestionIds: string[];
  telegramSubmittingQuestionId: string;
  workerGroupSessionId: string;
  workerGroupWorkerUrl: string;
  titleText: string;
  onLogout: () => void;
  onOpenLoginModal: () => void;
  onQuestionPileIndexChange: (telegramQuestionPileIndex: number) => void;
  onRefresh: () => void;
  onResultsModeChange: (mode: TelegramResultsMode) => void;
  onSubmitAnswer: (question: TelegramAgentQuestion, answer: TelegramAnswerInput) => void | Promise<void>;
};

const normalizeResultsMode = (resultsViewMode: string): TelegramResultsMode =>
  resultsViewMode === 'debateAtlas' ? 'debateAtlas' : 'polis';

const OnePageSessionTelegramShell = ({
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
  telegramAgentQuestions,
  telegramAgentQuestionsStatus,
  telegramAgentResults,
  telegramAgentResultsStatus,
  telegramClientEnvelope,
  telegramPolisDataset,
  telegramQuestionPileIndex,
  telegramQuestionSubmitError,
  telegramSessionMeta,
  telegramSubmittedQuestionIds,
  telegramSubmittingQuestionId,
  workerGroupSessionId,
  workerGroupWorkerUrl,
  titleText,
  onLogout,
  onOpenLoginModal,
  onQuestionPileIndexChange,
  onRefresh,
  onResultsModeChange,
  onSubmitAnswer,
}: OnePageSessionTelegramShellProps) => {
  if (!telegramClientEnvelope) {
    return (
      <div className={styles.onePageDemoContainer}>
        <div className={styles.telegramOnlyShell}>
          <div className={styles.telegramHeaderText}>
            <h2 className={styles.telegramHeaderTitle}>{titleText}</h2>
            {sessionInfo ? <p className={styles.telegramHeaderSubtitle}>{sessionInfo}</p> : null}
          </div>
          <Alert
            color="info"
            className={styles.telegramOnlyNotice}
            data-testid={E2E_TESTIDS.SESSION_TELEGRAM_ONLY_NOTICE}
            fade={false}
          >
            <strong>Agent-enabled session</strong>
            <span>
              Sign in with a Context Engine agent token to view questions, groups, and participant-visible results in
              the web client.
            </span>
            <button
              type="button"
              className={styles.telegramPrimaryButton}
              data-testid="ce-session-telegram-login-open"
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
      <div className={styles.telegramShell}>
        <header className={styles.telegramHeader}>
          <div className={styles.telegramHeaderText}>
            <h2 className={styles.telegramHeaderTitle}>{titleText}</h2>
            {sessionInfo ? <p className={styles.telegramHeaderSubtitle}>{sessionInfo}</p> : null}
          </div>
          <button
            type="button"
            className={styles.telegramSecondaryButton}
            onClick={onRefresh}
            data-testid="ce-session-telegram-refresh"
          >
            <FontAwesomeIcon icon={faSyncAlt} />
            <span>Refresh</span>
          </button>
        </header>
        <div className={styles.telegramAuthBar}>
          <span className={styles.telegramAuthIndicator}>Signed in with an agent credential</span>
          <button
            type="button"
            className={styles.telegramLogoutButton}
            data-testid="ce-session-telegram-logout"
            onClick={onLogout}
          >
            <FontAwesomeIcon icon={faSignOutAlt} />
            <span>Logout</span>
          </button>
        </div>
        <div className={styles.telegramGrid}>
          <Suspense fallback={<LazyFallback label="Loading Telegram questions..." minHeight="20vh" />}>
            <TelegramQuestionPile
              activeIndex={telegramQuestionPileIndex}
              canSubmit={envelopeAllowsSubmit(telegramClientEnvelope, telegramSessionMeta)}
              disabledReason="Submitting from the client is not enabled for this deployment yet."
              questions={telegramAgentQuestions}
              status={telegramAgentQuestionsStatus}
              submittedQuestionIds={telegramSubmittedQuestionIds}
              submittingQuestionId={telegramSubmittingQuestionId}
              submitError={telegramQuestionSubmitError}
              onActiveIndexChange={onQuestionPileIndexChange}
              onSubmitAnswer={onSubmitAnswer}
            />
          </Suspense>
          <Suspense fallback={<LazyFallback label="Loading Telegram groups..." minHeight="20vh" />}>
            <TelegramBucketCards cards={loadTelegramGroups(telegramClientEnvelope)} onReconnect={onOpenLoginModal} />
          </Suspense>
          <WorkerGroupMembershipPanel
            envelope={telegramClientEnvelope}
            sessionId={workerGroupSessionId}
            sessionSlug={displaySessionSlug}
            workerUrl={workerGroupWorkerUrl}
          />
          <section className={styles.telegramListPanel} data-testid="ce-session-telegram-results">
            <div className={styles.telegramListHeader}>
              <span>Results</span>
              <div className={styles.telegramTabs}>
                <button
                  type="button"
                  className={`${styles.telegramTabButton} ${mode === 'polis' ? styles.telegramTabButtonActive : ''}`}
                  aria-pressed={mode === 'polis'}
                  onClick={() => onResultsModeChange('polis')}
                >
                  Report
                </button>
                <button
                  type="button"
                  className={`${styles.telegramTabButton} ${mode === 'debateAtlas' ? styles.telegramTabButtonActive : ''}`}
                  aria-pressed={mode === 'debateAtlas'}
                  onClick={() => onResultsModeChange('debateAtlas')}
                >
                  Debate Map
                </button>
              </div>
            </div>
            {telegramAgentResultsStatus === 'loading' ? (
              <div className={styles.telegramListEmpty}>Loading results...</div>
            ) : null}
            {mode === 'polis' && telegramPolisDataset ? (
              <>
                {telegramPolisDataset.synthesized ? (
                  <p className={styles.telegramReportApprox} data-testid="ce-session-telegram-report-approx">
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
                    questionResponses={telegramPolisDataset.aggregator}
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
            {mode === 'polis' && !telegramPolisDataset && telegramAgentResultsStatus !== 'loading' ? (
              <div className={styles.telegramListEmpty}>No participant-visible results are available yet.</div>
            ) : null}
            {mode === 'debateAtlas' ? (
              <Suspense fallback={<LazyFallback label="Loading debate map prompt..." minHeight="20vh" />}>
                <TelegramDebateMapPanel questions={telegramAgentQuestions} results={telegramAgentResults} />
              </Suspense>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
};

export default OnePageSessionTelegramShell;
