import React, { useEffect, useState } from 'react';
import { Modal, ModalBody } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExclamationCircle, faExpand, faSpinner, faTimes } from '@fortawesome/free-solid-svg-icons';
import styles from './CompactImageChooser.module.scss';

type CompactImageStatusTone = 'default' | 'loading' | 'error';

type CompactImageChooserProps = {
  className?: string;
  rootTestId?: string;
  showUrlModeButton?: boolean;
  urlButtonTestId?: string;
  pasteButtonTestId?: string;
  uploadButtonTestId?: string;
  fileInputTestId?: string;
  urlInputTestId?: string;
  isUrlMode?: boolean;
  isUploadMode?: boolean;
  showUrlInput?: boolean;
  urlValue?: string;
  urlInputName?: string;
  urlInputType?: React.HTMLInputTypeAttribute;
  urlMaxLength?: number;
  onUrlChange?: React.ChangeEventHandler<HTMLInputElement>;
  onToggleUrlMode?: React.MouseEventHandler<HTMLButtonElement>;
  onPaste?: React.MouseEventHandler<HTMLButtonElement>;
  onUploadClick?: React.MouseEventHandler<HTMLButtonElement>;
  onFileChange?: React.ChangeEventHandler<HTMLInputElement>;
  fileInputRef?: React.Ref<HTMLInputElement>;
  accept?: string;
  multiple?: boolean;
  urlPlaceholder?: string;
  urlInputAriaLabel?: string;
  selectedFileLabel?: string;
  previewSrc?: string;
  previewFile?: Blob | null;
  previewAlt?: string;
  onClear?: () => void;
  enablePreviewExpand?: boolean;
  expandedPreviewAlt?: string;
  statusText?: string;
  statusTone?: CompactImageStatusTone;
  helpText?: string;
  uploadAriaLabel?: string;
  clearAriaLabel?: string;
  expandAriaLabel?: string;
  disabled?: boolean;
};

const toText = (value: unknown) => (typeof value === 'string' ? value : value == null ? '' : String(value));

const joinClassNames = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ');

const resolveStatusIcon = (tone: CompactImageStatusTone) => {
  if (tone === 'loading') return <FontAwesomeIcon icon={faSpinner} spin />;
  if (tone === 'error') return <FontAwesomeIcon icon={faExclamationCircle} />;
  return null;
};

const CompactImageChooser = ({
  className = '',
  rootTestId,
  showUrlModeButton = true,
  urlButtonTestId,
  pasteButtonTestId,
  uploadButtonTestId,
  fileInputTestId,
  urlInputTestId,
  isUrlMode = false,
  isUploadMode = false,
  showUrlInput = false,
  urlValue = '',
  urlInputName = '',
  urlInputType = 'text',
  urlMaxLength,
  onUrlChange,
  onToggleUrlMode,
  onPaste,
  onUploadClick,
  onFileChange,
  fileInputRef,
  accept = 'image/*',
  multiple = false,
  urlPlaceholder = 'Paste image URL',
  urlInputAriaLabel = 'Image URL',
  selectedFileLabel = '',
  previewSrc = '',
  previewFile = null,
  previewAlt = 'Image preview',
  onClear,
  enablePreviewExpand = false,
  expandedPreviewAlt = 'Expanded image preview',
  statusText = '',
  statusTone = 'default',
  helpText = '',
  uploadAriaLabel = 'Upload image',
  clearAriaLabel = 'Remove image',
  expandAriaLabel = 'Expand image preview',
  disabled = false,
}: CompactImageChooserProps) => {
  const [generatedPreviewSrc, setGeneratedPreviewSrc] = useState('');
  const [expandedOpen, setExpandedOpen] = useState(false);

  useEffect(() => {
    const explicitPreviewSrc = toText(previewSrc).trim();
    if (explicitPreviewSrc) {
      setGeneratedPreviewSrc('');
      return undefined;
    }
    if (!previewFile || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
      setGeneratedPreviewSrc('');
      return undefined;
    }

    const objectUrl = URL.createObjectURL(previewFile);
    setGeneratedPreviewSrc(objectUrl);
    return () => {
      if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [previewFile, previewSrc]);

  const resolvedPreviewSrc = toText(previewSrc).trim() || generatedPreviewSrc;
  const hasPreview = resolvedPreviewSrc.length > 0;
  const hasStatus = toText(statusText).trim().length > 0;
  const hasHelp = toText(helpText).trim().length > 0;
  const showExpandedPreview = enablePreviewExpand && hasPreview;
  const statusIcon = resolveStatusIcon(statusTone);

  useEffect(() => {
    if (hasPreview) return;
    setExpandedOpen(false);
  }, [hasPreview]);

  return (
    <>
      <div className={joinClassNames(styles.root, className)} {...(rootTestId ? { 'data-testid': rootTestId } : {})}>
        <div className={styles.modeRow}>
          {showUrlModeButton ? (
            <button
              type="button"
              className={joinClassNames(styles.modeButton, isUrlMode ? styles.modeButtonActive : '')}
              onClick={onToggleUrlMode}
              aria-pressed={isUrlMode}
              disabled={disabled}
              {...(urlButtonTestId ? { 'data-testid': urlButtonTestId } : {})}
            >
              URL
            </button>
          ) : null}
          <button
            type="button"
            className={styles.modeButton}
            onClick={onPaste}
            disabled={disabled}
            {...(pasteButtonTestId ? { 'data-testid': pasteButtonTestId } : {})}
          >
            Paste
          </button>
          <button
            type="button"
            className={joinClassNames(styles.modeButton, isUploadMode ? styles.modeButtonActive : '')}
            onClick={onUploadClick}
            aria-label={uploadAriaLabel}
            aria-pressed={isUploadMode}
            disabled={disabled}
            {...(uploadButtonTestId ? { 'data-testid': uploadButtonTestId } : {})}
          >
            Upload
          </button>
          <input
            type="file"
            accept={accept}
            multiple={multiple}
            onChange={onFileChange}
            ref={fileInputRef}
            className={styles.fileInput}
            disabled={disabled}
            {...(fileInputTestId ? { 'data-testid': fileInputTestId } : {})}
          />
        </div>

        {selectedFileLabel ? (
          <div className={styles.selectedFile} title={selectedFileLabel}>
            {selectedFileLabel}
          </div>
        ) : null}

        {showUrlInput ? (
          <input
            type={urlInputType}
            name={urlInputName}
            value={urlValue}
            onChange={onUrlChange}
            maxLength={urlMaxLength}
            placeholder={urlPlaceholder}
            aria-label={urlInputAriaLabel}
            className={styles.urlInput}
            disabled={disabled}
            {...(urlInputTestId ? { 'data-testid': urlInputTestId } : {})}
          />
        ) : null}

        {hasStatus ? (
          <div
            className={joinClassNames(
              styles.message,
              statusTone === 'loading' ? styles.messageLoading : '',
              statusTone === 'error' ? styles.messageError : '',
            )}
          >
            {statusIcon}
            <span>{statusText}</span>
          </div>
        ) : null}

        {hasHelp ? <div className={styles.helpText}>{helpText}</div> : null}

        {hasPreview ? (
          <div className={joinClassNames(styles.previewSurface, styles.previewFill)}>
            {showExpandedPreview ? (
              <button
                type="button"
                className={styles.previewButton}
                onClick={() => setExpandedOpen(true)}
                aria-label={expandAriaLabel}
              >
                <img src={resolvedPreviewSrc} alt={previewAlt} className={styles.previewImage} />
                <span className={styles.previewOverlay}>
                  <FontAwesomeIcon icon={faExpand} />
                  <span>Expand</span>
                </span>
              </button>
            ) : (
              <img src={resolvedPreviewSrc} alt={previewAlt} className={styles.previewImage} />
            )}

            {typeof onClear === 'function' ? (
              <button
                type="button"
                onClick={() => {
                  setExpandedOpen(false);
                  onClear();
                }}
                className={styles.clearButton}
                aria-label={clearAriaLabel}
                title="Remove image"
                disabled={disabled}
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {showExpandedPreview ? (
        <Modal
          isOpen={expandedOpen}
          toggle={() => setExpandedOpen(false)}
          centered
          size="xl"
          contentClassName={styles.expandedModalContent}
        >
          <ModalBody className={styles.expandedModalBody} onClick={() => setExpandedOpen(false)}>
            <img src={resolvedPreviewSrc} alt={expandedPreviewAlt} />
          </ModalBody>
        </Modal>
      ) : null}
    </>
  );
};

export default CompactImageChooser;
