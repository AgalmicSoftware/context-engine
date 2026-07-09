import React from 'react';
import { Card, CardBody, CardHeader, Collapse } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCaretDown, faCaretUp } from '@fortawesome/free-solid-svg-icons';

type SurveyResultsQuestionListCardProps = {
  isOpen?: boolean;
  onToggle: () => void;
  questionTableNode?: React.ReactNode;
  showEmptyState?: boolean;
  styleMap: Record<string, string>;
  tableWrapperRef?: React.Ref<HTMLDivElement>;
  title: string;
  trailingLabelStyle?: React.CSSProperties;
};

const SurveyResultsQuestionListCard = ({
  isOpen = false,
  onToggle,
  questionTableNode = null,
  showEmptyState = false,
  styleMap,
  tableWrapperRef,
  title,
  trailingLabelStyle,
}: SurveyResultsQuestionListCardProps): React.ReactElement => (
  <Card className={styleMap.questionListCard}>
    <CardHeader onClick={onToggle} className={styleMap.questionSummaryHeader}>
      <span className={styleMap.questionTitle}>{title}</span>
      <FontAwesomeIcon
        icon={isOpen ? faCaretUp : faCaretDown}
        className={styleMap.biggerIcon}
        style={trailingLabelStyle}
      />
    </CardHeader>
    <Collapse isOpen={isOpen} id={styleMap.surveyResultsCollapse}>
      <CardBody className={styleMap.aggregatorDarkCardBody}>
        {showEmptyState ? <p>No questions found.</p> : <div ref={tableWrapperRef}>{questionTableNode}</div>}
      </CardBody>
    </Collapse>
  </Card>
);

export default SurveyResultsQuestionListCard;
