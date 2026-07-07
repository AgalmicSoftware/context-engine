import React from 'react';
import { Button, ModalFooter } from 'reactstrap';

export type SurveyResultsHtmlReportActionControlsStyleMap = {
  htmlReportCancelButton?: string;
  htmlReportDownloadButton?: string;
  htmlReportModalFooter?: string;
};

export type SurveyResultsHtmlReportActionControlsProps = {
  canDownload?: boolean;
  downloadLabel: string;
  onClose: () => void;
  onDownload: () => void;
  styleMap: SurveyResultsHtmlReportActionControlsStyleMap;
};

export const renderSurveyResultsHtmlReportActionControls = ({
  canDownload = false,
  downloadLabel,
  onClose,
  onDownload,
  styleMap,
}: SurveyResultsHtmlReportActionControlsProps): React.ReactElement => (
  <ModalFooter className={styleMap.htmlReportModalFooter}>
    <Button color="secondary" onClick={onClose} className={styleMap.htmlReportCancelButton}>
      Cancel
    </Button>
    <Button
      color="primary"
      onClick={onDownload}
      disabled={!canDownload}
      className={styleMap.htmlReportDownloadButton}
      data-testid="ce-surveyresults-html-report-download"
    >
      {downloadLabel}
    </Button>
  </ModalFooter>
);

const SurveyResultsHtmlReportActionControls = renderSurveyResultsHtmlReportActionControls;

export default SurveyResultsHtmlReportActionControls;
