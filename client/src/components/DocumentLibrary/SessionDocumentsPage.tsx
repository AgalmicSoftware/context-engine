/** @file SessionDocumentsPage.tsx */

import React, { useMemo } from 'react';
import styles from './SessionDocumentsPage.module.scss';

import DocumentLibraryPanel from './DocumentLibraryPanel';
import { normalizeSessionIdHex } from '../../utilities/docLibrary/tags.js';
import { normalizeSessionSlug } from '../../utilities/session/sessionNaming.js';
import { parseSessionWorkerDiscoveryOrigin } from '../../utilities/session/sessionWorkerDiscovery.js';

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
  workerOrigin?: string;
};

const DocumentLibraryPanelComponent = DocumentLibraryPanel as React.ComponentType<any>;

const buildSessionBackHref = ({
  sessionToken,
  sessionSlug,
  workerOrigin,
}: Pick<SessionDocumentsPageProps, 'sessionToken' | 'sessionSlug' | 'workerOrigin'> = {}) => {
  const hasExplicitSessionSlug = sessionSlug !== undefined && sessionSlug !== null;
  const rawSlug = hasExplicitSessionSlug ? sessionSlug : sessionToken;
  const slug = normalizeSessionSlug(rawSlug || '');
  const sessionHref = slug ? `/session/${encodeURIComponent(slug)}` : '/session';
  if (!workerOrigin) return sessionHref;
  try {
    const params = new URLSearchParams();
    params.set('worker', parseSessionWorkerDiscoveryOrigin(workerOrigin));
    return `${sessionHref}?${params.toString()}`;
  } catch (_) {
    return sessionHref;
  }
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
  workerOrigin,
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

  const backHref = buildSessionBackHref({ sessionToken, sessionSlug, workerOrigin });

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
