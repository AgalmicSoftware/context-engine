import React from 'react';
import { Button, DropdownItem, DropdownMenu, DropdownToggle, Label, UncontrolledDropdown } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCaretUp } from '@fortawesome/free-solid-svg-icons';

type SurveyResultsExportOption = {
  label: string;
  value: string;
};

type SurveyResultsExportControlsProps = {
  exportAreaOpen?: boolean;
  exportOptions: readonly SurveyResultsExportOption[];
  exportTypeLabel?: string;
  onDownload: () => void;
  onExportHtmlReport?: () => void;
  onExportTypeChange: (value: string) => void;
  onToggleExportArea: () => void;
  styleMap: Record<string, string>;
};

const SurveyResultsExportControls = ({
  exportAreaOpen = false,
  exportOptions,
  exportTypeLabel = '',
  onDownload,
  onExportHtmlReport,
  onExportTypeChange,
  onToggleExportArea,
  styleMap,
}: SurveyResultsExportControlsProps): React.ReactElement => (
  <div className={styleMap.exportDataBox}>
    {!exportAreaOpen ? (
      <Button
        onClick={onToggleExportArea}
        className={styleMap.exportToggleButton}
        aria-expanded={exportAreaOpen}
        aria-controls="surveyResultsExportArea"
      >
        Export Data
      </Button>
    ) : (
      <div className={styleMap.exportAreaExpanded} id="surveyResultsExportArea">
        <div className={styleMap.exportAreaHeader}>
          <Label for="exportType" className={styleMap.exportLabel}>
            Export Data:
          </Label>
          <Button
            type="button"
            color="link"
            className={styleMap.exportCollapseButton}
            onClick={onToggleExportArea}
            aria-label="Collapse export area"
          >
            <FontAwesomeIcon icon={faCaretUp} />
          </Button>
        </div>
        <div id={styleMap.exportOptions}>
          <UncontrolledDropdown direction="down" className={styleMap.exportDropdownBox}>
            <DropdownToggle caret className={styleMap.exportDropdown}>
              {exportTypeLabel}
            </DropdownToggle>
            <DropdownMenu>
              {exportOptions.map((option: SurveyResultsExportOption) => (
                <DropdownItem key={option.value} onClick={() => onExportTypeChange(option.value)}>
                  {option.label}
                </DropdownItem>
              ))}
            </DropdownMenu>
          </UncontrolledDropdown>
          <Button onClick={onDownload} className={styleMap.downloadButton}>
            Download
          </Button>
          {onExportHtmlReport && (
            <Button
              type="button"
              onClick={onExportHtmlReport}
              className={styleMap.downloadButton}
              data-testid="ce-surveyresults-export-html-report"
            >
              Export HTML Report
            </Button>
          )}
        </div>
      </div>
    )}
  </div>
);

export default SurveyResultsExportControls;
