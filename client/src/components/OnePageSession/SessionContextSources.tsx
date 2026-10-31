import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExternalLinkAlt, faFileAlt } from '@fortawesome/free-solid-svg-icons';

import ContextSourcesPanel from '../Sessions/setup/ContextSourcesPanel';
import setupStyles from '../Sessions/setup/SessionSetup.module.scss';
import { buildSessionDocLibraryViewerUrl } from '../../utilities/docLibrary/docUploadContracts';
import type { SessionContextSourcesState } from '../../utilities/docLibrary/useSessionContextSources';
import styles from './OnePageSession.module.scss';

type Props = {
  sessionSlug: string;
  sessionConfig: Record<string, unknown> | null;
  account: string;
  /** Only the sources this reader may see; the Worker leaves out the rest. */
  list: SessionContextSourcesState;
  /** The session's page links, which already show above. */
  pageLinks: Array<{ label: string; url: string }>;
};

// The Context section's files and links: the ones this reader may open, and
// for admins the controls that add, refresh and remove them.
const SessionContextSources = ({ sessionSlug, sessionConfig, account, list, pageLinks }: Props) => {
  const isAdmin = list.isAdmin && list.supported;
  const shown = list.sources.filter(
    (source) => !(source.kind === 'link' && pageLinks.some((link) => link.url === source.url)),
  );
  return (
    <>
      {shown.length ? (
        <section
          className={styles.sessionContextSection}
          aria-label="Files and links"
          data-testid="ce-session-context-sources"
        >
          <div className={styles.sessionContextLinks}>
            {shown.map((source) => {
              const href =
                source.kind === 'link'
                  ? source.url
                  : buildSessionDocLibraryViewerUrl({
                      sessionToken: sessionSlug,
                      storageRef: source.id,
                      storage: 'cloudflare',
                      kind: 'file',
                      name: source.title,
                    });
              return (
                <a key={source.id} href={href} target="_blank" rel="noopener noreferrer">
                  <FontAwesomeIcon icon={source.kind === 'link' ? faExternalLinkAlt : faFileAlt} />
                  <span>{source.title || source.url}</span>
                  {isAdmin && source.adminsOnly ? (
                    <span className={styles.sessionContextBadge}>Admins only</span>
                  ) : null}
                </a>
              );
            })}
          </div>
        </section>
      ) : null}
      {isAdmin ? (
        <details
          className={`${setupStyles.page} ${styles.sessionContextManage}`}
          data-testid="ce-session-context-manage"
        >
          <summary className={setupStyles.fieldLabel}>Manage files and links</summary>
          <ContextSourcesPanel
            sessionSlug={sessionSlug}
            sessionConfig={sessionConfig}
            account={account}
            pageLinks={pageLinks}
            list={list}
          />
        </details>
      ) : null}
    </>
  );
};

export default SessionContextSources;
