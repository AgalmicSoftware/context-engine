import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, faChevronUp } from '@fortawesome/free-solid-svg-icons';
import { Collapse } from 'reactstrap';

import SingleQuestionResponse from '../SurveyTool/SingleQuestionResponse';
import { canonicalizeSessionSlug as normalizeSessionSlug } from '../../utilities/session/sessionSlug.js';
import styles from './UserPage.module.scss';

type SingleQuestionResponseProps = React.ComponentProps<typeof SingleQuestionResponse>;

type UserPageSectionToggleState = {
  isOpen?: boolean;
  shouldRenderClosedIcon?: boolean;
  shouldRenderOpenIcon?: boolean;
};

type UserPageQuestionSectionDisplayState = {
  hasCreatedQuestions?: boolean;
  hasQuestionResponses?: boolean;
  shouldRenderQuestionResponsesEmptyText?: boolean;
  shouldRenderQuestionsCreatedEmptyText?: boolean;
};

type UserPageQuestionEntry = NonNullable<SingleQuestionResponseProps['question']> & {
  canDecryptOtherResponses?: unknown;
  id: string;
  sessionSlug?: unknown;
  slug?: unknown;
};

type UserPageQuestionSectionProps = {
  activeSessionSlug?: unknown;
  createdQuestionWrapperClassName: string;
  detailedQuestionResponseMap: Record<string, SingleQuestionResponseProps['response'] | undefined>;
  isQuestionLoadingAny?: boolean;
  network?: SingleQuestionResponseProps['network'];
  onDecryptQuestion: NonNullable<SingleQuestionResponseProps['onDecryptQuestion']>;
  onQuestionResponsesSectionToggle: (event?: React.MouseEvent<HTMLElement>) => unknown;
  onQuestionsCreatedSectionToggle: (event?: React.MouseEvent<HTMLElement>) => unknown;
  onShowSurveysTab: (event: React.MouseEvent<HTMLElement>) => unknown;
  questionCreationEntries: UserPageQuestionEntry[];
  questionResponsesEmptyText: React.ReactNode;
  questionResponsesLoadingIndicator?: React.ReactNode;
  questionResponsesNonce?: unknown;
  questionResponseEntries: UserPageQuestionEntry[];
  questionResponsesSectionToggleState: UserPageSectionToggleState;
  questionSectionDisplayState: UserPageQuestionSectionDisplayState;
  questionsCreatedLoadingIndicator?: React.ReactNode;
  questionsCreatedSectionToggleState: UserPageSectionToggleState;
  responderAddress?: SingleQuestionResponseProps['responderAddress'];
  sbtCacheRevision?: unknown;
};

const normalizeRowKeyPart = (value: unknown): string =>
  String(value || '')
    .trim()
    .toLowerCase();

const resolveQuestionSessionSlug = (question: UserPageQuestionEntry, activeSessionSlug: unknown): string =>
  normalizeSessionSlug(question?.sessionSlug || question?.slug || activeSessionSlug || '');

const buildQuestionResponseRowKey = ({
  activeSessionSlug,
  question,
  responderAddress,
  response,
}: {
  activeSessionSlug: unknown;
  question: UserPageQuestionEntry;
  responderAddress: unknown;
  response: SingleQuestionResponseProps['response'];
}): string => {
  const responseRecord = response && typeof response === 'object' ? (response as Record<string, unknown>) : {};
  const responseIdentity =
    responseRecord.responseId ||
    responseRecord.id ||
    responseRecord.responder ||
    responderAddress ||
    'profile-response';
  return [
    'response',
    resolveQuestionSessionSlug(question, activeSessionSlug),
    normalizeRowKeyPart(question.id),
    normalizeRowKeyPart(responseIdentity),
  ].join(':');
};

const buildCreatedQuestionRowKey = (question: UserPageQuestionEntry, activeSessionSlug: unknown): string =>
  ['created', resolveQuestionSessionSlug(question, activeSessionSlug), normalizeRowKeyPart(question.id)].join(':');

const UserPageQuestionSection = ({
  activeSessionSlug,
  createdQuestionWrapperClassName,
  detailedQuestionResponseMap,
  isQuestionLoadingAny = false,
  network,
  onDecryptQuestion,
  onQuestionResponsesSectionToggle,
  onQuestionsCreatedSectionToggle,
  onShowSurveysTab,
  questionCreationEntries,
  questionResponsesEmptyText,
  questionResponsesLoadingIndicator = null,
  questionResponsesNonce,
  questionResponseEntries,
  questionResponsesSectionToggleState,
  questionSectionDisplayState,
  questionsCreatedLoadingIndicator = null,
  questionsCreatedSectionToggleState,
  responderAddress,
  sbtCacheRevision,
}: UserPageQuestionSectionProps): React.ReactElement => (
  <div className={styles.leftColumn}>
    <div className={styles.questionSection}>
      <h2 onClick={onQuestionResponsesSectionToggle} className={styles.sectionHeader}>
        {questionResponsesSectionToggleState.shouldRenderOpenIcon && (
          <FontAwesomeIcon icon={faChevronUp} className={styles.headerChevron} />
        )}
        {questionResponsesSectionToggleState.shouldRenderClosedIcon && (
          <FontAwesomeIcon icon={faChevronDown} className={styles.headerChevron} />
        )}{' '}
        <span className={styles.sectionSwitcher}>
          <button
            type="button"
            className={styles.switchWordInactive}
            onClick={onShowSurveysTab}
            aria-label="Show Surveys"
          >
            Survey
          </button>
          <span className={styles.switchDivider}>/</span>
          <span className={styles.switchWordActive}>Question Responses</span>
        </span>
        {isQuestionLoadingAny && questionResponsesLoadingIndicator}
      </h2>
      <Collapse isOpen={questionResponsesSectionToggleState.isOpen}>
        {questionSectionDisplayState.hasQuestionResponses ? (
          questionResponseEntries.map((question) => {
            const userResp = detailedQuestionResponseMap[question.id];
            if (!userResp) return null;
            return (
              <div
                key={buildQuestionResponseRowKey({
                  activeSessionSlug,
                  question,
                  responderAddress,
                  response: userResp,
                })}
                className={styles.questionWrapper}
              >
                <SingleQuestionResponse
                  question={question}
                  response={userResp}
                  isOwnResponse={false}
                  mode="mini"
                  showImportance={true}
                  compactEncryptedAnswerCta={true}
                  stackCompactDecryptCta={true}
                  onDecryptQuestion={onDecryptQuestion}
                  canDecryptOtherResponses={!!question?.canDecryptOtherResponses}
                  responderAddress={responderAddress}
                  network={network}
                  sessionSlug={question?.sessionSlug || question?.slug || activeSessionSlug}
                  questionResponsesNonce={questionResponsesNonce}
                  sbtCacheRevision={sbtCacheRevision}
                />
              </div>
            );
          })
        ) : questionSectionDisplayState.shouldRenderQuestionResponsesEmptyText ? (
          <p>{questionResponsesEmptyText}</p>
        ) : null}
      </Collapse>

      <h2 onClick={onQuestionsCreatedSectionToggle} className={styles.sectionHeaderWithMargin}>
        {questionsCreatedSectionToggleState.shouldRenderOpenIcon && (
          <FontAwesomeIcon icon={faChevronUp} className={styles.headerChevron} />
        )}
        {questionsCreatedSectionToggleState.shouldRenderClosedIcon && (
          <FontAwesomeIcon icon={faChevronDown} className={styles.headerChevron} />
        )}{' '}
        <span className={styles.sectionSwitcher}>
          <button
            type="button"
            className={styles.switchWordInactive}
            onClick={onShowSurveysTab}
            aria-label="Show Surveys"
          >
            Surveys
          </button>
          <span className={styles.switchDivider}>/</span>
          <span className={styles.switchWordActive}>Questions Created</span>
        </span>
        {isQuestionLoadingAny && questionsCreatedLoadingIndicator}
      </h2>
      <Collapse isOpen={questionsCreatedSectionToggleState.isOpen}>
        {questionSectionDisplayState.hasCreatedQuestions ? (
          questionCreationEntries.map((question) => (
            <div
              key={buildCreatedQuestionRowKey(question, activeSessionSlug)}
              className={createdQuestionWrapperClassName}
            >
              <SingleQuestionResponse
                question={question}
                response={null}
                isOwnResponse={false}
                mode="mini"
                showImportance={false}
                onDecryptQuestion={() => {}}
                questionOnly={true}
                network={network}
                sessionSlug={question?.sessionSlug || question?.slug || activeSessionSlug}
                questionResponsesNonce={questionResponsesNonce}
                sbtCacheRevision={sbtCacheRevision}
              />
            </div>
          ))
        ) : questionSectionDisplayState.shouldRenderQuestionsCreatedEmptyText ? (
          <p>No questions created.</p>
        ) : null}
      </Collapse>
    </div>
  </div>
);

export default UserPageQuestionSection;
