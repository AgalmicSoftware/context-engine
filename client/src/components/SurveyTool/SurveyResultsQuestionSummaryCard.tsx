import React from 'react';
import { Card, CardBody, CardHeader, Collapse } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBookmark, faCaretDown, faCaretUp, faComments } from '@fortawesome/free-solid-svg-icons';

type SurveyResultsQuestionSummaryCardProps = {
  bookmarkIconStyle?: React.CSSProperties;
  bookmarked?: boolean;
  domId: string;
  isActive?: boolean;
  metadataMissing?: boolean;
  metadataMissingStyle?: React.CSSProperties;
  onToggleBookmark: () => void;
  onToggleSummary: () => void;
  questionPrompt: React.ReactNode;
  renderDefaultSummary: () => React.ReactNode;
  renderFreeformSummary: () => React.ReactNode;
  renderMultichoiceSummary: () => React.ReactNode;
  resolvedQuestionType?: string;
  styleMap: Record<string, string>;
  viewableResponsesCount?: number;
};

const SurveyResultsQuestionSummaryCard = ({
  bookmarkIconStyle,
  bookmarked = false,
  domId,
  isActive = false,
  metadataMissing = false,
  metadataMissingStyle,
  onToggleBookmark,
  onToggleSummary,
  questionPrompt,
  renderDefaultSummary,
  renderFreeformSummary,
  renderMultichoiceSummary,
  resolvedQuestionType = '',
  styleMap,
  viewableResponsesCount = 0,
}: SurveyResultsQuestionSummaryCardProps): React.ReactElement => {
  const isFreeform = resolvedQuestionType === 'freeform' || resolvedQuestionType === 'text';

  return (
    <Card id={domId} className={styleMap.aggregatorSummaryCard}>
      <CardHeader onClick={onToggleSummary} className={styleMap.questionSummaryHeader}>
        <div className={styleMap.headerLeft}>
          <div className={styleMap.responseCountContainer}>
            <FontAwesomeIcon icon={faComments} className={styleMap.responseCountIcon} />
            <span className={styleMap.responseCountNumber}>{viewableResponsesCount}</span>
          </div>
          <span className={styleMap.questionTitle}>{questionPrompt}</span>
        </div>
        <div className={styleMap.questionSummaryHeaderIcons}>
          <button
            type="button"
            className={styleMap.questionBookmarkButton}
            onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
              e.stopPropagation();
              onToggleBookmark();
            }}
            aria-label={bookmarked ? 'Remove bookmark' : 'Bookmark question'}
            title={bookmarked ? 'Remove bookmark' : 'Bookmark question'}
          >
            <FontAwesomeIcon
              icon={faBookmark}
              className={styleMap.questionBookmarkIcon}
              color={bookmarked ? 'gold' : 'white'}
              style={bookmarkIconStyle}
            />
          </button>
          <FontAwesomeIcon icon={isActive ? faCaretUp : faCaretDown} className={styleMap.questionExpandIcon} />
        </div>
      </CardHeader>
      <Collapse isOpen={isActive} id={styleMap.surveyResultsCollapse}>
        <CardBody className={styleMap.aggregatorDarkCardBody}>
          {metadataMissing && <p style={metadataMissingStyle}>No metadata found for this question in local cache.</p>}
          <div className={styleMap.surveyResultsOverride}>
            {isFreeform
              ? renderFreeformSummary()
              : resolvedQuestionType === 'multichoice'
                ? renderMultichoiceSummary()
                : renderDefaultSummary()}
          </div>
        </CardBody>
      </Collapse>
    </Card>
  );
};

export default SurveyResultsQuestionSummaryCard;
