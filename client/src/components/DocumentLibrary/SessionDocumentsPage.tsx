/** @file SessionDocumentsPage.tsx */

import React, { useMemo } from 'react';
import styles from './SessionDocumentsPage.module.scss';

import DocumentLibraryPanel from './DocumentLibraryPanel';
import { normalizeSessionIdHex } from '../../utilities/docLibrary/tags.js';
import { normalizeSessionSlug } from '../../utilities/session/sessionNaming.js';

type SessionConfig = {
  slug?: string;
  sessionIdHex?: string;
  sessionId?: string;
  __registry?: {
    sessionIdHex?: string;
    sessionId?: string;
  };
  [key: string]: unknown;
};

type SessionDocumentsPageProps = {
  provider?: unknown;
  network?: {
    id?: number | string | null;
  } | null;
  account?: string;
  litHooks?: unknown;
  loginComplete?: boolean;
  toggleLoginModal?: () => void;
  sessionToken?: string;
  sessionSlug?: string;
  sessionConfig?: SessionConfig;
  sessionIdHex?: string;
};

const DocumentLibraryPanelComponent = DocumentLibraryPanel as React.ComponentType<any>;

const buildSessionBackHref = ({
  sessionToken,
  sessionSlug,
}: Pick<SessionDocumentsPageProps, 'sessionToken' | 'sessionSlug'> = {}) => {
  const hasExplicitSessionSlug = sessionSlug !== undefined && sessionSlug !== null;
  const rawSlug = hasExplicitSessionSlug ? sessionSlug : sessionToken;
  const slug = normalizeSessionSlug(rawSlug || '');
  return slug ? `/session/${encodeURIComponent(slug)}` : '/session';
};

export default function SessionDocumentsPage({
  provider,
  network,
  account,
  litHooks,
  loginComplete,
  toggleLoginModal,
  sessionToken,
  sessionSlug,
  sessionConfig,
  sessionIdHex,
}: SessionDocumentsPageProps = {}) {
  const resolvedSessionIdHex = useMemo(
    () =>
      normalizeSessionIdHex(
        sessionIdHex ||
          sessionConfig?.__registry?.sessionIdHex ||
          sessionConfig?.__registry?.sessionId ||
          sessionConfig?.sessionIdHex ||
          sessionConfig?.sessionId ||
          '',
      ),
    [sessionIdHex, sessionConfig],
  );

  const backHref = buildSessionBackHref({ sessionToken, sessionSlug });

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.title}>Session Doc Library</div>
        <a className={styles.backLink} href={backHref}>
          Back to session
        </a>
      </div>

      <DocumentLibraryPanelComponent
        provider={provider}
        network={network}
        account={account}
        litHooks={litHooks}
        loginComplete={loginComplete}
        toggleLoginModal={toggleLoginModal}
        sessionSlug={sessionSlug}
        sessionConfig={sessionConfig}
        mode="session"
        sessionIdHex={resolvedSessionIdHex}
        compact={false}
        pageSize={25}
      />
    </div>
  );
}
