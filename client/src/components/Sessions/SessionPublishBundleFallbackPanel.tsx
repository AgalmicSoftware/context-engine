import React from 'react';
import { Button, FormGroup, Input, Label } from 'reactstrap';

import styles from './SessionWizard.module.scss';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';

export type SessionPublishBundleFallbackPanelProps = {
  bundleFile: File | null;
  bundleFileInputRef: React.RefObject<HTMLInputElement>;
  localWorkerBundleFallbackFilePath: string;
  manualBundleUrlOverrideHelp: string;
  normalModeBundleUrlOverride: string;
  normalModeBundleUrlOverrideValidationError: string;
  onBundleFileChange: (file: File | null) => void;
  onClearBundleFile: () => void;
  onNormalModeBundleUrlOverrideChange: (value: string) => void;
  sponsoredManualBundleRetryMessage: string;
};

const SessionPublishBundleFallbackPanel = ({
  bundleFile,
  bundleFileInputRef,
  localWorkerBundleFallbackFilePath,
  manualBundleUrlOverrideHelp,
  normalModeBundleUrlOverride,
  normalModeBundleUrlOverrideValidationError,
  onBundleFileChange,
  onClearBundleFile,
  onNormalModeBundleUrlOverrideChange,
  sponsoredManualBundleRetryMessage,
}: SessionPublishBundleFallbackPanelProps): React.ReactElement => (
  <>
    <FormGroup className={styles.fieldGroup}>
      <Label>Manual bundle URL override (optional)</Label>
      <Input
        type="url"
        value={normalModeBundleUrlOverride}
        placeholder="https://github.com/<org>/<repo>/releases/download/<tag>/sessionCorsWorker.bundle.js"
        data-testid={E2E_TESTIDS.WIZARD_BUNDLE_URL_OVERRIDE}
        invalid={!!normalModeBundleUrlOverrideValidationError}
        onChange={(e) => onNormalModeBundleUrlOverrideChange(e.target.value)}
      />
      <div className={styles.helperText}>{manualBundleUrlOverrideHelp}</div>
      {normalModeBundleUrlOverrideValidationError ? (
        <div className={styles.errorText}>{normalModeBundleUrlOverrideValidationError}</div>
      ) : null}
    </FormGroup>
    <FormGroup className={styles.fieldGroup}>
      <Label>Worker bundle fallback (optional)</Label>
      <div className={styles.bundleFileInputRow}>
        <Input
          type="file"
          accept=".js,.mjs,.txt"
          innerRef={bundleFileInputRef}
          data-testid={E2E_TESTIDS.WIZARD_BUNDLE_FILE_INPUT}
          onChange={(e) => {
            const file = e.target.files && e.target.files[0];
            onBundleFileChange(file || null);
          }}
        />
        <Button
          type="button"
          className={styles.secondaryButton}
          onClick={onClearBundleFile}
          data-testid={E2E_TESTIDS.WIZARD_CLEAR_BUNDLE_FILE_PUBLISH}
          disabled={!bundleFile}
        >
          Clear bundle file
        </Button>
      </div>
      <div className={styles.helperText}>{sponsoredManualBundleRetryMessage}</div>
      {bundleFile ? (
        <div className={styles.helperText}>
          Using {bundleFile.name || localWorkerBundleFallbackFilePath} for this publish.
        </div>
      ) : null}
    </FormGroup>
  </>
);

export default SessionPublishBundleFallbackPanel;
