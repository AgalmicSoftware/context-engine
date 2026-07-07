import React from 'react';
import { Modal, ModalBody, ModalFooter } from 'reactstrap';

import { renderSurveyResultsDisplayPanels, type SurveyResultsDisplayPanelsArgs } from './SurveyResultsDisplayPanels';
import SurveyResultsDemoSurface, { type SurveyResultsDemoSurfaceProps } from './SurveyResultsDemoSurface';
import {
  renderSurveyResultsHtmlReportExportModal,
  type SurveyResultsHtmlReportExportModalProps,
} from './SurveyResultsHtmlReportExportModal';
import SurveyResultsModalHeader, { type SurveyResultsModalHeaderProps } from './SurveyResultsModalHeader';

export type SurveyResultsReportSurfaceDisplayPlan = {
  demoResultsViewMode?: string;
  isDemoAlternateResultsView?: boolean;
};

export type SurveyResultsReportSurfaceDisplayProps = {
  demoSurfaceProps?: SurveyResultsDemoSurfaceProps | null;
  displayPanelsProps: SurveyResultsDisplayPanelsArgs;
  htmlReportModalProps: SurveyResultsHtmlReportExportModalProps;
  isOpen?: boolean;
  modalHeaderProps: Omit<SurveyResultsModalHeaderProps, 'onClose'>;
  reportSurfaceDisplayPlan?: SurveyResultsReportSurfaceDisplayPlan;
  styleMap: Record<string, string>;
};

export type SurveyResultsReportSurfaceExecutionProps = {
  onCloseResultsModal: () => void;
};

export type SurveyResultsReportSurfaceProps = SurveyResultsReportSurfaceDisplayProps &
  SurveyResultsReportSurfaceExecutionProps;

const SurveyResultsReportSurface = ({
  demoSurfaceProps = null,
  displayPanelsProps,
  htmlReportModalProps,
  isOpen = false,
  modalHeaderProps,
  onCloseResultsModal,
  reportSurfaceDisplayPlan = {},
  styleMap,
}: SurveyResultsReportSurfaceProps): React.ReactElement => {
  const { demoResultsViewMode = 'raw', isDemoAlternateResultsView = false } = reportSurfaceDisplayPlan;

  return (
    <>
      <Modal isOpen={isOpen} toggle={onCloseResultsModal} className={styleMap.resultsModal}>
        <SurveyResultsModalHeader {...modalHeaderProps} onClose={onCloseResultsModal} />

        <ModalBody className={styleMap.modalBody}>
          {isDemoAlternateResultsView && demoSurfaceProps ? (
            <div
              className={styleMap.demoResultsSurface}
              data-testid={`ce-surveyresults-demo-surface-${demoResultsViewMode}`}
            >
              <SurveyResultsDemoSurface {...demoSurfaceProps} />
            </div>
          ) : (
            renderSurveyResultsDisplayPanels(displayPanelsProps)
          )}
        </ModalBody>

        <ModalFooter />
      </Modal>
      {renderSurveyResultsHtmlReportExportModal(htmlReportModalProps)}
    </>
  );
};

export default SurveyResultsReportSurface;
