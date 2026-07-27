import React from 'react';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import {
  claimsWorkerCanonicalAuthority,
  resolveSessionCapabilityProjection,
} from '../../utilities/session/sessionCapabilityProjection';
import styles from './SBTsPage.module.scss';

// One shared copy of the standalone-SBT clarification: Worker-native sessions
// keep their Groups in the session Worker, so every surface that can open the
// on-chain Create tool for such a session must label it external/optional.
// A malformed profile that still claims Worker authority keeps the notice —
// hiding it would present the on-chain creator as that session's native path.
export const shouldShowAdvancedExternalSbtNotice = (sessionConfig: unknown): boolean =>
  resolveSessionCapabilityProjection(sessionConfig).usesWorkerGroups || claimsWorkerCanonicalAuthority(sessionConfig);

const SbtCreateAdvancedExternalNotice = (): React.ReactElement => (
  <aside
    className={styles.advancedExternalNotice}
    data-testid={E2E_TESTIDS.SBT_CREATE_ADVANCED_EXTERNAL_NOTICE}
    aria-label="Advanced external on-chain SBT creation"
  >
    <strong>Advanced/external on-chain SBT</strong>
    <span>
      This optional standalone tool deploys an SBT on the selected Network. It does not replace or modify this
      session&apos;s Worker-native Groups.
    </span>
  </aside>
);

export default SbtCreateAdvancedExternalNotice;
