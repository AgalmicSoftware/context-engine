import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, faChevronUp, faExpand } from '@fortawesome/free-solid-svg-icons';
import { Collapse } from 'reactstrap';

import SingleQuestionResponse from '../SurveyTool/SingleQuestionResponse';
import {
  resolveUserPageSectionToggleDisplayState,
  resolveUserPageSurveyCountDisplayState,
  resolveUserPageSurveyCreatedCardState,
  resolveUserPageSurveyPreviewDisplayState,
  resolveUserPageSurveyResponseCardState,
  shortenUserPageQuestionId,
} from './userPageHelpers';
import styles from './UserPage.module.scss';

type SingleQuestionResponseProps = React.ComponentProps<typeof SingleQuestionResponse>;

type UserPageSectionToggleState = {
  isOpen?: boolean;
  shouldRenderClosedIcon?: boolean;
  shouldRenderOpenIcon?: boolean;
};

type UserPageSurveySectionDisplayState = {
  hasCreatedSurveys?: boolean;
  hasSurveyResponses?: boolean;
  shouldRenderSurveyResponsesEmptyText?: boolean;
  shouldRenderSurveysCreatedEmptyText?: boolean;
};

type UserPageSurveyEntry = {
  documentURLs: string[];
  id: string;
  questionsCount: React.ReactNode;
  slug?: string;
  tags: React.ReactNode[];
  title: React.ReactNode;
  [key: string]: unknown;
};

type UserPageSurveyQuestionResponseDetail = {
  canDecryptOtherResponses?: unknown;
  questionData: SingleQuestionResponseProps['question'];
  responseData: SingleQuestionResponseProps['response'];
};

type UserPageSurveyPreviewEntry = {
  id?: unknown;
  text?: unknown;
};

type UserPageSurveySectionProps = {
  detailedSurveyResponseMap: Record<string, UserPageSurveyQuestionResponseDetail[] | undefined>;
  expandedSurveyCreatedMap: Record<string, boolean | undefined>;
  expandedSurveyResponseMap: Record<string, boolean | undefined>;
  getSurveyCreatedHref: (survey: UserPageSurveyEntry, surveyLinkSlug?: unknown) => string;
  isSurveyLoadingAny?: boolean;
  onDecryptQuestion: NonNullable<SingleQuestionResponseProps['onDecryptQuestion']>;
  onOpenSurveyResponse: (survey: UserPageSurveyEntry, event: React.MouseEvent<HTMLElement>) => unknown;
  onShowQuestionsTab: (event: React.MouseEvent<HTMLElement>) => unknown;
  onSurveyCreatedToggle: (surveyId: string) => unknown;
  onSurveyResponsesSectionToggle: (event?: React.MouseEvent<HTMLElement>) => unknown;
  onSurveyResponseToggle: (surveyId: string) => unknown;
  onSurveysCreatedSectionToggle: (event?: React.MouseEvent<HTMLElement>) => unknown;
  questionResponsesNonce?: unknown;
  responderAddress?: SingleQuestionResponseProps['responderAddress'];
  sbtCacheRevision?: unknown;
  surveyCreationEntries: UserPageSurveyEntry[];
  surveyResponseEntries: UserPageSurveyEntry[];
  surveyResponsesLoadingIndicator?: React.ReactNode;
  surveyResponsesSectionToggleState: UserPageSectionToggleState;
  surveySectionDisplayState: UserPageSurveySectionDisplayState;
  surveysCreatedLoadingIndicator?: React.ReactNode;
  surveysCreatedSectionToggleState: UserPageSectionToggleState;
};

const UserPageSurveySection = ({
  detailedSurveyResponseMap,
  expandedSurveyCreatedMap,
  expandedSurveyResponseMap,
  getSurveyCreatedHref,
  isSurveyLoadingAny = false,
  onDecryptQuestion,
  onOpenSurveyResponse,
  onShowQuestionsTab,
  onSurveyCreatedToggle,
  onSurveyResponsesSectionToggle,
  onSurveyResponseToggle,
  onSurveysCreatedSectionToggle,
  questionResponsesNonce,
  responderAddress,
  sbtCacheRevision,
  surveyCreationEntries,
  surveyResponseEntries,
  surveyResponsesLoadingIndicator = null,
  surveyResponsesSectionToggleState,
  surveySectionDisplayState,
  surveysCreatedLoadingIndicator = null,
  surveysCreatedSectionToggleState,
}: UserPageSurveySectionProps): React.ReactElement => (
  <div className={styles.leftColumn}>
    <div className={styles.surveySection}>
      <h2 onClick={onSurveyResponsesSectionToggle} className={styles.sectionHeader}>
        {surveyResponsesSectionToggleState.shouldRenderOpenIcon && (
          <FontAwesomeIcon icon={faChevronUp} className={styles.headerChevron} />
        )}
        {surveyResponsesSectionToggleState.shouldRenderClosedIcon && (
          <FontAwesomeIcon icon={faChevronDown} className={styles.headerChevron} />
        )}{' '}
        <span className={styles.sectionSwitcher}>
          <button
            type="button"
            className={styles.switchWordInactive}
            onClick={onShowQuestionsTab}
            aria-label="Show Questions"
          >
            Questions
          </button>
          <span className={styles.switchDivider}>/</span>
          <span className={styles.switchWordActive}>Survey Responses</span>
        </span>
        {isSurveyLoadingAny && surveyResponsesLoadingIndicator}
      </h2>
      <Collapse isOpen={surveyResponsesSectionToggleState.isOpen}>
        {surveySectionDisplayState.hasSurveyResponses ? (
          surveyResponseEntries.map((survey, index: number) => {
            const isExpanded = expandedSurveyResponseMap[survey.id] || false;
            const questionArray = detailedSurveyResponseMap[survey.id] || [];
            const surveyResponseCardToggleState = resolveUserPageSectionToggleDisplayState({
              open: isExpanded,
            });
            const surveyResponseCardState = resolveUserPageSurveyResponseCardState({
              questionArray,
              survey,
            });
            const surveyResponsePreviewDisplayState = resolveUserPageSurveyPreviewDisplayState({
              actionsClassName: styles.surveyPreviewWithActions,
              baseClassName: styles.surveyPreview,
              interactive: true,
            });

            return (
              <div key={index} className={styles.surveyWrapper}>
                <div
                  className={surveyResponsePreviewDisplayState.className}
                  onClick={() => onSurveyResponseToggle(survey.id)}
                  style={surveyResponsePreviewDisplayState.style}
                >
                  <div className={styles.surveyTitle}>{survey.title}</div>
                  <div className={styles.surveyInfo}>Questions: {survey.questionsCount}</div>
                  {responderAddress && (
                    <button
                      type="button"
                      className={styles.surveyExpandIcon}
                      title="Open full survey page"
                      aria-label="Open full survey page"
                      onClick={(event: React.MouseEvent<HTMLElement>) => onOpenSurveyResponse(survey, event)}
                    >
                      <FontAwesomeIcon icon={faExpand} />
                    </button>
                  )}
                  <div className={styles.chevronContainer}>
                    {surveyResponseCardToggleState.shouldRenderOpenIcon && (
                      <FontAwesomeIcon icon={faChevronUp} className={styles.chevronIcon} />
                    )}
                    {surveyResponseCardToggleState.shouldRenderClosedIcon && (
                      <FontAwesomeIcon icon={faChevronDown} className={styles.chevronIcon} />
                    )}
                  </div>
                </div>

                {surveyResponseCardToggleState.isOpen && surveyResponseCardState.hasResponses && (
                  <div className={styles.responsesContainer}>
                    {surveyResponseCardState.hasTags && (
                      <div className={styles.surveyDetailRow}>
                        <span className={styles.surveyDetailLabel}>Tags:</span>{' '}
                        {survey.tags.map((tag: React.ReactNode, tagIndex: number) => (
                          <span key={tagIndex} className={styles.surveyTag}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    {surveyResponseCardState.hasDocURLs && (
                      <div className={styles.surveyDetailRow}>
                        <span className={styles.surveyDetailLabel}>Documents:</span>
                        {survey.documentURLs.map((url: string, urlIndex: number) => (
                          <a
                            key={urlIndex}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.surveyDocLink}
                          >
                            {url.length > 60 ? url.slice(0, 57) + '...' : url}
                          </a>
                        ))}
                      </div>
                    )}
                    {questionArray.map((questionResponse, questionIndex: number) => (
                      <div key={questionIndex} className={styles.responseItemWrapper}>
                        <SingleQuestionResponse
                          question={questionResponse.questionData}
                          response={questionResponse.responseData}
                          isOwnResponse={false}
                          mode="mini"
                          showImportance={true}
                          compactEncryptedAnswerCta={true}
                          stackCompactDecryptCta={true}
                          onDecryptQuestion={onDecryptQuestion}
                          canDecryptOtherResponses={!!questionResponse?.canDecryptOtherResponses}
                          responderAddress={responderAddress}
                          sessionSlug={survey.slug}
                          questionResponsesNonce={questionResponsesNonce}
                          sbtCacheRevision={sbtCacheRevision}
                        />
                      </div>
                    ))}
                  </div>
                )}
                {surveyResponseCardToggleState.isOpen && !surveyResponseCardState.hasResponses && (
                  <div className={styles.noResponsesMsg}>No non-empty responses recorded for this survey.</div>
                )}
              </div>
            );
          })
        ) : surveySectionDisplayState.shouldRenderSurveyResponsesEmptyText ? (
          <p>No survey responses found.</p>
        ) : null}
      </Collapse>

      <h2 onClick={onSurveysCreatedSectionToggle} className={styles.sectionHeaderWithMargin}>
        {surveysCreatedSectionToggleState.shouldRenderOpenIcon && (
          <FontAwesomeIcon icon={faChevronUp} className={styles.headerChevron} />
        )}
        {surveysCreatedSectionToggleState.shouldRenderClosedIcon && (
          <FontAwesomeIcon icon={faChevronDown} className={styles.headerChevron} />
        )}{' '}
        <span className={styles.sectionSwitcher}>
          <button
            type="button"
            className={styles.switchWordInactive}
            onClick={onShowQuestionsTab}
            aria-label="Show Questions"
          >
            Questions
          </button>
          <span className={styles.switchDivider}>/</span>
          <span className={styles.switchWordActive}>Surveys Created</span>
        </span>
        {isSurveyLoadingAny && surveysCreatedLoadingIndicator}
      </h2>
      <Collapse isOpen={surveysCreatedSectionToggleState.isOpen}>
        {surveySectionDisplayState.hasCreatedSurveys ? (
          surveyCreationEntries.map((survey, index: number) => {
            const isCreatedExpanded = expandedSurveyCreatedMap[survey.id] || false;
            const surveyCreatedCardToggleState = resolveUserPageSectionToggleDisplayState({
              open: isCreatedExpanded,
            });
            const { hasDocURLs, hasExpandContent, hasQuestionIDs, hasTags, questionPreviewEntries, surveyLinkSlug } =
              resolveUserPageSurveyCreatedCardState({ survey });
            const surveyCreatedPreviewDisplayState = resolveUserPageSurveyPreviewDisplayState({
              actionsClassName: styles.surveyPreviewWithActions,
              baseClassName: styles.surveyPreview,
              interactive: hasExpandContent,
            });
            const surveyCountDisplayState = resolveUserPageSurveyCountDisplayState({
              count: survey.questionsCount,
              countOnlyClassName: styles.surveyCountOnly,
              infoClassName: styles.surveyInfo,
            });

            return (
              <div key={index} className={styles.surveyWrapper}>
                <div
                  className={surveyCreatedPreviewDisplayState.className}
                  onClick={() => hasExpandContent && onSurveyCreatedToggle(survey.id)}
                  style={surveyCreatedPreviewDisplayState.style}
                >
                  <a
                    href={getSurveyCreatedHref(survey, surveyLinkSlug)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.surveyTitleLink}
                    onClick={(event: React.MouseEvent<HTMLElement>) => event.stopPropagation()}
                  >
                    <div className={styles.surveyTitle}>{survey.title}</div>
                  </a>
                  <div
                    className={surveyCountDisplayState.className}
                    aria-label={surveyCountDisplayState.ariaLabel}
                    title={surveyCountDisplayState.title}
                  >
                    {survey.questionsCount}
                  </div>
                  {hasExpandContent && (
                    <div className={styles.chevronContainer}>
                      {surveyCreatedCardToggleState.shouldRenderOpenIcon && (
                        <FontAwesomeIcon icon={faChevronUp} className={styles.chevronIcon} />
                      )}
                      {surveyCreatedCardToggleState.shouldRenderClosedIcon && (
                        <FontAwesomeIcon icon={faChevronDown} className={styles.chevronIcon} />
                      )}
                    </div>
                  )}
                </div>
                {surveyCreatedCardToggleState.isOpen && hasExpandContent && (
                  <div className={styles.responsesContainer}>
                    {hasTags && (
                      <div className={styles.surveyDetailRow}>
                        <span className={styles.surveyDetailLabel}>Tags:</span>{' '}
                        {survey.tags.map((tag: React.ReactNode, tagIndex: number) => (
                          <span key={tagIndex} className={styles.surveyTag}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    {hasDocURLs && (
                      <div className={styles.surveyDetailRow}>
                        <span className={styles.surveyDetailLabel}>Documents:</span>
                        {survey.documentURLs.map((url: string, urlIndex: number) => (
                          <a
                            key={urlIndex}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.surveyDocLink}
                          >
                            {url.length > 60 ? url.slice(0, 57) + '...' : url}
                          </a>
                        ))}
                      </div>
                    )}
                    {hasQuestionIDs && (
                      <div className={styles.surveyDetailRow}>
                        <span className={styles.surveyDetailLabel}>Questions:</span>
                        <ul className={styles.surveyQuestionList}>
                          {(questionPreviewEntries as UserPageSurveyPreviewEntry[]).map(
                            (entry, questionIndex: number) => {
                              const fullQuestionId = String(entry?.id || '');
                              const resolvedText = String(entry?.text || '').trim();
                              return (
                                <li key={`${fullQuestionId}_${questionIndex}`} className={styles.surveyQuestionItem}>
                                  {resolvedText ? (
                                    resolvedText
                                  ) : (
                                    <span className={styles.surveyQuestionFallbackId} title={fullQuestionId}>
                                      {shortenUserPageQuestionId(fullQuestionId)}
                                    </span>
                                  )}
                                </li>
                              );
                            },
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        ) : surveySectionDisplayState.shouldRenderSurveysCreatedEmptyText ? (
          <p>No surveys created.</p>
        ) : null}
      </Collapse>
    </div>
  </div>
);

export default UserPageSurveySection;
