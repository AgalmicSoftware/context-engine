/** @file SessionHeaderField.jsx */
import React from 'react';
import { Input, Label } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExpand, faTimes } from '@fortawesome/free-solid-svg-icons';
import CompactImageChooser from '../Shared/CompactImageChooser.jsx';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { toStr } from '../../utilities/shared/primitives.js';
import styles from './SessionWizard.module.scss';

const SessionHeaderField = ({
  compact = false,
  value,
  sessionHeaderMode,
  compactSessionHeaderMode,
  sessionHeaderPreviewSrc,
  sessionHeaderUploadStatus,
  sessionHeaderUploadStatusTone,
  compactSessionHeaderInputRef,
  onUrlChange,
  onCompactUrlChange,
  onToggleCompactUrlMode,
  onPaste,
  onCompactUploadClick,
  onCompactFileChange,
  onUseUrlMode,
  onUseUploadMode,
  onAdvancedFileChange,
  onClear,
  onExpandPreview,
}) => {
  const previewSrc = toStr(sessionHeaderPreviewSrc).trim();

  if (compact) {
    return (
      <CompactImageChooser
        className={styles.compactSessionHeaderStandalone}
        rootTestId={E2E_TESTIDS.WIZARD_SESSION_HEADER_INLINE_BAR}
        urlButtonTestId={E2E_TESTIDS.WIZARD_SESSION_HEADER_URL_TOGGLE}
        pasteButtonTestId={E2E_TESTIDS.WIZARD_SESSION_HEADER_PASTE}
        urlInputTestId={E2E_TESTIDS.WIZARD_SESSION_HEADER_URL}
        isUrlMode={compactSessionHeaderMode === 'url'}
        isUploadMode={sessionHeaderMode === 'upload'}
        showUrlInput={compactSessionHeaderMode === 'url'}
        urlValue={value == null ? '' : value}
        onUrlChange={onCompactUrlChange || onUrlChange}
        onToggleUrlMode={onToggleCompactUrlMode}
        onPaste={onPaste}
        onUploadClick={onCompactUploadClick}
        onFileChange={onCompactFileChange}
        fileInputRef={compactSessionHeaderInputRef}
        previewSrc={sessionHeaderPreviewSrc}
        previewAlt="Session header preview"
        onClear={onClear}
        enablePreviewExpand={true}
        expandedPreviewAlt="Expanded session header preview"
        statusText={sessionHeaderUploadStatus}
        statusTone={sessionHeaderUploadStatusTone}
        expandAriaLabel="Expand session header image"
        clearAriaLabel="Remove session header image"
      />
    );
  }

  return (
    <>
      <div className={styles.inlineToggleRow}>
        <Label className={styles.workerRadio}>
          <Input
            type="radio"
            name="sessionHeaderMode"
            checked={sessionHeaderMode === 'url'}
            onChange={onUseUrlMode}
          />
          Use URL
        </Label>
        <Label className={styles.workerRadio}>
          <Input
            type="radio"
            name="sessionHeaderMode"
            checked={sessionHeaderMode === 'upload'}
            onChange={onUseUploadMode}
          />
          Upload file
        </Label>
      </div>
      {sessionHeaderMode === 'url' ? (
        <Input
          value={value == null ? '' : value}
          onChange={onUrlChange}
          placeholder="https://..."
          data-testid={E2E_TESTIDS.WIZARD_SESSION_HEADER_URL}
        />
      ) : (
        <Input
          type="file"
          accept="image/*"
          onChange={onAdvancedFileChange}
        />
      )}
      {previewSrc ? (
        <div className={styles.sessionHeaderPreviewSurface}>
          <button
            type="button"
            className={styles.sessionHeaderPreviewSurfaceFilled}
            onClick={onExpandPreview}
            aria-label="Expand session header image"
          >
            <img src={previewSrc} alt="Session header preview" />
            <span className={styles.sessionHeaderPreviewOverlay}>
              <FontAwesomeIcon icon={faExpand} />
              <span>Expand</span>
            </span>
          </button>
          <button
            type="button"
            className={styles.sessionHeaderPreviewClearButton}
            onClick={(event) => {
              event.stopPropagation();
              onClear();
            }}
            aria-label="Remove session header image"
            title="Remove image"
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>
      ) : null}
      {sessionHeaderUploadStatus && <div className={styles.statusNote}>{sessionHeaderUploadStatus}</div>}
    </>
  );
};

export default SessionHeaderField;
