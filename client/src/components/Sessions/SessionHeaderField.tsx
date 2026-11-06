/** @file SessionHeaderField.tsx */
import React from 'react';
import CompactImageChooser from '../Shared/CompactImageChooser';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { toStr } from '../../utilities/shared/primitives.js';
import { SESSION_HEADER_IMAGE_ACCEPT } from './sessionWizardUiSupport';
import styles from './SessionWizard.module.scss';

type SessionHeaderMode = 'url' | 'upload' | string;
type CompactSessionHeaderMode = 'idle' | 'url' | string;
type UploadStatusTone = React.ComponentProps<typeof CompactImageChooser>['statusTone'];

export type SessionHeaderFieldProps = {
  allowFileUpload?: boolean;
  value?: string | null;
  sessionHeaderMode: SessionHeaderMode;
  compactSessionHeaderMode: CompactSessionHeaderMode;
  sessionHeaderPreviewSrc?: string | null;
  sessionHeaderUploadStatus?: string;
  sessionHeaderUploadStatusTone?: UploadStatusTone;
  compactSessionHeaderInputRef?: React.Ref<HTMLInputElement>;
  onUrlChange?: React.ChangeEventHandler<HTMLInputElement>;
  onCompactUrlChange?: React.ChangeEventHandler<HTMLInputElement>;
  onToggleCompactUrlMode?: React.MouseEventHandler<HTMLButtonElement>;
  onPaste?: React.MouseEventHandler<HTMLButtonElement>;
  onCompactUploadClick?: React.MouseEventHandler<HTMLButtonElement>;
  onCompactFileChange?: React.ChangeEventHandler<HTMLInputElement>;
  onClear: () => void;
};

const SessionHeaderField = ({
  allowFileUpload = true,
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
  onClear,
}: SessionHeaderFieldProps) => {
  const previewSrc = toStr(sessionHeaderPreviewSrc).trim();

  return (
    <CompactImageChooser
      className={styles.compactSessionHeaderStandalone}
      rootTestId={E2E_TESTIDS.WIZARD_SESSION_HEADER_INLINE_BAR}
      urlButtonTestId={E2E_TESTIDS.WIZARD_SESSION_HEADER_URL_TOGGLE}
      pasteButtonTestId={E2E_TESTIDS.WIZARD_SESSION_HEADER_PASTE}
      urlInputTestId={E2E_TESTIDS.WIZARD_SESSION_HEADER_URL}
      isUrlMode={compactSessionHeaderMode === 'url'}
      isUploadMode={allowFileUpload && sessionHeaderMode === 'upload'}
      showUploadControl={allowFileUpload}
      showUrlInput={compactSessionHeaderMode === 'url'}
      urlValue={value == null ? '' : value}
      onUrlChange={onCompactUrlChange || onUrlChange}
      onToggleUrlMode={onToggleCompactUrlMode}
      onPaste={onPaste}
      onUploadClick={onCompactUploadClick}
      onFileChange={onCompactFileChange}
      accept={SESSION_HEADER_IMAGE_ACCEPT}
      fileInputRef={compactSessionHeaderInputRef}
      previewSrc={previewSrc}
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
};

export default SessionHeaderField;
