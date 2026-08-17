import React from 'react';
import { FormGroup, Input, Label } from 'reactstrap';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import {
  SESSION_COLOR_SCHEME_REGISTRY,
  getSessionColorScheme,
  normalizeSessionColorSchemeId,
} from '../../utilities/ui/sessionColorSchemes';
import styles from './SessionWizard.module.scss';

export interface SessionColorSchemeFieldProps {
  value?: { colorSchemeId?: string } | null;
  onChange: (value: { colorSchemeId: string }) => void;
}

const SessionColorSchemeField = ({ value, onChange }: SessionColorSchemeFieldProps): React.ReactElement => {
  const colorSchemeId = normalizeSessionColorSchemeId(value?.colorSchemeId);
  const scheme = getSessionColorScheme(colorSchemeId);

  return (
    <div className={styles.objectGroup}>
      <div className={styles.objectHeader}>
        <div className={styles.objectTitle}>Session colors</div>
      </div>
      <div className={styles.objectBody}>
        <FormGroup>
          <Label for="ce-session-color-scheme">Color scheme</Label>
          <Input
            id="ce-session-color-scheme"
            type="select"
            value={colorSchemeId}
            data-testid={E2E_TESTIDS.WIZARD_SESSION_COLOR_SCHEME}
            onChange={(event) => onChange({ colorSchemeId: normalizeSessionColorSchemeId(event.target.value) })}
          >
            {SESSION_COLOR_SCHEME_REGISTRY.map(({ id, label }) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </Input>
          <div className={styles.helperText}>
            Choose the accent colors used for this session. This does not change your app theme.
          </div>
        </FormGroup>

        <div
          className={styles.sessionColorPreview}
          data-testid={E2E_TESTIDS.WIZARD_SESSION_COLOR_PREVIEW}
          data-ce-session-color-scheme={colorSchemeId}
          data-ce-color-scheme-id={colorSchemeId}
          role="img"
          aria-label={`Color scheme preview: ${scheme.label}`}
        >
          <div className={styles.sessionColorPreviewCaption}>Color scheme preview</div>
          <div className={styles.sessionColorPreviewTitle}>Sample session</div>
          <div className={styles.sessionColorPreviewBody}>
            <span className={styles.sessionColorPreviewChip}>Session chip</span>
            <span className={styles.sessionColorPreviewText}>Readable session text</span>
            <span className={styles.sessionColorPreviewAction}>Accent action</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SessionColorSchemeField;
