import React from 'react';
import { Button, FormGroup, Input, Label } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCaretDown, faCaretUp, faQuestionCircle } from '@fortawesome/free-solid-svg-icons';
import AudioInput from '../Shared/AudioInput/AudioInput';
import CETooltip from '../Shared/CETooltip';
import { normalizeSlug } from './adminPageHelpers';
import type { AdminTestResults } from './adminPageTestResultHelpers';
import { renderAdminTestResult } from './adminPageTestResultHelpers';
import styles from './AdminPage.module.scss';

type AdminTestInputChangeEvent = React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>;
type AdminTestChipResult = AdminTestResults[keyof AdminTestResults];
type AdminTestSessionConfig = Record<string, unknown> | null | undefined;

type AdminTestChipProps = {
  label: string;
  result: AdminTestChipResult;
  title?: string;
  testId?: string;
  clickable?: boolean;
  disabled?: boolean;
  busy?: boolean;
  id?: string;
  onRun?: () => void;
};

type AdminPageTestsPanelProps = {
  testsOpen: boolean;
  onCollapse: () => void;
  litTestValue: string;
  setLitTestValue: (value: string) => void;
  litTestBusy: boolean;
  litTestEnvelope: string;
  litTestStatus: string;
  litTestDecrypted: string;
  runLitEncryptTest: () => void;
  runLitDecryptTest: () => void;
  canRunTests: boolean;
  canRunHealthTest: boolean;
  defaultGateIsEmpty: boolean;
  walletReady: boolean;
  account?: string;
  testBusy: boolean;
  testResults: AdminTestResults;
  testStatus: string;
  runWorkerHealthTest: () => void;
  runWorkerAiTest: () => void;
  runWorkerArweaveTest: () => void;
  runWorkerFaucetTest: () => void;
  transcribeText: string;
  handleTranscribeTestTextChange: (value: string) => void;
  selectedSlug: string;
  testSessionConfig: AdminTestSessionConfig;
  testContext: unknown;
  baseWorkerUrl: string;
  deniedBusy: boolean;
  deniedStatus: string;
  deniedResults: AdminTestResults;
  runDeniedAccessTest: (kind: keyof AdminTestResults) => void;
};

const renderInfoTooltip = (id: string, content: React.ReactNode, placement: 'right' | 'top' = 'right') => {
  if (!content) return null;
  return (
    <>
      <FontAwesomeIcon icon={faQuestionCircle} className={styles.tooltip} id={id} />
      <CETooltip placement={placement} trigger="hover focus click" target={id} className={styles.tooltipBubble}>
        {content}
      </CETooltip>
    </>
  );
};

const AdminTestChip = ({
  label,
  result,
  title,
  testId,
  clickable = false,
  disabled = false,
  busy = false,
  id,
  onRun,
}: AdminTestChipProps) => {
  const canRun = clickable && !disabled && typeof onRun === 'function';
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' && canRun) onRun();
  };
  return (
    <div
      className={`${styles.statusItem} ${clickable ? styles.statusItemClickable : ''}`}
      onClick={() => {
        if (canRun) onRun();
      }}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : -1}
      onKeyDown={handleKeyDown}
      title={title}
      id={id}
      data-testid={testId}
    >
      <span>{label}</span>
      <span>{busy ? 'Testing\u2026' : renderAdminTestResult(result)}</span>
    </div>
  );
};

const AdminPageTestsPanel = ({
  testsOpen,
  onCollapse,
  litTestValue,
  setLitTestValue,
  litTestBusy,
  litTestEnvelope,
  litTestStatus,
  litTestDecrypted,
  runLitEncryptTest,
  runLitDecryptTest,
  canRunTests,
  canRunHealthTest,
  defaultGateIsEmpty,
  walletReady,
  account,
  testBusy,
  testResults,
  testStatus,
  runWorkerHealthTest,
  runWorkerAiTest,
  runWorkerArweaveTest,
  runWorkerFaucetTest,
  transcribeText,
  handleTranscribeTestTextChange,
  selectedSlug,
  testSessionConfig,
  testContext,
  baseWorkerUrl,
  deniedBusy,
  deniedStatus,
  deniedResults,
  runDeniedAccessTest,
}: AdminPageTestsPanelProps) => (
  <section className={`${styles.panel} ${styles.testsPanel}`}>
    <div className={styles.panelHeader}>
      <div className={styles.panelTitleGroup}>
        <div className={styles.panelTitleRow}>
          <div className={styles.panelTitle}>Tests</div>
          {renderInfoTooltip(
            'admin-tests-tip',
            <div className={styles.tooltipTextStack}>
              <div>Run quick checks against the selected worker and the session&apos;s gate rules.</div>
              <div>
                Run these as a user who holds the sponsored SBT. Tests use the configured worker URL and auth flow.
              </div>
            </div>,
          )}
        </div>
      </div>
      <Button
        size="sm"
        color="secondary"
        outline
        className={styles.collapseToggle}
        onClick={onCollapse}
        aria-label="Toggle Tests section"
      >
        <FontAwesomeIcon icon={testsOpen ? faCaretUp : faCaretDown} />
      </Button>
    </div>
    {testsOpen && (
      <>
        <div className={styles.panelTitleRow}>
          <div className={styles.panelSubtitle}>Lit quick test (no worker)</div>
          {renderInfoTooltip(
            'admin-lit-test-tip',
            'Uses the selected session’s default gate + Lit hooks. Does not call the worker.',
          )}
        </div>
        <FormGroup>
          <Label>Lit test value</Label>
          <Input
            type="textarea"
            rows="2"
            value={litTestValue}
            onChange={(event: AdminTestInputChangeEvent) => setLitTestValue(event.target.value)}
            placeholder="Type a short test string"
          />
        </FormGroup>
        <div className={`${styles.formRow} ${styles.litActionRow}`}>
          <Button
            color="primary"
            outline
            className={styles.actionButton}
            onClick={runLitEncryptTest}
            disabled={litTestBusy}
          >
            Encrypt
          </Button>
          <Button
            color="primary"
            outline
            className={styles.actionButton}
            onClick={runLitDecryptTest}
            disabled={litTestBusy || !litTestEnvelope}
          >
            Decrypt
          </Button>
        </div>
        {litTestStatus && <div className={styles.statusNote}>{litTestStatus}</div>}
        {litTestEnvelope && (
          <div className={styles.resultBox}>
            <div>Envelope</div>
            <pre>{litTestEnvelope}</pre>
          </div>
        )}
        {litTestDecrypted && <div className={styles.statusNote}>Decrypted: {litTestDecrypted}</div>}
        <div className={styles.inlineRow}>
          <Label>
            Transcription test (AudioInput)
            {!canRunTests &&
              renderInfoTooltip(
                'admin-transcription-tip',
                'Connect a wallet and set a worker URL to test transcription.',
              )}
          </Label>
          {canRunTests ? (
            <AudioInput
              placeholder="Record a short clip to test /transcribe…"
              updateFunction={handleTranscribeTestTextChange}
              toggleEncryption={() => {}}
              value={transcribeText}
              encrypted={false}
              hideEncryption
              disableEncryption
              enableAiRewrite={false}
              sessionSlug={normalizeSlug(selectedSlug)}
              sessionConfig={testSessionConfig}
              context={testContext}
              workerUrl={baseWorkerUrl}
            />
          ) : null}
        </div>
        {testStatus && <div className={styles.statusNote}>{testStatus}</div>}
        <div className={styles.grid}>
          <AdminTestChip
            label="Health"
            result={testResults.health}
            clickable={canRunHealthTest}
            disabled={testBusy || !canRunHealthTest}
            busy={testBusy}
            onRun={runWorkerHealthTest}
            title={
              !baseWorkerUrl
                ? 'Set a worker URL to test /health'
                : !defaultGateIsEmpty && !walletReady
                  ? 'Connect a wallet to run the gated access test.'
                  : 'Click to test /health'
            }
            id={!defaultGateIsEmpty && !walletReady ? 'admin-health-test-chip' : undefined}
          />
          {!defaultGateIsEmpty && !walletReady && (
            <CETooltip
              placement="top"
              trigger="hover focus click"
              target="admin-health-test-chip"
              className={styles.tooltipBubble}
            >
              Connect a wallet to run the gated access test.
            </CETooltip>
          )}
          <AdminTestChip
            label="AI"
            result={testResults.ai}
            clickable={!!account}
            disabled={testBusy || !account}
            busy={testBusy}
            onRun={runWorkerAiTest}
            title="Click to test AI"
          />
          <AdminTestChip
            label="Arweave"
            result={testResults.arweave}
            clickable={!!account}
            disabled={testBusy || !account}
            busy={testBusy}
            onRun={runWorkerArweaveTest}
            title="Click to test Arweave upload"
          />
          <AdminTestChip
            label="Faucet"
            result={testResults.faucet}
            clickable={!!account}
            disabled={testBusy || !account}
            busy={testBusy}
            onRun={runWorkerFaucetTest}
            title="Click to test faucet (0.0000001)"
          />
          <AdminTestChip label="Transcribe" result={testResults.transcribe} />
        </div>
        <div className={styles.panelTitleRow} style={{ marginTop: 16 }}>
          <div className={styles.panelTitle}>Negative tests (denied access)</div>
          {renderInfoTooltip(
            'admin-negative-tests-tip',
            'Connect a wallet that does NOT hold the sponsored SBT. Each test expects a 403 during login.',
          )}
        </div>
        {deniedStatus && <div className={styles.statusNote}>{deniedStatus}</div>}
        <div className={styles.grid}>
          <AdminTestChip
            label="Login"
            result={deniedResults.login}
            clickable={!deniedBusy}
            disabled={deniedBusy}
            onRun={() => runDeniedAccessTest('login')}
            title="Click to test login denied"
            testId="ce-admin-denied-chip-login"
          />
          <AdminTestChip
            label="AI"
            result={deniedResults.ai}
            clickable={!deniedBusy}
            disabled={deniedBusy}
            onRun={() => runDeniedAccessTest('ai')}
            title="Click to test AI denied"
            testId="ce-admin-denied-chip-ai"
          />
          <AdminTestChip
            label="Arweave"
            result={deniedResults.arweave}
            clickable={!deniedBusy}
            disabled={deniedBusy}
            onRun={() => runDeniedAccessTest('arweave')}
            title="Click to test Arweave denied"
            testId="ce-admin-denied-chip-arweave"
          />
          <AdminTestChip
            label="Transcribe"
            result={deniedResults.transcribe}
            clickable={!deniedBusy}
            disabled={deniedBusy}
            onRun={() => runDeniedAccessTest('transcribe')}
            title="Click to test transcription denied"
            testId="ce-admin-denied-chip-transcribe"
          />
          <AdminTestChip
            label="Faucet"
            result={deniedResults.faucet}
            clickable={!deniedBusy}
            disabled={deniedBusy}
            onRun={() => runDeniedAccessTest('faucet')}
            title="Click to test faucet denied"
            testId="ce-admin-denied-chip-faucet"
          />
        </div>
      </>
    )}
  </section>
);

export default AdminPageTestsPanel;
