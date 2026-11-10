import type React from 'react';
import { Input, Label, UncontrolledTooltip } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { INTERVIEW_PROMPT_VERSION, type InterviewPrefillPacket } from './sessionInterview';
import { describeInterviewPlatform } from './sessionInterviewModalState';
import styles from './SessionInterviewResearchConsent.module.scss';

const RESEARCH_DOC_URL =
  'https://github.com/AgalmicSoftware/context-engine/blob/main/docs/session-interview-research.md';

type Props = {
  packet: InterviewPrefillPacket;
  showProvenance?: boolean;
  revisionCount?: number;
  includeProvenance: boolean;
  includeComparison: boolean;
  provenanceMixed?: boolean;
  comparisonMixed?: boolean;
  preserveSavedProvenance?: boolean;
  onProvenanceChange: (included: boolean) => void;
  onComparisonChange: (included: boolean) => void;
  coverageDetails: string[];
  selectedCount: number;
  unselectedCount: number;
  disabled: boolean;
  // The session's interviewMode.researchDetail: what a shared comparison keeps.
  researchDetail?: 'minimal' | 'full';
  // Further sharing choices, such as the responder name, listed with these.
  children?: React.ReactNode;
};

export default function SessionInterviewResearchConsent({
  packet,
  showProvenance = true,
  revisionCount = 0,
  includeProvenance,
  includeComparison,
  provenanceMixed = false,
  comparisonMixed = false,
  preserveSavedProvenance = false,
  onProvenanceChange,
  onComparisonChange,
  coverageDetails,
  selectedCount,
  unselectedCount,
  disabled,
  researchDetail = 'minimal',
  children,
}: Props) {
  const minimal = researchDetail === 'minimal';
  const model = packet.source.modelId || 'Unknown model';
  const platform = describeInterviewPlatform(packet.source.platform);
  return (
    <>
      <div className={styles.optionGroup}>
        {showProvenance && (
          <Label check className={styles.provenanceOption}>
            <Input
              type="checkbox"
              checked={provenanceMixed ? false : includeProvenance}
              aria-checked={provenanceMixed ? 'mixed' : includeProvenance}
              innerRef={(element: HTMLInputElement | null) => {
                if (element) element.indeterminate = provenanceMixed;
              }}
              disabled={disabled}
              onChange={(event) => onProvenanceChange(event.target.checked)}
            />{' '}
            <span>Include platform/model provenance{provenanceMixed ? ' (mixed saved choices)' : ''}</span>
          </Label>
        )}
        <div className={styles.researchConsent}>
          <Label check className={styles.provenanceOption}>
            <Input
              type="checkbox"
              checked={comparisonMixed ? false : includeComparison}
              aria-checked={comparisonMixed ? 'mixed' : includeComparison}
              innerRef={(element: HTMLInputElement | null) => {
                if (element) element.indeterminate = comparisonMixed;
              }}
              disabled={disabled}
              onChange={(event) => onComparisonChange(event.target.checked)}
              data-testid={E2E_TESTIDS.SESSION_INTERVIEW_INCLUDE_PREDICTION_COMPARISON}
            />{' '}
            <span>Share AI draft changes for research{comparisonMixed ? ' (mixed saved choices)' : ''}</span>
          </Label>
          <button
            type="button"
            id="ce-interview-research-help"
            className={styles.researchHelp}
            data-ce-control-appearance="frameless"
            aria-label="About research metadata"
            aria-describedby="ce-interview-research-description"
          >
            <FontAwesomeIcon icon={faQuestionCircle} />
          </button>
        </div>
        {children}
      </div>
      <span id="ce-interview-research-description" className={styles.srOnly}>
        {minimal
          ? 'Includes the AI’s predicted answers, ratings and confidence, its revision history, and which fields you changed. It excludes the AI’s notes and drafted text, drafts you did not select, encrypted answers, full interview transcripts, and imported conversation history. Edits are not treated as agreement.'
          : 'Includes original predictions, AI revisions from continued interviews, reviewed final values, changed fields, and drafts you did not select. Unselected drafts are recorded as research metadata, not submitted answers. Edits are not treated as agreement. Encrypted answer and comment text, full interview transcripts, and imported conversation history are excluded.'}
      </span>
      <UncontrolledTooltip target="ce-interview-research-help" placement="top" trigger="hover focus" autohide={false}>
        {minimal
          ? 'Records the AI’s predicted answers and confidence and which ones you changed, not its notes or drafted text.'
          : 'Records draft provenance, revisions, selected status, and changed fields. It excludes encrypted answer text, transcripts, and imported conversation history.'}{' '}
        <a href={RESEARCH_DOC_URL} target="_blank" rel="noreferrer">
          How research data is handled
        </a>
      </UncontrolledTooltip>
      {/* An unticked box already says what is left out; with nothing shared there is nothing to describe. */}
      {preserveSavedProvenance || (showProvenance && includeProvenance) || includeComparison ? (
        <details
          className={styles.metadata}
          aria-label={showProvenance ? 'AI prefill metadata' : 'AI research metadata'}
        >
          <summary>AI prefill metadata</summary>
          <div className={styles.metadataBody}>
            {preserveSavedProvenance ? (
              <p>
                Saved consent choices are retained. Selected AI drafts use this interview’s source metadata when
                provenance is included.
              </p>
            ) : null}
            {showProvenance && includeProvenance ? (
              <dl>
                <dt>Platform</dt>
                <dd>{platform}</dd>
                <dt>Model</dt>
                <dd>{model}</dd>
                <dt>Verification</dt>
                <dd>Self-reported</dd>
                <dt>Prompt version</dt>
                <dd>{packet.promptVersion || INTERVIEW_PROMPT_VERSION}</dd>
                <dt>Question set</dt>
                <dd>{packet.questionSetHash || 'Not provided'}</dd>
                {packet.source.researchCoverage ? (
                  <>
                    <dt>Research coverage</dt>
                    <dd>
                      {coverageDetails.join(' · ') || 'Coverage counts unavailable'}
                      {packet.source.researchCoverage.searchScopeNote ? (
                        <p>{packet.source.researchCoverage.searchScopeNote}</p>
                      ) : null}
                    </dd>
                  </>
                ) : null}
              </dl>
            ) : null}
            {includeComparison && minimal ? (
              <>
                <p>
                  {selectedCount} selected {selectedCount === 1 ? 'draft' : 'drafts'}:
                </p>
                <ul>
                  <li>The AI’s predicted answers, importance, conviction, and confidence. Drafted text is not kept.</li>
                  <li>{revisionCount} saved prediction versions with model IDs, without drafted text or basis.</li>
                  <li>Which fields changed. Unchanged fields are labeled unchanged, not human agreement.</li>
                </ul>
                <p>The AI’s notes, drafted comments, and drafts for questions you skipped are not included.</p>
              </>
            ) : includeComparison ? (
              <>
                <p>
                  {selectedCount} selected {selectedCount === 1 ? 'draft' : 'drafts'} and {unselectedCount} unselected{' '}
                  {unselectedCount === 1 ? 'draft' : 'drafts'}:
                </p>
                <ul>
                  <li>Original answers, comments, confidence, basis, importance, and conviction.</li>
                  <li>
                    {revisionCount} saved prediction versions, including model IDs and revised answers, comments,
                    confidence, and basis.
                  </li>
                  <li>
                    Reviewed final values and which fields changed. Unchanged fields are labeled unchanged, not human
                    agreement.
                  </li>
                  <li>
                    Unselected drafts, including original and edited values and selection status. Their final value is
                    empty unless submitted separately.
                  </li>
                </ul>
                <p>
                  Encrypted answer and comment text is excluded, along with its prediction basis. Edits are not treated
                  as agreement.
                </p>
              </>
            ) : null}
            {includeProvenance || includeComparison ? (
              <p>
                Also includes the time drafts were applied. The full interview transcript and imported conversation
                history are not attached. See{' '}
                <a href={RESEARCH_DOC_URL} target="_blank" rel="noreferrer">
                  How research data is handled
                </a>
                .
              </p>
            ) : null}
          </div>
        </details>
      ) : null}
    </>
  );
}
