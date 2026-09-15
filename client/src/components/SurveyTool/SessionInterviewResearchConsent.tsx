import React from 'react';
import { Input, Label, UncontrolledTooltip } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { INTERVIEW_PROMPT_VERSION, type InterviewPrefillPacket } from './sessionInterview';
import styles from './SurveyTool.module.scss';

type Props = {
  packet: InterviewPrefillPacket;
  includeProvenance: boolean;
  includeComparison: boolean;
  onProvenanceChange: (included: boolean) => void;
  onComparisonChange: (included: boolean) => void;
  coverageDetails: string[];
  selectedCount: number;
  unselectedCount: number;
  disabled: boolean;
};

export default function SessionInterviewResearchConsent({
  packet,
  includeProvenance,
  includeComparison,
  onProvenanceChange,
  onComparisonChange,
  coverageDetails,
  selectedCount,
  unselectedCount,
  disabled,
}: Props) {
  const model = packet.source.modelId || 'Unknown model';
  const platform = { chatgpt: 'ChatGPT', claude: 'Claude', other: 'Other' }[packet.source.platform];
  return (
    <>
      <Label check className={styles.sessionInterviewProvenance}>
        <Input
          type="checkbox"
          checked={includeProvenance}
          disabled={disabled}
          onChange={(event) => onProvenanceChange(event.target.checked)}
        />{' '}
        Include self-reported AI platform/model provenance with submitted responses
      </Label>
      <div className={styles.sessionInterviewResearchConsent}>
        <Label check className={styles.sessionInterviewProvenance}>
          <Input
            type="checkbox"
            checked={includeComparison}
            disabled={disabled}
            onChange={(event) => onComparisonChange(event.target.checked)}
            data-testid={E2E_TESTIDS.SESSION_INTERVIEW_INCLUDE_PREDICTION_COMPARISON}
          />{' '}
          <span>Include the original AI prediction and final submitted answer for accuracy research</span>
        </Label>
        <button
          type="button"
          id="ce-interview-research-help"
          className={styles.sessionInterviewResearchHelp}
          aria-label="About accuracy research"
          aria-describedby="ce-interview-research-description"
        >
          <FontAwesomeIcon icon={faQuestionCircle} />
        </button>
      </div>
      <span id="ce-interview-research-description" className={styles.sessionListeningSrOnly}>
        Includes original predictions, your edits, and drafts you did not select. Unselected drafts are recorded as
        research metadata, not submitted answers. Final answers are compared at submission; encrypted answer and comment
        text is excluded from research metadata.
      </span>
      <UncontrolledTooltip target="ce-interview-research-help" placement="top" trigger="hover focus">
        Includes original predictions, your edits, and unselected drafts. Unselected drafts are research metadata, not
        submitted answers. Encrypted answer and comment text is excluded.
      </UncontrolledTooltip>
      <details className={styles.sessionInterviewMetadata} aria-label="AI prefill metadata">
        <summary>AI prefill metadata · {model}</summary>
        {includeProvenance ? (
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
        ) : (
          <p>Platform, model, revision, and coverage details will not be included.</p>
        )}
        {includeComparison ? (
          <>
            <p>
              {selectedCount} selected {selectedCount === 1 ? 'draft' : 'drafts'} and {unselectedCount} unselected{' '}
              {unselectedCount === 1 ? 'draft' : 'drafts'}:
            </p>
            <ul>
              <li>Original answers, comments, confidence, basis, importance, and conviction.</li>
              <li>Final submitted values and which fields changed.</li>
              <li>
                Unselected drafts, including original and edited values and selection status. Their final value is empty
                unless submitted separately.
              </li>
            </ul>
            <p>Encrypted answer and comment text is excluded, along with its prediction basis.</p>
          </>
        ) : (
          <p>Predictions, edits, and unselected drafts will not be included.</p>
        )}
        {includeProvenance || includeComparison ? (
          <p>
            Also includes the time drafts were applied. The full interview transcript and imported conversation history are
            not attached.
          </p>
        ) : null}
      </details>
    </>
  );
}
