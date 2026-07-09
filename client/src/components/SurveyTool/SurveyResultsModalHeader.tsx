import React from 'react';
import { ModalHeader } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBookmark, faExternalLinkAlt } from '@fortawesome/free-solid-svg-icons';

export type SurveyResultsDemoViewOption = {
  key: string;
  label: string;
};

export type SurveyResultsModalHeaderProps = {
  bookmarkedSurveyIDs?: string[];
  currentSurveyId?: string | null;
  demoResultsViewMode?: string;
  demoResultsViewOptions?: SurveyResultsDemoViewOption[];
  documentLinkIconStyle?: React.CSSProperties;
  effectiveSlug?: string;
  isDemoQuestionResults?: boolean;
  lockedResponsesToggleNode?: React.ReactNode;
  onClose: () => void;
  onDemoResultsViewSelect: (viewKey: string) => void;
  onToggleSurveyBookmark: (surveyId: string) => void;
  styleMap: Record<string, string>;
  surveyBookmarkStyle?: React.CSSProperties;
  surveyDocumentURLs?: string[];
  surveyIdAbbreviation?: React.ReactNode;
  surveyTitle?: string;
  syncStatusNode?: React.ReactNode;
  viewMode?: string;
};

const SurveyResultsModalHeader = ({
  bookmarkedSurveyIDs = [],
  currentSurveyId = null,
  demoResultsViewMode = 'raw',
  demoResultsViewOptions = [],
  documentLinkIconStyle,
  effectiveSlug = '',
  isDemoQuestionResults = false,
  lockedResponsesToggleNode = null,
  onClose,
  onDemoResultsViewSelect,
  onToggleSurveyBookmark,
  styleMap,
  surveyBookmarkStyle,
  surveyDocumentURLs = [],
  surveyIdAbbreviation = null,
  surveyTitle = '',
  syncStatusNode = null,
  viewMode = '',
}: SurveyResultsModalHeaderProps): React.ReactElement => (
  <ModalHeader toggle={onClose} className={styleMap.modalHeader}>
    <div className={styleMap.modalHeaderContent}>
      <div className={styleMap.modalHeaderTitleBlock}>
        <h2 className={styleMap.modalTitle}>
          {viewMode === 'survey' ? `${surveyTitle ? `${surveyTitle}` : 'Survey Results'}` : 'Question Results'}
        </h2>
      </div>

      {viewMode === 'survey' && currentSurveyId && (
        <div className={styleMap.modalSubtitle}>
          <span className={styleMap.surveyIdMeta}>
            Survey ID:{' '}
            <a
              href={`/survey/${encodeURIComponent(currentSurveyId)}${effectiveSlug ? `?session=${encodeURIComponent(effectiveSlug)}` : ''}`}
              className={styleMap.surveyIdLink}
            >
              {surveyIdAbbreviation || currentSurveyId}
            </a>
          </span>
          <FontAwesomeIcon
            icon={faBookmark}
            className={styleMap.biggerIcon}
            onClick={(e: React.MouseEvent<SVGSVGElement>) => {
              e.stopPropagation();
              onToggleSurveyBookmark(currentSurveyId);
            }}
            color={bookmarkedSurveyIDs.includes(currentSurveyId) ? 'gold' : 'grey'}
            style={surveyBookmarkStyle}
            title="Bookmark Survey ID"
          />
        </div>
      )}
      {viewMode === 'survey' && surveyDocumentURLs.length > 0 && (
        <div className={styleMap.surveyDocUrls}>
          {surveyDocumentURLs.map((url: string, idx: number) => (
            <a
              key={idx}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className={styleMap.surveyDocUrlLink}
              title={url}
            >
              <FontAwesomeIcon icon={faExternalLinkAlt} style={documentLinkIconStyle} />
              {url.length > 50 ? `${url.slice(0, 47)}...` : url}
            </a>
          ))}
        </div>
      )}
    </div>
    <div className={styleMap.modalHeaderControls}>
      {lockedResponsesToggleNode}
      {syncStatusNode}
      {isDemoQuestionResults && (
        <div
          className={styleMap.demoResultsViewNav}
          aria-label="Demo results views"
          data-testid="ce-surveyresults-demo-view-nav"
        >
          {demoResultsViewOptions.map((option: SurveyResultsDemoViewOption) => {
            const isActiveView = demoResultsViewMode === option.key;
            return (
              <button
                key={option.key}
                type="button"
                className={[styleMap.demoResultsViewButton, isActiveView ? styleMap.demoResultsViewButtonActive : '']
                  .filter(Boolean)
                  .join(' ')}
                aria-pressed={isActiveView}
                data-testid={`ce-surveyresults-demo-view-${option.key}`}
                onClick={() => onDemoResultsViewSelect(option.key)}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  </ModalHeader>
);

export default SurveyResultsModalHeader;
