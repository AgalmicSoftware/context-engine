import React from 'react';

import { E2E_TESTIDS } from '../../../utilities/e2eTestIds.js';
import styles from './SessionSetup.module.scss';

type SetupSlugPreviewProps = {
  slug: string;
  /** useSessionSlugState's check: idle, checking, taken, available or error. */
  availability?: string;
  error?: string;
};

const origin = () => (typeof window === 'undefined' ? '' : window.location.origin);

// The link the name makes. It is fixed once the session is published.
const SetupSlugPreview = ({
  slug,
  availability = '',
  error = '',
}: SetupSlugPreviewProps): React.ReactElement | null => {
  if (!slug) return null;
  return (
    <div>
      <p className={styles.hint}>
        Link:{' '}
        <span className={styles.readOnlyValue} data-testid={E2E_TESTIDS.WIZARD_SLUG}>
          {`${origin()}/session/${slug}`}
        </span>
      </p>
      {error ? <p className={styles.errorText}>{error}</p> : null}
      {!error && availability === 'taken' ? (
        <p className={styles.errorText} data-testid={E2E_TESTIDS.WIZARD_SLUG_TAKEN}>
          That link is taken. Change the name.
        </p>
      ) : null}
      {!error && availability === 'available' ? (
        <p className={styles.hint} data-testid={E2E_TESTIDS.WIZARD_SLUG_AVAILABLE}>
          The link is free.
        </p>
      ) : null}
    </div>
  );
};

export default SetupSlugPreview;
