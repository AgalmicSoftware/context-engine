/** @file SessionDocumentsPage.jsx */

import React, { useMemo } from 'react';
import styles from './SessionDocumentsPage.module.scss';

import DocumentLibraryPanel from './DocumentLibraryPanel.jsx';
import { normalizeSessionIdHex } from '../../utilities/docLibrary/tags.js';
import { normalizeSessionSlug } from '../../utilities/session/sessionNaming.js';

const buildSessionBackHref = ({ sessionToken, sessionSlug } = {}) => {
  const hasExplicitSessionSlug = sessionSlug !== undefined && sessionSlug !== null;
  const rawSlug = hasExplicitSessionSlug ? sessionSlug : sessionToken;
  const slug = normalizeSessionSlug(rawSlug || '');
  return slug ? `/session/${encodeURIComponent(slug)}` : '/session';
};

export default function SessionDocumentsPage({
  provider,
  network,
  account,
  loginComplete,
  toggleLoginModal,
  sessionToken,
  sessionSlug,
  sessionConfig,
  sessionIdHex,
} = {}) {
  const resolvedSessionIdHex = useMemo(() => (
    normalizeSessionIdHex(
      sessionIdHex ||
      sessionConfig?.__registry?.sessionIdHex ||
      sessionConfig?.__registry?.sessionId ||
      sessionConfig?.sessionIdHex ||
      sessionConfig?.sessionId ||
      ''
    )
  ), [sessionIdHex, sessionConfig]);

  const backHref = buildSessionBackHref({ sessionToken, sessionSlug });

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.title}>Session Doc Library</div>
        <a className={styles.backLink} href={backHref}>Back to session</a>
      </div>

      <DocumentLibraryPanel
        provider={provider}
        network={network}
        account={account}
        loginComplete={loginComplete}
        toggleLoginModal={toggleLoginModal}
        sessionSlug={sessionSlug}
        sessionConfig={sessionConfig}
        mode="session"
        sessionIdHex={resolvedSessionIdHex}
        secondaryAssociationType="sbt"
        compact={false}
        pageSize={25}
      />
    </div>
  );
}
